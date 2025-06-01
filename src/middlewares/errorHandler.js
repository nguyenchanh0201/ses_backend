const errorHandler = (err, req, res, next) => {
    const code = res.code  ? res.code : 500 ; 

    res.status(code).json({code, status:false , message : err.message , stack: err.stack}); 
}

module.exports = errorHandler ; 