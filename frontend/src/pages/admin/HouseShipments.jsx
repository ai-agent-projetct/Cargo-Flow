import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { ffJobsAPI } from '../../services/api';
import { getFFJobStatusColor } from '../../utils/helpers';
import { PageLoader } from '../../common/LoadingSpinner';
import { STATUS_FLOW, STATUS_LABELS } from './houseShipment/constants';

const GROUP_ORDER = [...STATUS_FLOW, 'cancelled'];

// Derive transportMode / direction / cargoType from a SeaRates-style job number
// e.g. SEA-E-FCL-H-N-2026-01851 -> { transportMode: 'SEA', direction: 'EXPORT', cargoType: 'FCL' }
const parseJobNumber = (jobNumber) => {
  const parts = jobNumber.split('-');
  const modeMap = { SEA: 'SEA', AIR: 'AIR', ROA: 'ROAD', RAI: 'RAIL' };
  const dirMap = { E: 'EXPORT', I: 'IMPORT', L: 'LOCAL' };
  const cargoMap = { BLK: 'BULK' };
  const transportMode = modeMap[parts[0]] || parts[0];
  const direction = dirMap[parts[1]] || parts[1];
  const cargoType = cargoMap[parts[2]] || parts[2];
  return { transportMode, direction, cargoType };
};

