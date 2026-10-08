import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"

import "./index.css"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { startWeaponSync } from "@/lib/weapon/syncClears"
import { syncController } from "@/lib/sync/browserSyncController"
import { SyncControllerContext } from "@/lib/sync/syncControllerContext"

// 武器進度:勾選框變動時同步本週期的擊破紀錄
startWeaponSync()
// 登入與同步:有登入 cookie 就在背景恢復同步,畫面不等待
void syncController.boot()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <SyncControllerContext value={syncController}>
          <App />
        </SyncControllerContext>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
)
