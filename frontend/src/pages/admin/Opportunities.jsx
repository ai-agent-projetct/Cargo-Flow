import React, { useState, useEffect } from 'react';
import { Plus, DollarSign, User, TrendingUp, MapPin } from 'lucide-react';
import { opportunitiesAPI, customersAPI } from '../../services/api';
import toast from 'react-hot-toast';

const TRANSPORT_MODES = ['SEA', 'AIR', 'ROAD', 'RAIL', 'MULTIMODAL'];
const DIRECTIONS = ['EXPORT', 'IMPORT', 'LOCAL'];
const PRIORITIES = ['low', 'normal', 'high'];

const STAGES = [
  { key: 'new', label: 'New', color: 'bg-gray-100 border-gray-300' },
  { key: 'qualified', label: 'Qualified', color: 'bg-blue-50 border-blue-300' },
  { key: 'proposition', label: 'Proposition', color: 'bg-indigo-50 border-indigo-300' },
  { key: 'negotiation', label: 'Negotiation', color: 'bg-yellow-50 border-yellow-300' },
  { key: 'won', label: 'Won', color: 'bg-green-50 border-green-300' },
  { key: 'lost', label: 'Lost', color: 'bg-red-50 border-red-300' },
];

const mockOpportunities = [
  { id: 1, name: 'Acme Logistics Sdn Bhd - SEA Export', customer: { companyName: 'Acme Logistics Sdn Bhd' }, estimatedRevenue: 120000, probability: 75, assignee: { name: 'Ahmad Rizal' }, stage: 'negotiation', currency: 'MYR' },
  { id: 2, name: 'Pacific Trade Solutions - AIR Import', customer: { companyName: 'Pacific Trade Solutions' }, estimatedRevenue: 85000, probability: 50, assignee: { name: 'Lee Wei Ming' }, stage: 'proposition', currency: 'MYR' },
  { id: 3, name: 'KL Imports Sdn Bhd - FCL Shipment', customer: { companyName: 'KL Imports Sdn Bhd' }, estimatedRevenue: 45000, probability: 90, assignee: { name: 'Sarah Tan' }, stage: 'won', currency: 'MYR' },
  { id: 4, name: 'Penang Manufacturing Bhd - Bulk Cargo', customer: { companyName: 'Penang Manufacturing Bhd' }, estimatedRevenue: 200000, probability: 30, assignee: { name: 'Ahmad Rizal' }, stage: 'qualified', currency: 'MYR' },
  { id: 5, name: 'JB Freight Co - Road Transport', customer: { companyName: 'JB Freight Co' }, estimatedRevenue: 60000, probability: 10, assignee: { name: 'Lee Wei Ming' }, stage: 'new', currency: 'MYR' },
  { id: 6, name: 'Eastern Maritime - LCL Export', customer: { companyName: 'Eastern Maritime' }, estimatedRevenue: 30000, probability: 0, assignee: { name: 'Sarah Tan' }, stage: 'lost', currency: 'MYR' },
];

const OpportunityCard = ({ opp, onStageChange }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow mb-3">
    <div className="flex items-start justify-between mb-2">
      <h4 className="font-semibold text-gray-900 text-sm leading-tight">{opp.name || opp.customer?.companyName || '-'}</h4>
    </div>
    <div className="space-y-1.5 text-xs text-gray-500">
      <div className="flex items-center gap-1.5">
        <DollarSign className="w-3 h-3" />
        <span className="font-semibold text-gray-700">
          {Number(opp.estimatedRevenue || 0).toLocaleString('en-MY')} {opp.currency || 'MYR'}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <TrendingUp className="w-3 h-3" />
        <span>{opp.probability}% probability</span>
      </div>
      <div className="flex items-center gap-1.5">
        <User className="w-3 h-3" />
        <span>{opp.assignee?.name || '-'}</span>
      </div>
      {(opp.origin || opp.destination) && (
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3 h-3" />
          <span>{opp.origin || '-'} → {opp.destination || '-'}</span>
        </div>
      )}
      {opp.transportMode && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{opp.transportMode}</span>
          <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{opp.direction}</span>
        </div>
      )}
    </div>
    <div className="mt-3">
      <select
        value={opp.stage}
        onChange={(e) => onStageChange(opp.id, e.target.value)}
        className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white text-gray-600"
        onClick={(e) => e.stopPropagation()}
      >
        {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
      </select>
    </div>
  </div>
);

