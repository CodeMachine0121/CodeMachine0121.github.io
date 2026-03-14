---
title: "Day 15：啟用 Flakes — Nix 的未來已經到來"
datetime: "2026-03-29"
description: "介紹 Flakes 的核心概念與啟用方式，說明為何 Flakes 是 2024 年後 Nix 生態系的標準做法。"
parent: "NixOs Bootcamp"
---

# Day 15：啟用 Flakes — Nix 的未來已經到來

> 🗂️ NixOS 30 天學習之旅 ｜ 第三階段：Flakes 與 Home Manager（Day 15 – Day 21）

---

## 前言：歡迎來到第三階段

恭喜你走過前兩個階段！我們從 Nix 的基本概念、Nix language 語法，一路到用 `configuration.nix` 管理整個系統。到目前為止，你已經具備了操作 NixOS 的紮實基礎。

但如果你有持續關注 Nix 社群的動態，你大概會發現一個關鍵字不斷出現 —— **Flakes**。

從今天開始，我們進入第三階段的核心主題：**現代化的 Nix 流程**。Flakes 可以說是 2024 年之後 Nix 生態系的標準做法，幾乎所有主流的 Nix 專案都已經採用 Flakes 架構。學會它，你才算真正掌握了現代 Nix。

---

## 為什麼需要 Flakes？Channel 的問題

在前面的章節裡，我們透過 `nix-channel` 來管理套件來源：

```bash
# 傳統的 channel 操作
sudo nix-channel --add https://nixos.org/channels/nixos-24.05 nixos
sudo nix-channel --update
```

這個做法看起來沒什麼問題，但實際上存在幾個根本性的痛點：

### 1. 不可重現（Not Reproducible）

`nix-channel --update` 拉取的是「當下最新版本」，但它**不會記錄**你拉取的是哪個 commit。這意味著：

- 今天跑 `nix-channel --update` 和明天跑，可能拿到不同的 nixpkgs 版本
- 團隊成員各自 update，每個人的環境就可能不一致
- 沒有 lock file 的概念，無法精確固定版本

這直接違反了 Nix 最核心的設計理念 —— **reproducibility**。

### 2. 全域狀態（Global State）

Channel 是設定在系統層級或使用者層級的全域狀態。你無法讓「專案 A 用 nixpkgs 23.11、專案 B 用 nixpkgs 24.05」這種需求自然地被滿足。

### 3. 缺乏標準化的專案結構

傳統 Nix 沒有一個約定俗成的方式來描述「這個專案依賴哪些 Nix inputs、提供哪些 outputs」。每個人的做法都不同，造成社群生態碎片化。

**Flakes 就是為了解決這些問題而生的。**

---

## 啟用 Flakes

截至目前（2024 年底），Flakes 在技術上仍標記為 **experimental feature**。但別被這個標籤嚇到 —— 它已經被社群廣泛使用，幾乎所有主流工具和文件都預設你已啟用 Flakes。

### 方法一：修改 NixOS configuration（推薦）

如果你使用 NixOS，在 `/etc/nixos/configuration.nix` 中加入：

```nix
{ config, pkgs, ... }:

{
  nix.settings.experimental-features = [ "nix-command" "flakes" ];
}
```

然後重建系統：

```bash
sudo nixos-rebuild switch
```

### 方法二：修改 Nix daemon 設定檔

如果你是在 macOS 或其他 Linux distro 上使用 Nix package manager，可以編輯 `~/.config/nix/nix.conf`（使用者層級）或 `/etc/nix/nix.conf`（系統層級）：

```ini
experimental-features = nix-command flakes
```

### 方法三：臨時啟用（單次指令）

不想改設定檔？你也可以在每次執行指令時加上 flag：

```bash
nix --experimental-features 'nix-command flakes' flake init
```

但這當然不是長久之計，建議還是用方法一或二做永久設定。

### 驗證是否啟用成功

```bash
nix flake --help
```

如果看到 flake 相關的 subcommand 說明，就代表啟用成功了 🎉

---

## flake.nix 結構解析

Flakes 的核心就是一個叫做 `flake.nix` 的檔案，放在專案的根目錄。它用一個標準化的結構來描述：**這個專案需要什麼（inputs）、提供什麼（outputs）**。

### 最小範例

用以下指令初始化一個 flake：

```bash
nix flake init
```

這會產生一個基本的 `flake.nix`：

