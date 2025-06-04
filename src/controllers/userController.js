const db = require('../models');
const comparePassword = require('../utils/comparePassword');
const { hashPwd } = require('../utils/hashPassword');



const UserController = {

    async getProfile(req, res) {

        try {

            const userId = req.user.id;

            const user = await db.User.findOne({
                where: { id: userId }
            })


            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            return res.status(200).json({ message: "User loaded", user: user });

        } catch (err) {
            console.log(err);
            return res.status(500).json({ message: "Error getting profile" })
        }




    },

    async updateProfile(req, res) {

    },

    async changePassword(req, res) {
        try {

            const userId = req.user.id ; 

            const {oldPassword, newPassword} = req.body ; 

            const user = await db.User.findOne({
                where : {id : userId}
            })

            if (!user) {
                return res.status(400).json({message : "User not found"})
            }

            if (!comparePassword(oldPassword, user.password)) {
                return res.status(400).json({message : "Old password is not correct"})
            }

            user.password = await hashPwd(newPassword);
            await user.save();

            return res.status(200).json({ message: "Password changed successfully" });


            
        } catch(err){
            console.log(err) ;
            return res.status(500).json({message : "Error changing password"})
        }

    }



}

module.exports = UserController 