// Real House Shipment records sourced from the SeaRates Tech demo export, grouped by status
const RAW_JOBS = [
  // Created
  { jobNumber: 'SEA-E-FCL-H-N-2026-01851', hblNumber: '', status: 'created', origin: 'Ubungo', destination: 'Escàs', customer: 'Atharva', shipper: 'accounts-us@ila-global.net', consignee: 'admin-us@ila-global.net', revenue: { estReceivable: 110, actReceivable: 0, estPayable: 0, actPayable: 0, estMargin: 110, actMargin: 0 } },
  { jobNumber: 'SEA-E-FCL-H-N-2026-01850', hblNumber: '', status: 'created', origin: 'DUBAI (UAE)', destination: 'Argyrokastro', customer: 'admin-us@ila-global.net', shipper: 'admin-us@ila-global.net', consignee: 'admin-us@ila-global.net', revenue: { estReceivable: 0, actReceivable: 0, estPayable: 0, actPayable: 0, estMargin: 0, actMargin: 0 } },
  { jobNumber: 'SEA-E-FCL-H-N-2026-01848', hblNumber: 'HBLTest19-02', status: 'created', origin: 'Dubai', destination: 'Gandhinagar', customer: 'Ashish', shipper: 'ULTRA POMPE SRL', consignee: 'ROOFING ROLLING MILLS LTD', revenue: { estReceivable: 950, actReceivable: 0, estPayable: 1, actPayable: 0, estMargin: 949, actMargin: 0 } },
  { jobNumber: 'SEA-E-FCL-H-N-2026-01847', hblNumber: 'HBLTest19-01', status: 'created', origin: 'Dubai', destination: 'Gandhinagar', customer: 'ULTRA POMPE SRL', shipper: 'ULTRA POMPE SRL', consignee: 'ROOFING ROLLING MILLS LTD', revenue: { estReceivable: 1750, actReceivable: 0, estPayable: 1, actPayable: 0, estMargin: 1749, actMargin: 0 } },
  { jobNumber: 'SEA-E-FCL-H-N-2026-01845', hblNumber: '', status: 'created', origin: 'DUBAI (UAE)', destination: 'Nhava Sheva', customer: 'ULTRA POMPE SRL', shipper: 'ULTRA POMPE SRL', consignee: 'ROOFING ROLLING MILLS LTD', revenue: { estReceivable: 0, actReceivable: 0, estPayable: 1, actPayable: 1, estMargin: -1, actMargin: -1 } },
  { jobNumber: 'SEA-E-FCL-H-N-2026-01836', hblNumber: '', status: 'created', origin: 'DUBAI (UAE)', destination: 'Nhava Sheva', customer: 'ULTRA POMPE SRL', shipper: 'ULTRA POMPE SRL', consignee: 'ROOFING ROLLING MILLS LTD', revenue: { estReceivable: 0, actReceivable: 0, estPayable: 0, actPayable: 0, estMargin: 0, actMargin: 0 } },
  { jobNumber: 'SEA-E-BLK-H-N-2026-01835', hblNumber: '', status: 'created', origin: 'DUBAI (UAE)', destination: 'Afghanistan', customer: 'AMGAD', shipper: 'admin-us@ila-global.net', consignee: 'Aafaque', revenue: { estReceivable: 2, actReceivable: 0, estPayable: 0, actPayable: 0, estMargin: 2, actMargin: 0 } },
  { jobNumber: 'SEA-E-BLK-H-N-2026-01834', hblNumber: '', status: 'created', origin: 'DUBAI (UAE)', destination: 'Afghanistan', customer: 'AMGAD', shipper: '', consignee: '', revenue: { estReceivable: 0, actReceivable: 0, estPayable: 0, actPayable: 0, estMargin: 0, actMargin: 0 } },
  { jobNumber: 'SEA-E-LCL-H-N-2026-01831', hblNumber: 'HBL-ALS01', status: 'created', origin: 'DUBAI (UAE)', destination: 'QCHINA', customer: 'Aafaque', shipper: 'accounts-us@ila-global.net', consignee: 'admin-us@ila-global.net', revenue: { estReceivable: 906.5, actReceivable: 0, estPayable: 215.53, actPayable: 0, estMargin: 690.97, actMargin: 0 } },
  { jobNumber: 'SEA-E-FCL-H-N-2026-01830', hblNumber: 'DemoFolk01', status: 'created', origin: 'DUBAI (UAE)', destination: 'Gandhinagar', customer: '1_demo', shipper: '1_demo', consignee: '1_demo', revenue: { estReceivable: 1144, actReceivable: 100, estPayable: 1, actPayable: 1, estMargin: 1143, actMargin: 99 } },

  // Booked
  { jobNumber: 'SEA-E-FCL-H-N-2026-01846', hblNumber: 'HBL13Test', status: 'booked', origin: 'DUBAI (UAE)', destination: 'Nhava Sheva', customer: 'ULTRA POMPE SRL', shipper: 'Aafaque', consignee: 'ROOFING ROLLING MILLS LTD', revenue: { estReceivable: 5040, actReceivable: 0, estPayable: 0, actPayable: 0, estMargin: 5040, actMargin: 0 } },
  { jobNumber: 'SEA-E-LCL-H-N-2026-01844', hblNumber: 'HBL300126300', status: 'booked', origin: 'JEBEL ALI SEAPORT, U.A.E', destination: 'MUNDRA', customer: 'Aafaque', shipper: 'Ashish', consignee: 'Ashish', revenue: { estReceivable: 100, actReceivable: 0, estPayable: 0, actPayable: 0, estMargin: 100, actMargin: 0 } },
  { jobNumber: 'SEA-E-LCL-H-N-2026-01843', hblNumber: 'HBL300126200', status: 'booked', origin: 'JEBEL ALI SEAPORT, U.A.E', destination: 'MUNDRA', customer: 'Aafaque', shipper: 'Ashish', consignee: 'Ashish', revenue: { estReceivable: 0, actReceivable: 0, estPayable: 1, actPayable: 0, estMargin: -1, actMargin: 0 } },
  { jobNumber: 'SEA-E-LCL-H-N-2026-01839', hblNumber: 'HBL300120260002', status: 'booked', origin: 'JEBEL ALI SEAPORT, U.A.E', destination: 'MUNDRA', customer: 'Ashish', shipper: 'Aafaque', consignee: 'Aafaque', revenue: { estReceivable: 0, actReceivable: 0, estPayable: 0, actPayable: 0, estMargin: 0, actMargin: 0 } },
  { jobNumber: 'SEA-E-LCL-H-N-2026-01838', hblNumber: 'HBL300120260001', status: 'booked', origin: 'JEBEL ALI SEAPORT, U.A.E', destination: 'MUNDRA', customer: 'Ashish', shipper: 'Aafaque', consignee: 'Aafaque', revenue: { estReceivable: 0, actReceivable: 0, estPayable: 0, actPayable: 0, estMargin: 0, actMargin: 0 } },
  { jobNumber: 'AIR-E-LSE-H-N-2026-01833', hblNumber: 'Test2', status: 'booked', origin: 'Dubai', destination: 'Mumbai', customer: 'ULTRA POMPE SRL', shipper: 'ULTRA POMPE SRL', consignee: 'ROOFING ROLLING MILLS LTD', revenue: { estReceivable: 0, actReceivable: 0, estPayable: 23202.25, actPayable: -24205.28, estMargin: -23202.25, actMargin: 24205.28 } },
  { jobNumber: 'AIR-E-LSE-H-N-2026-01828', hblNumber: 'HAWB123', status: 'booked', origin: 'JEBEL ALI SEAPORT, U.A.E', destination: 'Nhava Sheva', customer: 'Ashish', shipper: 'Atharva', consignee: 'Amit', revenue: { estReceivable: 1100, actReceivable: 0, estPayable: 3050, actPayable: 2000, estMargin: -1950, actMargin: -2000 } },
  { jobNumber: 'SEA-E-FCL-H-N-2025-01797', hblNumber: 'HBL893658', status: 'booked', origin: 'DUBLIN', destination: 'Ariake, Tokyo', customer: 'Ashish', shipper: 'admin-us@ila-global.net', consignee: 'Atharva', revenue: { estReceivable: 3792, actReceivable: 3811, estPayable: 100, actPayable: 100, estMargin: 3692, actMargin: 3711 } },
  { jobNumber: 'AIR-I-LSE-H-N-2025-01782', hblNumber: 'RTY678', status: 'booked', origin: 'Abulug', destination: 'JEBEL ALI SEAPORT, U.A.E', customer: 'Ashish', shipper: 'Atharva', consignee: 'Ashish', revenue: { estReceivable: 0, actReceivable: 0, estPayable: 0, actPayable: 0, estMargin: 0, actMargin: 0 } },
  { jobNumber: 'SEA-E-FCL-H-N-2025-01745', hblNumber: 'THBL1', status: 'booked', origin: 'DUBAI (UAE)', destination: 'Gandhinagar', customer: 'accounts-us@ila-global.net', shipper: 'Aafaque', consignee: 'ROOFING ROLLING MILLS LTD', revenue: { estReceivable: 3050, actReceivable: 1000, estPayable: 0, actPayable: 0, estMargin: 3050, actMargin: 1000 } },

  // Received
  { jobNumber: 'SEA-E-LCL-H-N-2026-01842', hblNumber: 'HBL300126100', status: 'received', origin: 'JEBEL ALI SEAPORT, U.A.E', destination: 'MUNDRA', customer: 'Aafaque', shipper: 'Ashish', consignee: 'Ashish', revenue: { estReceivable: 0, actReceivable: 0, estPayable: 0, actPayable: 0, estMargin: 0, actMargin: 0 } },
  { jobNumber: 'SEA-E-LCL-H-N-2026-01840', hblNumber: 'HBL3001230001', status: 'received', origin: 'JEBEL ALI SEAPORT, U.A.E', destination: 'MUNDRA', customer: 'Aafaque', shipper: 'Ashish', consignee: 'Ashish', revenue: { estReceivable: 0, actReceivable: 0, estPayable: 0, actPayable: 0, estMargin: 0, actMargin: 0 } },
  { jobNumber: 'SEA-E-LCL-H-N-2026-01837', hblNumber: 'HBL30012026', status: 'received', origin: 'JEBEL ALI SEAPORT, U.A.E', destination: 'MUNDRA', customer: 'Aafaque', shipper: 'Ashish', consignee: 'Ashish', revenue: { estReceivable: 0, actReceivable: 0, estPayable: 0, actPayable: 0, estMargin: 0, actMargin: 0 } },
  { jobNumber: 'SEA-E-FCL-H-N-2026-01813', hblNumber: '9965748', status: 'received', origin: 'DUBAI (UAE)', destination: 'GURGAON, INDIA', customer: 'Ashish', shipper: 'Ashish', consignee: 'Ashish', revenue: { estReceivable: 0, actReceivable: 0, estPayable: 50, actPayable: 0, estMargin: -50, actMargin: 0 } },
  { jobNumber: 'SEA-E-FCL-H-N-2026-01801', hblNumber: 'HBL2001FL', status: 'received', origin: 'DUBAI (UAE)', destination: 'Gandhinagar', customer: 'A I L SHIPPING SERVICES LLC', shipper: 'A I L SHIPPING SERVICES LLC', consignee: 'Aravaind LLC', revenue: { estReceivable: 0, actReceivable: 0, estPayable: 0, actPayable: 0, estMargin: 0, actMargin: 0 } },
  { jobNumber: 'SEA-E-FCL-H-N-2025-01775', hblNumber: 'HBL-Test-12', status: 'received', origin: 'Dubai', destination: 'Brooklyn', customer: 'Atharva', shipper: 'Ashish', consignee: 'Aafaque', revenue: { estReceivable: 2368, actReceivable: 2368, estPayable: 1300, actPayable: 1300, estMargin: 1068, actMargin: 1068 } },
  { jobNumber: 'SEA-E-FCL-H-N-2025-01629', hblNumber: 'HBLTest2', status: 'received', origin: 'Dubai', destination: 'Nhava Sheva', customer: 'Ajay Kukadiya', shipper: 'Aafaque', consignee: 'Ashish', revenue: { estReceivable: 14398, actReceivable: 14398, estPayable: 7851, actPayable: 7350, estMargin: 6547, actMargin: 7048 } },
  { jobNumber: 'AIR-I-CR-H-N-2025-01626', hblNumber: '1765874587', status: 'received', origin: 'Poti', destination: 'Dubai', customer: 'Ashish', shipper: 'Ashish', consignee: 'Aafaque', revenue: { estReceivable: 0, actReceivable: 0, estPayable: 14165, actPayable: 14165, estMargin: -14165, actMargin: -14165 } },
  { jobNumber: 'SEA-E-FCL-H-N-2025-01599', hblNumber: 'HBLDubaiTest', status: 'received', origin: 'Dubai', destination: 'Nhava Sheva', customer: 'Ajay Kukadiya', shipper: 'Atharva', consignee: 'Ashish', revenue: { estReceivable: 0, actReceivable: 0, estPayable: 0, actPayable: 0, estMargin: 0, actMargin: 0 } },
  { jobNumber: 'SEA-E-FCL-H-N-2025-01585', hblNumber: 'HBLOct07', status: 'received', origin: 'Dubai', destination: 'Abbot Point', customer: 'Ashish', shipper: 'accounts-us@ila-global.net', consignee: 'ABC CHILE, Alex', revenue: { estReceivable: 1100, actReceivable: 1100, estPayable: 50, actPayable: 50, estMargin: 1050, actMargin: 1050 } },

  // Confirmed
  { jobNumber: 'SEA-E-FCL-H-N-2026-01825', hblNumber: 'HBL001', status: 'confirmed', origin: 'AbuDubai', destination: 'Abha', customer: 'logistics one', shipper: 'logistics one', consignee: 'Atharva', revenue: { estReceivable: 1253, actReceivable: 250, estPayable: 900, actPayable: 300, estMargin: 353, actMargin: -50 } },
  { jobNumber: 'SEA-I-LCL-H-N-2025-01704', hblNumber: 'HBL portal test', status: 'confirmed', origin: 'Gandhinagar', destination: 'DUBAI (UAE)', customer: 'Customer Portal Access', shipper: 'Ashish', consignee: 'AMGAD', revenue: { estReceivable: 4785, actReceivable: 4785, estPayable: 2211, actPayable: 0, estMargin: 2574, actMargin: 4785 } },
  { jobNumber: 'AIR-I-PLT-H-N-2025-01509', hblNumber: '435257128', status: 'confirmed', origin: 'Nhava Sheva', destination: 'DUBAI-dxb', customer: 'Customer Portal Access', shipper: 'Praveen Ji', consignee: 'Ashish', revenue: { estReceivable: 851, actReceivable: 451, estPayable: 2100, actPayable: 0, estMargin: -1249, actMargin: 451 } },
  { jobNumber: 'SEA-E-FCL-H-N-2025-01429', hblNumber: 'MK343232', status: 'confirmed', origin: 'Dubai', destination: 'lllMariehamn (Maarianhamina)', customer: 'Customer Portal Access', shipper: 'Customer Portal Access', consignee: 'Aafaque', revenue: { estReceivable: 1, actReceivable: 1, estPayable: 1, actPayable: 0, estMargin: 0, actMargin: 1 } },
  { jobNumber: 'SEA-E-LCL-H-N-2025-01393', hblNumber: 'test01393', status: 'confirmed', origin: 'Gandhinagar', destination: 'Dubai', customer: 'Customer Portal Access', shipper: 'Ashish', consignee: 'Aafaque', revenue: { estReceivable: 0, actReceivable: 0, estPayable: 0, actPayable: 0, estMargin: 0, actMargin: 0 } },
  { jobNumber: 'AIR-E-CR-H-N-2025-01345', hblNumber: 'HAWB100', status: 'confirmed', origin: 'DUBAI (UAE)', destination: 'Buenos Aires', customer: 'Customer Portal Access', shipper: 'Aafaque', consignee: 'Atharva', revenue: { estReceivable: 12100, actReceivable: 12100, estPayable: 100, actPayable: 100, estMargin: 12000, actMargin: 12000 } },
  { jobNumber: 'SEA-I-FCL-H-N-2025-01285', hblNumber: 'direct', status: 'confirmed', origin: 'Afghanistan', destination: 'DUBAI (UAE)', customer: 'Customer Portal Access', shipper: 'AMGAD, Delivery Address', consignee: 'accounts-us@ila-global.net', revenue: { estReceivable: 0, actReceivable: 0, estPayable: 0, actPayable: 0, estMargin: 0, actMargin: 0 } },
  { jobNumber: 'AIR-I-LSE-H-N-2025-01260', hblNumber: '12345675', status: 'confirmed', origin: 'Charleroi', destination: 'Lubumbashi', customer: 'Connex Test Company', shipper: 'Louis Fauchet', consignee: 'Louis Fauchet', revenue: { estReceivable: 0, actReceivable: 0, estPayable: 0, actPayable: 0, estMargin: 0, actMargin: 0 } },
  { jobNumber: 'SEA-I-FCL-H-N-2025-01165', hblNumber: 'HBL0506', status: 'confirmed', origin: 'Afghanistan', destination: 'Boston', customer: 'Rishirajsinh Rana', shipper: 'Customer Portal Access', consignee: 'Trupti Vyas', revenue: { estReceivable: 0, actReceivable: 0, estPayable: 0, actPayable: 0, estMargin: 0, actMargin: 0 } },
  { jobNumber: 'SEA-E-FCL-H-N-2025-01035', hblNumber: 'HBLRVD101', status: 'confirmed', origin: 'DUBAI (UAE)', destination: 'Gandhinagar', customer: 'Kera LLC', shipper: 'Kera LLC', consignee: 'Atharva', revenue: { estReceivable: 300, actReceivable: 0, estPayable: 120, actPayable: 0, estMargin: 180, actMargin: 0 } },

  // Nomination Generated
  { jobNumber: 'SEA-I-FCL-H-N-2025-00676', hblNumber: 'HBL1234', status: 'nomination_generated', origin: 'Gandhinagar', destination: 'DUBAI (UAE)', customer: 'Demo Dubai team', shipper: 'Customer Portal Access', consignee: 'Ashish', revenue: { estReceivable: 60, actReceivable: 60, estPayable: 30, actPayable: 0, estMargin: 30, actMargin: 60 } },
  { jobNumber: 'SEA-I-FCL-H-N-2023-00054', hblNumber: 'HBL001174852', status: 'nomination_generated', origin: 'saudi arabia', destination: 'mundra', customer: 'Medscan SA', shipper: 'Medscan SA', consignee: 'Ajmal', revenue: { estReceivable: 31900, actReceivable: 31300, estPayable: 1050, actPayable: 1050, estMargin: 30850, actMargin: 30250 } },

  // HBL Generated
  { jobNumber: 'SEA-E-FCL-H-N-2025-01519', hblNumber: 'HBL11120001', status: 'hbl_generated', origin: 'JEBEL ALI SEAPORT, U.A.E', destination: 'Nhava Sheva', customer: 'accounts-us@ila-global.net', shipper: 'Aafaque', consignee: 'admin-us@ila-global.net', revenue: { estReceivable: 10, actReceivable: 0, estPayable: 402, actPayable: 0, estMargin: -392, actMargin: 0 } },
  { jobNumber: 'SEA-E-FCL-H-N-2025-01111', hblNumber: 'SEA-E-FCL-H-N-2025-01111', status: 'hbl_generated', origin: 'Shekou Pt', destination: 'Dubai', customer: 'Ashish', shipper: 'Customer Portal Access', consignee: 'Ashish', revenue: { estReceivable: 23.69, actReceivable: 13.69, estPayable: 200500, actPayable: 200500, estMargin: -200476.31, actMargin: -200486.31 } },
  { jobNumber: 'SEA-E-FCL-H-N-2025-00764', hblNumber: 'HBL125245274', status: 'hbl_generated', origin: 'Mundra', destination: 'Dubai', customer: 'Eyego', shipper: 'Eyego', consignee: 'Kunal Shipping', revenue: { estReceivable: 1500, actReceivable: 1499.99, estPayable: 1001, actPayable: 1000, estMargin: 499, actMargin: 499.99 } },
  { jobNumber: 'SEA-E-FCL-H-N-2024-00242', hblNumber: 'HBL 123', status: 'hbl_generated', origin: 'test', destination: 'dd', customer: 'Fluiconnecto Mali SARL', shipper: 'Customer Portal Access', consignee: 'Customer Portal Access', revenue: { estReceivable: 2305, actReceivable: 1805, estPayable: 1100, actPayable: 100, estMargin: 1205, actMargin: 1705 } },
  { jobNumber: 'SEA-E-FCL-H-N-2024-00160', hblNumber: 'HBL8989899', status: 'hbl_generated', origin: 'Gandhinagar', destination: 'DUBAI (UAE)', customer: 'Ajay Kukadiya', shipper: 'Customer Portal Access', consignee: 'Customer Portal Access', revenue: { estReceivable: 554091, actReceivable: 764090, estPayable: 40095, actPayable: 0, estMargin: 513996, actMargin: 764090 } },

  // HAWB Generated
  { jobNumber: 'AIR-E-PLT-H-N-2025-01630', hblNumber: 'TNGL1524', status: 'hawb_generated', origin: 'DUBAI (UAE)', destination: 'California', customer: 'Leviton Manufacturing Co., Inc.', shipper: 'Leviton Manufacturing Co., Inc.', consignee: 'admin-us@ila-global.net', revenue: { estReceivable: 2500, actReceivable: 2500, estPayable: 1800, actPayable: 0, estMargin: 700, actMargin: 2500 } },
  { jobNumber: 'AIR-E-LSE-H-N-2024-00534', hblNumber: 'HAWB4789', status: 'hawb_generated', origin: 'GURGAON, INDIA', destination: 'Dubai', customer: 'John Smith', shipper: 'AMGAD', consignee: 'admin-us@ila-global.net', revenue: { estReceivable: 253, actReceivable: 0, estPayable: 402, actPayable: 402, estMargin: -149, actMargin: -402 } },

  // In Transit
  { jobNumber: 'SEA-E-FCL-H-N-2025-01432', hblNumber: '12345', status: 'in_transit', origin: 'AbuDubai', destination: 'Pago Pago', customer: 'Aafaque', shipper: 'Ashish', consignee: 'admin-us@ila-global.net', revenue: { estReceivable: 0, actReceivable: 0, estPayable: 0, actPayable: 0, estMargin: 0, actMargin: 0 } },
  { jobNumber: 'SEA-I-FCL-H-N-2025-01291', hblNumber: 'ME9823134', status: 'in_transit', origin: 'Zaragoza', destination: 'Santo Domingo', customer: 'Customer Portal Access', shipper: 'Atharva', consignee: 'Customer Portal Access', revenue: { estReceivable: 0, actReceivable: 0, estPayable: 0, actPayable: 0, estMargin: 0, actMargin: 0 } },
  { jobNumber: 'ROA-E-FTL-H-N-2025-01263', hblNumber: '330022', status: 'in_transit', origin: 'Tema-Port Test', destination: 'Office of The Factory', customer: 'Connex Test Company', shipper: 'ABC TEST', consignee: 'Louis Fauchet', revenue: { estReceivable: 0, actReceivable: 0, estPayable: 0, actPayable: 0, estMargin: 0, actMargin: 0 } },
  { jobNumber: 'SEA-I-LCL-H-N-2025-01090', hblNumber: '998876', status: 'in_transit', origin: 'China', destination: 'Mexico', customer: 'Juan Mosquera, Cll34', shipper: 'Juan Parada, Cll21', consignee: 'Juan Mosquera, Cll34', revenue: { estReceivable: 10000, actReceivable: 0, estPayable: 50, actPayable: 0, estMargin: 9950, actMargin: 0 } },
  { jobNumber: 'SEA-E-FCL-H-N-2025-00864', hblNumber: 'EXP-FCL/2025-29763', status: 'in_transit', origin: 'JEBEL ALI SEAPORT, U.A.E', destination: 'Mumbai', customer: 'Atharva', shipper: 'Customer Portal Access', consignee: 'Atharva', revenue: { estReceivable: 3010, actReceivable: 3010, estPayable: 2842.5, actPayable: 2842.5, estMargin: 167.5, actMargin: 167.5 } },
  { jobNumber: 'AIR-E-PLT-H-N-2025-00806', hblNumber: 'QTR12345678', status: 'in_transit', origin: 'Maida Vale/London', destination: 'Manila North Harbour', customer: 'ABC CHILE, Alex', shipper: 'XYZ Company', consignee: 'bailey products', revenue: { estReceivable: 57501, actReceivable: 12501, estPayable: 40171, actPayable: 40170, estMargin: 17330, actMargin: -27669 } },
  { jobNumber: 'AIR-I-CR-H-N-2025-00625', hblNumber: 'AIR-000289AWB', status: 'in_transit', origin: 'Mumbai', destination: 'Dubai', customer: 'Kunal Shipping', shipper: '', consignee: '', revenue: { estReceivable: 6000, actReceivable: 5000, estPayable: 500, actPayable: 0, estMargin: 5500, actMargin: 5000 } },
  { jobNumber: 'SEA-E-FCL-H-N-2024-00561', hblNumber: 'HBLZ1234', status: 'in_transit', origin: 'Gandhinagar', destination: 'Dubai', customer: 'Samlaji traders', shipper: 'Samlaji traders', consignee: 'Ashish', revenue: { estReceivable: 1302, actReceivable: 250, estPayable: 0, actPayable: 0, estMargin: 1302, actMargin: 250 } },
  { jobNumber: 'AIR-I-LSE-H-N-2024-00396', hblNumber: 'HAWB_2325_AR', status: 'in_transit', origin: 'DUBAI (UAE)', destination: 'Mumbai', customer: 'Gulf Star Trading FZE', shipper: 'Customer Portal Access', consignee: 'Ashish', revenue: { estReceivable: 2600, actReceivable: 2600, estPayable: 2000, actPayable: 1000, estMargin: 600, actMargin: 1600 } },
  { jobNumber: 'SEA-E-LCL-H-N-2024-00394', hblNumber: 'SE2411010', status: 'in_transit', origin: 'DUBAI (UAE)', destination: 'JFK', customer: 'Gulf Star Trading FZE', shipper: 'Freeman Logistics', consignee: 'International Logistics Associates LLC', revenue: { estReceivable: 3600, actReceivable: 3600, estPayable: 2880, actPayable: 2880, estMargin: 720, actMargin: 720 } },

  // Arrived
  { jobNumber: 'SEA-E-FCL-H-N-2025-01174', hblNumber: 'TPZH250609001', status: 'arrived', origin: 'Dubai', destination: 'Shanghai', customer: 'Customer Portal Access', shipper: 'Customer Portal Access', consignee: 'Customer Portal Access', revenue: { estReceivable: 6709, actReceivable: 6709, estPayable: 576, actPayable: 0, estMargin: 6133, actMargin: 6709 } },
  { jobNumber: 'AIR-E-LSE-H-N-2025-00818', hblNumber: 'HAWB749944', status: 'arrived', origin: 'DUBAI (UAE)', destination: 'Gandhinagar', customer: 'Arek', shipper: 'XYZ Company', consignee: 'XYZ Company', revenue: { estReceivable: 0, actReceivable: 0, estPayable: 0, actPayable: 0, estMargin: 0, actMargin: 0 } },
  { jobNumber: 'AIR-E-LSE-H-N-2025-00790', hblNumber: 'hgbh', status: 'arrived', origin: 'Gandhinagar', destination: 'Dubai', customer: 'Customer Portal Access', shipper: 'Aafaque', consignee: 'Ashish', revenue: { estReceivable: 1075, actReceivable: 1000, estPayable: 402, actPayable: 352, estMargin: 673, actMargin: 648 } },
  { jobNumber: 'SEA-E-FCL-H-N-2025-00675', hblNumber: 'HBL839393', status: 'arrived', origin: 'Gandhinagar', destination: 'Dubai', customer: 'Customer Portal Access', shipper: 'Arek', consignee: 'Aafaque', revenue: { estReceivable: 8000, actReceivable: 8000, estPayable: 51, actPayable: 1, estMargin: 7949, actMargin: 7999 } },
  { jobNumber: 'AIR-E-PLT-H-N-2025-00628', hblNumber: '1234567HAWB_RS', status: 'arrived', origin: 'barcelona', destination: 'DUBAI (UAE)', customer: 'Farmacéutica Iberica S.A. _RS', shipper: 'Farmacéutica Iberica S.A. _RS', consignee: 'Customer Portal Access', revenue: { estReceivable: 1902, actReceivable: 1902, estPayable: 205, actPayable: 205, estMargin: 1697, actMargin: 1697 } },
  { jobNumber: 'AIR-E-CR-H-N-2025-00626', hblNumber: 'HAWB749944', status: 'arrived', origin: 'DUBAI (UAE)', destination: 'Gandhinagar', customer: 'Arek', shipper: '', consignee: '', revenue: { estReceivable: 0, actReceivable: 0, estPayable: 0, actPayable: 0, estMargin: 0, actMargin: 0 } },
  { jobNumber: 'SEA-E-FCL-H-N-2025-00576', hblNumber: 'HBB', status: 'arrived', origin: 'Gandhinagar', destination: 'DUBAI (UAE)', customer: 'Ashish', shipper: 'Ashish', consignee: 'Aafaque', revenue: { estReceivable: 130000, actReceivable: 0, estPayable: -5816.54, actPayable: 2211, estMargin: 135816.54, actMargin: -2211 } },
  { jobNumber: 'SEA-E-LCL-H-N-2024-00499', hblNumber: 'HBL1', status: 'arrived', origin: 'india', destination: 'DUBAI (UAE)', customer: 'The Emirates Group', shipper: 'John Smith', consignee: 'Customer Portal Access', revenue: { estReceivable: 400, actReceivable: 350, estPayable: 200, actPayable: 200, estMargin: 200, actMargin: 150 } },
  { jobNumber: 'SEA-I-LCL-H-N-2024-00430', hblNumber: 'HBL3343244', status: 'arrived', origin: 'DUBAI (UAE)', destination: 'JEBEL ALI SEAPORT, U.A.E', customer: 'admin-us@ila-global.net', shipper: 'Aafaque', consignee: 'Customer Portal Access', revenue: { estReceivable: 1150, actReceivable: 250, estPayable: 250, actPayable: 0, estMargin: 900, actMargin: 250 } },
  { jobNumber: 'SEA-E-FCL-H-N-2024-00328', hblNumber: 'HNEK11233', status: 'arrived', origin: 'JEBEL ALI SEAPORT, U.A.E', destination: 'CHENNAI', customer: 'Synergie Canada', shipper: 'Synergie Canada', consignee: 'Synergie Canada', revenue: { estReceivable: 2002, actReceivable: 2, estPayable: 100, actPayable: 0, estMargin: 1902, actMargin: 2 } },

  // Completed
  { jobNumber: 'SEA-E-FCL-H-N-2025-01793', hblNumber: 'HBLSmart-01793', status: 'completed', origin: 'Dubai', destination: 'Acaraguá', customer: 'Atharva', shipper: 'Aafaque', consignee: 'Ashish', revenue: { estReceivable: 2400, actReceivable: 0, estPayable: 1, actPayable: 0, estMargin: 2399, actMargin: 0 } },
  { jobNumber: 'SEA-E-FCL-H-N-2025-01628', hblNumber: '5201', status: 'completed', origin: 'AbuDubai', destination: 'GURGAON, INDIA', customer: 'ULTRA POMPE SRL', shipper: 'ULTRA POMPE SRL', consignee: 'ROOFING ROLLING MILLS LTD', revenue: { estReceivable: 600, actReceivable: 0, estPayable: 900, actPayable: 500, estMargin: -300, actMargin: -500 } },
  { jobNumber: 'SEA-E-FCL-H-N-2025-01627', hblNumber: 'HBL', status: 'completed', origin: 'AbuDubai', destination: 'Bazar-E-Panjwai', customer: 'Ashish', shipper: 'ABC CHILE, Alex', consignee: 'Atharva', revenue: { estReceivable: 500, actReceivable: 500, estPayable: 500, actPayable: 500, estMargin: 0, actMargin: 0 } },
  { jobNumber: 'SEA-E-FCL-H-N-2025-01614', hblNumber: '8422', status: 'completed', origin: 'DUBAI (UAE)', destination: 'Nhava Sheva', customer: 'ULTRA POMPE SRL', shipper: 'ULTRA POMPE SRL', consignee: 'ROOFING ROLLING MILLS LTD', revenue: { estReceivable: 1, actReceivable: 1, estPayable: 500, actPayable: 0, estMargin: -499, actMargin: 1 } },
  { jobNumber: 'SEA-E-FCL-H-N-2025-01593', hblNumber: '01593', status: 'completed', origin: 'Dubai', destination: 'Damman', customer: 'Yetta Diaz', shipper: 'Yetta Diaz', consignee: 'accounts-us@ila-global.net', revenue: { estReceivable: 0, actReceivable: 0, estPayable: 0, actPayable: 0, estMargin: 0, actMargin: 0 } },
  { jobNumber: 'SEA-I-LCL-H-N-2025-01441', hblNumber: '2035486324', status: 'completed', origin: 'ROTTERDAM', destination: 'DUBAI (UAE)', customer: 'Aafaque', shipper: 'admin-us@ila-global.net', consignee: 'Ashish', revenue: { estReceivable: 0, actReceivable: 0, estPayable: 500, actPayable: 0, estMargin: -500, actMargin: 0 } },
  { jobNumber: 'SEA-I-FCL-H-N-2025-01424', hblNumber: 'efcl', status: 'completed', origin: 'Gandhinagar', destination: 'DUBAI (UAE)', customer: 'Bharat Export Solutions Pvt. Ltd.', shipper: 'Adam', consignee: 'Aafaque', revenue: { estReceivable: 0, actReceivable: 0, estPayable: 0, actPayable: 0, estMargin: 0, actMargin: 0 } },
  { jobNumber: 'SEA-E-FCL-H-N-2025-01422', hblNumber: 'seaimp', status: 'completed', origin: 'DUBAI (UAE)', destination: 'Gandhinagar', customer: 'John Smith', shipper: 'Tej Hirpara', consignee: 'John Smith', revenue: { estReceivable: 0, actReceivable: 0, estPayable: 0, actPayable: 0, estMargin: 0, actMargin: 0 } },
  { jobNumber: 'SEA-E-FCL-H-N-2025-01258', hblNumber: '1001BL', status: 'completed', origin: 'Charleroi', destination: 'Tema', customer: 'Connex Test Company', shipper: 'ABCD', consignee: 'ABCD', revenue: { estReceivable: 2000, actReceivable: 2000, estPayable: 1000, actPayable: 0, estMargin: 1000, actMargin: 2000 } },
  { jobNumber: 'SEA-E-FCL-H-N-2025-01194', hblNumber: '12345fdsa948949132', status: 'completed', origin: 'DUBAI (UAE)', destination: 'Gandhinagar', customer: 'Customer Portal Access', shipper: 'Customer Portal Access', consignee: 'Customer Portal Access', revenue: { estReceivable: 1, actReceivable: 0, estPayable: 400, actPayable: 0, estMargin: -399, actMargin: 0 } },
];

