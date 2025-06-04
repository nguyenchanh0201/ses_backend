const db = require('../models');
const sendSMS = require('../utils/sendSMS');
const generateCode = require('../utils/generateCode');
const { hashPwd } = require('../utils/hashPassword');
const comparePassword = require('../utils/comparePassword');
const generateToken = require('../utils/jwt');

const AuthController = {


    async signIn(req, res) {
        try {
            const { phoneNumber, password } = req.body;

            // Tìm người dùng trong cơ sở dữ liệu
            const existingUser = await db.User.findOne({ where: { phoneNumber: phoneNumber } });
            if (!existingUser) {
                return res.status(400).json({ message: 'User does not exist' });
            }

            // Kiểm tra người dùng đã được xác thực hay chưa
            if (!existingUser.isVerified) {
                return res.status(400).json({ message: 'User not verified yet' });
            }

            // Kiểm tra mật khẩu
            const isMatch = await comparePassword(password, existingUser.password);
            if (!isMatch) {
                return res.status(400).json({ message: 'Invalid credentials' });
            }

            // Xử lý OTP nếu 2FA được bật
            if (existingUser.is2FA) {
                const otpCode = generateCode(6);  // Tạo mã OTP 6 chữ số

                // Gửi OTP qua SMS
                const smsResult = await sendSMS({
                    phoneNumber: existingUser.phoneNumber,
                    message: `Here is your OTP for login: ${otpCode}`,
                });

                if (!smsResult) {
                    return res.status(500).json({ message: 'Unable to send OTP, please try again' });
                }



                // Bạn có thể lưu OTP trong cơ sở dữ liệu hoặc bộ nhớ tạm
                // Đảm bảo rằng OTP sẽ hết hạn sau một khoảng thời gian nhất định (ví dụ 5 phút)
                // và so sánh OTP khi người dùng nhập lại
                // Ví dụ: await saveOTP(existingUser.id, otpCode);
            }

            // Tạo và trả về token JWT
            const token = generateToken(existingUser);

            return res.status(200).json({ message: 'Login successful', token });

        } catch (err) {
            console.error(err);
            // Đảm bảo chỉ trả về một phản hồi duy nhất
            if (!res.headersSent) {
                return res.status(500).json({ message: 'Error while logging in' });
            }
        }
    },


    async signUp(req, res) {
        try {
            const { phoneNumber, password, name, dOfB } = req.body;

            // Kiểm tra user đã tồn tại
            const existingUser = await db.User.findOne({ where: { phoneNumber: phoneNumber } });
            if (existingUser) {
                return res.status(400).json({ message: 'Số điện thoại đã được sử dụng' });
            }

            // Sinh mã OTP 6 chữ số
            const otpCode = generateCode(6);

            const pwdHashed = await hashPwd(password);
            console.log(pwdHashed)

            // Tạo user tạm với OTP (chưa xác thực)
            const newUser = await db.User.create({
                name: name,
                phoneNumber: phoneNumber,
                password: pwdHashed,
                otpNumber: otpCode,
                dOfB: new Date(dOfB)
                // dùng để xác nhận sau khi verify OTP
            });

            // Gửi OTP qua SMS
            const smsResult = await sendSMS({
                phoneNumber,
                message: `Here is your OTP for sign up: ${otpCode}`,
            });

            if (!smsResult) {
                return res.status(500).json({ message: 'Không thể gửi OTP, vui lòng thử lại' });
            }

            return res.status(200).json({
                message: 'Đã gửi mã OTP đến số điện thoại',
                userId: newUser.id, // để dùng xác nhận sau
            });
        } catch (err) {
            console.error('Sign up error:', err);
            res.status(500).json({ message: 'Lỗi khi đăng ký người dùng' });
        }
    },


    async checkOTP(req, res) {
        try {
            const { otp, phoneNumber } = req.body;

            // Tìm người dùng trong cơ sở dữ liệu
            const user = await db.User.findOne({ where: { phoneNumber: phoneNumber } });

            // Kiểm tra xem người dùng có tồn tại hay không
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            // Kiểm tra OTP
            if (user.otpNumber !== otp) {
                return res.status(400).json({ message: "Invalid OTP" });
            }

            // Cập nhật trạng thái người dùng sau khi xác thực OTP
            user.otpNumber = null;  // Xóa mã OTP sau khi xác thực
            user.isVerified = true;  // Đánh dấu người dùng đã xác thực

            // Lưu lại thay đổi vào cơ sở dữ liệu
            await user.save();

            // Trả về phản hồi thành công
            return res.status(200).json({ message: "OTP verified successfully" });

        } catch (err) {
            console.log(err);
            return res.status(500).json({ message: 'Error verifying OTP' });
        }
    },



    async requestforgotPassword(req, res) {
        //Gửi request quên mật khẩu

        try {
            const { phoneNumber } = req.body;

            const user = await db.User.findOne({
                where: { phoneNumber: phoneNumber }
            })

            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            //Tìm được
            user.isVerified = false;

            //Generate OTP code 
            user.otpNumber = generateCode(6);

            const status = await user.save();

            if (!status) {
                return res.status(500).json({ message: "Error saving user" })
            }

            // const smsResult = await sendSMS({
            //     phoneNumber,
            //     message: `Here is your OTP for reset password: ${otpCode}`,
            // });

            // if (!smsResult) {
            //     return res.status(500).json({ message: 'Không thể gửi OTP, vui lòng thử lại' });
            // }

            return res.status(200).json({message : "Sent reset OTP success"})

        } catch (err) {
            console.log(err);
            return res.status(500).json({ message: "Error request forgoting password" });
        }
        




    },

};



module.exports = AuthController; 