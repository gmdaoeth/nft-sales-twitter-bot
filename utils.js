const axios = require('axios');

const fetchBase64Image = async (imageUrl) => {
  const image = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  return Buffer.from(image.data, 'binary').toString('base64');
}

module.exports = {
  fetchBase64Image
};
