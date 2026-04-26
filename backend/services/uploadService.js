const configureCloudinary = require('../config/cloudinary');

async function uploadProductImage(file) {
  const cloudinary = configureCloudinary();
  if (!cloudinary) {
    return {
      url: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
      publicId: null
    };
  }

  const dataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: process.env.CLOUDINARY_FOLDER || 'sunny-furniture/products',
    resource_type: 'image'
  });
  return { url: result.secure_url, publicId: result.public_id };
}

module.exports = { uploadProductImage };
