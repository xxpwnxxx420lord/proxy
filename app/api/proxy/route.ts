import { type NextRequest, NextResponse } from "next/server"
import { Agent } from "undici" // Import Agent from undici for proxy support

// Security: Allowed domains/protocols
const ALLOWED_PROTOCOLS = ["http:", "https:"]
const BLOCKED_DOMAINS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "10.",
  "172.",
  "192.168.",
  "metadata.google.internal",
  "169.254.169.254", // AWS metadata
]

function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString)

    // Check protocol
    if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
      return false
    }

    // Check for blocked domains/IPs
    const hostname = url.hostname.toLowerCase()
    for (const blocked of BLOCKED_DOMAINS) {
      if (hostname.includes(blocked)) {
        return false
      }
    }

    return true
  } catch {
    return false
  }
}

function rewriteHtml(html: string, baseUrl: string): string {
  const url = new URL(baseUrl)
  const origin = url.origin

  let rewritten = html

  // Rewrite href attributes
  rewritten = rewritten.replace(/href=["']([^"']+)["']/gi, (match, href) => {
    if (href.startsWith("http://") || href.startsWith("https://")) {
      return `href="/api/proxy?url=${encodeURIComponent(href)}" data-proxy-link="true"`
    } else if (href.startsWith("/")) {
      return `href="/api/proxy?url=${encodeURIComponent(origin + href)}" data-proxy-link="true"`
    } else if (
      href.startsWith("./") ||
      (!href.includes(":") && !href.startsWith("#") && !href.startsWith("mailto:") && !href.startsWith("tel:"))
    ) {
      const absoluteUrl = new URL(href, baseUrl).toString()
      return `href="/api/proxy?url=${encodeURIComponent(absoluteUrl)}" data-proxy-link="true"`
    }
    return match
  })

  // Rewrite src attributes (images, scripts, etc.)
  rewritten = rewritten.replace(/src=["']([^"']+)["']/gi, (match, src) => {
    if (src.startsWith("http://") || src.startsWith("https://")) {
      return `src="/api/resource?url=${encodeURIComponent(src)}"`
    } else if (src.startsWith("/")) {
      return `src="/api/resource?url=${encodeURIComponent(origin + src)}"`
    } else if (src.startsWith("./") || !src.includes(":")) {
      const absoluteUrl = new URL(src, baseUrl).toString()
      return `src="/api/resource?url=${encodeURIComponent(absoluteUrl)}"`
    }
    return match
  })

  // Rewrite CSS url() references
  rewritten = rewritten.replace(/url$$["']?([^)"']+)["']?$$/gi, (match, url) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return `url("/api/resource?url=${encodeURIComponent(url)}")`
    } else if (url.startsWith("/")) {
      return `url("/api/resource?url=${encodeURIComponent(origin + url)}")`
    } else if (url.startsWith("./") || !url.includes(":")) {
      const absoluteUrl = new URL(url, baseUrl).toString()
      return `url("/api/resource?url=${encodeURIComponent(absoluteUrl)}")`
    }
    return match
  })

  // Add base tag to handle remaining relative URLs
  const baseTag = `<base href="${origin}/">`
  if (rewritten.includes("<head>")) {
    rewritten = rewritten.replace("<head>", `<head>${baseTag}`)
  } else {
    rewritten = baseTag + rewritten
  }

  // Add comprehensive JavaScript proxy helper
  const proxyScript = `
    <script>
      (function() {
        const CURRENT_PROXY_URL = '${baseUrl}';
        const CURRENT_ORIGIN = '${origin}';
        
        // Function to convert URL to proxy URL
        function toProxyUrl(url) {
          if (!url) return url;
          
          // Handle different URL formats
          if (typeof url === 'string') {
            // Skip anchors, mailto, tel, javascript, etc.
            if (url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('javascript:')) {
              return url;
            }
            
            if (url.startsWith('http://') || url.startsWith('https://')) {
              return '/api/proxy?url=' + encodeURIComponent(url);
            } else if (url.startsWith('/')) {
              return '/api/proxy?url=' + encodeURIComponent(CURRENT_ORIGIN + url);
            } else if (url.startsWith('./') || !url.includes(':')) {
              try {
                const absoluteUrl = new URL(url, CURRENT_PROXY_URL).toString();
                return '/api/proxy?url=' + encodeURIComponent(absoluteUrl);
              } catch (e) {
                return url;
              }
            }
          }
          return url;
        }

        // Function to notify parent window of navigation
        function notifyNavigation(url) {
          try {
            if (window.parent && window.parent !== window) {
              window.parent.postMessage({
                type: 'PROXY_NAVIGATION',
                url: url,
                timestamp: Date.now()
              }, '*');
            }
          } catch (e) {
            console.warn('Could not notify parent of navigation:', e);
          }
        }

        // Override fetch to go through our proxy
        const originalFetch = window.fetch;
        window.fetch = function(url, options = {}) {
          const proxyUrl = toProxyUrl(url);
          return originalFetch(proxyUrl, options);
        };

        // Override XMLHttpRequest
        const OriginalXHR = window.XMLHttpRequest;
        window.XMLHttpRequest = function() {
          const xhr = new OriginalXHR();
          const originalOpen = xhr.open;
          xhr.open = function(method, url, ...args) {
            const proxyUrl = toProxyUrl(url);
            return originalOpen.call(this, method, proxyUrl, ...args);
          };
          return xhr;
        };

        // Override window.open to use proxy
        const originalWindowOpen = window.open;
        window.open = function(url, target, features) {
          const proxyUrl = toProxyUrl(url);
          if (target === '_blank' || target === '_new') {
            // For new windows, still use proxy but in new tab
            return originalWindowOpen.call(this, proxyUrl, target, features);
          } else {
            // For same window, navigate within proxy
            window.location.href = proxyUrl;
            return window;
          }
        };

        // Override window.location
        const originalLocation = window.location;
        let locationOverride = {
          get href() { return CURRENT_PROXY_URL; },
          set href(url) { 
            const proxyUrl = toProxyUrl(url);
            notifyNavigation(url);
            originalLocation.href = proxyUrl;
          },
          get origin() { return CURRENT_ORIGIN; },
          get protocol() { return new URL(CURRENT_PROXY_URL).protocol; },
          get host() { return new URL(CURRENT_PROXY_URL).host; },
          get hostname() { return new URL(CURRENT_PROXY_URL).hostname; },
          get port() { return new URL(CURRENT_PROXY_URL).port; },
          get pathname() { return new URL(CURRENT_PROXY_URL).pathname; },
          get search() { return new URL(CURRENT_PROXY_URL).search; },
          get hash() { return new URL(CURRENT_PROXY_URL).hash; },
          assign: function(url) { 
            const proxyUrl = toProxyUrl(url);
            notifyNavigation(url);
            originalLocation.assign(proxyUrl);
          },
          replace: function(url) { 
            const proxyUrl = toProxyUrl(url);
            notifyNavigation(url);
            originalLocation.replace(proxyUrl);
          },
          reload: function() { originalLocation.reload(); },
          toString: function() { return CURRENT_PROXY_URL; }
        };

        // Try to override location (may not work in all browsers due to security)
        try {
          Object.defineProperty(window, 'location', {
            get: function() { return locationOverride; },
            set: function(url) { locationOverride.href = url; }
          });
        } catch (e) {
          console.warn('Could not fully override window.location');
        }

        // Intercept all link clicks
        document.addEventListener('click', function(e) {
          const link = e.target.closest('a[href]');
          if (link && link.href) {
            const href = link.getAttribute('href');
            
            // Skip anchors, mailto, tel, javascript
            if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
              return;
            }
            
            // Check if it's already a proxy link
            if (link.hasAttribute('data-proxy-link')) {
              const originalUrl = decodeURIComponent(link.href.split('url=')[1] || '');
              notifyNavigation(originalUrl);
              return;
            }
            
            // Convert to proxy URL and navigate
            e.preventDefault();
            const proxyUrl = toProxyUrl(href);
            notifyNavigation(href);
            
            if (link.target === '_blank' || link.target === '_new') {
              window.open(proxyUrl, link.target);
            } else {
              window.location.href = proxyUrl;
            }
          }
        });

        // Intercept form submissions
        document.addEventListener('submit', function(e) {
          const form = e.target;
          if (form.action) {
            const originalAction = form.action;
            const proxyAction = toProxyUrl(originalAction);
            form.action = proxyAction;
            notifyNavigation(originalAction);
          }
        });

        // Handle dynamic content changes
        const observer = new MutationObserver(function(mutations) {
          mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
              if (node.nodeType === 1) { // Element node
                // Update links
                const links = node.querySelectorAll ? node.querySelectorAll('a[href]') : [];
                links.forEach(function(link) {
                  const href = link.getAttribute('href');
                  if (href && !link.hasAttribute('data-proxy-link')) {
                    const proxyUrl = toProxyUrl(href);
                    if (proxyUrl !== href) {
                      link.href = proxyUrl;
                      link.setAttribute('data-proxy-link', 'true');
                    }
                  }
                });
                
                // Update forms
                const forms = node.querySelectorAll ? node.querySelectorAll('form[action]') : [];
                forms.forEach(function(form) {
                  const action = form.getAttribute('action');
                  if (action && !form.hasAttribute('data-proxy-form')) {
                    const proxyAction = toProxyUrl(action);
                    if (proxyAction !== action) {
                      form.action = proxyAction;
                      form.setAttribute('data-proxy-form', 'true');
                    }
                  }
                });
              }
            });
          });
        });

        observer.observe(document.body || document.documentElement, {
          childList: true,
          subtree: true
        });

        // Handle browser back/forward buttons
        window.addEventListener('popstate', function(e) {
          // The browser will handle this naturally since we're using real URLs
        });

        // Console info
        console.info('🔗 Proxy browser active - all navigation will stay within proxy');
        console.info('📍 Current proxied URL:', CURRENT_PROXY_URL);
      })();
    </script>
  `

  // Insert the proxy script before the closing head tag or at the beginning
  if (rewritten.includes("</head>")) {
    rewritten = rewritten.replace("</head>", `${proxyScript}</head>`)
  } else {
    rewritten = proxyScript + rewritten
  }

  return rewritten
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const targetUrl = searchParams.get("url")
  const proxyString = searchParams.get("proxy") // Get the proxy IP:PORT from the URL

  if (!targetUrl) {
    return NextResponse.json({ error: "URL parameter is required" }, { status: 400 })
  }

  if (!isValidUrl(targetUrl)) {
    return NextResponse.json({ error: "Invalid or blocked URL" }, { status: 400 })
  }

  const fetchOptions: RequestInit = {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Accept-Encoding": "gzip, deflate, br",
      DNT: "1",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
    },
    redirect: "follow",
  }

  // Configure proxy if provided
  if (proxyString) {
    const [proxyIp, proxyPort] = proxyString.split(":")
    if (proxyIp && proxyPort) {
      const proxyUrl = `http://${proxyIp}:${proxyPort}`
      try {
        // undici's Agent supports proxy configuration
        fetchOptions.dispatcher = new Agent({
          proxy: proxyUrl,
          connectTimeout: 10000, // 10 seconds for connection
          bodyTimeout: 30000, // 30 seconds for body
        })
        console.log(`Using proxy: ${proxyUrl} for ${targetUrl}`)
      } catch (e) {
        console.error(`Failed to create proxy agent for ${proxyUrl}:`, e)
        return NextResponse.json({ error: "Invalid proxy configuration" }, { status: 500 })
      }
    }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout for the entire request

  try {
    console.log(`Fetching ${targetUrl} ${proxyString ? `via proxy ${proxyString}` : "directly"}`)
    const response = await fetch(targetUrl, { ...fetchOptions, signal: controller.signal })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(
        `Proxy fetch failed for ${targetUrl} via ${proxyString}: ${response.status} ${response.statusText} - ${errorText}`,
      )
      return NextResponse.json(
        { error: `Failed to fetch: ${response.status} ${response.statusText}. Proxy might be down or blocked.` },
        { status: response.status },
      )
    }

    const contentType = response.headers.get("content-type") || ""

    if (contentType.includes("text/html")) {
      const html = await response.text()
      const rewrittenHtml = rewriteHtml(html, targetUrl)

      return new NextResponse(rewrittenHtml, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "X-Frame-Options": "SAMEORIGIN",
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      })
    } else {
      const buffer = await response.arrayBuffer()
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=3600",
        },
      })
    }
  } catch (error) {
    console.error("Proxy error:", error)
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { error: "Request timeout - the website took too long to respond via proxy." },
        { status: 408 },
      )
    }
    return NextResponse.json(
      {
        error:
          "Failed to fetch the requested URL. The website may be down or blocking requests, or the proxy is not working.",
      },
      { status: 500 },
    )
  }
}
