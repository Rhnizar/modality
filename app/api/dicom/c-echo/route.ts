import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
    const tempScriptPath = join(process.cwd(), `temp_cecho_${Date.now()}.py`);

    try {
        const { ip, port, aet, localAet } = await request.json();

        // Validate inputs
        if (!ip || !port || !aet || !localAet) {
            return NextResponse.json(
                { success: false, error: 'Missing required parameters' },
                { status: 400 }
            );
        }

        // Create Python script for C-ECHO
        const pythonScript = `from pynetdicom import AE
from pynetdicom.sop_class import Verification
import sys

ae = AE(ae_title='${localAet}')
ae.add_requested_context(Verification)

try:
    assoc = ae.associate('${ip}', ${port}, ae_title='${aet}')
    if assoc.is_established:
        status = assoc.send_c_echo()
        assoc.release()
        if status and status.Status == 0x0000:
            print('SUCCESS')
        else:
            print('FAILED')
    else:
        print('FAILED')
except Exception as e:
    print(f'ERROR: {str(e)}')
    sys.exit(1)
`;

        // Write Python script to temporary file
        await writeFile(tempScriptPath, pythonScript);

        // Execute Python script from file
        const { stdout, stderr } = await execAsync(
            `${process.cwd()}/venv/bin/python3 ${tempScriptPath}`,
            { timeout: 10000 }
        );

        // Clean up temp file
        await unlink(tempScriptPath);

        if (stdout.trim() === 'SUCCESS') {
            return NextResponse.json({
                success: true,
                message: `C-ECHO successful to ${aet} at ${ip}:${port}`,
            });
        } else {
            return NextResponse.json(
                {
                    success: false,
                    error: stderr || stdout.trim() || 'C-ECHO failed',
                },
                { status: 500 }
            );
        }
    } catch (error: any) {
        // Clean up temp file if it exists
        try {
            await unlink(tempScriptPath);
        } catch { }

        console.error('C-ECHO error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Connection failed',
            },
            { status: 500 }
        );
    }
}
