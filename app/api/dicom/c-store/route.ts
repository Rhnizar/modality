import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
    const tempScriptPath = join(process.cwd(), `temp_cstore_${Date.now()}.py`);

    try {
        const { ip, port, aet, localAet, filePath } = await request.json();

        // Validate inputs
        if (!ip || !port || !aet || !localAet || !filePath) {
            return NextResponse.json(
                { success: false, error: 'Missing required parameters' },
                { status: 400 }
            );
        }

        const pythonScript = `from pynetdicom import AE, StoragePresentationContexts
from pydicom import dcmread
import sys

def send_dicom_file(
    dicom_file_path="${filePath}",
    remote_ip="${ip}",
    remote_port=${port},
    remote_aet="${aet}",
    local_aet="${localAet}"
):
    try:
        # Read the DICOM file
        ds = dcmread(dicom_file_path)
        
        # Create Application Entity
        ae = AE(ae_title=local_aet)
        
        # Add all storage presentation contexts
        ae.requested_contexts = StoragePresentationContexts
        
        # Associate with peer AE
        assoc = ae.associate(remote_ip, remote_port, ae_title=remote_aet)
        
        if assoc.is_established:
            # Send the DICOM file
            status = assoc.send_c_store(ds)
            
            # Release the association
            assoc.release()
            
            if status:
                print(f"SUCCESS")
                print(f"STATUS:{status.Status}")
                print(f"SOP_INSTANCE_UID:{ds.SOPInstanceUID}")
            else:
                print(f"ERROR:C-STORE failed - no status returned")
                sys.exit(1)
        else:
            print(f"ERROR:Association rejected or aborted")
            sys.exit(1)
            
    except Exception as e:
        print(f"ERROR:{str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    send_dicom_file()
`;

        await writeFile(tempScriptPath, pythonScript);

        const { stdout, stderr } = await execAsync(
            `${process.cwd()}/venv/bin/python3 ${tempScriptPath}`,
            { timeout: 15000 }
        );

        // Clean up the script
        await unlink(tempScriptPath);

        if (stdout.includes('SUCCESS')) {
            const statusMatch = stdout.match(/STATUS:(\d+)/);
            const sopMatch = stdout.match(/SOP_INSTANCE_UID:(.*)/);

            // Delete the DICOM file after successful transfer
            try {
                await unlink(filePath);
                console.log(`Deleted DICOM file: ${filePath}`);
            } catch (deleteError: any) {
                console.warn(`Failed to delete DICOM file: ${deleteError.message}`);
                // Don't fail the request if deletion fails
            }

            return NextResponse.json({
                success: true,
                message: 'DICOM file sent successfully to PACS',
                status: statusMatch ? statusMatch[1] : 'Unknown',
                sopInstanceUID: sopMatch ? sopMatch[1].trim() : 'Unknown',
            });
        } else {
            const errorMatch = stdout.match(/ERROR:(.*)/);
            return NextResponse.json(
                {
                    success: false,
                    error: errorMatch ? errorMatch[1].trim() : stdout.trim()
                },
                { status: 500 }
            );
        }
    } catch (error: any) {
        try { await unlink(tempScriptPath); } catch { }
        console.error('C-STORE error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Transfer failed',
            },
            { status: 500 }
        );
    }
}
