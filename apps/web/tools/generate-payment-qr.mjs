// One-off generator for the UPI payment QR shown on the wallet page.
// Encodes a standard UPI intent so any UPI app (Paytm, GPay, PhonePe, BHIM)
// can scan and pay. Amount is intentionally omitted so the user enters the
// pack price manually.
//
// Run:  node tools/generate-payment-qr.mjs   (needs `qrcode` available)
import QRCode from 'qrcode';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VPA = 'paytmqr5njvnm@ptys';
const PAYEE = 'AiSlopClub';
const upiUri = `upi://pay?pa=${VPA}&pn=${encodeURIComponent(PAYEE)}&cu=INR`;

const out = path.resolve(__dirname, '../public/payment-qr.png');

await QRCode.toFile(out, upiUri, {
	type: 'png',
	width: 600,
	margin: 2,
	errorCorrectionLevel: 'M',
	color: { dark: '#000000', light: '#FFFFFF' },
});

console.log('Wrote', out);
console.log('UPI URI:', upiUri);
