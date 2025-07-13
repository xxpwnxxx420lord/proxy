import { NextResponse } from "next/server"

interface ProxyData {
  ip: string
  port: string
  country?: string
  flag?: string
  ping?: number
}

// New proxy source from proxyscrape.com
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

async function fetchProxiesFromProxyScrape(): Promise<ProxyData[]> {
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

    const proxies: ProxyData[] = lines.map((line) => {
      const [ip, port] = line.split(":")
      // ProxyScrape API doesn't provide country or ping directly in this endpoint,
      // so we'll use placeholders or simulate.
      return {
        ip,
        port,
        country: "Unknown", // Placeholder
        flag: "🌐", // Placeholder
        ping: Math.floor(Math.random() * 200) + 20, // Simulated ping
      }
    })
    return proxies
  } catch (error) {
    console.error("Error fetching or parsing proxyscrape.com:", error)
    return []
  }
}

// Removed the simulated testProxy function from here.
// Real proxy testing will happen when the browser attempts to use it.

export async function GET() {
  try {
    const fetchedProxies = await fetchProxiesFromProxyScrape()

    if (fetchedProxies.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No proxies found or failed to fetch from source.",
      })
    }

    // For the "Scan through proxy list" method, we'll return a few random proxies
    // to simulate finding available ones. In a real app, you might test them here
    // or return a larger list for the user to choose from.
    const numProxiesToShow = Math.min(fetchedProxies.length, 5) // Show up to 5 random proxies
    const selectedProxies: ProxyData[] = []
    const usedIndices = new Set<number>()

    while (selectedProxies.length < numProxiesToShow) {
      const randomIndex = Math.floor(Math.random() * fetchedProxies.length)
      if (!usedIndices.has(randomIndex)) {
        selectedProxies.push(fetchedProxies[randomIndex])
        usedIndices.add(randomIndex)
      }
    }

    // Simulate a "working" status for these scanned proxies for display purposes
    const proxiesWithStatus = selectedProxies.map((p) => ({
      ...p,
      status: "inactive" as const, // Initially inactive, user clicks to activate
      speed: Math.floor(Math.random() * 200) + 50, // Simulate a speed
    }))

    return NextResponse.json({
      success: true,
      proxies: proxiesWithStatus, // Return a list of proxies
    })
  } catch (error) {
    console.error("Proxy scan error:", error)
    return NextResponse.json({
      success: false,
      error: "Failed to scan for proxies",
    })
  }
}
