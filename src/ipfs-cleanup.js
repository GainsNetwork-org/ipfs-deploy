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
  try {
    await mongoClient.connect()
    const collection = mongoClient.db(dbName).collection(collectionName)

    // // Insert new CID
    // await collection.insertOne({ cid: newCid, timestamp: new Date() })
    // console.log(`Inserted CID: ${newCid}`)

    // Fetch most recent CIDs from MongoDB
    const recentCids = await collection.find().sort({ timestamp: -1 }).limit(keepPins).toArray()
    const keepCidsSet = new Set(recentCids.map(item => item.cid))

    // Connect to IPFS and fetch all active pins
    const ipfs = ipfsHttp(ipfsOptions)
    const allPins = await all(ipfs.pin.ls({ type: 'recursive' }))

    console.log(`Found ${allPins.length} active pins`)
    console.log(`Keeping ${[...keepCidsSet]} CIDs`)

    // Unpin CIDs that are not in the recent list
    const unpinPromises = allPins
      .filter(pin => !keepCidsSet.has(pin.cid.toString()))
      .map(pin => ipfs.pin.rm(pin.cid).then(() => console.log(`Unpinned: ${pin.cid}`)).catch(err => console.error(err)))

    await Promise.all(unpinPromises)

    // Run GC
    await Promise.all([ipfs.repo.gc()])
    console.log(`Cleanup complete, kept the most recent ${keepPins} CIDs.`)
  } catch (e) {
    console.log('Error: ', e)
    process.exit(1)
  } finally {
    await mongoClient.close()
  }
}

exports.cleanup = cleanup
