---
title: "Day 23：Docker 的終結者？ — 用 Nix 構建極小化的 Container Image"
datetime: "2026-04-06"
description: "探討如何用 Nix 取代 Dockerfile 來構建極小化、完全可重現的容器映像檔，比較 Nix 與 Docker 在構建流程上的互補關係。"
parent: "NixOs Bootcamp"
---

# Day 23：Docker 的終結者？ — 用 Nix 構建極小化的 Container Image

> 🗓 系列：NixOS 30 天學習之旅  
> 📦 階段：第四階段 — 工程師進階實務 (Day 22 – Day 30)  
> 🎯 階段核心目標：佈署、自動化、安全性與貢獻

---

## 前言：Nix vs Docker — 互補還是取代？

標題有點聳動，但這是社群裡真實存在的討論：**Nix 會取代 Docker 嗎？**

先講結論：**不會，但 Nix 可以讓 Docker 變得更好。**

Docker 解決的核心問題是「打包與發佈」— 把 application 連同它的 runtime environment 包成一個 image，確保在任何地方都能跑起來。而 Nix 解決的核心問題是「可重現的構建」— 同樣的 input 永遠產出同樣的 output。

這兩件事並不衝突，反而高度互補。今天我們要學的，就是如何用 Nix 來**構建 Docker image** — 不寫 Dockerfile，不需要 Docker daemon 參與 build 過程，直接用 Nix 產出一個極小化、完全可重現的 container image。

聽起來很瘋狂？讓我們開始吧。

---

## 為什麼用 Nix 構建 Docker Image？

在看 code 之前，先搞清楚動機。傳統用 Dockerfile 構建 image，通常長這樣：

```dockerfile
FROM ubuntu:22.04
RUN apt-get update && apt-get install -y python3 python3-pip
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY app.py .
CMD ["python3", "app.py"]
```

看起來很直覺，但背後有幾個根本性的問題：

### 1. 不可重現（Non-reproducible）

今天執行 `docker build` 和明天執行 `docker build`，產出的 image 可能不一樣。因為 `apt-get update` 拉到的套件版本會隨時間改變，`pip install` 的結果也取決於當下 PyPI 上的最新版本。

你可能會說：「我可以 pin 版本啊！」沒錯，但你有辦法 pin 住 `apt-get` 安裝的每一個 transitive dependency 嗎？實務上非常困難。

### 2. Image 太肥（Bloated）

基於 `ubuntu:22.04` 的 image 動輒 200MB 起跳，裡面塞了一堆你的 application 根本用不到的東西 — `bash`、`coreutils`、`apt` 本身⋯⋯ 這些都是攻擊面（attack surface）。

就算你用了 `alpine` 作為 base image，還是會帶進不少不必要的東西。

### 3. Layer cache 容易失效

Dockerfile 的 layer caching 機制是按照指令順序的。只要某一層變了，後面所有層都得重建。當你只是改了一行程式碼，卻得重新跑 `apt-get install`，那種等待感⋯⋯你懂的。

### Nix 怎麼解決這些問題？

| 問題 | Dockerfile 方案 | Nix 方案 |
|------|----------------|----------|
| 可重現性 | 手動 pin 版本（不完整） | 自動 pin 所有 dependency（透過 Nix store hash） |
| Image 大小 | Multi-stage build + Alpine | 只包含必要的 runtime closure |
| Cache 效率 | 按 Dockerfile 指令順序 | 按 dependency graph，精準 cache |
| Build 環境 | 需要 Docker daemon | 純 Nix 構建，不需要 Docker |

---

## `dockerTools.buildImage`：基本用法

Nixpkgs 提供了一系列 `dockerTools.*` 函數，讓你完全用 Nix expression 來描述一個 Docker image。最基礎的是 `dockerTools.buildImage`。

### 最小範例

```nix
# hello-image.nix
{ pkgs ? import <nixpkgs> {} }:

pkgs.dockerTools.buildImage {
  name = "hello-nix";
  tag = "latest";

  copyToRoot = pkgs.buildEnv {
    name = "image-root";
    paths = [ pkgs.hello ];
    pathsToLink = [ "/bin" ];
  };

  config = {
    Cmd = [ "${pkgs.hello}/bin/hello" ];
  };
}
```

構建並載入：

```bash
# 構建 image（產出一個 .tar.gz 檔案）
nix-build hello-image.nix

# 載入到 Docker
docker load < result

# 執行
docker run --rm hello-nix:latest
# 輸出：Hello, world!
```

### 發生了什麼事？

讓我們拆解這段 Nix expression：

