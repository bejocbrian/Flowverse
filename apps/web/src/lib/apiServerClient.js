// Use environment variable in production, proxy path in development
const API_SERVER_URL = import.meta.env.VITE_API_URL || "/hcgi/api";

function getPocketbaseToken() {
	const pocketbaseToken = localStorage.getItem('pocketbase_auth');

	if (pocketbaseToken) {
		const bytes = new TextEncoder().encode(pocketbaseToken);
		const binary = String.fromCharCode(...bytes);

		return btoa(binary);
	}
}

const apiServerClient = {
	fetch: async (url, options = {}) => {
		const pocketbaseToken = getPocketbaseToken();

		return await window.fetch(API_SERVER_URL + url, {
			...options,
			headers: {
				...options.headers,
				...(pocketbaseToken && { Authorization: `Bearer ${pocketbaseToken}` }),
			},
		});
	},
};

export default apiServerClient;

export { apiServerClient };

// ============ Batch Generation API ============

/**
 * Create a batch generation request
 * @param {Array} prompts - Array of prompt objects
 * @param {Object} settings - Generation settings
 * @returns {Promise<Object>} Batch creation response
 */
export async function createBatch(prompts, settings) {
  const response = await apiServerClient.fetch('/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompts, settings }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create batch');
  }
  
  return response.json();
}

/**
 * Get batch status with all videos
 * @param {string} batchId - Batch ID
 * @returns {Promise<Object>} Batch status response
 */
export async function getBatch(batchId) {
  const response = await apiServerClient.fetch(`/batch/${batchId}`, {
    method: 'GET',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get batch');
  }
  
  return response.json();
}

/**
 * List user's batches
 * @param {number} page - Page number
 * @param {number} perPage - Items per page
 * @returns {Promise<Object>} Batches list response
 */
export async function listBatches(page = 1, perPage = 10) {
  const response = await apiServerClient.fetch(`/batch?page=${page}&perPage=${perPage}`, {
    method: 'GET',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to list batches');
  }
  
  return response.json();
}

// ============ Preview Before Charge API ============

/**
 * Create a preview generation
 * @param {Object} params - Preview parameters
 * @returns {Promise<Object>} Preview creation response
 */
export async function createPreview(params) {
  const response = await apiServerClient.fetch('/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create preview');
  }
  
  return response.json();
}

/**
 * Confirm full generation after preview
 * @param {string} previewId - Preview ID
 * @param {Object} settings - Final generation settings
 * @returns {Promise<Object>} Confirmation response
 */
export async function confirmPreview(previewId, settings = {}) {
  const response = await apiServerClient.fetch(`/preview/${previewId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to confirm preview');
  }
  
  return response.json();
}

/**
 * Cancel preview without full generation
 * @param {string} previewId - Preview ID
 * @returns {Promise<Object>} Cancellation response
 */
export async function cancelPreview(previewId) {
  const response = await apiServerClient.fetch(`/preview/${previewId}/cancel`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to cancel preview');
  }
  
  return response.json();
}

/**
 * Get preview status
 * @param {string} previewId - Preview ID
 * @returns {Promise<Object>} Preview status response
 */
export async function getPreview(previewId) {
  const response = await apiServerClient.fetch(`/preview/${previewId}`, {
    method: 'GET',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get preview');
  }
  
  return response.json();
}
