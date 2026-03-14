---
title: "Day 27：CI/CD 與 Nix — 讓每一次構建都可重現"
datetime: "2026-04-10"
description: "示範如何在 GitHub Actions 中整合 Nix，打造穩定、快速且完全可重現的 CI/CD pipeline，解決環境不一致的構建問題。"
parent: "NixOs Bootcamp"
---

# Day 27：CI/CD 與 Nix — 讓每一次構建都可重現

> 🗓 系列：NixOS 30 天學習之旅  
> 📦 階段：第四階段 — 工程師進階實務（Day 22 – Day 30）  
> 🎯 階段核心目標：佈署、自動化、安全性與貢獻

---

## 前言：為什麼 CI/CD 需要 Nix？

如果你曾經在 CI/CD pipeline 中遇過以下狀況，你一定不陌生：

- 本機構建成功，CI 卻報錯 — 因為 runner 上的 toolchain 版本不一樣。
- 每次 CI 都要花十幾分鐘重新安裝 dependencies — 因為 cache 機制不穩定。
- 不同 branch 需要不同版本的 compiler — 但 runner 上只裝了一個。

這些問題的根源都指向同一件事：**CI 環境不可重現**。

而 Nix 天生就在解決「可重現性」這個問題。當我們把 Nix 引入 CI/CD，等於把整條 pipeline 的構建環境鎖死 — 不管是誰的機器、哪個 runner、什麼時間點跑，結果都一樣。

今天我們就來看看如何在 GitHub Actions 中整合 Nix，打造一條穩定、快速、可重現的 CI/CD pipeline。

---

## GitHub Actions + Nix 基本設定