const AdminOpportunities = () => {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [newOpp, setNewOpp] = useState({
    name: '', customerId: '', estimatedRevenue: '', probability: 50, stage: 'new', currency: 'MYR',
    transportMode: 'SEA', direction: 'EXPORT', origin: '', destination: '', expectedCloseDate: '', priority: 'normal',
  });

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        // The kanban renders every stage at once, so fetch the whole pipeline
        // rather than just the default first page.
        const res = await opportunitiesAPI.getAll({ limit: 200 });
        setOpportunities(res.data?.data || []);
      } catch {
        setOpportunities(mockOpportunities);
      } finally {
        setLoading(false);
      }
    };
    fetch();
    customersAPI.getAll({ limit: 200 }).then((res) => setCustomers(res.data?.data || [])).catch(() => {});
  }, []);

  const handleStageChange = async (id, stage) => {
    try {
      await opportunitiesAPI.updateStage(id, stage);
    } catch {
      // demo mode
    }
    setOpportunities((prev) => prev.map((o) => o.id === id ? { ...o, stage } : o));
  };

  const handleCreate = async () => {
    if (!newOpp.name) return;
    try {
      const res = await opportunitiesAPI.create({ ...newOpp, estimatedRevenue: parseFloat(newOpp.estimatedRevenue) || 0 });
      setOpportunities((prev) => [...prev, res.data.data]);
    } catch {
      setOpportunities((prev) => [...prev, { ...newOpp, id: Date.now(), estimatedRevenue: parseFloat(newOpp.estimatedRevenue) || 0 }]);
    }
    setNewOpp({
      name: '', customerId: '', estimatedRevenue: '', probability: 50, stage: 'new', currency: 'MYR',
      transportMode: 'SEA', direction: 'EXPORT', origin: '', destination: '', expectedCloseDate: '', priority: 'normal',
    });
    setShowCreate(false);
    toast.success('Opportunity created!');
  };

  const oppsByStage = (stage) => opportunities.filter((o) => o.stage === stage);

  if (loading) return (
    <div className="p-6 flex justify-center">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Opportunities</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Create Opportunity
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="font-bold text-gray-900 text-lg mb-4">New Opportunity</h2>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {[
                { label: 'Opportunity Name *', key: 'name', type: 'text', placeholder: 'e.g. Acme Corp - SEA Export' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                  <input
                    type={type}
                    value={newOpp[key]}
                    onChange={(e) => setNewOpp((n) => ({ ...n, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Customer</label>
                <select
                  value={newOpp.customerId}
                  onChange={(e) => setNewOpp((n) => ({ ...n, customerId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Select customer</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.companyName || c.contactName}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Transport Mode</label>
                  <select
                    value={newOpp.transportMode}
                    onChange={(e) => setNewOpp((n) => ({ ...n, transportMode: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {TRANSPORT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Direction</label>
                  <select
                    value={newOpp.direction}
                    onChange={(e) => setNewOpp((n) => ({ ...n, direction: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {DIRECTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Origin</label>
                  <input
                    type="text"
                    value={newOpp.origin}
                    onChange={(e) => setNewOpp((n) => ({ ...n, origin: e.target.value }))}
                    placeholder="e.g. Shanghai, CN"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Destination</label>
                  <input
                    type="text"
                    value={newOpp.destination}
                    onChange={(e) => setNewOpp((n) => ({ ...n, destination: e.target.value }))}
                    placeholder="e.g. Rotterdam, NL"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Estimated Revenue</label>
                  <input
                    type="number"
                    value={newOpp.estimatedRevenue}
                    onChange={(e) => setNewOpp((n) => ({ ...n, estimatedRevenue: e.target.value }))}
                    placeholder="0.00"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Probability (%)</label>
                  <input
                    type="number"
                    value={newOpp.probability}
                    onChange={(e) => setNewOpp((n) => ({ ...n, probability: e.target.value }))}
                    placeholder="50"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Expected Close Date</label>
                  <input
                    type="date"
                    value={newOpp.expectedCloseDate}
                    onChange={(e) => setNewOpp((n) => ({ ...n, expectedCloseDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Priority</label>
                  <select
                    value={newOpp.priority}
                    onChange={(e) => setNewOpp((n) => ({ ...n, priority: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Stage</label>
                <select
                  value={newOpp.stage}
                  onChange={(e) => setNewOpp((n) => ({ ...n, stage: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleCreate} className="flex-1 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-sm font-semibold">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Kanban board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const stagOpps = oppsByStage(stage.key);
          return (
            <div key={stage.key} className={`flex-shrink-0 w-64 rounded-xl border-2 ${stage.color} p-3`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-800 text-sm">{stage.label}</h3>
                <span className="bg-white text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full border border-gray-200">
                  {stagOpps.length}
                </span>
              </div>
              {stagOpps.length === 0 ? (
                <div className="text-center py-6 text-gray-300 text-xs">No opportunities</div>
              ) : (
                stagOpps.map((opp) => (
                  <OpportunityCard key={opp.id} opp={opp} onStageChange={handleStageChange} />
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminOpportunities;
