import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, QrCode, ShieldCheck } from 'lucide-react';

/*
 * TEMPORARY manual-payment panel.
 *
 * Automated payment gateways (Stripe / Cashfree / Paytm) are disabled while
 * business verification is pending, so we can't auto-collect or auto-credit
 * yet. In the meantime users pay via the UPI QR below and ping us on WhatsApp
 * with the payment screenshot + their account email; we credit manually.
 *
 * To restore automated checkout later, re-enable the gateway buttons in
 * WalletPage.jsx (see the commented "AUTOMATED CHECKOUT" block there) and
 * remove this panel.
 */

// WhatsApp contact for credit activation. wa.me needs the country code with
// no '+' or spaces. 91 = India.
const WHATSAPP_NUMBER = '917300739371';
const WHATSAPP_DISPLAY = '+91 73007 39371';

// UPI payee details (shown as text so users can pay even if the QR scan
// fails). Must match the encoded QR at public/payment-qr.png.
const UPI_ID = 'paytmqr5njvnm@ptys';
const UPI_PAYEE = 'AiSlopClub';

// UPI payment QR. Generated into apps/web/public/payment-qr.png (served at
// /payment-qr.png) via tools/generate-payment-qr.mjs. If it's missing we show
// a friendly fallback instead of a broken image.
const QR_SRC = '/payment-qr.png';

const ManualPaymentPanel = ({ packs = [], videoUnitCredits = null }) => {
	const [qrOk, setQrOk] = useState(true);

	const waMessage = encodeURIComponent(
		'Hi! I just paid for credits via the QR. ' +
		'Here is my payment screenshot and my account email so you can activate my credits.',
	);
	const waHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${waMessage}`;

	return (
		<motion.div
			initial={{ opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0 }}
			className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 sm:p-8"
		>
			<div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[hsl(var(--accent-primary))] font-mono mb-2">
				<ShieldCheck className="w-4 h-4" />
				Manual activation
			</div>
			<h2 className="text-xl font-semibold mb-1">Buy credits via UPI</h2>
			<p className="text-sm text-white/50 mb-6">
				Card/UPI auto-checkout is temporarily unavailable while we finish payment
				verification. You can still top up in two quick steps - we activate your
				credits manually, usually within a few hours.
			</p>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Left: QR + WhatsApp */}
				<div className="flex flex-col items-center text-center bg-white/[0.02] border border-white/10 rounded-2xl p-6">
					<div className="flex items-center gap-1.5 text-sm font-medium text-white/80 mb-4">
						<QrCode className="w-4 h-4" />
						Scan to pay (any UPI app)
					</div>

					{qrOk ? (
						<img
							src={QR_SRC}
							alt="UPI payment QR code"
							onError={() => setQrOk(false)}
							className="w-56 h-56 rounded-xl bg-white p-3 object-contain"
						/>
					) : (
						<div className="w-56 h-56 rounded-xl border border-dashed border-white/20 flex items-center justify-center text-xs text-white/40 px-4">
							Payment QR is being set up. Please contact us on WhatsApp to pay.
						</div>
					)}

					<div className="mt-4 text-center">
						<p className="text-[11px] uppercase tracking-wider text-white/40 font-mono">Pay to</p>
						<p className="text-sm font-medium text-white/90">{UPI_PAYEE}</p>
						<p className="text-xs text-white/50 font-mono break-all mt-0.5">{UPI_ID}</p>
					</div>

					<a
						href={waHref}
						target="_blank"
						rel="noopener noreferrer"
						className="mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-[#25D366] text-black font-medium hover:brightness-110 transition"
					>
						<MessageCircle className="w-4 h-4" />
						Contact on WhatsApp
					</a>
					<p className="text-[11px] text-white/40 mt-2 font-mono">{WHATSAPP_DISPLAY}</p>
				</div>

				{/* Right: steps + pack reference */}
				<div className="flex flex-col">
					<ol className="space-y-3 mb-6">
						{[
							'Pick a pack below and note its price.',
							'Scan the QR and pay that exact amount from any UPI app.',
							'Tap "Contact on WhatsApp" and send your payment screenshot + the email you signed up with.',
							'We verify and add the credits to your account.',
						].map((step, i) => (
							<li key={i} className="flex gap-3 text-sm text-white/70">
								<span className="flex-shrink-0 w-6 h-6 rounded-full bg-[hsl(var(--accent-primary))]/20 text-[hsl(var(--accent-primary))] text-xs font-semibold flex items-center justify-center">
									{i + 1}
								</span>
								<span>{step}</span>
							</li>
						))}
					</ol>

					{packs.length > 0 && (
						<div className="mt-auto">
							<p className="text-xs uppercase tracking-wider text-white/40 font-mono mb-2">
								Credit packs
							</p>
							<ul className="divide-y divide-white/5 border border-white/10 rounded-xl overflow-hidden">
								{packs.map((pack) => {
									const videos =
										videoUnitCredits && videoUnitCredits > 0
											? Math.floor(pack.credits / videoUnitCredits)
											: null;
									return (
										<li
											key={pack.id}
											className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm"
										>
											<span className="capitalize text-white/80 flex-1 min-w-0">
												{pack.id}
												{pack.badge && (
													<span className="ml-2 text-[10px] font-mono uppercase text-[hsl(var(--accent-primary))]">
														{pack.badge}
													</span>
												)}
											</span>
											<span className="text-white/60 text-right whitespace-nowrap">
												<span className="font-semibold text-white">{pack.credits}</span> cr
												{videos != null && (
													<span className="block text-[11px] text-white/40">
														≈ {videos} videos
													</span>
												)}
											</span>
											<span className="font-semibold w-14 text-right">₹{pack.priceINR}</span>
										</li>
									);
								})}
							</ul>
							{videoUnitCredits && (
								<p className="text-[11px] text-white/30 mt-2">
									Video estimate is based on our most affordable model; premium models use more credits.
								</p>
							)}
						</div>
					)}
				</div>
			</div>
		</motion.div>
	);
};

export default ManualPaymentPanel;
