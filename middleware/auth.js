import jwt from "jsonwebtoken";
import User from "../models/User.js";
import asyncHandler from './async.js';
// Protect routes
const protect = asyncHandler(async (req, res, next) => {
	let token;

	if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
		token = req.headers.authorization.split(" ")[1];
	}

	// Make sure token exists
	if (!token) {
		return res.status(401).json({ success: false, message: "Not authorized to access this route" });
	}

	try {
		// Verify token
		const decoded = jwt.verify(token, process.env.JWT_SECRET);

		console.log(decoded);

		req.user = await User.findById(decoded.id);

		next();
	} catch (err) {
		console.log(err.stack);
		return res.status(401).json({ success: false, message: "Not authorized to access this route" });
	}
});

//at the end of file
//Grant access to specific roles
const authorize = (...roles) => {
	return (req, res, next) => {
		if (!roles.includes(req.user.role)) {
			return res
				.status(403)
				.json({ success: false, message: `User role ${req.user.role} is not authorized to access this route` });
		}
		next();
	};
};

export { protect, authorize };
