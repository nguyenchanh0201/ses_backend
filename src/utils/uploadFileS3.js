const { PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const { awsRegion, awsAccessKey, awsSecretAccessKey, awsBucketName, cdnBaseUrl } = require("../config/index");

const client = new S3Client({
  region: awsRegion,
  credentials: {
    accessKeyId: awsAccessKey,
    secretAccessKey: awsSecretAccessKey,
  },
});

/**
 * Upload file to S3 in folder by inboxId, preserving original filename
 * @param {Object} params
 * @param {Object} params.file - Multer file object (or equivalent)
 * @param {string} params.inboxId - UUID or unique identifier of inbox
 * @returns {string} - Public CDN URL of uploaded file
 */
const uploadFileToS3 = async ({ file, inboxId }) => {
  if (!file || !inboxId) throw new Error("Missing file or inboxId");

  const Key = `inboxes/${inboxId}/${file.originalname}`;

  const params = {
    Bucket: awsBucketName,
    Body: file.buffer,
    Key,
    ContentType: file.mimetype,
  };

  const command = new PutObjectCommand(params);

  try {
    await client.send(command);

    // Return public CDN URL
    return `${cdnBaseUrl}/inboxes/${inboxId}/${encodeURIComponent(file.originalname)}`;
  } catch (err) {
    console.error("S3 Upload error:", err);
    throw err;
  }
};

module.exports = { uploadFileToS3 };
