// external
const { createAlchemyWeb3 } = require('@alch/alchemy-web3');
const axios = require('axios');
const { ethers } = require('ethers');
const retry = require('async-retry');
const _ = require('lodash');
// local
const { markets } = require('./markets.js');
const { currencies } = require('./currencies.js');
const { transferEventTypes, saleEventTypes } = require('./log_event_types.js');
const { tweet } = require('./tweet');
const abi = require('./ERC721.json').abi;
const { fetchBase64Image } = require("./utils");

// connect to Alchemy websocket
const web3 = createAlchemyWeb3(
  process.env.NODE_ENV === "development" ?
    `wss://eth-rinkeby.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}` :
    `wss://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`
);

// sometimes web3.js can return duplicate transactions in a split second, so
let lastTransactionHash;

async function monitorContract() {
  const addressesString = process.env.CONTRACT_ADDRESSES;
  if (!addressesString) {
    console.error('No contract addresses specified');
    return;
  }

  const addresses = addressesString.split(',');

  // create a contract for each contract address
  const contracts = addresses.map(address => {
    return new web3.eth.Contract(abi, address);
  });

  // setup listeners for each contract
  contracts.forEach((contract) => {
    const contractAddress = contract.options.address;
    console.log(`Subscribing to events for contract: ${contractAddress}`);

    contract.events
      .Transfer({})
      .on('connected', onConnected)
      .on('data', async (data) => {
        console.log("Handling Transfer event")
        const transactionHash = data.transactionHash.toLowerCase();

        // duplicate transaction - skip process
        if (transactionHash == lastTransactionHash) {
          return;
        }

        lastTransactionHash = transactionHash;

        // attempt to retrieve the receipt, sometimes not available straight away
        const receipt = await retry(
          async (bail) => {
            const rec = await web3.eth.getTransactionReceipt(transactionHash);

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

        if (!(recipient in markets)) {
          console.log("Not a marketplace transaction transfer, skip")
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
        let totalPrice;

        for (let log of receipt.logs) {
          const logAddress = log.address.toLowerCase();

          // if non-ETH transaction
          if (logAddress in currencies) {
            currency = currencies[logAddress];
          }

          // token(s) part of the transaction
          if (log.data == '0x' && transferEventTypes.includes(log.topics[0])) {
            const tokenId = web3.utils.hexToNumberString(log.topics[3]);

            tokens.push(tokenId);
          }

          // transaction log - decode log in correct format depending on market & retrieve price
          if (logAddress == recipient && saleEventTypes.includes(log.topics[0])) {
            const decodedLogData = web3.eth.abi.decodeLog(
              market.logDecoder,
              log.data,
              []
            );

            totalPrice = ethers.utils.formatUnits(
              decodedLogData.price,
              currency.decimals
            );
          }
        }

        // remove any dupes
        tokens = _.uniq(tokens);

        // custom - don't post sales below a currencies manually set threshold
        // if (Number(totalPrice) < currency.threshold) {
        //     console.log(`Sale under ${currency.threshold}: Token ID: ${tokens[0]}, Price: ${totalPrice}`);

        //     return;
        // }

        // retrieve metadata for the first (or only) ERC21 asset sold
        const tokenId = tokens[0];
        const tokenData = await getTokenData(tokenId, contractAddress);

        // if more than one asset sold, link directly to etherscan tx, otherwise the marketplace item
        if (tokens.length > 1) {
          tweet(
            `${_.get(
              tokenData,
              'assetName',
              `#` + tokenId
            )} & other assets bought for ${totalPrice} ${currency.name} on ${
              market.name
            } https://etherscan.io/tx/${transactionHash}`,
            tokenData.assetName,
            tokenData.imageB64
          );
        } else {
          tweet(
            `${_.get(
              tokenData,
              'assetName',
              `#` + tokenId
            )} bought for ${totalPrice} ${currency.name} on ${market.name} ${
              market.site
            }${contractAddress}/${tokenId}`,
            tokenData.assetName,
            tokenData.imageB64
          );
        }
      })
      .on('changed', onChanged)
      .on('error', onError);
  });
}

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

async function getTokenData(tokenId, contractAddress) {
  try {

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
    const imageB64 = await fetchBase64Image(imageUrl);

    // just the asset name for now, but retrieve whatever you need
    return {
      assetName: _.get(data, 'name'),
      imageB64,
    };
  } catch (error) {
    if (error.response) {
      console.log(error.response.data);
      console.log(error.response.status);
    } else {
      console.error(error.message);
    }
  }
}

// initate websocket connection
monitorContract();
