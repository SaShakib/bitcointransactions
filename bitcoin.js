const https = require("https");

const RPC_HOST = "bold-aged-spring.btc.quiknode.pro";
const RPC_PATH = "/d7976324e8b8030d07e84a05db8fecb73bca6ce5/";

// Simple RPC wrapper
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

  while (blockHash) {
    const block = await rpcCall("getblock", [blockHash, 2]); // verbosity=2 for tx details
    if (block.time < cutoff) break;

    for (const tx of block.tx) {
      // skip coinbase (first tx in block)
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

  // sort by value, descending
  txs.sort((a, b) => b.value - a.value);

  return txs.slice(0, 10);
}

// Run
getLastHourTopTxs()
  .then((topTxs) => {
    console.log("Top 10 transactions in last hour:");
    console.table(topTxs);
  })
  .catch(console.error);