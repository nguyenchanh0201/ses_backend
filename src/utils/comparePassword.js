const bcrypt = require("bcryptjs"); 

const comparePassword = (password , hashPwd) => {
    return bcrypt.compare(password, hashPwd); 
}

module.exports = comparePassword