// orderAdminService – admin order CRUD и transaction логика.
const orderAdminService = require('../../services/admin/order');

// Render the main admin order list page.
exports.getAllOrders = async (req, res, next) => {
    try {
        // Query-string filters are passed through to the order admin service.
        const data = await orderAdminService.getOrdersList(req.query);

        res.render('admin/orders', {
            title: 'All Orders',
            ...data
        });
    } catch (err) {
        // Bubble the failure to the global handler with a friendly public message.
        console.error('Get orders error:', err);
        err.publicMessage = 'Error fetching orders.';
        return next(err);
    }
};

// Render the expired-orders list.
exports.getExpiredOrders = async (req, res, next) => {
    try {
        const data = await orderAdminService.getExpiredOrders();

        res.render('admin/orders-expired', {
            title: 'Expired Orders',
            ...data
        });
    } catch (err) {
        console.error('Get expired orders error:', err);
        err.publicMessage = 'Error fetching expired orders.';
        return next(err);
    }
};

// Render the deleted-orders bin.
exports.getDeletedOrders = async (req, res, next) => {
    try {
        const data = await orderAdminService.getDeletedOrders();

        res.render('admin/orders-deleted', {
            title: 'Deleted Orders',
            ...data,
            error: req.query.err || null
        });
    } catch (err) {
        console.error('Get deleted orders error:', err);
        err.publicMessage = 'Error fetching deleted orders.';
        return next(err);
    }
};

// Permanently empty the deleted-orders bin.
exports.postEmptyDeletedOrders = async (_req, res, next) => {
    try {
        await orderAdminService.emptyDeletedOrders();
        res.redirect('/admin/orders/deleted');
    } catch (err) {
        console.error('Empty deleted orders error:', err);
        err.publicMessage = 'Error emptying deleted orders bin.';
        return next(err);
    }
};

// Render the create-order admin form.
exports.getCreateOrder = async (req, res, next) => {
    try {
        const data = await orderAdminService.getCreateOrderForm();
        res.render('admin/order-new', {
            title: 'Add Order',
            ...data
        });
    } catch (err) {
        console.error('Get create order error:', err);
        err.publicMessage = 'Error loading the order creation form.';
        return next(err);
    }
};

// JSON endpoint: check if a car is available for the given period (read-only)
// Return availability info for a selected car/date range to power admin form UX.
exports.getCarAvailability = async (req, res) => {
  try {
    const result = await orderAdminService.getCarAvailability(
      req.params.id,
      req.query
    );
    // The service returns both status and body so the controller can stay very thin.
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('getCarAvailability error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
};

// Create a new admin-side order after service-layer validation/business rules run.
exports.postCreateOrder = async (req, res, next) => {
    try {
        const result = await orderAdminService.createOrder(req.body);
        // Success redirects back to the main order list.
        if (result.success) {
            return res.redirect('/admin/orders');
        }

        // Validation/business-rule failures re-render the form with the service-generated view model.
        return res.status(result.status).render('admin/order-new', {
                title: 'Add Order',
            ...result.viewModel
        });
    } catch (err) {
        console.error('Post create order error:', err);
        err.publicMessage = 'Error creating order.';
        return next(err);
    }
};

// Render the details page for a single order.
exports.getOrderDetails = async (req, res, next) => {
    try {
        const order = await orderAdminService.getOrderDetails(req.params.id);
        // Missing orders are handled locally with a 404 text response.
        if (!order) return res.status(404).send('Order not found');
        res.render('admin/order-view', {
            title: 'Order Details',
            order
        });
    } catch (err) {
        console.error('Get order details error:', err);
        err.publicMessage = 'Error loading order details.';
        return next(err);
    }
};

// Render the edit form for a single order.
exports.getEditOrder = async (req, res, next) => {
    try {
        const data = await orderAdminService.getOrderEditData(req.params.id);
        // Missing orders are handled locally.
        if (!data) return res.status(404).send('Order not found');
        res.render('admin/order-edit', {
            title: 'Edit Order',
            ...data
        });
    } catch (err) {
        console.error('Get edit order error:', err);
        err.publicMessage = 'Error loading order.';
        return next(err);
    }
};

// Save admin-side edits to an order.
exports.postEditOrder = async (req, res, next) => {
    try {
        const result = await orderAdminService.updateOrder(
            req.params.id,
            req.body
        );
        // Success returns to the order list.
        if (result.success) {
            return res.redirect('/admin/orders');
        }
        // Validation/business errors re-render the form with service-computed state.
        return res.status(result.status).render('admin/order-edit', {
            title: 'Edit Order',
            ...result.viewModel
        });
    } catch (err) {
        console.error('Post edit order error:', err);
        err.publicMessage = 'Error saving order.';
        return next(err);
    }
};

// Soft-delete an order from the admin list.
exports.postDeleteOrder = async (req, res, next) => {
    try {
        await orderAdminService.deleteOrder(req.params.id);
        res.redirect('/admin/orders');
    } catch (err) {
        console.error('Delete order error:', err);
        err.publicMessage = 'Error deleting order.';
        return next(err);
    }
};

// Restore a soft-deleted order from the admin bin.
exports.postRestoreOrder = async (req, res, next) => {
    try {
        await orderAdminService.restoreOrder(req.params.id);
        res.redirect('/admin/orders');
    } catch (err) {
        console.error('Restore order error:', err);
        // Restore errors with a domain-specific flag are redirected back to the deleted list with a query message.
        if (err && err.isOrderRestoreError) {
            const message = err.message || 'Error restoring order';
          return res.redirect(`/admin/orders/deleted?err=${encodeURIComponent(message)}`);
        }
        err.publicMessage = 'Error restoring order.';
        return next(err);
    }
};
