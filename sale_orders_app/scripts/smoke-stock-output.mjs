// Smoke — "From Stock" output flow (Omer, 2026-10-26): an output entry on
// a production-plan item may be fulfilled FROM existing stock instead of
// production. It completes the order line without production, never moves
// inventory stock, shows in Delivery with a FROM STOCK tag (only the
// entered quantity), and a claim guard stops two lines claiming the same
// physical stock twice.
// A: the REAL util (src/utils/stockOutput.js) — pools, claim availability,
//    the double-claim guard, the deliverable source split, print suffix.
// B: source contracts — AppContext skips stock mutation for stock-source
//    outputs at every site; BatchClosing wires the source choice + guard;
//    DelCreation splits the pool and tags; the challan prints the tag.
// (Behavioural E2E through the real AppContext functions — stock exactness
// on save / delete / delivery — is proven in the CDP harness run; see the
// job result file.)
import fs from 'fs';

const APP = '/home/hatch/workspace/erp/sale_orders_app';
const read = (p) => fs.readFileSync(p, 'utf8');
let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; console.log('  PASS', name); } else { fail++; console.log('  FAIL', name); } };

const {
  isStockOutput, outputSource, outputMovesStock,
  computeItemTypePools, getStockClaimAvailability, validateStockClaims,
  splitRemainingBySource, fromStockPrintSuffix, resolveFromStockDepartment,
} = await import(`${APP}/src/utils/stockOutput.js`);

// --- A1: source flags ------------------------------------------------------
check('production output moves stock', outputMovesStock({ source: 'production' }) === true);
check('legacy output (no source) moves stock', outputMovesStock({ typeName: 'A', quantity: 5 }) === true);
check('from-stock output never moves stock', outputMovesStock({ source: 'stock' }) === false);
check('isStockOutput detects the flag', isStockOutput({ source: 'stock' }) === true && isStockOutput({}) === false && isStockOutput(null) === false);
check('outputSource defaults to production', outputSource({}) === 'production' && outputSource({ source: 'stock' }) === 'stock');

// --- A2: pools + availability ----------------------------------------------
const TYPES_ITEM = {
  id: 'FG-201', sku: 'FG-201', name: '170 PK DTY BLACK (WHITE)',
  stock: 1300, stockByType: { A: 1200, B: 100 }, stockByDepartment: { Finishing: 1300 },
};
const baseState = () => ({
  items: [TYPES_ITEM],
  departments: [{ value: 'Production' }, { value: 'Raw Material' }, { value: 'Finishing' }],
  saleOrders: [
    { id: 'SO-1', items: [{ itemId: 'FG-201', itemCode: 'FG-201', lineCode: 'ITEM-001', quantity: 1000, producedQty: 1000, deliveredQty: 0 }] },
    { id: 'SO-2', items: [{ itemId: 'FG-201', itemCode: 'FG-201', lineCode: 'ITEM-002', quantity: 800, producedQty: 0, deliveredQty: 0 }] },
  ],
  productionPlans: [
    { id: 'PLN-1', status: 'In Process', department: 'Production', items: [
      { orderId: 'SO-1', itemCode: 'FG-201', lineCode: 'ITEM-001', outputs: [
        { typeName: 'A', quantity: 600, isDeliverable: true, source: 'production', department: 'Production' },
        { typeName: 'A', quantity: 400, isDeliverable: true, source: 'stock', department: 'Finishing' },
      ] },
    ] },
    { id: 'PLN-2', status: 'In Process', department: 'Production', items: [
      { orderId: 'SO-2', itemCode: 'FG-201', lineCode: 'ITEM-002', outputs: [] },
    ] },
  ],
  deliveries: [],
});

{
  const pools = computeItemTypePools(baseState(), TYPES_ITEM);
  check('pool A: produced = 600', pools.A.produced === 600);
  check('pool A: fromStock = 400', pools.A.fromStock === 400);
  check('pool A: delivered = 0', pools.A.delivered === 0);
  const avail = getStockClaimAvailability(baseState(), TYPES_ITEM);
  check('availability A = physical 1200 − pool 1000 = 200', avail.A.available === 200);
  check('availability B = physical 100 − pool 0 = 100', avail.B.available === 100);
  check('poolRemaining A = 1000', avail.A.poolRemaining === 1000);
}

