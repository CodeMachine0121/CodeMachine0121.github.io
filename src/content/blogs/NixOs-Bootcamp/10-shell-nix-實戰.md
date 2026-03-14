---
title: "Day 10：shell.nix 實戰 — 讓每個人都擁有相同的開發環境"
datetime: "2026-03-24"
description: "從臨時的 nix-shell -p 指令進階到撰寫專案級的 shell.nix，實戰示範如何為團隊打造可重現、一致的開發環境配置。"
parent: "NixOs Bootcamp"
---

# Day 10：shell.nix 實戰 — 讓每個人都擁有相同的開發環境

> 🗓 系列：NixOS 30 天學習之旅  
> 📦 階段：第二階段 — 掌握 Nix 語言與開發環境 (Day 8 – Day 14)  
> 🎯 階段核心目標：學會寫 Nix expression，不再只是複製貼上

---

## 前言：從臨時指令到專案級配置

在前幾天，我們學會了用 `nix-shell -p` 快速拉一個臨時環境：

```bash
nix-shell -p nodejs python3 curl
```

這招非常好用，幾秒鐘就能拿到一個乾淨的工具環境。但它有個根本問題——**它是一次性的，而且只存在你的腦袋裡**。

想像一下這個場景：你在公司負責一個 Python 專案，開發時需要 Python 3.12、Poetry、PostgreSQL client library，還有一些系統層級的 dependency。新同事 on-board 的時候，你丟給他一份長長的 README：

> 「先裝 Python 3.12，然後 `pip install poetry`，記得要裝 `libpq-dev`，對了 macOS 上叫 `postgresql`，然後⋯⋯」

這份文件永遠跟不上實際環境的變化，而且每個人裝出來的版本多少有些差異。

**`shell.nix` 就是為了解決這個問題而存在的。**

它是一份放在專案根目錄的 Nix expression，定義了「進入這個專案所需的完整開發環境」。任何人只要執行 `nix-shell`，就能得到一模一樣的工具鏈、一模一樣的版本、一模一樣的環境變數。不需要 README，不需要手動安裝，不需要猜測。

今天，我們就來學會怎麼寫它。

---

## shell.nix 的基本結構

一個最簡單的 `shell.nix` 長這樣：

```nix
# shell.nix
{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = [
    pkgs.nodejs
    pkgs.git
  ];
}
```

把這個檔案放在專案根目錄，然後執行：

```bash
cd my-project
nix-shell
```

就這樣。你會進入一個擁有 Node.js 和 Git 的 shell 環境。離開這個 shell（`exit` 或 `Ctrl+D`），這些工具就不再出現在你的 `$PATH` 中——乾淨俐落。

### 逐行拆解

| 語法 | 說明 |
|------|------|
| `{ pkgs ? import <nixpkgs> {} }:` | 這是一個 function，接收 `pkgs` 參數。`?` 後面是預設值：如果沒有外部傳入 `pkgs`，就自動從系統的 `<nixpkgs>` channel 引入 |
| `pkgs.mkShell { ... }` | 呼叫 `mkShell` 函數，建立一個 shell 環境 |
| `buildInputs = [ ... ]` | 列出這個環境需要的套件 |

> 💡 **小提醒**：`nix-shell` 會自動尋找當前目錄下的 `shell.nix`（優先）或 `default.nix`。所以檔名不要打錯，就叫 `shell.nix`。

---

## mkShell 函數詳解

`mkShell` 是 Nixpkgs 提供的一個專門用來建立開發環境的 helper function。它本質上是 `mkDerivation` 的簡化版，但專門針對「不需要產出 build artifact，只需要一個互動式 shell」的使用場景做了最佳化。

### mkShell 可以接受的參數

```nix
pkgs.mkShell {
  # 開發時需要的套件
  buildInputs = [ ... ];

  # 編譯工具鏈（compiler、linker 等）
  nativeBuildInputs = [ ... ];

  # 自訂環境變數
  MY_API_KEY = "dev-key-12345";
  DATABASE_URL = "postgresql://localhost:5432/mydb";

  # 進入 shell 時自動執行的指令
  shellHook = ''
    echo "Welcome to my project!"
  '';
}
```

