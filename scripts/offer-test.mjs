// Boundary test for the free-delivery offer rule.
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
register('./scripts/ts-resolve-hooks.mjs', pathToFileURL('./'));

const { deliveryCostFor, qualifiesForFreeDelivery, FREE_DELIVERY_MIN_ITEMS, DELIVERY_BASE_COST } =
  await import('../lib/store-config.ts');

let fails = 0;
function check(name, cond, got) {
  if (!cond) fails++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : `  -> got ${got}`}`);
}

check('min items is 3', FREE_DELIVERY_MIN_ITEMS === 3, FREE_DELIVERY_MIN_ITEMS);
check('base cost is 280', DELIVERY_BASE_COST === 280, DELIVERY_BASE_COST);

// Below threshold -> base cost
check('0 items => base cost', deliveryCostFor(0) === 280, deliveryCostFor(0));
check('1 item  => base cost', deliveryCostFor(1) === 280, deliveryCostFor(1));
check('2 items => base cost', deliveryCostFor(2) === 280, deliveryCostFor(2));

// At/above threshold -> free
check('3 items => FREE (0)', deliveryCostFor(3) === 0, deliveryCostFor(3));
check('4 items => FREE (0)', deliveryCostFor(4) === 0, deliveryCostFor(4));
check('99 items => FREE (0)', deliveryCostFor(99) === 0, deliveryCostFor(99));

// qualifies flag agrees
check('qualifies false at 2', qualifiesForFreeDelivery(2) === false, qualifiesForFreeDelivery(2));
check('qualifies true at 3', qualifiesForFreeDelivery(3) === true, qualifiesForFreeDelivery(3));

// Robustness: NaN / undefined / negative never grant free delivery
check('NaN => base cost', deliveryCostFor(NaN) === 280, deliveryCostFor(NaN));
check('undefined => base cost', deliveryCostFor(undefined) === 280, deliveryCostFor(undefined));
check('negative => base cost', deliveryCostFor(-5) === 280, deliveryCostFor(-5));

// Total math sanity: subtotal 900 + free shipping = 900 at 3 items
const subtotal = 900;
check('3x Rs300 => total is subtotal (no shipping)', subtotal + deliveryCostFor(3) === 900, subtotal + deliveryCostFor(3));
check('2x Rs300 => total adds Rs280 shipping', subtotal + deliveryCostFor(2) === 1180, subtotal + deliveryCostFor(2));

console.log(fails === 0 ? '\nALL OFFER-RULE CHECKS PASSED' : `\n${fails} CHECK(S) FAILED`);
process.exit(fails === 0 ? 0 : 1);
