---
title: "Day 12：Derivation 概念 — 理解 Nix 如何打包軟體"
datetime: "2026-03-26"
description: "深入解析 Derivation 的核心概念，理解 Nix 如何透過建置計畫書將原始碼轉換為 /nix/store 中的套件。"
parent: "NixOs Bootcamp"
---

# Day 12：Derivation 概念 — 理解 Nix 如何打包軟體

> 🗓 系列：NixOS 30 天學習之旅  
> 📦 階段：第二階段 — 掌握 Nix 語言與開發環境 (Day 8 – Day 14)  
> 🎯 階段核心目標：學會寫 Nix Expression，不再只是複製貼上

---

## 前言：Nix 的核心構建單元

前幾天我們學了 Nix 語言的語法：function、attribute set、`let ... in`、`import` 等等。你可能已經能讀懂一些 Nix expression，甚至自己寫出簡單的配置。

但有一個問題始終懸在空中：**Nix 到底是怎麼把一份原始碼變成 `/nix/store` 裡面那個帶有 hash prefix 的套件的？**

答案就是今天的主角 — **Derivation**。

Derivation 是 Nix 生態系中最核心的概念之一。它描述了「如何從 input 產生 output」的完整過程 — 包括要用哪些 source code、依賴哪些套件、執行哪些 build 指令、最終把產物放到哪裡。可以說，Nix store 裡的每一個東西，背後都對應著一個 derivation。

今天我們就來徹底理解它。

---

## 什麼是 Derivation？

用最白話的方式說：**Derivation 是一份「建置計畫書」**。它告訴 Nix：

1. **需要什麼原料**（source code、dependencies）
2. **用什麼工具**（compiler、build tools）
3. **怎麼建置**（configure、compile、install 的步驟）
4. **產出放在哪**（`/nix/store` 中的某個 output path）

當你在 `configuration.nix` 裡寫了 `pkgs.git`，其實你引用的是一個已經被 evaluate 過的 derivation。Nix 會根據這個 derivation 的所有 input 計算出一個 hash，決定產物在 `/nix/store` 中的路徑。

```
Derivation（建置計畫書）
    ↓ evaluate
.drv 檔案（序列化後的建置指令）
    ↓ realise / build
/nix/store/abc123...-git-2.44.0/（實際產物）
```

這個流程有兩個關鍵步驟：

- **Evaluation（評估）**：Nix 語言 interpreter 把你的 `.nix` 檔案跑一遍，產生 `.drv` 檔案。這個階段是純粹的語言運算，不會執行任何 build 動作。
- **Realisation（實現）**：Nix 讀取 `.drv` 檔案，啟動一個 sandbox 環境，依照指示執行建置。build 完成後，產物寫入 `/nix/store`。

這種「評估」與「執行」完全分離的設計，是 Nix 能做到 reproducible build 的根基。

---

## .drv 檔案解析

`.drv` 檔案是 derivation 被 evaluate 後的中間產物，存放在 `/nix/store` 中。你可以把它想成「build 的 blueprint」。

讓我們來實際看看一個 `.drv` 長什麼樣子。先找到某個套件的 `.drv` 路徑：

```bash
# 查詢 hello 套件的 derivation 路徑
nix-instantiate '<nixpkgs>' -A hello
# 輸出類似：/nix/store/abc123...-hello-2.12.1.drv
```

`nix-instantiate` 只做 evaluation，不做 build。它把 Nix expression 轉換成 `.drv` 檔案，回傳給你路徑。

接著用 `nix show-derivation` 來查看內容：

```bash
nix show-derivation /nix/store/abc123...-hello-2.12.1.drv
```

輸出會是一段 JSON，結構大致如下：

