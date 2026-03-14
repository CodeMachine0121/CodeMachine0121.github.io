---
title: "Day 26：自定義 NixOS Module — 讓你的配置也能像官方服務一樣被呼叫"
datetime: "2026-04-09"
description: "學習撰寫自訂 NixOS Module，理解 module system 中 options 宣告與 config 實作的核心機制，打造可重用、可組合的系統模組。"
parent: "NixOs Bootcamp"
---

# Day 26：自定義 NixOS Module — 讓你的配置也能像官方服務一樣被呼叫

> 🗓 系列：NixOS 30 天學習之旅  
> 📦 階段：第四階段 — 工程師進階實務（Day 22 – Day 30）  
> 🎯 階段核心目標：佈署、自動化、安全性與貢獻

---

## 前言：從使用模組到撰寫模組

在前面的旅程中，我們已經大量使用了 NixOS 的 module。像是 `services.nginx.enable = true` 或 `services.openssh.enable = true`，一行設定就能啟動一個完整的服務，背後的複雜度全部被封裝起來。

你有沒有想過：**這些 module 是怎麼做到的？**

今天，我們要翻到舞台的另一面 — 不只是使用別人寫好的 module，而是學會**自己撰寫 module**。當你掌握了 NixOS module system 的核心機制，你就能把自己的服務配置、應用程式設定、甚至整套佈署流程，打包成可重用、可組合的模組。

這不只是進階技巧，更是邁向「NixOS 架構師」的關鍵一步。

---

## NixOS Module System 概述

NixOS 的 module system 是整個系統的骨幹。你在 `configuration.nix` 裡寫的每一行設定，背後都有一個對應的 module 在定義它的行為。

### Module System 的核心設計哲學

NixOS module system 的設計目標是讓**多個獨立的模組可以互相組合，而不需要知道彼此的存在**。每個 module 負責：

1. **宣告 options**：定義這個模組提供哪些可配置的選項（「我接受哪些參數」）
2. **實作 config**：根據使用者設定的 option 值，產出最終的系統配置（「拿到參數後我要做什麼」）

這種 `options` + `config` 的拆分方式，讓模組之間可以自由組合。Module A 可以讀取 Module B 定義的 option，Module B 也可以根據 Module A 的設定來調整自己的行為。

### Module 的合併機制

當你在 `configuration.nix` 中 import 了多個 module，NixOS 會把所有 module 的 `options` 合併成一棵完整的 option tree，然後把所有 module 的 `config` 合併成最終的系統配置。

```
Module A (options + config)  ─┐
Module B (options + config)  ─┼→ 合併 → 完整的系統配置
Module C (options + config)  ─┘
```

這個合併過程是 NixOS 的核心魔法。它讓你可以把系統拆成數十個甚至數百個小模組，各自獨立維護，最終組合成一個完整的系統。

---

## Module 的基本結構

一個 NixOS module 本質上就是一個 Nix function，回傳一個包含 `options` 和 `config` 的 attribute set。

### 最精簡的 module

```nix
# my-module.nix
{ config, lib, pkgs, ... }:

{
  options = {
    # 定義這個模組提供的選項
  };

  config = {
    # 根據選項的值，產出系統配置
  };
}
```

### 參數說明

| 參數 | 說明 |
|------|------|
| `config` | 整個系統最終合併後的配置（可以讀取其他 module 的設定值） |
| `lib` | Nix 的標準函式庫，包含 `mkOption`、`mkIf`、`types` 等工具 |
| `pkgs` | Nixpkgs 套件集合 |
| `...` | 允許接收其他可能的參數（必須加上，否則 NixOS 會報錯） |

### 完整範例：一個簡單的 greeting module

讓我們從一個最簡單的例子開始：

```nix
# modules/greeting.nix
{ config, lib, pkgs, ... }:

let
  cfg = config.services.greeting;
in
{
  options.services.greeting = {
    enable = lib.mkEnableOption "greeting service";

    message = lib.mkOption {
      type = lib.types.str;
      default = "Hello, NixOS!";
      description = "The greeting message to display.";
    };
  };

  config = lib.mkIf cfg.enable {
    environment.etc."greeting.txt".text = cfg.message;
  };
}
```

