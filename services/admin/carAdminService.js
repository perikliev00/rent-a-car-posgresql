const carRepository = require('../../repositories/carRepository');

function parsePriceTier(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function deriveBasePrice({ tierShort, tierMedium, tierLong }) {
  if (tierShort !== undefined) return tierShort;
  if (tierMedium !== undefined) return tierMedium;
  if (tierLong !== undefined) return tierLong;
  return undefined;
}

function buildImagePath(file, fallback = '') {
  return file ? `/images/${file.filename}` : fallback;
}

function buildCarFormState(body = {}, existingCar = null) {
  const car = existingCar ?? {};

  const pick = (key, fallback = '') => {
    if (Object.prototype.hasOwnProperty.call(body, key) && body[key] !== '') {
      return body[key];
    }
    if (existingCar && car[key] !== undefined) {
      return car[key];
    }
    return fallback;
  };

  const pickAvailability = () => {
    if (Object.prototype.hasOwnProperty.call(body, 'availability')) {
      return body.availability === 'on';
    }
    if (existingCar) return !!car.availability;
    return true;
  };

  const pickTier = (key) => {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      return body[key] === '' ? undefined : body[key];
    }
    if (existingCar && car[key] !== undefined) return car[key];
    return undefined;
  };

  const base = existingCar
    ? { id: car.id, image: car.image, price: car.price }
    : {};

  return {
    ...base,
    name: pick('name', ''),
    transmission: pick('transmission', ''),
    seats: pick('seats', ''),
    fuelType: pick('fuelType', ''),
    availability: pickAvailability(),
    priceTier_1_3: pickTier('priceTier_1_3'),
    priceTier_7_31: pickTier('priceTier_7_31'),
    priceTier_31_plus: pickTier('priceTier_31_plus'),
  };
}

function buildCarPayload(payload, file, existingCar = null) {
  const tierShort = parsePriceTier(payload.priceTier_1_3);
  const tierMedium = parsePriceTier(payload.priceTier_7_31);
  const tierLong = parsePriceTier(payload.priceTier_31_plus);

  const finalTierShort =
    tierShort !== undefined
      ? tierShort
      : existingCar
        ? existingCar.priceTier_1_3
        : undefined;
  const finalTierMedium =
    tierMedium !== undefined
      ? tierMedium
      : existingCar
        ? existingCar.priceTier_7_31
        : undefined;
  const finalTierLong =
    tierLong !== undefined
      ? tierLong
      : existingCar
        ? existingCar.priceTier_31_plus
        : undefined;

  const derivedBase = deriveBasePrice({
    tierShort: finalTierShort,
    tierMedium: finalTierMedium,
    tierLong: finalTierLong,
  });

  const seats = parseInt(payload.seats, 10);
  if (!Number.isInteger(seats) || seats <= 0) {
    throw new Error('Seats must be a positive number.');
  }

  const price =
    derivedBase !== undefined
      ? derivedBase
      : existingCar
        ? existingCar.price
        : undefined;

  if (price === undefined) {
    throw new Error('At least one price tier is required.');
  }

  const image = file
    ? buildImagePath(file)
    : existingCar
      ? existingCar.image
      : buildImagePath(file);

  if (!image) {
    throw new Error('Car image is required.');
  }

  return {
    name: payload.name,
    transmission: payload.transmission,
    seats,
    fuelType: payload.fuelType,
    price,
    priceTier_1_3: finalTierShort,
    priceTier_7_31: finalTierMedium,
    priceTier_31_plus: finalTierLong,
    image,
    availability:
      payload.availability === undefined
        ? existingCar
          ? !!existingCar.availability
          : true
        : payload.availability === 'on',
  };
}

async function listCars() {
  return carRepository.listAll();
}

async function getCarById(id) {
  return carRepository.findById(id);
}

async function createCar(payload, file) {
  const carPayload = buildCarPayload(payload, file);
  await carRepository.create(carPayload);
}

async function updateCar(id, payload, file) {
  const existingCar = await carRepository.findById(id);
  if (!existingCar) {
    throw new Error('Car not found');
  }

  const carPayload = buildCarPayload(payload, file, existingCar);
  const updated = await carRepository.update(id, carPayload);
  if (!updated) {
    throw new Error('Car not found');
  }
}

async function deleteCar(id) {
  const deleted = await carRepository.deleteById(id);
  if (!deleted) {
    throw new Error('Car not found');
  }
}

module.exports = {
  listCars,
  getCarById,
  createCar,
  updateCar,
  deleteCar,
  buildCarFormState,
};
