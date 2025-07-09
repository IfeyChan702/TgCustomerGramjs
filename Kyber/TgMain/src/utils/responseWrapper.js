exports.success = (data) => ({
  success: true,
  data,
  errorMessage: null
});

exports.fail = (msg = "unknown error", data = {}) => ({
  success: false,
  data,
  errorMessage: msg
});


exports.success200 = (data, message = null) => ({
  code: 200,
  data: data,
  message: message
});

exports.fail500 = (message) => ({
  code: 500,
  data: null,
  message: message
});