`mkShell` 比起直接用 `mkDerivation` 的好處在於：

1. **不需要指定 `name`、`src` 等必填欄位**——因為你根本不是要 build 一個 package。
2. **直接支援設定環境變數**——任何不是 `mkShell` 已知的 attribute，都會被當成環境變數匯出。
3. **支援 `inputsFrom`**——可以繼承其他 derivation 的 build dependency（後面會提到）。

---

## buildInputs vs nativeBuildInputs

這兩個參數容易讓初學者混淆。雖然在**大多數日常開發情境中**，放哪邊的效果幾乎一樣，但理解它們的語義差異，對寫出正確的 Nix expression 非常重要。

### 語義區別

| 參數 | 用途 | 範例 |
|------|------|------|
| `nativeBuildInputs` | **在 build 時期執行的工具**。通常是 compiler、build tool、code generator 等「跑在你的機器上」的程式 | `gcc`、`cmake`、`pkg-config`、`rustc`、`cargo` |
| `buildInputs` | **被連結（link）的 library 或 runtime dependency**。通常是你的程式碼在編譯或執行時需要的東西 | `openssl`、`zlib`、`postgresql`、`libpng` |

### 用白話來說

- `nativeBuildInputs`：**你拿來做事的工具**（錘子、鋸子）
- `buildInputs`：**你做出來的東西要用到的材料**（木頭、螺絲）

### 什麼時候差異會真的跳出來？

在 **cross-compilation**（交叉編譯）的場景下。例如你在 x86_64 的機器上編譯給 aarch64 跑的程式：

- `nativeBuildInputs` 裡的工具（如 `gcc`）必須是 x86_64 版本的，因為它要在你的機器上跑。
- `buildInputs` 裡的 library（如 `openssl`）必須是 aarch64 版本的，因為最終的 binary 要在 aarch64 上連結執行。

Nix 會根據這個語義自動選擇正確的平台版本。如果你全部塞進 `buildInputs`，cross-compilation 就可能出錯。

### 實務建議

```nix
pkgs.mkShell {
  nativeBuildInputs = [
    pkgs.gcc
    pkgs.cmake
    pkgs.pkg-config
  ];

  buildInputs = [
    pkgs.openssl
    pkgs.zlib
    pkgs.curl
  ];
}
```

> 💡 **小提醒**：如果你不打算做 cross-compilation，把所有東西都放在 `buildInputs` 也能正常運作。但養成正確分類的習慣，未來遇到更複雜的情境時會少踩很多坑。

---

## shellHook：進入環境時自動執行

`shellHook` 是一段 Bash script，會在你進入 `nix-shell` 的時候自動執行。它適合用來做一些環境初始化的動作。

### 常見用途

```nix
pkgs.mkShell {
  buildInputs = [ pkgs.nodejs pkgs.yarn ];

  shellHook = ''
    # 顯示環境資訊
    echo "🚀 開發環境已就緒"
    echo "Node.js: $(node --version)"
    echo "Yarn:    $(yarn --version)"

    # 設定 PATH，讓 node_modules/.bin 中的指令可以直接使用
    export PATH="$PWD/node_modules/.bin:$PATH"

    # 自動安裝依賴（如果 node_modules 不存在）
    if [ ! -d "node_modules" ]; then
      echo "📦 正在安裝依賴..."
      yarn install
    fi
  '';
}
```

每次執行 `nix-shell` 進入環境時，你會看到：

```
🚀 開發環境已就緒
Node.js: v20.11.0
Yarn:    1.22.22
```

### 更多 shellHook 的實用範例

```nix
shellHook = ''
  # 載入 .env 檔案中的環境變數
  if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
  fi

  # 啟動本地 PostgreSQL（如果專案需要）
  export PGDATA="$PWD/.pgdata"

  # 建立 alias 簡化常用指令
  alias dev="npm run dev"
  alias test="npm run test"
'';
```

