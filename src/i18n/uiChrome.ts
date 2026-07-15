import type { DeepPartial, LocaleCode, Messages } from "@/i18n/types";

type UiChrome = DeepPartial<
  Pick<Messages, "common" | "shell" | "overview" | "routerPanel" | "settings" | "password" | "aliases">
>;

/**
 * Full UI chrome translations for locales that previously only had nav/cli.
 * Indonesian (`id`) stays in catalog.ts (complete there).
 */
export const uiChromeByLocale: Partial<Record<Exclude<LocaleCode, "en" | "id">, UiChrome>> = {
  ms: {
    common: { save: "Simpan", saved: "Disimpan", auto: "Auto", on: "Hidup", off: "Mati" },
    shell: {
      dashboard: "Papan pemuka",
      brandTagline: "Gateway AI pintar",
      light: "Cerah",
      dark: "Gelap",
      switchToLight: "Tukar ke tema cerah",
      switchToDark: "Tukar ke tema gelap",
      clientKeys: "Kunci klien",
      provider: "Pembekal",
      bridge: "Jambatan",
      remoteAccess: "Akses jauh",
      compressionProxy: "Proksi mampatan",
      updateAvailable: "Kemaskini tersedia: v{version}",
      youAreOn: "Anda menggunakan v{version}.",
      viewReleaseNotes: "Lihat nota keluaran",
      checkGithub: "Semak GitHub untuk keluaran terkini.",
      dismissUpdate: "Tutup sepanduk kemaskini",
      changePasswordTitle: "Tukar kata laluan lalai sementara",
      changePasswordBody: "Gunakan Password di bawah. Menu lain dibuka selepas anda menyimpan kata laluan baharu."
    },
    overview: {
      metricsAria: "Metrik gambaran",
      spendToday: "Perbelanjaan hari ini",
      budgetLeft: "Bajet tinggal",
      providersActive: "Pembekal aktif",
      requests: "Permintaan hari ini",
      budgetGuardActive: "Penjaga bajet aktif",
      savingsToday: "Penjimatan hari ini",
      savedAmount: "{amount} dijimatkan",
      noSavingsYet: "Tiada penjimatan lagi hari ini",
      viaCache: "{amount} melalui cache",
      freeTierReq: "{count} req free-tier",
      cacheHits: "{count} cache hit",
      systemStatus: "Status sistem",
      sqlite: "SQLite",
      encryptedKeys: "Kunci disulitkan",
      fallbackReady: "Fallback sedia"
    },
    routerPanel: {
      title: "Router",
      laneAria: "Laluan routing",
      userApp: "Pengguna/App",
      cache: "Cache",
      budget: "Bajet",
      evaluator: "Penilai",
      provider: "Pembekal",
      mode: "Mod",
      strategy: "Strategi",
      fallback: "Fallback",
      active: "Aktif",
      connected: "Disambung",
      roundRobin: "Round robin",
      priority: "Keutamaan",
      unknown: "tidak diketahui"
    },
    settings: {
      publicUrlSubtle: "URL awam",
      domain: "Domain",
      publicUrlBody:
        "Tetapkan URL HTTPS yang anda buka dalam pelayar (cth. https://nesa.example.com). OAuth dan redirect login menggunakannya supaya kembali ke domain anda, bukan localhost.",
      publicBaseUrl: "URL asas awam",
      budgetSubtle: "Bajet",
      limits: "Had",
      dailyBudget: "Bajet harian",
      dailyBudgetAria: "Bajet harian dalam dolar AS",
      warningPct: "Amaran %",
      criticalPct: "Kritikal %",
      mode: "Mod",
      modeAuto: "Auto",
      modeFree: "Percuma",
      modeCheap: "Murah",
      modeBest: "Terbaik",
      modeManual: "Manual",
      manualProvider: "Pembekal manual",
      selectProvider: "Pilih pembekal…",
      noActiveProviders: "Tiada pembekal aktif — aktifkan dahulu di Providers.",
      choosingSetsManual: "Memilih pembekal di sini menetapkan Mod ke Manual secara automatik. Kemudian Simpan.",
      pickProviderManual: "Pilih pembekal di atas, kemudian Simpan. Mod Manual tidak meroute sehingga pembekal dipilih.",
      selectedNotActive: "Pembekal dipilih tidak aktif — aktifkan di Providers atau pilih yang lain.",
      providerStrategy: "Strategi pembekal",
      priority: "Keutamaan",
      roundRobin: "Round robin",
      fallback: "Fallback",
      evaluator: "Penilai",
      onWarning: "Semasa amaran",
      preferCheaper: "Utamakan lebih murah",
      notifyOnly: "Maklum sahaja",
      onCritical: "Semasa kritikal",
      freeTierOnly: "Free / free-tier sahaja",
      onExceeded: "Semasa melebihi",
      blockPaid: "Sekat berbayar",
      allow: "Benarkan",
      cache: "Cache",
      freeTier: "Free tier",
      rtk: "RTK (mampatkan tool_result — git/grep/ls/logs)",
      headroomCompress: "Mampatan Headroom (proksi luaran)",
      headroomUrl: "URL Headroom",
      compressUserMessages: "Mampatkan juga mesej pengguna",
      pxpipe: "pxpipe-lite (mampatan tool dalam proses)",
      upstreamLoad: "Beban upstream",
      concurrencyQueue: "Barisan concurrency",
      concurrencyBody: "Hadkan panggilan upstream selari untuk melindungi had kadar. Tetapkan 0 untuk tanpa had (lalai).",
      maxConcurrentGlobal: "Maks serentak (global)",
      maxConcurrentPerProvider: "Maks serentak (per pembekal)",
      queueWaitMs: "Tunggu barisan (ms)",
      mediaApis: "API media",
      mediaRouting: "Laluan media",
      mediaBody:
        "Pin imej, speech, transkripsi dan embeddings ke pembekal OpenAI-compatible tertentu, atau biarkan Auto menggunakan enjin laluan utama. Carian web menggunakan DuckDuckGo terbina (tiada kunci pembekal).",
      images: "Imej",
      speech: "Speech (TTS)",
      transcriptions: "Transkripsi (STT)",
      embeddings: "Embeddings",
      webSearch: "Carian web",
      webSearchBuiltin: "Terbina (DuckDuckGo)",
      autoRouting: "Auto (enjin laluan)",
      caveman: "Caveman",
      ponytail: "Ponytail"
    },
    password: {
      admin: "Admin",
      title: "Kata laluan",
      current: "Kata laluan semasa",
      next: "Kata laluan baharu",
      save: "Simpan kata laluan",
      updated: "Kata laluan dikemas kini. Memuatkan semula…",
      failed: "Gagal mengemas kini kata laluan."
    },
    aliases: {
      subtle: "Nama model pendek",
      title: "Alias",
      body: 'Petakan model: "fast" ke model pembekal atau kombo. Panggil Codex dengan cx/gpt-…, Claude dengan cc/…, dan pembekal lain dengan prefiks pendek mereka.',
      empty: "Belum ada alias.",
      alias: "Alias",
      target: "Sasaran",
      targetPlaceholder: "model pembekal atau nama kombo",
      add: "Tambah alias",
      delete: "Padam",
      importLabel: "Import JSON 9router",
      importPlaceholder: '{"aliases":{"fast":"or/meta-llama/..."}}',
      importButton: "Import JSON 9router",
      importing: "Mengimport…",
      importPasteFirst: "Tampal JSON daripada 9router GET /api/models/alias dahulu.",
      importInvalidJson: "JSON tidak sah.",
      importFailed: "Import gagal.",
      importSummary: "{added} ditambah, {updated} dikemas kini, {skipped} dilangkau."
    }
  },

  "zh-CN": {
    common: { save: "保存", saved: "已保存", auto: "自动", on: "开", off: "关" },
    shell: {
      dashboard: "仪表盘",
      brandTagline: "智能 AI 网关",
      light: "浅色",
      dark: "深色",
      switchToLight: "切换到浅色主题",
      switchToDark: "切换到深色主题",
      clientKeys: "客户端密钥",
      provider: "提供商",
      bridge: "桥接",
      remoteAccess: "远程访问",
      compressionProxy: "压缩代理",
      updateAvailable: "有可用更新：v{version}",
      youAreOn: "当前版本 v{version}。",
      viewReleaseNotes: "查看发行说明",
      checkGithub: "请到 GitHub 查看最新版本。",
      dismissUpdate: "关闭更新横幅",
      changePasswordTitle: "请修改临时默认密码",
      changePasswordBody: "请在下方「密码」中修改。保存新密码后即可解锁其他菜单。"
    },
    overview: {
      metricsAria: "概览指标",
      spendToday: "今日花费",
      budgetLeft: "剩余预算",
      providersActive: "活跃提供商",
      requests: "请求数",
      budgetGuardActive: "预算守护已启用",
      savingsToday: "今日节省",
      savedAmount: "已节省 {amount}",
      noSavingsYet: "今天尚无节省",
      viaCache: "缓存节省 {amount}",
      freeTierReq: "{count} 次免费档请求",
      cacheHits: "{count} 次缓存命中",
      systemStatus: "系统状态",
      sqlite: "SQLite",
      encryptedKeys: "密钥已加密",
      fallbackReady: "回退就绪"
    },
    routerPanel: {
      title: "路由器",
      laneAria: "路由通道",
      userApp: "用户/应用",
      cache: "缓存",
      budget: "预算",
      evaluator: "评估器",
      provider: "提供商",
      mode: "模式",
      strategy: "策略",
      fallback: "回退",
      active: "活跃",
      connected: "已连接",
      roundRobin: "轮询",
      priority: "优先级",
      unknown: "未知"
    },
    settings: {
      publicUrlSubtle: "公网 URL",
      domain: "域名",
      publicUrlBody:
        "填写你在浏览器打开的 HTTPS 地址（例如 https://nesa.example.com）。OAuth 与登录回跳会使用它，从而回到你的域名而不是 localhost。",
      publicBaseUrl: "公网基础 URL",
      budgetSubtle: "预算",
      limits: "限额",
      dailyBudget: "每日预算",
      dailyBudgetAria: "以美元计的每日预算",
      warningPct: "警告 %",
      criticalPct: "危急 %",
      mode: "模式",
      modeAuto: "自动",
      modeFree: "免费优先",
      modeCheap: "最便宜",
      modeBest: "最佳",
      modeManual: "手动",
      manualProvider: "手动提供商",
      selectProvider: "选择提供商…",
      noActiveProviders: "没有活跃提供商 — 请先在 Providers 中启用。",
      choosingSetsManual: "在此选择提供商会自动将模式设为手动。然后点击保存。",
      pickProviderManual: "请在上方选择提供商并保存。未选择前，手动模式不会路由。",
      selectedNotActive: "所选提供商未激活 — 请在 Providers 中启用或另选。",
      providerStrategy: "提供商策略",
      priority: "优先级",
      roundRobin: "轮询",
      fallback: "回退",
      evaluator: "评估器",
      onWarning: "警告时",
      preferCheaper: "优先更便宜",
      notifyOnly: "仅通知",
      onCritical: "危急时",
      freeTierOnly: "仅免费档",
      onExceeded: "超限时",
      blockPaid: "屏蔽付费",
      allow: "允许",
      cache: "缓存",
      freeTier: "免费档",
      rtk: "RTK（压缩 tool_result — git/grep/ls/logs）",
      headroomCompress: "Headroom 压缩（外部代理）",
      headroomUrl: "Headroom URL",
      compressUserMessages: "同时压缩用户消息",
      pxpipe: "pxpipe-lite（进程内工具压缩）",
      upstreamLoad: "上游负载",
      concurrencyQueue: "并发队列",
      concurrencyBody: "限制并行上游调用以保护速率限制。设为 0 表示不限制（默认）。",
      maxConcurrentGlobal: "最大并发（全局）",
      maxConcurrentPerProvider: "最大并发（每提供商）",
      queueWaitMs: "队列等待（毫秒）",
      mediaApis: "媒体 API",
      mediaRouting: "媒体路由",
      mediaBody:
        "可将图像、语音、转写与嵌入固定到特定 OpenAI 兼容提供商，或保持自动以使用主路由引擎。网页搜索使用内置 DuckDuckGo（无需提供商密钥）。",
      images: "图像",
      speech: "语音（TTS）",
      transcriptions: "转写（STT）",
      embeddings: "嵌入",
      webSearch: "网页搜索",
      webSearchBuiltin: "内置（DuckDuckGo）",
      autoRouting: "自动（路由引擎）",
      caveman: "Caveman",
      ponytail: "Ponytail"
    },
    password: {
      admin: "管理员",
      title: "密码",
      current: "当前密码",
      next: "新密码",
      save: "保存密码",
      updated: "密码已更新。正在重新加载…",
      failed: "更新密码失败。"
    },
    aliases: {
      subtle: "短模型名",
      title: "别名",
      body: "将 model: \"fast\" 映射到提供商模型或组合。Codex 可用 cx/gpt-…，Claude 可用 cc/…，其他提供商使用对应短前缀。",
      empty: "暂无别名。",
      alias: "别名",
      target: "目标",
      targetPlaceholder: "提供商模型或组合名",
      add: "添加别名",
      delete: "删除",
      importLabel: "导入 9router JSON",
      importPlaceholder: '{"aliases":{"fast":"or/meta-llama/..."}}',
      importButton: "导入 9router JSON",
      importing: "正在导入…",
      importPasteFirst: "请先粘贴 9router GET /api/models/alias 的 JSON。",
      importInvalidJson: "JSON 无效。",
      importFailed: "导入失败。",
      importSummary: "新增 {added}，更新 {updated}，跳过 {skipped}。"
    }
  },

  "zh-TW": {
    common: { save: "儲存", saved: "已儲存", auto: "自動", on: "開", off: "關" },
    shell: {
      dashboard: "儀表板",
      brandTagline: "智慧 AI 閘道",
      light: "淺色",
      dark: "深色",
      switchToLight: "切換到淺色主題",
      switchToDark: "切換到深色主題",
      clientKeys: "用戶端金鑰",
      provider: "供應商",
      bridge: "橋接",
      remoteAccess: "遠端存取",
      compressionProxy: "壓縮代理",
      updateAvailable: "有可用更新：v{version}",
      youAreOn: "目前版本 v{version}。",
      viewReleaseNotes: "查看發行說明",
      checkGithub: "請到 GitHub 查看最新版本。",
      dismissUpdate: "關閉更新橫幅",
      changePasswordTitle: "請修改暫時預設密碼",
      changePasswordBody: "請在下方「密碼」修改。儲存新密碼後即可解鎖其他選單。"
    },
    overview: {
      metricsAria: "總覽指標",
      spendToday: "今日花費",
      budgetLeft: "剩餘預算",
      providersActive: "作用中供應商",
      requests: "請求數",
      budgetGuardActive: "預算守護已啟用",
      savingsToday: "今日節省",
      savedAmount: "已節省 {amount}",
      noSavingsYet: "今天尚無節省",
      viaCache: "快取節省 {amount}",
      freeTierReq: "{count} 次免費檔請求",
      cacheHits: "{count} 次快取命中",
      systemStatus: "系統狀態",
      sqlite: "SQLite",
      encryptedKeys: "金鑰已加密",
      fallbackReady: "備援就緒"
    },
    routerPanel: {
      title: "路由器",
      laneAria: "路由通道",
      userApp: "使用者/應用",
      cache: "快取",
      budget: "預算",
      evaluator: "評估器",
      provider: "供應商",
      mode: "模式",
      strategy: "策略",
      fallback: "備援",
      active: "作用中",
      connected: "已連線",
      roundRobin: "輪詢",
      priority: "優先順序",
      unknown: "未知"
    },
    settings: {
      publicUrlSubtle: "公開 URL",
      domain: "網域",
      publicUrlBody:
        "填寫你在瀏覽器開啟的 HTTPS 網址（例如 https://nesa.example.com）。OAuth 與登入回跳會使用它，回到你的網域而非 localhost。",
      publicBaseUrl: "公開基礎 URL",
      budgetSubtle: "預算",
      limits: "限額",
      dailyBudget: "每日預算",
      dailyBudgetAria: "以美元計的每日預算",
      warningPct: "警告 %",
      criticalPct: "危急 %",
      mode: "模式",
      modeAuto: "自動",
      modeFree: "免費優先",
      modeCheap: "最便宜",
      modeBest: "最佳",
      modeManual: "手動",
      manualProvider: "手動供應商",
      selectProvider: "選擇供應商…",
      noActiveProviders: "沒有作用中供應商 — 請先在 Providers 啟用。",
      choosingSetsManual: "在此選擇供應商會自動將模式設為手動。然後按儲存。",
      pickProviderManual: "請在上方選擇供應商並儲存。未選擇前，手動模式不會路由。",
      selectedNotActive: "所選供應商未啟用 — 請在 Providers 啟用或另選。",
      providerStrategy: "供應商策略",
      priority: "優先順序",
      roundRobin: "輪詢",
      fallback: "備援",
      evaluator: "評估器",
      onWarning: "警告時",
      preferCheaper: "優先較便宜",
      notifyOnly: "僅通知",
      onCritical: "危急時",
      freeTierOnly: "僅免費檔",
      onExceeded: "超限時",
      blockPaid: "封鎖付費",
      allow: "允許",
      cache: "快取",
      freeTier: "免費檔",
      rtk: "RTK（壓縮 tool_result — git/grep/ls/logs）",
      headroomCompress: "Headroom 壓縮（外部代理）",
      headroomUrl: "Headroom URL",
      compressUserMessages: "同時壓縮使用者訊息",
      pxpipe: "pxpipe-lite（行程內工具壓縮）",
      upstreamLoad: "上游負載",
      concurrencyQueue: "並行佇列",
      concurrencyBody: "限制並行上游呼叫以保護速率限制。設為 0 表示不限制（預設）。",
      maxConcurrentGlobal: "最大並行（全域）",
      maxConcurrentPerProvider: "最大並行（每供應商）",
      queueWaitMs: "佇列等待（毫秒）",
      mediaApis: "媒體 API",
      mediaRouting: "媒體路由",
      mediaBody:
        "可將影像、語音、轉錄與嵌入固定到特定 OpenAI 相容供應商，或保持自動以使用主路由引擎。網頁搜尋使用內建 DuckDuckGo（無需供應商金鑰）。",
      images: "影像",
      speech: "語音（TTS）",
      transcriptions: "轉錄（STT）",
      embeddings: "嵌入",
      webSearch: "網頁搜尋",
      webSearchBuiltin: "內建（DuckDuckGo）",
      autoRouting: "自動（路由引擎）",
      caveman: "Caveman",
      ponytail: "Ponytail"
    },
    password: {
      admin: "管理員",
      title: "密碼",
      current: "目前密碼",
      next: "新密碼",
      save: "儲存密碼",
      updated: "密碼已更新。正在重新載入…",
      failed: "更新密碼失敗。"
    },
    aliases: {
      subtle: "短模型名稱",
      title: "別名",
      body: "將 model: \"fast\" 對應到供應商模型或組合。Codex 可用 cx/gpt-…，Claude 可用 cc/…，其他供應商使用對應短前綴。",
      empty: "尚無別名。",
      alias: "別名",
      target: "目標",
      targetPlaceholder: "供應商模型或組合名稱",
      add: "新增別名",
      delete: "刪除",
      importLabel: "匯入 9router JSON",
      importPlaceholder: '{"aliases":{"fast":"or/meta-llama/..."}}',
      importButton: "匯入 9router JSON",
      importing: "匯入中…",
      importPasteFirst: "請先貼上 9router GET /api/models/alias 的 JSON。",
      importInvalidJson: "JSON 無效。",
      importFailed: "匯入失敗。",
      importSummary: "新增 {added}，更新 {updated}，略過 {skipped}。"
    }
  },

  ja: {
    common: { save: "保存", saved: "保存済み", auto: "自動", on: "オン", off: "オフ" },
    shell: {
      dashboard: "ダッシュボード", brandTagline: "スマート AI ゲートウェイ", light: "ライト", dark: "ダーク",
      switchToLight: "ライトテーマに切替", switchToDark: "ダークテーマに切替", clientKeys: "クライアントキー", provider: "プロバイダー",
      bridge: "ブリッジ", remoteAccess: "リモートアクセス", compressionProxy: "圧縮プロキシ",
      updateAvailable: "更新あり: v{version}", youAreOn: "現在のバージョンは v{version} です。", viewReleaseNotes: "リリースノートを見る",
      checkGithub: "最新リリースを GitHub で確認してください。", dismissUpdate: "更新バナーを閉じる",
      changePasswordTitle: "一時的な初期パスワードを変更", changePasswordBody: "下の「パスワード」で変更してください。新しいパスワードを保存すると他のメニューが開きます。"
    },
    overview: {
      metricsAria: "概要メトリクス", spendToday: "本日の消費", budgetLeft: "残予算", providersActive: "稼働プロバイダー", requests: "リクエスト",
      budgetGuardActive: "予算ガード有効", savingsToday: "本日の節約", savedAmount: "{amount} 節約", noSavingsYet: "本日まだ節約なし",
      viaCache: "キャッシュ経由 {amount}", freeTierReq: "無料枠リクエスト {count}", cacheHits: "キャッシュヒット {count}",
      systemStatus: "システム状態", sqlite: "SQLite", encryptedKeys: "暗号化キー", fallbackReady: "フォールバック準備完了"
    },
    routerPanel: {
      title: "ルーター", laneAria: "ルーティングレーン", userApp: "ユーザー/アプリ", cache: "キャッシュ", budget: "予算", evaluator: "評価器",
      provider: "プロバイダー", mode: "モード", strategy: "戦略", fallback: "フォールバック", active: "稼働", connected: "接続済",
      roundRobin: "ラウンドロビン", priority: "優先度", unknown: "不明"
    },
    settings: {
      publicUrlSubtle: "公開 URL", domain: "ドメイン",
      publicUrlBody: "ブラウザで開く HTTPS URL（例: https://nesa.example.com）を設定します。OAuth とログイン後リダイレクトがこれを使い、localhost ではなくドメインに戻ります。",
      publicBaseUrl: "公開ベース URL", budgetSubtle: "予算", limits: "制限", dailyBudget: "日次予算", dailyBudgetAria: "米ドルの日次予算",
      warningPct: "警告 %", criticalPct: "緊急 %", mode: "モード", modeAuto: "自動", modeFree: "無料優先", modeCheap: "最安", modeBest: "最良", modeManual: "手動",
      manualProvider: "手動プロバイダー", selectProvider: "プロバイダーを選択…",
      noActiveProviders: "稼働中のプロバイダーがありません — Providers で有効化してください。",
      choosingSetsManual: "ここで選ぶとモードが自動的に手動になります。その後保存。",
      pickProviderManual: "上でプロバイダーを選び保存してください。未選択では手動モードはルーティングしません。",
      selectedNotActive: "選択中のプロバイダーは非稼働です — Providers で有効化するか別を選んでください。",
      providerStrategy: "プロバイダー戦略", priority: "優先度", roundRobin: "ラウンドロビン", fallback: "フォールバック", evaluator: "評価器",
      onWarning: "警告時", preferCheaper: "安い方を優先", notifyOnly: "通知のみ", onCritical: "緊急時", freeTierOnly: "無料枠のみ",
      onExceeded: "超過時", blockPaid: "有料をブロック", allow: "許可", cache: "キャッシュ", freeTier: "無料枠",
      rtk: "RTK（tool_result 圧縮 — git/grep/ls/logs）", headroomCompress: "Headroom 圧縮（外部プロキシ）", headroomUrl: "Headroom URL",
      compressUserMessages: "ユーザーメッセージも圧縮", pxpipe: "pxpipe-lite（プロセス内ツール圧縮）", upstreamLoad: "上流負荷",
      concurrencyQueue: "同時実行キュー", concurrencyBody: "レート制限保護のため上流の並列呼び出しを制限。0 は無制限（既定）。",
      maxConcurrentGlobal: "最大同時（全体）", maxConcurrentPerProvider: "最大同時（プロバイダー毎）", queueWaitMs: "キュー待機（ms）",
      mediaApis: "メディア API", mediaRouting: "メディアルーティング",
      mediaBody: "画像・音声・文字起こし・埋め込みを特定の OpenAI 互換プロバイダーに固定するか、自動のまま主ルーティングを使います。Web 検索は組み込み DuckDuckGo（キー不要）。",
      images: "画像", speech: "音声（TTS）", transcriptions: "文字起こし（STT）", embeddings: "埋め込み", webSearch: "Web 検索",
      webSearchBuiltin: "組み込み（DuckDuckGo）", autoRouting: "自動（ルーティングエンジン）", caveman: "Caveman", ponytail: "Ponytail"
    },
    password: { admin: "管理者", title: "パスワード", current: "現在のパスワード", next: "新しいパスワード", save: "パスワードを保存", updated: "パスワードを更新しました。再読み込み中…", failed: "パスワードの更新に失敗しました。" },
    aliases: {
      subtle: "短いモデル名", title: "エイリアス",
      body: "model: \"fast\" をプロバイダーモデルやコンボに対応づけます。Codex は cx/gpt-…、Claude は cc/…、他は短いプレフィックスを使います。",
      empty: "エイリアスはまだありません。", alias: "エイリアス", target: "ターゲット", targetPlaceholder: "プロバイダーモデルまたはコンボ名",
      add: "エイリアスを追加", delete: "削除", importLabel: "9router JSON をインポート", importPlaceholder: "{\"aliases\":{\"fast\":\"or/meta-llama/...\"}}",
      importButton: "9router JSON をインポート", importing: "インポート中…", importPasteFirst: "先に 9router GET /api/models/alias の JSON を貼り付けてください。",
      importInvalidJson: "JSON が無効です。", importFailed: "インポートに失敗しました。", importSummary: "{added} 件追加、{updated} 件更新、{skipped} 件スキップ。"
    }
  },

  ko: {
    common: { save: "저장", saved: "저장됨", auto: "자동", on: "켜짐", off: "꺼짐" },
    shell: {
      dashboard: "대시보드", brandTagline: "스마트 AI 게이트웨이", light: "라이트", dark: "다크",
      switchToLight: "라이트 테마로 전환", switchToDark: "다크 테마로 전환", clientKeys: "클라이언트 키", provider: "공급자",
      bridge: "브리지", remoteAccess: "원격 액세스", compressionProxy: "압축 프록시",
      updateAvailable: "업데이트 가능: v{version}", youAreOn: "현재 버전은 v{version}입니다.", viewReleaseNotes: "릴리스 노트 보기",
      checkGithub: "GitHub에서 최신 릴리스를 확인하세요.", dismissUpdate: "업데이트 배너 닫기",
      changePasswordTitle: "임시 기본 비밀번호 변경", changePasswordBody: "아래 비밀번호에서 변경하세요. 새 비밀번호를 저장하면 다른 메뉴가 잠금 해제됩니다."
    },
    overview: {
      metricsAria: "개요 지표", spendToday: "오늘 지출", budgetLeft: "남은 예산", providersActive: "활성 공급자", requests: "요청",
      budgetGuardActive: "예산 가드 활성", savingsToday: "오늘 절감", savedAmount: "{amount} 절감", noSavingsYet: "오늘 아직 절감 없음",
      viaCache: "캐시로 {amount}", freeTierReq: "무료 티어 요청 {count}", cacheHits: "캐시 히트 {count}",
      systemStatus: "시스템 상태", sqlite: "SQLite", encryptedKeys: "암호화된 키", fallbackReady: "폴백 준비됨"
    },
    routerPanel: {
      title: "라우터", laneAria: "라우팅 레인", userApp: "사용자/앱", cache: "캐시", budget: "예산", evaluator: "평가기",
      provider: "공급자", mode: "모드", strategy: "전략", fallback: "폴백", active: "활성", connected: "연결됨",
      roundRobin: "라운드 로빈", priority: "우선순위", unknown: "알 수 없음"
    },
    settings: {
      publicUrlSubtle: "공개 URL", domain: "도메인",
      publicUrlBody: "브라우저에서 여는 HTTPS URL(예: https://nesa.example.com)을 설정하세요. OAuth 및 로그인 리다이렉트가 이를 사용해 localhost가 아닌 도메인으로 돌아갑니다.",
      publicBaseUrl: "공개 베이스 URL", budgetSubtle: "예산", limits: "한도", dailyBudget: "일일 예산", dailyBudgetAria: "달러 기준 일일 예산",
      warningPct: "경고 %", criticalPct: "위험 %", mode: "모드", modeAuto: "자동", modeFree: "무료 우선", modeCheap: "최저가", modeBest: "최선", modeManual: "수동",
      manualProvider: "수동 공급자", selectProvider: "공급자 선택…",
      noActiveProviders: "활성 공급자가 없습니다 — Providers에서 먼저 활성화하세요.",
      choosingSetsManual: "여기서 선택하면 모드가 자동으로 수동이 됩니다. 그다음 저장.",
      pickProviderManual: "위에서 공급자를 고른 뒤 저장하세요. 선택 전에는 수동 모드가 라우팅하지 않습니다.",
      selectedNotActive: "선택한 공급자가 비활성입니다 — Providers에서 활성화하거나 다른 것을 고르세요.",
      providerStrategy: "공급자 전략", priority: "우선순위", roundRobin: "라운드 로빈", fallback: "폴백", evaluator: "평가기",
      onWarning: "경고 시", preferCheaper: "더 저렴한 쪽 선호", notifyOnly: "알림만", onCritical: "위험 시", freeTierOnly: "무료 티어만",
      onExceeded: "초과 시", blockPaid: "유료 차단", allow: "허용", cache: "캐시", freeTier: "무료 티어",
      rtk: "RTK(tool_result 압축 — git/grep/ls/logs)", headroomCompress: "Headroom 압축(외부 프록시)", headroomUrl: "Headroom URL",
      compressUserMessages: "사용자 메시지도 압축", pxpipe: "pxpipe-lite(프로세스 내 도구 압축)", upstreamLoad: "업스트림 부하",
      concurrencyQueue: "동시성 큐", concurrencyBody: "속도 제한을 보호하려면 병렬 업스트림 호출을 제한하세요. 0은 무제한(기본).",
      maxConcurrentGlobal: "최대 동시(전역)", maxConcurrentPerProvider: "최대 동시(공급자별)", queueWaitMs: "큐 대기(ms)",
      mediaApis: "미디어 API", mediaRouting: "미디어 라우팅",
      mediaBody: "이미지·음성·전사·임베딩을 특정 OpenAI 호환 공급자에 고정하거나 자동으로 주 라우팅을 사용합니다. 웹 검색은 내장 DuckDuckGo(키 불필요).",
      images: "이미지", speech: "음성(TTS)", transcriptions: "전사(STT)", embeddings: "임베딩", webSearch: "웹 검색",
      webSearchBuiltin: "내장(DuckDuckGo)", autoRouting: "자동(라우팅 엔진)", caveman: "Caveman", ponytail: "Ponytail"
    },
    password: { admin: "관리자", title: "비밀번호", current: "현재 비밀번호", next: "새 비밀번호", save: "비밀번호 저장", updated: "비밀번호가 업데이트되었습니다. 다시 불러오는 중…", failed: "비밀번호 업데이트에 실패했습니다." },
    aliases: {
      subtle: "짧은 모델 이름", title: "별칭",
      body: "model: \"fast\"를 공급자 모델이나 콤보에 매핑하세요. Codex는 cx/gpt-…, Claude는 cc/…, 다른 공급자는 짧은 접두사를 사용합니다.",
      empty: "아직 별칭이 없습니다.", alias: "별칭", target: "대상", targetPlaceholder: "공급자 모델 또는 콤보 이름",
      add: "별칭 추가", delete: "삭제", importLabel: "9router JSON 가져오기", importPlaceholder: "{\"aliases\":{\"fast\":\"or/meta-llama/...\"}}",
      importButton: "9router JSON 가져오기", importing: "가져오는 중…", importPasteFirst: "먼저 9router GET /api/models/alias JSON을 붙여넣으세요.",
      importInvalidJson: "잘못된 JSON입니다.", importFailed: "가져오기 실패.", importSummary: "{added} 추가, {updated} 업데이트, {skipped} 건너뜀."
    }
  },

  es: {
    common: { save: "Guardar", saved: "Guardado", auto: "Auto", on: "Activado", off: "Desactivado" },
    shell: {
      dashboard: "Panel", brandTagline: "Puerta de enlace de IA inteligente", light: "Claro", dark: "Oscuro",
      switchToLight: "Cambiar a tema claro", switchToDark: "Cambiar a tema oscuro", clientKeys: "Claves de cliente", provider: "Proveedor",
      bridge: "Puente", remoteAccess: "Acceso remoto", compressionProxy: "Proxy de compresión",
      updateAvailable: "Actualización disponible: v{version}", youAreOn: "Está en v{version}.", viewReleaseNotes: "Ver notas de la versión",
      checkGithub: "Consulte GitHub para la última versión.", dismissUpdate: "Cerrar banner de actualización",
      changePasswordTitle: "Cambie la contraseña predeterminada temporal", changePasswordBody: "Use Contraseña abajo. Los demás menús se desbloquean tras guardar una nueva contraseña."
    },
    overview: {
      metricsAria: "Métricas generales", spendToday: "Gasto de hoy", budgetLeft: "Presupuesto restante", providersActive: "Proveedores activos", requests: "Solicitudes",
      budgetGuardActive: "Protección de presupuesto activa", savingsToday: "Ahorro de hoy", savedAmount: "{amount} ahorrado", noSavingsYet: "Aún no hay ahorros hoy",
      viaCache: "{amount} vía caché", freeTierReq: "{count} req free-tier", cacheHits: "{count} aciertos de caché",
      systemStatus: "Estado del sistema", sqlite: "SQLite", encryptedKeys: "Claves cifradas", fallbackReady: "Fallback listo"
    },
    routerPanel: {
      title: "Enrutador", laneAria: "Carril de enrutamiento", userApp: "Usuario/App", cache: "Caché", budget: "Presupuesto", evaluator: "Evaluador",
      provider: "Proveedor", mode: "Modo", strategy: "Estrategia", fallback: "Fallback", active: "Activo", connected: "Conectado",
      roundRobin: "Round robin", priority: "Prioridad", unknown: "desconocido"
    },
    settings: {
      publicUrlSubtle: "URL pública", domain: "Dominio",
      publicUrlBody: "Configure la URL HTTPS que abre en el navegador (p. ej. https://nesa.example.com). OAuth y las redirecciones tras el login la usan para volver a su dominio en lugar de localhost.",
      publicBaseUrl: "URL base pública", budgetSubtle: "Presupuesto", limits: "Límites", dailyBudget: "Presupuesto diario", dailyBudgetAria: "Presupuesto diario en dólares estadounidenses",
      warningPct: "Aviso %", criticalPct: "Crítico %", mode: "Modo", modeAuto: "Auto", modeFree: "Gratis", modeCheap: "Barato", modeBest: "Mejor", modeManual: "Manual",
      manualProvider: "Proveedor manual", selectProvider: "Seleccionar proveedor…",
      noActiveProviders: "No hay proveedores activos — active uno en Providers primero.",
      choosingSetsManual: "Elegir un proveedor aquí pone el Modo en Manual automáticamente. Luego Guarde.",
      pickProviderManual: "Elija un proveedor arriba y Guarde. El modo Manual no enruta hasta que haya uno seleccionado.",
      selectedNotActive: "El proveedor seleccionado no está activo — actívelo en Providers o elija otro.",
      providerStrategy: "Estrategia de proveedor", priority: "Prioridad", roundRobin: "Round robin", fallback: "Fallback", evaluator: "Evaluador",
      onWarning: "En aviso", preferCheaper: "Preferir más barato", notifyOnly: "Solo notificar", onCritical: "En crítico", freeTierOnly: "Solo free / free-tier",
      onExceeded: "Al exceder", blockPaid: "Bloquear de pago", allow: "Permitir", cache: "Caché", freeTier: "Free tier",
      rtk: "RTK (comprimir tool_result — git/grep/ls/logs)", headroomCompress: "Compresión Headroom (proxy externo)", headroomUrl: "URL Headroom",
      compressUserMessages: "También comprimir mensajes de usuario", pxpipe: "pxpipe-lite (compresión de herramientas en proceso)", upstreamLoad: "Carga upstream",
      concurrencyQueue: "Cola de concurrencia", concurrencyBody: "Limite llamadas upstream paralelas para proteger rate limits. 0 = ilimitado (predeterminado).",
      maxConcurrentGlobal: "Máx. concurrentes (global)", maxConcurrentPerProvider: "Máx. concurrentes (por proveedor)", queueWaitMs: "Espera de cola (ms)",
      mediaApis: "APIs multimedia", mediaRouting: "Enrutamiento multimedia",
      mediaBody: "Fije imágenes, voz, transcripciones y embeddings a un proveedor compatible con OpenAI, o deje Auto para el motor principal. La búsqueda web usa DuckDuckGo integrado (sin clave).",
      images: "Imágenes", speech: "Voz (TTS)", transcriptions: "Transcripciones (STT)", embeddings: "Embeddings", webSearch: "Búsqueda web",
      webSearchBuiltin: "Integrado (DuckDuckGo)", autoRouting: "Auto (motor de enrutamiento)", caveman: "Caveman", ponytail: "Ponytail"
    },
    password: { admin: "Admin", title: "Contraseña", current: "Contraseña actual", next: "Nueva contraseña", save: "Guardar contraseña", updated: "Contraseña actualizada. Recargando…", failed: "Error al actualizar la contraseña." },
    aliases: {
      subtle: "Nombres cortos de modelo", title: "Alias",
      body: "Mapee model: \"fast\" a un modelo de proveedor o combo. Codex con cx/gpt-…, Claude con cc/…, y otros con sus prefijos cortos.",
      empty: "Aún no hay alias.", alias: "Alias", target: "Destino", targetPlaceholder: "modelo de proveedor o nombre de combo",
      add: "Añadir alias", delete: "Eliminar", importLabel: "Importar JSON 9router", importPlaceholder: "{\"aliases\":{\"fast\":\"or/meta-llama/...\"}}",
      importButton: "Importar JSON 9router", importing: "Importando…", importPasteFirst: "Pegue primero el JSON de 9router GET /api/models/alias.",
      importInvalidJson: "JSON no válido.", importFailed: "Error al importar.", importSummary: "{added} añadidos, {updated} actualizados, {skipped} omitidos."
    }
  },

  fr: {
    common: { save: "Enregistrer", saved: "Enregistré", auto: "Auto", on: "Activé", off: "Désactivé" },
    shell: {
      dashboard: "Tableau de bord", brandTagline: "Passerelle IA intelligente", light: "Clair", dark: "Sombre",
      switchToLight: "Passer au thème clair", switchToDark: "Passer au thème sombre", clientKeys: "Clés client", provider: "Fournisseur",
      bridge: "Pont", remoteAccess: "Accès distant", compressionProxy: "Proxy de compression",
      updateAvailable: "Mise à jour disponible : v{version}", youAreOn: "Vous êtes en v{version}.", viewReleaseNotes: "Voir les notes de version",
      checkGithub: "Consultez GitHub pour la dernière version.", dismissUpdate: "Fermer la bannière de mise à jour",
      changePasswordTitle: "Changez le mot de passe temporaire par défaut", changePasswordBody: "Utilisez Mot de passe ci-dessous. Les autres menus se déverrouillent après l’enregistrement d’un nouveau mot de passe."
    },
    overview: {
      metricsAria: "Indicateurs d’aperçu", spendToday: "Dépenses du jour", budgetLeft: "Budget restant", providersActive: "Fournisseurs actifs", requests: "Requêtes",
      budgetGuardActive: "Garde de budget active", savingsToday: "Économies du jour", savedAmount: "{amount} économisés", noSavingsYet: "Pas encore d’économies aujourd’hui",
      viaCache: "{amount} via le cache", freeTierReq: "{count} req free-tier", cacheHits: "{count} succès cache",
      systemStatus: "État du système", sqlite: "SQLite", encryptedKeys: "Clés chiffrées", fallbackReady: "Fallback prêt"
    },
    routerPanel: {
      title: "Routeur", laneAria: "Voie de routage", userApp: "Utilisateur/App", cache: "Cache", budget: "Budget", evaluator: "Évaluateur",
      provider: "Fournisseur", mode: "Mode", strategy: "Stratégie", fallback: "Fallback", active: "Actif", connected: "Connecté",
      roundRobin: "Round robin", priority: "Priorité", unknown: "inconnu"
    },
    settings: {
      publicUrlSubtle: "URL publique", domain: "Domaine",
      publicUrlBody: "Indiquez l’URL HTTPS ouverte dans le navigateur (ex. https://nesa.example.com). OAuth et les redirections post-connexion l’utilisent pour revenir à votre domaine plutôt qu’à localhost.",
      publicBaseUrl: "URL de base publique", budgetSubtle: "Budget", limits: "Limites", dailyBudget: "Budget quotidien", dailyBudgetAria: "Budget quotidien en dollars US",
      warningPct: "Alerte %", criticalPct: "Critique %", mode: "Mode", modeAuto: "Auto", modeFree: "Gratuit", modeCheap: "Pas cher", modeBest: "Meilleur", modeManual: "Manuel",
      manualProvider: "Fournisseur manuel", selectProvider: "Sélectionner un fournisseur…",
      noActiveProviders: "Aucun fournisseur actif — activez-en un dans Providers d’abord.",
      choosingSetsManual: "Choisir un fournisseur ici passe le Mode en Manuel automatiquement. Puis Enregistrer.",
      pickProviderManual: "Choisissez un fournisseur ci-dessus puis Enregistrer. Le mode Manuel ne route pas tant qu’aucun n’est sélectionné.",
      selectedNotActive: "Le fournisseur sélectionné n’est pas actif — activez-le dans Providers ou choisissez-en un autre.",
      providerStrategy: "Stratégie fournisseur", priority: "Priorité", roundRobin: "Round robin", fallback: "Fallback", evaluator: "Évaluateur",
      onWarning: "En alerte", preferCheaper: "Préférer moins cher", notifyOnly: "Notifier seulement", onCritical: "En critique", freeTierOnly: "Free / free-tier seulement",
      onExceeded: "En dépassement", blockPaid: "Bloquer le payant", allow: "Autoriser", cache: "Cache", freeTier: "Free tier",
      rtk: "RTK (compresser tool_result — git/grep/ls/logs)", headroomCompress: "Compression Headroom (proxy externe)", headroomUrl: "URL Headroom",
      compressUserMessages: "Compresser aussi les messages utilisateur", pxpipe: "pxpipe-lite (compression d’outils in-process)", upstreamLoad: "Charge upstream",
      concurrencyQueue: "File de concurrence", concurrencyBody: "Limitez les appels upstream parallèles pour protéger les rate limits. 0 = illimité (défaut).",
      maxConcurrentGlobal: "Max concurrent (global)", maxConcurrentPerProvider: "Max concurrent (par fournisseur)", queueWaitMs: "Attente file (ms)",
      mediaApis: "API média", mediaRouting: "Routage média",
      mediaBody: "Épinglez images, parole, transcriptions et embeddings à un fournisseur compatible OpenAI, ou laissez Auto pour le moteur principal. La recherche web utilise DuckDuckGo intégré (sans clé).",
      images: "Images", speech: "Parole (TTS)", transcriptions: "Transcriptions (STT)", embeddings: "Embeddings", webSearch: "Recherche web",
      webSearchBuiltin: "Intégré (DuckDuckGo)", autoRouting: "Auto (moteur de routage)", caveman: "Caveman", ponytail: "Ponytail"
    },
    password: { admin: "Admin", title: "Mot de passe", current: "Mot de passe actuel", next: "Nouveau mot de passe", save: "Enregistrer le mot de passe", updated: "Mot de passe mis à jour. Rechargement…", failed: "Échec de la mise à jour du mot de passe." },
    aliases: {
      subtle: "Noms de modèle courts", title: "Alias",
      body: "Mappez model: \"fast\" vers un modèle fournisseur ou un combo. Codex avec cx/gpt-…, Claude avec cc/…, et les autres avec leurs préfixes courts.",
      empty: "Aucun alias pour l’instant.", alias: "Alias", target: "Cible", targetPlaceholder: "modèle fournisseur ou nom de combo",
      add: "Ajouter un alias", delete: "Supprimer", importLabel: "Importer JSON 9router", importPlaceholder: "{\"aliases\":{\"fast\":\"or/meta-llama/...\"}}",
      importButton: "Importer JSON 9router", importing: "Importation…", importPasteFirst: "Collez d’abord le JSON de 9router GET /api/models/alias.",
      importInvalidJson: "JSON invalide.", importFailed: "Échec de l’import.", importSummary: "{added} ajoutés, {updated} mis à jour, {skipped} ignorés."
    }
  },

  de: {
    common: { save: "Speichern", saved: "Gespeichert", auto: "Auto", on: "An", off: "Aus" },
    shell: {
      dashboard: "Dashboard", brandTagline: "Intelligentes KI-Gateway", light: "Hell", dark: "Dunkel",
      switchToLight: "Zum hellen Theme wechseln", switchToDark: "Zum dunklen Theme wechseln", clientKeys: "Client-Schlüssel", provider: "Anbieter",
      bridge: "Bridge", remoteAccess: "Fernzugriff", compressionProxy: "Kompressionsproxy",
      updateAvailable: "Update verfügbar: v{version}", youAreOn: "Sie sind auf v{version}.", viewReleaseNotes: "Versionshinweise ansehen",
      checkGithub: "Prüfen Sie GitHub auf die neueste Version.", dismissUpdate: "Update-Banner schließen",
      changePasswordTitle: "Temporäres Standardpasswort ändern", changePasswordBody: "Nutzen Sie Passwort unten. Andere Menüs entsperren nach dem Speichern eines neuen Passworts."
    },
    overview: {
      metricsAria: "Übersichtsmetriken", spendToday: "Ausgaben heute", budgetLeft: "Restbudget", providersActive: "Aktive Anbieter", requests: "Anfragen",
      budgetGuardActive: "Budgetschutz aktiv", savingsToday: "Ersparnis heute", savedAmount: "{amount} gespart", noSavingsYet: "Heute noch keine Ersparnis",
      viaCache: "{amount} über Cache", freeTierReq: "{count} Free-Tier-Anfragen", cacheHits: "{count} Cache-Treffer",
      systemStatus: "Systemstatus", sqlite: "SQLite", encryptedKeys: "Verschlüsselte Schlüssel", fallbackReady: "Fallback bereit"
    },
    routerPanel: {
      title: "Router", laneAria: "Routing-Spur", userApp: "Nutzer/App", cache: "Cache", budget: "Budget", evaluator: "Evaluator",
      provider: "Anbieter", mode: "Modus", strategy: "Strategie", fallback: "Fallback", active: "Aktiv", connected: "Verbunden",
      roundRobin: "Round robin", priority: "Priorität", unknown: "unbekannt"
    },
    settings: {
      publicUrlSubtle: "Öffentliche URL", domain: "Domain",
      publicUrlBody: "Setzen Sie die HTTPS-URL, die Sie im Browser öffnen (z. B. https://nesa.example.com). OAuth und Login-Weiterleitungen nutzen sie, um zu Ihrer Domain statt localhost zurückzukehren.",
      publicBaseUrl: "Öffentliche Basis-URL", budgetSubtle: "Budget", limits: "Limits", dailyBudget: "Tagesbudget", dailyBudgetAria: "Tagesbudget in US-Dollar",
      warningPct: "Warnung %", criticalPct: "Kritisch %", mode: "Modus", modeAuto: "Auto", modeFree: "Kostenlos", modeCheap: "Günstig", modeBest: "Beste", modeManual: "Manuell",
      manualProvider: "Manueller Anbieter", selectProvider: "Anbieter wählen…",
      noActiveProviders: "Keine aktiven Anbieter — aktivieren Sie zuerst einen unter Providers.",
      choosingSetsManual: "Die Auswahl hier setzt den Modus automatisch auf Manuell. Dann Speichern.",
      pickProviderManual: "Wählen Sie oben einen Anbieter und Speichern. Manuell routet nicht, bis einer gewählt ist.",
      selectedNotActive: "Gewählter Anbieter ist nicht aktiv — unter Providers aktivieren oder einen anderen wählen.",
      providerStrategy: "Anbieterstrategie", priority: "Priorität", roundRobin: "Round robin", fallback: "Fallback", evaluator: "Evaluator",
      onWarning: "Bei Warnung", preferCheaper: "Günstiger bevorzugen", notifyOnly: "Nur benachrichtigen", onCritical: "Bei kritisch", freeTierOnly: "Nur Free / Free-Tier",
      onExceeded: "Bei Überschreitung", blockPaid: "Kostenpflichtig blockieren", allow: "Erlauben", cache: "Cache", freeTier: "Free-Tier",
      rtk: "RTK (tool_result komprimieren — git/grep/ls/logs)", headroomCompress: "Headroom-Kompression (externer Proxy)", headroomUrl: "Headroom-URL",
      compressUserMessages: "Auch Benutzernachrichten komprimieren", pxpipe: "pxpipe-lite (In-Prozess-Tool-Kompression)", upstreamLoad: "Upstream-Last",
      concurrencyQueue: "Concurrency-Warteschlange", concurrencyBody: "Begrenzen Sie parallele Upstream-Aufrufe zum Schutz vor Rate Limits. 0 = unbegrenzt (Standard).",
      maxConcurrentGlobal: "Max. gleichzeitig (global)", maxConcurrentPerProvider: "Max. gleichzeitig (pro Anbieter)", queueWaitMs: "Wartezeit (ms)",
      mediaApis: "Medien-APIs", mediaRouting: "Medien-Routing",
      mediaBody: "Bilder, Sprache, Transkriptionen und Embeddings an einen OpenAI-kompatiblen Anbieter pinnen oder Auto für die Hauptingine belassen. Websuche nutzt eingebautes DuckDuckGo (kein Schlüssel).",
      images: "Bilder", speech: "Sprache (TTS)", transcriptions: "Transkriptionen (STT)", embeddings: "Embeddings", webSearch: "Websuche",
      webSearchBuiltin: "Eingebaut (DuckDuckGo)", autoRouting: "Auto (Routing-Engine)", caveman: "Caveman", ponytail: "Ponytail"
    },
    password: { admin: "Admin", title: "Passwort", current: "Aktuelles Passwort", next: "Neues Passwort", save: "Passwort speichern", updated: "Passwort aktualisiert. Wird neu geladen…", failed: "Passwort konnte nicht aktualisiert werden." },
    aliases: {
      subtle: "Kurze Modellnamen", title: "Aliasse",
      body: "Mappe model: \"fast\" auf ein Anbietermodell oder Combo. Codex mit cx/gpt-…, Claude mit cc/…, andere mit kurzen Präfixen.",
      empty: "Noch keine Aliasse.", alias: "Alias", target: "Ziel", targetPlaceholder: "Anbietermodell oder Combo-Name",
      add: "Alias hinzufügen", delete: "Löschen", importLabel: "9router-JSON importieren", importPlaceholder: "{\"aliases\":{\"fast\":\"or/meta-llama/...\"}}",
      importButton: "9router-JSON importieren", importing: "Importiere…", importPasteFirst: "Fügen Sie zuerst das JSON von 9router GET /api/models/alias ein.",
      importInvalidJson: "Ungültiges JSON.", importFailed: "Import fehlgeschlagen.",       importSummary: "{added} hinzugefügt, {updated} aktualisiert, {skipped} übersprungen."
    }
  },

  ar: {
    common: { save: "حفظ", saved: "تم الحفظ", auto: "تلقائي", on: "تشغيل", off: "إيقاف" },
    shell: {
      dashboard: "لوحة التحكم", brandTagline: "بوابة ذكاء اصطناعي ذكية", light: "فاتح", dark: "داكن",
      switchToLight: "التبديل إلى الوضع الفاتح", switchToDark: "التبديل إلى الوضع الداكن", clientKeys: "مفاتيح العميل", provider: "المزوّد",
      bridge: "جسر", remoteAccess: "وصول عن بُعد", compressionProxy: "وكيل ضغط",
      updateAvailable: "يتوفر تحديث: v{version}", youAreOn: "أنت على v{version}.", viewReleaseNotes: "عرض ملاحظات الإصدار",
      checkGithub: "تحقق من GitHub لأحدث إصدار.", dismissUpdate: "إغلاق شريط التحديث",
      changePasswordTitle: "غيّر كلمة المرور الافتراضية المؤقتة", changePasswordBody: "استخدم كلمة المرور أدناه. تُفتح القوائم الأخرى بعد حفظ كلمة مرور جديدة."
    },
    overview: {
      metricsAria: "مقاييس النظرة العامة", spendToday: "إنفاق اليوم", budgetLeft: "الميزانية المتبقية", providersActive: "المزوّدون النشطون", requests: "الطلبات",
      budgetGuardActive: "حارس الميزانية نشط", savingsToday: "توفير اليوم", savedAmount: "وُفّر {amount}", noSavingsYet: "لا توفير بعد اليوم",
      viaCache: "{amount} عبر التخزين المؤقت", freeTierReq: "{count} طلب free-tier", cacheHits: "{count} إصابة تخزين مؤقت",
      systemStatus: "حالة النظام", sqlite: "SQLite", encryptedKeys: "مفاتيح مشفّرة", fallbackReady: "البديل جاهز"
    },
    routerPanel: {
      title: "الموجّه", laneAria: "مسار التوجيه", userApp: "مستخدم/تطبيق", cache: "تخزين مؤقت", budget: "ميزانية", evaluator: "مقيّم",
      provider: "مزوّد", mode: "الوضع", strategy: "الاستراتيجية", fallback: "بديل", active: "نشط", connected: "متصل",
      roundRobin: "توزيع دوري", priority: "أولوية", unknown: "غير معروف"
    },
    settings: {
      publicUrlSubtle: "عنوان عام", domain: "النطاق",
      publicUrlBody: "عيّن عنوان HTTPS الذي تفتحه في المتصفح (مثل https://nesa.example.com). يستخدمه OAuth وإعادة التوجيه بعد تسجيل الدخول للعودة إلى نطاقك بدل localhost.",
      publicBaseUrl: "عنوان الأساس العام", budgetSubtle: "الميزانية", limits: "الحدود", dailyBudget: "الميزانية اليومية", dailyBudgetAria: "الميزانية اليومية بالدولار الأمريكي",
      warningPct: "تحذير %", criticalPct: "حرج %", mode: "الوضع", modeAuto: "تلقائي", modeFree: "مجاني", modeCheap: "أرخص", modeBest: "الأفضل", modeManual: "يدوي",
      manualProvider: "مزوّد يدوي", selectProvider: "اختر مزوّدًا…",
      noActiveProviders: "لا مزوّدين نشطين — فعّل واحدًا في Providers أولًا.",
      choosingSetsManual: "اختيار مزوّد هنا يضبط الوضع إلى يدوي تلقائيًا. ثم احفظ.",
      pickProviderManual: "اختر مزوّدًا أعلاه ثم احفظ. الوضع اليدوي لا يوجّه حتى يُختار مزوّد.",
      selectedNotActive: "المزوّد المحدد غير نشط — فعّله في Providers أو اختر آخر.",
      providerStrategy: "استراتيجية المزوّد", priority: "أولوية", roundRobin: "توزيع دوري", fallback: "بديل", evaluator: "مقيّم",
      onWarning: "عند التحذير", preferCheaper: "تفضيل الأرخص", notifyOnly: "إشعار فقط", onCritical: "عند الحرج", freeTierOnly: "مجاني / free-tier فقط",
      onExceeded: "عند التجاوز", blockPaid: "حظر المدفوع", allow: "سماح", cache: "تخزين مؤقت", freeTier: "Free tier",
      rtk: "RTK (ضغط tool_result — git/grep/ls/logs)", headroomCompress: "ضغط Headroom (وكيل خارجي)", headroomUrl: "عنوان Headroom",
      compressUserMessages: "ضغط رسائل المستخدم أيضًا", pxpipe: "pxpipe-lite (ضغط أدوات داخل العملية)", upstreamLoad: "حمل المنبع",
      concurrencyQueue: "طابور التزامن", concurrencyBody: "حدّ استدعاءات المنبع المتوازية لحماية حدود المعدل. 0 = بلا حد (افتراضي).",
      maxConcurrentGlobal: "أقصى تزامن (عام)", maxConcurrentPerProvider: "أقصى تزامن (لكل مزوّد)", queueWaitMs: "انتظار الطابور (ملث)",
      mediaApis: "واجهات وسائط", mediaRouting: "توجيه الوسائط",
      mediaBody: "ثبّت الصور والصوت والنسخ والتضمين إلى مزوّد متوافق مع OpenAI، أو اترك تلقائي لمحرك التوجيه الرئيسي. بحث الويب يستخدم DuckDuckGo المدمج (بدون مفتاح).",
      images: "صور", speech: "كلام (TTS)", transcriptions: "نسخ (STT)", embeddings: "تضمين", webSearch: "بحث ويب",
      webSearchBuiltin: "مدمج (DuckDuckGo)", autoRouting: "تلقائي (محرك التوجيه)", caveman: "Caveman", ponytail: "Ponytail"
    },
    password: { admin: "المسؤول", title: "كلمة المرور", current: "كلمة المرور الحالية", next: "كلمة مرور جديدة", save: "حفظ كلمة المرور", updated: "تم تحديث كلمة المرور. جارٍ إعادة التحميل…", failed: "فشل تحديث كلمة المرور." },
    aliases: {
      subtle: "أسماء نماذج قصيرة", title: "أسماء مستعارة",
      body: "اربط model: \"fast\" بنموذج مزوّد أو مجموعة. Codex بـ cx/gpt-… وClaude بـ cc/… والبقية ببادئات قصيرة.",
      empty: "لا أسماء مستعارة بعد.", alias: "اسم مستعار", target: "الهدف", targetPlaceholder: "نموذج مزوّد أو اسم مجموعة",
      add: "إضافة اسم مستعار", delete: "حذف", importLabel: "استيراد JSON 9router", importPlaceholder: "{\"aliases\":{\"fast\":\"or/meta-llama/...\"}}",
      importButton: "استيراد JSON 9router", importing: "جارٍ الاستيراد…", importPasteFirst: "الصق أولًا JSON من 9router GET /api/models/alias.",
      importInvalidJson: "JSON غير صالح.", importFailed: "فشل الاستيراد.", importSummary: "{added} أُضيف، {updated} حُدّث، {skipped} تُخطّي."
    }
  },

  ru: {
    common: { save: "Сохранить", saved: "Сохранено", auto: "Авто", on: "Вкл", off: "Выкл" },
    shell: {
      dashboard: "Панель", brandTagline: "Умный AI-шлюз", light: "Светлая", dark: "Тёмная",
      switchToLight: "Переключить на светлую тему", switchToDark: "Переключить на тёмную тему", clientKeys: "Клиентские ключи", provider: "Провайдер",
      bridge: "Мост", remoteAccess: "Удалённый доступ", compressionProxy: "Прокси сжатия",
      updateAvailable: "Доступно обновление: v{version}", youAreOn: "У вас v{version}.", viewReleaseNotes: "Смотреть заметки о выпуске",
      checkGithub: "Проверьте GitHub на последний релиз.", dismissUpdate: "Закрыть баннер обновления",
      changePasswordTitle: "Смените временный пароль по умолчанию", changePasswordBody: "Используйте «Пароль» ниже. Другие меню откроются после сохранения нового пароля."
    },
    overview: {
      metricsAria: "Метрики обзора", spendToday: "Расход сегодня", budgetLeft: "Остаток бюджета", providersActive: "Активные провайдеры", requests: "Запросы",
      budgetGuardActive: "Защита бюджета активна", savingsToday: "Экономия сегодня", savedAmount: "Сэкономлено {amount}", noSavingsYet: "Сегодня пока нет экономии",
      viaCache: "{amount} через кэш", freeTierReq: "{count} free-tier запросов", cacheHits: "{count} попаданий в кэш",
      systemStatus: "Состояние системы", sqlite: "SQLite", encryptedKeys: "Зашифрованные ключи", fallbackReady: "Fallback готов"
    },
    routerPanel: {
      title: "Маршрутизатор", laneAria: "Полоса маршрутизации", userApp: "Пользователь/приложение", cache: "Кэш", budget: "Бюджет", evaluator: "Оценщик",
      provider: "Провайдер", mode: "Режим", strategy: "Стратегия", fallback: "Fallback", active: "Активен", connected: "Подключён",
      roundRobin: "Round robin", priority: "Приоритет", unknown: "неизвестно"
    },
    settings: {
      publicUrlSubtle: "Публичный URL", domain: "Домен",
      publicUrlBody: "Укажите HTTPS URL, который открываете в браузере (напр. https://nesa.example.com). OAuth и редиректы после входа используют его, чтобы вернуться на ваш домен, а не на localhost.",
      publicBaseUrl: "Публичный базовый URL", budgetSubtle: "Бюджет", limits: "Лимиты", dailyBudget: "Дневной бюджет", dailyBudgetAria: "Дневной бюджет в долларах США",
      warningPct: "Предупреждение %", criticalPct: "Критично %", mode: "Режим", modeAuto: "Авто", modeFree: "Бесплатный", modeCheap: "Дешёвый", modeBest: "Лучший", modeManual: "Ручной",
      manualProvider: "Ручной провайдер", selectProvider: "Выберите провайдера…",
      noActiveProviders: "Нет активных провайдеров — сначала включите в Providers.",
      choosingSetsManual: "Выбор провайдера здесь автоматически ставит режим Manual. Затем Сохранить.",
      pickProviderManual: "Выберите провайдера выше и Сохраните. Ручной режим не маршрутизирует, пока провайдер не выбран.",
      selectedNotActive: "Выбранный провайдер неактивен — включите в Providers или выберите другого.",
      providerStrategy: "Стратегия провайдера", priority: "Приоритет", roundRobin: "Round robin", fallback: "Fallback", evaluator: "Оценщик",
      onWarning: "При предупреждении", preferCheaper: "Предпочитать дешевле", notifyOnly: "Только уведомление", onCritical: "При критическом", freeTierOnly: "Только free / free-tier",
      onExceeded: "При превышении", blockPaid: "Блокировать платные", allow: "Разрешить", cache: "Кэш", freeTier: "Free tier",
      rtk: "RTK (сжимать tool_result — git/grep/ls/logs)", headroomCompress: "Сжатие Headroom (внешний прокси)", headroomUrl: "URL Headroom",
      compressUserMessages: "Также сжимать сообщения пользователя", pxpipe: "pxpipe-lite (сжатие инструментов в процессе)", upstreamLoad: "Нагрузка upstream",
      concurrencyQueue: "Очередь параллелизма", concurrencyBody: "Ограничьте параллельные upstream-вызовы для защиты rate limit. 0 = без лимита (по умолчанию).",
      maxConcurrentGlobal: "Макс. параллельно (глобально)", maxConcurrentPerProvider: "Макс. параллельно (на провайдера)", queueWaitMs: "Ожидание очереди (мс)",
      mediaApis: "Медиа API", mediaRouting: "Маршрутизация медиа",
      mediaBody: "Закрепите изображения, речь, транскрипции и embeddings за OpenAI-совместимым провайдером или оставьте Auto для основного движка. Веб-поиск — встроенный DuckDuckGo (без ключа).",
      images: "Изображения", speech: "Речь (TTS)", transcriptions: "Транскрипции (STT)", embeddings: "Embeddings", webSearch: "Веб-поиск",
      webSearchBuiltin: "Встроенный (DuckDuckGo)", autoRouting: "Авто (движок маршрутизации)", caveman: "Caveman", ponytail: "Ponytail"
    },
    password: { admin: "Админ", title: "Пароль", current: "Текущий пароль", next: "Новый пароль", save: "Сохранить пароль", updated: "Пароль обновлён. Перезагрузка…", failed: "Не удалось обновить пароль." },
    aliases: {
      subtle: "Короткие имена моделей", title: "Псевдонимы",
      body: "Сопоставьте model: \"fast\" с моделью провайдера или combo. Codex — cx/gpt-…, Claude — cc/…, остальные — короткие префиксы.",
      empty: "Псевдонимов пока нет.", alias: "Псевдоним", target: "Цель", targetPlaceholder: "модель провайдера или имя combo",
      add: "Добавить псевдоним", delete: "Удалить", importLabel: "Импорт JSON 9router", importPlaceholder: "{\"aliases\":{\"fast\":\"or/meta-llama/...\"}}",
      importButton: "Импорт JSON 9router", importing: "Импорт…", importPasteFirst: "Сначала вставьте JSON из 9router GET /api/models/alias.",
      importInvalidJson: "Некорректный JSON.", importFailed: "Ошибка импорта.", importSummary: "{added} добавлено, {updated} обновлено, {skipped} пропущено."
    }
  },

  pt: {
    common: { save: "Salvar", saved: "Salvo", auto: "Auto", on: "Ativado", off: "Desativado" },
    shell: {
      dashboard: "Painel", brandTagline: "Gateway de IA inteligente", light: "Claro", dark: "Escuro",
      switchToLight: "Mudar para tema claro", switchToDark: "Mudar para tema escuro", clientKeys: "Chaves do cliente", provider: "Provedor",
      bridge: "Ponte", remoteAccess: "Acesso remoto", compressionProxy: "Proxy de compressão",
      updateAvailable: "Atualização disponível: v{version}", youAreOn: "Você está em v{version}.", viewReleaseNotes: "Ver notas da versão",
      checkGithub: "Confira o GitHub para a versão mais recente.", dismissUpdate: "Fechar banner de atualização",
      changePasswordTitle: "Altere a senha padrão temporária", changePasswordBody: "Use Senha abaixo. Outros menus desbloqueiam após salvar uma nova senha."
    },
    overview: {
      metricsAria: "Métricas gerais", spendToday: "Gasto de hoje", budgetLeft: "Orçamento restante", providersActive: "Provedores ativos", requests: "Requisições",
      budgetGuardActive: "Guarda de orçamento ativa", savingsToday: "Economia de hoje", savedAmount: "{amount} economizados", noSavingsYet: "Ainda sem economia hoje",
      viaCache: "{amount} via cache", freeTierReq: "{count} req free-tier", cacheHits: "{count} acertos de cache",
      systemStatus: "Status do sistema", sqlite: "SQLite", encryptedKeys: "Chaves criptografadas", fallbackReady: "Fallback pronto"
    },
    routerPanel: {
      title: "Roteador", laneAria: "Faixa de roteamento", userApp: "Usuário/App", cache: "Cache", budget: "Orçamento", evaluator: "Avaliador",
      provider: "Provedor", mode: "Modo", strategy: "Estratégia", fallback: "Fallback", active: "Ativo", connected: "Conectado",
      roundRobin: "Round robin", priority: "Prioridade", unknown: "desconhecido"
    },
    settings: {
      publicUrlSubtle: "URL pública", domain: "Domínio",
      publicUrlBody: "Defina a URL HTTPS que você abre no navegador (ex.: https://nesa.example.com). OAuth e redirecionamentos pós-login usam isso para voltar ao seu domínio em vez de localhost.",
      publicBaseUrl: "URL base pública", budgetSubtle: "Orçamento", limits: "Limites", dailyBudget: "Orçamento diário", dailyBudgetAria: "Orçamento diário em dólares dos EUA",
      warningPct: "Aviso %", criticalPct: "Crítico %", mode: "Modo", modeAuto: "Auto", modeFree: "Grátis", modeCheap: "Barato", modeBest: "Melhor", modeManual: "Manual",
      manualProvider: "Provedor manual", selectProvider: "Selecionar provedor…",
      noActiveProviders: "Nenhum provedor ativo — ative um em Providers primeiro.",
      choosingSetsManual: "Escolher um provedor aqui define o Modo como Manual automaticamente. Depois Salve.",
      pickProviderManual: "Escolha um provedor acima e Salve. O modo Manual não roteia até haver um selecionado.",
      selectedNotActive: "O provedor selecionado não está ativo — ative em Providers ou escolha outro.",
      providerStrategy: "Estratégia de provedor", priority: "Prioridade", roundRobin: "Round robin", fallback: "Fallback", evaluator: "Avaliador",
      onWarning: "No aviso", preferCheaper: "Preferir mais barato", notifyOnly: "Apenas notificar", onCritical: "No crítico", freeTierOnly: "Somente free / free-tier",
      onExceeded: "Ao exceder", blockPaid: "Bloquear pago", allow: "Permitir", cache: "Cache", freeTier: "Free tier",
      rtk: "RTK (comprimir tool_result — git/grep/ls/logs)", headroomCompress: "Compressão Headroom (proxy externo)", headroomUrl: "URL Headroom",
      compressUserMessages: "Também comprimir mensagens do usuário", pxpipe: "pxpipe-lite (compressão de ferramentas in-process)", upstreamLoad: "Carga upstream",
      concurrencyQueue: "Fila de concorrência", concurrencyBody: "Limite chamadas upstream paralelas para proteger rate limits. 0 = ilimitado (padrão).",
      maxConcurrentGlobal: "Máx. concorrentes (global)", maxConcurrentPerProvider: "Máx. concorrentes (por provedor)", queueWaitMs: "Espera da fila (ms)",
      mediaApis: "APIs de mídia", mediaRouting: "Roteamento de mídia",
      mediaBody: "Fixe imagens, fala, transcrições e embeddings a um provedor compatível com OpenAI, ou deixe Auto para o motor principal. Busca web usa DuckDuckGo embutido (sem chave).",
      images: "Imagens", speech: "Fala (TTS)", transcriptions: "Transcrições (STT)", embeddings: "Embeddings", webSearch: "Busca web",
      webSearchBuiltin: "Embutido (DuckDuckGo)", autoRouting: "Auto (motor de roteamento)", caveman: "Caveman", ponytail: "Ponytail"
    },
    password: { admin: "Admin", title: "Senha", current: "Senha atual", next: "Nova senha", save: "Salvar senha", updated: "Senha atualizada. Recarregando…", failed: "Falha ao atualizar a senha." },
    aliases: {
      subtle: "Nomes curtos de modelo", title: "Aliases",
      body: "Mapeie model: \"fast\" para um modelo de provedor ou combo. Codex com cx/gpt-…, Claude com cc/…, e outros com prefixos curtos.",
      empty: "Ainda não há aliases.", alias: "Alias", target: "Destino", targetPlaceholder: "modelo do provedor ou nome do combo",
      add: "Adicionar alias", delete: "Excluir", importLabel: "Importar JSON 9router", importPlaceholder: "{\"aliases\":{\"fast\":\"or/meta-llama/...\"}}",
      importButton: "Importar JSON 9router", importing: "Importando…", importPasteFirst: "Cole primeiro o JSON de 9router GET /api/models/alias.",
      importInvalidJson: "JSON inválido.", importFailed: "Falha na importação.", importSummary: "{added} adicionados, {updated} atualizados, {skipped} ignorados."
    }
  },

  vi: {
    common: { save: "Lưu", saved: "Đã lưu", auto: "Tự động", on: "Bật", off: "Tắt" },
    shell: {
      dashboard: "Bảng điều khiển", brandTagline: "Cổng AI thông minh", light: "Sáng", dark: "Tối",
      switchToLight: "Chuyển sang giao diện sáng", switchToDark: "Chuyển sang giao diện tối", clientKeys: "Khóa khách", provider: "Nhà cung cấp",
      bridge: "Cầu nối", remoteAccess: "Truy cập từ xa", compressionProxy: "Proxy nén",
      updateAvailable: "Có bản cập nhật: v{version}", youAreOn: "Bạn đang dùng v{version}.", viewReleaseNotes: "Xem ghi chú phát hành",
      checkGithub: "Kiểm tra GitHub để lấy bản mới nhất.", dismissUpdate: "Đóng banner cập nhật",
      changePasswordTitle: "Đổi mật khẩu mặc định tạm thời", changePasswordBody: "Dùng Mật khẩu bên dưới. Các menu khác mở sau khi lưu mật khẩu mới."
    },
    overview: {
      metricsAria: "Chỉ số tổng quan", spendToday: "Chi tiêu hôm nay", budgetLeft: "Ngân sách còn", providersActive: "NCC đang hoạt động", requests: "Yêu cầu",
      budgetGuardActive: "Bảo vệ ngân sách đang bật", savingsToday: "Tiết kiệm hôm nay", savedAmount: "Đã tiết kiệm {amount}", noSavingsYet: "Hôm nay chưa tiết kiệm",
      viaCache: "{amount} qua cache", freeTierReq: "{count} req free-tier", cacheHits: "{count} cache hit",
      systemStatus: "Trạng thái hệ thống", sqlite: "SQLite", encryptedKeys: "Khóa đã mã hóa", fallbackReady: "Fallback sẵn sàng"
    },
    routerPanel: {
      title: "Bộ định tuyến", laneAria: "Làn định tuyến", userApp: "Người dùng/Ứng dụng", cache: "Cache", budget: "Ngân sách", evaluator: "Bộ đánh giá",
      provider: "NCC", mode: "Chế độ", strategy: "Chiến lược", fallback: "Fallback", active: "Hoạt động", connected: "Đã kết nối",
      roundRobin: "Round robin", priority: "Ưu tiên", unknown: "không rõ"
    },
    settings: {
      publicUrlSubtle: "URL công khai", domain: "Tên miền",
      publicUrlBody: "Đặt URL HTTPS bạn mở trên trình duyệt (vd. https://nesa.example.com). OAuth và chuyển hướng sau đăng nhập dùng nó để về tên miền của bạn thay vì localhost.",
      publicBaseUrl: "URL gốc công khai", budgetSubtle: "Ngân sách", limits: "Giới hạn", dailyBudget: "Ngân sách ngày", dailyBudgetAria: "Ngân sách ngày theo đô la Mỹ",
      warningPct: "Cảnh báo %", criticalPct: "Nghiêm trọng %", mode: "Chế độ", modeAuto: "Tự động", modeFree: "Miễn phí", modeCheap: "Rẻ", modeBest: "Tốt nhất", modeManual: "Thủ công",
      manualProvider: "NCC thủ công", selectProvider: "Chọn NCC…",
      noActiveProviders: "Không có NCC hoạt động — hãy bật một cái trong Providers trước.",
      choosingSetsManual: "Chọn NCC ở đây sẽ tự đặt Chế độ thành Thủ công. Rồi Lưu.",
      pickProviderManual: "Chọn NCC ở trên rồi Lưu. Chế độ thủ công không định tuyến cho đến khi có NCC.",
      selectedNotActive: "NCC đã chọn không hoạt động — bật trong Providers hoặc chọn cái khác.",
      providerStrategy: "Chiến lược NCC", priority: "Ưu tiên", roundRobin: "Round robin", fallback: "Fallback", evaluator: "Bộ đánh giá",
      onWarning: "Khi cảnh báo", preferCheaper: "Ưu tiên rẻ hơn", notifyOnly: "Chỉ thông báo", onCritical: "Khi nghiêm trọng", freeTierOnly: "Chỉ free / free-tier",
      onExceeded: "Khi vượt", blockPaid: "Chặn trả phí", allow: "Cho phép", cache: "Cache", freeTier: "Free tier",
      rtk: "RTK (nén tool_result — git/grep/ls/logs)", headroomCompress: "Nén Headroom (proxy ngoài)", headroomUrl: "URL Headroom",
      compressUserMessages: "Cũng nén tin nhắn người dùng", pxpipe: "pxpipe-lite (nén tool trong tiến trình)", upstreamLoad: "Tải upstream",
      concurrencyQueue: "Hàng đợi đồng thời", concurrencyBody: "Giới hạn gọi upstream song song để bảo vệ rate limit. 0 = không giới hạn (mặc định).",
      maxConcurrentGlobal: "Tối đa đồng thời (toàn cục)", maxConcurrentPerProvider: "Tối đa đồng thời (mỗi NCC)", queueWaitMs: "Chờ hàng đợi (ms)",
      mediaApis: "API media", mediaRouting: "Định tuyến media",
      mediaBody: "Ghim ảnh, giọng nói, phiên âm và embeddings vào NCC tương thích OpenAI, hoặc để Auto dùng engine chính. Tìm web dùng DuckDuckGo tích hợp (không cần khóa).",
      images: "Ảnh", speech: "Giọng nói (TTS)", transcriptions: "Phiên âm (STT)", embeddings: "Embeddings", webSearch: "Tìm web",
      webSearchBuiltin: "Tích hợp (DuckDuckGo)", autoRouting: "Tự động (engine định tuyến)", caveman: "Caveman", ponytail: "Ponytail"
    },
    password: { admin: "Admin", title: "Mật khẩu", current: "Mật khẩu hiện tại", next: "Mật khẩu mới", save: "Lưu mật khẩu", updated: "Đã cập nhật mật khẩu. Đang tải lại…", failed: "Cập nhật mật khẩu thất bại." },
    aliases: {
      subtle: "Tên mô hình ngắn", title: "Bí danh",
      body: "Ánh xạ model: \"fast\" tới mô hình NCC hoặc combo. Codex với cx/gpt-…, Claude với cc/…, còn lại dùng tiền tố ngắn.",
      empty: "Chưa có bí danh.", alias: "Bí danh", target: "Đích", targetPlaceholder: "mô hình NCC hoặc tên combo",
      add: "Thêm bí danh", delete: "Xóa", importLabel: "Nhập JSON 9router", importPlaceholder: "{\"aliases\":{\"fast\":\"or/meta-llama/...\"}}",
      importButton: "Nhập JSON 9router", importing: "Đang nhập…", importPasteFirst: "Dán JSON từ 9router GET /api/models/alias trước.",
      importInvalidJson: "JSON không hợp lệ.", importFailed: "Nhập thất bại.", importSummary: "{added} thêm, {updated} cập nhật, {skipped} bỏ qua."
    }
  },

  it: {
    common: { save: "Salva", saved: "Salvato", auto: "Auto", on: "On", off: "Off" },
    shell: {
      dashboard: "Dashboard", brandTagline: "Gateway AI intelligente", light: "Chiaro", dark: "Scuro",
      switchToLight: "Passa al tema chiaro", switchToDark: "Passa al tema scuro", clientKeys: "Chiavi client", provider: "Provider",
      bridge: "Ponte", remoteAccess: "Accesso remoto", compressionProxy: "Proxy di compressione",
      updateAvailable: "Aggiornamento disponibile: v{version}", youAreOn: "Sei su v{version}.", viewReleaseNotes: "Vedi note di rilascio",
      checkGithub: "Controlla GitHub per l’ultima versione.", dismissUpdate: "Chiudi banner aggiornamento",
      changePasswordTitle: "Cambia la password predefinita temporanea", changePasswordBody: "Usa Password qui sotto. Gli altri menu si sbloccano dopo aver salvato una nuova password."
    },
    overview: {
      metricsAria: "Metriche panoramica", spendToday: "Spesa di oggi", budgetLeft: "Budget rimanente", providersActive: "Provider attivi", requests: "Richieste",
      budgetGuardActive: "Protezione budget attiva", savingsToday: "Risparmio di oggi", savedAmount: "{amount} risparmiati", noSavingsYet: "Ancora nessun risparmio oggi",
      viaCache: "{amount} via cache", freeTierReq: "{count} req free-tier", cacheHits: "{count} cache hit",
      systemStatus: "Stato sistema", sqlite: "SQLite", encryptedKeys: "Chiavi crittografate", fallbackReady: "Fallback pronto"
    },
    routerPanel: {
      title: "Router", laneAria: "Corsia di routing", userApp: "Utente/App", cache: "Cache", budget: "Budget", evaluator: "Valutatore",
      provider: "Provider", mode: "Modalità", strategy: "Strategia", fallback: "Fallback", active: "Attivo", connected: "Connesso",
      roundRobin: "Round robin", priority: "Priorità", unknown: "sconosciuto"
    },
    settings: {
      publicUrlSubtle: "URL pubblica", domain: "Dominio",
      publicUrlBody: "Imposta l’URL HTTPS che apri nel browser (es. https://nesa.example.com). OAuth e redirect post-login la usano per tornare al tuo dominio invece che a localhost.",
      publicBaseUrl: "URL base pubblica", budgetSubtle: "Budget", limits: "Limiti", dailyBudget: "Budget giornaliero", dailyBudgetAria: "Budget giornaliero in dollari USA",
      warningPct: "Avviso %", criticalPct: "Critico %", mode: "Modalità", modeAuto: "Auto", modeFree: "Gratis", modeCheap: "Economico", modeBest: "Migliore", modeManual: "Manuale",
      manualProvider: "Provider manuale", selectProvider: "Seleziona provider…",
      noActiveProviders: "Nessun provider attivo — attivane uno in Providers prima.",
      choosingSetsManual: "Scegliere un provider qui imposta automaticamente la Modalità su Manuale. Poi Salva.",
      pickProviderManual: "Scegli un provider sopra e Salva. La modalità Manuale non instrada finché non ne è selezionato uno.",
      selectedNotActive: "Il provider selezionato non è attivo — attivalo in Providers o scegline un altro.",
      providerStrategy: "Strategia provider", priority: "Priorità", roundRobin: "Round robin", fallback: "Fallback", evaluator: "Valutatore",
      onWarning: "In avviso", preferCheaper: "Preferisci più economico", notifyOnly: "Solo notifica", onCritical: "In critico", freeTierOnly: "Solo free / free-tier",
      onExceeded: "Al superamento", blockPaid: "Blocca a pagamento", allow: "Consenti", cache: "Cache", freeTier: "Free tier",
      rtk: "RTK (comprimi tool_result — git/grep/ls/logs)", headroomCompress: "Compressione Headroom (proxy esterno)", headroomUrl: "URL Headroom",
      compressUserMessages: "Comprimi anche i messaggi utente", pxpipe: "pxpipe-lite (compressione tool in-process)", upstreamLoad: "Carico upstream",
      concurrencyQueue: "Coda di concorrenza", concurrencyBody: "Limita le chiamate upstream parallele per proteggere i rate limit. 0 = illimitato (predefinito).",
      maxConcurrentGlobal: "Max concurrent (globale)", maxConcurrentPerProvider: "Max concurrent (per provider)", queueWaitMs: "Attesa coda (ms)",
      mediaApis: "API media", mediaRouting: "Routing media",
      mediaBody: "Fissa immagini, voce, trascrizioni ed embeddings a un provider OpenAI-compatible, oppure lascia Auto per il motore principale. La ricerca web usa DuckDuckGo integrato (senza chiave).",
      images: "Immagini", speech: "Voce (TTS)", transcriptions: "Trascrizioni (STT)", embeddings: "Embeddings", webSearch: "Ricerca web",
      webSearchBuiltin: "Integrato (DuckDuckGo)", autoRouting: "Auto (motore di routing)", caveman: "Caveman", ponytail: "Ponytail"
    },
    password: { admin: "Admin", title: "Password", current: "Password attuale", next: "Nuova password", save: "Salva password", updated: "Password aggiornata. Ricaricamento…", failed: "Aggiornamento password non riuscito." },
    aliases: {
      subtle: "Nomi modello brevi", title: "Alias",
      body: "Mappa model: \"fast\" a un modello provider o combo. Codex con cx/gpt-…, Claude con cc/…, altri con prefissi corti.",
      empty: "Nessun alias ancora.", alias: "Alias", target: "Destinazione", targetPlaceholder: "modello provider o nome combo",
      add: "Aggiungi alias", delete: "Elimina", importLabel: "Importa JSON 9router", importPlaceholder: "{\"aliases\":{\"fast\":\"or/meta-llama/...\"}}",
      importButton: "Importa JSON 9router", importing: "Importazione…", importPasteFirst: "Incolla prima il JSON da 9router GET /api/models/alias.",
      importInvalidJson: "JSON non valido.", importFailed: "Importazione non riuscita.", importSummary: "{added} aggiunti, {updated} aggiornati, {skipped} saltati."
    }
  },

  nl: {
    common: { save: "Opslaan", saved: "Opgeslagen", auto: "Auto", on: "Aan", off: "Uit" },
    shell: {
      dashboard: "Dashboard", brandTagline: "Slimme AI-gateway", light: "Licht", dark: "Donker",
      switchToLight: "Overschakelen naar licht thema", switchToDark: "Overschakelen naar donker thema", clientKeys: "Clientkeys", provider: "Provider",
      bridge: "Brug", remoteAccess: "Externe toegang", compressionProxy: "Compressieproxy",
      updateAvailable: "Update beschikbaar: v{version}", youAreOn: "U gebruikt v{version}.", viewReleaseNotes: "Release notes bekijken",
      checkGithub: "Bekijk GitHub voor de nieuwste release.", dismissUpdate: "Updatebanner sluiten",
      changePasswordTitle: "Wijzig tijdelijk standaardwachtwoord", changePasswordBody: "Gebruik Wachtwoord hieronder. Andere menu’s ontgrendelen na het opslaan van een nieuw wachtwoord."
    },
    overview: {
      metricsAria: "Overzichtsmetrics", spendToday: "Uitgaven vandaag", budgetLeft: "Resterend budget", providersActive: "Actieve providers", requests: "Verzoeken",
      budgetGuardActive: "Budgetbewaking actief", savingsToday: "Besparing vandaag", savedAmount: "{amount} bespaard", noSavingsYet: "Vandaag nog geen besparing",
      viaCache: "{amount} via cache", freeTierReq: "{count} free-tier req", cacheHits: "{count} cache hits",
      systemStatus: "Systeemstatus", sqlite: "SQLite", encryptedKeys: "Versleutelde keys", fallbackReady: "Fallback klaar"
    },
    routerPanel: {
      title: "Router", laneAria: "Routingbaan", userApp: "Gebruiker/App", cache: "Cache", budget: "Budget", evaluator: "Evaluator",
      provider: "Provider", mode: "Modus", strategy: "Strategie", fallback: "Fallback", active: "Actief", connected: "Verbonden",
      roundRobin: "Round robin", priority: "Prioriteit", unknown: "onbekend"
    },
    settings: {
      publicUrlSubtle: "Publieke URL", domain: "Domein",
      publicUrlBody: "Stel de HTTPS-URL in die u in de browser opent (bijv. https://nesa.example.com). OAuth en post-login-redirects gebruiken dit om terug te keren naar uw domein i.p.v. localhost.",
      publicBaseUrl: "Publieke basis-URL", budgetSubtle: "Budget", limits: "Limieten", dailyBudget: "Dagelijks budget", dailyBudgetAria: "Dagelijks budget in Amerikaanse dollars",
      warningPct: "Waarschuwing %", criticalPct: "Kritiek %", mode: "Modus", modeAuto: "Auto", modeFree: "Gratis", modeCheap: "Goedkoop", modeBest: "Beste", modeManual: "Handmatig",
      manualProvider: "Handmatige provider", selectProvider: "Selecteer provider…",
      noActiveProviders: "Geen actieve providers — activeer er eerst een under Providers.",
      choosingSetsManual: "Een provider hier kiezen zet Modus automatisch op Handmatig. Daarna Opslaan.",
      pickProviderManual: "Kies hierboven een provider en Opslaan. Handmatig routet niet tot er een is geselecteerd.",
      selectedNotActive: "Geselecteerde provider is niet actief — activeer in Providers of kies een andere.",
      providerStrategy: "Providerstrategie", priority: "Prioriteit", roundRobin: "Round robin", fallback: "Fallback", evaluator: "Evaluator",
      onWarning: "Bij waarschuwing", preferCheaper: "Goedkoper verkiezen", notifyOnly: "Alleen melden", onCritical: "Bij kritiek", freeTierOnly: "Alleen free / free-tier",
      onExceeded: "Bij overschrijding", blockPaid: "Betaald blokkeren", allow: "Toestaan", cache: "Cache", freeTier: "Free tier",
      rtk: "RTK (tool_result comprimeren — git/grep/ls/logs)", headroomCompress: "Headroom-compressie (externe proxy)", headroomUrl: "Headroom-URL",
      compressUserMessages: "Ook gebruikersberichten comprimeren", pxpipe: "pxpipe-lite (in-process toolcompressie)", upstreamLoad: "Upstream-belasting",
      concurrencyQueue: "Concurrency-wachtrij", concurrencyBody: "Beperk parallelle upstream-aanroepen om rate limits te beschermen. 0 = onbeperkt (standaard).",
      maxConcurrentGlobal: "Max concurrent (globaal)", maxConcurrentPerProvider: "Max concurrent (per provider)", queueWaitMs: "Wachttijd (ms)",
      mediaApis: "Media-API’s", mediaRouting: "Mediarouting",
      mediaBody: "Pin afbeeldingen, spraak, transcripties en embeddings aan een OpenAI-compatibele provider, of laat Auto voor de hoofdmotor. Zoeken gebruikt ingebouwde DuckDuckGo (geen key).",
      images: "Afbeeldingen", speech: "Spraak (TTS)", transcriptions: "Transcripties (STT)", embeddings: "Embeddings", webSearch: "Webzoeken",
      webSearchBuiltin: "Ingebouwd (DuckDuckGo)", autoRouting: "Auto (routingengine)", caveman: "Caveman", ponytail: "Ponytail"
    },
    password: { admin: "Beheerder", title: "Wachtwoord", current: "Huidig wachtwoord", next: "Nieuw wachtwoord", save: "Wachtwoord opslaan", updated: "Wachtwoord bijgewerkt. Herladen…", failed: "Wachtwoord bijwerken mislukt." },
    aliases: {
      subtle: "Korte modelnamen", title: "Aliassen",
      body: "Map model: \"fast\" naar een providermodel of combo. Codex met cx/gpt-…, Claude met cc/…, anderen met korte prefixen.",
      empty: "Nog geen aliassen.", alias: "Alias", target: "Doel", targetPlaceholder: "providermodel of combonaam",
      add: "Alias toevoegen", delete: "Verwijderen", importLabel: "9router-JSON importeren", importPlaceholder: "{\"aliases\":{\"fast\":\"or/meta-llama/...\"}}",
      importButton: "9router-JSON importeren", importing: "Importeren…", importPasteFirst: "Plak eerst JSON van 9router GET /api/models/alias.",
      importInvalidJson: "Ongeldige JSON.", importFailed: "Import mislukt.", importSummary: "{added} toegevoegd, {updated} bijgewerkt, {skipped} overgeslagen."
    }
  },

  pl: {
    common: { save: "Zapisz", saved: "Zapisano", auto: "Auto", on: "Wł.", off: "Wył." },
    shell: {
      dashboard: "Panel", brandTagline: "Inteligentna brama AI", light: "Jasny", dark: "Ciemny",
      switchToLight: "Przełącz na jasny motyw", switchToDark: "Przełącz na ciemny motyw", clientKeys: "Klucze klienta", provider: "Dostawca",
      bridge: "Most", remoteAccess: "Dostęp zdalny", compressionProxy: "Proxy kompresji",
      updateAvailable: "Dostępna aktualizacja: v{version}", youAreOn: "Używasz v{version}.", viewReleaseNotes: "Zobacz uwagi do wydania",
      checkGithub: "Sprawdź GitHub pod kątem najnowszego wydania.", dismissUpdate: "Zamknij baner aktualizacji",
      changePasswordTitle: "Zmień tymczasowe hasło domyślne", changePasswordBody: "Użyj Hasła poniżej. Inne menu odblokują się po zapisaniu nowego hasła."
    },
    overview: {
      metricsAria: "Metryki przeglądu", spendToday: "Wydatki dziś", budgetLeft: "Pozostały budżet", providersActive: "Aktywni dostawcy", requests: "Żądania",
      budgetGuardActive: "Ochrona budżetu aktywna", savingsToday: "Oszczędności dziś", savedAmount: "Zaoszczędzono {amount}", noSavingsYet: "Dziś jeszcze brak oszczędności",
      viaCache: "{amount} przez cache", freeTierReq: "{count} żądań free-tier", cacheHits: "{count} trafień cache",
      systemStatus: "Status systemu", sqlite: "SQLite", encryptedKeys: "Zaszyfrowane klucze", fallbackReady: "Fallback gotowy"
    },
    routerPanel: {
      title: "Router", laneAria: "Tor routingu", userApp: "Użytkownik/Aplikacja", cache: "Cache", budget: "Budżet", evaluator: "Ewaluator",
      provider: "Dostawca", mode: "Tryb", strategy: "Strategia", fallback: "Fallback", active: "Aktywny", connected: "Połączony",
      roundRobin: "Round robin", priority: "Priorytet", unknown: "nieznany"
    },
    settings: {
      publicUrlSubtle: "Publiczny URL", domain: "Domena",
      publicUrlBody: "Ustaw URL HTTPS otwierany w przeglądarce (np. https://nesa.example.com). OAuth i przekierowania po logowaniu używają go, by wrócić do Twojej domeny zamiast localhost.",
      publicBaseUrl: "Publiczny bazowy URL", budgetSubtle: "Budżet", limits: "Limity", dailyBudget: "Budżet dzienny", dailyBudgetAria: "Dzienny budżet w dolarach USA",
      warningPct: "Ostrzeżenie %", criticalPct: "Krytyczny %", mode: "Tryb", modeAuto: "Auto", modeFree: "Darmowy", modeCheap: "Tani", modeBest: "Najlepszy", modeManual: "Ręczny",
      manualProvider: "Ręczny dostawca", selectProvider: "Wybierz dostawcę…",
      noActiveProviders: "Brak aktywnych dostawców — najpierw włącz w Providers.",
      choosingSetsManual: "Wybór dostawcy tutaj automatycznie ustawia Tryb na Ręczny. Potem Zapisz.",
      pickProviderManual: "Wybierz dostawcę powyżej i Zapisz. Tryb ręczny nie routuje, dopóki nie wybrano dostawcy.",
      selectedNotActive: "Wybrany dostawca jest nieaktywny — włącz w Providers lub wybierz innego.",
      providerStrategy: "Strategia dostawcy", priority: "Priorytet", roundRobin: "Round robin", fallback: "Fallback", evaluator: "Ewaluator",
      onWarning: "Przy ostrzeżeniu", preferCheaper: "Preferuj tańsze", notifyOnly: "Tylko powiadom", onCritical: "Przy krytycznym", freeTierOnly: "Tylko free / free-tier",
      onExceeded: "Przy przekroczeniu", blockPaid: "Blokuj płatne", allow: "Zezwól", cache: "Cache", freeTier: "Free tier",
      rtk: "RTK (kompresuj tool_result — git/grep/ls/logs)", headroomCompress: "Kompresja Headroom (zewnętrzne proxy)", headroomUrl: "URL Headroom",
      compressUserMessages: "Kompresuj także wiadomości użytkownika", pxpipe: "pxpipe-lite (kompresja narzędzi in-process)", upstreamLoad: "Obciążenie upstream",
      concurrencyQueue: "Kolejka współbieżności", concurrencyBody: "Ogranicz równoległe wywołania upstream, by chronić rate limit. 0 = bez limitu (domyślnie).",
      maxConcurrentGlobal: "Maks. równolegle (globalnie)", maxConcurrentPerProvider: "Maks. równolegle (na dostawcę)", queueWaitMs: "Oczekiwanie kolejki (ms)",
      mediaApis: "API mediów", mediaRouting: "Routing mediów",
      mediaBody: "Przypnij obrazy, mowę, transkrypcje i embeddings do dostawcy OpenAI-compatible albo zostaw Auto dla głównego silnika. Wyszukiwanie używa wbudowanego DuckDuckGo (bez klucza).",
      images: "Obrazy", speech: "Mowa (TTS)", transcriptions: "Transkrypcje (STT)", embeddings: "Embeddings", webSearch: "Wyszukiwanie WWW",
      webSearchBuiltin: "Wbudowane (DuckDuckGo)", autoRouting: "Auto (silnik routingu)", caveman: "Caveman", ponytail: "Ponytail"
    },
    password: { admin: "Admin", title: "Hasło", current: "Obecne hasło", next: "Nowe hasło", save: "Zapisz hasło", updated: "Hasło zaktualizowane. Odświeżanie…", failed: "Nie udało się zaktualizować hasła." },
    aliases: {
      subtle: "Krótkie nazwy modeli", title: "Aliasy",
      body: "Zmapuj model: \"fast\" na model dostawcy lub combo. Codex z cx/gpt-…, Claude z cc/…, inne z krótkimi prefiksami.",
      empty: "Brak aliasów.", alias: "Alias", target: "Cel", targetPlaceholder: "model dostawcy lub nazwa combo",
      add: "Dodaj alias", delete: "Usuń", importLabel: "Importuj JSON 9router", importPlaceholder: "{\"aliases\":{\"fast\":\"or/meta-llama/...\"}}",
      importButton: "Importuj JSON 9router", importing: "Importowanie…", importPasteFirst: "Najpierw wklej JSON z 9router GET /api/models/alias.",
      importInvalidJson: "Nieprawidłowy JSON.", importFailed: "Import nieudany.", importSummary: "{added} dodano, {updated} zaktualizowano, {skipped} pominięto."
    }
  },

  hi: {
    common: { save: "सहेजें", saved: "सहेजा गया", auto: "स्वतः", on: "चालू", off: "बंद" },
    shell: {
      dashboard: "डैशबोर्ड", brandTagline: "स्मार्ट AI गेटवे", light: "लाइट", dark: "डार्क",
      switchToLight: "लाइट थीम पर जाएँ", switchToDark: "डार्क थीम पर जाएँ", clientKeys: "क्लाइंट कुंजियाँ", provider: "प्रदाता",
      bridge: "ब्रिज", remoteAccess: "रिमोट एक्सेस", compressionProxy: "कंप्रेशन प्रॉक्सी",
      updateAvailable: "अपडेट उपलब्ध: v{version}", youAreOn: "आप v{version} पर हैं।", viewReleaseNotes: "रिलीज़ नोट्स देखें",
      checkGithub: "नवीनतम रिलीज़ के लिए GitHub देखें।", dismissUpdate: "अपडेट बैनर बंद करें",
      changePasswordTitle: "अस्थायी डिफ़ॉल्ट पासवर्ड बदलें", changePasswordBody: "नीचे पासवर्ड का उपयोग करें। नया पासवर्ड सहेजने के बाद अन्य मेनू खुलेंगे।"
    },
    overview: {
      metricsAria: "अवलोकन मेट्रिक्स", spendToday: "आज का खर्च", budgetLeft: "शेष बजट", providersActive: "सक्रिय प्रदाता", requests: "अनुरोध",
      budgetGuardActive: "बजट गार्ड सक्रिय", savingsToday: "आज की बचत", savedAmount: "{amount} बचत", noSavingsYet: "आज अभी कोई बचत नहीं",
      viaCache: "कैश से {amount}", freeTierReq: "{count} free-tier अनुरोध", cacheHits: "{count} कैश हिट",
      systemStatus: "सिस्टम स्थिति", sqlite: "SQLite", encryptedKeys: "एन्क्रिप्टेड कुंजियाँ", fallbackReady: "फ़ॉलबैक तैयार"
    },
    routerPanel: {
      title: "राउटर", laneAria: "राउटिंग लेन", userApp: "उपयोगकर्ता/ऐप", cache: "कैश", budget: "बजट", evaluator: "मूल्यांकनकर्ता",
      provider: "प्रदाता", mode: "मोड", strategy: "रणनीति", fallback: "फ़ॉलबैक", active: "सक्रिय", connected: "कनेक्टेड",
      roundRobin: "राउंड रॉबिन", priority: "प्राथमिकता", unknown: "अज्ञात"
    },
    settings: {
      publicUrlSubtle: "सार्वजनिक URL", domain: "डोमेन",
      publicUrlBody: "वह HTTPS URL सेट करें जो आप ब्राउज़र में खोलते हैं (जैसे https://nesa.example.com)। OAuth और लॉगिन रीडायरेक्ट इसे localhost के बजाय आपके डोमेन पर लौटाने के लिए उपयोग करते हैं।",
      publicBaseUrl: "सार्वजनिक बेस URL", budgetSubtle: "बजट", limits: "सीमाएँ", dailyBudget: "दैनिक बजट", dailyBudgetAria: "अमेरिकी डॉलर में दैनिक बजट",
      warningPct: "चेतावनी %", criticalPct: "गंभीर %", mode: "मोड", modeAuto: "स्वतः", modeFree: "मुफ़्त", modeCheap: "सस्ता", modeBest: "सर्वश्रेष्ठ", modeManual: "मैन्युअल",
      manualProvider: "मैन्युअल प्रदाता", selectProvider: "प्रदाता चुनें…",
      noActiveProviders: "कोई सक्रिय प्रदाता नहीं — पहले Providers में सक्रिय करें।",
      choosingSetsManual: "यहाँ प्रदाता चुनने से मोड स्वतः मैन्युअल हो जाता है। फिर सहेजें।",
      pickProviderManual: "ऊपर प्रदाता चुनें फिर सहेजें। चयन तक मैन्युअल मोड रूट नहीं करेगा।",
      selectedNotActive: "चयनित प्रदाता सक्रिय नहीं — Providers में सक्रिय करें या दूसरा चुनें।",
      providerStrategy: "प्रदाता रणनीति", priority: "प्राथमिकता", roundRobin: "राउंड रॉबिन", fallback: "फ़ॉलबैक", evaluator: "मूल्यांकनकर्ता",
      onWarning: "चेतावनी पर", preferCheaper: "सस्ता पसंद करें", notifyOnly: "केवल सूचित करें", onCritical: "गंभीर पर", freeTierOnly: "केवल free / free-tier",
      onExceeded: "पार होने पर", blockPaid: "सशुल्क ब्लॉक करें", allow: "अनुमति दें", cache: "कैश", freeTier: "Free tier",
      rtk: "RTK (tool_result संपीड़ित करें — git/grep/ls/logs)", headroomCompress: "Headroom संपीड़न (बाहरी प्रॉक्सी)", headroomUrl: "Headroom URL",
      compressUserMessages: "उपयोगकर्ता संदेश भी संपीड़ित करें", pxpipe: "pxpipe-lite (इन-प्रोसेस टूल संपीड़न)", upstreamLoad: "अपस्ट्रीम लोड",
      concurrencyQueue: "समवर्ती कतार", concurrencyBody: "रेट लिमिट सुरक्षा के लिए समानांतर अपस्ट्रीम कॉल सीमित करें। 0 = असीमित (डिफ़ॉल्ट)।",
      maxConcurrentGlobal: "अधिकतम समवर्ती (वैश्विक)", maxConcurrentPerProvider: "अधिकतम समवर्ती (प्रति प्रदाता)", queueWaitMs: "कतार प्रतीक्षा (ms)",
      mediaApis: "मीडिया API", mediaRouting: "मीडिया राउटिंग",
      mediaBody: "छवियाँ, वाणी, ट्रांसक्रिप्शन और embeddings को किसी OpenAI-संगत प्रदाता पर पिन करें, या मुख्य इंजन के लिए Auto छोड़ें। वेब खोज अंतर्निहित DuckDuckGo उपयोग करती है (बिना कुंजी)।",
      images: "छवियाँ", speech: "वाणी (TTS)", transcriptions: "ट्रांसक्रिप्शन (STT)", embeddings: "Embeddings", webSearch: "वेब खोज",
      webSearchBuiltin: "अंतर्निहित (DuckDuckGo)", autoRouting: "स्वतः (राउटिंग इंजन)", caveman: "Caveman", ponytail: "Ponytail"
    },
    password: { admin: "एडमिन", title: "पासवर्ड", current: "वर्तमान पासवर्ड", next: "नया पासवर्ड", save: "पासवर्ड सहेजें", updated: "पासवर्ड अपडेट हो गया। पुनः लोड हो रहा है…", failed: "पासवर्ड अपडेट विफल।" },
    aliases: {
      subtle: "छोटे मॉडल नाम", title: "उपनाम",
      body: "model: \"fast\" को प्रदाता मॉडल या कॉम्बो से मैप करें। Codex cx/gpt-…, Claude cc/…, अन्य छोटे उपसर्गों के साथ।",
      empty: "अभी कोई उपनाम नहीं।", alias: "उपनाम", target: "लक्ष्य", targetPlaceholder: "प्रदाता मॉडल या कॉम्बो नाम",
      add: "उपनाम जोड़ें", delete: "हटाएँ", importLabel: "9router JSON आयात करें", importPlaceholder: "{\"aliases\":{\"fast\":\"or/meta-llama/...\"}}",
      importButton: "9router JSON आयात करें", importing: "आयात हो रहा है…", importPasteFirst: "पहले 9router GET /api/models/alias का JSON पेस्ट करें।",
      importInvalidJson: "अमान्य JSON।", importFailed: "आयात विफल।", importSummary: "{added} जोड़े, {updated} अपडेट, {skipped} छोड़े।"
    }
  },

  th: {
    common: { save: "บันทึก", saved: "บันทึกแล้ว", auto: "อัตโนมัติ", on: "เปิด", off: "ปิด" },
    shell: {
      dashboard: "แดชบอร์ด", brandTagline: "เกตเวย์ AI อัจฉริยะ", light: "สว่าง", dark: "มืด",
      switchToLight: "สลับเป็นธีมสว่าง", switchToDark: "สลับเป็นธีมมืด", clientKeys: "คีย์ไคลเอนต์", provider: "ผู้ให้บริการ",
      bridge: "บริดจ์", remoteAccess: "การเข้าถึงระยะไกล", compressionProxy: "พร็อกซีบีบอัด",
      updateAvailable: "มีการอัปเดต: v{version}", youAreOn: "คุณใช้ v{version}", viewReleaseNotes: "ดูบันทึกประจำรุ่น",
      checkGithub: "ตรวจสอบ GitHub สำหรับรุ่นล่าสุด", dismissUpdate: "ปิดแบนเนอร์อัปเดต",
      changePasswordTitle: "เปลี่ยนรหัสผ่านเริ่มต้นชั่วคราว", changePasswordBody: "ใช้รหัสผ่านด้านล่าง เมนูอื่นจะปลดล็อกหลังบันทึกรหัสผ่านใหม่"
    },
    overview: {
      metricsAria: "เมตริกภาพรวม", spendToday: "ใช้จ่ายวันนี้", budgetLeft: "งบคงเหลือ", providersActive: "ผู้ให้บริการที่ใช้งาน", requests: "คำขอ",
      budgetGuardActive: "การป้องกันงบประมาณทำงาน", savingsToday: "ประหยัดวันนี้", savedAmount: "ประหยัด {amount}", noSavingsYet: "วันนี้ยังไม่มีการประหยัด",
      viaCache: "{amount} ผ่านแคช", freeTierReq: "{count} คำขอ free-tier", cacheHits: "{count} แคชฮิต",
      systemStatus: "สถานะระบบ", sqlite: "SQLite", encryptedKeys: "คีย์เข้ารหัส", fallbackReady: "Fallback พร้อม"
    },
    routerPanel: {
      title: "เราเตอร์", laneAria: "เลนการกำหนดเส้นทาง", userApp: "ผู้ใช้/แอป", cache: "แคช", budget: "งบประมาณ", evaluator: "ตัวประเมิน",
      provider: "ผู้ให้บริการ", mode: "โหมด", strategy: "กลยุทธ์", fallback: "Fallback", active: "ใช้งาน", connected: "เชื่อมต่อแล้ว",
      roundRobin: "Round robin", priority: "ลำดับความสำคัญ", unknown: "ไม่ทราบ"
    },
    settings: {
      publicUrlSubtle: "URL สาธารณะ", domain: "โดเมน",
      publicUrlBody: "ตั้งค่า URL HTTPS ที่คุณเปิดในเบราว์เซอร์ (เช่น https://nesa.example.com) OAuth และการเปลี่ยนเส้นทางหลังล็อกอินใช้ค่านี้เพื่อกลับโดเมนของคุณแทน localhost",
      publicBaseUrl: "URL ฐานสาธารณะ", budgetSubtle: "งบประมาณ", limits: "ขีดจำกัด", dailyBudget: "งบรายวัน", dailyBudgetAria: "งบรายวันเป็นดอลลาร์สหรัฐ",
      warningPct: "คำเตือน %", criticalPct: "วิกฤต %", mode: "โหมด", modeAuto: "อัตโนมัติ", modeFree: "ฟรี", modeCheap: "ถูก", modeBest: "ดีที่สุด", modeManual: "ด้วยตนเอง",
      manualProvider: "ผู้ให้บริการด้วยตนเอง", selectProvider: "เลือกผู้ให้บริการ…",
      noActiveProviders: "ไม่มีผู้ให้บริการที่ใช้งาน — เปิดใช้ใน Providers ก่อน",
      choosingSetsManual: "การเลือกผู้ให้บริการที่นี่จะตั้งโหมดเป็นด้วยตนเองอัตโนมัติ จากนั้นบันทึก",
      pickProviderManual: "เลือกผู้ให้บริการด้านบนแล้วบันทึก โหมดด้วยตนเองจะไม่กำหนดเส้นทางจนกว่าจะเลือก",
      selectedNotActive: "ผู้ให้บริการที่เลือกไม่ได้เปิดใช้ — เปิดใน Providers หรือเลือกอันอื่น",
      providerStrategy: "กลยุทธ์ผู้ให้บริการ", priority: "ลำดับความสำคัญ", roundRobin: "Round robin", fallback: "Fallback", evaluator: "ตัวประเมิน",
      onWarning: "เมื่อมีคำเตือน", preferCheaper: "ชอบที่ถูกกว่า", notifyOnly: "แจ้งเท่านั้น", onCritical: "เมื่อวิกฤต", freeTierOnly: "เฉพาะ free / free-tier",
      onExceeded: "เมื่อเกิน", blockPaid: "บล็อกแบบเสียเงิน", allow: "อนุญาต", cache: "แคช", freeTier: "Free tier",
      rtk: "RTK (บีบอัด tool_result — git/grep/ls/logs)", headroomCompress: "บีบอัด Headroom (พร็อกซีภายนอก)", headroomUrl: "URL Headroom",
      compressUserMessages: "บีบอัดข้อความผู้ใช้ด้วย", pxpipe: "pxpipe-lite (บีบอัดทูลในโปรเซส)", upstreamLoad: "โหลดอัปสตรีม",
      concurrencyQueue: "คิวพร้อมกัน", concurrencyBody: "จำกัดการเรียกอัปสตรีมแบบขนานเพื่อปกป้องเรตลิมิต 0 = ไม่จำกัด (ค่าเริ่มต้น)",
      maxConcurrentGlobal: "พร้อมกันสูงสุด (ทั้งระบบ)", maxConcurrentPerProvider: "พร้อมกันสูงสุด (ต่อผู้ให้บริการ)", queueWaitMs: "เวลารอคิว (ms)",
      mediaApis: "API สื่อ", mediaRouting: "การกำหนดเส้นทางสื่อ",
      mediaBody: "ปักหมุดรูป เสียง ถอดเสียง และ embeddings ไปยังผู้ให้บริการที่เข้ากันกับ OpenAI หรือปล่อย Auto ให้เครื่องมือหลัก ค้นหาเว็บใช้ DuckDuckGo ในตัว (ไม่ต้องใช้คีย์)",
      images: "รูปภาพ", speech: "เสียงพูด (TTS)", transcriptions: "ถอดเสียง (STT)", embeddings: "Embeddings", webSearch: "ค้นหาเว็บ",
      webSearchBuiltin: "ในตัว (DuckDuckGo)", autoRouting: "อัตโนมัติ (เอนจินกำหนดเส้นทาง)", caveman: "Caveman", ponytail: "Ponytail"
    },
    password: { admin: "ผู้ดูแล", title: "รหัสผ่าน", current: "รหัสผ่านปัจจุบัน", next: "รหัสผ่านใหม่", save: "บันทึกรหัสผ่าน", updated: "อัปเดตรหัสผ่านแล้ว กำลังโหลดใหม่…", failed: "อัปเดตรหัสผ่านล้มเหลว" },
    aliases: {
      subtle: "ชื่อโมเดลสั้น", title: "นามแฝง",
      body: "แมป model: \"fast\" ไปยังโมเดลผู้ให้บริการหรือคอมโบ Codex ด้วย cx/gpt-… Claude ด้วย cc/… และอื่น ๆ ด้วยคำนำหน้าสั้น",
      empty: "ยังไม่มีนามแฝง", alias: "นามแฝง", target: "เป้าหมาย", targetPlaceholder: "โมเดลผู้ให้บริการหรือชื่อคอมโบ",
      add: "เพิ่มนามแฝง", delete: "ลบ", importLabel: "นำเข้า JSON 9router", importPlaceholder: "{\"aliases\":{\"fast\":\"or/meta-llama/...\"}}",
      importButton: "นำเข้า JSON 9router", importing: "กำลังนำเข้า…", importPasteFirst: "วาง JSON จาก 9router GET /api/models/alias ก่อน",
      importInvalidJson: "JSON ไม่ถูกต้อง", importFailed: "นำเข้าล้มเหลว", importSummary: "เพิ่ม {added} อัปเดต {updated} ข้าม {skipped}"
    }
  },

  tr: {
    common: { save: "Kaydet", saved: "Kaydedildi", auto: "Otomatik", on: "Açık", off: "Kapalı" },
    shell: {
      dashboard: "Kontrol paneli", brandTagline: "Akıllı AI ağ geçidi", light: "Açık", dark: "Koyu",
      switchToLight: "Açık temaya geç", switchToDark: "Koyu temaya geç", clientKeys: "İstemci anahtarları", provider: "Sağlayıcı",
      bridge: "Köprü", remoteAccess: "Uzak erişim", compressionProxy: "Sıkıştırma vekili",
      updateAvailable: "Güncelleme var: v{version}", youAreOn: "Sürümünüz v{version}.", viewReleaseNotes: "Sürüm notlarını gör",
      checkGithub: "En son sürüm için GitHub’a bakın.", dismissUpdate: "Güncelleme bandını kapat",
      changePasswordTitle: "Geçici varsayılan şifreyi değiştirin", changePasswordBody: "Aşağıdaki Şifre’yi kullanın. Yeni şifreyi kaydettikten sonra diğer menüler açılır."
    },
    overview: {
      metricsAria: "Özet metrikleri", spendToday: "Bugünkü harcama", budgetLeft: "Kalan bütçe", providersActive: "Aktif sağlayıcılar", requests: "İstekler",
      budgetGuardActive: "Bütçe koruması aktif", savingsToday: "Bugünkü tasarruf", savedAmount: "{amount} tasarruf", noSavingsYet: "Bugün henüz tasarruf yok",
      viaCache: "önbellekle {amount}", freeTierReq: "{count} free-tier istek", cacheHits: "{count} önbellek isabeti",
      systemStatus: "Sistem durumu", sqlite: "SQLite", encryptedKeys: "Şifreli anahtarlar", fallbackReady: "Fallback hazır"
    },
    routerPanel: {
      title: "Yönlendirici", laneAria: "Yönlendirme şeridi", userApp: "Kullanıcı/Uygulama", cache: "Önbellek", budget: "Bütçe", evaluator: "Değerlendirici",
      provider: "Sağlayıcı", mode: "Mod", strategy: "Strateji", fallback: "Fallback", active: "Aktif", connected: "Bağlı",
      roundRobin: "Round robin", priority: "Öncelik", unknown: "bilinmiyor"
    },
    settings: {
      publicUrlSubtle: "Herkese açık URL", domain: "Alan adı",
      publicUrlBody: "Tarayıcıda açtığınız HTTPS URL’sini ayarlayın (ör. https://nesa.example.com). OAuth ve giriş sonrası yönlendirmeler localhost yerine alan adınıza dönmek için bunu kullanır.",
      publicBaseUrl: "Herkese açık taban URL", budgetSubtle: "Bütçe", limits: "Limitler", dailyBudget: "Günlük bütçe", dailyBudgetAria: "ABD doları cinsinden günlük bütçe",
      warningPct: "Uyarı %", criticalPct: "Kritik %", mode: "Mod", modeAuto: "Otomatik", modeFree: "Ücretsiz", modeCheap: "Ucuz", modeBest: "En iyi", modeManual: "Manuel",
      manualProvider: "Manuel sağlayıcı", selectProvider: "Sağlayıcı seç…",
      noActiveProviders: "Aktif sağlayıcı yok — önce Providers’ta etkinleştirin.",
      choosingSetsManual: "Burada seçmek Mod’u otomatik Manuel yapar. Sonra Kaydet.",
      pickProviderManual: "Yukarıdan bir sağlayıcı seçip Kaydedin. Seçilene kadar Manuel yönlendirmez.",
      selectedNotActive: "Seçilen sağlayıcı aktif değil — Providers’ta etkinleştirin veya başka seçin.",
      providerStrategy: "Sağlayıcı stratejisi", priority: "Öncelik", roundRobin: "Round robin", fallback: "Fallback", evaluator: "Değerlendirici",
      onWarning: "Uyarınca", preferCheaper: "Daha ucuzu tercih et", notifyOnly: "Yalnızca bildir", onCritical: "Kritikte", freeTierOnly: "Yalnızca free / free-tier",
      onExceeded: "Aşımda", blockPaid: "Ücretliyi engelle", allow: "İzin ver", cache: "Önbellek", freeTier: "Free tier",
      rtk: "RTK (tool_result sıkıştır — git/grep/ls/logs)", headroomCompress: "Headroom sıkıştırma (harici vekil)", headroomUrl: "Headroom URL",
      compressUserMessages: "Kullanıcı mesajlarını da sıkıştır", pxpipe: "pxpipe-lite (süreç içi araç sıkıştırma)", upstreamLoad: "Upstream yükü",
      concurrencyQueue: "Eşzamanlılık kuyruğu", concurrencyBody: "Oran sınırlarını korumak için paralel upstream çağrılarını sınırlayın. 0 = sınırsız (varsayılan).",
      maxConcurrentGlobal: "Maks eşzamanlı (genel)", maxConcurrentPerProvider: "Maks eşzamanlı (sağlayıcı başına)", queueWaitMs: "Kuyruk bekleme (ms)",
      mediaApis: "Medya API’leri", mediaRouting: "Medya yönlendirme",
      mediaBody: "Görüntü, konuşma, döküm ve embeddings’i belirli bir OpenAI uyumlu sağlayıcıya sabitleyin veya ana motor için Auto bırakın. Web araması yerleşik DuckDuckGo kullanır (anahtar yok).",
      images: "Görüntüler", speech: "Konuşma (TTS)", transcriptions: "Dökümler (STT)", embeddings: "Embeddings", webSearch: "Web arama",
      webSearchBuiltin: "Yerleşik (DuckDuckGo)", autoRouting: "Otomatik (yönlendirme motoru)", caveman: "Caveman", ponytail: "Ponytail"
    },
    password: { admin: "Yönetici", title: "Şifre", current: "Mevcut şifre", next: "Yeni şifre", save: "Şifreyi kaydet", updated: "Şifre güncellendi. Yeniden yükleniyor…", failed: "Şifre güncellenemedi." },
    aliases: {
      subtle: "Kısa model adları", title: "Takma adlar",
      body: "model: \"fast\"i bir sağlayıcı modeline veya komboya eşleyin. Codex için cx/gpt-…, Claude için cc/…, diğerleri kısa öneklerle.",
      empty: "Henüz takma ad yok.", alias: "Takma ad", target: "Hedef", targetPlaceholder: "sağlayıcı modeli veya kombo adı",
      add: "Takma ad ekle", delete: "Sil", importLabel: "9router JSON içe aktar", importPlaceholder: "{\"aliases\":{\"fast\":\"or/meta-llama/...\"}}",
      importButton: "9router JSON içe aktar", importing: "İçe aktarılıyor…", importPasteFirst: "Önce 9router GET /api/models/alias JSON’unu yapıştırın.",
      importInvalidJson: "Geçersiz JSON.", importFailed: "İçe aktarma başarısız.", importSummary: "{added} eklendi, {updated} güncellendi, {skipped} atlandı."
    }
  }
};