| 參數 | 說明 |
|------|------|
| `name` | Image 的名稱（對應 `docker images` 中看到的 REPOSITORY） |
| `tag` | Image 的 tag |
| `copyToRoot` | 要放進 image 根目錄的內容，這裡用 `buildEnv` 組裝一個包含 `hello` binary 的環境 |
| `config` | OCI image 的 config，對應 Dockerfile 中的 `CMD`、`ENV`、`EXPOSE` 等 |

**注意：這個 image 沒有 base image。** 沒有 Ubuntu、沒有 Alpine、沒有任何 Linux distribution — 裡面只有 `hello` 這個 binary 和它需要的 shared libraries。就這樣。

```bash
docker images hello-nix
# REPOSITORY   TAG       IMAGE ID       SIZE
# hello-nix    latest    abc123...      ~30MB
```

跟基於 `ubuntu:22.04` 構建的 image 相比，這個大小差異是震撼性的。

---

## `dockerTools.buildLayeredImage`：進階用法

`buildImage` 會把所有東西塞進一個 layer，這在實務上有個問題：每次 rebuild 都會產生一個全新的 layer，即使只改了一行程式碼，整個 image 都得重新 push。

`buildLayeredImage` 解決了這個問題。它會自動根據 Nix store 的 dependency graph 來拆分 layers — **變動頻率低的 dependency 放在底層，變動頻率高的 application code 放在頂層**。

```nix
# layered-image.nix
{ pkgs ? import <nixpkgs> {} }:

pkgs.dockerTools.buildLayeredImage {
  name = "my-app";
  tag = "v1.0";

  contents = [ pkgs.hello pkgs.coreutils ];

  config = {
    Cmd = [ "${pkgs.hello}/bin/hello" ];
    Env = [ "PATH=/bin" ];
  };

  # 最多拆成幾層（預設 100）
  maxLayers = 120;
}
```

### Layer 拆分的智慧

`buildLayeredImage` 的 layer 拆分邏輯大致如下：

1. 計算 image 中所有 Nix store paths 的 dependency closure
2. 根據每個 path 被引用的次數（popularity）排序
3. 越多東西依賴的 path（如 `glibc`）放在越底層的 layer
4. Application-specific 的 path 放在最頂層

這意味著：

- `glibc`、`openssl` 這類基礎 library 幾乎不會變，它們的 layer 可以被大量 cache 和共用
- 你的 application binary 放在最上面的 layer，每次改 code 只需要重新 push 這一層

這比 Dockerfile 的 layer caching 聰明太多了。

---

## 實戰：構建一個極小化的 Web Server Image

來做點有實際意義的事情。我們用 Nix 構建一個跑 static file server 的 Docker image：

```nix
# web-server-image.nix
{ pkgs ? import <nixpkgs> {} }:

let
  # 準備一個簡單的靜態網站
  webRoot = pkgs.writeTextDir "index.html" ''
    <!DOCTYPE html>
    <html>
      <head><title>Hello from Nix!</title></head>
      <body>
        <h1>This image was built with Nix 🚀</h1>
        <p>No Dockerfile. No base image. Pure Nix.</p>
      </body>
    </html>
  '';

  # Nginx 設定檔
  nginxConf = pkgs.writeText "nginx.conf" ''
    worker_processes 1;
    daemon off;
    error_log /dev/stderr;

    events {
      worker_connections 128;
    }

    http {
      access_log /dev/stdout;

      server {
        listen 80;
        root ${webRoot};
      }
    }
  '';

in pkgs.dockerTools.buildLayeredImage {
  name = "nix-web-server";
  tag = "latest";

  contents = [
    pkgs.nginxMainline
    pkgs.fakeNss    # 提供 /etc/passwd 和 /etc/group
  ];

  extraCommands = ''
    mkdir -p tmp/nginx_client_body
    mkdir -p var/log/nginx
  '';

  config = {
    Cmd = [ "nginx" "-c" nginxConf ];
    ExposedPorts = {
      "80/tcp" = {};
    };
  };
}
```

構建並執行：

```bash
# 構建
nix-build web-server-image.nix

# 載入
docker load < result

# 執行
docker run -d -p 8080:80 nix-web-server:latest

# 測試
curl http://localhost:8080
# <h1>This image was built with Nix 🚀</h1>
```

### 分析這個 image

```bash
docker images nix-web-server
# REPOSITORY       TAG       SIZE
# nix-web-server   latest    ~55MB
```

55MB 左右，裡面包含了完整的 Nginx — 而一個基於 `nginx:alpine` 的官方 image 大約是 40MB 左右，但官方 image 還附帶了一堆你可能用不到的 module 和工具。

