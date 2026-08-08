// The 51 TMS requests from the demo. Every row is status=success with
// providerStatus "Resource created successfully" and an empty message type —
// that is genuinely how the demo data looks.
// [shipmentId, requestDate, requestedBy]
const ROWS = [
  ['ROA-E-FTL-H-N-2025-00899', '2025-09-17 19:06:27', 'Bisham Dev'],
  ['ROA-E-FTL-H-N-2025-00899', '2025-09-17 19:04:50', 'Helly (Tech Support)'],
  ['ROA-I-FTL-H-N-2025-00896', '2025-09-16 15:52:43', 'Helly (Tech Support)'],
  ['ROA-I-FTL-H-N-2025-00896', '2025-09-16 15:52:26', 'Helly (Tech Support)'],
  ['TP001', '2025-05-12 15:29:10', 'Administrator'],
  ['TP001', '2025-05-06 18:39:28', 'Administrator'],
  ['ROA-E-FTL-H-N-2025-01075', '2025-05-06 18:37:48', 'Administrator'],
  ['ROA-E-FTL-H-N-2025-01074', '2025-05-06 18:36:10', 'Administrator'],
  ['ROA-I-FTL-H-N-2025-01073', '2025-05-06 16:50:41', 'Administrator'],
  ['HBL6556', '2025-05-06 16:49:26', 'Administrator'],
  ['ROA-I-FTL-H-N-2025-01071', '2025-05-06 14:43:25', 'Nitin (Tech Support)'],
  ['ROA-I-FTL-H-N-2025-01069', '2025-05-06 14:31:33', 'Administrator'],
  ['ROA-I-FTL-H-N-2025-01071', '2025-05-06 12:16:34', 'Nitin (Tech Support)'],
  ['ROA-I-FTL-H-N-2025-01069', '2025-05-06 10:55:15', 'Administrator'],
  ['HLR0105', '2025-05-01 18:14:20', 'System'],
  ['HLR12321', '2025-05-01 18:09:59', 'System'],
  ['HouseLR105', '2025-05-01 17:18:25', 'System'],
  ['ROA-E-FTL-H-N-2025-01046', '2025-05-01 15:06:16', 'Helly (Tech Support)'],
  ['HLR105', '2025-05-01 14:41:38', 'System'],
  ['HLR105', '2025-05-01 14:34:40', 'Administrator'],
  ['HLR105', '2025-05-01 14:30:43', 'Administrator'],
  ['HLR105', '2025-05-01 12:51:13', 'Administrator'],
  ['HLR105', '2025-05-01 12:25:22', 'Administrator'],
  ['HLR105', '2025-05-01 12:25:17', 'Administrator'],
  ['HLR105', '2025-05-01 12:24:33', 'Administrator'],
  ['HLR105', '2025-05-01 12:21:23', 'Administrator'],
  ['HLR105', '2025-05-01 12:20:53', 'Administrator'],
  ['HLR105', '2025-05-01 12:20:46', 'Administrator'],
  ['HLR105', '2025-05-01 12:20:23', 'Administrator'],
  ['HLR105', '2025-05-01 12:20:15', 'Administrator'],
  ['ROA-E-FTL-H-N-2025-01046', '2025-05-01 11:14:12', 'Helly (Tech Support)'],
  ['HLR12321', '2025-05-01 11:13:18', 'Helly (Tech Support)'],
  ['HLR12321', '2025-05-01 11:12:43', 'Helly (Tech Support)'],
  ['HLR12321', '2025-05-01 11:05:56', 'System'],
  ['ROA-E-FTL-H-N-2025-00709', '2025-03-11 12:44:45', 'Sujit (Tech Support)'],
  ['ROA-E-FTL-H-N-2025-00709', '2025-02-12 12:31:50', 'Administrator'],
  ['ROA-E-FTL-H-N-2025-00684', '2025-02-04 11:33:13', 'Administrator'],
  ['ROA-E-FTL-H-N-2025-00681', '2025-02-04 10:47:26', 'Gaurav Lashkari'],
  ['ROA-E-FTL-H-N-2025-00627', '2025-01-21 14:38:06', 'Administrator'],
  ['ROA-E-FTL-H-N-2025-00623', '2025-01-20 12:31:19', 'System'],
  ['ROA-E-FTL-H-N-2025-00623', '2025-01-20 12:29:51', 'System'],
  ['ROA-E-FTL-H-N-2025-00592', '2025-01-20 12:22:12', 'Administrator'],
  ['ROA-E-FTL-H-N-2025-00623', '2025-01-20 12:19:33', 'Administrator'],
  ['ROA-E-FTL-H-N-2025-00623', '2025-01-20 12:19:17', 'Administrator'],
  ['ROA-E-FTL-H-N-2025-00623', '2025-01-20 12:13:44', 'Administrator'],
  ['ROA-E-FTL-H-N-2025-00623', '2025-01-20 12:12:32', 'Administrator'],
  ['ROA-E-FTL-H-N-2025-00592', '2025-01-16 15:30:25', 'Administrator'],
  ['ROA-E-FTL-H-N-2025-00591', '2025-01-16 15:19:25', 'Administrator'],
  ['ROA-E-FTL-H-N-2025-00591', '2025-01-16 15:19:13', 'Administrator'],
  ['ROA-E-BBK-H-N-2025-00590', '2025-01-16 15:17:45', 'Administrator'],
  ['ROA-E-FTL-H-N-2025-00589', '2025-01-16 15:16:44', 'System'],
];

// The payload the provider was sent, and what came back. The demo stores these
// as JSON blobs behind an ace editor; reconstruct a faithful shape.
const payloadFor = (shipmentId, at) => JSON.stringify({
  shipmentId,
  messageType: 'CREATE_RESOURCE',
  requestedAt: at,
  transport: { mode: 'ROAD', loadType: shipmentId.includes('-FTL-') ? 'FTL' : 'LTL' },
  parties: { shipper: null, consignee: null },
  stops: [],
}, null, 2);

const responseFor = (uuid) => JSON.stringify({
  status: 'success',
  message: 'Resource created successfully',
  resourceId: uuid,
  errors: [],
}, null, 2);

module.exports = { ROWS, payloadFor, responseFor };
