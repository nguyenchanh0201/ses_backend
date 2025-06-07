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
        try {
            const userId = req.user.id;
            const { update } = req.body;

            if (!update || typeof update !== 'object') {
                return res.status(400).json({ message: "No update data provided" });
            }

            // Tạo object chứa chỉ các field được truyền
            const updateData = {};
            const allowedFields = ['name', 'username', 'gender', 'imageUrl', 'dOfB'];

            allowedFields.forEach(field => {
                if (update.hasOwnProperty(field)) {
                    updateData[field] = update[field];
                }
            });

            if (Object.keys(updateData).length === 0) {
                return res.status(400).json({ message: "No valid fields provided for update" });
            }

            const [affectedRows, updatedUsers] = await db.User.update(
                updateData,
                {
                    where: { id: userId },
                    returning: true,
                    plain: true
                }
            );

            if (affectedRows === 0) {
                return res.status(404).json({ message: "User not found or no changes made" });
            }

            const updatedUser = updatedUsers.dataValues || updatedUsers;

            return res.status(200).json({
                message: "Profile updated successfully",
                user: updatedUser
            });

        } catch (err) {
            console.error(err);
            return res.status(500).json({ message: "Error updating profile" });
        }
    },



    async changePassword(req, res) {
        try {

            const userId = req.user.id;

            const { oldPassword, newPassword } = req.body;

            const user = await db.User.findOne({
                where: { id: userId }
            })

            if (!user) {
                return res.status(400).json({ message: "User not found" })
            }

            if (!comparePassword(oldPassword, user.password)) {
                return res.status(400).json({ message: "Old password is not correct" })
            }

            user.password = await hashPwd(newPassword);
            await user.save();

            return res.status(200).json({ message: "Password changed successfully" });



        } catch (err) {
            console.log(err);
            return res.status(500).json({ message: "Error changing password" })
        }

    },

    //Update autoReply
    async updateAutoReply(req, res) {
        try {
            const userId = req.user.id;
            const {
                autoReplySubject,
                autoReplyBody,
                isAutoReplyEnabled
            } = req.body;

            const currUser = await db.User.findOne({ where: { id: userId } });

            if (!currUser) {
                return res.status(404).json({ message: "User not found." });
            }

            // Chuẩn bị dữ liệu cập nhật chỉ gồm các trường hợp lệ
            const updateData = {};
            if (typeof isAutoReplyEnabled !== 'undefined') {
                updateData.isAutoReplyEnabled = isAutoReplyEnabled;
            }
            if (typeof autoReplySubject !== 'undefined') {
                updateData.autoReplySubject = autoReplySubject;
            }
            if (typeof autoReplyBody !== 'undefined') {
                updateData.autoReplyBody = autoReplyBody;
            }

            if (Object.keys(updateData).length === 0) {
                return res.status(400).json({ message: "No valid fields provided for update." });
            }

            // Cập nhật
            await currUser.update(updateData);

            // Trả về dữ liệu sau khi cập nhật
            return res.status(200).json({
                message: "Auto-reply settings updated successfully.",
                data: {
                    isAutoReplyEnabled: currUser.isAutoReplyEnabled,
                    autoReplySubject: currUser.autoReplySubject,
                    autoReplyBody: currUser.autoReplyBody
                }
            });

        } catch (err) {
            console.error(err);
            return res.status(500).json({ message: "Failed to update auto-reply settings." });
        }
    },


    async updateSettings(req, res) {
        try {
            const userId = req.user.id;
            const { settings } = req.body;

            if (!settings || typeof settings !== 'object') {
                return res.status(400).json({ message: "No settings provided" });
            }

            // Chỉ cập nhật các field hợp lệ (ở đây là is2FA)
            const updateData = {};
            if (typeof settings.is2FA !== 'undefined') {
                updateData.is2FA = settings.is2FA;
            }

            // Nếu không có gì để update
            if (Object.keys(updateData).length === 0) {
                return res.status(400).json({ message: "No valid settings provided" });
            }

            // Cập nhật người dùng
            const [affectedRows, updatedUsers] = await db.User.update(
                updateData,
                {
                    where: { id: userId },
                    returning: true,
                    plain: true
                }
            );

            if (affectedRows === 0) {
                return res.status(404).json({ message: "User not found or no changes made" });
            }

            const updatedUser = updatedUsers.dataValues || updatedUsers;

            return res.status(200).json({
                message: "Settings updated successfully",
                settings: {
                    is2FA: updatedUser.is2FA
                }
            });

        } catch (err) {
            console.error(err);
            return res.status(500).json({ message: "Error updating settings" });
        }
    },


    async getUserSettings(req, res) {
        try {
            const userId = req.user.id;

            const currUser = await db.User.findOne({
                where: { id: userId },
                attributes: [
                    'is2FA',
                    'isAutoReplyEnabled',
                    'autoReplySubject',
                    'autoReplyBody'
                ]
            });

            if (!currUser) {
                return res.status(404).json({ message: "User not found" });
            }

            return res.status(200).json({
                message: "Success",
                settings: currUser 
            });

        } catch (err) {
            console.error(err);
            return res.status(500).json({ message: "Error retrieving user settings" });
        }
    }
}

module.exports = UserController 