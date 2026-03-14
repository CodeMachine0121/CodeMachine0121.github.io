---
title: "Day 11：Nix Search 與 Channels —— 軟體包從哪裡來？"
datetime: "2026-03-25"
description: "介紹 Nixpkgs 套件庫與 Channels 機制，說明 Nix 軟體包的來源與版本管理方式。"
parent: "NixOs Bootcamp"
---

# Day 11：Nix Search 與 Channels —— 軟體包從哪裡來？

> 📅 NixOS 30 天學習之旅 ・ 第二階段：掌握 Nix 語言與開發環境 (Day 8 – Day 14)

---

## 前言：軟體包從哪裡來？

在前幾天的學習中，我們已經透過 `nix-env -iA` 或 `environment.systemPackages` 安裝了不少軟體。但你有沒有想過：**這些軟體包到底是從哪裡來的？**

當你執行 `nix-env -iA nixpkgs.git` 的時候，Nix 去哪裡找到 Git 的 build 指令？它怎麼知道要下載哪個版本？又是誰維護這一切的？

答案就是今天的主角：**Nixpkgs** 與 **Channels**。

理解這兩個概念，你才能真正掌控自己安裝的軟體版本，而不只是「裝了就好」。

---

## Nixpkgs 是什麼？

**Nixpkgs**（Nix Packages）是全世界最大的軟體套件庫之一。它是一個 GitHub 上的 monorepo，裡面包含了超過 100,000 個套件的 Nix expression。

