import { type NextRequest, NextResponse } from "next/server"
import { Agent } from "undici"

// Test URL for validating proxies
const TEST_URL = "https://httpbin.org/ip"

export async function POST(request: NextRequest) {
  try {
    const { proxy } = await request.json()

    if (!proxy || typeof proxy !== "string" || !proxy.includes(":")) {
      return NextResponse.json({
        success: false,
        error: "Invalid proxy format. Must be IP:PORT",
      })
    }

    const [ip, port] = proxy.split(":")
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
        const data = await response.json()
        console.log(`Proxy ${proxy} is valid with ping ${ping}ms. Response:`, data)

        return NextResponse.json({
          success: true,
          ping,
          origin: data.origin, // The IP that httpbin sees (should be the proxy's IP)
        })
      } else {
        console.log(`Proxy ${proxy} returned status ${response.status}`)
        return NextResponse.json({
          success: false,
          error: `Proxy returned status ${response.status}`,
        })
      }
    } catch (error) {
      console.error(`Proxy ${proxy} validation error:`, error)
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown proxy validation error",
      })
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: "Failed to validate proxy",
    })
  }
}