> ⚠️ **注意**：`shellHook` 裡的指令會在每次進入 `nix-shell` 時執行。避免放入耗時太久的操作（例如完整的 `npm install`），否則每次進入環境都要等很久。可以像上面的範例一樣，加上條件判斷來避免重複執行。

---

## 實戰：為不同類型專案撰寫 shell.nix

理論講完了，接下來我們針對三種常見的專案類型，各寫一份實用的 `shell.nix`。

### 實戰一：Node.js 專案

```nix
# shell.nix — Node.js 前端/後端專案
{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  nativeBuildInputs = [
    pkgs.nodejs_20    # 指定 Node.js 20 LTS
    pkgs.yarn         # 或改用 pkgs.nodePackages.pnpm
    pkgs.nodePackages.typescript
    pkgs.nodePackages.prettier
  ];

  shellHook = ''
    echo "⚡ Node.js $(node --version) 開發環境"
    export PATH="$PWD/node_modules/.bin:$PATH"
  '';
}
```

### 實戰二：Python 專案

```nix
# shell.nix — Python 資料科學 / Web 專案
{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  nativeBuildInputs = [
    pkgs.python312          # Python 3.12
    pkgs.python312Packages.pip
    pkgs.python312Packages.virtualenv
    pkgs.poetry             # 用 Poetry 管理依賴
  ];

  buildInputs = [
    pkgs.openssl            # 某些 Python 套件需要
    pkgs.zlib
    pkgs.libffi
    pkgs.postgresql         # psycopg2 需要 libpq
  ];

  shellHook = ''
    echo "🐍 Python $(python3 --version | cut -d' ' -f2) 開發環境"

    # 建立並啟用 virtualenv（如果尚未存在）
    if [ ! -d ".venv" ]; then
      echo "📦 建立 virtualenv..."
      python3 -m venv .venv
    fi
    source .venv/bin/activate
  '';
}
```

這裡有個常見的 pattern 值得注意：**Nix 負責提供系統層級的 dependency（`openssl`、`zlib`），Python 的套件管理器（`poetry` 或 `pip`）負責管理 Python 套件**。兩者各司其職，互不干擾。

### 實戰三：Rust 專案

```nix
# shell.nix — Rust 系統級專案
{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  nativeBuildInputs = [
    pkgs.rustc
    pkgs.cargo
    pkgs.rustfmt
    pkgs.clippy
    pkgs.rust-analyzer     # LSP server，搭配 editor 使用
    pkgs.pkg-config        # 幫助找到 C library
  ];

  buildInputs = [
    pkgs.openssl
    pkgs.zlib
  ];

  # Rust 編譯器需要知道去哪找 C library
  RUST_SRC_PATH = "${pkgs.rust.packages.stable.rustPlatform.rustLibSrc}";

  shellHook = ''
    echo "🦀 Rust $(rustc --version | cut -d' ' -f2) 開發環境"
    echo "   cargo $(cargo --version | cut -d' ' -f2)"
  '';
}
```

注意 `RUST_SRC_PATH` 這行——它不是 `mkShell` 的已知 attribute，所以會被自動匯出為環境變數。`rust-analyzer` 需要這個變數來找到 Rust 的 standard library source code，才能提供完整的程式碼補全。

---

## 進階技巧：inputsFrom

如果你的專案本身已經有一個 `default.nix` 定義了 package 的 build dependency，你可以用 `inputsFrom` 來繼承那些 dependency，避免重複列舉：

```nix
# default.nix — 定義如何 build 你的 package
{ pkgs ? import <nixpkgs> {} }:

pkgs.rustPlatform.buildRustPackage {
  pname = "my-tool";
  version = "0.1.0";
  src = ./.;
  cargoLock.lockFile = ./Cargo.lock;
  buildInputs = [ pkgs.openssl pkgs.zlib ];
  nativeBuildInputs = [ pkgs.pkg-config ];
}
```

