# Radiology Modality Simulator

A modern web-based DICOM modality simulator built with Next.js and Python pynetdicom.

## Features

- **C-ECHO**: Test DICOM connectivity to MWL and PACS servers
- **C-FIND**: Query Modality Worklist (MWL) for scheduled procedures
- **C-STORE**: Simulate sending DICOM images to PACS
- **Real-time Console**: Monitor all DICOM operations in real-time
- **Modern UI**: Beautiful, responsive interface with dark mode

## Prerequisites

- Node.js 18+ and npm
- Python 3.8+
- DICOM servers (MWL and PACS) for testing

## Installation

### 1. Clone and Install Node Dependencies

```bash
git clone <repository-url>
cd modality
npm install
```

### 2. Setup Python Virtual Environment

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # On Linux/Mac
# or
venv\Scripts\activate  # On Windows

# Install Python DICOM libraries
pip install pynetdicom pydicom
```

### 3. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Configuration

### Default Settings

**MWL Server:**
- IP: 127.0.0.1
- Port: 4242
- AE Title: ORTHANC

**PACS Server:**
- IP: 127.0.0.1
- Port: 4242
- AE Title: ORTHANC

**Local AE Title:** MODALITY_SCU

You can modify these settings in the web interface.

## Usage

### 1. Connect to MWL Server
1. Configure MWL server settings (IP, Port, AE Title)
2. Click "Connect" to test the connection with C-ECHO
3. Once connected, click "Query Worklist" to retrieve scheduled procedures

### 2. Select a Study
- Click "Select" on any study from the worklist table
- Study details will appear in the console

### 3. Acquire/Process Images
- Click "Acquire / Process" to simulate image acquisition
- Progress bar shows the acquisition status

### 4. Send to PACS
1. Configure PACS server settings
2. Click "Connect" to verify PACS connectivity
3. After processing is complete, click "Send to PACS"
4. Success modal confirms the transfer

## API Endpoints

### POST /api/dicom/c-echo
Test DICOM connectivity (C-ECHO)

**Request:**
```json
{
  "ip": "127.0.0.1",
  "port": "4242",
  "aet": "ORTHANC",
  "localAet": "MODALITY_SCU"
}
```

### POST /api/dicom/c-find
Query Modality Worklist (C-FIND)

**Request:**
```json
{
  "ip": "127.0.0.1",
  "port": "11112",
  "aet": "DCM4CHEE",
  "localAet": "MODALITY_SCU"
}
```

**Response:**
```json
{
  "success": true,
  "studies": [
    {
      "id": 1,
      "patientId": "PAT-001",
      "patientName": "DOE^JOHN",
      "studyDescription": "CHEST X-RAY",
      "accessionNumber": "ACC12345",
      "modality": "CR",
      "studyDate": "20260128"
    }
  ],
  "count": 1
}
```

### POST /api/dicom/c-store
Send DICOM images to PACS (C-STORE)

**Request:**
```json
{
  "ip": "127.0.0.1",
  "port": "4242",
  "aet": "ORTHANC",
  "localAet": "MODALITY_SCU",
  "studyData": {
    "patientName": "DOE^JOHN",
    "patientId": "PAT-001",
    "accessionNumber": "ACC12345",
    "modality": "CR",
    "studyDescription": "CHEST X-RAY"
  }
}
```

## Architecture

### Frontend (Next.js + React)
- Modern React components with TypeScript
- Real-time state management
- Responsive Tailwind CSS styling
- Lucide React icons

### Backend (Next.js API Routes + Python)
- Next.js API routes handle HTTP requests
- Python scripts execute DICOM operations via `pynetdicom`
- Child process integration for Python execution
- JSON communication between Node.js and Python

### DICOM Integration
- **pynetdicom**: Python library for DICOM networking
- **pydicom**: Python library for DICOM data handling
- Supports C-ECHO, C-FIND, and C-STORE operations

## Testing with Orthanc

To test with a local Orthanc PACS:

```bash
# Install Orthanc
sudo apt-get install orthanc orthanc-dicomweb

# Configure Orthanc for DICOM networking
# Edit /etc/orthanc/orthanc.json

# Start Orthanc
sudo systemctl start orthanc
```

## Troubleshooting

### Python Module Not Found
```bash
# Ensure virtual environment is created
python3 -m venv venv

# Install dependencies in venv
./venv/bin/pip install pynetdicom pydicom
```

### Connection Refused
- Verify DICOM server is running
- Check firewall settings
- Confirm IP, Port, and AE Title are correct

### Association Failed
- Verify the remote AE Title matches server configuration
- Check that the server accepts connections from your local AE Title

## License

MIT

## Author

Built with ❤️ for radiology workflow automation
