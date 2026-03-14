---
title: "Day 24：Overlays — 當 Nixpkgs 滿足不了你，就自己動手改"
datetime: "2026-04-07"
description: "深入理解 Nix Overlay 的概念與語法，學會在不 fork Nixpkgs 的情況下覆寫、打補丁或新增自訂套件。"
parent: "NixOs Bootcamp"
---

# Day 24：Overlays — 當 Nixpkgs 滿足不了你，就自己動手改

> 🗓 系列：NixOS 30 天學習之旅  
> 📦 階段：第四階段 — 工程師進階實務 (Day 22 – Day 30)  
> 🎯 階段核心目標：佈署、自動化、安全性與貢獻

---

## 前言：當 Nixpkgs 不能滿足你的需求時

走到 Day 24，你對 Nix 的基本操作應該已經相當熟練了。但總有些時候，你會碰到 Nixpkgs 裡的套件「差一點點」就符合需求的窘境：

- 上游的版本太舊，你需要更新的 release。
- 某個套件有個已知的 bug，社群已經有 patch 但還沒被 merge。
- 你想在既有套件的 build 流程中加入額外的 compile flag。
- 你開發了一個內部工具，想讓它像 Nixpkgs 裡的套件一樣被其他 module 引用。

在傳統的 Linux distribution 上，你可能會選擇自己 compile、手動覆蓋檔案，或是加入第三方 PPA。但在 NixOS 的世界裡，我們有一個更優雅的做法 — **Overlay**。

今天，我們就來搞懂 overlay 的概念、語法，以及那些你在實務上一定會用到的場景。

---

## Overlay 是什麼？

簡單來說，overlay 是一個 **修改 Nixpkgs 套件集合的函式**。它讓你可以在不 fork 整個 Nixpkgs repository 的情況下，對特定套件進行覆寫（override）、打補丁（patch），甚至新增自訂的套件。

你可以把 Nixpkgs 想像成一張很大的「套件地圖」。Overlay 就是一張透明的描圖紙 — 你在上面畫的東西會覆蓋在原本的地圖上，但不會破壞原圖。

更精確地說，overlay 是一個接受兩個參數的 function，它回傳一個 attribute set，裡面包含你想要新增或覆寫的套件定義：

```nix
final: prev: {
  # 在這裡定義你想要覆寫或新增的套件
}
```

這兩個參數的意義非常重要，我們馬上來細看。

---

## Overlay 的基本語法：`final` 與 `prev`

每個 overlay 都是一個形如 `final: prev: { ... }` 的函式。這兩個參數分別代表：

| 參數 | 意義 | 用途 |
|------|------|------|
| `prev`（也常寫作 `super`） | 套用此 overlay **之前**的 Nixpkgs 套件集 | 用來取得「原本」的套件定義，作為修改的基礎 |
| `final`（也常寫作 `self`） | 套用**所有** overlay **之後**的最終套件集 | 用來引用其他套件，確保引用到的也是被覆寫後的版本 |

> 💡 在早期的 Nix 文件和社群文章中，你會看到 `self` / `super` 的寫法。新版的慣例傾向使用 `final` / `prev`，語意更明確。本文統一使用 `final` / `prev`。

### 什麼時候用 `prev`？什麼時候用 `final`？

**大部分情況下，你應該使用 `prev`。** 因為你是要「在原本的東西上面修改」，所以需要拿到修改前的版本作為基礎：

```nix
final: prev: {
  # ✅ 正確：基於 prev（修改前的版本）進行覆寫
  htop = prev.htop.overrideAttrs (oldAttrs: {
    patches = (oldAttrs.patches or []) ++ [ ./my-htop-fix.patch ];
  });
}
```

`final` 主要用在你需要引用「最終版本」的套件作為 dependency 時：

```nix
final: prev: {
  my-tool = prev.callPackage ./my-tool.nix { };

  # ✅ 用 final 引用最終版本的套件作為 dependency
  my-wrapper = prev.writeShellScriptBin "my-wrapper" ''
    exec ${final.my-tool}/bin/my-tool "$@"
  '';
}
```