```json
{
  "/nix/store/abc123...-hello-2.12.1.drv": {
    "args": ["-e", "/nix/store/xyz...-default-builder.sh"],
    "builder": "/nix/store/def...-bash-5.2/bin/bash",
    "env": {
      "buildInputs": "",
      "builder": "/nix/store/def...-bash-5.2/bin/bash",
      "name": "hello-2.12.1",
      "nativeBuildInputs": "",
      "out": "/nix/store/ghi...-hello-2.12.1",
      "pname": "hello",
      "src": "/nix/store/jkl...-hello-2.12.1.tar.gz",
      "stdenv": "/nix/store/mno...-stdenv-linux",
      "system": "x86_64-linux",
      "version": "2.12.1"
    },
    "inputDrvs": {
      "/nix/store/pqr...-bash-5.2.drv": { "dynamicOutputs": {}, "outputs": ["out"] },
      "/nix/store/stu...-stdenv-linux.drv": { "dynamicOutputs": {}, "outputs": ["out"] },
      "/nix/store/vwx...-hello-2.12.1.tar.gz.drv": { "dynamicOutputs": {}, "outputs": ["out"] }
    },
    "inputSrcs": ["/nix/store/xyz...-default-builder.sh"],
    "outputs": {
      "out": { "path": "/nix/store/ghi...-hello-2.12.1" }
    },
    "system": "x86_64-linux"
  }
}
```

幾個關鍵欄位：

| 欄位 | 說明 |
|------|------|
| `builder` | 執行 build 的程式，通常是 `bash` |
| `args` | 傳給 builder 的參數，通常是一個 build script |
| `env` | build 時的 environment variables，包含 `src`、`name`、`out` 等資訊 |
| `inputDrvs` | 這個 derivation 依賴的其他 derivation（必須先 build 好） |
| `inputSrcs` | 直接引用的 source file（非 derivation 的檔案） |
| `outputs` | build 完成後的產物路徑 |
| `system` | 目標平台，例如 `x86_64-linux` 或 `aarch64-darwin` |

注意到了嗎？`.drv` 檔案裡**完全沒有 Nix 語言的影子**。它是一個純粹的、self-contained 的 build 規格。這也是為什麼 Nix 的 evaluation 和 build 可以完全分離 — `.drv` 已經包含了 build 所需的一切資訊。

---

## stdenv.mkDerivation 基本結構

直接寫 `builtins.derivation` 來打包軟體是可行的，但極其繁瑣。你得自己處理 `PATH`、compiler flags、安裝路徑等各種細節。

所以在實務上，幾乎所有 nixpkgs 中的套件都是用 `stdenv.mkDerivation` 來打包的。它是 `builtins.derivation` 之上的高階封裝，幫你預設好了一整套標準的 build 流程。

一個最基本的 `mkDerivation` 長這樣：

```nix
{ lib, stdenv, fetchurl }:

stdenv.mkDerivation rec {
  pname = "hello";
  version = "2.12.1";

  src = fetchurl {
    url = "mirror://gnu/hello/hello-${version}.tar.gz";
    sha256 = "sha256-jZkUKv2SV28wsM18tCqNxoCZmLxdYH2Idh9RLibH2yA=";
  };

  meta = with lib; {
    description = "A program that produces a familiar, friendly greeting";
    homepage = "https://www.gnu.org/software/hello/";
    license = licenses.gpl3Plus;
    platforms = platforms.all;
  };
}
```

### 各欄位說明

| 欄位 | 說明 |
|------|------|
| `pname` | 套件名稱（package name） |
| `version` | 版本號 |
| `src` | 原始碼來源，通常透過 `fetchurl`、`fetchFromGitHub` 等 fetcher 取得 |
| `meta` | 套件的描述資訊，包含 `description`、`homepage`、`license` 等 |

你會發現這個範例裡**沒有寫任何 build 指令**。這是因為 `stdenv.mkDerivation` 已經內建了一套標準的 build phases：偵測到 `tar.gz` source 就自動解壓縮、偵測到 `configure` script 就自動執行、偵測到 `Makefile` 就自動 `make` && `make install`。

對於遵循 GNU Autotools 慣例的專案（也就是經典的 `./configure && make && make install` 流程），你幾乎不用寫額外的 build 邏輯。

### 常用的 build-related 欄位

當然，不是每個專案都那麼乖。你經常需要自訂一些建置行為：

```nix
stdenv.mkDerivation {
  pname = "my-tool";
  version = "1.0.0";

  src = ./. ;

  # 建置時需要的工具（在 host 上執行的，例如 cmake、pkg-config）
  nativeBuildInputs = [ cmake pkg-config ];

  # 建置時需要的 library（會被 link 到產物中）
  buildInputs = [ openssl zlib ];

  # 傳給 cmake / configure 的參數
  cmakeFlags = [ "-DBUILD_TESTS=OFF" ];

  # 自訂 build 步驟
  buildPhase = ''
    cmake --build . --parallel $NIX_BUILD_CORES
  '';

  # 自訂安裝步驟
  installPhase = ''
    mkdir -p $out/bin
    cp my-tool $out/bin/
  '';
}
```

