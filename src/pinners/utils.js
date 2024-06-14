'use strict'

import FormData from 'form-data'
import path from 'path'
import { globSource } from 'ipfs-http-client'


/**
 * @param {string} dir
 * @param {boolean} hidden
 * @returns {Promise<FormData>}
 */
export async function getDirFormData (dir, hidden) {
  const data = new FormData()

  for await (const file of globSource(dir, { recursive: true, hidden })) {
    // @ts-ignore
    if (file.content) {
      // @ts-ignore
      data.append('file', file.content, {
        filepath: path.normalize(file.path)
      })
    }
  }

  return data
}
