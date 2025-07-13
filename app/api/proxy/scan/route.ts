import { NextResponse } from "next/server"

interface ProxyData {
  ip: string
  port: string
  country: string
  flag: string
  ping: number
}

// New, more reliable proxy source from GitHub
const PROXY_SOURCE_URL = "https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt"

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

async function fetchProxiesFromGitHub(): Promise<ProxyData[]> {
  try {
    const response = await fetch(PROXY_SOURCE_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      // Add a no-cache header to ensure we get fresh proxies
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch proxy list from GitHub: HTTP ${response.status}`)
    }

    const text = await response.text()
    const lines = text.split("\n").filter((line) => line.trim() && line.includes(":"))

    const proxies: ProxyData[] = lines.map((line) => {
      const [ip, port] = line.split(":")
      // These proxy lists typically don't provide country/ping directly, so we'll simulate.
      // In a real-world scenario, you'd need a GeoIP lookup service and a real ping test.
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
    console.error("Error fetching or parsing proxy list from GitHub:", error)
    return []
  }
}

export async function GET() {
  try {
    const fetchedProxies = await fetchProxiesFromGitHub()

    if (fetchedProxies.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No proxies found or failed to fetch from source. Please try again later.",
      })
    }

    // Return a subset of proxies to simulate a "scan" result
    // In a real app, you might test them here or return a larger list for the user to choose from.
    const numProxiesToReturn = Math.min(fetchedProxies.length, 10) // Return up to 10 random proxies
    const shuffledProxies = fetchedProxies.sort(() => 0.5 - Math.random()) // Shuffle for randomness
    const selectedProxies = shuffledProxies.slice(0, numProxiesToReturn)

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
      error: "Failed to scan for proxies. Check server logs for details.",
    })
  }
}
