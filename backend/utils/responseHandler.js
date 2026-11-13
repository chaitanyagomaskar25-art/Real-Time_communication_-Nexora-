const sendSuccess = (res, statusCode = 200, message = 'Success', data = null) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

const sendError = (res, statusCode = 500, message = 'Server Error', error = null) => {
  return res.status(statusCode).json({
    success: false,
    message,
    error: error ? (error.message || error) : null
  });
};

module.exports = {
  sendSuccess,
  sendError
};

