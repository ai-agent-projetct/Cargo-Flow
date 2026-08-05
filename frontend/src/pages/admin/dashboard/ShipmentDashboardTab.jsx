import React, { useEffect, useState } from 'react';
import { dashboardAPI } from '../../../services/api';
import { PageLoader } from '../../../common/LoadingSpinner';
import DashboardLayout, { StatCard, DataTableWidget } from './DashboardLayout';

const labelCountCols = (labelHeader = 'Label') => [
  { key: 'label', label: labelHeader },
  { key: 'count', label: 'Count', align: 'right' },
];

const ShipmentDashboardTab = ({ activeTab, onTabChange }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await dashboardAPI.getShipmentDashboard();
      setData(res.data.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return <PageLoader />;

  const d = data || {};
  const p = d.profitability || {};
  const fmtMoney = (v) => `${(parseFloat(v) || 0).toFixed(1)} AED`;

  return (
    <DashboardLayout
      activeTab={activeTab}
      onTabChange={onTabChange}
      subtitle="Shipments"
      onRefresh={fetchData}
      showFullToolbar
      showSearch
      search={search}
      onSearchChange={setSearch}
    >
      {/* Top stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Shipments" value={d.totalShipments ?? 0} />
        <StatCard label="Total TEU" value={d.totalTEU ?? 0} />
        <StatCard label="No of Carriers" value={d.noOfCarriers ?? 0} />
        <StatCard label="Total Volume in m³" value={d.totalVolume ?? 0} />
      </div>

      {/* Profitability section */}
      <h3 className="font-bold text-blue-700 text-sm">Shipment Profitability</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Revenue" value={fmtMoney(p.revenue)} />
        <StatCard label="Cost" value={fmtMoney(p.cost)} />
        <StatCard label="Margin" value={fmtMoney(p.margin)} />
        <StatCard label="Margin %" value={p.marginPct ?? 0} />
      </div>

      {/* Profitability by Customers - full width */}
      <DataTableWidget
        title="Profitability by Customers"
        columns={[
          { key: 'customer', label: 'Customer' },
          { key: 'shipments', label: 'Shipments', align: 'right' },
        ]}
        rows={d.profitabilityByCustomers}
      />

      {/* Row A */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DataTableWidget title="Shipments by Sales Agent" columns={labelCountCols('Sales Agent')} rows={d.shipmentsBySalesAgent} />
        <DataTableWidget title="Shipments by Trade-lanes" columns={labelCountCols('Trade-lane')} rows={d.shipmentsByTradeLanes} />
        <DataTableWidget title="Shipment By Companies" columns={labelCountCols('Company')} rows={d.shipmentsByCompanies} />
      </div>

      {/* Row B */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DataTableWidget title="Number of Shipment by Status" columns={labelCountCols('Status')} rows={d.shipmentsByStatus} />
        <DataTableWidget title="Shipments by Origin Country" columns={labelCountCols('Country')} rows={d.shipmentsByOriginCountry} />
        <DataTableWidget title="Shipments by Destination Country" columns={labelCountCols('Country')} rows={d.shipmentsByDestinationCountry} />
      </div>

      {/* Row C */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DataTableWidget title="Shipments by POL" columns={labelCountCols('Port of Loading')} rows={d.shipmentsByPOL} />
        <DataTableWidget title="Shipments by POD" columns={labelCountCols('Port of Discharge')} rows={d.shipmentsByPOD} />
      </div>

      {/* Row D */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DataTableWidget title="Shipments by AOL" columns={labelCountCols('Airport of Loading')} rows={d.shipmentsByAOL} />
        <DataTableWidget title="Shipments by AOD" columns={labelCountCols('Airport of Discharge')} rows={d.shipmentsByAOD} />
      </div>

      {/* Row E */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DataTableWidget title="Shipment Type" columns={labelCountCols('Type')} rows={d.shipmentType} />
        <DataTableWidget title="Transport Mode" columns={labelCountCols('Mode')} rows={d.transportMode} />
        <DataTableWidget title="Cargo Type" columns={labelCountCols('Cargo Type')} rows={d.cargoType} />
      </div>

      {/* Row F */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DataTableWidget
          title="Sea Shipment"
          columns={[{ key: 'label', label: 'Mode' }, { key: 'count', label: 'Count', align: 'right' }]}
          rows={d.seaShipment ? [{ label: 'SEA', count: d.seaShipment.count }] : []}
        />
        <DataTableWidget
          title="Air Shipment"
          columns={[{ key: 'label', label: 'Mode' }, { key: 'count', label: 'Count', align: 'right' }]}
          rows={d.airShipment ? [{ label: 'AIR', count: d.airShipment.count }] : []}
        />
        <DataTableWidget
          title="Road Shipment"
          columns={[{ key: 'label', label: 'Mode' }, { key: 'count', label: 'Count', align: 'right' }]}
          rows={d.roadShipment ? [{ label: 'ROAD', count: d.roadShipment.count }] : []}
        />
      </div>
    </DashboardLayout>
  );
};

export default ShipmentDashboardTab;
