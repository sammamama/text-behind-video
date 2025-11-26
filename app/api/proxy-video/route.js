export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const videoUrl = searchParams.get('url');
    
    // Security: Only allow your CloudFront domain
    if (!videoUrl || !videoUrl.startsWith('https://d2ym0mcwdtattp.cloudfront.net/')) {
      return new Response('Invalid URL', { status: 400 });
    }

    console.log('Proxying video:', videoUrl);
    
    const response = await fetch(videoUrl);
    
    if (!response.ok) {
      return new Response('Failed to fetch video', { status: response.status });
    }

    // Return the video with CORS headers
    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'video/mp4',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=31536000',
        'Content-Length': response.headers.get('Content-Length') || '',
      },
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response('Proxy error', { status: 500 });
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}