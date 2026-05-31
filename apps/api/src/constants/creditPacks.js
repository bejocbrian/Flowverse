/**
 * Credit packs — the ONLY source of truth for what a pack costs and grants.
 *
 * SECURITY: checkout must derive price + credits from the pack `id` here,
 * never from client-sent values. Otherwise a user could order the biggest
 * pack for ₹1. The client only sends a pack id; the server looks up the rest.
 *
 * Pricing basis (K=5 display credits):
 *   - Vendor cost ≈ ₹0.588 per VENDOR credit => ₹0.1176 per DISPLAY credit
 *     (since 1 vendor credit = 5 display credits).
 *   - Every pack keeps a healthy gross margin (50%–70%); the per-credit rupee
 *     rate drops as the pack gets bigger (volume discount), from ₹0.39/credit
 *     on the trial pack down to ₹0.236/credit on the studio pack.
 *   - K only changes the NUMBERS shown to users; it does not affect margin.
 */

export const CREDIT_PACKS = [
	{ id: 'trial', priceINR: 49, credits: 125 },
	{ id: 'mini', priceINR: 99, credits: 300 },
	{ id: 'creator', priceINR: 299, credits: 1000, badge: 'Most Popular' },
	{ id: 'pro', priceINR: 649, credits: 2500 },
	{ id: 'studio', priceINR: 1299, credits: 5500 },
];

export function getCreditPack(id) {
	return CREDIT_PACKS.find((p) => p.id === id) || null;
}
