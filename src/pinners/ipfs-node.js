'use strict'

import { create as ipfsHttp, globSource } from 'ipfs-http-client'
import all from 'it-all'
import path from 'path'


/**
 * @typedef {import('ipfs-http-client').Options} IpfsOptions
 * @typedef {import('./types').PinDirOptions} PinDirOptions
 */

export class IpfsNode {
  /**
   * @param {IpfsOptions} options
   */
  constructor (options) {
    this.ipfs = ipfsHttp(options)
  }

  /**
   * @param {string} dir
   * @param {PinDirOptions|undefined} options
   * @returns {Promise<string>}
   */
  async pinDir (dir, { tag, hidden = false } = {}) {
    // @ts-ignore
    const response = await all(this.ipfs.addAll(globSource(dir, "**/*", { recursive: true, hidden }), { wrapWithDirectory: true}))
    const basename = path.basename(dir)
    console.error(response, path, basename);
    const root = response.find(({ path }) => path === basename)

    if (!root) {
      throw new Error('could not determine the CID')
    }

    return root.cid.toString()
  }

  /**
   * @param {string} cid
   * @param {string|undefined} tag
   * @returns {Promise<void>}
   */
  async pinCid (cid, tag) {
    await this.ipfs.pin.add(cid)
  }

  /**
   * @param {string} cid
   * @returns string
   */
  gatewayUrl (cid) {
    return `https://ipfs.io/ipfs/${cid}`
  }

  static get displayName () {
    return 'IPFS Node'
  }

  get displayName () {
    return IpfsNode.displayName
  }

  static get slug () {
    return 'ipfs-node'
  }
}