使用這個 module 時，你可以在 `configuration.nix` 中這樣寫：

```nix
{
  imports = [ ./modules/greeting.nix ];

  services.greeting = {
    enable = true;
    message = "歡迎來到我的 NixOS 伺服器！";
  };
}
```

看起來是不是跟使用官方 module 一模一樣？這就是 module system 的威力 — 你的自定義配置，享有和官方服務完全一致的使用體驗。

---

## `mkOption` 與 `types` 詳解

`mkOption` 是定義 module option 的核心函式。它接收一個 attribute set，用來描述這個選項的各種屬性。

### `mkOption` 的完整參數

```nix
lib.mkOption {
  type = lib.types.str;          # 型別（必填）
  default = "some value";        # 預設值（選填）
  example = "example value";     # 範例值，用於文件產生
  description = "描述這個選項";    # 說明文字
}
```

| 參數 | 必填 | 說明 |
|------|:----:|------|
| `type` | ✅ | 指定這個 option 接受的值的型別 |
| `default` | ❌ | 預設值。如果不提供，使用者就必須明確設定這個 option |
| `example` | ❌ | 範例值，會出現在 `nixos-option` 或線上文件中 |
| `description` | ❌ | 選項的文字說明，建議一定要寫 |

### 常用的 `types`

NixOS 提供了豐富的型別系統，以下是最常用的幾種：

#### 基本型別

```nix
lib.types.str          # 字串
lib.types.int          # 整數
lib.types.bool         # 布林值
lib.types.float        # 浮點數
lib.types.path         # 檔案路徑
lib.types.package      # Nix 套件
lib.types.port         # port 號碼 (0-65535)
```

#### 複合型別

```nix
lib.types.listOf lib.types.str        # 字串 list（如 ["a" "b" "c"]）
lib.types.attrsOf lib.types.int       # 以字串為 key、整數為 value 的 attribute set
lib.types.nullOr lib.types.str        # 可以是 null 或字串
lib.types.enum [ "debug" "info" "warn" "error" ]  # 列舉型別
lib.types.either lib.types.str lib.types.int       # 字串或整數
```

#### Submodule（巢狀結構）

當你需要定義更複雜的結構化選項時，`submodule` 非常好用：

```nix
lib.types.submodule {
  options = {
    host = lib.mkOption {
      type = lib.types.str;
      description = "Hostname of the server.";
    };
    port = lib.mkOption {
      type = lib.types.port;
      default = 8080;
      description = "Port number.";
    };
  };
}
```

使用 `submodule` 搭配 `attrsOf`，可以定義多組具名的設定：

```nix
options.services.myApp.virtualHosts = lib.mkOption {
  type = lib.types.attrsOf (lib.types.submodule {
    options = {
      root = lib.mkOption {
        type = lib.types.path;
        description = "Document root.";
      };
      port = lib.mkOption {
        type = lib.types.port;
        default = 80;
      };
    };
  });
  default = {};
  description = "Virtual host configurations.";
};
```

使用時就像這樣：

```nix
services.myApp.virtualHosts = {
  "blog.example.com" = {
    root = /var/www/blog;
    port = 8081;
  };
  "api.example.com" = {
    root = /var/www/api;
    port = 8082;
  };
};
```

這就是 NixOS 官方 module（如 `services.nginx.virtualHosts`）背後的實作方式。

---

## 實戰：撰寫一個自訂服務模組

讓我們動手寫一個比較完整的 module — 一個簡單的 systemd service，定期執行健康檢查腳本。

### 需求

- 可以啟用 / 停用這個服務
- 可以設定要檢查的 URL
- 可以設定檢查間隔
- 可以設定 log 輸出路徑
- 服務以非 root 使用者身份執行

### 實作

