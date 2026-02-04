import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
    const tempScriptPath = join(process.cwd(), `temp_cfind_${Date.now()}.py`);

    try {
        const { ip, port, aet, localAet } = await request.json();

        // Validate inputs
        if (!ip || !port || !aet || !localAet) {
            return NextResponse.json(
                { success: false, error: 'Missing required parameters' },
                { status: 400 }
            );
        }

        // Create Python script for C-FIND MWL query
        const pythonScript = `from pynetdicom import AE
from pynetdicom.sop_class import ModalityWorklistInformationFind
from pydicom.dataset import Dataset
import json
import sys

ae = AE(ae_title='${localAet}')
ae.add_requested_context(ModalityWorklistInformationFind)

# Build MWL query
ds = Dataset()
ds.PatientName = ''
ds.PatientID = ''
ds.PatientBirthDate = ''
ds.PatientSex = ''
ds.StudyInstanceUID = ''
ds.AccessionNumber = ''
ds.RequestedProcedureID = ''
ds.RequestedProcedureDescription = ''

sps = Dataset()
sps.Modality = ''
sps.ScheduledStationAETitle = ''
sps.ScheduledProcedureStepStartDate = ''
sps.ScheduledProcedureStepStartTime = ''
sps.ScheduledProcedureStepDescription = ''
sps.ScheduledProcedureStepID = ''
sps.ScheduledPerformingPhysicianName = ''

ds.ScheduledProcedureStepSequence = [sps]

try:
    assoc = ae.associate('${ip}', ${port}, ae_title='${aet}')
    if not assoc.is_established:
        print(json.dumps({'error': 'Association failed'}))
        sys.exit(1)
    
    responses = assoc.send_c_find(ds, query_model=ModalityWorklistInformationFind)
    
    results = []
    for (status, identifier) in responses:
        if status and status.Status in (0xFF00, 0xFF01):
            sps_list = getattr(identifier, "ScheduledProcedureStepSequence", [])
            sps_item = sps_list[0] if sps_list else Dataset()
            
            study = {
                'patientId': str(getattr(identifier, "PatientID", "N/A")),
                'patientName': str(getattr(identifier, "PatientName", "N/A")),
                'patientBirthDate': str(getattr(identifier, "PatientBirthDate", "")),
                'patientSex': str(getattr(identifier, "PatientSex", "")),
                'accessionNumber': str(getattr(identifier, "AccessionNumber", "N/A")),
                'studyInstanceUID': str(getattr(identifier, "StudyInstanceUID", "")),
                'studyDescription': str(getattr(identifier, "RequestedProcedureDescription", "") or getattr(sps_item, "ScheduledProcedureStepDescription", "N/A")),
                'modality': str(getattr(sps_item, "Modality", "N/A")),
                'studyDate': str(getattr(sps_item, "ScheduledProcedureStepStartDate", "")),
                'studyTime': str(getattr(sps_item, "ScheduledProcedureStepStartTime", "")),
            }
            results.append(study)
    
    assoc.release()
    print(json.dumps({'studies': results}))
    
except Exception as e:
    print(json.dumps({'error': str(e)}))
    sys.exit(1)
`;

        // Write Python script to temporary file
        await writeFile(tempScriptPath, pythonScript);

        // Execute Python script from file
        const { stdout, stderr } = await execAsync(
            `${process.cwd()}/venv/bin/python3 ${tempScriptPath}`,
            { timeout: 30000 }
        );

        // Clean up temp file
        await unlink(tempScriptPath);

        const result = JSON.parse(stdout.trim());

        if (result.error) {
            return NextResponse.json(
                {
                    success: false,
                    error: result.error,
                    studies: [],
                },
                { status: 500 }
            );
        }

        // Add IDs to studies
        const studies = result.studies.map((study: any, index: number) => ({
            id: index + 1,
            ...study,
        }));

        return NextResponse.json({
            success: true,
            studies,
            count: studies.length,
        });
    } catch (error: any) {
        // Clean up temp file if it exists
        try {
            await unlink(tempScriptPath);
        } catch { }

        console.error('C-FIND error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Query failed',
                studies: [],
            },
            { status: 500 }
        );
    }
}
