import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
    const tempScriptPath = join(process.cwd(), `temp_mpps_create_${Date.now()}.py`);

    try {
        const { study, sopInstanceUid } = await request.json();

        if (!study || !sopInstanceUid) {
            return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
        }

        console.log("study instance uid : ", study.studyInstanceUID);

        const pythonScript = `import sys
import time
from pydicom.dataset import Dataset
from pydicom.sequence import Sequence
from pynetdicom import AE
from pydicom.uid import ExplicitVRLittleEndian, ImplicitVRLittleEndian

# 1. Initialize Application Entity
ae = AE(ae_title='PYTHON_MODALITY')

# 2. MPPS SOP Class context
mpps_sop_class = '1.2.840.10008.3.1.2.3.3'
ae.add_requested_context(mpps_sop_class, [ImplicitVRLittleEndian, ExplicitVRLittleEndian])

sop_uid = '${sopInstanceUid}'
study_uid = '${study.studyInstanceUID || '1.2.3.4.5.999.' + Date.now()}'

ds = Dataset()
ds.ReportedCharacterSet = 'ISO_IR 100'

# Relationship Module
ds.PatientName = '${study.patientName}'
ds.PatientID = '${study.patientId}'
ds.PatientBirthDate = ''
ds.PatientSex = ''
ds.AccessionNumber = '${study.accessionNumber}'

# Scheduled Step Attributes Sequence
item = Dataset()
item.StudyInstanceUID = study_uid
item.AccessionNumber = '${study.accessionNumber}'
item.RequestedProcedureID = 'REQ-${study.accessionNumber}'
item.ScheduledProcedureStepID = 'SPS-${study.accessionNumber}'
item.ScheduledProcedureStepDescription = '${study.studyDescription}'
ds.ScheduledStepAttributesSequence = Sequence([item])

# Information Module
ds.PerformedProcedureStepID = 'PPS-${study.accessionNumber}'
ds.PerformedProcedureStepStartDate = time.strftime('%Y%m%d')
ds.PerformedProcedureStepStartTime = time.strftime('%H%M%S')
ds.PerformedProcedureStepStatus = 'IN PROGRESS'
ds.Modality = '${study.modality || 'CT'}'
ds.PerformedProcedureStepDescription = '${study.studyDescription}'

# Empty sequences for Type 2 attributes
ds.PerformedSeriesSequence = Sequence([])

ds.SOPInstanceUID = sop_uid

# 4. Connect to Gateway
print("Connecting to MPPS_GATEWAY...")
assoc = ae.associate('localhost', 11115, ae_title='MPPS_GATEWAY')

if assoc.is_established:
    print(f"Sending N-CREATE for UID: {sop_uid}")
    status, response = assoc.send_n_create(ds, mpps_sop_class, sop_uid)

    if status:
        if status.Status == 0x0000:
            print("SUCCESS")
        else:
            print(f"FAILED: {hex(status.Status)}")
    else:
        print("ERROR: Time out or failed")

    assoc.release()
else:
    print("ERROR: Could not establish association")
`;

        await writeFile(tempScriptPath, pythonScript);
        const { stdout } = await execAsync(`${process.cwd()}/venv/bin/python3 ${tempScriptPath}`, { timeout: 10000 });
        await unlink(tempScriptPath);

        if (stdout.includes('SUCCESS') && !stdout.includes('FAILED')) {
            return NextResponse.json({ success: true, message: 'MPPS N-CREATE successful' });
        } else {
            return NextResponse.json({ success: false, error: stdout.trim() }, { status: 500 });
        }
    } catch (error: any) {
        try { await unlink(tempScriptPath); } catch { }
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