// Cancelled plans, non-SO plan items and non-deliverable outputs never pool.
{
  const s = baseState();
  s.productionPlans.push({ id: 'PLN-X', status: 'Cancelled', items: [{ orderId: 'SO-2', itemCode: 'FG-201', lineCode: 'ITEM-002', outputs: [{ typeName: 'A', quantity: 500, isDeliverable: true, source: 'stock' }] }] });
  s.productionPlans.push({ id: 'PLN-Y', status: 'In Process', items: [{ orderId: '-', itemCode: 'FG-201', outputs: [{ typeName: 'A', quantity: 500, isDeliverable: true, source: 'stock' }] }] });
  s.productionPlans.push({ id: 'PLN-Z', status: 'In Process', items: [{ orderId: 'SO-2', itemCode: 'FG-201', lineCode: 'ITEM-002', outputs: [{ typeName: 'B', quantity: 50, isDeliverable: false, source: 'stock' }] }] });
  const pools = computeItemTypePools(s, TYPES_ITEM);
  check('cancelled plan outputs excluded from pool', pools.A.fromStock === 400);
  check('manual (non-SO) plan outputs excluded from pool', pools.A.fromStock === 400);
  check('non-deliverable outputs excluded from pool', !('B' in pools) || pools.B.fromStock === 0);
}

// --- A3: the double-claim guard ---------------------------------------------
{
  const s = baseState();
  const req = (qty, type = 'A') => [{ planId: 'PLN-2', lineCode: 'ITEM-002', itemCode: 'FG-201', stockByType: { [type]: qty } }];
  check('claim 200 of A (exactly available) passes', validateStockClaims(s, TYPES_ITEM, req(200)).ok === true);
  check('claim 201 of A (1 over available) blocked', validateStockClaims(s, TYPES_ITEM, req(201)).ok === false);
  const v = validateStockClaims(s, TYPES_ITEM, req(201)).violations[0];
  check('violation reports requested 201 / available 200', v.requested === 201 && v.available === 200 && v.typeName === 'A');
  check('claim 100 of B passes, 101 blocked', validateStockClaims(s, TYPES_ITEM, req(100, 'B')).ok === true && validateStockClaims(s, TYPES_ITEM, req(101, 'B')).ok === false);
  check('claim of a type with no stock blocked', validateStockClaims(s, TYPES_ITEM, req(10, 'A2')).ok === false);

  // Two lines of the SAME item in one batch accumulate: 120 + 120 > 200.
  const two = [
    { planId: 'PLN-2', lineCode: 'ITEM-002', itemCode: 'FG-201', stockByType: { A: 120 } },
    { planId: 'PLN-2', lineCode: 'ITEM-002', itemCode: 'FG-201', stockByType: { A: 120 } },
  ];
  check('accumulated claims in one batch are summed (120+120 blocked)', validateStockClaims(s, TYPES_ITEM, two).ok === false);

  // Replacing a plan item's own outputs releases its old claim first:
  // PLN-1 already claims 400; re-saving it with 600 passes (200 free + 400
  // released), 601 is blocked.
  const replace = (qty) => [{ planId: 'PLN-1', lineCode: 'ITEM-001', itemCode: 'FG-201', stockByType: { A: qty } }];
  check('re-save own claim: 600 passes (200 free + 400 released)', validateStockClaims(s, TYPES_ITEM, replace(600)).ok === true);
  check('re-save own claim: 601 blocked', validateStockClaims(s, TYPES_ITEM, replace(601)).ok === false);
}

// Deliveries shrink the pool (delivered portion is no longer promised) and
// free physical stock is reduced by exactly the delivered qty.
{
  const s = baseState();
  s.deliveries.push({ id: 'DC-1', dcMode: 'Sale Orders', items: [{ itemId: 'FG-201', itemCode: 'FG-201', lineCode: 'ITEM-001', stockType: 'A', dispatchedQty: 300 }] });
  const itemAfter = { ...TYPES_ITEM, stockByType: { A: 900, B: 100 } }; // addDelivery already took 300 out
  const pools = computeItemTypePools(s, itemAfter);
  check('delivered 300 counted in pool', pools.A.delivered === 300);
  const avail = getStockClaimAvailability(s, itemAfter);
  check('availability after delivery = 900 − (1000 − 300) = 200', avail.A.available === 200);
  check('claim 200 still passes after delivery, 201 blocked',
    validateStockClaims(s, itemAfter, [{ planId: 'PLN-2', lineCode: 'ITEM-002', itemCode: 'FG-201', stockByType: { A: 200 } }]).ok === true &&
    validateStockClaims(s, itemAfter, [{ planId: 'PLN-2', lineCode: 'ITEM-002', itemCode: 'FG-201', stockByType: { A: 201 } }]).ok === false);
}

// A manual godown dispatch eats physical stock without touching the SO
// pool — availability honestly goes negative and any new claim is blocked.
{
  const s = baseState();
  s.deliveries.push({ id: 'DC-M', dcMode: 'Finishing', items: [{ itemId: 'FG-201', stockType: 'A', dispatchedQty: 300 }] });
  const itemAfter = { ...TYPES_ITEM, stockByType: { A: 900, B: 100 } };
  const avail = getStockClaimAvailability(s, itemAfter);
  check('manual dispatch not subtracted from SO pool', avail.A.delivered === 0);
  check('availability goes to −100 when godown dispatch ate promised stock', avail.A.available === -100);
  check('any new claim blocked while pool is over-promised', validateStockClaims(s, itemAfter, [{ planId: 'PLN-2', lineCode: 'ITEM-002', itemCode: 'FG-201', stockByType: { A: 1 } }]).ok === false);
}