```nix
{
  description = "A very basic flake";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.05";
  };

  outputs = { self, nixpkgs }: {
    # 這裡定義你的 flake 提供什麼
  };
}
```

讓我們逐一拆解。

### `description`

一段簡短的文字描述，說明這個 flake 的用途。雖然是選填的，但建議都填寫，方便日後辨識。

### `inputs`：你的依賴來源

`inputs` 是一個 attribute set，列出這個 flake 依賴的所有外部來源。最常見的就是 `nixpkgs`：

```nix
inputs = {
  # 指向 GitHub 上的 nixpkgs，鎖定 nixos-24.05 branch
  nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.05";

  # 你也可以引用其他 flake
  home-manager = {
    url = "github:nix-community/home-manager/release-24.05";
    inputs.nixpkgs.follows = "nixpkgs";  # 讓 home-manager 使用同一份 nixpkgs
  };
};
```

常見的 input URL 格式：

| 格式 | 範例 | 說明 |
|------|------|------|
| `github:owner/repo` | `github:NixOS/nixpkgs` | GitHub repository（預設 branch） |
| `github:owner/repo/ref` | `github:NixOS/nixpkgs/nixos-24.05` | 指定 branch 或 tag |
| `path:/absolute/path` | `path:/home/user/my-flake` | 本機路徑 |
| `git+https://...` | `git+https://example.com/repo` | 任意 Git repository |

> 💡 **`follows` 是什麼？**
>
> 當多個 inputs 都依賴 `nixpkgs` 時，`inputs.nixpkgs.follows = "nixpkgs"` 可以讓它們共用同一份 nixpkgs，避免重複下載與版本不一致的問題。這是 Flakes 中非常實用的功能。

### `outputs`：你提供什麼

`outputs` 是一個 function，接收所有 resolved 過的 inputs，回傳一個 attribute set。這個 attribute set 的 key 有一些約定俗成的名稱：

```nix
outputs = { self, nixpkgs, ... }: let
  system = "x86_64-linux";
  pkgs = nixpkgs.legacyPackages.${system};
in {
  # NixOS system configuration
  nixosConfigurations.myhost = nixpkgs.lib.nixosSystem {
    inherit system;
    modules = [ ./configuration.nix ];
  };

  # Development shell
  devShells.${system}.default = pkgs.mkShell {
    packages = with pkgs; [ nodejs python3 git ];
  };

  # 可安裝的 package
  packages.${system}.default = pkgs.hello;

  # Nix app（可用 nix run 執行）
  apps.${system}.default = {
    type = "app";
    program = "${pkgs.hello}/bin/hello";
  };
};
```

常見的 output 類型整理如下：

| Output Key | 用途 | 對應指令 |
|------------|------|----------|
| `nixosConfigurations` | NixOS 系統設定 | `nixos-rebuild switch --flake .` |
| `devShells` | 開發環境 | `nix develop` |
| `packages` | 可建構的套件 | `nix build` |
| `apps` | 可執行的程式 | `nix run` |
| `overlays` | Nixpkgs overlay | 供其他 flake 引用 |
| `nixosModules` | 可重用的 NixOS module | 供其他 flake 引用 |

---

## flake.lock 的角色：可重現性的關鍵

當你第一次執行任何 flake 相關指令時（例如 `nix flake update` 或 `nix build`），Nix 會自動產生一個 `flake.lock` 檔案：

```json
{
  "nodes": {
    "nixpkgs": {
      "locked": {
        "lastModified": 1700000000,
        "narHash": "sha256-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX=",
        "owner": "NixOS",
        "repo": "nixpkgs",
        "rev": "abc123def456...",
        "type": "github"
      },
      "original": {
        "owner": "NixOS",
        "ref": "nixos-24.05",
        "repo": "nixpkgs",
        "type": "github"
      }
    }
  }
}
```

### 它為什麼重要？

`flake.lock` 記錄了每個 input 被 resolve 到的**精確 commit hash**。這意味著：

- ✅ **完全可重現**：不管什麼時間、在哪台機器上執行，只要 `flake.lock` 相同，就會拿到完全一樣的依賴版本
- ✅ **版本控制友善**：把 `flake.lock` 一起 commit 進 Git，團隊所有人都使用相同版本
- ✅ **明確的更新流程**：想更新依賴時，執行 `nix flake update`，review 一下 diff，確認沒問題再 commit

> 🔑 **重要觀念**：`flake.nix` 定義「我要什麼」，`flake.lock` 記錄「我實際拿到什麼」。兩者一起 commit，就能達成真正的 reproducibility。

