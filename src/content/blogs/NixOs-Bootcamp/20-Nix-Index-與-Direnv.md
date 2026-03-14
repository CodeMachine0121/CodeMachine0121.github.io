---
title: "Day 20：Nix Index 與 Direnv — 進入資料夾就自動載入開發環境"
datetime: "2026-04-03"
description: "介紹 nix-index 與 direnv 兩大實務工具，解決找不到套件與自動載入開發環境的痛點。"
parent: "NixOs Bootcamp"
---

# Day 20：Nix Index 與 Direnv — 進入資料夾就自動載入開發環境

> 系列：NixOS 30 天學習之旅｜第三階段：Flakes 與 Home Manager (Day 15 – Day 21)

---

## 前言：自動化開發環境的最後一塊拼圖

在過去幾天的文章裡，我們已經學會用 Flakes 宣告可重現的開發環境、用 Home Manager 管理使用者層級的設定。但每次進入專案資料夾，還是得手動執行 `nix develop` 才能載入環境——這一步雖然不難，卻很容易忘記。

今天我們要解決兩個實務上非常常見的痛點：

1. **「這個執行檔到底在哪個套件裡？」** → `nix-index` + `nix-locate`
2. **「能不能 `cd` 進資料夾就自動載入開發環境？」** → `direnv` + `nix-direnv`

當這兩塊拼圖就位之後，你的 Nix 開發體驗會提升到一個全新的層次。

---

## 一、nix-index：找出執行檔藏在哪個套件裡

### 問題情境

你在 terminal 裡打了一個指令，結果得到 `command not found`。你知道這個工具存在，但就是不知道該裝哪個套件。在傳統 Linux 發行版上，你可能會用 `apt-file search` 或 `dnf provides`，但在 Nix 的世界裡，我們有 `nix-index`。

### 安裝 nix-index

最簡單的方式，透過 `nix profile` 或在 Home Manager 中啟用：

```nix
# 方法一：直接安裝
nix profile install nixpkgs#nix-index

# 方法二：在 Home Manager（home.nix）中宣告
{ pkgs, ... }:
{
  home.packages = with pkgs; [
    nix-index
  ];
}
```

### 建立索引

第一次使用前，需要先建立本機索引資料庫。這個步驟會從 Nixpkgs 的 binary cache 抓取所有套件的檔案清單：

```bash
nix-index
```

> ⚠️ 第一次執行會花一些時間（視網路速度而定，可能 5–15 分鐘）。建好之後，後續更新速度會快很多。

### 使用 nix-locate

索引建好之後，就可以用 `nix-locate` 來查詢了：

```bash
# 查詢哪個套件提供 `rg` 這個執行檔
$ nix-locate --top-level --whole-name 'bin/rg'
ripgrep.out               23,488 x /nix/store/...-ripgrep-14.1.1/bin/rg
```

一秒鐘就能找到答案：`ripgrep` 提供了 `rg`。

幾個常用的參數組合：

```bash
# 只搜尋頂層套件（排除巢狀相依）
nix-locate --top-level --whole-name 'bin/htop'

# 模糊搜尋（不加 --whole-name）
nix-locate --top-level 'bin/python3'

# 搜尋 library
nix-locate --top-level 'lib/libssl.so'
```

### 加速方案：nix-index-database