更重要的是：**這個 image 完全可重現**。同一份 `web-server-image.nix`，不管在什麼時間、什麼機器上 build，產出的結果都是 bit-for-bit identical。

---

## 與傳統 Dockerfile 的比較

讓我們用一個表格來做個全面的比較：

| 面向 | 傳統 Dockerfile | Nix `dockerTools` |
|------|----------------|-------------------|
| **可重現性** | ❌ 取決於 registry 狀態和 build 時間 | ✅ 完全可重現，hash-based |
| **Image 大小** | 通常較大（帶有 package manager 等） | 極小（只包含 runtime closure） |
| **安全性** | 攻擊面較大（多餘的工具和 library） | 攻擊面極小（沒有 shell、沒有 package manager） |
| **Build cache** | 按指令順序，容易失效 | 按 dependency graph，精準高效 |
| **學習曲線** | 較低，大多數人都熟悉 | 較高，需要學 Nix 語言 |
| **生態系統** | 極度成熟，社群龐大 | 持續成長，但相對小眾 |
| **Debug 便利性** | 可以 `docker exec` 進去除錯 | 預設沒有 shell，需要額外加入 |
| **Build 依賴** | 需要 Docker daemon | 只需要 Nix，不需要 Docker daemon |

### 大小比較實驗

以一個簡單的 Go HTTP server 為例：

```
基於 ubuntu:22.04     → ~250MB
基於 golang:alpine    → ~300MB（含 Go toolchain）
Multi-stage + scratch → ~15MB
Nix buildLayeredImage → ~15MB
```

Nix 構建的 image 可以輕鬆達到和 `scratch`-based multi-stage build 同等的大小，但你不需要手動管理哪些檔案要 copy、哪些 library 要帶進去 — Nix 會自動追蹤 runtime closure。

### 可重現性比較

試著用傳統 Dockerfile 做到這件事：

> 「保證 2024 年 7 月 build 出來的 image，和 2025 年 1 月 build 出來的 image，binary 完全一致。」

幾乎不可能。即使你 pin 住了所有直接 dependency 的版本，底層 OS package 的 security patch、transitive dependency 的更新，都會讓 image 產生差異。

用 Nix？**鎖住 `flake.lock` 就搞定了**。因為 Nix 追蹤的是完整的 dependency graph，包含每一個 transitive dependency 的 exact version 和 source hash。

---

## Nix + Docker 的最佳組合

既然 Nix 這麼好，那還要 Docker 幹嘛？答案是：**各司其職**。

### 推薦的工作流程

```
┌─────────────────────────────────────┐
│  1. 用 Nix Flakes 管理專案依賴        │
│     (flake.nix + flake.lock)        │
├─────────────────────────────────────┤
│  2. 用 Nix 構建 application          │
│     (nix build)                     │
├─────────────────────────────────────┤
│  3. 用 dockerTools 打包成 image       │
│     (dockerTools.buildLayeredImage) │
├─────────────────────────────────────┤
│  4. 用 Docker/OCI 發佈與執行          │
│     (docker push / k8s deploy)      │
└─────────────────────────────────────┘
```

### 一個完整的 Flake 範例

```nix
# flake.nix
{
  description = "My Nix-built Docker image";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        # 構建你的 application
        myApp = pkgs.writeShellScriptBin "my-server" ''
          ${pkgs.python3}/bin/python3 -m http.server 8080
        '';
      in
      {
        # 開發環境
        devShells.default = pkgs.mkShell {
          packages = [ pkgs.python3 pkgs.docker ];
        };

        # Docker image
        packages.docker-image = pkgs.dockerTools.buildLayeredImage {
          name = "my-server";
          tag = "latest";

          contents = [ myApp pkgs.python3 ];

          config = {
            Cmd = [ "my-server" ];
            ExposedPorts = { "8080/tcp" = {}; };
          };
        };

        # 預設 package
        packages.default = myApp;
      }
    );
}
```

使用方式：

```bash
# 構建 image
nix build .#docker-image

# 載入並執行
docker load < result
docker run -p 8080:8080 my-server:latest
```

### 什麼時候該用 Nix 構建 Docker Image？

| 場景 | 建議 |
|------|------|
| Production 佈署，需要可重現性 | ✅ 用 Nix |
| 需要極小化 image（安全合規需求） | ✅ 用 Nix |
| CI/CD pipeline 已經使用 Nix | ✅ 用 Nix |
| 快速 prototype，團隊不熟 Nix | ❌ 用 Dockerfile |
| 依賴大量社群 Dockerfile 範例 | ❌ 用 Dockerfile |
| 團隊已深度整合 Docker Compose | ⚠️ 漸進式導入 Nix |

---

## `dockerTools` 其他實用函數