> ⚠️ **注意**：千萬不要用 `final` 來取得你正在覆寫的同一個套件，否則會造成 **infinite recursion**（無限遞迴）。這是初學者最常見的陷阱。

```nix
final: prev: {
  # ❌ 錯誤！會造成 infinite recursion
  htop = final.htop.overrideAttrs (oldAttrs: {
    patches = [ ./fix.patch ];
  });
}
```

---

## 在 Flake 中使用 Overlay

在 flake 的架構下，overlay 有兩個常見的使用方式。

### 方式一：直接在 `nixpkgs.overlays` 中定義

最直覺的方式是直接在 `flake.nix` 的 NixOS configuration 裡設定 `nixpkgs.overlays`：

```nix
# flake.nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
  };

  outputs = { self, nixpkgs, ... }: {
    nixosConfigurations.my-machine = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      modules = [
        ./configuration.nix
        {
          nixpkgs.overlays = [
            (final: prev: {
              # 你的 overlay 定義放在這裡
              my-app = prev.callPackage ./pkgs/my-app.nix { };
            })
          ];
        }
      ];
    };
  };
}
```

### 方式二：將 overlay 獨立成檔案（推薦）

當 overlay 的內容變多時，把它們拆成獨立檔案會更好維護：

```
.
├── flake.nix
├── configuration.nix
└── overlays/
    ├── default.nix       # 主要 overlay
    ├── patches.nix       # 專門放 patch 的 overlay
    └── custom-pkgs.nix   # 自訂套件的 overlay
```

`overlays/default.nix`：

```nix
# overlays/default.nix
final: prev: {
  # 引入其他 overlay 檔案中定義的套件
  my-app = prev.callPackage ../pkgs/my-app.nix { };

  # 直接在這裡覆寫套件
  htop = prev.htop.overrideAttrs (oldAttrs: {
    patches = (oldAttrs.patches or []) ++ [ ../patches/htop-custom.patch ];
  });
}
```

然後在 `flake.nix` 中引用：

```nix
# flake.nix
{
  outputs = { self, nixpkgs, ... }: {
    # 將 overlay export 出去，方便其他 flake 使用
    overlays.default = import ./overlays/default.nix;

    nixosConfigurations.my-machine = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      modules = [
        ./configuration.nix
        {
          nixpkgs.overlays = [ self.overlays.default ];
        }
      ];
    };
  };
}
```

### 方式三：在 `legacyPackages` 或 `packages` 中使用

如果你只是在 `devShell` 或 `packages` 中使用 overlay，不一定需要走 NixOS module 的方式，可以直接用 `import`：

```nix
{
  outputs = { self, nixpkgs, ... }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs {
        inherit system;
        overlays = [ self.overlays.default ];
      };
    in {
      overlays.default = import ./overlays/default.nix;

      devShells.${system}.default = pkgs.mkShell {
        packages = [ pkgs.my-app ];
      };
    };
}
```

---

## 實戰：修改套件版本

這是最常見的 overlay 使用場景之一。假設 Nixpkgs 中的某個套件版本太舊，你需要升級到特定版本。

### 範例：升級 `jq` 到更新的版本

```nix
# overlays/version-bump.nix
final: prev: {
  jq = prev.jq.overrideAttrs (oldAttrs: rec {
    version = "1.7.1";
    src = prev.fetchFromGitHub {
      owner = "jqlang";
      repo = "jq";
      rev = "jq-${version}";
      hash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
    };
  });
}
```

> 💡 **取得正確的 hash**：第一次可以先填一個假的 hash（像上面的全 A），build 時 Nix 會報錯並告訴你正確的 hash。不過更優雅的做法是使用 `nix-prefetch-url` 或 `nix-prefetch-github` 來取得：
>
> ```bash
> nix-prefetch-github jqlang jq --rev jq-1.7.1
> ```

### 使用 `overrideAttrs` 的注意事項

