// Базова клас за приложенски грешки, разширяваща вградения Error.
class AppError extends Error {
  // Конструктор – инициализира всички полета на грешката.
  constructor(code, status, message, details = null, options = {}) {
    // Извикваме родителския Error конструктор с текста на съобщението.
    super(message);
    // Име на класа – за логване и debugging (например "ValidationError").
    this.name = this.constructor.name;
    // Код за машиночитаема класификация (напр. "VALIDATION_ERROR", "NOT_FOUND").
    this.code = code || 'INTERNAL_ERROR';
    // HTTP статус код (напр. 422, 404, 500).
    this.status = status || 500;
    // Допълнителни детайли – структурирана информация за грешката (опционално).
    this.details = details;
    // Operational грешки са очаквани (валидация, не намерено) – не изискват restart.
    this.isOperational = options.isOperational !== false;

    // Запазваме stack trace за debugging (ако средата поддържа captureStackTrace).
    Error.captureStackTrace?.(this, this.constructor);
  }
}

// Грешка при невалидни входни данни от клиента – HTTP 422.
class ValidationError extends AppError {
  constructor(message = 'Invalid request data.', details = null) {
    super('VALIDATION_ERROR', 422, message, details);
  }
}

// Грешка при липсващо или невалидно удостоверяване – HTTP 401.
class AuthError extends AppError {
  constructor(message = 'Authentication required.', details = null) {
    super('AUTH_ERROR', 401, message, details);
  }
}

// Грешка при достъп до ресурс без съответните права – HTTP 403.
class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action.', details = null) {
    super('FORBIDDEN', 403, message, details);
  }
}

// Грешка когато поисканият ресурс не съществува – HTTP 404.
class NotFoundError extends AppError {
  constructor(message = 'Resource not found.', details = null) {
    super('NOT_FOUND', 404, message, details);
  }
}

// Грешка при конфликт със съществуващо състояние (дублиране, overlap) – HTTP 409.
class ConflictError extends AppError {
  constructor(message = 'The requested operation conflicts with the current state.', details = null) {
    super('CONFLICT', 409, message, details);
  }
}

// Грешка при проблем с външен сервис (Stripe, email и др.) – HTTP 502.
class ExternalServiceError extends AppError {
  constructor(message = 'External service is currently unavailable.', details = null, options = {}) {
    super('EXTERNAL_SERVICE_ERROR', 502, message, details, options);
  }
}

// Връща true само ако обектът е инстанция на AppError или някой подклас.
function isAppError(error) {
  return error instanceof AppError;
}

// Експортираме всички класове и помощната функция за използване в целия backend.
module.exports = {
  AppError,
  ValidationError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ExternalServiceError,
  isAppError,
};