```nix
# modules/health-check.nix
{ config, lib, pkgs, ... }:

let
  cfg = config.services.healthCheck;

  # 產生健康檢查腳本
  healthCheckScript = pkgs.writeShellScript "health-check" ''
    #!/usr/bin/env bash
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    HTTP_CODE=$(${pkgs.curl}/bin/curl -s -o /dev/null -w "%{http_code}" "${cfg.url}")

    if [ "$HTTP_CODE" -eq 200 ]; then
      echo "[$TIMESTAMP] OK - ${cfg.url} returned $HTTP_CODE" >> ${cfg.logFile}
    else
      echo "[$TIMESTAMP] FAIL - ${cfg.url} returned $HTTP_CODE" >> ${cfg.logFile}
    fi
  '';
in
{
  # ============================
  # Options：定義可配置的選項
  # ============================
  options.services.healthCheck = {
    enable = lib.mkEnableOption "periodic health check service";

    url = lib.mkOption {
      type = lib.types.str;
      example = "https://example.com/health";
      description = "The URL to check.";
    };

    interval = lib.mkOption {
      type = lib.types.str;
      default = "5min";
      example = "1min";
      description = ''
        How often to run the health check.
        Uses systemd timer format (e.g., "5min", "1h", "30s").
      '';
    };

    logFile = lib.mkOption {
      type = lib.types.path;
      default = "/var/log/health-check.log";
      description = "Path to the log file.";
    };

    user = lib.mkOption {
      type = lib.types.str;
      default = "health-check";
      description = "User account under which the service runs.";
    };
  };

  # ============================
  # Config：根據 options 產出設定
  # ============================
  config = lib.mkIf cfg.enable {
    # 建立專用使用者
    users.users.${cfg.user} = {
      isSystemUser = true;
      group = cfg.user;
      description = "Health check service user";
    };
    users.groups.${cfg.user} = {};

    # 建立 systemd service
    systemd.services.health-check = {
      description = "Periodic Health Check Service";
      after = [ "network-online.target" ];
      wants = [ "network-online.target" ];

      serviceConfig = {
        Type = "oneshot";
        ExecStart = "${healthCheckScript}";
        User = cfg.user;
      };
    };

    # 建立 systemd timer
    systemd.timers.health-check = {
      description = "Timer for Health Check Service";
      wantedBy = [ "timers.target" ];

      timerConfig = {
        OnBootSec = cfg.interval;
        OnUnitActiveSec = cfg.interval;
        Unit = "health-check.service";
      };
    };
  };
}
```

### 使用方式

在 `configuration.nix` 中引入並配置：

```nix
{ config, pkgs, ... }:

{
  imports = [ ./modules/health-check.nix ];

  services.healthCheck = {
    enable = true;
    url = "https://my-app.example.com/health";
    interval = "2min";
    logFile = "/var/log/my-app-health.log";
  };
}
```

執行 `sudo nixos-rebuild switch` 之後，NixOS 會自動建立使用者、產生 systemd service 和 timer，開始定期檢查你指定的 URL。

看看，**使用起來是不是就跟官方內建的服務一模一樣？** 這就是 NixOS module system 的美妙之處。

---

## `mkEnableOption` 與 `mkIf`

這兩個是撰寫 module 時最常搭配使用的工具，值得單獨拿出來講清楚。

### `mkEnableOption`

`mkEnableOption` 是 `mkOption` 的語法糖，專門用來定義 `enable` 選項：

```nix
# 這兩種寫法完全等價
enable = lib.mkEnableOption "my service";

enable = lib.mkOption {
  type = lib.types.bool;
  default = false;
  description = "Whether to enable my service.";
};
```

使用 `mkEnableOption` 的好處是簡潔，而且自動產生標準化的 description。它接受一個字串參數，會自動組合成 `"Whether to enable <你給的字串>."` 這樣的說明文字。

### `mkIf`：條件化配置

`mkIf` 讓你可以根據某個條件，決定是否套用一段配置。這是實作 `enable` 開關的核心：

```nix
config = lib.mkIf cfg.enable {
  # 只有當 enable = true 時，這裡面的設定才會生效
  systemd.services.myService = { ... };
  environment.systemPackages = [ pkgs.myPackage ];
};
```

