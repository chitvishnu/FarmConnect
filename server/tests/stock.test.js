import test from "node:test";
import assert from "node:assert/strict";

// Pure business-rule tests for the same stock and cancellation rules used by the API.
function canOrder(available, requested) { return Number.isFinite(requested) && requested > 0 && requested <= available; }
function cancelAndRestore(stock, ordered, status) {
  if (["completed", "cancelled"].includes(status)) throw new Error("Order cannot be cancelled");
  return stock + ordered;
}
test("rejects an order larger than available stock", () => {
  assert.equal(canOrder(5, 6), false);
});
test("accepts a valid quantity", () => {
  assert.equal(canOrder(5, 3), true);
});
test("rejects zero and negative quantities", () => {
  assert.equal(canOrder(5, 0), false);
  assert.equal(canOrder(5, -1), false);
});
test("restores stock after cancellation", () => {
  assert.equal(cancelAndRestore(7, 3, "accepted"), 10);
});
test("does not allow cancelling completed orders", () => {
  assert.throws(() => cancelAndRestore(7, 3, "completed"));
});
