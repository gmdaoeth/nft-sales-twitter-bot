// external
const { ethers, BigNumber} = require('ethers');
// local
const { currencies } = require('./currencies.js');

function _reducer(previous, current) {
  const currency = currencies[current.token.toLowerCase()];

  if (currency !== undefined) {
    return previous.add(current.amount);
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
    const totalConsiderationAmount = consideration.reduce(_reducer, BigNumber.from(0));
    const currency = currencies[consideration[0].token.toLowerCase()]; //assumes all consideration tokens are the same
    return ethers.utils.formatUnits(totalConsiderationAmount, currency.decimals);
  } else {
    const totalOfferAmount = offer.reduce(_reducer, BigNumber.from(0));
    const currency = currencies[offer[0].token.toLowerCase()]; //assumes all offer tokens are the same
    return ethers.utils.formatUnits(totalOfferAmount, currency.decimals);
  }
}

module.exports = {
  getSeaportSalePrice: getSeaportSalePrice,
};
