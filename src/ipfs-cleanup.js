#!/usr/bin/env node

// @ts-nocheck

/* eslint-disable no-console */
'use strict'

const { MongoClient } = require('mongodb')
const { create: ipfsHttp } = require('ipfs-http-client')
const all = require('it-all')

async function cleanup (ipfsOptions, mongoUrl, dbName, collectionName, newCid, keepPins = 5) {
  console.log(`Cleanup started, keeping the most recent ${keepPins} CIDs.`)
  // Connect to MongoDB
  const mongoClient = new MongoClient(mongoUrl)
  await mongoClient.connect()
  const collection = mongoClient.db(dbName).collection(collectionName)

  // Insert new CID
  await collection.insertOne({ cid: newCid, timestamp: new Date() })
  console.log(`Inserted CID: ${newCid}`)

  // Fetch most recent 5 CIDs from MongoDB
  const recentCids = await collection.find().sort({ timestamp: -1 }).limit(keepPins).toArray()
  const keepCidsSet = new Set(recentCids.map(item => item.cid))

  // Connect to IPFS and fetch all active pins
  const ipfs = ipfsHttp(ipfsOptions)
  const allPins = await all(ipfs.pin.ls())

  // Unpin CIDs that are not in the recent list
  const unpinPromises = allPins
    .filter(pin => !keepCidsSet.has(pin.cid.toString()))
    .map(pin => ipfs.pin.rm(pin.cid).then(() => console.log(`Unpinned: ${pin.cid}`)))

  await Promise.all(unpinPromises)
  console.log(`Cleanup complete, kept the most recent ${keepPins} CIDs.`)
}

exports.cleanup = cleanup
