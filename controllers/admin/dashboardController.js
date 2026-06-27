// dashboardService – admin dashboard данни.
const dashboardService = require('../../services/admin/dashboardService');

// Render на admin dashboard със summary stats и orders.
exports.getAdminDashboard = async (req, res, next) => {
    try {
        // Ask the service layer to fetch dashboard metrics and backing order data.
        const { orders, stats } = await dashboardService.getDashboardData();

        // Render the dashboard template with the service result.
        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            orders,
            stats
        });
    } catch (err) {
        // Unexpected dashboard failures go through the central error handler.
        console.error('Admin dashboard error:', err);
        err.publicMessage = 'Error loading admin dashboard.';
        return next(err);
    }
};
