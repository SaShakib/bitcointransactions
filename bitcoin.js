const https = require("https");
const fs = require("fs");

/**
 * detailed breakthough,,, using rpc call method getbestblockhash i am getting first hash of the blockchain.
 * then from each hash i am getting transaction using getblock using params blockhash and 2 for transaction informations. 
 * then filtering out the coinbase we are taking real transactions. and adding them together. each block
 * contains some transactions we are adding them. getting the hash 
 * and update the blockhash to move backward 
 * but when time is less cutoff we break the cycle
 * 
 * 
 * so basically we are starting from latest time and ending it in 1 hour timeframe. 
 * 
 * sort the transactions and take first 10. 
 * 
 */



const RPC_HOST = "bold-aged-spring.btc.quiknode.pro";
const RPC_PATH = "/d7976324e8b8030d07e84a05db8fecb73bca6ce5/";


function rpcCall(method, params = []) {
  const data = JSON.stringify({
    method,
    params,
    id: 1,
    jsonrpc: "2.0",
  });

  const options = {
    hostname: RPC_HOST,
    path: RPC_PATH,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": data.length,
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let result = "";
      res.on("data", (chunk) => (result += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(result);
          resolve(parsed.result);
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function getLastHourTopTxs() {
  const cutoff = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
  let blockHash = await rpcCall("getbestblockhash");
  let txs = [];
  console.log(blockHash);


  while (blockHash) {
    const block = await rpcCall("getblock", [blockHash, 2]);
    if (block.time < cutoff) break;

    for (const tx of block.tx) {
      
      if (tx.vin.some((vin) => vin.coinbase)) continue;

      const totalOut = tx.vout.reduce((sum, v) => sum + (v.value || 0), 0);
      txs.push({
        txid: tx.txid,
        blockhash: block.hash,
        time: block.time,
        value: totalOut,
      });

      
    }

    blockHash = block.previousblockhash;
  }

  txs.sort((a, b) => b.value - a.value);

  return txs.slice(0, 10);
  
}

// Run
getLastHourTopTxs()
  .then((topTxs) => {
    console.log("Top 10 transactions in last hour:");
    console.table(topTxs);

    const header = "txid,blockhash,time,value\n";
    const rows = topTxs.map(t => `${t.txid},${t.blockhash},${t.time},${t.value}`).join("\n");
    fs.writeFileSync("top10_transactions.csv", header + rows, "utf8");
  })
  .catch(console.error);