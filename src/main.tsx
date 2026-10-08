import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"

import "./index.css"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { startWeaponSync } from "@/lib/weapon/syncClears"

// 武器進度:勾選框變動時同步本週期的擊破紀錄
startWeaponSync()

// 開發模式：主控台可用 window.__mstdAuth 手動驗證新的授權流程（正式登入介面完成後移除）
if (import.meta.env.DEV) void import("@/lib/auth/devConsole")

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
)
