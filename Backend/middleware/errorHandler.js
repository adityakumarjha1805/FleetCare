function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const status = Number(error.statusCode || error.status);
  const isClientError = Number.isInteger(status) && status >= 400 && status < 500;
  const isInvalidJson = error.type === 'entity.parse.failed';

  if (!isClientError) {
    console.error(error);
  }

  res.status(isClientError ? status : 500).json({
    success: false,
    error: {
      code: isInvalidJson
        ? 'INVALID_JSON'
        : isClientError
          ? 'REQUEST_ERROR'
          : 'INTERNAL_SERVER_ERROR',
      message: isInvalidJson
        ? 'Request body must contain valid JSON'
        : isClientError
          ? 'Request failed'
          : 'An unexpected error occurred',
    },
  });
}

module.exports = errorHandler;
