// validationResult – route-level validation грешки за admin car форми.
const { validationResult } = require('express-validator');
// carAdminService – admin fleet CRUD логика.
const carAdminService = require('../../services/admin/carAdminService');
const { removeUploadedFile } = require('../../middleware/fileUpload/uploadUtils');

// -------- Cars CRUD (basic scaffolding, no complex logic) --------
// Render the admin fleet list page.
exports.listCars = async (req, res, next) => {
    try {
        const cars = await carAdminService.listCars();
        res.render('admin/cars', { title: 'Manage Cars', cars });
    } catch (err) {
        console.error('List cars error:', err);
        err.publicMessage = 'Error loading cars.';
        return next(err);
    }
};

// Render the blank admin create-car form.
exports.getCreateCar = async (req, res) => {
    res.render('admin/car-form', { title: 'Add Car', car: null });
};

// Persist a newly created car from the admin form.
exports.postCreateCar = async (req, res, next) => {
    try {
        // Check for multer file validation errors first
        if (req.fileValidationError) {
            return res.status(422).render('admin/car-form', {
                title: 'Add Car',
                car: carAdminService.buildCarFormState(req.body),
                errors: [{ msg: req.fileValidationError, param: 'image', location: 'body' }]
            });
        }
        // Read express-validator errors produced at the route layer.
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            await removeUploadedFile(req.file);
            return res.status(422).render('admin/car-form', {
                title: 'Add Car',
                car: carAdminService.buildCarFormState(req.body),
                errors: errors.array()
            });
        }
        // Delegate actual persistence to the service layer.
        await carAdminService.createCar(req.body, req.file);
        res.redirect('/admin/cars');
    } catch (err) {
        await removeUploadedFile(req.file);
        console.error('Create car error:', err);
        return res.status(422).render('admin/car-form', {
            title: 'Add Car',
            car: carAdminService.buildCarFormState(req.body),
            errors: [{ msg: err.message || 'Error creating car. Please check all required fields are filled.', param: '_error', location: 'body' }]
        });
    }
};

// Render the edit-car form.
exports.getEditCar = async (req, res, next) => {
    try {
        const car = await carAdminService.getCarById(req.params.id);
        if (!car) return res.status(404).send('Car not found');
        res.render('admin/car-form', { title: 'Edit Car', car });
    } catch (err) {
        console.error('Get edit car error:', err);
        err.publicMessage = 'Error loading car.';
        return next(err);
    }
};

// Save edits to an existing car.
exports.postEditCar = async (req, res, next) => {
    try {
        // Check for multer file validation errors first
        if (req.fileValidationError) {
            const car = await carAdminService.getCarById(req.params.id);
            return res.status(422).render('admin/car-form', {
                title: 'Edit Car',
                car: carAdminService.buildCarFormState(req.body, car || null),
                errors: [{ msg: req.fileValidationError, param: 'image', location: 'body' }]
            });
        }
        // Read express-validator failures produced by the route.
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            await removeUploadedFile(req.file);
            const car = await carAdminService.getCarById(req.params.id);
            return res.status(422).render('admin/car-form', {
                title: 'Edit Car',
                car: carAdminService.buildCarFormState(req.body, car || null),
                errors: errors.array()
            });
        }
        // Delegate the actual update to the admin car service.
        await carAdminService.updateCar(req.params.id, req.body, req.file);
        res.redirect('/admin/cars');
    } catch (err) {
        await removeUploadedFile(req.file);
        if (err.message === 'Car not found') {
            return res.status(404).send('Car not found');
        }
        console.error('Edit car error:', err);
        try {
            const car = await carAdminService.getCarById(req.params.id);
            return res.status(422).render('admin/car-form', {
                title: 'Edit Car',
                car: carAdminService.buildCarFormState(req.body, car || null),
                errors: [{ msg: err.message || 'Error updating car. Please check all required fields are filled.', param: '_error', location: 'body' }]
            });
        } catch (loadErr) {
            // If we can't load the car, then show generic error
            err.publicMessage = 'Error updating car.';
            return next(err);
        }
    }
};

// Delete a car from the fleet.
exports.postDeleteCar = async (req, res, next) => {
    try {
        await carAdminService.deleteCar(req.params.id);
        res.redirect('/admin/cars');
    } catch (err) {
        console.error('Delete car error:', err);
        err.publicMessage = 'Error deleting car.';
        return next(err);
    }
};
