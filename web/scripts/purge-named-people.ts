/**
 * Remove named people from Arhat Register, Farmers, Buyers, and farmer product.
 * Usage: cd web && npx tsx scripts/purge-named-people.ts
 */
import { config } from 'dotenv'
config({ path: '.env' })

import { removePeopleFromShop } from '../src/server/services/register'
import { SHOP_PURGE_NAMES } from '../src/lib/shop-purge-names'
import { runWithWorkspace } from '../src/server/workspace'

const names = process.argv.slice(2).length ? process.argv.slice(2) : SHOP_PURGE_NAMES

async function main() {
  for (const workspace of ['live', 'demo'] as const) {
    const result = await runWithWorkspace(workspace, () => removePeopleFromShop(names))
    console.log(workspace, names.join(', '), result)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
