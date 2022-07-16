const twit = require('twit');

const twitterConfig = {
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    access_token: process.env.ACCESS_TOKEN_KEY,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET,
};

const twitterClient = new twit(twitterConfig);

// Tweet a text-based status
async function tweet(tweetText, assetName, imageB64) {

  // no image, just tweet the text
  if (!imageB64) {
    const params = { status: tweetText }

    twitterClient.post('statuses/update', params, function (err, data, response) {
      if (err) {
        console.error("Failed to tweet new status");
        console.error(err)
        return;
      }

      console.log(`Successfully tweeted: ${tweetText}`);
    });
    return;
  }

    // first we must post the media to Twitter
    twitterClient.post('media/upload', { media_data: imageB64 }, function (err, data, response) {
      if (err) {
        console.error("Failed to upload Token image");
        console.error(err)
        return;
      }

      // now we can assign alt text to the media, for use by screen readers and
      // other text-based presentations and interpreters
      const mediaIdStr = data.media_id_string
      const meta_params = { media_id: mediaIdStr, alt_text: { text: assetName } }

      twitterClient.post('media/metadata/create', meta_params, function (err, data, response) {
        if (err) {
          console.error("Failed to create metadata for uploaded image");
          console.error(err)
          return;
        }

        // now we can reference the media and post a tweet (media will attach to the tweet)
        const params = { status: tweetText, media_ids: [mediaIdStr] }

        twitterClient.post('statuses/update', params, function (err, data, response) {
          if (err) {
            console.error("Failed to tweet new status");
            console.error(err)
            return;
          }

          console.log(`Successfully tweeted: ${tweetText}`);
        });
      })
    });
}


module.exports = {
    tweet: tweet,
};
