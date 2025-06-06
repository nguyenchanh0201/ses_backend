
const db = require('../models');

const LabelController = {

    //CRUD label -> UserLabel db

    async createLabel(req, res) {
        try {
            const userId = req.user.id ; 
            const {labelName} = req.body ; 

            if (!Object.keys(labelName).length) {
                res.status(500).json({message : "Label can not be empty"})

            }



            const newLabel = db.UserLabel.create({
                userId : userId ,
                labelName : labelName
            })

            if (!newLabel) {
                res.status(500).json({message : "Error adding label"});
            }

            res.status(200).json({message : "Label created successfully"});


        } catch(err) {
            console.log(err);
            res.status(500).json({message : "Error creating label"});
        }
        



    },

    async getLabels(req, res) {
        try {
            const userId = req.user.id;

            const labels = await db.UserLabel.findAll({
                where: { userId: userId },
                order: [['labelName', 'ASC']] 
            });

            if (!labels) {
                return res.status(404).json({ message: "No labels found for this user." });
            }

            res.status(200).json({ labels });

        } catch (err) {
            console.error("Error fetching labels:", err);
            res.status(500).json({ message: "Error fetching labels from the server." });
        }
    },


    async deleteLabel(req, res) {
        try {
            const userId = req.user.id;
            const labelId = req.params.labelId; // Assuming ID is passed as a route parameter

            if (!labelId) {
                return res.status(400).json({ message: "Label ID is required." });
            }

            // Attempt to delete the label ensuring it belongs to the user
            const result = await db.UserLabel.destroy({
                where: {
                    id: labelId,
                    userId: userId
                }
            });

            if (result === 0) {
                // No rows deleted, meaning label not found or doesn't belong to user
                return res.status(404).json({ message: "Label not found or you don't have permission to delete it." });
            }

            res.status(200).json({ message: "Label deleted successfully." });

        } catch (err) {
            console.error("Error deleting label:", err);
            res.status(500).json({ message: "Error deleting label on the server." });
        }
    },

    async renameLabel(req, res) {
        try {
            const userId = req.user.id;
            const labelId = req.params.labelId; 
            const { newLabelName } = req.body;

            if (!labelId) {
                return res.status(400).json({ message: "Label ID is required." });
            }

            if (!newLabelName || typeof newLabelName !== 'string' || newLabelName.trim() === "") {
                return res.status(400).json({ message: "New label name cannot be empty and must be a string." });
            }

           
            const existingLabelWithNewName = await db.UserLabel.findOne({
                where: {
                    userId: userId,
                    labelName: newLabelName.trim(),
                    id: { [db.Sequelize.Op.ne]: labelId } 
                }
            });

            if (existingLabelWithNewName) {
                return res.status(409).json({ message: "Another label with this name already exists." });
            }

            // Attempt to update the label ensuring it belongs to the user
            const [numberOfAffectedRows, affectedRows] = await db.UserLabel.update(
                { labelName: newLabelName.trim() },
                {
                    where: {
                        id: labelId,
                        userId: userId
                    },
                    returning: true // Optional: if you want the updated record(s) back (ORM specific)
                }
            );

            if (numberOfAffectedRows === 0) {
                return res.status(404).json({ message: "Label not found or you don't have permission to rename it." });
            }
            
            // If your ORM supports returning the updated record(s) and you've enabled it:
            // const updatedLabel = affectedRows ? affectedRows[0] : null;
            // res.status(200).json({ message: "Label renamed successfully", label: updatedLabel });

            res.status(200).json({ message: "Label renamed successfully." });


        } catch (err) {
            console.error("Error renaming label:", err);
            if (err.name === 'SequelizeValidationError') {
                return res.status(400).json({ message: "Validation error", errors: err.errors.map(e => e.message) });
            }
            res.status(500).json({ message: "Error renaming label on the server." });
        }
    }




    //Push a label to inboxUserstatus -> InboxLabel db



    //Delete a label from inboxUserstatus -> InboxLabel db



    //Update inbox status 4




}





module.exports = LabelController