const mockJobs = RAW_JOBS.map((job, idx) => {
  const { transportMode, direction, cargoType } = parseJobNumber(job.jobNumber);
  return {
    id: idx + 1,
    jobNumber: job.jobNumber,
    hblNumber: job.hblNumber,
    cargoType,
    transportMode,
    direction,
    status: job.status,
    origin: job.origin,
    destination: job.destination,
    customer: { companyName: job.customer },
    shipper: { companyName: job.shipper },
    consignee: { companyName: job.consignee },
    revenue: job.revenue,
  };
});

const TRANSPORT_MODES = ['', 'SEA', 'AIR', 'ROAD', 'RAIL'];
const DIRECTIONS = ['', 'EXPORT', 'IMPORT', 'LOCAL'];
const CARGO_TYPES = ['', 'FCL', 'LCL', 'LSE', 'FTL', 'LTL', 'BULK', 'RORO', 'BREAKBULK'];

const PAGE_SIZE = 5;

const fmtAmount = (val) => `${(parseFloat(val) || 0).toFixed(2)} AED`;

const RevenueTable = ({ revenue }) => {
  const r = revenue || {};
  return (
    <table className="text-xs w-full max-w-xs">
      <thead>
        <tr className="text-gray-400">
          <th className="text-left font-medium pb-1"> </th>
          <th className="text-right font-medium pb-1">Estimated</th>
          <th className="text-right font-medium pb-1">Actual</th>
        </tr>
      </thead>
      <tbody className="text-gray-700">
        <tr>
          <td className="py-0.5 text-gray-500">Receivable</td>
          <td className="py-0.5 text-right">{fmtAmount(r.estReceivable)}</td>
          <td className="py-0.5 text-right">{fmtAmount(r.actReceivable)}</td>
        </tr>
        <tr>
          <td className="py-0.5 text-gray-500">Payable</td>
          <td className="py-0.5 text-right">{fmtAmount(r.estPayable)}</td>
          <td className="py-0.5 text-right">{fmtAmount(r.actPayable)}</td>
        </tr>
        <tr className="font-semibold">
          <td className="py-0.5 text-gray-500">Margin</td>
          <td className="py-0.5 text-right">{fmtAmount(r.estMargin)}</td>
          <td className="py-0.5 text-right">{fmtAmount(r.actMargin)}</td>
        </tr>
      </tbody>
    </table>
  );
};

