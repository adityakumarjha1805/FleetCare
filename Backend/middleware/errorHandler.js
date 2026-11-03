function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const status = Number(error.statusCode || error.status);
  const isClientError = Number.isInteger(status) && status >= 400 && status < 500;
  const isInvalidJson = error.type === 'entity.parse.failed';
  const isDuplicateKey = error.code === 11000;

  if (!isClientError && !isDuplicateKey) {
    console.error(error);
  }

  res.status(isDuplicateKey ? 409 : isClientError ? status : 500).json({
    success: false,
    error: {
      code: isDuplicateKey
        ? 'EMAIL_ALREADY_REGISTERED'
        : isInvalidJson
          ? 'INVALID_JSON'
          : isClientError
            ? 'REQUEST_ERROR'
            : 'INTERNAL_SERVER_ERROR',
      message: isDuplicateKey
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
