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


                existingUser.otpNumber = otpCode;
                await existingUser.save()

                // Gửi OTP qua SMS
                const smsResult = await sendSMS({
                    phoneNumber: existingUser.phoneNumber,
                    message: `Here is your OTP for login: ${otpCode}`,
                });

                if (!smsResult) {
                    return res.status(500).json({ message: 'Unable to send OTP, please try again' });
                }

                return res.status(200).json({ message: 'OTP sent successfully. Please enter the OTP to complete the login.' });

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
            const { phoneNumber, password, name, dOfB, gender } = req.body;

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
                dOfB: new Date(dOfB),
                gender : gender 
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

            // Nếu người dùng đã xác thực rồi, kiểm tra 2FA
            console.log(user.isVerified)
            if (user.isVerified) {
                // Nếu người dùng đã bật 2FA
                if (user.is2FA) {
                    // So sánh mã OTP
                    if (user.otpNumber !== otp) {
                        return res.status(400).json({ message: "Invalid OTP" });
                    }

                    // Nếu OTP đúng, xóa OTP và trả về token JWT
                    user.otpNumber = null;  // Xóa OTP
                    await user.save();

                    // Tạo và trả về token JWT
                    const token = generateToken(user);  // Hàm này sẽ tạo token cho người dùng
                    return res.status(200).json({ message: "OTP verified successfully", token });
                }
                //else if check có request password không ? => gửi kèm token
                 else {
                    // Nếu không có 2FA, chỉ cần trả về thông báo thành công
                    return res.status(400).json({ message: "User already verified, no 2FA required" });
                }
            } else {
                // Nếu người dùng chưa xác thực
                // Kiểm tra OTP
                if (user.otpNumber !== otp) {
                    return res.status(400).json({ message: "Invalid OTP" });
                }

                // Nếu OTP đúng, set isVerified và xóa OTP
                user.otpNumber = null;
                user.isVerified = true;  // Xác thực người dùng
                await user.save();

                // Trả về thông báo thành công
                return res.status(200).json({ message: "OTP verified successfully" });
            }
        } catch (err) {
            console.log(err);
            return res.status(500).json({ message: 'Error verifying OTP' });
        }
    },


    async resendOTP(req, res) {
        try {
            const { phoneNumber, type } = req.body;

            // Kiểm tra nếu type là valid
            if (type !== 'verify' && type !== 'signin' && type != 'forgot') {
                return res.status(400).json({ message: 'Invalid type' });
            }

            // Tìm người dùng trong cơ sở dữ liệu
            const user = await db.User.findOne({ where: { phoneNumber: phoneNumber } });

            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            // Kiểm tra xem người dùng có xác thực hay chưa
            if (!user.isVerified && type === 'signin') {
                return res.status(400).json({ message: "User is not verified yet" });
            }

            // Tạo mã OTP mới
            const otpCode = generateCode(6);  // Tạo mã OTP 6 chữ số

            // Lưu mã OTP mới vào cơ sở dữ liệu
            user.otpNumber = otpCode;
            await user.save();

            // Xác định nội dung tin nhắn dựa trên type
            let message;
            if (type === 'verify') {
                message = `Here is your OTP to verify: ${otpCode}`;
            } else if (type === 'signin') {
                message = `Here is your OTP for login: ${otpCode}`;
            } else if (type === 'forgot') {
                message = `Here is your OTP for reset password: ${otpCode}`;
            }

            // Gửi OTP qua SMS
            const smsResult = await sendSMS({
                phoneNumber: user.phoneNumber,
                message: message,
            });

            if (!smsResult) {
                return res.status(500).json({ message: 'Unable to send OTP, please try again' });
            }

            return res.status(200).json({ message: "OTP resent successfully" });

        } catch (err) {
            console.log(err);
            return res.status(500).json({ message: 'Error resending OTP' });
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
            user.isVerified = false ;
            
            const otpCode = generateCode(6)
            //Generate OTP code 
            user.otpNumber = otpCode;

            const status = await user.save();

            if (!status) {
                return res.status(500).json({ message: "Error saving user" })
            }

            const smsResult = await sendSMS({
                phoneNumber,
                message: `Here is your OTP for reset password: ${otpCode}`,
            });

            if (!smsResult) {
                return res.status(500).json({ message: 'Không thể gửi OTP, vui lòng thử lại' });
            }

            return res.status(200).json({ message: "Sent reset OTP success" })

        } catch (err) {
            console.log(err);
            return res.status(500).json({ message: "Error request forgoting password" });
        }





    },

    async resetPassword(req, res) {
        try {
            const {phoneNumber , newPassword} = req.body ; 

            const user = await db.User.findOne({
                where : {
                    phoneNumber : phoneNumber
                }
            });

            if (!user) {
                return res.status(404).json({message : "User not found"})
            }

            user.password = await hashPwd(newPassword);
            await user.save();

            return res.status(200).json({message : "Reset password success"});


        } catch(err) {
            console.log(err);
            return res.status(500).json({message : "Error reset password"})
        }
    }

};



module.exports = AuthController; 