除了 `buildImage` 和 `buildLayeredImage`，`dockerTools` 還提供了幾個實用的輔助函數：

### `pullImage` — 拉取現有的 Docker Image

```nix
pkgs.dockerTools.pullImage {
  imageName = "nginx";
  imageDigest = "sha256:abc123...";
  sha256 = "0xxxxxxx...";
  finalImageTag = "1.25";
}
```

你可以用它來拉取一個既有的 image 作為 base，再用 `buildImage` 的 `fromImage` 參數來疊加。

### `buildImage` + `fromImage` — 基於現有 Image 疊加

```nix
let
  baseImage = pkgs.dockerTools.pullImage { ... };
in
pkgs.dockerTools.buildImage {
  name = "my-custom-nginx";
  tag = "latest";
  fromImage = baseImage;

  copyToRoot = pkgs.buildEnv {
    name = "extra-tools";
    paths = [ pkgs.curl pkgs.jq ];
    pathsToLink = [ "/bin" ];
  };
}
```

### `streamLayeredImage` — 串流構建（不需要暫存空間）

```nix
pkgs.dockerTools.streamLayeredImage {
  name = "streamed-image";
  tag = "latest";
  contents = [ pkgs.hello ];
  config.Cmd = [ "${pkgs.hello}/bin/hello" ];
}
```

`streamLayeredImage` 不會產出一個 `.tar.gz` 檔案，而是產出一個可執行的 script，直接串流 pipe 給 `docker load`：

```bash
nix build .#streamed-image
./result | docker load
```

好處是不需要額外的 disk space 來存放中間產物，適合 CI/CD 環境。

---

## 常見問題與除錯技巧

### Q: Image 裡沒有 shell，怎麼 debug？

開發階段可以把 `bashInteractive` 和基本工具加進去：

```nix
contents = [
  myApp
  pkgs.bashInteractive
  pkgs.coreutils
  pkgs.curl
];
```

Production 環境則建議移除這些工具，保持最小攻擊面。你也可以用 `docker debug`（Docker Desktop 功能）或 `kubectl debug` 來臨時掛載 debug container。

### Q: 缺少 `/etc/passwd` 或 `/tmp` 怎麼辦？

Nix 構建的 image 預設是「空的」— 真的什麼都沒有。如果你的 application 需要 `/etc/passwd`（例如 Nginx 要查 user），加上 `fakeNss`：

```nix
contents = [ pkgs.fakeNss myApp ];
```

需要 `/tmp` 目錄的話，用 `extraCommands`：

```nix
extraCommands = ''
  mkdir -p tmp
'';
```

### Q: 需要設定時區怎麼辦？

```nix
contents = [ pkgs.tzdata myApp ];

config = {
  Env = [ "TZ=Asia/Taipei" ];
};
```

---

## 小結

今天我們學到了如何用 Nix 來構建 Docker image，這是 Nix 在實務工程中最具威力的應用之一：

| 學到了什麼 | 重點 |
|-----------|------|
| `dockerTools.buildImage` | 基本的 image 構建，從零開始，不需要 base image |
| `dockerTools.buildLayeredImage` | 智慧 layer 拆分，優化 push/pull 效率 |
| `streamLayeredImage` | 串流構建，適合 CI/CD 環境 |
| Nix vs Dockerfile 比較 | 可重現性、大小、安全性全面勝出，但學習曲線較高 |
| 最佳實踐 | Nix 負責構建與打包，Docker/OCI 負責發佈與執行 |

Nix 不是要取代 Docker — 它是要取代 **Dockerfile**。Docker 作為 container runtime 和 image distribution 的角色，依然無可取代。但 image 的「構建方式」，Nix 提供了一個在可重現性和最小化方面遠勝 Dockerfile 的替代方案。

---

## 明日預告

**Day 24：NixOS 測試框架** — NixOS 內建了一套強大的 VM-based 測試框架，可以在虛擬機中自動化測試你的系統配置。明天我們將學習如何撰寫 NixOS test，讓你的 infrastructure as code 也能有完善的測試覆蓋率。

我們明天見！ 🚀

---

📚 **延伸閱讀**
- [Nixpkgs Manual — dockerTools](https://nixos.org/manual/nixpkgs/stable/#sec-pkgs-dockerTools)
- [nix.dev — Building container images with Nix](https://nix.dev/tutorials/nixos/building-and-running-docker-images.html)
- [Xe Iaso — I was mass mass mass mass producing Docker images with Nix](https://xeiaso.net/talks/2024/nix-docker-build/)
- [Nix Docker 範例集](https://github.com/NixOS/nixpkgs/tree/master/pkgs/build-support/docker)
