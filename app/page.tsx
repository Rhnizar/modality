"use client";

import React, { useState } from 'react';
import { Monitor, Activity, Send, Search } from 'lucide-react';

export default function RadiologyModalitySimulator() {
  const [consoleLog, setConsoleLog] = useState<{ timestamp: string; message: string; type: string }[]>([]);
  const [studyList, setStudyList] = useState<{ id: number; patientId: string; patientName: string; studyDescription: string; accessionNumber: string; modality: string; studyDate: string }[]>([]);
  const [selectedStudy, setSelectedStudy] = useState<{ id: number; patientId: string; patientName: string; studyDescription: string; accessionNumber: string; modality: string; studyDate: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);

  const addLog = (message: string, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setConsoleLog(prev => [...prev, { timestamp, message, type }]);
  };

  const handleQueryMWL = async () => {
    addLog('Connecting to MWL server...', 'info');
    setSelectedStudy(null);
    setProcessProgress(0);

    setTimeout(() => {
      const mockStudies = [
        {
          id: 1,
          patientId: 'PAT-' + Math.floor(Math.random() * 10000),
          patientName: 'DOE^JOHN',
          studyDescription: 'CHEST X-RAY PA/LAT',
          accessionNumber: 'ACC' + Math.floor(Math.random() * 100000),
          modality: 'CR',
          studyDate: new Date().toISOString().split('T')[0]
        },
        {
          id: 2,
          patientId: 'PAT-' + Math.floor(Math.random() * 10000),
          patientName: 'SMITH^JANE',
          studyDescription: 'ABDOMEN 2 VIEWS',
          accessionNumber: 'ACC' + Math.floor(Math.random() * 100000),
          modality: 'DR',
          studyDate: new Date().toISOString().split('T')[0]
        },
        {
          id: 3,
          patientId: 'PAT-' + Math.floor(Math.random() * 10000),
          patientName: 'JOHNSON^ROBERT',
          studyDescription: 'PELVIS AP',
          accessionNumber: 'ACC' + Math.floor(Math.random() * 100000),
          modality: 'CR',
          studyDate: new Date().toISOString().split('T')[0]
        }
      ];

      setStudyList(mockStudies);
      addLog('MWL Query successful', 'success');
      addLog(`Retrieved ${mockStudies.length} studies from worklist`, 'info');
      addLog('Please select a study from the table above', 'info');
    }, 1000);
  };

  const handleStudySelect = (study: any) => {
    setSelectedStudy(study);
    setProcessProgress(0);
    addLog(`Selected study: ${study.studyDescription} for ${study.patientName}`, 'success');
    addLog(`Patient ID: ${study.patientId} | Accession: ${study.accessionNumber}`, 'info');
  };

  const handleProcess = async () => {
    if (!selectedStudy) {
      addLog('Error: No study selected. Please select a study first.', 'error');
      return;
    }

    setIsProcessing(true);
    setProcessProgress(0);
    addLog('Starting image acquisition...', 'info');
    addLog(`Processing ${selectedStudy.studyDescription}...`, 'info');

    const interval = setInterval(() => {
      setProcessProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsProcessing(false);
          addLog('Image acquisition complete', 'success');
          addLog('Image processing complete', 'success');
          addLog(`Study Instance UID: 1.2.840.${Date.now()}`, 'info');
          addLog(`Generated 2 DICOM images for ${selectedStudy.patientName}`, 'success');
          return 100;
        }
        return prev + 10;
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

    addLog('Initiating DICOM C-STORE to PACS...', 'info');
    addLog(`Destination: PACS_SERVER (AET: PACS_AE)`, 'info');
    addLog(`Patient: ${selectedStudy.patientName} | Accession: ${selectedStudy.accessionNumber}`, 'info');

    setTimeout(() => {
      addLog('Sending DICOM objects...', 'info');
    }, 500);

    setTimeout(() => {
      addLog('Image 1/2 transferred successfully', 'success');
    }, 1000);

    setTimeout(() => {
      addLog('Image 2/2 transferred successfully', 'success');
      addLog('PACS confirmation received', 'success');
      addLog('Study archived successfully', 'success');
      addLog(`Accession #${selectedStudy.accessionNumber} - Status: COMPLETED`, 'success');
    }, 1500);
  };

  const clearConsole = () => {
    setConsoleLog([]);
    setStudyList([]);
    setSelectedStudy(null);
    setProcessProgress(0);
    addLog('Console cleared. System ready.', 'info');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-7xl mx-auto">
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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Control Panel */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800 border-2 border-slate-600 rounded-lg p-6 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                Control Panel
              </h2>

              <div className="space-y-4">
                <button
                  onClick={handleQueryMWL}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Search className="w-5 h-5" />
                  Query from MWL
                </button>

                <button
                  onClick={handleProcess}
                  disabled={!selectedStudy || isProcessing}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Activity className="w-5 h-5" />
                  Process
                </button>

                <button
                  onClick={handleSendToPACS}
                  disabled={!selectedStudy || processProgress < 100}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Send className="w-5 h-5" />
                  Send Result to PACS
                </button>

                <button
                  onClick={clearConsole}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
                >
                  Clear Console
                </button>
              </div>

              {/* Status Info */}
              {selectedStudy && (
                <div className="mt-6 bg-slate-700 rounded-lg p-4">
                  <h3 className="text-sm font-bold text-cyan-300 mb-2">Current Study</h3>
                  <div className="text-xs text-gray-300 space-y-1">
                    <div className="truncate"><span className="text-gray-400">Patient:</span> {selectedStudy.patientName}</div>
                    <div className="truncate"><span className="text-gray-400">Study:</span> {selectedStudy.studyDescription}</div>
                  </div>
                </div>
              )}

              {/* Processing Progress */}
              {isProcessing && (
                <div className="mt-4">
                  <div className="flex justify-between text-sm text-gray-300 mb-2">
                    <span>Processing...</span>
                    <span>{processProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${processProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {processProgress === 100 && !isProcessing && (
                <div className="mt-4 bg-green-900/30 border border-green-500 rounded-lg p-3 text-center">
                  <div className="text-green-400 text-sm font-semibold">Ready to Send</div>
                </div>
              )}
            </div>
          </div>

          {/* Console - Takes up remaining space */}
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
              <div className="bg-gray-900 rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm">
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
        </div>
      </div>
    </div>
  );
}