`mkIf` 的重要特性：**它不是「有條件地執行程式碼」，而是「有條件地將這段配置納入合併」**。在 Nix 的世界裡沒有 side effect，一切都是 value。`mkIf` 產生的是一個帶有條件標記的值，NixOS 在合併所有 module 的配置時，會根據條件決定是否將這段值納入最終結果。

### `mkMerge`：合併多段條件配置

當你需要根據不同條件套用不同的配置時，`mkMerge` 搭配 `mkIf` 非常實用：

```nix
config = lib.mkMerge [
  (lib.mkIf cfg.enable {
    systemd.services.myService = { ... };
  })

  (lib.mkIf cfg.enableMonitoring {
    services.prometheus.exporters.myExporter = { ... };
  })

  (lib.mkIf (cfg.enable && cfg.ssl) {
    security.acme.certs."my-domain" = { ... };
  })
];
```

這讓你可以把不同功能面向的配置分開撰寫，邏輯更清晰。

---

## 模組測試與除錯

寫好 module 之後，怎麼確認它是正確的？以下介紹幾種實用的測試與除錯方法。

### 1. 使用 `nixos-rebuild build` 做語法檢查

在正式套用之前，先用 `build` 驗證配置是否有語法錯誤：

```bash
sudo nixos-rebuild build
```

這只會 build 出新的 system，不會實際切換。如果你的 module 有語法錯誤或 type mismatch，就會在這一步被抓出來。

### 2. 使用 `nixos-option` 查詢 option 定義

```bash
# 查看某個 option 的定義與當前值
nixos-option services.healthCheck.url

# 列出某個 namespace 下的所有 options
nixos-option services.healthCheck
```

這個指令非常適合用來確認你的 option 有沒有被正確註冊、type 是否符合預期。

### 3. 使用 `nix repl` 互動式除錯

```bash
# 載入系統配置進入 REPL
nix repl '<nixpkgs/nixos>' --arg configuration /etc/nixos/configuration.nix
```

在 REPL 中，你可以互動式地查看各種 option 值：

```nix
nix-repl> config.services.healthCheck.enable
true

nix-repl> config.services.healthCheck.url
"https://my-app.example.com/health"

nix-repl> config.systemd.services.health-check.serviceConfig.ExecStart
"/nix/store/xxx...-health-check"
```

### 4. 用 NixOS test framework 撰寫整合測試

NixOS 有一個強大的 VM-based test framework，可以在虛擬機中自動化測試你的 module：

```nix
# tests/health-check-test.nix
import <nixpkgs/nixos/tests/make-test-python.nix> ({ pkgs, ... }: {
  name = "health-check";

  nodes.server = { config, pkgs, ... }: {
    imports = [ ../modules/health-check.nix ];

    services.healthCheck = {
      enable = true;
      url = "http://localhost:8080/health";
      interval = "10s";
    };

    # 起一個簡單的 HTTP server 來測試
    systemd.services.dummy-http = {
      wantedBy = [ "multi-user.target" ];
      script = ''
        ${pkgs.python3}/bin/python3 -m http.server 8080
      '';
    };
  };

  testScript = ''
    server.wait_for_unit("timers.target")
    server.wait_for_unit("health-check.timer")

    # 手動觸發一次 health check
    server.succeed("systemctl start health-check.service")

    # 確認 log 檔案存在且有內容
    server.wait_until_succeeds("test -s /var/log/health-check.log")
    server.succeed("grep 'OK' /var/log/health-check.log")
  '';
})
```

執行測試：

```bash
nix-build tests/health-check-test.nix
```

這會自動啟動一個 QEMU 虛擬機，佈署你的 module，執行測試腳本，然後回報結果。雖然執行速度比較慢，但這是最可靠的 module 驗證方式。

### 5. 常見錯誤與排查

