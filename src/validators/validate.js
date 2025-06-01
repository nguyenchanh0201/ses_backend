const {validationResult} = require('express-validator'); 

const validate = (req, res, next) => {
    const errs = validationResult(req) ; 
    const mappedErrs = {}
    if (Object.keys(errs.errors).length === 0) {
        next();
    }
    else {
        errs.errors.map((err) => {
            mappedErrs[err.path] = err.msg ; 
        })
        res.status(400).json(mappedErrs);
    }
    
    
}

module.exports = validate ; 