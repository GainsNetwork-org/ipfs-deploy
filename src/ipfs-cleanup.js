#!/usr/bin/env node

// @ts-nocheck

/* eslint-disable no-console */
"use strict";

import { MongoClient } from "mongodb";
import { create as ipfsHttp } from "ipfs-http-client";
import all from "it-all";

export async function cleanup(
  ipfsOptions,
  mongoUrl,
  dbName,
  collectionName,
  newCid,
  keepPins = 6, // 3 each mode
  feVersion,
  dappMode = "evm"
) {
  console.log(`Cleanup started, keeping the most recent ${keepPins} CIDs.`);
  // Connect to MongoDB
  const mongoClient = new MongoClient(mongoUrl);
  try {
    await mongoClient.connect();
    const collection = mongoClient.db(dbName).collection(collectionName);

    // Insert new CID
    await collection.insertOne({
      cid: newCid,
      timestamp: new Date(),
      packageVersion: feVersion,
      dapp: dappMode,
    });
    console.log(`Inserted CID: ${newCid}`);

    // Fetch most recent CIDs from MongoDB
    const recentCids = await collection
      .find()
      .sort({ timestamp: -1 })
      .limit(keepPins)
      .toArray();
    const keepCidsSet = new Set(recentCids.map((item) => item.cid));

    // Connect to IPFS and fetch all active pins
    const ipfs = ipfsHttp(ipfsOptions);
    const allPins = await all(ipfs.pin.ls({ type: "recursive" }));

    console.log(`Found ${allPins.length} active pins`);

    // Unpin CIDs that are not in the recent list
    const unpinPromises = allPins
      .filter((pin) => !keepCidsSet.has(pin.cid.toString()))
      .map((pin) =>
        ipfs.pin
          .rm(pin.cid)
          .then(() => console.log(`Unpinned: ${pin.cid}`))
          .catch((err) => console.error(err))
      );

    await Promise.all(unpinPromises);
    console.log(`Cleanup complete, kept the most recent ${keepPins} CIDs.`);
  } catch (e) {
    console.log("Error: ", e);
    process.exit(1);
  } finally {
    await mongoClient.close();
  }
}
