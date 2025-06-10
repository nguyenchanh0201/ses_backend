const db = require('../models')


const statusController = {

    async addInboxToLabel(req, res) {
        try {
            const currentUserId = req.user.id;
            const { inboxId } = req.body;
            const { labelId } = req.params;

            if (!inboxId) {
                return res.status(400).json({ message: 'inboxId is required.' });
            }

            // BƯỚC 1 (MỚI): Xác thực labelId
            // Kiểm tra xem labelId có tồn tại và thuộc về người dùng này không.
            const userLabel = await db.UserLabel.findOne({
                where: {
                    id: labelId,
                    userId: currentUserId
                }
            });

            if (!userLabel) {
                // Nếu không tìm thấy, trả về lỗi 404 Not Found
                return res.status(404).json({ message: 'Label not found.' });
            }

            // BƯỚC 2: Tìm bản ghi status của user này trên inbox này (giữ nguyên)
            const inboxUserStatus = await db.InboxUserStatus.findOne({
                where: {
                    userId: currentUserId,
                    inboxId: inboxId
                }
            });

            if (!inboxUserStatus) {
                return res.status(404).json({ message: 'Inbox not found for this user.' });
            }

            // BƯỚC 3: Tạo bản ghi liên kết (giữ nguyên)
            await db.InboxUserStatusLabel.create({
                inboxUserStatusId: inboxUserStatus.id,
                userLabelId: labelId // Bây giờ chúng ta biết chắc labelId này là hợp lệ
            });

            res.status(200).json({ message: 'Label added successfully.' });

        } catch (err) {
            // Lỗi ở đây giờ chủ yếu sẽ là lỗi unique constraint (thêm nhãn đã tồn tại)
            // chứ không còn là lỗi foreign key nữa.
            if (err.name === 'SequelizeUniqueConstraintError') {
                return res.status(409).json({ message: 'Label has already been added to this inbox.' });
            }

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


            // BƯỚC 1 (MỚI): Xác thực labelId
            // Kiểm tra xem labelId có tồn tại và thuộc về người dùng này không.
            const userLabel = await db.UserLabel.findOne({
                where: {
                    id: labelId,
                    userId: currentUserId
                }
            });

            if (!userLabel) {
                // Nếu không tìm thấy, trả về lỗi 404 Not Found
                return res.status(404).json({ message: 'Label not found.' });
            }

            const inboxUserStatus = await db.InboxUserStatus.findOne({
                where: {
                    userId: currentUserId,
                    inboxId: inboxId
                }
            });

            
            if (!inboxUserStatus) {
                return res.status(404).json({ message: 'Inbox not found for this user.' });
            }

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