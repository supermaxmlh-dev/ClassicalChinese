const { handleFeedbackRequest } = require("../shared/feedback");

module.exports = async function feedback(context, req) {
  const result = await handleFeedbackRequest({
    method: req.method,
    headers: req.headers || {},
    query: req.query || {},
    url: req.url || "",
    body: req.body
  });

  context.res = {
    status: result.status,
    headers: result.headers,
    body: result.body
  };
};
