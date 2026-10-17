'use strict';

async function verifyPublicImage(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, { method: 'HEAD', signal: AbortSignal.timeout(20000) });
  if (!response.ok || !response.headers.get('content-type')?.toLowerCase().startsWith('image/')) {
    const error = new Error('R2 图片公开访问验证失败');
    error.name = 'PublicImageVerificationError';
    error.statusCode = response.status;
    throw error;
  }
}

module.exports = { verifyPublicImage };
