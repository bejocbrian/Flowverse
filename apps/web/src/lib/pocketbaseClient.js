import Pocketbase from 'pocketbase';

// Use environment variable in production, proxy path in development
const POCKETBASE_API_URL = import.meta.env.VITE_POCKETBASE_URL || "/hcgi/platform";

const pocketbaseClient = new Pocketbase(POCKETBASE_API_URL);

export default pocketbaseClient;

export { pocketbaseClient };
