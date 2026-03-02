/**
 * Express middleware for Joi schema validation.
 * Usage: router.post('/path', validate(schema), handler);
 */
function validate(schema, property = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], { abortEarly: false, stripUnknown: true });
    if (error) {
      const messages = error.details.map(d => d.message);
      return res.status(400).json({ error: 'Validation failed', details: messages });
    }
    req[property] = value;
    next();
  };
}

module.exports = { validate };
