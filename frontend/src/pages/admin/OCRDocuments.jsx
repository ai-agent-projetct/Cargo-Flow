import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, Trash2, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { ocrDocumentsAPI } from '../../services/api';
import { PageLoader } from '../../common/LoadingSpinner';
import toast from 'react-hot-toast';

const mockDocs = [
  {
    id: 1,
    fileName: 'BL-MSCU1234567.pdf',
    shipmentRef: 'HS-2026-00010',
    charge: 2.5,
    ocrPayload: {
      detectedFields: {
        documentType: 'Bill of Lading',
        shipper: 'Acme Logistics Pte Ltd',
        consignee: 'KL Imports Sdn Bhd',
        portOfLoading: 'Jebel Ali, AE',
        portOfDischarge: 'Singapore, SG',
      },
      confidence: 0.92,
    },
    createdAt: '2026-06-10T10:00:00Z',
  },
];

const OCRDocuments = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [shipmentRef, setShipmentRef] = useState('');
  const fileRef = useRef(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ocrDocumentsAPI.getAll();
      setRecords(res.data?.data || []);
    } catch {
      setRecords(mockDocs);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error('Please select a file to upload');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (shipmentRef) formData.append('shipmentRef', shipmentRef);
      const res = await ocrDocumentsAPI.upload(formData);
      const created = res.data?.data;
      setRecords((prev) => [created, ...prev]);
      toast.success('Document uploaded and processed via OCR');
      fileRef.current.value = '';
      setShipmentRef('');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await ocrDocumentsAPI.delete(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
      toast.success('Document deleted');
    } catch {
      toast.error('Failed to delete document');
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">OCR Document</h1>
      </div>

      {/* Upload */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="font-bold text-gray-900">Upload Document for OCR Processing</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Shipment Reference (optional)</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={shipmentRef}
              onChange={(e) => setShipmentRef(e.target.value)}
              placeholder="e.g. HS-2026-00010"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">File</label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
          >
            <Upload className="w-4 h-4" /> {uploading ? 'Processing...' : 'Upload & Process'}
          </button>
        </div>
        <p className="text-xs text-gray-400">Supported formats: PDF, JPG, PNG. The system will run OCR and extract shipment fields automatically.</p>
      </div>

      {/* List */}
      {loading ? <PageLoader /> : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['File', 'Shipment Ref', 'Charge', 'Confidence', 'Uploaded', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600 text-xs whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-400">No OCR documents found</td></tr>
                ) : records.map((rec) => (
                  <React.Fragment key={rec.id}>
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setExpanded(expanded === rec.id ? null : rec.id)}
                          className="flex items-center gap-2 text-gray-700 font-medium text-xs"
                        >
                          <FileText className="w-4 h-4 text-blue-600" />
                          {rec.fileName}
                          {expanded === rec.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{rec.shipmentRef || '-'}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{rec.charge ? `$${rec.charge}` : '-'}</td>
                      <td className="px-4 py-3 text-xs">
                        {rec.ocrPayload?.confidence ? (
                          <span className="bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">
                            {Math.round(rec.ocrPayload.confidence * 100)}%
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{rec.createdAt ? new Date(rec.createdAt).toLocaleString() : '-'}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDelete(rec.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                    {expanded === rec.id && (
                      <tr>
                        <td colSpan={6} className="px-4 py-3 bg-gray-50">
                          <div className="text-xs text-gray-700 space-y-1">
                            <p className="font-semibold text-gray-900 mb-2">Extracted Fields</p>
                            {rec.ocrPayload?.detectedFields ? (
                              Object.entries(rec.ocrPayload.detectedFields).map(([k, v]) => (
                                <div key={k} className="flex gap-2">
                                  <span className="font-medium text-gray-500 w-40 capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                                  <span>{String(v)}</span>
                                </div>
                              ))
                            ) : (
                              <p className="text-gray-400">No extracted data available</p>
                            )}
                            {rec.errorMessage && (
                              <p className="text-red-600 mt-2">Error: {rec.errorMessage}</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default OCRDocuments;
