const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { awsRegion, awsAccessKey, awsSecretAccessKey, awsBucketName, cdnUrl } = require('../config/index');

// Setup S3 client
const s3Client = new S3Client({
  region: awsRegion,
  credentials: {
    accessKeyId: awsAccessKey,
    secretAccessKey: awsSecretAccessKey
  }
});



// Function to upload file to S3
const uploadFileToS3 = async (file, fileUUID) => {
  const Key = `${fileUUID}/${file.originalname}`; // Using UUID as the folder name

  const params = {
    Bucket: awsBucketName,
    Body: file.buffer,
    Key,
    ContentType: file.mimetype,
  };

  const command = new PutObjectCommand(params);

  try {
    await s3Client.send(command);
    const fileUrl = `${cdnUrl}/${fileUUID}/${encodeURIComponent(file.originalname)}`;
    return {
      fileName: file.originalname,
      fileUrl,
      fileSize: file.size,
      fileType: file.mimetype,
      uploadedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error("S3 Upload error:", err);
    throw err;
  }
};

module.exports = {uploadFileToS3}