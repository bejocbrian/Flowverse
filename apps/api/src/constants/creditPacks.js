/**
 * Credit packs — the ONLY source of truth for what a pack costs and grants.
 *
 * SECURITY: checkout must derive price + credits from the pack `id` here,
 * never from client-sent values. Otherwise a user could order the 800-credit
 * pack for ₹1. The client only sends a pack id; the server looks up the rest.
 *
 * Pricing basis: 1 credit = ₹1.50 base; bonus credits are baked into the
 * larger packs. Vendor cost is ~₹0.556/credit, so margin stays healthy.
 */

export const CREDIT_PACKS = [
	{ id: 'trial', priceINR: 49, credits: 30 },
	{ id: 'mini', priceINR: 99, credits: 70 },
	{ id: 'creator', priceINR: 199, credits: 150, badge: 'Most Popular' },
	{ id: 'pro', priceINR: 499, credits: 390 },
	{ id: 'studio', priceINR: 999, credits: 800 },
];

export function getCreditPack(id) {
	return CREDIT_PACKS.find((p) => p.id === id) || null;
}
