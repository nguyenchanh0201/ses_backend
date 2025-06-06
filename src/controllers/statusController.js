const db = require('../models')


const statusController = {

    async addLabelToInbox(req, res) {
        try {
            const currentUserId = req.user.id;
            const { labelId, inboxId  } = req.body; // Lấy labelId từ request body

            if (!labelId) {
                return res.status(400).json({ message: 'labelId is required.' });
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


    // async 



}

module.exports = statusController; 