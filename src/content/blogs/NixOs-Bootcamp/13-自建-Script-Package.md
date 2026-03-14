---
title: "Day 13：實作 — 自建一個簡單的 Script Package"
datetime: "2026-03-27"
description: "使用 writeShellScriptBin 等 trivial builders，將自動化腳本打包成可重現的 Nix Package。"
parent: "NixOs Bootcamp"
---

# Day 13：實作 — 自建一個簡單的 Script Package

> **系列：** NixOS 30 天學習之旅
> **階段：** 第二階段 — 掌握 Nix 語言與開發環境 (Day 8 ~ Day 14)
> **今日主題：** 使用 `writeShellScriptBin` 把自動化腳本打包成 Nix Package

---

## 前言：為什麼要把腳本打包成 Package？

相信每位開發者的電腦裡，都有幾支自己寫的小腳本——也許是清理暫存檔的 `cleanup.sh`、也許是一鍵啟動開發環境的 `dev-start.sh`。這些腳本散落在不同目錄，換一台電腦就得重新設定，時間久了甚至忘了它們放在哪裡。

在 NixOS 的世界裡，我們可以把這些腳本打包成正式的 **Nix package**，享受以下好處：

- **可重現性**：腳本本身和它的相依工具都被 Nix 管理，到哪台機器都能跑
- **版本控制**：腳本寫在 Nix expression 裡，自然隨著 configuration 一起進 Git
- **統一管理**：透過 `environment.systemPackages` 或 Home Manager 安裝，跟其他軟體一視同仁
- **自動加入 `$PATH`**：安裝後直接在 terminal 輸入指令名稱就能執行，不用再記路徑

今天我們就來學習 Nixpkgs 提供的 **trivial builders**，把你的腳本變成一等公民的 Nix package。

---

## writeShellScriptBin 基本用法

`writeShellScriptBin` 是 Nixpkgs 提供的一個便利函數，專門用來將 inline 的 shell script 打包成一個 derivation，並自動放在 `bin/` 目錄下。

### 函數簽名

```nix
pkgs.writeShellScriptBin name text
```

- **`name`**：產出的執行檔名稱（會放在 `$out/bin/name`）
- **`text`**：shell script 的內容（Nix 會自動加上 `#!/usr/bin/env bash` shebang）

### 最簡範例

建立一個檔案 `hello.nix`：

```nix
{ pkgs ? import <nixpkgs> {} }:

pkgs.writeShellScriptBin "hello-nix" ''
  echo "Hello from Nix! 今天是 $(date '+%Y-%m-%d')"
''
```

用 `nix-build` 編譯並執行：

```bash
$ nix-build hello.nix
/nix/store/xxxx-hello-nix

$ ./result/bin/hello-nix
Hello from Nix! 今天是 2024-12-15
```

就這麼簡單！Nix 幫你做了這些事：

1. 建立一個 derivation
2. 在 `$out/bin/hello-nix` 產生一個可執行的 shell script
3. 自動加上 `#!/usr/bin/env bash` shebang
4. 把整個結果放進 Nix store

---

## 實作：打包一個系統清理腳本

讓我們做一個更實用的範例——一支系統清理腳本，可以一鍵清除 Nix store 中沒用到的 path、清理暫存檔，並顯示磁碟使用狀況。

### 步驟一：撰寫 Nix expression

建立 `sys-cleanup.nix`：

```nix
{ pkgs ? import <nixpkgs> {} }:

pkgs.writeShellScriptBin "sys-cleanup" ''
  set -euo pipefail

  echo "🧹 開始系統清理..."
  echo "================================"

  # 清理 Nix store 中未被參照的 path
  echo "➜ 清理未使用的 Nix store path..."
  nix-collect-garbage -d
  echo ""

  # 清理使用者暫存檔
  echo "➜ 清理 /tmp 中超過 7 天的檔案..."
  find /tmp -maxdepth 1 -mtime +7 -user "$(whoami)" -delete 2>/dev/null || true
  echo ""

  # 顯示磁碟使用狀況
  echo "➜ 目前磁碟使用狀況："
  df -h / /nix
  echo ""

  # 顯示 Nix store 大小
  echo "➜ Nix store 大小："
  du -sh /nix/store 2>/dev/null || echo "無法讀取"
  echo ""

  echo "================================"
  echo "✅ 系統清理完成！"
''
```

