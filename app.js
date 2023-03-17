// external
const { Alchemy, Network, Contract } = require('alchemy-sdk');
const retry = require('async-retry');
const _ = require('lodash');
const { ethers } = require('ethers');
// local
const { markets } = require('./markets.js');
const { getSeaportSalePrice } = require('./utils.js');
const { currencies } = require('./currencies.js');
const { transferEventTypes, saleEventTypes } = require('./log_event_types.js');
const { tweet } = require('./tweet');
const { getTokenData } = require("./utils.gm");
const abi = require('./ERC721.json').abi;
const marketsAbi = require('./markets_abi.json');

const alchemy = new Alchemy({
  apiKey: process.env.ALCHEMY_API_KEY,
  network: process.env.NODE_ENV === "development" ? Network.ETH_GOERLI : Network.ETH_MAINNET
});

// sometimes monitoring events can return duplicate transactions in a split second, so...
let lastTransactionHash;

async function monitorContract() {
  const addressesString = process.env.CONTRACT_ADDRESSES;
  if (!addressesString) {
    console.error('No contract addresses specified');
    return;
  }

  const addresses = addressesString.split(',');

  const provider = await alchemy.config.getWebSocketProvider();
  const mktInterface = new ethers.utils.Interface(marketsAbi);

  // create a contract for each contract address
  const contracts = addresses.map(address => {
    return new Contract(address, abi, provider);
  });

  // setup listeners for each contract
  contracts.forEach((contract) => {

    const contractAddress = contract.address;
    console.log(`Subscribing to events for contract: ${contractAddress}`);

    contract.on('Transfer', async (...params) => {
      console.log("Handling Transfer event");
      const event = params[params.length - 1];
      const transactionHash = event.transactionHash.toLowerCase();

      // duplicate transaction - skip process
      if (transactionHash == lastTransactionHash) {
        return;
      }

      lastTransactionHash = transactionHash;

      // attempt to retrieve the receipt, sometimes not available straight away
      const receipt = await retry(
        async (bail) => {
          const rec = await alchemy.core.getTransactionReceipt(transactionHash);

          if (rec == null) {
            throw new Error('receipt not found, try again');
          }

          return rec;
        },
        {
          retries: 5,
        }
      );

      const recipient = receipt.to.toLowerCase();

      // not a marketplace transaction transfer, skip
      if (!(recipient in markets)) {
        console.log(`Recipient ${recipient} not in markets. Not a marketplace transaction transfer, skip`);
        return;
      }

      // retrieve market details
      const market = _.get(markets, recipient);

      // default to eth, see currencies.js for currently support currencies
      let currency = {
        name: 'ETH',
        decimals: 18,
        threshold: 1,
      };
      let tokens = [];
      let totalPrice = 0;

      for (let log of receipt.logs) {
        const logAddress = log.address.toLowerCase();

        // if non-ETH transaction
        if (logAddress in currencies) {
          currency = currencies[logAddress];
        }

        // token(s) part of the transaction
        if (log.data == '0x' && transferEventTypes.includes(log.topics[0])) {
          const tokenId = ethers.BigNumber.from(log.topics[3]).toString();

          tokens.push(tokenId);
        }

        // transaction log - decode log in correct format depending on market & retrieve price
        if (logAddress == recipient && saleEventTypes.includes(log.topics[0])) {
          // get the decoded data from the logs
          const decodedLogData = mktInterface.parseLog({
            data: log.data,
            topics: [...log.topics]
          })?.args;

          if (market?.name == 'Opensea ⚓️') {
            totalPrice += getSeaportSalePrice(decodedLogData, contractAddress);
          } else if (market.name == 'Blur 🟠') {
            totalPrice += Number(ethers.utils.formatUnits(
              decodedLogData.sell.price,
              currency.decimals
            ));
          } else if (market.name == 'X2Y2 ⭕️') {
            totalPrice += Number(ethers.utils.formatUnits(
              decodedLogData.amount,
              currency.decimals
            ));
          } else if (market.name == 'LooksRare 👀💎') {
            totalPrice += Number(ethers.utils.formatUnits(
              decodedLogData.price,
              currency.decimals
            ));
          }
        }
      }

      // remove any dupes
      tokens = _.uniq(tokens);

      // format price
      totalPrice = _.round(totalPrice, 2);

      // custom - don't post sales below a currencies manually set threshold
      // if (Number(totalPrice) < currency.threshold) {
      //     console.log(`Sale under ${currency.threshold}: Token ID: ${tokens[0]}, Price: ${totalPrice}, Market: ${market.name}`);

      //     return;
      // }

      // retrieve metadata for the first (or only) ERC-721 asset sold
      const tokenId = tokens[0];
      const tokenData = await getTokenData(tokenId, contractAddress);

      // if more than one asset sold, link directly to etherscan tx, otherwise the marketplace item
      if (tokens.length > 1) {
        tweet(
          `${tokenData.assetName} & other assets bought for ${totalPrice} ${currency.name} on ${
            market.name
          } https://etherscan.io/tx/${transactionHash}`,
          tokenData.assetName,
          tokenData.imageB64
        );
      } else {
        tweet(
          `${tokenData.assetName} bought for ${totalPrice} ${currency.name} on ${market.name} ${
            market.site
          }${contractAddress}/${tokenId}`,
          tokenData.assetName,
          tokenData.imageB64
        );
      }
    });

    // TODO: Subscribe to all events
    const onConnected = (subscriptionId) => {
      console.log("Subscribed: ", subscriptionId);
    };

    const onChanged = (event) => {
      console.log('change');
      console.log(event);
    };

    const onError = (error, receipt) => {
      // if the transaction was rejected by the network with a receipt, the second parameter will be the receipt.
      console.error(error);
      console.error(receipt);
    }
  });
}


// initate websocket connection
monitorContract();