其中 `$out` 是 Nix 自動設定的環境變數，指向這個 derivation 的 output path（也就是 `/nix/store/xxx...-my-tool-1.0.0`）。

> 💡 **小提醒**：`nativeBuildInputs` 和 `buildInputs` 的差別在 cross-compilation 時特別重要。`nativeBuildInputs` 是在 build 機器上執行的工具（如 compiler），`buildInputs` 是會被 link 到 target 上的 library。如果你不做 cross-compilation，兩者的效果差不多，但養成正確區分的習慣是好事。

---

## Build Phases

`stdenv.mkDerivation` 的 build 流程被切分成多個 **phases（階段）**，每個 phase 負責一件特定的事。你可以 override 任何一個 phase 來自訂行為。

以下是最常見的四個 phases：

### 1. `unpackPhase` — 解壓縮原始碼

負責把 `src` 解壓縮到 build 目錄。如果 `src` 是 `.tar.gz`、`.zip` 等常見格式，`stdenv` 會自動處理。

```nix
# 通常不需要自訂，除非 source 格式特殊
unpackPhase = ''
  mkdir -p source
  cp -r ${src}/* source/
  cd source
'';
```

### 2. `configurePhase` — 設定建置參數

執行 `./configure` script（如果存在的話）。你可以透過 `configureFlags` 來傳遞參數：

```nix
configureFlags = [
  "--prefix=${placeholder "out"}"
  "--enable-shared"
  "--disable-static"
];
```

如果專案使用 CMake 而非 Autotools，你可以搭配 `cmake` 的 setup hook（透過 `nativeBuildInputs = [ cmake ]`），它會自動接管 `configurePhase`。

### 3. `buildPhase` — 編譯

預設行為是執行 `make`。如果你需要自訂：

```nix
buildPhase = ''
  make -j$NIX_BUILD_CORES VERBOSE=1
'';
```

`$NIX_BUILD_CORES` 是 Nix 提供的環境變數，表示可用的 CPU cores 數量，讓你的 build 能善用多核心平行編譯。

### 4. `installPhase` — 安裝到 output path

預設行為是執行 `make install`，並把結果安裝到 `$out`。如果專案沒有 `make install` 的規則，你需要自己寫：

```nix
installPhase = ''
  mkdir -p $out/bin
  mkdir -p $out/share/man/man1

  cp build/my-app $out/bin/
  cp docs/my-app.1 $out/share/man/man1/
'';
```

### 完整 Phase 執行順序

除了上面四個核心 phase，`stdenv` 實際上定義了更多 phases。完整的執行順序大致如下：

```
unpackPhase
  ↓
patchPhase        # 套用 patches
  ↓
configurePhase
  ↓
buildPhase
  ↓
checkPhase        # 執行測試（預設停用，設 doCheck = true 開啟）
  ↓
installPhase
  ↓
fixupPhase        # 自動修正 RPATH、strip binary 等
  ↓
installCheckPhase # 安裝後測試（預設停用）
```

每個 phase 還有對應的 `pre` 和 `post` hook。例如 `preBuild`、`postInstall`，讓你能在特定 phase 前後插入自訂邏輯：

```nix
postInstall = ''
  # 安裝完成後，額外複製 README 到 output
  mkdir -p $out/share/doc
  cp README.md $out/share/doc/
'';
```

---

## 實際閱讀一個 nixpkgs 套件原始碼

理論講完了，讓我們來看一個真實的案例。打開 nixpkgs repository，找到 GNU `hello` 這個經典的教學套件：

