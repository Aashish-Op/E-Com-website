const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { httpError } = require('../utils/httpError');
const { COOKIE_NAMES, cookieOptions } = require('../utils/cookies');
const { mergeGuestCartIntoUser } = require('../services/cartService');

const router = express.Router();

function signToken(user) {
  const secret = process.env.JWT_SECRET || 'dev_only_change_me';
  return jwt.sign({ sub: user._id.toString(), role: user.role }, secret, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
}

function setAuthCookie(res, user) {
  res.cookie(COOKIE_NAMES.token, signToken(user), cookieOptions({
    maxAge: 1000 * 60 * 60 * 24 * 7
  }));
}

function assertValid(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw httpError(400, 'Validation failed', errors.array());
}

router.get('/csrf', (req, res) => {
  res.json({ success: true, csrfToken: req.csrfToken });
});

router.post('/register', [
  body('name').trim().isLength({ min: 2 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('phone').optional().trim()
], asyncHandler(async (req, res) => {
  assertValid(req);
  const exists = await User.findOne({ email: req.body.email });
  if (exists) throw httpError(409, 'An account with this email already exists');

  const user = await User.create({
    name: req.body.name,
    email: req.body.email,
    phone: req.body.phone,
    passwordHash: await User.hashPassword(req.body.password),
    emailVerificationToken: crypto.randomBytes(24).toString('hex')
  });
  await mergeGuestCartIntoUser(req.cartToken, user._id);
  setAuthCookie(res, user);
  res.status(201).json({ success: true, user: user.toSafeJSON() });
}));

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], asyncHandler(async (req, res) => {
  assertValid(req);
  const user = await User.findOne({ email: req.body.email }).select('+passwordHash');
  if (!user || !(await user.comparePassword(req.body.password))) {
    throw httpError(401, 'Invalid email or password');
  }
  await mergeGuestCartIntoUser(req.cartToken, user._id);
  setAuthCookie(res, user);
  res.json({ success: true, user: user.toSafeJSON() });
}));

router.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAMES.token, cookieOptions());
  res.json({ success: true });
});

router.get('/me', (req, res) => {
  res.json({ success: true, user: req.user ? req.user.toSafeJSON() : null });
});

router.post('/password/forgot', [
  body('email').isEmail().normalizeEmail()
], asyncHandler(async (req, res) => {
  assertValid(req);
  const user = await User.findOne({ email: req.body.email }).select('+resetPasswordToken +resetPasswordExpiresAt');
  if (user) {
    user.resetPasswordToken = crypto.randomBytes(24).toString('hex');
    user.resetPasswordExpiresAt = new Date(Date.now() + 1000 * 60 * 30);
    await user.save();
  }
  res.json({ success: true, message: 'If that email exists, a password reset link will be sent.' });
}));

router.post('/verify-email', [
  body('token').notEmpty()
], asyncHandler(async (req, res) => {
  assertValid(req);
  const user = await User.findOne({ emailVerificationToken: req.body.token }).select('+emailVerificationToken');
  if (!user) throw httpError(400, 'Invalid verification token');
  user.emailVerified = true;
  user.emailVerificationToken = undefined;
  await user.save();
  res.json({ success: true });
}));

module.exports = router;