---

## 基本 Flake 指令

啟用 Flakes 之後，你會使用新的 `nix` CLI（也就是同時啟用的 `nix-command`）。以下是最常用的指令：

### 初始化一個 Flake

```bash
# 在當前目錄建立 flake.nix
nix flake init

# 使用特定 template 初始化
nix flake init -t templates#trivial
```

### 查看 Flake 資訊

```bash
# 查看當前目錄的 flake 資訊
nix flake show

# 查看遠端 flake 的資訊
nix flake show github:NixOS/nixpkgs/nixos-24.05
```

### 更新依賴

```bash
# 更新所有 inputs
nix flake update

# 只更新特定 input
nix flake update nixpkgs
```

### 檢查 Flake 是否合法

```bash
nix flake check
```

### 常用的搭配指令

```bash
# 進入 devShell
nix develop

# 建構 default package
nix build

# 執行 default app
nix run

# 用 flake 重建 NixOS 系統
sudo nixos-rebuild switch --flake .#myhost
```

---

## Flakes vs Channels 比較表

| 比較項目 | Channels（傳統） | Flakes（現代） |
|----------|------------------|----------------|
| 版本鎖定 | ❌ 無 lock file，每次 update 結果不同 | ✅ `flake.lock` 精確鎖定 commit |
| 可重現性 | ⚠️ 仰賴手動記錄 | ✅ 天生可重現 |
| 專案隔離 | ❌ 全域 channel，專案間互相影響 | ✅ 每個專案獨立的 inputs |
| 標準化結構 | ❌ 各自為政 | ✅ 統一的 inputs/outputs schema |
| 多 input 管理 | ⚠️ 需要額外工具（如 niv） | ✅ 原生支援多 inputs + follows |
| 社群生態 | 🔄 逐漸被取代 | ✅ 主流專案皆已採用 |
| 學習曲線 | 較低 | 稍高（但一旦理解就很直覺） |

---

## 實戰：建立你的第一個 Flake

讓我們動手做一個簡單的 flake，提供一個包含常用工具的開發環境：

```bash
mkdir my-first-flake && cd my-first-flake
nix flake init
```

將 `flake.nix` 修改為：

```nix
{
  description = "My first flake - a dev environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.05";
  };

  outputs = { self, nixpkgs }: let
    system = "x86_64-linux";
    pkgs = nixpkgs.legacyPackages.${system};
  in {
    devShells.${system}.default = pkgs.mkShell {
      name = "my-dev-env";

      packages = with pkgs; [
        git
        curl
        jq
        ripgrep
      ];

      shellHook = ''
        echo "🚀 歡迎進入開發環境！"
        echo "可用工具：git, curl, jq, ripgrep"
      '';
    };
  };
}
```

進入開發環境：

```bash
nix develop
```

你應該會看到歡迎訊息，並且可以使用 `git`、`curl`、`jq`、`ripgrep` 這些工具。輸入 `exit` 或按 `Ctrl+D` 即可離開。

> 📝 **注意**：如果你使用的是 macOS（Apple Silicon），記得把 `system` 改為 `"aarch64-darwin"`。想要同時支援多個平台，可以使用 `flake-utils` 這個工具，我們後續會介紹。

---

## 小結

今天我們踏入了 Nix 現代化流程的第一步 —— Flakes。讓我們回顧一下重點：

- **Channel 的問題**：缺乏版本鎖定、全域狀態、沒有標準結構
- **Flakes 的解方**：`flake.nix`（宣告 inputs/outputs）+ `flake.lock`（鎖定版本）= 真正的 reproducibility
- **啟用方式**：在 `nix.settings.experimental-features` 加上 `"nix-command"` 和 `"flakes"`
- **核心指令**：`nix flake init`、`nix flake update`、`nix develop`、`nix build`、`nix run`

Flakes 初看可能有點抽象，但一旦你習慣了這套流程，就再也回不去了。它讓 Nix 的強大能力真正落地，成為日常開發中可靠且可重現的工具。

---

## 明日預告

> **Day 16：用 Flakes 重構 NixOS 設定**
>
> 學會了 Flakes 的基礎之後，明天我們要把既有的 `configuration.nix` 遷移到 Flakes 架構下。你會看到如何用 `flake.nix` 的 `nixosConfigurations` 來管理系統設定，並享受 `flake.lock` 帶來的版本鎖定好處。

我們明天見！ 🚀
