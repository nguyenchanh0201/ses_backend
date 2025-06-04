const jwt = require('jsonwebtoken');
const secret = require('../config/index').secret;

const authMiddleware = async (req, res, next) => {
    try {
        // Extract token from Authorization header
        const authorization = req.headers.authorization ? req.headers.authorization.split(" ") : [];
        const token = authorization.length > 1 ? authorization[1] : null;

        if (token) {
            // Verify the token
            const payload = jwt.verify(token, secret);

            if (payload) {
                req.user = {
                    id: payload.id,
                    phoneNumber: payload.phoneNumber,
                };
                return next(); // Proceed to the next middleware/route handler
            } else {
                // Unauthorized - invalid token
                return res.status(401).json({ error: "Unauthorized" });
            }
        } else {
            // Bad Request - token is missing
            return res.status(400).json({ error: "Token is required" });
        }
    } catch (err) {
        // Handle any errors that occur during token verification
        return res.status(401).json({ error: "Invalid token" });
    }

}

module.exports = authMiddleware