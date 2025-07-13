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

  async loadProxies(): Promise<void> {
    try {
      const response = await fetch(PROXY_SOURCE_URL, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch proxy list from ProxyScrape: HTTP ${response.status}`)
      }

      const text = await response.text()
      const lines = text.split("\n").filter((line) => line.trim() && line.includes(":"))

      this.proxyPool = lines.map((line) => {
        const [ip, port] = line.split(":")
        return {
          ip,
          port: Number.parseInt(port),
          country: "Unknown", // Placeholder
          flag: "🌐", // Placeholder
          ping: Math.floor(Math.random() * 200) + 20, // Simulated ping
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

  private async makeProxiedRequest(
    url: string,
    proxy: ProxyConfig,
    headers: Record<string, string>,
  ): Promise<Response> {
    // This method is for the *search* functionality, which is still simulated for now.
    // The main browser functionality uses app/api/proxy/route.ts directly.
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    try {
      // Simulate proxy request
      await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000))

      // Mock response for search results
      return new Response(
        JSON.stringify({
          success: true,
          html: `<html><body><h1>Mock Search Results for ${url}</h1><p>This content is simulated as if fetched via proxy ${proxy.ip}:${proxy.port}.</p></body></html>`,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      )
    } finally {
      clearTimeout(timeoutId)
    }
  }

  async searchWithProxy(query: string, maxRetries = 3): Promise<any> {
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
        const response = await this.makeProxiedRequest(searchUrl, proxy, {
          ...searchEngine.headers,
          "User-Agent": searchEngine.userAgent,
        })

        if (response.ok) {
          const data = await response.json()
          return {
            success: true,
            results: this.parseSearchResults(data.html, searchEngine.name),
            proxy: `${proxy.ip}:${proxy.port}`,
            searchEngine: searchEngine.name,
          }
        }
      } catch (error) {
        lastError = error as Error
        console.warn(`Proxy ${proxy.ip}:${proxy.port} failed:`, error)
        continue
      }
    }

    throw lastError || new Error("All proxy attempts failed")
  }

  private parseSearchResults(html: string, engineName: string): any[] {
    // In a real implementation, this would parse HTML using a library like cheerio
    // For demonstration, return mock results
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

  async validateProxy(ip: string, port: number): Promise<boolean> {
    // This is a client-side validation simulation.
    // The real validation happens when the backend tries to use the proxy.
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      return Math.random() > 0.3 // 70% success rate for demo
    } catch (error) {
      return false
    }
  }
}

export const proxyService = new ProxyService()