// --- A4: deliverable split by source (tag maths) ------------------------------
{
  const split = splitRemainingBySource(600, 400, 300);
  check('split 600p/400s/300d: stock remaining 100', split.stockRemaining === 100);
  check('split 600p/400s/300d: produced remaining 600', split.producedRemaining === 600);
  check('split total = 700 = entered − delivered', split.total === 700);
  const split2 = splitRemainingBySource(600, 400, 500);
  check('split 600p/400s/500d: stock fully consumed first', split2.stockRemaining === 0 && split2.producedRemaining === 500 && split2.total === 500);
  const split3 = splitRemainingBySource(0, 400, 0);
  check('pure from-stock line: all 400 tagged', split3.stockRemaining === 400 && split3.total === 400);
  const split4 = splitRemainingBySource(600, 400, 1200);
  check('over-delivered clamps to zero', split4.total === 0 && split4.stockRemaining === 0);
}

// --- A5: challan suffix + department ---------------------------------------
check('suffix: full from-stock', fromStockPrintSuffix(1000, 1000) === ' (FROM STOCK)');
check('suffix: partial from-stock', fromStockPrintSuffix(1000, 400) === ' (FROM STOCK: 400)');
check('suffix: none when no from-stock qty', fromStockPrintSuffix(1000, 0) === '');
check('suffix: none when nothing dispatched', fromStockPrintSuffix(0, 500) === '');
check('suffix: from-stock capped at dispatched', fromStockPrintSuffix(300, 900) === ' (FROM STOCK)');
check('department: Finishing when it exists', resolveFromStockDepartment(baseState(), 'Production') === 'Finishing');
check('department: fallback when Finishing absent', resolveFromStockDepartment({ departments: [{ value: 'Production' }] }, 'Production') === 'Production');

// --- B: source contracts ------------------------------------------------------
const appCtx = read(`${APP}/src/context/AppContext.jsx`);
check('AppContext imports isStockOutput', appCtx.includes("from '../utils/stockOutput'"));
check('AppContext skips stock mutation for stock outputs at all 4 sites (reverse, add, delete, self-heal)',
  (appCtx.match(/if \(isStockOutput\(out\)\) return;/g) || []).length === 4);

const batch = read(`${APP}/src/components/production/BatchClosing.jsx`);
check('BatchClosing offers the Production / From Stock source choice', batch.includes('<option value="production">Production</option>') && batch.includes('<option value="stock">From Stock</option>'));
check('BatchClosing validates from-stock claims before saving', batch.includes('validateStockClaims(state, itemMaster, requests)'));
check('BatchClosing stamps from-stock rows with the Finishing department', batch.includes('department: fromStockDepartment'));
check('BatchClosing forces wastage rows back to production', batch.includes("if (isWastage) arr[index].source = 'production';"));
check('BatchClosing forces from-stock rows deliverable', batch.includes("if (field === 'source' && value === 'stock')"));
check('BatchClosing new rows default to production source', batch.includes("source: 'production',"));

const del = read(`${APP}/src/components/delivery/DelCreation.jsx`);
check('DelCreation aggregates from-stock outputs separately', del.includes('isStockOutput(out) ? stockAll : producedAll'));
check('DelCreation splits remaining by source', del.includes('splitRemainingBySource(producedAll[t] || 0, stockAll[t] || 0, deliveredAll[t] || 0)'));
check('DelCreation carries fromStockQty into the selection', del.includes('fromStockQty: Math.min(out.fromStockQty || 0, readyQty)'));
check('DelCreation shows the FROM STOCK tag', del.includes('FROM STOCK {totalFromStock} MTRS') && del.includes("'FROM STOCK'"));

const slip = read(`${APP}/src/components/delivery/DelCreationSlip.jsx`);
check('DelCreationSlip stores the dispatched from-stock portion on the delivery', slip.includes('fromStockQty: isManual ? 0 : Math.min('));
check('DelCreationSlip print carries the FROM STOCK suffix', slip.includes('fromStockPrintSuffix(it.dispatchedQty || it.editedQty, it.fromStockQty)'));

const rec = read(`${APP}/src/components/delivery/DelRecord.jsx`);
check('DelRecord print carries the FROM STOCK suffix', rec.includes('fromStockPrintSuffix(it.dispatchedQty || it.editedQty, it.fromStockQty)'));

console.log(`\nsmoke-stock-output: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