> 🔗 GitHub repository：[https://github.com/NixOS/nixpkgs](https://github.com/NixOS/nixpkgs)

簡單來說，Nixpkgs 就是一個巨大的 Nix 函式集合。每個套件都是一個 Nix expression，描述了如何從 source code 編譯、打包並安裝該軟體。

```nix
# 概念上，nixpkgs 就像一個巨大的 attribute set
{
  git = mkDerivation { ... };
  nodejs = mkDerivation { ... };
  firefox = mkDerivation { ... };
  # ... 超過 100,000 個套件
}
```

當你寫 `nixpkgs.git` 時，你其實就是在存取這個 attribute set 中的 `git` 這個 key。回想 Day 9 學過的 attribute set 語法，是不是突然覺得一切都串起來了？

### Nixpkgs 的特色

| 特色 | 說明 |
|------|------|
| **規模龐大** | 超過 100,000 個套件，涵蓋主流程式語言、工具、桌面應用 |
| **社群驅動** | 由全球數千名 contributor 共同維護 |
| **版本化** | 透過 Git branch 管理不同版本的 release |
| **可重現** | 每個套件都有明確的 dependency tree，確保 build 結果一致 |

---

## Channel 的概念

既然 Nixpkgs 是一個 Git repository，那我們要追蹤哪個 branch 呢？這就是 **Channel** 的用途。

**Channel 就是 Nixpkgs 某個特定 branch 的「快照」，經過 CI 測試驗證後發佈出來的穩定版本。**

你可以把 Channel 想成是 Ubuntu 的 `apt` source list，或 Homebrew 的 tap —— 它告訴 Nix「去哪裡找套件」。

### 常見的 Channel 種類

| Channel 名稱 | 說明 | 適用場景 |
|--------------|------|----------|
| `nixos-24.11` | 穩定版（stable），約每半年 release 一次 | 生產環境、追求穩定性 |
| `nixos-unstable` | 滾動更新，追蹤最新套件 | 開發環境、需要最新版本 |
| `nixos-24.11-small` | 穩定版的精簡測試 channel，更新較快 | 伺服器環境、不需桌面套件 |
| `nixpkgs-unstable` | 非 NixOS 使用者的 unstable channel | macOS 或其他 Linux distro 使用 Nix |

> 💡 **stable vs unstable 怎麼選？**
>
> - 如果你是在 production server 上跑 NixOS，選 stable（如 `nixos-24.11`）。
> - 如果你是開發者，想要用最新版的 Node.js、Rust 等工具，選 unstable。
> - 兩者可以並存！你可以同時訂閱多個 channel，從不同 channel 安裝不同套件。

### Channel 的運作流程

```
GitHub nixpkgs repo
       │
       ├── branch: nixos-24.11
       │         │
       │         ▼
       │    Hydra CI 測試
       │         │
       │         ▼ (測試通過)
       │    nixos-24.11 channel 發佈
       │
       └── branch: nixos-unstable
                 │
                 ▼
            Hydra CI 測試
                 │
                 ▼ (測試通過)
            nixos-unstable channel 發佈
```

**Hydra** 是 NixOS 官方的 CI 系統。每當 Nixpkgs 的 branch 有更新，Hydra 會自動 build 並測試所有套件。只有通過測試的 commit 才會被推送到 channel 上。這就是為什麼 channel 比直接追蹤 Git branch 更可靠。

---

## nix-channel 指令操作

### 查看目前的 channel

```bash
nix-channel --list
```

輸出範例：

```
nixpkgs https://nixos.org/channels/nixpkgs-unstable
```

如果你是 NixOS 使用者，可能會看到：

```
nixos https://nixos.org/channels/nixos-24.11
```

### 新增 channel

假設你目前使用 stable，想額外加入 unstable channel：

```bash
# 新增 unstable channel，並取名為 nixpkgs-unstable
nix-channel --add https://nixos.org/channels/nixpkgs-unstable nixpkgs-unstable

# 更新 channel 資料（類似 apt update）
nix-channel --update
```

這裡的第二個參數 `nixpkgs-unstable` 是你自訂的名稱，之後可以用來指定從哪個 channel 安裝套件：

```bash
# 從 unstable channel 安裝最新版的 Node.js
nix-env -iA nixpkgs-unstable.nodejs
```

### 移除 channel

```bash
nix-channel --remove nixpkgs-unstable
```

### 更新 channel

```bash
# 更新所有 channel
nix-channel --update

# 只更新特定 channel
nix-channel --update nixpkgs
```

> ⚠️ 注意：`nix-channel --update` 只是下載最新的 channel 資訊，**不會自動升級已安裝的套件**。你需要另外執行 `nix-env --upgrade` 或重新 `nixos-rebuild switch` 才會實際更新軟體。

### 常用指令速查表

| 指令 | 說明 |
|------|------|
| `nix-channel --list` | 列出所有已訂閱的 channel |
| `nix-channel --add <url> <name>` | 新增 channel |
| `nix-channel --remove <name>` | 移除 channel |
| `nix-channel --update` | 更新所有 channel |
| `nix-channel --update <name>` | 更新指定 channel |

---

## 搜尋套件的方法

知道去哪裡找套件後，接下來最常見的問題就是：**「這個軟體在 Nixpkgs 裡叫什麼名字？」**

### 方法一：search.nixos.org（推薦）

最直覺的方式就是到官方搜尋網站：

> 🔗 [https://search.nixos.org/packages](https://search.nixos.org/packages)

在這裡你可以：

- 以關鍵字搜尋套件名稱或描述
- 查看套件的版本、license、maintainer
- 切換不同 channel（stable / unstable）的搜尋結果
- 直接複製安裝指令

例如搜尋 `ripgrep`，你會看到：

- **Package name:** `ripgrep`
- **Version:** 14.1.1（unstable 可能更新）
- **Programs provided:** `rg`
- **Install command:** `nix-env -iA nixpkgs.ripgrep`

這個網站還有另一個超好用的功能 —— **NixOS Options 搜尋**。在「Options」分頁中，你可以搜尋所有可用的 NixOS 設定選項，例如搜尋 `nginx` 就能看到所有 Nginx 相關的 configuration option。

### 方法二：nix search 指令

如果你偏好在 terminal 操作，可以使用 `nix search` 指令：

```bash
# 搜尋套件（需要啟用 experimental features）
nix search nixpkgs ripgrep
```

輸出範例：

```
* legacyPackages.x86_64-linux.ripgrep (14.1.1)
  A utility that combines the usability of The Silver Searcher
  with the raw speed of grep
```

> 💡 `nix search` 是新版 Nix CLI 的指令，需要在 `~/.config/nix/nix.conf` 中啟用：
>
> ```
> experimental-features = nix-command flakes
> ```

如果你還沒啟用新版 CLI，也可以用傳統的方式：

```bash
# 傳統搜尋方式
nix-env -qaP '.*ripgrep.*'
```

不過這個方法會比較慢，因為它需要 evaluate 整個 Nixpkgs。

### 方法三：nix-locate（按檔案搜尋）

有時候你知道指令名稱，但不知道它屬於哪個套件。這時候可以用 `nix-locate`：

```bash
# 先安裝 nix-index
nix-env -iA nixpkgs.nix-index

# 建立索引（第一次需要，會花一點時間）
nix-index

# 搜尋提供 rg 指令的套件
nix-locate --whole-name --top-level bin/rg
```

輸出：

```
ripgrep.out    42,744 r /nix/store/...-ripgrep-14.1.1/bin/rg
```

這就像 Ubuntu 的 `apt-file search` 或 Arch 的 `pkgfile` 一樣實用。

### 搜尋方法比較

| 方法 | 優點 | 缺點 |
|------|------|------|
| search.nixos.org | 直覺、資訊豐富、不需安裝 | 需要網路 |
| `nix search` | 快速、可 script 化 | 需啟用 experimental features |
| `nix-env -qaP` | 不需額外設定 | 速度慢 |
| `nix-locate` | 可按檔案名搜尋 | 需要預先建立索引 |

---

## 使用特定版本的套件

這是 Nix 相較於其他 package manager 最強大的功能之一：**你可以輕鬆使用任何版本的套件**。

### 情境：你需要 Node.js 18，但 channel 上是 Node.js 22

在傳統的 package manager 中，這通常很麻煩。但在 Nix 的世界裡，Nixpkgs 通常會同時提供多個主要版本：

```bash
# 搜尋所有 Node.js 相關套件
nix search nixpkgs nodejs
```

你會發現 Nixpkgs 中有多個版本：

```
* legacyPackages.x86_64-linux.nodejs_18 (18.20.x)
* legacyPackages.x86_64-linux.nodejs_20 (20.18.x)
* legacyPackages.x86_64-linux.nodejs_22 (22.12.x)
* legacyPackages.x86_64-linux.nodejs (22.12.x)  # alias，指向目前預設版本
```

安裝特定版本非常直覺：

```bash
nix-env -iA nixpkgs.nodejs_18
```

或者在 NixOS configuration 中：

```nix
# /etc/nixos/configuration.nix
environment.systemPackages = with pkgs; [
  nodejs_18
  # 而不是 nodejs（預設版本）
];
```

### 使用特定 Nixpkgs commit 的套件

如果你需要的版本連 `nodejs_18` 都沒有涵蓋到（例如非常舊的版本），你可以**固定 Nixpkgs 到某個特定的 Git commit**：

```nix
# 使用特定 commit 的 nixpkgs
let
  pkgs = import (fetchTarball {
    url = "https://github.com/NixOS/nixpkgs/archive/a3a3dda3bacf61e8a39258a0ed9c924eeca8e293.tar.gz";
    sha256 = "05fq11wg8mik4zimgvkhwvs5p7ar0ql08wbs5lhgn0m0qbqk64y";
  }) {};
in
  pkgs.nodejs
```

> 💡 **如何找到特定版本的 commit？**
>
> 推薦使用 [Nixhub](https://www.nixhub.io/) 或 [Nix Package Versions](https://lazamar.co.uk/nix-versions/) 這類工具，輸入套件名稱和版本號，它就會告訴你對應的 Nixpkgs commit hash。

### 在 nix-shell 中使用特定版本

最常見的用法是在 `shell.nix` 或 `nix-shell` 中固定版本，確保團隊所有成員都使用一模一樣的開發環境：

```nix
# shell.nix
let
  # 固定 nixpkgs 版本
  nixpkgs = fetchTarball {
    url = "https://github.com/NixOS/nixpkgs/archive/nixos-24.11.tar.gz";
    sha256 = "...";
  };
  pkgs = import nixpkgs {};
in
pkgs.mkShell {
  buildInputs = [
    pkgs.nodejs_18
    pkgs.python311
    pkgs.postgresql_15
  ];
}
```

這就是 Nix 的 **reproducibility** —— 不論在誰的電腦上、什麼時候執行，都能得到完全相同的環境。

---

## Channel vs Flakes（預告）

到目前為止，我們一直在使用 `nix-channel` 這個「傳統」的方式來管理 Nixpkgs 版本。但你可能已經在社群中聽過 **Flakes** 這個詞。

| 面向 | Channel | Flakes |
|------|---------|--------|
| 版本鎖定 | 手動管理，仰賴 `nix-channel --update` 的時機 | 自動產生 `flake.lock`，精確鎖定每個 input 的 commit |
| 可重現性 | 較弱（不同時間 update 可能得到不同結果） | 極強（lock file 確保完全一致） |
| 狀態管理 | 有狀態（channel 資訊存在使用者 profile 中） | 無狀態（所有資訊都在 `flake.nix` + `flake.lock`） |
| 社群趨勢 | 傳統方式，仍然穩定運作 | 新標準，社群正積極採用中 |
| 學習曲線 | 較低 | 稍高，但概念更清晰 |

簡單來說：**Channel 是「我現在訂閱了什麼版本」的全域狀態，而 Flakes 是「這個專案精確需要什麼版本」的宣告式設定。**

我們會在後面的章節深入介紹 Flakes。現在只需要知道：Channel 是基礎，理解它有助於你未來學習 Flakes 時更容易掌握背後的概念。

---

## 小結

今天我們學到了：

- **Nixpkgs** 是 Nix 生態系中最核心的套件庫，包含超過 100,000 個套件
- **Channel** 是經過 CI 測試的 Nixpkgs 快照，分為 stable 和 unstable
- 使用 `nix-channel` 指令可以管理你訂閱的 channel
- 搜尋套件有多種方式：search.nixos.org、`nix search`、`nix-locate`
- Nix 可以輕鬆安裝**特定版本**的套件，甚至固定到特定的 Nixpkgs commit
- Flakes 是 Channel 的進化版，提供更精確的版本控制

### 明日預告

> **Day 12：Nix Derivation 深入探索**
>
> 我們將揭開 Nix 最核心的抽象概念 —— Derivation。它是所有套件 build 的基礎，理解它之後，你就能真正讀懂那些 Nixpkgs 中的套件定義，甚至開始寫自己的套件。

---

📚 **延伸閱讀**

- [Nixpkgs Manual](https://nixos.org/manual/nixpkgs/stable/)
- [NixOS Package Search](https://search.nixos.org/packages)
- [Nix Package Versions](https://lazamar.co.uk/nix-versions/)
- [Nixpkgs GitHub Repository](https://github.com/NixOS/nixpkgs)
- [NixOS Channel Status (Hydra)](https://status.nixos.org/)