`overrideAttrs` 是覆寫套件最常用的 function。它接受一個 function 作為參數，這個 function 會收到原本的 attributes（`oldAttrs`），你可以基於它來做修改：

```nix
prev.some-package.overrideAttrs (oldAttrs: {
  # 完全替換
  version = "2.0.0";

  # 追加到原有 list
  buildInputs = (oldAttrs.buildInputs or []) ++ [ prev.some-dependency ];

  # 修改 build phase
  postInstall = (oldAttrs.postInstall or "") + ''
    echo "Custom post-install step"
  '';
})
```

---

## 實戰：給套件打補丁

有時候你不需要升級版本，只是要修復一個 bug 或加入一個小改動。這時候用 patch 就對了。

### 範例：為 `neovim` 加上自訂 patch

先準備好你的 patch 檔案：

```bash
# 產生 patch 的方式（假設你已經 clone 了上游 repo）
git diff > ~/nix-learning/patches/neovim-fix.patch
```

然後在 overlay 中套用：

```nix
# overlays/patches.nix
final: prev: {
  neovim-unwrapped = prev.neovim-unwrapped.overrideAttrs (oldAttrs: {
    patches = (oldAttrs.patches or []) ++ [
      ../patches/neovim-fix.patch
    ];
  });
}
```

### 直接從 GitHub PR 抓取 patch

你甚至不需要手動下載 patch。如果修復已經存在於某個 GitHub PR 中，可以直接用 `fetchpatch`：

```nix
final: prev: {
  some-package = prev.some-package.overrideAttrs (oldAttrs: {
    patches = (oldAttrs.patches or []) ++ [
      (prev.fetchpatch {
        name = "fix-crash-on-startup.patch";
        url = "https://github.com/owner/repo/commit/abc123.patch";
        hash = "sha256-BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=";
      })
    ];
  });
}
```

> 💡 `fetchpatch` 的 `url` 小技巧：GitHub 上的任何 commit 或 PR，只要在 URL 後面加上 `.patch` 就能拿到 patch 格式的內容。例如：
> - Commit：`https://github.com/owner/repo/commit/abc123.patch`
> - PR：`https://github.com/owner/repo/pull/42.patch`

---

## 實戰：新增自訂套件

除了修改現有套件，overlay 也是新增自訂套件到 Nixpkgs 生態系的最佳方式。

### 範例：打包一個簡單的 Go 工具

假設你有一個內部的 Go CLI 工具，想讓它在 NixOS 上也能被正常使用。

先建立套件的 derivation：

```nix
# pkgs/my-go-tool.nix
{ lib, buildGoModule, fetchFromGitHub }:

buildGoModule rec {
  pname = "my-go-tool";
  version = "0.3.0";

  src = fetchFromGitHub {
    owner = "your-org";
    repo = "my-go-tool";
    rev = "v${version}";
    hash = "sha256-CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC=";
  };

  vendorHash = "sha256-DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD=";

  meta = with lib; {
    description = "A handy CLI tool for internal use";
    homepage = "https://github.com/your-org/my-go-tool";
    license = licenses.mit;
    maintainers = [ ];
  };
}
```

然後在 overlay 中引入：

```nix
# overlays/custom-pkgs.nix
final: prev: {
  my-go-tool = prev.callPackage ../pkgs/my-go-tool.nix { };
}
```

這樣一來，你就可以在 `configuration.nix` 或 `devShell` 中直接使用 `pkgs.my-go-tool`，就像使用任何 Nixpkgs 裡的套件一樣。

### 範例：打包一個 shell script

如果只是一個簡單的 script，不用那麼大費周章：

```nix
# overlays/scripts.nix
final: prev: {
  deploy-tool = prev.writeShellApplication {
    name = "deploy-tool";
    runtimeInputs = with final; [ curl jq openssh ];
    text = ''
      echo "Starting deployment..."
      # 你的佈署邏輯
      ssh user@server "sudo nixos-rebuild switch"
    '';
  };
}
```

