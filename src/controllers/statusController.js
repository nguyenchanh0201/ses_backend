const db = require('../models')


const statusController = {

    async addInboxToLabel(req, res) {
        try {
            const currentUserId = req.user.id;
            const { inboxId } = req.body; // Lấy labelId từ request body
            const { labelId } = req.params;

            if (!inboxId) {
                return res.status(400).json({ message: 'inboxId is required.' });
            }

            // Bước 1: Tìm bản ghi status của user này trên inbox này
            const inboxUserStatus = await db.InboxUserStatus.findOne({
                where: {
                    userId: currentUserId,
                    inboxId: inboxId
                }
            });

            if (!inboxUserStatus) {
                // Trường hợp người dùng không có quyền truy cập vào inbox này
                return res.status(404).json({ message: 'Inbox not found for this user.' });
            }
            await db.InboxUserStatusLabel.create({
                inboxUserStatusId: inboxUserStatus.id,
                userLabelId: labelId
            });

            res.status(200).json({ message: 'Label added successfully.' });

        } catch (err) {
            // Xử lý lỗi, ví dụ labelId không tồn tại hoặc đã được thêm rồi (unique constraint violation)
            console.error('Error adding label to inbox:', err);
            res.status(500).json({ message: 'Error adding label to inbox', error: err.message });
        }
    },


    async removeInboxFromLabel(req, res) {
        try {
            const currentUserId = req.user.id
            const { labelId } = req.params;
            const { inboxId } = req.body;

            if (!inboxId) {
                return res.status(400).json({ message: "Inbox Id is required" })
            }

            const inboxUserStatus = await db.InboxUserStatus.findOne({
                where: {
                    userId: currentUserId,
                    inboxId: inboxId
                }
            });

            const result = await db.InboxUserStatusLabel.destroy({
                where: {
                    inboxUserStatusId: inboxUserStatus.id,
                    userLabelId: labelId
                }
            });

            if (result === 0) {
                
                return res.status(404).json({ message: "Can not remove inbox from label" });
            }

            res.status(200).json({ message: "Remove inbox from label successfully." });


        } catch (err) {
            console.log(err);
            return res.status(500).json({ message: "Error removing inbox from label" });
        }
    }

    //Update status : isStarred, is



}

module.exports = statusController; 