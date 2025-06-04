const { awsRegion, awsAccessKey, awsSecretAccessKey} = require("../config/index");


const {SNSClient, PublishCommand} = require('@aws-sdk/client-sns');



async function sendSMS({ phoneNumber, message, senderID = 'flutter1' }) {
    const sns = new SNSClient({
        region: awsRegion,
        credentials: {
            accessKeyId: awsAccessKey,
            secretAccessKey: awsSecretAccessKey
        }
    });

    const params = {
        Message: message,
        PhoneNumber: phoneNumber,
        MessageAttributes: {
            'AWS.SNS.SMS.SenderID': {
                DataType: 'String',
                StringValue: senderID
            }
        }
    };

    try {
        const command = new PublishCommand(params);
        const result = await sns.send(command);
        return result;
    } catch (error) {
        console.error("SMS send failed:", error);
        throw error;
    }
}


module.exports = sendSMS