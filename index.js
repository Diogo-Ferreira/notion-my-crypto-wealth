const { Client } = require('@notionhq/client');
const Coinbase = require('coinbase').Client;
const moment = require('moment');

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

const coinbaseClient = new Coinbase({ 'apiKey': process.env.COINBASE_API_KEY, 'apiSecret': process.env.COINBASE_API_SECRET, strictSSL: false });


const getPriceFor = async pair => new Promise((res, rej) => {
  coinbaseClient.getBuyPrice({ 'currencyPair': pair }, function (err, obj) {
    if (err || obj === null) {
      rej(err);
    }
    res(obj?.data.amount);
  });
})

const run = async () => {
  const holdingsDatabase = await notion.databases.query({ database_id: process.env.HOLDING_DATABASE_ID });

  let sumInChf = 0;

  holdingsDatabase.results.forEach(async row => {

    try {
      const currency = row.properties.Crypto.title[0]?.plain_text;

      if (!currency) return;

      const price = parseFloat(await getPriceFor(`${currency}-CHF`));

      const myAmount = parseFloat(row.properties.Amount?.number);
      if (Number.isFinite(myAmount)) {
        sumInChf += price * myAmount;
      }


      if (Number.isFinite(price)) {
        await notion.pages.update({
          page_id: row.id,
          properties: {
            CHF: price,
          }
        })
      }
    } catch (err) {
      console.error(err);
      throw err;
    }

  })

  const wealthDatabase = await notion.databases.query({ database_id: process.env.WEALTH_DATABASE_ID })

  const currentDate = moment().format('D-M-Y HH');

  const wealthResults = wealthDatabase.results;

  const isCurrentDateRecored = wealthResults.length > 0 && wealthResults.find(row => row.properties.Day?.title[0]?.text?.content === currentDate) !== undefined;

  if (!isCurrentDateRecored) {
    await notion.pages.create({
      parent: {
        database_id: '11c52c52f0df49e1a9b3188f15b4aa1d'
      },
      properties: {
        Day: {
          type: 'title',
          title: [{ "type": "text", "text": { "content": currentDate } }]
        },
        Total: {
          type: 'number',
          number: parseFloat(sumInChf.toFixed(2))
        }
      }
    })
  }
}


setInterval(run, 10 * 1500)