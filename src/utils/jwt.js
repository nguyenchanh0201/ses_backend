const jwt = require('jsonwebtoken');
const { secret } = require('../config/index')


const generateToken = (user) => {
    const token = jwt.sign(
        {
            id: user.id,
            phoneNumber: user.phoneNumber

        },
        secret,
        { expiresIn: "7d" }
    )
    return token;
}



module.exports = generateToken;