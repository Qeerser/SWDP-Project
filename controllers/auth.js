import User from "../models/User.js";
import asyncHandler from '../middleware/async.js';

// @desc    Register user
// @route   POST /api/v1/auth/register
// @access  Public
const register = asyncHandler(async (req, res) => {
	try {
		const { name, email, password, role, telephone } = req.body;

		// Create user
		const user = await User.create({
			name,
			email,
			password,
			role,
			telephone,
		});

		// Create token

		// const token = user.getSignedJwtToken();
		// res.status(200).json({success: true,token});
		sendTokenResponse(user, 200, res);
	} catch (err) {
		res.status(400).json({ success: false });
		console.log(err.stack);
	}
});

// @desc    Login user
// @route   POST /api/v1/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
	const { email, password } = req.body;

	// Validate email & password
	if (!email || !password) {
		return res.status(400).json({ success: false, msg: "Please provide an email and password" });
	}

	// Check for user
	const user = await User.findOne({ email }).select("+password");

	if (!user) {
		return res.status(400).json({ success: false, msg: "Invalid credentials" });
	}

	// Check if password matches
	const isMatch = await user.matchPassword(password);

	if (!isMatch) {
		return res.status(400).json({ success: false, msg: "Invalid credentials" });
	}

	// Create token

	// const token = user.getSignedJwtToken();
	// res.status(200).json({success: true, token});
	sendTokenResponse(user, 200, res);
});

// Get token from model, create cookie and send response
const sendTokenResponse = asyncHandler((user, statusCode, res) => {
	// Create token
	const token = user.getSignedJwtToken();

	const options = {
		expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
		httpOnly: true,
	};

	if (process.env.NODE_ENV === "production") {
		options.secure = true;
	}

	res.status(statusCode).cookie("token", token, options).json({
		success: true,
		token,
	});
});

//At the end of file
//@desc     Get current logged in user
//@route    GET /api/v1/auth/me
//@access   Private
const getMe = asyncHandler(async (req, res) => {
	const user = await User.findById(req.user.id);
	res.status(200).json({
		success: true,
		data: user,
	});
});

// @desc    Logout user (basic - client-side token removal)
// @route   GET /api/v1/auth/logout
// @access  Private (optional, depends on your implementation)
const logout = asyncHandler(async (req, res, next) => {
	// On the server-side, you might want to invalidate the token (more complex)
	// For a simple API, the client usually just removes the token.
	res.status(200).json({ success: true, msg: 'Logged out' });
  });

export { register, login, getMe , logout };