### 步驟二：建置與測試

```bash
# 建置
$ nix-build sys-cleanup.nix

# 執行
$ ./result/bin/sys-cleanup
🧹 開始系統清理...
================================
➜ 清理未使用的 Nix store path...
...
✅ 系統清理完成！
```

### 步驟三：加入系統設定

確認腳本運作正常後，我們可以直接在 `configuration.nix` 中 inline 定義：

```nix
# /etc/nixos/configuration.nix
{ config, pkgs, ... }:

{
  environment.systemPackages = [
    # 其他套件...
    (pkgs.writeShellScriptBin "sys-cleanup" ''
      set -euo pipefail
      echo "🧹 開始系統清理..."
      nix-collect-garbage -d
      echo "✅ 清理完成！"
    '')
  ];
}
```

執行 `sudo nixos-rebuild switch` 後，你就可以在任何地方直接輸入 `sys-cleanup` 來執行了！

---

## writeScriptBin 與其他 write\* 系列函數

Nixpkgs 的 trivial builders 提供了一整個家族的 `write*` 函數，讓你根據需求選擇最適合的工具。

### 家族總覽

| 函數 | 產出位置 | 自動 shebang | 適用情境 |
|------|----------|-------------|----------|
| `writeShellScriptBin` | `$out/bin/name` | ✅ `bash` | Shell script，要當指令用 |
| `writeShellScript` | `$out`（單一檔案） | ✅ `bash` | Shell script，當作其他 derivation 的 helper |
| `writeScriptBin` | `$out/bin/name` | ❌ 自己寫 | 任意語言腳本，要當指令用 |
| `writeScript` | `$out`（單一檔案） | ❌ 自己寫 | 任意語言腳本，當作 helper |
| `writeShellApplication` | `$out/bin/name` | ✅ `bash` | 進階版，支援 `runtimeInputs` 和 `shellcheck` |

### writeScriptBin — 用於非 Bash 的腳本

如果你的腳本不是 Bash，而是 Python、Ruby 或其他語言，就需要用 `writeScriptBin`，自己指定 shebang：

```nix
{ pkgs ? import <nixpkgs> {} }:

pkgs.writeScriptBin "py-hello" ''
  #!${pkgs.python3}/bin/python3
  import datetime
  print(f"Hello from Python! 現在時間：{datetime.datetime.now()}")
''
```

注意這裡的 shebang 用了 `${pkgs.python3}/bin/python3`——這是 Nix store 裡的完整路徑，確保不管系統環境怎麼變，都能找到正確的 Python interpreter。

### writeShellScript — 不放在 bin/ 的 helper script

有時候你只需要一個 script 檔案，不需要包成指令：

```nix
{ pkgs ? import <nixpkgs> {} }:

let
  helperScript = pkgs.writeShellScript "setup-env.sh" ''
    export PROJECT_ROOT="$(pwd)"
    export LANG="en_US.UTF-8"
    echo "環境變數已設定"
  '';
in
# helperScript 就是一個 /nix/store/xxx-setup-env.sh 的路徑
# 可以在其他 derivation 的 buildPhase 中 source 它
helperScript
```

### writeShellApplication — 推薦的進階做法（重點！）

`writeShellApplication` 是目前 **最推薦** 的方式，它相較於 `writeShellScriptBin` 多了幾個重要功能：

