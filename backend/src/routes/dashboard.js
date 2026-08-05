const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/kpis', dashboardController.getKPIs);
router.get('/shipments-by-mode', dashboardController.getShipmentsByMode);
router.get('/shipments-by-status', dashboardController.getShipmentsByStatus);
router.get('/monthly-revenue', dashboardController.getMonthlyRevenue);
router.get('/recent-activities', dashboardController.getRecentActivities);
router.get('/top-routes', dashboardController.getTopRoutes);
router.get('/upcoming-deliveries', dashboardController.getUpcomingDeliveries);
router.get('/admin-stats', dashboardController.getAdminStats);
router.get('/user-stats', dashboardController.getUserStats);
router.get('/shipment-dashboard', dashboardController.getShipmentDashboard);
router.get('/carrier-booking-dashboard', dashboardController.getCarrierBookingDashboard);
router.get('/activity-dashboard', dashboardController.getActivityDashboard);
router.get('/credit-limit-overdue', dashboardController.getCreditLimitOverdue);

module.exports = router;
