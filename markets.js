const openSeaMarket = {
    'name': 'OpenSea 🌊',
    'site': 'https://opensea.io/assets/',
    'logDecoder': [{
        type: 'bytes32',
        name: 'buyHash'
    }, {
        type: 'bytes32',
        name: 'sellHash',
    },{
        type: 'uint256',
        name: 'price',
    }]
};

const markets = {
    // OpenSea Contract Address
    '0x7be8076f4ea4a4ad08075c2508e481d6c946d12b': openSeaMarket, // old contract address
    '0x7f268357a8c2552623316e2562d90e642bb538e5': openSeaMarket, // new contract address
    // LooksRareExchange Contract Address
    '0x59728544b08ab483533076417fbbb2fd0b17ce3a': {
        'name': 'LooksRare 👀💎',
        'site': 'https://looksrare.org/collections/',
        'logDecoder': [{
            type: 'bytes32',
            name: 'orderHash'
        }, {
            type: 'uint256',
            name: 'orderNonce',
        },{
            type: 'address',
            name: 'currency',
        },{
            type: 'address',
            name: 'collection',
        },{
            type: 'uint256',
            name: 'tokenId',
        },{
            type: 'uint256',
            name: 'amount',
        },{
            type: 'uint256',
            name: 'price',
        }]
    }
};

const rinkebyMarkets = {
    // OpenSea Contract Address
    '0x00000000006c3852cbef3e08e8df289169ede581' : {
        'name': 'OpenSea 🌊',
        'site': 'https://testnets.opensea.io/assets/',
        'logDecoder': [{
            type: 'bytes32',
            name: 'buyHash'
        }, {
            type: 'bytes32',
            name: 'sellHash',
        },{
            type: 'uint256',
            name: 'price',
        }]
    },
    // LooksRareExchange Contract Address
    'TODO' : {
        'name': 'LooksRare 👀💎',
        'site': 'https://looksrare.org/collections/',
        'logDecoder': [{
            type: 'bytes32',
            name: 'orderHash'
        }, {
            type: 'uint256',
            name: 'orderNonce',
        },{
            type: 'address',
            name: 'currency',
        },{
            type: 'address',
            name: 'collection',
        },{
            type: 'uint256',
            name: 'tokenId',
        },{
            type: 'uint256',
            name: 'amount',
        },{
            type: 'uint256',
            name: 'price',
        }]
    }
}

module.exports = {
    markets: process.env.NODE_ENV === "development" ? rinkebyMarkets : markets
};
