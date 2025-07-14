import { Agent } from "undici" // Import Agent for real proxy testing

interface ProxyConfig {
  ip: string
  port: number
  username?: string
  password?: string
  country?: string
  flag?: string
  ping?: number
}

interface SearchEngineConfig {
  name: string
  searchUrl: string
  userAgent: string
  headers: Record<string, string>
}

// Reverting to the original proxyscrape.com URL as requested
const PROXY_SOURCE_URL =
  "https://api.proxyscrape.com/v4/free-proxy-list/get?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all&skip=0&limit=10"

const COUNTRY_FLAGS: { [key: string]: string } = {
  US: "🇺🇸",
  DE: "🇩🇪",
  GB: "🇬🇧",
  CA: "🇨🇦",
  JP: "🇯🇵",
  FR: "🇫🇷",
  AU: "🇦🇺",
  NL: "🇳🇱",
  SG: "🇸🇬",
  IN: "🇮🇳",
  BR: "🇧🇷",
  RU: "🇷🇺",
  CN: "🇨🇳",
  KR: "🇰🇷",
  MX: "🇲🇽",
  ES: "🇪🇸",
  IT: "🇮🇹",
  SE: "🇸🇪",
  CH: "🇨🇭",
  ZA: "🇿🇦",
  ID: "🇮🇩",
  MY: "🇲🇾",
  // Add more as needed
}

class ProxyService {
  private proxyPool: ProxyConfig[] = []
  private currentProxyIndex = 0

  private searchEngines: SearchEngineConfig[] = [
    {
      name: "DuckDuckGo",
      searchUrl: "https://duckduckgo.com/html/?q=",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
    },
    {
      name: "Bing",
      searchUrl: "https://www.bing.com/search?q=",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
      },
    },
  ]

  // This method is no longer directly used by the frontend for validation,
  // but it's kept for potential future backend-only proxy management.
  async testProxyConnectivity(proxyString: string): Promise<{ ping: number; country: string; flag: string }> {
    const [ip, port] = proxyString.split(":")
    const testUrl = "https://api.ipify.org?format=json" // A lightweight, reliable endpoint to test connectivity
    const proxyUrl = `http://${ip}:${port}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5-second timeout for proxy test

    const startTime = Date.now()
    try {
      const response = await fetch(testUrl, {
        dispatcher: new Agent({
          proxy: proxyUrl,
          connectTimeout: 3000, // 3 seconds for connection to proxy
        }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (response.ok) {
        const endTime = Date.now()
        const ping = endTime - startTime
        // In a real scenario, you'd parse the response from ipify or a GeoIP service
        // to get the country. For now, we'll keep it simple.
        return { ping, country: "Unknown", flag: "🌐" }
      } else {
        console.warn(`Proxy ${proxyString} failed test: ${response.status} ${response.statusText}`)
        return { ping: -1, country: "Failed", flag: "❌" }
      }
    } catch (error) {
      clearTimeout(timeoutId)
      console.warn(`Proxy ${proxyString} test error:`, error instanceof Error ? error.message : error)
      return { ping: -1, country: "Failed", flag: "❌" }
    }
  }

  async loadProxies(): Promise<void> {
    try {
      const response = await fetch(PROXY_SOURCE_URL, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/plain", // Request plain text
        },
        cache: "no-store", // Ensure fresh proxies
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Failed to fetch proxy list from ProxyScrape: HTTP ${response.status} - ${errorText}`)
        throw new Error(`Failed to fetch proxy list from ProxyScrape: ${response.statusText}`)
      }

      const text = await response.text()
      const lines = text.split("\n").filter((line) => line.trim() && line.includes(":"))

      // For the internal proxy pool, we'll just store them without immediate validation
      // as validation happens on scan/selection in the frontend.
      this.proxyPool = lines.map((line) => {
        const [ip, port] = line.split(":")
        return {
          ip,
          port: Number.parseInt(port),
          country: "Unknown", // Placeholder
          flag: "🌐", // Placeholder
          ping: 0, // Will be updated on real validation
        }
      })
    } catch (error) {
      console.error("Error fetching or parsing proxyscrape.com for proxy service:", error)
      this.proxyPool = [] // Clear pool on error
    }
  }

  private getNextProxy(): ProxyConfig | null {
    if (this.proxyPool.length === 0) return null

    const proxy = this.proxyPool[this.currentProxyIndex]
    this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxyPool.length
    return proxy
  }

  async searchWithProxy(query: string, maxRetries = 3): Promise<any> {
    // This method remains simulated as implementing a real search engine scraper
    // is a complex task outside the scope of the current proxy browser functionality.
    // The primary focus is on the browser's ability to load pages through proxies.
    if (this.proxyPool.length === 0) {
      await this.loadProxies()
    }

    if (this.proxyPool.length === 0) {
      throw new Error("No proxies available after attempting to load.")
    }

    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      let proxy = this.getNextProxy()
      if (!proxy) {
        // Reload proxies if we run out during retries
        await this.loadProxies()
        if (this.proxyPool.length === 0) {
          throw new Error("No proxies available after reload attempt.")
        }
        proxy = this.getNextProxy() // Try again after reload
        if (!proxy) throw new Error("Failed to get proxy after reload.")
      }

      const searchEngine = this.searchEngines[Math.floor(Math.random() * this.searchEngines.length)]
      const searchUrl = searchEngine.searchUrl + encodeURIComponent(query)

      try {
        // Simulate proxy request
        await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000))

        // Mock response for search results
        return {
          success: true,
          results: this.parseSearchResults(`<html><body><h1>Mock Search Results for ${searchUrl}</h1><p>This content is simulated as if fetched via proxy ${proxy.ip}:${proxy.port}.</p></body></html>`, searchEngine.name),
          proxy: `${proxy.ip}:${proxy.port}`,
          searchEngine: searchEngine.name,
        }
      } catch (error) {
        lastError = error as Error
        console.warn(`Proxy ${proxy.ip}:${proxy.port} failed (simulated search):`, error)
        continue
      }
    }

    throw lastError || new Error("All proxy attempts failed (simulated search)")
  }

  private parseSearchResults(html: string, engineName: string): any[] {
    // This remains a mock parsing function.
    return [
      {
        title: `Search Result 1 (via ${engineName})`,
        url: "https://example1.com",
        snippet: "This is a mock search result snippet...",
      },
      {
        title: `Search Result 2 (via ${engineName})`,
        url: "https://example2.com",
        snippet: "Another mock search result snippet...",
      },
    ]
  }
}

export const proxyService = new ProxyService()
