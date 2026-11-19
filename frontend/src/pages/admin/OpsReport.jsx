import React from 'react';
import { useParams } from 'react-router-dom';
import ReportView from './accounting/ReportView';

// Reads the report id from the URL and hands it to the shared ReportView.
// Keyed on the id so moving between reports starts each one fresh.
const OpsReport = () => {
  const { reportId } = useParams();
  const title = reportId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return <ReportView key={reportId} reportId={reportId} title={title} />;
};

export default OpsReport;