1. **`runtimeInputs`**：自動將相依工具加入 `$PATH`，不用手動拼接
2. **`shellcheck`**：建置時自動執行 shellcheck 靜態分析，幫你抓出腳本中的潛在問題
3. **更嚴格的預設**：預設啟用 `set -euo pipefail`

```nix
{ pkgs ? import <nixpkgs> {} }:

pkgs.writeShellApplication {
  name = "disk-report";

  runtimeInputs = with pkgs; [
    coreutils
    gawk
    ncurses   # 提供 tput 指令
  ];

  text = ''
    bold=$(tput bold)
    reset=$(tput sgr0)

    echo "''${bold}=== 磁碟使用報告 ===''${reset}"
    echo ""
    df -h | awk 'NR==1 || /\/$|\/nix$|\/home$/'
    echo ""
    echo "產生時間：$(date '+%Y-%m-%d %H:%M:%S')"
  '';
}
```

> 💡 **小提醒**：在 Nix 的 `'' ''` 字串中，如果要使用 `${...}` 作為 shell 變數（而非 Nix interpolation），需要寫成 `''${...}` 來跳脫。這是初學者常見的踩坑點！

---

## 將自製 Package 加入 systemPackages

目前為止我們都是用獨立的 `.nix` 檔加上 `nix-build` 來測試。實際上，你會想把這些自製工具整合進系統設定。

### 方法一：直接 inline（適合簡短腳本）

```nix
# configuration.nix
{ config, pkgs, ... }:

{
  environment.systemPackages = with pkgs; [
    vim
    git
    htop

    # 自製腳本直接 inline
    (writeShellScriptBin "quick-update" ''
      sudo nixos-rebuild switch --upgrade
      echo "✅ 系統更新完成"
    '')
  ];
}
```

### 方法二：抽成獨立檔案（推薦，適合多支腳本）

先建立一個腳本定義檔：

```nix
# scripts/sys-cleanup.nix
{ pkgs }:

pkgs.writeShellApplication {
  name = "sys-cleanup";
  runtimeInputs = with pkgs; [ coreutils findutils ];
  text = ''
    echo "🧹 開始清理..."
    nix-collect-garbage -d
    find /tmp -maxdepth 1 -mtime +7 -user "$(whoami)" -delete 2>/dev/null || true
    echo "✅ 完成"
  '';
}
```

在 `configuration.nix` 中引用：

```nix
# configuration.nix
{ config, pkgs, ... }:

let
  sys-cleanup = import ./scripts/sys-cleanup.nix { inherit pkgs; };
  disk-report = import ./scripts/disk-report.nix { inherit pkgs; };
in
{
  environment.systemPackages = [
    sys-cleanup
    disk-report
    # 其他系統套件...
  ];
}
```

### 方法三：打包成 overlay（進階，適合團隊共用）

```nix
# overlays/custom-scripts.nix
final: prev: {
  sys-cleanup = final.writeShellApplication {
    name = "sys-cleanup";
    runtimeInputs = with final; [ coreutils findutils ];
    text = ''
      echo "🧹 開始清理..."
      nix-collect-garbage -d
      echo "✅ 完成"
    '';
  };

  disk-report = final.writeShellApplication {
    name = "disk-report";
    runtimeInputs = with final; [ coreutils gawk ];
    text = ''
      echo "=== 磁碟報告 ==="
      df -h
    '';
  };
}
```

在 `configuration.nix` 中啟用 overlay：

```nix
{ config, pkgs, ... }:

{
  nixpkgs.overlays = [
    (import ./overlays/custom-scripts.nix)
  ];

  environment.systemPackages = with pkgs; [
    sys-cleanup
    disk-report
  ];
}
```

這樣一來，你的自製腳本就跟 nixpkgs 裡的套件一樣，可以透過 `pkgs.sys-cleanup` 引用了！

---

## 進階：包含相依套件的腳本

