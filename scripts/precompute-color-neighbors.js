#!/usr/bin/env node
// Precomputes 10 nearest perceptual neighbors for each color and writes them
// back into src/data/colors.js as a `neighbors` field on each entry.
// Run: node scripts/precompute-color-neighbors.js

import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const colorsPath = resolve(__dirname, '../src/data/colors.js')

// Load the file and eval the array
const src = readFileSync(colorsPath, 'utf8')
// Extract the array literal by stripping the export
const arrayMatch = src.match(/export const colors = (\[[\s\S]*\]);?\s*$/)
if (!arrayMatch) { console.error('Could not parse colors.js'); process.exit(1) }
const colors = eval(arrayMatch[1]) // safe — it's our own static file

function colorDist(a, b) {
  const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b
  return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db)
}

const withNeighbors = colors.map((c, i) => {
  const neighbors = colors
    .map((other, j) => ({ j, dist: colorDist(c, other) }))
    .filter(x => x.j !== i)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 10)
    .map(x => x.j)
  return { ...c, neighbors }
})

// Serialise back — preserve comments by only replacing the array content
const newArray = JSON.stringify(withNeighbors, null, 2)
  .replace(/"neighbors": \[/g, 'neighbors: [')
  .replace(/"(\w+)":/g, '$1:')   // unquote keys
  .replace(/,\n(\s+)\}/g, '\n$1}') // trailing comma cleanup (optional)

const output = `export const colors = ${newArray}\n`
writeFileSync(colorsPath, output)
console.log(`✓ Wrote ${withNeighbors.length} colors with precomputed neighbors to colors.js`)