```nix
# shell.nix — 繼承 default.nix 的依賴，再加上開發工具
{ pkgs ? import <nixpkgs> {} }:

let
  myPackage = import ./default.nix { inherit pkgs; };
in
pkgs.mkShell {
  inputsFrom = [ myPackage ];

  # 額外的開發工具（build 不需要，但開發時很好用）
  nativeBuildInputs = [
    pkgs.rust-analyzer
    pkgs.rustfmt
    pkgs.clippy
  ];
}
```

這樣一來，`shell.nix` 的 dependency 會自動包含 `default.nix` 中宣告的 `openssl`、`zlib` 和 `pkg-config`，你只需要額外列出開發專用的工具即可。**Single source of truth**，不用擔心兩邊的 dependency 不同步。

---

## 團隊協作的好處

把 `shell.nix` 放進 Git repository，對團隊協作帶來的好處是立竿見影的：

### 1. 消滅「在我的電腦上可以跑」

每個人進入專案的開發環境都是同一份 `shell.nix` 產生的。同樣的 compiler 版本、同樣的 library、同樣的工具鏈。不會再有「我的 OpenSSL 是 1.1，你的是 3.0，所以你那邊 build 不過」的問題。

### 2. 新人 on-boarding 降到最低成本

新同事加入專案，步驟只有三個：

```bash
git clone git@github.com:your-org/your-project.git
cd your-project
nix-shell
# 完成。開始寫 code 吧。
```

不用看十頁的環境安裝文件，不用在 Slack 上問同事「這個 library 怎麼裝」。

### 3. CI/CD 環境一致性

你的 CI pipeline 也可以用同一份 `shell.nix` 來建立 build 環境：

```yaml
# .github/workflows/ci.yml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: cachix/install-nix-action@v27
      - run: nix-shell --run "npm test"
```

開發環境和 CI 環境用的是同一份定義，不會再出現「本機測試通過但 CI 掛掉」的靈異事件。

### 4. 搭配 direnv 自動載入

如果你覺得每次都要手動輸入 `nix-shell` 很麻煩，可以搭配 `direnv` 使用。在專案根目錄建立一個 `.envrc`：

```bash
# .envrc
use nix
```

然後執行 `direnv allow`。之後只要 `cd` 進這個目錄，環境就會自動載入；離開目錄，環境自動卸載。完全無感，非常優雅。

> 💡 **小提醒**：記得把 `.envrc` 和 `shell.nix` 都加進 Git。但 `.direnv/` 目錄要放進 `.gitignore`，它只是 cache。

---

## 小結

今天我們從「臨時用 `nix-shell -p` 拉工具」升級到了「為專案量身打造可重現的開發環境」。掌握 `shell.nix` 的寫法，是邁向 Nix 生態系實際應用的重要一步。

| 學到了什麼 | 重點整理 |
|-----------|---------|
| **shell.nix 基本結構** | 一個接收 `pkgs` 的 function，回傳 `mkShell` 的結果 |
| **mkShell** | Nixpkgs 提供的 helper，專門用於建立開發 shell 環境 |
| **buildInputs** | 被連結的 library 與 runtime dependency |
| **nativeBuildInputs** | 在 build 時期執行的工具（compiler、build tool） |
| **shellHook** | 進入 shell 時自動執行的 Bash script |
| **inputsFrom** | 繼承其他 derivation 的依賴，避免重複定義 |
| **團隊協作** | 搭配 Git + direnv，實現零成本的環境同步 |

---

## 明日預告

**Day 11：Nix Flakes 初探**

`shell.nix` 搭配 `<nixpkgs>` channel 的做法已經很實用了，但它有一個痛點——`<nixpkgs>` 指向的版本取決於每個人的 channel 設定，不同人可能拿到不同版本的套件集。明天我們要認識 **Flakes**，Nix 的新一代專案管理機制，它用 `flake.lock` 鎖定了所有 input 的精確版本，把可重現性推到極致。

我們明天見！ 🚀
