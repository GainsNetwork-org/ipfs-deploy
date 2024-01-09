#!/usr/bin/env node

// @ts-nocheck

/* eslint-disable no-console */
'use strict'

const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
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

const argv = yargs(hideBin(process.argv))
  .scriptName('ipfs-cleanup')
  .usage(
    '$0 [options]',
    'Cleanup IPFS pins by keeping the most recent CIDs and unpinning the others.',
    yargs => {
      yargs
        .options({
          'mongo-url': {
            describe: 'MongoDB connection URL',
            demandOption: true,
            type: 'string'
          },
          'db-name': {
            describe: 'MongoDB database name',
            demandOption: true,
            type: 'string'
          },
          'collection-name': {
            describe: 'MongoDB collection name',
            demandOption: true,
            type: 'string'
          },
          'ipfs-options': {
            describe: 'IPFS HTTP client options as a JSON string',
            demandOption: true,
            type: 'string',
            coerce: JSON.parse
          },
          'new-cid': {
            describe: 'New CID to insert and keep during cleanup',
            demandOption: true,
            type: 'string'
          },
          'keep-pins': {
            describe: 'Number of CIDs to keep during cleanup',
            demandOption: false,
            type: 'number',
            default: 5
          }
        })
        .help()
        .alias('h', 'help')
    }
  )
  .argv

async function main () {
  try {
    await cleanup(argv['ipfs-options'], argv['mongo-url'], argv['db-name'], argv['collection-name'], argv['new-cid'], argv['keep-pins'])
  } catch (e) {
    console.error('❌  An error has occurred:\n')
    console.error(e.stack || e.toString())
    process.exit(1)
  }
}

main()
