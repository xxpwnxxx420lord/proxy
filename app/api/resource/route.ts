import { type NextRequest, NextResponse } from "next/server"

function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    // Add more sophisticated checks here, e.g., against a blocklist
    return true
  } catch (e) {
    return false
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const targetUrl = searchParams.get("url")

  if (!targetUrl) {
    return NextResponse.json({ error: "URL parameter is required" }, { status: 400 })
  }

  if (!isValidUrl(targetUrl)) {
    return NextResponse.json({ error: "Invalid or blocked URL" }, { status: 400 })
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "*/*",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        DNT: "1",
        Connection: "keep-alive",
        "Sec-Fetch-Dest": "script",
        "Sec-Fetch-Mode": "no-cors",
        "Sec-Fetch-Site": "cross-site",
      },
      redirect: "follow",
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return NextResponse.json({ error: `Failed to fetch resource: ${response.status}` }, { status: response.status })
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream"

    // Handle JavaScript files specially
    if (contentType.includes("javascript") || contentType.includes("text/javascript") || targetUrl.endsWith(".js")) {
      const jsContent = await response.text()

      // Basic URL rewriting for JavaScript
      const rewrittenJs = jsContent
        .replace(/fetch\s*\(\s*["']([^"']+)["']/g, (match, url) => {
          if (url.startsWith("http://") || url.startsWith("https://")) {
            return `fetch("/api/proxy?url=${encodeURIComponent(url)}"`
          } else if (url.startsWith("/")) {
            const baseUrl = new URL(targetUrl).origin
            return `fetch("/api/proxy?url=${encodeURIComponent(baseUrl + url)}"`
          }
          return match
        })
        .replace(/XMLHttpRequest\s*$$\s*$$\s*\.\s*open\s*\(\s*["'][^"']*["']\s*,\s*["']([^"']+)["']/g, (match, url) => {
          if (url.startsWith("http://") || url.startsWith("https://")) {
            return match.replace(url, `/api/proxy?url=${encodeURIComponent(url)}`)
          } else if (url.startsWith("/")) {
            const baseUrl = new URL(targetUrl).origin
            return match.replace(url, `/api/proxy?url=${encodeURIComponent(baseUrl + url)}`)
          }
          return match
        })

      return new NextResponse(rewrittenJs, {
        headers: {
          "Content-Type": "application/javascript",
          "Cache-Control": "public, max-age=3600",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      })
    }

    const buffer = await response.arrayBuffer()

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    })
  } catch (error) {
    console.error("Resource proxy error:", error)
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ error: "Resource request timeout" }, { status: 408 })
    }
    return NextResponse.json({ error: "Failed to fetch the requested resource" }, { status: 500 })
  }
}