| 錯誤訊息 | 可能原因 | 解法 |
|---------|---------|------|
| `The option ... does not exist` | option 路徑打錯或 module 沒有被 import | 檢查 `imports` 和 option 路徑 |
| `A value of type ... is not of type ...` | 型別不匹配 | 確認 `mkOption` 的 `type` 和你傳入的值是否一致 |
| `The option ... is used but not defined` | 使用了未定義的 option | 確認 module 有正確定義 `options` 區塊 |
| `Infinite recursion encountered` | 在 option 定義中直接引用了 `config` 的值 | 確保 `options` 區塊不要依賴 `config` |

> 💡 **小技巧**：`Infinite recursion` 是 NixOS module 開發中最常見也最惱人的錯誤。記住一個原則：**`options` 區塊定義結構，`config` 區塊讀取 `config.*` 的值**。不要在 `options` 的 `default` 裡面去讀 `config` 中其他 option 的值，否則就會造成循環依賴。

---

## 進階技巧：Module 的組織與最佳實踐

隨著你的 module 越寫越多，以下是一些維護性的建議：

### 1. 檔案組織

```
/etc/nixos/
├── configuration.nix          # 主配置
├── hardware-configuration.nix # 硬體設定
└── modules/
    ├── health-check.nix       # 健康檢查模組
    ├── backup.nix             # 備份模組
    └── monitoring.nix         # 監控模組
```

### 2. 使用 `let cfg = config.xxx` 慣用寫法

幾乎所有 NixOS 官方 module 都會在最上方定義 `cfg`：

```nix
let
  cfg = config.services.myService;
in
{
  # 之後就可以用 cfg.enable、cfg.port 等簡短寫法
}
```

這不只是為了方便，更是一種約定俗成的風格，讓其他開發者一眼就能看懂。

### 3. 善用 `lib.mdDoc` 撰寫 option description

```nix
description = lib.mdDoc ''
  The URL endpoint to monitor.

  This should be a full URL including the protocol,
  for example `https://example.com/health`.
'';
```

使用 Markdown 格式的 description，在產生文件時會有更好的排版效果。

### 4. 為你的 module 選擇正確的 option 命名空間

- 系統服務放在 `services.<name>`
- 程式設定放在 `programs.<name>`
- 跟安全相關的放在 `security.<name>`
- 跟網路相關的放在 `networking.<name>`

遵循既有的命名慣例，讓你的 module 融入整個 NixOS 生態系。

---

## 小結

今天我們學會了 NixOS module system 的核心：

| 概念 | 說明 |
|------|------|
| **Module 結構** | 一個 function，回傳包含 `options` 和 `config` 的 attribute set |
| **`mkOption`** | 定義 option 的函式，可指定 `type`、`default`、`description` 等 |
| **`types`** | 豐富的型別系統，從基本的 `str`、`int` 到複合的 `listOf`、`submodule` |
| **`mkEnableOption`** | 定義 `enable` 選項的語法糖 |
| **`mkIf`** | 條件化配置，搭配 `enable` 實現功能開關 |
| **`mkMerge`** | 合併多段條件配置 |
| **測試** | 從 `nixos-rebuild build` 語法檢查到 VM-based test framework |

掌握了 module system，你就能把任何自訂的服務、配置、佈署流程包裝成模組化的形式。不僅自己用起來方便，也能輕鬆分享給團隊或社群。

---

## 明日預告

**Day 27：貢獻 Nixpkgs** — 你已經會寫 module 了，那何不把它貢獻回社群？明天我們會介紹如何向 Nixpkgs 發送 Pull Request，從 fork repository、撰寫 commit message、到通過 CI 審查，帶你走一遍完整的貢獻流程。

我們明天見！ 🚀

---

📚 **延伸閱讀**
- [NixOS Module System 官方文件](https://nixos.org/manual/nixos/stable/#sec-writing-modules)
- [NixOS Wiki — Module](https://wiki.nixos.org/wiki/NixOS_modules)
- [Nixpkgs lib.types 原始碼](https://github.com/NixOS/nixpkgs/blob/master/lib/types.nix)
- [NixOS Options 搜尋](https://search.nixos.org/options)