真實世界的腳本通常會用到外部工具，例如 `jq`、`curl`、`ripgrep` 等。讓我們來看看如何正確處理這些相依性。

### 問題：裸用 writeShellScriptBin 的風險

```nix
# ⚠️ 這樣寫有風險！
pkgs.writeShellScriptBin "fetch-ip" ''
  curl -s https://api.ipify.org | jq -r '.ip'
''
```

如果使用者的 `$PATH` 中沒有 `curl` 或 `jq`，這支腳本就會失敗。在 NixOS 上，除非你明確安裝了這些套件，否則它們不會出現在 `$PATH` 中。

### 解法一：用 writeShellApplication 的 runtimeInputs（推薦）

```nix
{ pkgs ? import <nixpkgs> {} }:

pkgs.writeShellApplication {
  name = "fetch-ip";

  runtimeInputs = with pkgs; [
    curl
    jq
  ];

  text = ''
    echo "正在查詢外部 IP..."
    ip=$(curl -s https://api.ipify.org?format=json | jq -r '.ip')
    echo "你的外部 IP 是：$ip"
  '';
}
```

`runtimeInputs` 會自動把 `curl` 和 `jq` 的 `bin/` 路徑加到腳本執行時的 `$PATH` 前面，保證一定找得到。

### 解法二：用 makeBinPath 手動設定（writeShellScriptBin 適用）

如果你基於某些原因不想用 `writeShellApplication`，也可以手動組合 `$PATH`：

```nix
{ pkgs ? import <nixpkgs> {} }:

pkgs.writeShellScriptBin "fetch-ip" ''
  export PATH="${pkgs.lib.makeBinPath (with pkgs; [ curl jq ])}:$PATH"

  echo "正在查詢外部 IP..."
  ip=$(curl -s https://api.ipify.org?format=json | jq -r '.ip')
  echo "你的外部 IP 是：$ip"
''
```

`pkgs.lib.makeBinPath` 會把一組 package 的 `bin/` 路徑串成一個 `:`-separated 的字串，方便你 prepend 到 `$PATH`。

### 完整實戰範例：Git 專案統計工具

來做一個稍微複雜的範例——一支腳本可以分析當前 Git repository 的統計資訊：

```nix
# scripts/git-stats.nix
{ pkgs }:

pkgs.writeShellApplication {
  name = "git-stats";

  runtimeInputs = with pkgs; [
    git
    coreutils
    gawk
    gnused
  ];

  text = ''
    if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
      echo "❌ 錯誤：請在 Git repository 中執行此指令"
      exit 1
    fi

    repo_name=$(basename "$(git rev-parse --show-toplevel)")
    branch=$(git branch --show-current)
    total_commits=$(git rev-list --count HEAD)
    contributors=$(git shortlog -sn --no-merges | wc -l | awk '{print $1}')
    first_commit=$(git log --reverse --format="%ai" | head -1 | cut -d' ' -f1)
    last_commit=$(git log -1 --format="%ai" | cut -d' ' -f1)

    echo "📊 Git 專案統計：$repo_name"
    echo "================================"
    echo "  目前分支：  $branch"
    echo "  總 commit 數：$total_commits"
    echo "  貢獻者人數：  $contributors"
    echo "  首次 commit：$first_commit"
    echo "  最近 commit：$last_commit"
    echo "================================"

    echo ""
    echo "📈 前五名貢獻者："
    git shortlog -sn --no-merges | head -5 | awk '{printf "  %s - %s commits\n", substr($0, index($0,$2)), $1}'

    echo ""
    echo "📁 檔案類型統計："
    git ls-files | sed 's/.*\.//' | sort | uniq -c | sort -rn | head -10 | \
      awk '{printf "  .%-12s %s 個檔案\n", $2, $1}'
  '';
}
```

這支 `git-stats` 工具展示了幾個重要的實作技巧：