`writeShellApplication` 會自動幫你做 `shellcheck`，並把 `runtimeInputs` 加入 `PATH`，非常方便。

---

## Overlay 的最佳實踐

經過前面幾個實戰範例，你應該對 overlay 的威力有了具體的感受。以下整理幾個在實務上值得注意的原則：

### 1. 依職責拆分 overlay

不要把所有修改塞在同一個 overlay 裡。依照用途拆分，方便維護：

```
overlays/
├── version-bumps.nix    # 版本升級
├── patches.nix          # Bug 修復 patch
├── custom-pkgs.nix      # 自訂套件
└── default.nix          # 彙整所有 overlay（可選）
```

如果需要一個彙整用的進入點：

```nix
# overlays/default.nix — 組合多個 overlay
final: prev:
  (import ./version-bumps.nix final prev)
  // (import ./patches.nix final prev)
  // (import ./custom-pkgs.nix final prev)
```

### 2. 優先使用 `prev`，必要時才用 `final`

前面已經強調過了，再說一次：**修改套件用 `prev`，引用依賴用 `final`**。搞反了就是 infinite recursion。

### 3. 為覆寫加上註解

overlay 中的每一個覆寫都應該有簡短的註解，說明「為什麼要改」：

```nix
final: prev: {
  # 修正 jq 在 aarch64 上的 segfault，等上游 merge PR #1234 後移除
  jq = prev.jq.overrideAttrs (oldAttrs: {
    patches = (oldAttrs.patches or []) ++ [
      (prev.fetchpatch {
        name = "fix-aarch64-segfault.patch";
        url = "https://github.com/jqlang/jq/pull/1234.patch";
        hash = "sha256-...";
      })
    ];
  });
}
```

三個月後回來看，你會感謝當初的自己。

### 4. 定期清理不再需要的 overlay

當你追蹤的 Nixpkgs channel 更新到已包含你的修改時，相對應的 overlay 就該移除了。留著過時的 overlay 不僅增加維護成本，還可能在未來的版本升級中造成衝突。

### 5. 善用 `nixpkgs.overlays` 的順序性

`nixpkgs.overlays` 接受的是一個 **list**，overlay 會依照順序套用。後面的 overlay 可以「看到」前面 overlay 的修改結果（透過 `prev`）。善用這一點，你可以做出分層的修改策略。

### 6. 使用 `lib.composeExtensions` 組合 overlay

當你需要程式化地組合多個 overlay 時：

```nix
let
  combinedOverlay = nixpkgs.lib.composeManyExtensions [
    (import ./overlays/version-bumps.nix)
    (import ./overlays/patches.nix)
    (import ./overlays/custom-pkgs.nix)
  ];
in {
  nixpkgs.overlays = [ combinedOverlay ];
}
```

---

## 小結

今天我們學會了 Nix 生態系中非常實用的工具 — **Overlay**。來回顧一下重點：

| 概念 | 說明 |
|------|------|
| Overlay 的本質 | 一個 `final: prev: { ... }` 的函式，用來修改 Nixpkgs 套件集 |
| `prev` | 套用此 overlay 之前的套件集，用來取得原始套件定義 |
| `final` | 所有 overlay 套用後的最終套件集，用來引用最終版本的依賴 |
| `overrideAttrs` | 修改既有套件 attributes 的核心函式 |
| `fetchpatch` | 直接從 URL 抓取 patch 檔案的工具 |
| `callPackage` | 將自訂套件加入 Nixpkgs 生態的標準方式 |

Overlay 讓你在不 fork Nixpkgs 的前提下，靈活地客製化你的套件環境。無論是版本升級、bug 修復、還是新增內部工具，overlay 都能優雅地處理。

---

## 明日預告

在 Day 25，我們將進入 **CI/CD 與 Nix** 的世界。學習如何在 GitHub Actions 等 CI 環境中使用 Nix 來建構一個可重現的 build pipeline，讓你的佈署流程更加穩定與可靠。我們明天見！