📄 **檔案位置**：[`pkgs/by-name/he/hello/package.nix`](https://github.com/NixOS/nixpkgs/blob/master/pkgs/by-name/he/hello/package.nix)

```nix
{
  lib,
  stdenv,
  fetchurl,
  nixos,
  testers,
  hello,
}:

stdenv.mkDerivation rec {
  pname = "hello";
  version = "2.12.1";

  src = fetchurl {
    url = "mirror://gnu/hello/hello-${version}.tar.gz";
    sha256 = "sha256-jZkUKv2SV28wsM18tCqNxoCZmLxdYH2Idh9RLibH2yA=";
  };

  doCheck = true;

  passthru.tests = {
    version = testers.testVersion { package = hello; };
    nixos-test = nixos.tests.terminal-emulators.hello;
  };

  meta = with lib; {
    description = "A program that produces a familiar, friendly greeting";
    longDescription = ''
      GNU Hello is a program that prints "Hello, world!" when you run it.
      It is fully customizable.
    '';
    homepage = "https://www.gnu.org/software/hello/manual/";
    changelog = "https://git.savannah.gnu.org/cgit/hello.git/plain/NEWS?h=v${version}";
    license = licenses.gpl3Plus;
    maintainers = with maintainers; [ eelco ];
    platforms = platforms.all;
  };
}
```

### 逐段解讀

**1. 函式參數：**

```nix
{ lib, stdenv, fetchurl, nixos, testers, hello }:
```

這是一個 function，由 nixpkgs 的 `callPackage` 機制自動注入對應的參數。`stdenv` 提供 build 工具鏈、`fetchurl` 用來下載原始碼、`lib` 提供各種 utility function。

**2. 原始碼取得：**

```nix
src = fetchurl {
  url = "mirror://gnu/hello/hello-${version}.tar.gz";
  sha256 = "sha256-jZkUKv2SV28wsM18tCqNxoCZmLxdYH2Idh9RLibH2yA=";
};
```

`fetchurl` 是一個特殊的 derivation，它只做一件事：從指定的 URL 下載檔案。`sha256` 確保下載的內容與預期一致，這是 reproducibility 的關鍵。`mirror://gnu/` 是 Nix 內建的 mirror 機制，會自動從多個 GNU mirror 站點嘗試下載。

**3. 啟用測試：**

```nix
doCheck = true;
```

這會在 `buildPhase` 之後執行 `checkPhase`（通常是 `make check`），確保 build 出來的東西能通過測試。

**4. passthru.tests：**

```nix
passthru.tests = {
  version = testers.testVersion { package = hello; };
  nixos-test = nixos.tests.terminal-emulators.hello;
};
```

`passthru` 是一個不會影響 build 的 attribute set，通常用來附加額外資訊。這裡定義了自動化測試，可以在 CI 中驗證套件是否正常。

**5. 沒有自訂 build phase！**

整份程式碼中你找不到 `buildPhase`、`installPhase` 等任何自訂 build 邏輯。因為 GNU Hello 遵循標準的 Autotools 流程（`./configure && make && make install`），`stdenv.mkDerivation` 的預設行為就能完美處理。

這就是 `stdenv` 的威力 — 對於「行為端正」的專案，你幾乎只需要提供 source 和 metadata。

### 再看一個稍微複雜的：`jq`

讓我們也來看看 JSON 處理工具 `jq` 的 derivation，體驗一下自訂 build 設定的案例：

📄 **檔案位置**：[`pkgs/development/tools/jq/default.nix`](https://github.com/NixOS/nixpkgs/blob/master/pkgs/development/tools/jq/default.nix)

```nix
{ lib, stdenv, fetchurl, oniguruma, autoreconfHook }:

stdenv.mkDerivation rec {
  pname = "jq";
  version = "1.7.1";

  src = fetchurl {
    url = "https://github.com/jqlang/jq/releases/download/jq-${version}/jq-${version}.tar.gz";
    sha256 = "sha256-...";
  };

  # jq 需要 autoreconf 來產生 configure script
  nativeBuildInputs = [ autoreconfHook ];

  # jq 支援正規表達式，需要 oniguruma library
  buildInputs = [ oniguruma ];

  configureFlags = [
    "--with-oniguruma"
    "--disable-maintainer-mode"
  ];

  doInstallCheck = true;
  installCheckTarget = "check";

  meta = with lib; {
    description = "A lightweight and flexible command-line JSON processor";
    homepage = "https://jqlang.github.io/jq/";
    license = licenses.mit;
    platforms = platforms.all;
  };
}
```

和 `hello` 比起來，`jq` 多了：

- `nativeBuildInputs`：引入 `autoreconfHook`，在 build 時自動執行 `autoreconf` 產生 `configure` script。
- `buildInputs`：引入 `oniguruma`（正規表達式 library），會被 link 到最終的 binary 中。
- `configureFlags`：傳遞自訂參數給 `./configure`。

這些自訂欄位在實務中非常常見。當你需要打包新軟體時，最常做的事就是搞清楚「這個專案需要哪些 dependencies」和「build 時需要什麼特殊參數」。

---

## builtins.derivation vs mkDerivation

到目前為止我們一直在聊 `stdenv.mkDerivation`，但其實 Nix 語言本身有一個更底層的 primitive — `builtins.derivation`。

`builtins.derivation` 是 Nix 語言中唯一能產生 `.drv` 檔案的 built-in function。所有的 derivation，不管上層怎麼包裝，最終都會呼叫到它。

來看一個最小的 `builtins.derivation` 範例：

```nix
builtins.derivation {
  name = "simple-file";
  builder = "/bin/sh";
  args = [ "-c" "echo 'Hello from Nix!' > $out" ];
  system = "x86_64-linux";
}
```

這就是一個合法的 derivation。它用 `/bin/sh` 作為 builder，執行一條簡單的指令，把 output 寫到 `$out`。

你可以用 `nix-build` 來 build 它：

```bash
# 假設上面的內容存在 simple.nix 中
nix-build simple.nix
# 會在 /nix/store/xxx...-simple-file 中看到 "Hello from Nix!"
cat result
# Hello from Nix!
```

但在實務中，你幾乎不會直接使用 `builtins.derivation`，因為你得自己處理太多事情：

| | `builtins.derivation` | `stdenv.mkDerivation` |
|---|---|---|
| **層級** | Nix 語言 built-in | nixpkgs 提供的高階封裝 |
| **Build 環境** | 你自己搞定一切 | 預設提供 `gcc`、`coreutils`、`bash` 等基本工具 |
| **Build Phases** | 沒有 | 內建完整的 phase 系統 |
| **PATH 設定** | 你自己管 | 自動把 `buildInputs` 加入 `PATH` |
| **Cross-compilation** | 你自己處理 | 內建支援 |
| **Hook 系統** | 沒有 | 支援 `preBuild`、`postInstall` 等 hook |
| **適用場景** | 學習概念、極簡用途 | 實際打包軟體 |

簡單來說：`builtins.derivation` 是引擎，`stdenv.mkDerivation` 是整台車。你平常開車上路，不需要自己組裝引擎。

但理解 `builtins.derivation` 的存在，能幫助你明白 Nix 的建置模型到底有多單純 — 歸根結底，就是一個 function 接收一堆 input，產生一個 output。所有複雜性都是在這個基礎上層層堆疊出來的。

---

## 小結

今天我們深入了 Nix 最核心的概念 — Derivation。讓我們回顧一下學到了什麼：

| 概念 | 說明 |
|------|------|
| **Derivation** | 一份「建置計畫書」，描述如何從 input 產生 output |
| **.drv 檔案** | Derivation 被 evaluate 後的序列化結果，包含所有 build 所需資訊 |
| **stdenv.mkDerivation** | nixpkgs 提供的高階封裝，內建標準 build 流程 |
| **Build Phases** | `unpack → patch → configure → build → check → install → fixup` 的標準階段 |
| **builtins.derivation** | Nix 語言的底層 primitive，所有 derivation 的根基 |

理解 derivation 之後，你再去看 nixpkgs 裡的任何套件定義，都會覺得豁然開朗。那些看似複雜的 Nix expression，本質上就是在描述「這個軟體要怎麼 build」— 需要什麼 source code、依賴什麼 library、用什麼參數 configure。

---

## 明日預告

**Day 13：自己動手寫一個 Derivation**

今天我們讀了別人寫的 derivation，明天就輪到我們自己動手了。我們會從零開始寫一個 derivation，打包一個簡單的 script 或小工具，實際體驗從 `mkDerivation` 到 `nix-build` 的完整流程。學會這個，你就正式踏入 Nix 套件維護者的世界了。

我們明天見！ 🚀

---

📚 **延伸閱讀**
- [Nix Pills — Chapter 6: Our First Derivation](https://nixos.org/guides/nix-pills/our-first-derivation)
- [Nix Pills — Chapter 7: Working Derivation](https://nixos.org/guides/nix-pills/working-derivation)
- [nixpkgs Manual — stdenv](https://nixos.org/manual/nixpkgs/stable/#chap-stdenv)
- [nixpkgs 中的 GNU Hello 原始碼](https://github.com/NixOS/nixpkgs/blob/master/pkgs/by-name/he/hello/package.nix)