const JobCard = ({ job, onClick }) => (
  <div
    onClick={onClick}
    className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all flex flex-col md:flex-row md:items-start gap-4"
  >
    <div className="flex-1 min-w-0 space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono font-semibold text-blue-700 text-sm">{job.jobNumber}</span>
        {job.hblNumber && (
          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">HBL: {job.hblNumber}</span>
        )}
        <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{job.cargoType}</span>
        <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">{job.direction}</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-800 font-medium">
        <span>{job.origin || '—'}</span>
        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
        <span>{job.destination || '—'}</span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-xs pt-1">
        <div>
          <p className="text-gray-400">Customer</p>
          <p className="text-gray-700 font-medium truncate">{job.customer?.companyName || '—'}</p>
        </div>
        <div>
          <p className="text-gray-400">Shipper</p>
          <p className="text-gray-700 font-medium truncate">{job.shipper?.companyName || '—'}</p>
        </div>
        <div>
          <p className="text-gray-400">Consignee</p>
          <p className="text-gray-700 font-medium truncate">{job.consignee?.companyName || '—'}</p>
        </div>
      </div>
    </div>
    <div className="md:border-l md:border-gray-100 md:pl-4 flex-shrink-0">
      <RevenueTable revenue={job.revenue} />
    </div>
  </div>
);

