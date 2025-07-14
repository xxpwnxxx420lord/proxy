import { NextResponse } from "next/server"
import { Agent } from "undici"

interface ProxyData {
  ip: string
  port: string
  country: string
  flag: string
  ping?: number
  status: "active" | "inactive" | "testing"
}

// Use the hardcoded list of proxies provided by the user
const HARDCODED_PROXIES = [
  "149.126.101.162:8080",
  "1.10.146.76:3128",
  "102.0.21.14:8080",
  "108.162.192.173:80",
  "108.162.192.194:80",
  "1.54.175.138:16000",
  "102.177.176.101:80",
  "1.10.239.143:8080",
  "1.52.197.113:16000",
  "1.52.198.221:16000",
  "1.52.198.150:16000",
]

// Test URL for validating proxies
const TEST_URL = "https://httpbin.org/ip"

// Validate a proxy by making an actual HTTP request through it
async function validateProxy(proxyString: string): Promise<{ valid: boolean; ping?: number }> {
  const [ip, port] = proxyString.split(":")
  const proxyUrl = `http://${ip}:${port}`

  const startTime = Date.now()

  try {
    // Create a dispatcher with the proxy
    const dispatcher = new Agent({
      proxy: proxyUrl,
      connectTimeout: 5000, // 5 seconds timeout for connection
      bodyTimeout: 5000, // 5 seconds timeout for body
    })

    // Make an actual request through the proxy
    const response = await fetch(TEST_URL, {
      dispatcher,
      signal: AbortSignal.timeout(10000), // 10 second overall timeout
    })

    const ping = Date.now() - startTime

    if (response.ok) {
      console.log(`Proxy ${proxyString} is valid with ping ${ping}ms`)
      return { valid: true, ping }
    } else {
      console.log(`Proxy ${proxyString} returned status ${response.status}`)
      return { valid: false }
    }
  } catch (error) {
    console.error(`Proxy ${proxyString} validation error:`, error)
    return { valid: false }
  }
}

export async function GET() {
  try {
    // Start with the hardcoded proxies
    const initialProxies: ProxyData[] = HARDCODED_PROXIES.map((proxy) => {
      const [ip, port] = proxy.split(":")
      return {
        ip,
        port,
        country: "Unknown", // We don't have country data
        flag: "🌐", // Generic flag
        status: "testing", // Will be validated
      }
    })

    // Return the initial list immediately so the UI can show something
    const response = NextResponse.json({
      success: true,
      proxies: initialProxies,
      message: "Testing proxies, please wait...",
    })

    // Start validating proxies in the background
    // This won't block the response, but the client will need to poll or use WebSockets
    // for real-time updates in a production app
    Promise.all(
      HARDCODED_PROXIES.map(async (proxyString) => {
        const result = await validateProxy(proxyString)
        return {
          proxyString,
          valid: result.valid,
          ping: result.ping,
        }
      }),
    ).then((results) => {
      console.log("Proxy validation results:", results)
      // In a real app, you would store these results or use WebSockets to push updates
    })

    return response
  } catch (error) {
    console.error("Proxy scan error:", error)
    return NextResponse.json({
      success: false,
      error: "Failed to scan for proxies. Check server logs for details.",
    })
  }
}
