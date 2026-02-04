"use client";

import React, { useState } from 'react';
import { Monitor, Activity, Send, Search, Settings, Wifi, CheckCircle, XCircle, Database, Server, Radio } from 'lucide-react';

export default function RadiologyModalitySimulator() {
  const [consoleLog, setConsoleLog] = useState<{ timestamp: string; message: string; type: string }[]>([]);
  const [studyList, setStudyList] = useState<{ id: number; patientId: string; patientName: string; studyDescription: string; accessionNumber: string; modality: string; studyDate: string }[]>([]);
  const [selectedStudy, setSelectedStudy] = useState<{ id: number; patientId: string; patientName: string; studyDescription: string; accessionNumber: string; modality: string; studyDate: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [currentSopInstanceUid, setCurrentSopInstanceUid] = useState<string | null>(null);
  const [generatedFiles, setGeneratedFiles] = useState<string[]>([]);

  // Configuration State
  const [localAET, setLocalAET] = useState('MODALITY_SCU');

  const [mwlConfig, setMwlConfig] = useState({ ip: '127.0.0.1', port: '4242', aet: 'ORTHANC' });
  const [mwlStatus, setMwlStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>('idle');

  const [pacsConfig, setPacsConfig] = useState({ ip: '127.0.0.1', port: '4242', aet: 'ORTHANC' });
  const [pacsStatus, setPacsStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>('idle');

  const addLog = (message: string, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setConsoleLog(prev => [...prev, { timestamp, message, type }]);
  };

  const checkMwlConnection = async () => {
    setMwlStatus('checking');
    addLog(`Attempting to connect to MWL at ${mwlConfig.ip}:${mwlConfig.port} (${mwlConfig.aet})...`, 'info');

    try {
      const response = await fetch('/api/dicom/c-echo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: mwlConfig.ip,
          port: mwlConfig.port,
          aet: mwlConfig.aet,
          localAet: localAET,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMwlStatus('connected');
        addLog('MWL C-ECHO successful. Connection established.', 'success');
      } else {
        setMwlStatus('error');
        addLog(`MWL Connection failed: ${data.error}`, 'error');
      }
    } catch (error: any) {
      setMwlStatus('error');
      addLog(`MWL Connection error: ${error.message}`, 'error');
    }
  };

  const checkPacsConnection = async () => {
    setPacsStatus('checking');
    addLog(`Attempting to connect to PACS at ${pacsConfig.ip}:${pacsConfig.port} (${pacsConfig.aet})...`, 'info');

    try {
      const response = await fetch('/api/dicom/c-echo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: pacsConfig.ip,
          port: pacsConfig.port,
          aet: pacsConfig.aet,
          localAet: localAET,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setPacsStatus('connected');
        addLog('PACS C-ECHO successful. Connection established.', 'success');
      } else {
        setPacsStatus('error');
        addLog(`PACS Connection failed: ${data.error}`, 'error');
      }
    } catch (error: any) {
      setPacsStatus('error');
      addLog(`PACS Connection error: ${error.message}`, 'error');
    }
  };

  const handleQueryMWL = async () => {
    if (mwlStatus !== 'connected') {
      addLog('Error: Not connected to MWL Server. Please check connection first.', 'error');
      return;
    }
    addLog(`Querying MWL (${mwlConfig.aet} @ ${mwlConfig.ip}:${mwlConfig.port})...`, 'info');
    addLog(`C-FIND Request - Calling AET: ${localAET}`, 'info');
    setSelectedStudy(null);
    setProcessProgress(0);

    try {
      const response = await fetch('/api/dicom/c-find', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: mwlConfig.ip,
          port: mwlConfig.port,
          aet: mwlConfig.aet,
          localAet: localAET,
        }),
      });

      const data = await response.json();

      if (data.success && data.studies) {
        setStudyList(data.studies);
        addLog('MWL Query successful', 'success');
        addLog(`Retrieved ${data.studies.length} studies from worklist`, 'info');
        if (data.studies.length > 0) {
          addLog('Please select a study from the table above', 'info');
        } else {
          addLog('No studies found in worklist', 'info');
        }
      } else {
        addLog(`MWL Query failed: ${data.error}`, 'error');
        setStudyList([]);
      }
    } catch (error: any) {
      addLog(`MWL Query error: ${error.message}`, 'error');
      setStudyList([]);
    }
  };

  const handleStudySelect = (study: any) => {
    setSelectedStudy(study);
    setProcessProgress(0);
    setCurrentSopInstanceUid(null); // Reset UID for new study
    addLog(`Selected study: ${study.studyDescription} for ${study.patientName}`, 'success');
    addLog(`Patient ID: ${study.patientId} | Accession: ${study.accessionNumber}`, 'info');
  };

  const sendMPPS = async (command: 'n-create' | 'n-set', study: any, sopUid: string) => {
    try {
      addLog(`Sending MPPS ${command.toUpperCase()}...`, 'info');

      const endpoint = command === 'n-create'
        ? '/api/dicom/mpps/n-create'
        : '/api/dicom/mpps/n-set';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          study,
          sopInstanceUid: sopUid,
        }),
      });

      const data = await response.json();
      if (data.success) {
        addLog(`MPPS ${command.toUpperCase()} successful`, 'success');
        // alert(`MPPS ${command.toUpperCase()} sent successfully for ${study.patientName}`);
        return true;
      } else {
        addLog(`MPPS ${command.toUpperCase()} failed: ${data.error}`, 'error');
        return false;
      }
    } catch (error: any) {
      addLog(`MPPS ${command.toUpperCase()} error: ${error.message}`, 'error');
      return false;
    }
  };

  const handleProcess = async () => {
    if (!selectedStudy) {
      addLog('Error: No study selected. Please select a study first.', 'error');
      return;
    }

    // Generate a unique SOP Instance UID for this process session
    const sopUid = `1.2.3.4.5.999.${Date.now()}`;
    setCurrentSopInstanceUid(sopUid);

    // 1. Send MPPS N-CREATE
    const mppsCreated = await sendMPPS('n-create', selectedStudy, sopUid);

    // We continue even if MPPS fails in this simulator, 
    // but we log the status
    if (mppsCreated) {
      addLog(`MPPS Status: IN PROGRESS (Accession: ${selectedStudy.accessionNumber})`, 'success');
    }

    setIsProcessing(true);
    setProcessProgress(0);
    addLog('Starting image acquisition...', 'info');
    addLog(`Processing ${selectedStudy.studyDescription}...`, 'info');

    // Use a flag to prevent double execution if the interval fires rapidly
    let completionHandled = false;

    const interval = setInterval(() => {
      setProcessProgress(prev => {
        const next = prev + 10;
        if (next >= 100) {
          clearInterval(interval);

          if (!completionHandled) {
            completionHandled = true;
            setIsProcessing(false);
            addLog('Image acquisition complete', 'success');
            addLog('Image processing complete', 'success');
            addLog(`Study Instance UID: ${sopUid}`, 'info');
            addLog(`Generated 2 DICOM images for ${selectedStudy.patientName}`, 'success');

            // 2. Generate DICOM Image
            addLog('Generating DICOM file...', 'info');
            fetch('/api/dicom/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ study: selectedStudy, sopInstanceUid: sopUid }),
            })
              .then(res => res.json())
              .then(data => {
                if (data.success) {
                  addLog(`DICOM Generated: ${data.filePath.split('/').pop()}`, 'success');
                  setGeneratedFiles(prev => [...prev, data.filePath]);

                  // 3. Send MPPS N-SET (COMPLETED)
                  // Use setTimeout to push this out of the render cycle
                  setTimeout(() => {
                    sendMPPS('n-set', selectedStudy, sopUid);
                  }, 500);
                } else {
                  addLog(`DICOM Generation Failed: ${data.error}`, 'error');
                }
              })
              .catch(err => addLog(`Generation Error: ${err.message}`, 'error'));
          }
          return 100;
        }
        return next;
      });
    }, 300);
  };

  const handleSendToPACS = async () => {
    if (!selectedStudy) {
      addLog('Error: No study to send. Process a study first.', 'error');
      return;
    }

    if (processProgress < 100) {
      addLog('Error: Study processing incomplete.', 'error');
      return;
    }

    if (pacsStatus !== 'connected') {
      addLog('Error: Not connected to PACS. Please check connection first.', 'error');
      return;
    }

    if (generatedFiles.length === 0) {
      addLog('Error: No DICOM files generated. Please process a study first.', 'error');
      return;
    }

    addLog(`Initiating DICOM C-STORE to PACS (${pacsConfig.aet} @ ${pacsConfig.ip}:${pacsConfig.port})...`, 'info');
    addLog(`Destination: ${pacsConfig.aet} | Calling: ${localAET}`, 'info');
    addLog(`Patient: ${selectedStudy.patientName} | Accession: ${selectedStudy.accessionNumber}`, 'info');

    try {
      // Get the most recently generated file
      const fileToSend = generatedFiles[generatedFiles.length - 1];
      addLog(`Sending DICOM file: ${fileToSend.split('/').pop()}...`, 'info');

      const response = await fetch('/api/dicom/c-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: pacsConfig.ip,
          port: pacsConfig.port,
          aet: pacsConfig.aet,
          localAet: localAET,
          filePath: fileToSend,
        }),
      });

      const data = await response.json();

      if (data.success) {
        addLog('DICOM file transferred successfully', 'success');
        addLog('PACS confirmation received', 'success');
        addLog(`SOP Instance UID: ${data.sopInstanceUID}`, 'info');
        addLog('Study archived successfully', 'success');
        addLog(`Accession #${selectedStudy.accessionNumber} - Status: COMPLETED`, 'success');
        setShowSuccessModal(true);
      } else {
        addLog(`C-STORE failed: ${data.error}`, 'error');
      }
    } catch (error: any) {
      addLog(`C-STORE error: ${error.message}`, 'error');
    }
  };

  const clearConsole = () => {
    setConsoleLog([]);
    setStudyList([]);
    setSelectedStudy(null);
    setProcessProgress(0);
    setCurrentSopInstanceUid(null);
    setGeneratedFiles([]);
    setShowSuccessModal(false);
    addLog('Console cleared. System ready.', 'info');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="bg-slate-800 border-2 border-cyan-500 rounded-lg p-6 mb-6 shadow-lg shadow-cyan-500/20">
          <div className="flex items-center gap-4">
            <Monitor className="w-12 h-12 text-cyan-400" />
            <div>
              <h1 className="text-3xl font-bold text-white">Radiology Modality Simulator</h1>
              <p className="text-cyan-300">CR/DR Imaging System v1.0</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Column: Configuration */}
          <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-8 h-fit">

            {/* Card 1: MWL & Query */}
            <div className="bg-slate-800 border-2 border-slate-600 rounded-lg p-6 shadow-xl">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2 border-b border-slate-600 pb-2">
                <Database className="w-5 h-5 text-blue-400" />
                Worklist & Query
              </h2>

              <div className="space-y-4">
                {/* Local Configuration */}
                <div className="bg-slate-700/30 p-3 rounded-lg border border-slate-600">
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Local AE Title</label>
                  <div className="flex items-center gap-2 bg-slate-800 rounded px-2 py-1.5 border border-slate-600">
                    <Radio className="w-3 h-3 text-cyan-400" />
                    <input
                      type="text"
                      value={localAET}
                      onChange={(e) => setLocalAET(e.target.value)}
                      className="bg-transparent border-none focus:ring-0 text-cyan-200 text-xs font-mono w-full p-0"
                    />
                  </div>
                </div>

                {/* MWL Configuration */}
                <div className="bg-slate-700/30 p-3 rounded-lg border border-slate-600">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-300">MWL Server</span>
                    <div className={`w-2 h-2 rounded-full ${mwlStatus === 'connected' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : mwlStatus === 'error' ? 'bg-red-500' : 'bg-gray-500'}`} />
                  </div>

                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="IP Address"
                      value={mwlConfig.ip}
                      onChange={(e) => setMwlConfig({ ...mwlConfig, ip: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none font-mono"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Port"
                        value={mwlConfig.port}
                        onChange={(e) => setMwlConfig({ ...mwlConfig, port: e.target.value })}
                        className="w-1/3 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none font-mono"
                      />
                      <input
                        type="text"
                        placeholder="AET"
                        value={mwlConfig.aet}
                        onChange={(e) => setMwlConfig({ ...mwlConfig, aet: e.target.value })}
                        className="w-2/3 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none font-mono"
                      />
                    </div>
                    <button
                      onClick={checkMwlConnection}
                      className={`w-full py-1.5 px-2 rounded text-xs font-medium flex items-center justify-center gap-2 transition-colors ${mwlStatus === 'connected'
                        ? 'bg-green-600/20 text-green-400 border border-green-600/50 hover:bg-green-600/30'
                        : 'bg-slate-600 hover:bg-slate-500 text-white'
                        }`}
                    >
                      {mwlStatus === 'checking' ? (
                        <span className="animate-pulse">Connecting...</span>
                      ) : mwlStatus === 'connected' ? (
                        <><CheckCircle className="w-3 h-3" /> Connected</>
                      ) : mwlStatus === 'error' ? (
                        <><XCircle className="w-3 h-3" /> Retry</>
                      ) : (
                        <><Wifi className="w-3 h-3" /> Connect</>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleQueryMWL}
                  disabled={mwlStatus !== 'connected'}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm shadow-lg shadow-blue-500/20"
                >
                  <Search className="w-4 h-4" />
                  Query Worklist
                </button>
              </div>
            </div>

            {/* Card 2: PACS & Archiving */}
            <div className="bg-slate-800 border-2 border-slate-600 rounded-lg p-6 shadow-xl">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2 border-b border-slate-600 pb-2">
                <Server className="w-5 h-5 text-purple-400" />
                Archiving (PACS)
              </h2>

              <div className="space-y-4">
                {/* PACS Configuration */}
                <div className="bg-slate-700/30 p-3 rounded-lg border border-slate-600">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-300">PACS Server</span>
                    <div className={`w-2 h-2 rounded-full ${pacsStatus === 'connected' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : pacsStatus === 'error' ? 'bg-red-500' : 'bg-gray-500'}`} />
                  </div>

                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="IP Address"
                      value={pacsConfig.ip}
                      onChange={(e) => setPacsConfig({ ...pacsConfig, ip: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:border-purple-500 outline-none font-mono"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Port"
                        value={pacsConfig.port}
                        onChange={(e) => setPacsConfig({ ...pacsConfig, port: e.target.value })}
                        className="w-1/3 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:border-purple-500 outline-none font-mono"
                      />
                      <input
                        type="text"
                        placeholder="AET"
                        value={pacsConfig.aet}
                        onChange={(e) => setPacsConfig({ ...pacsConfig, aet: e.target.value })}
                        className="w-2/3 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:border-purple-500 outline-none font-mono"
                      />
                    </div>
                    <button
                      onClick={checkPacsConnection}
                      className={`w-full py-1.5 px-2 rounded text-xs font-medium flex items-center justify-center gap-2 transition-colors ${pacsStatus === 'connected'
                        ? 'bg-green-600/20 text-green-400 border border-green-600/50 hover:bg-green-600/30'
                        : 'bg-slate-600 hover:bg-slate-500 text-white'
                        }`}
                    >
                      {pacsStatus === 'checking' ? (
                        <span className="animate-pulse">Connecting...</span>
                      ) : pacsStatus === 'connected' ? (
                        <><CheckCircle className="w-3 h-3" /> Connected</>
                      ) : pacsStatus === 'error' ? (
                        <><XCircle className="w-3 h-3" /> Retry</>
                      ) : (
                        <><Wifi className="w-3 h-3" /> Connect</>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleSendToPACS}
                  disabled={!selectedStudy || processProgress < 100 || pacsStatus !== 'connected'}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm shadow-lg shadow-purple-500/20"
                >
                  <Send className="w-4 h-4" />
                  Send to PACS
                </button>
              </div>
            </div>
          </div>

          {/* Console - Takes up middle space */}
          <div className="lg:col-span-3">
            <div className="bg-black border-2 border-green-500 rounded-lg p-6 shadow-xl shadow-green-500/20">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-green-400 font-mono">System Console</h2>
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
              </div>

              {/* Worklist Table */}
              {studyList.length > 0 && (
                <div className="mb-4 bg-slate-900 rounded-lg p-4 overflow-x-auto">
                  <h3 className="text-cyan-400 font-semibold mb-3 text-sm">Modality Worklist - Select a Study:</h3>
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-400 uppercase border-b border-gray-700">
                      <tr>
                        <th className="px-3 py-2">Patient Name</th>
                        <th className="px-3 py-2">Patient ID</th>
                        <th className="px-3 py-2">Study Description</th>
                        <th className="px-3 py-2">Accession #</th>
                        <th className="px-3 py-2">Modality</th>
                        <th className="px-3 py-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studyList.map((study) => (
                        <tr
                          key={study.id}
                          className={`border-b border-gray-800 hover:bg-slate-800 ${selectedStudy?.id === study.id ? 'bg-cyan-900/40' : ''
                            }`}
                        >
                          <td className="px-3 py-3 text-white font-medium">{study.patientName}</td>
                          <td className="px-3 py-3 text-gray-300">{study.patientId}</td>
                          <td className="px-3 py-3 text-gray-300">{study.studyDescription}</td>
                          <td className="px-3 py-3 text-gray-300">{study.accessionNumber}</td>
                          <td className="px-3 py-3 text-gray-300">{study.modality}</td>
                          <td className="px-3 py-3 text-center">
                            <button
                              onClick={() => handleStudySelect(study)}
                              className={`px-4 py-1.5 rounded text-xs font-semibold transition-colors ${selectedStudy?.id === study.id
                                ? 'bg-cyan-600 text-white'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                            >
                              {selectedStudy?.id === study.id ? '✓ Selected' : 'Select'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Console Log */}
              <div className="bg-gray-900 rounded-lg p-4 h-[500px] overflow-y-auto font-mono text-sm">
                {consoleLog.length === 0 ? (
                  <div className="text-gray-500">System ready. Click "Query from MWL" to retrieve studies...</div>
                ) : (
                  consoleLog.map((log, idx) => (
                    <div key={idx} className="mb-1">
                      <span className="text-gray-500">[{log.timestamp}]</span>{' '}
                      <span className={
                        log.type === 'error' ? 'text-red-400' :
                          log.type === 'success' ? 'text-green-400' :
                            'text-cyan-300'
                      }>
                        {log.message}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column: System Controls */}
          <div className="lg:col-span-1 lg:sticky lg:top-8 h-fit">
            <div className="bg-slate-800 border-2 border-slate-600 rounded-lg p-6 shadow-xl">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2 border-b border-slate-600 pb-2">
                <Settings className="w-5 h-5 text-gray-400" />
                System Control
              </h2>

              <div className="space-y-4">
                <button
                  onClick={handleProcess}
                  disabled={!selectedStudy || isProcessing}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm shadow-lg shadow-green-500/20"
                >
                  <Activity className="w-5 h-5" />
                  Acquire & Process
                </button>

                <button
                  onClick={clearConsole}
                  className="w-full bg-red-900/40 hover:bg-red-900/60 border border-red-800 text-red-200 font-semibold py-2.5 px-4 rounded-lg transition-colors text-xs flex items-center justify-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Reset System
                </button>

                {/* Processing Progress */}
                {isProcessing && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-gray-300 mb-1">
                      <span>Acquiring...</span>
                      <span>{processProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-1.5">
                      <div
                        className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${processProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {processProgress === 100 && !isProcessing && (
                  <div className="bg-green-900/30 border border-green-500/50 rounded p-2 text-center">
                    <div className="text-green-400 text-xs font-semibold">Acquisition Complete</div>
                  </div>
                )}

                <div className="bg-slate-700/30 p-2 rounded text-center">
                  <p className="text-[10px] text-gray-400">
                    Process handles MPPS automatically after MWL selection.
                  </p>
                </div>

                {selectedStudy && (
                  <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
                    <h3 className="text-[10px] font-bold text-cyan-400 uppercase mb-2">Active Context</h3>
                    <div className="space-y-1.5">
                      <div className="text-[10px] text-gray-300 flex justify-between">
                        <span className="text-gray-500">Patient:</span>
                        <span className="font-mono truncate ml-2">{selectedStudy.patientName}</span>
                      </div>
                      <div className="text-[10px] text-gray-300 flex justify-between">
                        <span className="text-gray-500">Accession:</span>
                        <span className="font-mono ml-2">{selectedStudy.accessionNumber}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {
        showSuccessModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-slate-800 border-2 border-green-500 rounded-lg p-8 max-w-sm w-full shadow-2xl transform transition-all animate-in fade-in zoom-in duration-300">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                  <Send className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Success!</h3>
                <p className="text-gray-300 mb-6">
                  Study for <span className="text-green-400 font-semibold">{selectedStudy?.patientName}</span> has been successfully sent to PACS.
                </p>
                <button
                  onClick={() => setShowSuccessModal(false)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div>
  );
}