const AdminHouseShipments = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ transportMode: '', direction: '', cargoType: '', search: '' });
  const [visibleCounts, setVisibleCounts] = useState({});
  const [collapsed, setCollapsed] = useState({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ffJobsAPI.getAll({ ...filters, limit: 500 });
      const data = res.data?.data || [];
      setJobs(data.length ? data : mockJobs);
    } catch {
      setJobs(mockJobs);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const setFilter = (key, val) => setFilters((prev) => ({ ...prev, [key]: val }));

  const filteredJobs = useMemo(() => jobs.filter((j) => {
    if (filters.transportMode && j.transportMode !== filters.transportMode) return false;
    if (filters.direction && j.direction !== filters.direction) return false;
    if (filters.cargoType && j.cargoType !== filters.cargoType) return false;
    if (filters.search) {
      const search = filters.search.toLowerCase();
      const jobNumber = String(j.jobNumber || '').toLowerCase();
      const customerName = String(j.customer?.companyName || '').toLowerCase();
      const hbl = String(j.hblNumber || '').toLowerCase();
      if (!jobNumber.includes(search) && !customerName.includes(search) && !hbl.includes(search)) return false;
    }
    return true;
  }), [jobs, filters]);

  const grouped = useMemo(() => {
    const map = {};
    GROUP_ORDER.forEach((s) => { map[s] = []; });
    filteredJobs.forEach((j) => {
      const status = j.status || 'created';
      if (!map[status]) map[status] = [];
      map[status].push(j);
    });
    return map;
  }, [filteredJobs]);

  const toggleCollapsed = (status) => setCollapsed((c) => ({ ...c, [status]: !c[status] }));
  const showMore = (status) => setVisibleCounts((c) => ({ ...c, [status]: (c[status] || PAGE_SIZE) + PAGE_SIZE }));

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">House Shipment</h1>
        <button
          onClick={() => navigate('/admin/house-shipments/create')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create New
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search job number / HBL / customer..."
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
            className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
        </div>
        {[
          { key: 'transportMode', options: TRANSPORT_MODES, label: 'Transport Mode' },
          { key: 'direction', options: DIRECTIONS, label: 'Direction' },
          { key: 'cargoType', options: CARGO_TYPES, label: 'Cargo Type' },
        ].map(({ key, options, label }) => (
          <select
            key={key}
            value={filters[key]}
            onChange={(e) => setFilter(key, e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">{label}</option>
            {options.filter(Boolean).map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
      </div>

      {/* Grouped lists */}
      {loading ? <PageLoader /> : (
        <div className="space-y-4">
          {GROUP_ORDER.map((status) => {
            const records = grouped[status] || [];
            if (records.length === 0) return null;
            const isCollapsed = !!collapsed[status];
            const visible = visibleCounts[status] || PAGE_SIZE;
            const shown = records.slice(0, visible);
            const remaining = records.length - shown.length;

            return (
              <div key={status} className="space-y-3">
                <button
                  onClick={() => toggleCollapsed(status)}
                  className="w-full flex items-center gap-2 px-1 py-1 text-left"
                >
                  {isCollapsed ? <ChevronRight className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getFFJobStatusColor(status)}`}>
                    {STATUS_LABELS[status] || status}
                  </span>
                  <span className="text-sm text-gray-400 font-medium">{records.length}</span>
                </button>

                {!isCollapsed && (
                  <div className="space-y-2 pl-1">
                    {shown.map((job) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        onClick={() => navigate(`/admin/house-shipments/${job.id}`)}
                      />
                    ))}
                    {remaining > 0 && (
                      <button
                        onClick={() => showMore(status)}
                        className="text-sm text-blue-700 font-medium hover:underline px-1"
                      >
                        Load more... ({remaining} remaining)
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {filteredJobs.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-xl py-10 text-center text-gray-400">
              No house shipments found
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminHouseShipments;
