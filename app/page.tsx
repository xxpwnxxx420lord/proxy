"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import {
  ChevronDown,
  Wifi,
  WifiOff,
  Zap,
  Globe,
  CheckCircle,
  XCircle,
  Loader2,
  Shield,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Home,
  Lock,
  Unlock,
  AlertTriangle,
  ExternalLink,
} from "lucide-react"
import { Toast } from "@/components/toast"

interface Proxy {
  ip: string
  port: string
  country: string
  flag: string
  speed: number
  status: "active" | "inactive" | "testing"
}

export default function ProxyManager() {
  const [selectedMethod, setSelectedMethod] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false) // For general loading states (manual proxy connect)
  const [showManualInput, setShowManualInput] = useState(false)
  const [manualProxy, setManualProxy] = useState("")
  const [activeProxy, setActiveProxy] = useState<Proxy | null>(null)
  const [proxyList, setProxyList] = useState<Proxy[]>([])
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)
  const [isScanning, setIsScanning] = useState(false) // For proxy scanning specific loading

  // Browser state
  const [browserUrlInput, setBrowserUrlInput] = useState("https://www.google.com")
  const [currentBrowsedUrl, setCurrentBrowsedUrl] = useState("")
  const [isBrowserLoading, setIsBrowserLoading] = useState(false)
  const [browserError, setBrowserError] = useState("")
  const [browserHistory, setBrowserHistory] = useState<string[]>([])
  const [browserHistoryIndex, setBrowserHistoryIndex] = useState(-1)
  const [navigationCount, setNavigationCount] = useState(0)

  const browserFrameRef = useRef<HTMLIFrameElement>(null)

  // Listen for navigation messages from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Ensure the message is from our iframe and has the correct type
      if (
        browserFrameRef.current &&
        event.source === browserFrameRef.current.contentWindow &&
        event.data &&
        event.data.type === "PROXY_NAVIGATION"
      ) {
        const newUrl = event.data.url
        console.log("Navigation detected:", newUrl)

        // Update the URL input to reflect the new URL
        setBrowserUrlInput(newUrl)
        setCurrentBrowsedUrl(newUrl)

        // Update navigation count to show activity
        setNavigationCount((prev) => prev + 1)

        // Update history
        const newHistory = browserHistory.slice(0, browserHistoryIndex + 1)
        newHistory.push(newUrl)
        setBrowserHistory(newHistory)
        setBrowserHistoryIndex(newHistory.length - 1)

        // Show toast for navigation
        showToast(`Navigated to ${new URL(newUrl).hostname}`, "success")
      }
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [browserHistory, browserHistoryIndex, navigationCount])

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const handleScanProxies = async () => {
    setSelectedMethod("Scan through proxy list")
    setIsScanning(true)
    setProxyList([]) // Clear previous list
    setActiveProxy(null) // Clear active proxy when scanning
    setBrowserError("") // Clear any previous browser errors

    try {
      const response = await fetch("/api/proxy/scan")
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to fetch proxies from API")
      }
      const data = await response.json()
      if (data.success && data.proxies && data.proxies.length > 0) {
        setProxyList(data.proxies)
        showToast("Proxy scan completed! Click on an available proxy to connect.", "success")
      } else {
        showToast(data.error || "No working proxies found in current scan.", "error")
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to scan for proxies.", "error")
    } finally {
      setIsScanning(false)
    }
  }

  const handleManualProxy = () => {
    setSelectedMethod("Enter your own proxy")
    setShowManualInput(true)
    setProxyList([]) // Clear proxy list when entering manual
    setActiveProxy(null) // Clear active proxy
    setBrowserError("") // Clear any previous browser errors
  }

  const handleManualProxySubmit = async () => {
    if (!manualProxy.includes(":")) {
      showToast("Please enter proxy in IP:PORT format", "error")
      return
    }

    const [ip, port] = manualProxy.split(":")
    setIsLoading(true)
    setShowManualInput(false)

    const proxy: Proxy = {
      ip,
      port,
      country: "Manual", // Set country to Manual for user-entered proxies
      flag: "👤", // User icon flag
      speed: 0, // Speed will be determined by actual usage
      status: "testing",
    }

    setActiveProxy(proxy) // Set proxy to testing state immediately
    showToast("Attempting to connect to manual proxy...", "success")

    // Simulate a brief delay for connection attempt
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // Assume connection is successful for UI, actual success/failure is in browser
    const connectedProxy = { ...proxy, status: "active", speed: Math.floor(Math.random() * 100) + 20 }
    setActiveProxy(connectedProxy)
    setIsLoading(false)
    showToast(`Manual proxy ${manualProxy} set as active.`, "success")
  }

  const handleProxySelect = async (selectedProxy: Proxy) => {
    if (selectedProxy.status === "testing") {
      showToast("This proxy is currently being tested.", "error")
      return
    }

    setIsLoading(true) // Indicate loading for proxy connection
    setBrowserError("") // Clear any previous browser errors

    // Set all other proxies to inactive and the selected one to testing
    setProxyList((prev) =>
      prev.map((p) => {
        if (p.ip === selectedProxy.ip && p.port === selectedProxy.port) {
          return { ...p, status: "testing" }
        }
        return { ...p, status: "inactive" }
      }),
    )

    setActiveProxy({ ...selectedProxy, status: "testing" })
    showToast(`Attempting to connect to proxy in ${selectedProxy.country}...`, "success")

    // Simulate a brief delay for connection attempt
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // Assume connection is successful for UI, actual success/failure is in browser
    const connectedProxy = { ...selectedProxy, status: "active" as const }
    setProxyList((prev) =>
      prev.map((p) =>
        p.ip === selectedProxy.ip && p.port === selectedProxy.port ? connectedProxy : { ...p, status: "inactive" },
      ),
    )
    setActiveProxy(connectedProxy)
    setIsLoading(false)
    showToast(`Connected to proxy in ${selectedProxy.country}!`, "success")
  }

  const loadUrlInEmbeddedBrowser = (targetUrl: string) => {
    if (!activeProxy || activeProxy.status !== "active") {
      showToast("Please connect to an active proxy first to use the browser.", "error")
      return
    }
    if (!targetUrl.trim()) return

    setIsBrowserLoading(true)
    setBrowserError("")

    let normalizedUrl = targetUrl.trim()
    if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
      normalizedUrl = `https://${normalizedUrl}`
    }

    setCurrentBrowsedUrl(normalizedUrl)
    setBrowserUrlInput(normalizedUrl)

    // Construct the proxy URL for the iframe src, including the active proxy
    const proxySrc = `/api/proxy?url=${encodeURIComponent(normalizedUrl)}&proxy=${activeProxy.ip}:${activeProxy.port}`
    if (browserFrameRef.current) {
      browserFrameRef.current.src = proxySrc
    }
  }

  const handleBrowserSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (browserUrlInput.trim()) {
      loadUrlInEmbeddedBrowser(browserUrlInput)
    }
  }

  const handleBrowserBack = () => {
    if (browserHistoryIndex > 0) {
      const newIndex = browserHistoryIndex - 1
      setBrowserHistoryIndex(newIndex)
      const prevUrl = browserHistory[newIndex]
      loadUrlInEmbeddedBrowser(prevUrl)
    }
  }

  const handleBrowserForward = () => {
    if (browserHistoryIndex < browserHistory.length - 1) {
      const newIndex = browserHistoryIndex + 1
      setBrowserHistoryIndex(newIndex)
      const nextUrl = browserHistory[newIndex]
      loadUrlInEmbeddedBrowser(nextUrl)
    }
  }

  const handleBrowserRefresh = () => {
    if (currentBrowsedUrl && browserFrameRef.current && activeProxy) {
      // Force refresh by adding a unique timestamp
      browserFrameRef.current.src = `/api/proxy?url=${encodeURIComponent(currentBrowsedUrl)}&proxy=${activeProxy.ip}:${activeProxy.port}&_t=${Date.now()}`
      setIsBrowserLoading(true)
    }
  }

  const handleBrowserHome = () => {
    loadUrlInEmbeddedBrowser("https://www.google.com")
  }

  const isSecure = currentBrowsedUrl.startsWith("https://")
  const canGoBack = browserHistoryIndex > 0
  const canGoForward = browserHistoryIndex < browserHistory.length - 1

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Syntaxical's proxy browser</h1>
            <p className="text-gray-400">This is for the ultimate school experience without using a hotspot!</p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm transition-all duration-300"
              >
                Methods <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-black/80 border-white/20 backdrop-blur-md text-white">
              <DropdownMenuItem
                onClick={handleScanProxies}
                className="hover:bg-white/10 cursor-pointer transition-colors duration-200"
                disabled={isScanning}
              >
                <Globe className="mr-2 h-4 w-4" />
                Scan through proxy list
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleManualProxy}
                className="hover:bg-white/10 cursor-pointer transition-colors duration-200"
                disabled={isLoading || isScanning}
              >
                <Wifi className="mr-2 h-4 w-4" />
                Enter your own proxy
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Active Proxy Status */}
        <Card className="bg-white/5 border-white/10 backdrop-blur-md transition-all duration-500 hover:bg-white/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-400" />
                Active Proxy Status
              </h2>
              {activeProxy && (
                <div className="flex items-center gap-2">
                  <Badge
                    variant={activeProxy.status === "active" ? "default" : "secondary"}
                    className={`${
                      activeProxy.status === "active"
                        ? "bg-green-500/20 text-green-400 border-green-500/30"
                        : activeProxy.status === "testing"
                          ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                          : "bg-red-500/20 text-red-400 border-red-500/30"
                    } transition-all duration-300`}
                  >
                    {activeProxy.status === "active" && <CheckCircle className="w-3 h-3 mr-1" />}
                    {activeProxy.status === "testing" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                    {activeProxy.status === "inactive" && <XCircle className="w-3 h-3 mr-1" />}
                    {activeProxy.status.charAt(0).toUpperCase() + activeProxy.status.slice(1)}
                  </Badge>
                  {navigationCount > 0 && (
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                      <ExternalLink className="w-3 h-3 mr-1" />
                      {navigationCount} navigations
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {activeProxy ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <p className="text-gray-400 text-sm">Proxy Address</p>
                  <p className="text-white font-mono text-lg">
                    {activeProxy.ip}:{activeProxy.port}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-gray-400 text-sm">Location</p>
                  <p className="text-white flex items-center gap-2">
                    <span className="text-xl">{activeProxy.flag}</span>
                    {activeProxy.country}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-gray-400 text-sm">Speed</p>
                  <p className="text-green-400 font-semibold">
                    {activeProxy.speed > 0 ? `${activeProxy.speed}ms - Fast` : "Testing..."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <WifiOff className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400">No active proxy connection</p>
                <p className="text-gray-500 text-sm mt-2">Select a method from the dropdown to get started</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manual Proxy Input */}
        {showManualInput && (
          <Card className="bg-white/5 border-white/10 backdrop-blur-md animate-in slide-in-from-top-4 duration-500">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Enter Your Proxy</h3>
              <div className="space-y-4">
                <div>
                  <Input
                    placeholder="Enter your proxy in the format IP:PORT"
                    value={manualProxy}
                    onChange={(e) => setManualProxy(e.target.value)}
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus:border-blue-400 transition-colors duration-300"
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={handleManualProxySubmit}
                    disabled={!manualProxy || isLoading}
                    className="bg-blue-600 hover:bg-blue-700 text-white transition-all duration-300"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Start Proxy
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowManualInput(false)}
                    className="bg-white/5 border-white/20 text-white hover:bg-white/10 hover:border-white/30 transition-all duration-300"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Proxy List */}
        {proxyList.length > 0 && (
          <Card className="bg-white/5 border-white/10 backdrop-blur-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Available Proxies</h3>
                {isScanning && (
                  <div className="flex items-center gap-2 text-blue-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Scanning proxies...</span>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                {proxyList.map((proxy, index) => (
                  <div
                    key={`${proxy.ip}:${proxy.port}`}
                    onClick={() => proxy.status !== "testing" && handleProxySelect(proxy)}
                    className={`flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10 transition-all duration-300 hover:bg-white/10 ${
                      proxy.status !== "testing" ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-xl">{proxy.flag}</span>
                      <div>
                        <p className="text-white font-mono">
                          {proxy.ip}:{proxy.port}
                        </p>
                        <p className="text-gray-400 text-sm">{proxy.country}</p>
                        {proxy.status === "inactive" && <p className="text-blue-400 text-xs">Click to connect</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {proxy.speed > 0 && <span className="text-sm text-green-400">{proxy.speed}ms</span>}
                      <Badge
                        variant="secondary"
                        className={`${
                          proxy.status === "active"
                            ? "bg-green-500/20 text-green-400 border-green-500/30"
                            : proxy.status === "testing"
                              ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                              : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                        }`}
                      >
                        {proxy.status === "testing" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                        {proxy.status === "active" && "Connected"}
                        {proxy.status === "inactive" && "Available"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Web Proxy Browser */}
        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-400" />
                Fluent Proxy Browser
              </h3>
              {activeProxy && activeProxy.status === "active" && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  <Shield className="w-3 h-3 mr-1" />
                  Fluent Navigation Active
                </Badge>
              )}
            </div>

            <div className="space-y-4">
              {/* Browser Controls */}
              <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleBrowserBack}
                    disabled={!canGoBack || isBrowserLoading}
                    className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleBrowserForward}
                    disabled={!canGoForward || isBrowserLoading}
                    className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleBrowserRefresh}
                    disabled={isBrowserLoading || !activeProxy || activeProxy.status !== "active"}
                    className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10"
                  >
                    <RotateCcw className={`h-4 w-4 ${isBrowserLoading ? "animate-spin" : ""}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleBrowserHome}
                    disabled={isBrowserLoading || !activeProxy || activeProxy.status !== "active"}
                    className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10"
                  >
                    <Home className="h-4 w-4" />
                  </Button>
                </div>

                <form onSubmit={handleBrowserSubmit} className="flex-1 flex items-center gap-2">
                  <div className="flex-1 relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                      {isSecure ? (
                        <Lock className="h-4 w-4 text-green-400" />
                      ) : (
                        <Unlock className="h-4 w-4 text-yellow-400" />
                      )}
                      {activeProxy && activeProxy.status === "active" && (
                        <Shield className="h-4 w-4 text-blue-400" title="Protected by proxy" />
                      )}
                    </div>
                    <Input
                      value={browserUrlInput}
                      onChange={(e) => setBrowserUrlInput(e.target.value)}
                      placeholder="Enter URL (e.g., google.com, github.com)"
                      disabled={isBrowserLoading || !activeProxy || activeProxy.status !== "active"}
                      className="pl-16 bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus:border-blue-400 transition-colors duration-300"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={
                      isBrowserLoading || !activeProxy || activeProxy.status !== "active" || !browserUrlInput.trim()
                    }
                    className="bg-blue-600 hover:bg-blue-700 text-white transition-all duration-300"
                  >
                    {isBrowserLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Go"}
                  </Button>
                </form>
              </div>

              {/* Status Bar */}
              {currentBrowsedUrl && (
                <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">Viewing:</span>
                        <span className="text-white font-mono">{currentBrowsedUrl}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        <span className="text-green-400">Proxied</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ExternalLink className="w-3 h-3 text-blue-400" />
                        <span className="text-blue-400">Fluent Navigation</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Error Display */}
              {browserError && (
                <Card className="bg-red-500/10 border-red-500/20 backdrop-blur-md">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-red-400">
                      <AlertTriangle className="h-5 w-5" />
                      <span className="font-semibold">Error:</span>
                      <span>{browserError}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Website Display */}
              <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden relative">
                {!activeProxy || activeProxy.status !== "active" ? (
                  <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                      <WifiOff className="h-16 w-16 text-gray-500 mx-auto mb-4" />
                      <h3 className="text-white text-lg font-semibold mb-2">No Proxy Connection</h3>
                      <p className="text-gray-400">Connect to a proxy to start browsing securely</p>
                    </div>
                  </div>
                ) : isBrowserLoading ? (
                  <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                      <Loader2 className="h-12 w-12 text-blue-400 mx-auto mb-4 animate-spin" />
                      <p className="text-white text-lg">Loading {browserUrlInput}...</p>
                      <p className="text-gray-400 text-sm mt-2">Fetching through proxy...</p>
                    </div>
                  </div>
                ) : (
                  <iframe
                    ref={browserFrameRef} // Assign ref to iframe
                    // The src will be set dynamically by loadUrlInEmbeddedBrowser
                    title="Proxied Browser"
                    className="w-full h-[600px] bg-white rounded-lg border-0"
                    onLoad={() => {
                      setIsBrowserLoading(false)
                      setBrowserError("") // Clear any previous errors on successful load
                    }}
                    onError={() => {
                      setBrowserError("Failed to load content in iframe. Check proxy or URL.")
                      setIsBrowserLoading(false)
                    }}
                  />
                )}
                {/* Overlay for initial state or error when iframe is not loaded */}
                {!currentBrowsedUrl && activeProxy && activeProxy.status === "active" && !isBrowserLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/5">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Home className="h-8 w-8 text-gray-400" />
                      </div>
                      <h3 className="text-white text-lg font-semibold mb-2">Ready to Browse</h3>
                      <p className="text-gray-400">Enter a URL above to start browsing through the proxy</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ExternalLink className="h-5 w-5 text-green-400" />
                  <span className="font-semibold text-green-400">Please enjoy</span>
                </div>
                <p className="text-green-300 text-sm">
                  🎉 Please enjoy this project I made with this beautiful/wonderful user interface and I hope you guys
                  love the uh mechanics and also enjoy the proxies. proxy list is provided by proxylist if your
                  department bans proxylist that would be sad but if it is blocked I reccomend entering your own proxy
                  through the method! I will add default proxies in a dropdown in the future!
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Button
                  variant="outline"
                  onClick={() => setBrowserUrlInput("https://www.google.com")}
                  className="bg-white/5 border-white/20 text-white hover:bg-white/10"
                >
                  Google
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setBrowserUrlInput("https://github.com")}
                  className="bg-white/5 border-white/20 text-white hover:bg-white/10"
                >
                  GitHub
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setBrowserUrlInput("https://news.ycombinator.com")}
                  className="bg-white/5 border-white/20 text-white hover:bg-white/10"
                >
                  Hacker News
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setBrowserUrlInput("https://www.wikipedia.org")}
                  className="bg-white/5 border-white/20 text-white hover:bg-white/10"
                >
                  Wikipedia
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading Overlay */}
        {isLoading && !isScanning && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300">
            <Card className="bg-white/10 border-white/20 backdrop-blur-md">
              <CardContent className="p-8 text-center">
                <Loader2 className="w-12 h-12 text-blue-400 mx-auto mb-4 animate-spin" />
                <p className="text-white text-lg font-semibold">Verifying Proxy Connection</p>
                <p className="text-gray-400 text-sm mt-2">Please wait while we test the connection...</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Toast Notifications */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