如果你不想自己跑 `nix-index` 來建立索引，社群維護了一個預先建好的資料庫 [`nix-index-database`](https://github.com/nix-community/nix-index-database)，可以直接下載使用：

```nix
# flake.nix 中加入 input
{
  inputs = {
    nix-index-database = {
      url = "github:nix-community/nix-index-database";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };
}
```

搭配 Home Manager module 使用，還能自動整合 `command-not-found` handler——當你輸入一個不存在的指令時，系統會自動告訴你該裝哪個套件，非常方便。

---

## 二、Direnv 是什麼？

[Direnv](https://direnv.net/) 是一款輕量的 shell 擴充工具，核心概念很簡單：

> **當你 `cd` 進入一個資料夾時，自動載入該資料夾定義的環境變數；離開時自動卸載。**

它的運作原理是透過 shell hook，在每次切換目錄時檢查當前資料夾是否有 `.envrc` 檔案。如果有，就依照裡面的指令來設定環境。

```
~/projects
├── project-a/
│   └── .envrc          # 進入時載入 Node.js 18 環境
├── project-b/
│   └── .envrc          # 進入時載入 Python 3.12 環境
└── project-c/
    └── .envrc          # 進入時載入 Rust 環境
```

每個專案各自獨立，互不干擾。切換專案時，環境會自動跟著切換——不需要手動 `nix develop`，不需要記得 `deactivate`。

---

## 三、nix-direnv 安裝與設定

單純的 `direnv` 搭配 `nix develop` 其實就能運作，但有一個嚴重的問題：**每次進入資料夾都會重新 evaluate 整個 Nix expression**，速度非常慢。

[`nix-direnv`](https://github.com/nix-community/nix-direnv) 正是為了解決這個問題而生。它提供了 cached evaluation 機制，只有在 `flake.nix` 或 `flake.lock` 真正發生變更時才會重新 evaluate，其餘時間都是秒開。

### 透過 Home Manager 安裝（推薦）

在你的 `home.nix` 中加入以下設定：

```nix
{ pkgs, ... }:
{
  programs.direnv = {
    enable = true;
    nix-direnv.enable = true;

    # 如果你用 bash
    enableBashIntegration = true;

    # 如果你用 zsh
    enableZshIntegration = true;

    # 如果你用 fish
    enableFishIntegration = true;
  };
}
```

套用設定：

```bash
home-manager switch
```

這一行設定幫你做了三件事：

1. 安裝 `direnv` 和 `nix-direnv`
2. 自動在你的 shell 設定中加入 direnv hook
3. 啟用 nix-direnv 的 cache 機制

### 手動安裝（不使用 Home Manager）

如果你沒有用 Home Manager，也可以手動設定：

```bash
# 安裝
nix profile install nixpkgs#direnv nixpkgs#nix-direnv

# 在 ~/.bashrc 或 ~/.zshrc 加入 hook
eval "$(direnv hook bash)"    # bash
eval "$(direnv hook zsh)"     # zsh

# 建立 direnv 設定，啟用 nix-direnv
mkdir -p ~/.config/direnv
echo 'source $HOME/.nix-profile/share/nix-direnv/direnvrc' \
  > ~/.config/direnv/direnvrc
```

---

## 四、.envrc 檔案配置

`direnv` 的一切魔法都來自專案根目錄的 `.envrc` 檔案。以下是幾種常見的配置方式。

### 基本用法：搭配 nix-shell

如果你的專案還在用傳統的 `shell.nix`：

```bash
# .envrc
use nix
```

### 搭配 Flakes（推薦）

如果你的專案已經有 `flake.nix`（在這個系列的 Day 17 我們已經學過怎麼寫），使用 `use flake` 指令：

```bash
# .envrc
use flake
```

就這麼簡單，一行搞定。

### 指定特定的 devShell

如果你的 `flake.nix` 定義了多個 devShell：

```bash
# 使用預設的 devShell
use flake

# 使用名為 "frontend" 的 devShell
use flake .#frontend

# 使用其他路徑的 flake
use flake ./infrastructure
```

### 加入額外的環境變數

`.envrc` 本質上就是一個 bash script，你可以在裡面做任何事：

```bash
# .envrc
use flake

# 專案特定的環境變數
export DATABASE_URL="postgresql://localhost:5432/myapp_dev"
export API_KEY="dev-only-key-not-for-production"

# 把專案的 bin 目錄加入 PATH
PATH_add bin

# 載入 .env 檔案（如果存在）
dotenv_if_exists .env
```

---

## 五、實戰：進入資料夾自動載入環境

讓我們從零開始，建立一個完整的範例。

### 步驟一：建立專案與 flake.nix

```bash
mkdir ~/projects/my-web-app && cd ~/projects/my-web-app
git init
```

建立 `flake.nix`：

```nix
{
  description = "My Web App 開發環境";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_22
            nodePackages.pnpm
            nodePackages.typescript
            nodePackages.typescript-language-server
          ];

          shellHook = ''
            echo "🚀 Web App 開發環境已載入"
            echo "  Node.js: $(node --version)"
            echo "  pnpm:    $(pnpm --version)"
          '';
        };
      }
    );
}
```

### 步驟二：建立 .envrc

```bash
echo "use flake" > .envrc
```

### 步驟三：允許 direnv 載入

第一次建立 `.envrc` 時，`direnv` 基於安全考量會要求你明確授權：

```bash
$ cd ~/projects/my-web-app

direnv: error ~/projects/my-web-app/.envrc is blocked.
       Run `direnv allow` to approve its content

$ direnv allow
direnv: loading ~/projects/my-web-app/.envrc
direnv: using flake
direnv: nix-direnv: Using cached dev shell
🚀 Web App 開發環境已載入
  Node.js: v22.12.0
  pnpm:    9.15.4
```

### 步驟四：體驗自動切換

```bash
# 離開專案 → 環境自動卸載
$ cd ~
direnv: unloading

$ node --version
node: command not found

# 回到專案 → 環境自動載入
$ cd ~/projects/my-web-app
direnv: loading ~/projects/my-web-app/.envrc
direnv: using flake
🚀 Web App 開發環境已載入

$ node --version
v22.12.0
```

**就是這麼神奇。** 你不再需要記得任何指令，只要 `cd` 進入專案資料夾，一切都準備好了。

### 別忘了 .gitignore

將 direnv 的 cache 目錄加入 `.gitignore`：

```bash
echo ".direnv/" >> .gitignore
```

`.direnv/` 資料夾是 `nix-direnv` 用來存放 cached evaluation 結果的地方，不應該被 commit 進版本控制。

---

## 六、與 Flakes 的深度整合

### use flake 的運作原理

當你在 `.envrc` 中寫下 `use flake` 時，`nix-direnv` 在背後做了這些事：

1. 執行 `nix print-dev-env`，取得 devShell 的完整環境變數
2. 將結果 cache 到 `.direnv/` 目錄下
3. 把這些環境變數注入到你目前的 shell session

下一次進入資料夾時，`nix-direnv` 會先檢查 `flake.nix` 和 `flake.lock` 是否有變更。如果沒有，就直接使用 cache，完全跳過 Nix evaluation——這就是為什麼第二次之後都是秒開。

### 多環境切換

在實際的專案中，你可能需要不同的開發環境。搭配 Flakes 的多 devShell 功能：

```nix
# flake.nix
{
  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells = {
          default = pkgs.mkShell {
            buildInputs = with pkgs; [ nodejs_22 nodePackages.pnpm ];
          };

          backend = pkgs.mkShell {
            buildInputs = with pkgs; [ go gopls gotools ];
          };

          ci = pkgs.mkShell {
            buildInputs = with pkgs; [ nodejs_22 go docker-compose ];
          };
        };
      }
    );
}
```

在子資料夾中建立不同的 `.envrc`：

```
my-project/
├── .envrc                   # use flake（預設載入 Node.js）
├── flake.nix
├── frontend/
│   └── ...
├── backend/
│   └── .envrc               # use flake ..#backend（載入 Go）
└── scripts/
    └── .envrc               # use flake ..#ci（載入 CI 工具）
```

```bash
# backend/.envrc
use flake ..#backend

# scripts/.envrc
use flake ..#ci
```

進入 `backend/` 資料夾時自動切換到 Go 環境；進入 `scripts/` 時切換到 CI 環境。一切全自動。

---

## 七、效能最佳化：cached evaluation

`nix-direnv` 之所以好用，效能是關鍵。讓我們來理解它的 cache 機制，以及如何進一步最佳化。

### Cache 的觸發條件

`nix-direnv` 會在以下情況重新 evaluate：

| 情況 | 是否重新 evaluate |
|------|:------------------:|
| `flake.nix` 內容變更 | ✅ |
| `flake.lock` 內容變更 | ✅ |
| `.envrc` 內容變更 | ✅ |
| 單純 `cd` 進入資料夾 | ❌（使用 cache） |
| 開新的 terminal | ❌（使用 cache） |
| 重新開機 | ❌（使用 cache） |

### GC Root 保護

`nix-direnv` 還有一個很重要的特性：它會自動建立 GC root，防止你的開發環境被 `nix-collect-garbage` 清掉。

這代表即使你執行了垃圾回收，你正在使用的專案環境依然安全無虞，不需要重新下載所有 dependency。

### 手動清除 cache

如果遇到問題，可以手動清除 cache 強制重新 evaluate：

```bash
# 清除當前專案的 direnv cache
rm -rf .direnv/

# 重新載入
direnv reload
```

### 搭配 nix-direnv 的 watch 機制

如果你的 devShell 依賴額外的設定檔（例如 `package.json`），可以告訴 `nix-direnv` 監控這些檔案：

```bash
# .envrc
use flake
watch_file package.json
watch_file Cargo.toml
```

當這些檔案變更時，`nix-direnv` 也會自動重新 evaluate。

---

## 八、Editor 整合

### VS Code

安裝 [direnv 擴充套件](https://marketplace.visualstudio.com/items?itemName=mkhl.direnv)，讓 VS Code 也能自動載入 direnv 環境。安裝後，VS Code 的 integrated terminal 和 language server 都能正確抓到 Nix 提供的工具。

### Neovim

如果你用 Neovim，推薦 [`direnv.vim`](https://github.com/direnv/direnv.vim) plugin：

```lua
-- lazy.nvim
{
  "direnv/direnv.vim",
}
```

### JetBrains IDE

JetBrains 系列 IDE 有 [Direnv Integration](https://plugins.jetbrains.com/plugin/15285-direnv-integration) plugin，安裝後即可自動偵測 `.envrc`。

---

## 九、常見問題排解

### Q1：`direnv allow` 之後沒有反應？

確認 shell hook 有正確設定。在你的 shell 設定檔（`.bashrc`、`.zshrc`）中應該有這行：

```bash
eval "$(direnv hook bash)"   # 或 zsh / fish
```

如果你是透過 Home Manager 設定的，確認 `home-manager switch` 已經執行過。

### Q2：為什麼第一次載入很慢？

第一次執行 `use flake` 時，Nix 需要 evaluate 整個 flake 並下載所有 dependency，這是正常的。後續都會使用 cache，幾乎是瞬間完成。

### Q3：nix-locate 找不到任何結果？

確認你已經執行過 `nix-index` 建立索引。如果索引太舊，重新跑一次即可：

```bash
nix-index
```

或改用 `nix-index-database` 預建索引，省去自己建立索引的時間。

---

## 小結

今天我們學會了兩個讓 Nix 開發體驗大幅提升的工具：

| 工具 | 解決的問題 | 核心指令 |
|------|-----------|---------|
| **nix-index** | 找不到執行檔在哪個套件裡 | `nix-locate --top-level 'bin/xxx'` |
| **nix-direnv** | 每次都要手動載入開發環境 | `.envrc` 中寫 `use flake` |

搭配前幾天學到的 Flakes 和 Home Manager，我們現在有了完整的現代化 Nix 工作流程：

1. **Flakes** 定義可重現的開發環境 ✅
2. **Home Manager** 管理使用者級別的設定 ✅
3. **nix-direnv** 自動載入開發環境 ✅
4. **nix-index** 快速找到需要的套件 ✅

進入資料夾就自動準備好一切——這就是 Nix 給開發者最棒的禮物。

---

## 明日預告

> **Day 21：Flakes 與 Home Manager 整合實戰**
>
> 第三階段的最後一天，我們將把 Flakes、Home Manager、nix-direnv 全部整合在一起，建立一個完整的個人開發環境設定專案，並學會如何在不同機器之間同步你的整套環境。敬請期待！
