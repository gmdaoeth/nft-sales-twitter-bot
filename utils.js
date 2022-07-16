// external
const axios = require('axios');
const retry = require('async-retry');
const _ = require('lodash');
const { ethers } = require('ethers');
// local
const { currencies } = require('./currencies.js');

const fetchBase64Image = async (imageUrl) => {
  const image = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  return Buffer.from(image.data, 'binary').toString('base64');
}

function _reducer(previous, current) {
  const currency = currencies[current.token.toLowerCase()];

  if (currency !== undefined) {
    const result =
      previous +
      Number(ethers.utils.formatUnits(current.amount, currency.decimals));

    return result;
  } else {
    return previous;
  }
}

function getSeaportSalePrice(decodedLogData, contractAddress) {
  const offer = decodedLogData.offer;
  const consideration = decodedLogData.consideration;

  const offerSideNfts = offer.some(
    (item) =>
      item.token.toLowerCase() === contractAddress.toLowerCase()
  );

  // if nfts are on the offer side, then consideration is the total price, otherwise the offer is the total price
  if (offerSideNfts) {
    const totalConsiderationAmount = consideration.reduce(_reducer, 0);

    return totalConsiderationAmount;
  } else {
    const totalOfferAmount = offer.reduce(_reducer, 0);

    return totalOfferAmount;
  }
}

async function getTokenData(tokenId, contractAddress) {
  try {
    const assetData = await retry(
      async (bail) => {
        let response;

        // retrieve metadata for asset from opensea
        if (process.env.NODE_ENV === "development") {
          response = await axios.get(
            `https://testnets-api.opensea.io/api/v1/asset/${contractAddress}/${tokenId}`,
          )
        } else {
          response = await axios.get(
            `https://api.opensea.io/api/v1/asset/${contractAddress}/${tokenId}`,
            {
              headers: {
                'X-API-KEY': process.env.OPENSEA_API_KEY,
              },
            }
          )
        }

        const data = response.data;
        const imageUrl = _.get(data, 'image_url');

        let imageB64 = null;
        try {
          if (imageUrl) {
            imageB64 = await fetchBase64Image(imageUrl);
          } else {
            console.warn(`No image found for ${tokenId}`);
          }
        } catch (e) {
          console.error(`Error fetching image OS image_url, ${imageUrl}`);
          console.error(e);
        }

        return {
          assetName: _.get(data, 'name'),
          imageB64,
        };
      },
      {
        retries: 5,
      }
    );

    return assetData;
  } catch (error) {
    if (error.response) {
      console.log(error.response.data);
      console.log(error.response.status);
    } else {
      console.error(error.message);
    }
  }
}

module.exports = {
  getSeaportSalePrice: getSeaportSalePrice,
  getTokenData: getTokenData,
};
