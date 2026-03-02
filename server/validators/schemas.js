const Joi = require('joi');

const registerSchema = Joi.object({
  email: Joi.string().email().max(255).required(),
  password: Joi.string().min(6).max(128).required(),
  fullName: Joi.string().trim().min(1).max(100).required(),
  phoneNumber: Joi.string().allow('', null).max(20),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
  newPassword: Joi.string().min(6).max(128).required(),
});

const vitalsIngestSchema = Joi.object({
  heartRate: Joi.number().min(0).max(300).allow(null),
  spo2: Joi.number().min(0).max(100).allow(null),
  temperature: Joi.number().min(20).max(50).allow(null),
  motionStatus: Joi.string().valid('resting', 'active', 'fall_detected').allow(null),
  ecgData: Joi.array().items(Joi.number()).allow(null),
});

const createDeviceSchema = Joi.object({
  patientId: Joi.string().uuid().required(),
  deviceName: Joi.string().trim().min(1).max(100).default('ESP32-Sensor'),
});

const updateThresholdsSchema = Joi.object({
  metric: Joi.string().valid('heart_rate', 'spo2', 'temperature').required(),
  warningLow: Joi.number().allow(null),
  warningHigh: Joi.number().allow(null),
  criticalLow: Joi.number().allow(null),
  criticalHigh: Joi.number().allow(null),
});

module.exports = {
  registerSchema,
  loginSchema,
  resetPasswordSchema,
  vitalsIngestSchema,
  createDeviceSchema,
  updateThresholdsSchema,
};
