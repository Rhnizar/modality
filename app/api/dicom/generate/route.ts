import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
    const tempScriptPath = join(process.cwd(), `temp_generate_dicom_${Date.now()}.py`);
    const outputDicomPath = join(process.cwd(), `generated_dicom_${Date.now()}.dcm`);

    try {
        const { study, sopInstanceUid } = await request.json();

        if (!study || !sopInstanceUid) {
            return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
        }

        const pythonScript = `import numpy as np
import pydicom
from pydicom.dataset import Dataset, FileDataset
from pydicom.uid import generate_uid, ExplicitVRLittleEndian
from datetime import datetime
import sys

def generate_dicom_image(
    output_path="${outputDicomPath}",
    patient_name="${study.patientName}",
    patient_id="${study.patientId}",
    patient_birth_date="",
    patient_sex="",
    study_description="${study.studyDescription}",
    series_description="${study.studyDescription || 'Processed Series'}",
    modality="${study.modality || 'CT'}",
    sop_instance_uid="${sopInstanceUid}",
    study_instance_uid="${study.studyInstanceUID || '1.2.3.4.5.999.' + Date.now()}",
    accession_number="${study.accessionNumber}",
    image_width=512,
    image_height=512,
    image_type="pattern"
):
    # Create file meta information
    file_meta = Dataset()
    file_meta.MediaStorageSOPClassUID = pydicom.uid.CTImageStorage
    file_meta.MediaStorageSOPInstanceUID = sop_instance_uid
    file_meta.TransferSyntaxUID = ExplicitVRLittleEndian
    file_meta.ImplementationClassUID = generate_uid()
    
    # Create the FileDataset instance
    ds = FileDataset(
        output_path,
        {},
        file_meta=file_meta,
        preamble=b"\\0" * 128
    )
    
    # Set creation date/time
    dt = datetime.now()
    ds.ContentDate = dt.strftime('%Y%m%d')
    ds.ContentTime = dt.strftime('%H%M%S.%f')
    ds.StudyDate = dt.strftime('%Y%m%d')
    ds.StudyTime = dt.strftime('%H%M%S.%f')
    ds.SeriesDate = dt.strftime('%Y%m%d')
    ds.SeriesTime = dt.strftime('%H%M%S.%f')
    
    # Patient information
    ds.PatientName = patient_name
    ds.PatientID = patient_id
    ds.PatientBirthDate = patient_birth_date
    ds.PatientSex = patient_sex
    ds.AccessionNumber = accession_number
    
    # Study information
    ds.StudyInstanceUID = study_instance_uid
    ds.StudyDescription = study_description
    ds.StudyID = "1"
    
    # Series information
    ds.SeriesInstanceUID = generate_uid()
    ds.SeriesDescription = series_description
    ds.SeriesNumber = "1"
    ds.Modality = modality
    
    # Instance information
    ds.SOPInstanceUID = sop_instance_uid
    ds.SOPClassUID = pydicom.uid.CTImageStorage
    ds.InstanceNumber = "1"
    
    # Image information
    ds.SamplesPerPixel = 1
    ds.PhotometricInterpretation = "MONOCHROME2"
    ds.Rows = image_height
    ds.Columns = image_width
    ds.BitsAllocated = 16
    ds.BitsStored = 16
    ds.HighBit = 15
    ds.PixelRepresentation = 0  # Unsigned
    
    # Generate pixel data
    # Create a test pattern with gradient
    x = np.linspace(0, 1, image_width)
    y = np.linspace(0, 1, image_height)
    X, Y = np.meshgrid(x, y)
    
    # Create a circular gradient pattern
    center_x, center_y = 0.5, 0.5
    radius = np.sqrt((X - center_x)**2 + (Y - center_y)**2)
    pixel_array = (np.cos(radius * 10) * 0.5 + 0.5) * 4095
    pixel_array = pixel_array.astype(np.uint16)
    
    # Set pixel data
    ds.PixelData = pixel_array.tobytes()
    
    # Additional recommended tags
    ds.WindowCenter = "2048"
    ds.WindowWidth = "4096"
    ds.RescaleIntercept = "0"
    ds.RescaleSlope = "1"
    
    # Save the DICOM file
    ds.save_as(output_path, write_like_original=False)
    print("SUCCESS")
    print(f"PATH:{output_path}")

if __name__ == "__main__":
    try:
        generate_dicom_image()
    except Exception as e:
        print(f"ERROR: {str(e)}")
        sys.exit(1)
`;

        await writeFile(tempScriptPath, pythonScript);

        const { stdout } = await execAsync(`${process.cwd()}/venv/bin/python3 ${tempScriptPath}`, { timeout: 15000 });

        // Clean up the script but keep the generated DICOM for later sending
        await unlink(tempScriptPath);

        if (stdout.includes('SUCCESS')) {
            const pathMatch = stdout.match(/PATH:(.*)/);
            const filePath = pathMatch ? pathMatch[1].trim() : outputDicomPath;

            return NextResponse.json({
                success: true,
                message: 'DICOM Generated Successfully',
                filePath: filePath
            });
        } else {
            return NextResponse.json({ success: false, error: stdout.trim() }, { status: 500 });
        }
    } catch (error: any) {
        try { await unlink(tempScriptPath); } catch { }
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