1. **輸入驗證**：先檢查是否在 Git repository 中
2. **多個相依套件**：用到 `git`、`coreutils`、`gawk`、`gnused`
3. **結構化輸出**：清楚的分區和 emoji 標記
4. **錯誤處理**：`writeShellApplication` 預設啟用 `set -euo pipefail`

---

## 實戰練習

學會了基本原理，來動手試試看吧！

### 練習 1：打包一個 Nix 快速查詢工具

建立一個名為 `nix-search` 的指令，功能包含：
- 接受一個參數作為搜尋關鍵字
- 使用 `nix search` 搜尋 nixpkgs 中的套件
- 將結果格式化輸出

```nix
# 💡 提示：起手式
{ pkgs ? import <nixpkgs> {} }:

pkgs.writeShellApplication {
  name = "nix-search";
  runtimeInputs = with pkgs; [ nix ];
  text = ''
    if [ $# -eq 0 ]; then
      echo "用法：nix-search <關鍵字>"
      exit 1
    fi
    echo "🔍 搜尋 nixpkgs 中的 '$1'..."
    nix search nixpkgs "$1"
  '';
}
```

### 練習 2：打包一個 Python 腳本

用 `writeScriptBin` 打包一個 Python 腳本，計算指定目錄下各類檔案的數量：

```nix
# 💡 提示：使用 writeScriptBin + Python shebang
{ pkgs ? import <nixpkgs> {} }:

pkgs.writeScriptBin "file-counter" ''
  #!${pkgs.python3}/bin/python3
  import os, sys
  from collections import Counter

  target = sys.argv[1] if len(sys.argv) > 1 else "."
  exts = Counter()

  for root, dirs, files in os.walk(target):
      for f in files:
          ext = os.path.splitext(f)[1] or "(無副檔名)"
          exts[ext] += 1

  print(f"📁 目錄：{os.path.abspath(target)}")
  print("=" * 40)
  for ext, count in exts.most_common(15):
      print(f"  {ext:<15} {count} 個檔案")
''
```

### 練習 3：整合多個腳本到 configuration.nix

試著將上面的腳本整合到你的 NixOS 或 Home Manager 設定中，讓它們成為系統的一部分。

---

## 小結

今天我們學會了 Nixpkgs 中 trivial builders 家族的核心成員：

| 你想做的事 | 用這個函數 |
|-----------|-----------|
| 打包 Bash 腳本成指令 | `writeShellScriptBin` |
| 打包 Bash 腳本（含相依套件管理 + shellcheck） | `writeShellApplication` ⭐ 推薦 |
| 打包其他語言的腳本成指令 | `writeScriptBin` |
| 產生一個 script 檔案（不放在 bin/） | `writeShellScript` / `writeScript` |

**重點回顧：**

1. `writeShellScriptBin` 是最簡單直覺的方式，適合快速打包小腳本
2. `writeShellApplication` 是目前推薦的做法，支援 `runtimeInputs` 自動管理相依套件，還有 `shellcheck` 幫你抓錯
3. `writeScriptBin` 適合非 Bash 的腳本（Python、Ruby 等），需要自己寫 shebang
4. 腳本可以 inline 寫在 `configuration.nix`、抽成獨立檔案、或透過 overlay 管理
5. 在 Nix 的 `'' ''` 字串中使用 shell 變數時，記得用 `''${...}` 跳脫

把腳本打包成 Nix package 的最大價值，在於讓你的自動化工具具備**可重現性**——不管在哪台機器上，只要 rebuild 一下，你所有的小工具都會到位，隨時可用。

---

## 明日預告

**Day 14：總複習 — 用 Nix 打造你的完整開發環境**

明天是第二階段的最後一天，我們會把這一週學到的所有技能串在一起：用 `mkShell` 建立開發環境、用 `writeShellApplication` 打包工具腳本、用 overlay 擴充 nixpkgs——一次整合成一個完整的專案開發環境。準備好了嗎？我們明天見！
