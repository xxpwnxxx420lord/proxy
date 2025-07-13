import { type NextRequest, NextResponse } from "next/server"

async function validateProxy(proxyString: string): Promise<{ valid: boolean; ping?: number }> {
  // Simulate proxy validation
  return new Promise((resolve) => {
    setTimeout(
      () => {
        const [ip, port] = proxyString.split(":")

        // Basic validation
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
        const portNum = Number.parseInt(port)

        if (!ipRegex.test(ip) || !portNum || portNum < 1 || portNum > 65535) {
          resolve({ valid: false })
          return
        }

        // Simulate connection test (70% success rate)
        const isValid = Math.random() > 0.3
        resolve({
          valid: isValid,
          ping: isValid ? Math.floor(Math.random() * 200) + 20 : undefined,
        })
      },
      1500 + Math.random() * 1000,
    )
  })
}

export async function POST(request: NextRequest) {
  try {
    const { proxy } = await request.json()

    if (!proxy || typeof proxy !== "string") {
      return NextResponse.json({
        success: false,
        error: "Invalid proxy format",
      })
    }

    const validation = await validateProxy(proxy)

    if (validation.valid) {
      return NextResponse.json({
        success: true,
        ping: validation.ping,
      })
    } else {
      return NextResponse.json({
        success: false,
        error: "Proxy connection failed or invalid format",
      })
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: "Failed to validate proxy",
    })
  }
}
