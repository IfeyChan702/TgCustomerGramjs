exports.success = (data) => ({
  success: true,
  data,
  errorMessage: null,
});

exports.fail = (msg = 'unknown error', data = {}) => ({
  success: false,
  data,
  errorMessage: msg,
});
