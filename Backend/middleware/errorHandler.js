function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const status = Number(error.statusCode || error.status);
  const isClientError = Number.isInteger(status) && status >= 400 && status < 500;
  const isInvalidJson = error.type === 'entity.parse.failed';
  const keyPattern = error.keyPattern;
  const keyValue = error.keyValue;
  const isEmailDuplicateKey =
    error.code === 11000 &&
    ((keyPattern &&
      Object.keys(keyPattern).length === 1 &&
      keyPattern.email === 1) ||
      (!keyPattern &&
        keyValue &&
        Object.keys(keyValue).length === 1 &&
        Object.hasOwn(keyValue, 'email')));

  if (!isClientError && !isEmailDuplicateKey) {
    console.error(
      error.code === 11000
        ? 'Unexpected database duplicate-key conflict'
        : error,
    );
  }

  res.status(isEmailDuplicateKey ? 409 : isClientError ? status : 500).json({
    success: false,
    error: {
      code: isEmailDuplicateKey
        ? 'EMAIL_ALREADY_REGISTERED'
        : isInvalidJson
          ? 'INVALID_JSON'
          : isClientError
            ? 'REQUEST_ERROR'
            : 'INTERNAL_SERVER_ERROR',
      message: isEmailDuplicateKey
        ? 'An account with this email already exists'
        : isInvalidJson
          ? 'Request body must contain valid JSON'
          : isClientError
            ? 'Request failed'
            : 'An unexpected error occurred',
    },
  });
}

module.exports = errorHandler;