要在 GitHub Actions 中使用 Nix，最主流的做法是透過社群維護的 [`install-nix-action`](https://github.com/cachix/install-nix-action)。它由 Cachix 團隊開發，已經是 Nix 社群的標準選擇。

先來看一個最基本的 workflow：

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Nix
        uses: cachix/install-nix-action@v31
        with:
          nix_path: nixpkgs=channel:nixos-24.11

      - name: Build
        run: nix build

      - name: Run checks
        run: nix flake check
```

就這麼簡單。幾行設定，你的 CI runner 就擁有了完整的 Nix 環境。

---

## install-nix-action 深入解析

`install-nix-action` 是讓 GitHub Actions runner 能執行 Nix 指令的關鍵。它會在 runner 上安裝 Nix package manager，並設定好必要的環境變數。

### 常用參數

```yaml
- uses: cachix/install-nix-action@v31
  with:
    # 指定 Nix 安裝來源的 channel
    nix_path: nixpkgs=channel:nixos-24.11

    # 額外的 nix.conf 設定
    extra_nix_config: |
      experimental-features = nix-command flakes
      access-tokens = github.com=${{ secrets.GITHUB_TOKEN }}

    # 指定安裝的 Nix 版本（選用）
    install_url: https://releases.nixos.org/nix/nix-2.24.12/install
```

### 重點說明

1. **`extra_nix_config`**：這裡可以塞入任何 `nix.conf` 的設定。最常見的是啟用 `flakes` 和 `nix-command` 這兩個 experimental feature。

2. **`access-tokens`**：GitHub Actions 的 runner 在抓取 GitHub 上的 flake input 時，容易碰到 API rate limit。把 `GITHUB_TOKEN` 傳進去，可以大幅提高限額，避免 CI 莫名失敗。

3. **版本鎖定**：如果你的團隊對 Nix 版本有特定需求，可以透過 `install_url` 鎖定版本，避免 Nix 升級後行為改變。

---

## 在 CI 中使用 nix build 與 nix flake check

一旦 Nix 安裝完成，你就可以在 CI 中使用所有 Nix 指令。最常用的兩個是 `nix build` 和 `nix flake check`。

### nix build — 構建你的專案

```yaml
- name: Build project
  run: nix build .#myapp
```

`nix build` 會根據你的 `flake.nix` 中定義的 `packages` output 進行構建。構建結果會放在 `./result` 這個 symlink 底下。

如果你的 flake 有多個 output，可以分別構建：

```yaml
- name: Build all outputs
  run: |
    nix build .#myapp
    nix build .#mylib
    nix build .#docker-image
```

### nix flake check — 跑測試與驗證

`nix flake check` 是 Nix flake 內建的驗證機制。它會：

1. 檢查 `flake.nix` 的語法是否正確。
2. 評估所有 flake output 是否能成功 evaluate。
3. 執行 `checks` output 中定義的測試。

在你的 `flake.nix` 中，可以這樣定義 checks：

```nix
{
  outputs = { self, nixpkgs }: let
    system = "x86_64-linux";
    pkgs = nixpkgs.legacyPackages.${system};
  in {
    packages.${system}.default = pkgs.callPackage ./default.nix { };

    checks.${system} = {
      # 單元測試
      unit-tests = pkgs.runCommand "unit-tests" {
        buildInputs = [ self.packages.${system}.default pkgs.bash ];
      } ''
        # 這裡放你的測試指令
        echo "Running unit tests..."
        mkdir -p $out
        echo "Tests passed" > $out/result
      '';

      # 程式碼格式檢查
      formatting = pkgs.runCommand "check-formatting" {
        buildInputs = [ pkgs.nixpkgs-fmt ];
        src = self;
      } ''
        nixpkgs-fmt --check $src/*.nix
        mkdir -p $out
      '';
    };
  };
}
```

然後在 CI 中只要一行：

```yaml
- name: Run all checks
  run: nix flake check
```

所有定義在 `checks` 裡的測試就會自動跑完。這是 Nix-based CI 最優雅的地方 — **測試邏輯也是 Nix expression 的一部分**，和構建環境一起被鎖定、被重現。

---

## cachix-action：加速 CI 構建的關鍵

Nix 的構建是 deterministic 的，但它有一個代價 — **第一次構建非常慢**。如果每次 CI 都要從頭編譯所有 dependencies，那 pipeline 會跑到天荒地老。

這就是 [Cachix](https://cachix.org/) 上場的時候了。

### Cachix 是什麼？

Cachix 是一個 Nix binary cache 服務。它的原理很簡單：

1. 你在某個環境構建了一個 derivation，產出了一個 binary。
2. 這個 binary 被上傳到 Cachix。
3. 下次任何人（或任何 CI runner）需要同一個 derivation 時，直接從 Cachix 下載 binary，不用重新編譯。

因為 Nix 的每個 derivation 都有唯一的 hash，所以這個 cache 是精確到每一個套件版本的 — 不會有「cache 過期」或「cache 污染」的問題。

### 設定 Cachix

首先，你需要在 [cachix.org](https://cachix.org/) 上建立一個 cache。假設你的 cache 名稱是 `my-project`。

接著，在 GitHub repository 的 Settings > Secrets 中加入一個 secret：

- **Name**：`CACHIX_AUTH_TOKEN`
- **Value**：從 Cachix dashboard 取得的 auth token

### 在 workflow 中使用 cachix-action

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Nix
        uses: cachix/install-nix-action@v31
        with:
          extra_nix_config: |
            experimental-features = nix-command flakes
            access-tokens = github.com=${{ secrets.GITHUB_TOKEN }}

      - name: Setup Cachix
        uses: cachix/cachix-action@v15
        with:
          name: my-project
          authToken: '${{ secrets.CACHIX_AUTH_TOKEN }}'

      - name: Build
        run: nix build

      - name: Run checks
        run: nix flake check
```

`cachix-action` 做了兩件事：

1. **Pull**：在構建開始前，把你的 Cachix cache 加入 Nix 的 substituters 列表，這樣 Nix 會優先從 cache 下載已有的 binary。
2. **Push**：在構建完成後（透過 post-build hook），自動把新構建的產物上傳到 Cachix，供後續使用。

### 效果有多顯著？

以一個中型 Rust 專案為例：

| 情境 | 構建時間 |
|------|---------|
| 無 cache，從頭編譯 | ~25 分鐘 |
| 有 Cachix，僅增量構建 | ~3 分鐘 |
| 完全命中 cache | ~30 秒 |

差距是數量級的。這就是為什麼在 Nix-based CI 中，**Cachix 幾乎是必備的**。

---

## 實戰：完整的 CI/CD Pipeline

讓我們把前面學到的東西組合起來，設計一條真實世界中常見的 Nix-based CI/CD pipeline：

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  CACHIX_CACHE_NAME: my-project

jobs:
  # ── 階段一：檢查與測試 ───────────────────────
  check:
    name: "Flake Check"
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: cachix/install-nix-action@v31
        with:
          extra_nix_config: |
            experimental-features = nix-command flakes
            access-tokens = github.com=${{ secrets.GITHUB_TOKEN }}

      - uses: cachix/cachix-action@v15
        with:
          name: ${{ env.CACHIX_CACHE_NAME }}
          authToken: '${{ secrets.CACHIX_AUTH_TOKEN }}'

      - name: Nix Flake Check
        run: nix flake check --print-build-logs

  # ── 階段二：構建產物 ───────────────────────
  build:
    name: "Build"
    needs: check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: cachix/install-nix-action@v31
        with:
          extra_nix_config: |
            experimental-features = nix-command flakes
            access-tokens = github.com=${{ secrets.GITHUB_TOKEN }}

      - uses: cachix/cachix-action@v15
        with:
          name: ${{ env.CACHIX_CACHE_NAME }}
          authToken: '${{ secrets.CACHIX_AUTH_TOKEN }}'

      - name: Build application
        run: nix build .#default --print-build-logs

      - name: Build Docker image
        run: |
          nix build .#docker-image
          # 將構建出的 image 載入 Docker
          docker load < result

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: build-result
          path: result

  # ── 階段三：佈署（僅 main branch） ──────────
  deploy:
    name: "Deploy"
    needs: build
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - uses: cachix/install-nix-action@v31
        with:
          extra_nix_config: |
            experimental-features = nix-command flakes
            access-tokens = github.com=${{ secrets.GITHUB_TOKEN }}

      - uses: cachix/cachix-action@v15
        with:
          name: ${{ env.CACHIX_CACHE_NAME }}
          authToken: '${{ secrets.CACHIX_AUTH_TOKEN }}'

      - name: Build Docker image
        run: |
          nix build .#docker-image
          docker load < result

      - name: Push to registry
        run: |
          echo "${{ secrets.DOCKER_PASSWORD }}" | \
            docker login -u "${{ secrets.DOCKER_USERNAME }}" --password-stdin
          docker tag myapp:latest registry.example.com/myapp:${{ github.sha }}
          docker push registry.example.com/myapp:${{ github.sha }}
```

### Pipeline 架構說明

這條 pipeline 分成三個階段：

1. **Check** — 跑 `nix flake check`，確保程式碼品質與測試通過。
2. **Build** — 構建應用程式與 Docker image，上傳 artifact。
3. **Deploy** — 僅在 `main` branch 的 push 事件觸發，推送 image 到 container registry。

每個階段都用了 Cachix，所以即使分成多個 job，共同的 dependencies 也只需要構建一次。

### 搭配 flake.nix 的 Docker image output

在上面的 pipeline 中，我們用到了 `.#docker-image` 這個 flake output。以下是對應的 `flake.nix` 片段：

```nix
{
  outputs = { self, nixpkgs }: let
    system = "x86_64-linux";
    pkgs = nixpkgs.legacyPackages.${system};
    myapp = pkgs.callPackage ./default.nix { };
  in {
    packages.${system} = {
      default = myapp;

      docker-image = pkgs.dockerTools.buildLayeredImage {
        name = "myapp";
        tag = "latest";
        contents = [ myapp ];
        config = {
          Cmd = [ "${myapp}/bin/myapp" ];
          ExposedPorts."8080/tcp" = { };
        };
      };
    };

    checks.${system}.unit-tests = pkgs.runCommand "unit-tests" {
      buildInputs = [ myapp ];
    } ''
      myapp --run-tests
      mkdir -p $out
    '';
  };
}
```

這裡用 `pkgs.dockerTools.buildLayeredImage` 在 Nix 中直接產出 Docker image — 不需要寫 Dockerfile，整個 image 的內容也是完全可重現的。

---

## 進階技巧

### Matrix Build：多平台構建

如果你的專案需要支援多個平台，可以用 GitHub Actions 的 matrix strategy：

```yaml
jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: cachix/install-nix-action@v31
      - uses: cachix/cachix-action@v15
        with:
          name: my-project
          authToken: '${{ secrets.CACHIX_AUTH_TOKEN }}'
      - run: nix build
      - run: nix flake check
```

`install-nix-action` 同時支援 Linux 和 macOS runner，所以跨平台構建不需要額外設定。

### 只在特定路徑變更時觸發

避免不必要的 CI 執行，可以用 `paths` filter：

```yaml
on:
  push:
    branches: [main]
    paths:
      - '**.nix'
      - 'flake.lock'
      - 'src/**'
  pull_request:
    paths:
      - '**.nix'
      - 'flake.lock'
      - 'src/**'
```

### 使用 nix develop 跑自訂測試

如果你的測試工具不是透過 `nix flake check` 驅動，而是需要在 development shell 裡跑：

```yaml
- name: Run tests in dev shell
  run: |
    nix develop --command bash -c "
      cargo test --all
      cargo clippy -- -D warnings
    "
```

`nix develop --command` 會進入你的 `devShells` 定義的環境，然後執行後面的指令。這讓你可以在 CI 中使用和本機開發完全相同的工具鏈。

---

## 其他 CI 平台整合

雖然 GitHub Actions 是最主流的選擇，但 Nix 也能輕鬆整合到其他 CI 平台。

### GitLab CI

```yaml
# .gitlab-ci.yml
image: nixos/nix:latest

variables:
  NIX_CONFIG: "experimental-features = nix-command flakes"

before_script:
  - nix --version

build:
  stage: build
  script:
    - nix build --print-build-logs
    - nix flake check

deploy:
  stage: deploy
  only:
    - main
  script:
    - nix build .#docker-image
    - docker load < result
    - docker push registry.example.com/myapp:$CI_COMMIT_SHA
```

GitLab CI 有官方的 `nixos/nix` Docker image，直接拿來用就好。

### 自架 CI（Jenkins, Buildkite, etc.）

如果你是用自架的 CI server，只要確保 runner 上安裝了 Nix，就能用同樣的指令：

```bash
# 安裝 Nix（single-user 模式，適合 CI runner）
curl -L https://nixos.org/nix/install | sh -s -- --no-daemon

# 載入 Nix 環境
. /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh

# 跑構建
nix build
nix flake check
```

重點在於 Nix 的可攜性 — 不管 CI 平台是什麼，構建邏輯都寫在 `flake.nix` 裡。切換 CI 平台時，只需要調整「怎麼安裝 Nix」這一步，其他指令完全不變。

---

## 常見問題與排錯

### 1. Disk space 不足

GitHub Actions 的 runner 預設只有約 14 GB 的可用空間。Nix 構建大型專案時容易吃滿。解法：

```yaml
- name: Free disk space
  run: |
    sudo rm -rf /usr/share/dotnet
    sudo rm -rf /usr/local/lib/android
    sudo rm -rf /opt/ghc
```

在安裝 Nix 之前先清掉用不到的預裝軟體。

### 2. GitHub API rate limit

Nix 在 evaluate flake input 時會呼叫 GitHub API。沒帶 token 的話很快就會碰到 rate limit：

```yaml
- uses: cachix/install-nix-action@v31
  with:
    extra_nix_config: |
      access-tokens = github.com=${{ secrets.GITHUB_TOKEN }}
```

這行設定是幾乎每個 Nix CI workflow 都該加的。

### 3. IFD（Import From Derivation）導致構建緩慢

如果你的 flake 使用了 IFD（例如某些 Haskell 或 Node.js 專案的自動產生 Nix expression），構建時間會大幅增加。建議在 CI 中預先把 IFD 的結果 cache 起來，或是考慮用 `flake.lock` 鎖定好再 commit。

---

## 小結

今天我們學到了：

- **install-nix-action** 讓 GitHub Actions runner 瞬間擁有 Nix 環境，設定只需幾行。
- **nix build** 和 **nix flake check** 是 Nix-based CI 的兩大核心指令 — 一個負責構建，一個負責驗證。
- **cachix-action** 透過 binary cache 大幅加速 CI 構建，從 25 分鐘縮短到 30 秒不是夢。
- 一條完整的 Nix CI/CD pipeline 可以涵蓋檢查、構建、Docker image 產出、到佈署的全流程。
- Nix 的可攜性讓你輕鬆切換 CI 平台 — 構建邏輯永遠跟著 `flake.nix` 走。

Nix 在 CI/CD 中最大的價值，就是把「可重現性」從開發者的本機延伸到整條 pipeline。當你的 CI 和本機跑的是同一套 Nix expression，「在我的電腦上是好的啊」這種對話就再也不會出現了。

> **明日預告：Day 28 — Nix 安全性實務**  
> 我們將探討如何管理 secrets、審計 Nix 套件的安全性，以及使用 `vulnix` 等工具進行漏洞掃描。敬請期待！
