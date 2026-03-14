---
title: "Day 28：Binary Cache — 別再讓每台機器都從原始碼編譯了"
datetime: "2026-04-11"
description: "解析 Nix Binary Cache 的運作原理，介紹 Cachix 等工具來快取構建產物，大幅縮短團隊和 CI 環境的編譯時間。"
parent: "NixOs Bootcamp"
---

# Day 28：Binary Cache — 別再讓每台機器都從原始碼編譯了

> 🗓 系列：NixOS 30 天學習之旅  
> 📦 階段：第四階段 — 工程師進階實務 (Day 22 – Day 30)  
> 🎯 階段核心目標：佈署、自動化、安全性與貢獻

---

## 前言：編譯的痛，你懂的

如果你已經跟著這個系列走到 Day 28，一定經歷過這種場景：改了一行 `configuration.nix`，跑了 `nixos-rebuild switch`，然後就看著終端機裡一堆 source code 在那邊慢慢編譯，CPU 風扇開始狂轉，十幾分鐘過去了……你只是想裝個新套件而已。

更痛的情境是：你在團隊裡維護了一套完美的 Nix flake 配置，每個同事 clone 下來第一次 build 的時候，都要花上半小時甚至一小時從頭編譯。大家開始抱怨：「Nix 很好，但是也太慢了吧？」

這個問題的根源在於：Nix 的 reproducibility 意味著每個 derivation 都是從 source 建構出來的。但如果某個 derivation 的 output 已經有人建構過了，為什麼不直接拿來用呢？

這就是 **Binary Cache** 登場的時刻。

---

## Binary Cache 的原理

在 Day 1 我們提過，`/nix/store` 裡的每個路徑都帶有一個 cryptographic hash，這個 hash 是根據所有 input（source code、dependencies、build flags 等）計算出來的。這個設計帶來一個極其重要的特性：

> **相同的 input 一定會產生相同的 output。**

也就是說，如果你要建構的 derivation 的 store path 是 `/nix/store/abc123...-hello-2.12`，而某個遠端 server 上已經有一份一模一樣的 `/nix/store/abc123...-hello-2.12`，那你根本不需要自己編譯，直接下載就好了。

這就是 Binary Cache 的核心概念：

```
┌─────────────┐     ①  詢問：你有 abc123...-hello-2.12 嗎？
│   你的機器    │ ──────────────────────────────────────────► ┌──────────────┐
│             │                                              │ Binary Cache │
│             │ ◄────────────────────────────────────────── │   Server     │
└─────────────┘     ②  回應：有！這是 .nar 檔案，拿去吧      └──────────────┘
```

整個流程可以拆解為三個步驟：

1. **Hash 比對**：Nix 在建構前會先計算出目標 store path 的 hash。
2. **查詢 Cache**：向設定好的 Binary Cache server 發送 HTTP request，確認該 hash 對應的 narinfo 是否存在。
3. **下載或建構**：如果 cache hit，直接下載預編譯好的 `.nar` 檔案；如果 cache miss，則在本機從頭建構。

### narinfo 是什麼？

每個 cached 的 store path 都會有一個對應的 `.narinfo` 檔案，裡面記錄了 metadata：

```
StorePath: /nix/store/abc123...-hello-2.12
URL: nar/abc123...hello-2.12.nar.xz
Compression: xz
FileHash: sha256:1a2b3c...
FileSize: 42000
NarHash: sha256:4d5e6f...
NarSize: 120000
References: /nix/store/def456...-glibc-2.38
Sig: cache.nixos.org-1:aBcDeFg...
```

注意最後一行的 `Sig`——Binary Cache 使用 **digital signature** 來確保你下載到的東西確實是可信來源編譯出來的，而非被竄改過的。

---

## 官方 Cache：cache.nixos.org

好消息是，你其實從第一天就在使用 Binary Cache 了。

NixOS 預設會從 `https://cache.nixos.org` 下載預編譯好的套件。這個 cache 由 NixOS 官方維運，透過 Fastly CDN 在全球提供服務。所有在 nixpkgs 上通過 Hydra（NixOS 的官方 CI 系統）建構的套件，都會自動推送到這個 cache。

你可以在 `/etc/nix/nix.conf` 裡看到預設設定：

```ini
# /etc/nix/nix.conf
substituters = https://cache.nixos.org
trusted-public-keys = cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY=
```

- `substituters`：告訴 Nix 要向哪些 cache server 查詢。
- `trusted-public-keys`：告訴 Nix 只信任帶有特定 signing key 簽署的 narinfo。

### 為什麼有時候還是要編譯？

即使有了官方 cache，你仍然可能遇到必須自行編譯的情況：

- **使用 `nixpkgs-unstable` 但 Hydra 還沒 build 完**：你追的 commit 太新了，官方 CI 還來不及建構。
- **客製化的 overlay 或 override**：你改了任何 build input，hash 就會不同，cache 裡當然不會有。
- **使用了 `unfree` 套件**：部分 unfree 套件不會被官方 cache 收錄。
- **自己的 flake 專案**：你的專案當然不會在官方 cache 裡。

這就是我們需要 **Cachix** 或自建 cache 的原因。

---

## Cachix 服務介紹

[Cachix](https://cachix.org) 是目前 Nix 社群最廣泛使用的第三方 Binary Cache 服務。它讓你可以：

- 建立自己的 cache namespace
- 將你的 build output 推送上去
- 團隊成員或 CI pipeline 直接從 cache 下載

### 註冊與安裝

1. 前往 [cachix.org](https://cachix.org) 用 GitHub 帳號註冊
2. 安裝 Cachix CLI：

```bash
nix-env -iA cachix -f https://cachix.org/api/v1/install
# 或者用 flake 的方式
nix profile install github:cachix/cachix
```

3. 登入：

```bash
cachix authtoken <your-token>
```

### 建立你的 Cache

在 Cachix 的 dashboard 上建立一個新的 cache。假設你取名叫 `my-team`：

```bash
# 在你的機器上啟用這個 cache
cachix use my-team
```

執行 `cachix use` 後，它會自動修改你的 Nix 設定，將 `my-team.cachix.org` 加入 `substituters`，並加入對應的 public key。你可以檢查一下變更：

```bash
cat /etc/nix/nix.conf
# 或者在 NixOS 上
cat /etc/nix/nix.conf
```

你會看到類似這樣的內容被加入：

```ini
substituters = https://my-team.cachix.org https://cache.nixos.org
trusted-public-keys = my-team.cachix.org-1:xYzAbC... cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY=
```

如果你使用 NixOS 並透過 `configuration.nix` 管理設定，建議直接加到系統配置裡：

```nix
# /etc/nixos/configuration.nix
{
  nix.settings = {
    substituters = [
      "https://my-team.cachix.org"
      "https://cache.nixos.org"
    ];
    trusted-public-keys = [
      "my-team.cachix.org-1:xYzAbC..."
      "cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY="
    ];
  };
}
```

---

## 推送與拉取 Cache

### 推送 Build Output 到 Cachix

最直覺的做法是在建構完成後，把 output 推送上去：

```bash
# 建構並推送單一套件
nix build .#my-package && cachix push my-team ./result

# 推送整個 flake 的所有 output
nix build .#my-package | cachix push my-team
```

更優雅的方式是使用 `cachix watch-exec`，它會自動監控所有新增到 `/nix/store` 的 path 並推送：

```bash
# 自動推送建構過程中產生的所有 store path
cachix watch-exec my-team -- nix build .#my-package
```

這個方式的好處是，不只 final output 會被 cache，連建構過程中的 **中間 dependencies** 也會一起推送上去，大幅提升下次 build 的 cache hit rate。

### 拉取 Cache

拉取的部分完全不需要額外操作。只要你已經透過 `cachix use` 設定好了 substituter，之後的 `nix build`、`nix develop`、`nixos-rebuild` 都會自動去查詢 cache。

```bash
# 設定好 cache 後，直接 build 就好
# Nix 會自動優先從 cache 下載
nix build .#my-package
```

你可以透過 `--print-build-logs` 或觀察 build output 來確認是否真的從 cache 下載：

```bash
# 如果看到 "copying path '/nix/store/...' from 'https://my-team.cachix.org'..."
# 就表示 cache hit 成功
nix build .#my-package --print-build-logs
```

---

## 在團隊中共享 Cache

Binary Cache 在團隊協作中能發揮巨大價值。以下是一個典型的 CI/CD 搭配 Cachix 的 workflow：

### GitHub Actions 整合

```yaml
# .github/workflows/build.yml
name: Build and Cache
on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: cachix/install-nix-action@v27
        with:
          nix_path: nixpkgs=channel:nixos-unstable

      - uses: cachix/cachix-action@v15
        with:
          name: my-team
          authToken: '${{ secrets.CACHIX_AUTH_TOKEN }}'

      - run: nix build .#my-package
      # cachix-action 會自動推送所有 build output
```

### 團隊共享的最佳實踐

這個 workflow 建立後，效果會是這樣的：

1. **CI 先建構**：每次 push 到 `main` 時，CI 會建構所有 output 並推送到 Cachix。
2. **開發者直接拉取**：團隊成員在本機 `nix build` 時，大部分的 derivation 已經在 cache 裡了，build 時間從半小時縮短到幾分鐘。
3. **PR 也受益**：如果 PR 的 CI 也啟用了 cache push，同一個 PR 的多次建構也能享受 cache。

```
Developer A push ──► CI build ──► Cachix ──► Developer B pull
                                    ▲
Developer C push ──► CI build ──────┘
```

### 搭配 Flake 的額外設定

你可以直接在 `flake.nix` 裡宣告 binary cache，這樣任何使用你 flake 的人都會被提示加入 cache：

```nix
# flake.nix
{
  nixConfig = {
    extra-substituters = [
      "https://my-team.cachix.org"
    ];
    extra-trusted-public-keys = [
      "my-team.cachix.org-1:xYzAbC..."
    ];
  };

  # ... 其餘的 flake 設定
}
```

使用 `extra-substituters` 而非 `substituters`，是為了「追加」而非「覆蓋」使用者現有的 cache 設定。Nix 在遇到這個設定時，會詢問使用者是否信任這個額外的 substituter。

---

## 自建 Binary Cache

如果你的團隊有嚴格的安全性要求、不希望把 build output 上傳到第三方服務，或者你想要完全掌控 cache infrastructure，自建 Binary Cache 是個好選擇。

### 方法一：nix-serve

`nix-serve` 是最簡單的自建方案，它直接將本機的 `/nix/store` 透過 HTTP 提供出去。

在 NixOS 上只需幾行設定：

```nix
# /etc/nixos/configuration.nix
{
  services.nix-serve = {
    enable = true;
    port = 5000;
    secretKeyFile = "/var/secrets/cache-priv-key.pem";
  };

  # 開放 firewall
  networking.firewall.allowedTCPPorts = [ 5000 ];
}
```

#### 產生 Signing Key

Binary Cache 需要一對 signing key 來簽署 narinfo：

```bash
# 產生 key pair
nix-store --generate-binary-cache-key my-cache cache-priv-key.pem cache-pub-key.pem

# 把 private key 放到安全的地方
sudo mkdir -p /var/secrets
sudo mv cache-priv-key.pem /var/secrets/
sudo chmod 600 /var/secrets/cache-priv-key.pem

# public key 的內容要分享給所有 client
cat cache-pub-key.pem
# 會得到類似：my-cache:aBcDeFgHiJkLmNoPqRsTuVwXyZ...
```

在 client 端設定：

```nix
# client 端的 configuration.nix
{
  nix.settings = {
    substituters = [
      "http://your-cache-server:5000"
      "https://cache.nixos.org"
    ];
    trusted-public-keys = [
      "my-cache:aBcDeFgHiJkLmNoPqRsTuVwXyZ..."
      "cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY="
    ];
  };
}
```

`nix-serve` 的優點是設定極其簡單，但缺點是功能比較陽春，無法管理 cache retention、沒有 garbage collection 機制，且效能在大規模使用時可能不足。

### 方法二：Attic — 現代化的自建方案

[Attic](https://github.com/zhaofengli/attic) 是 Nix 社群近年來備受關注的自建 Binary Cache 方案，由 Zhaofeng Li 開發。它解決了 `nix-serve` 的諸多限制：

- **多 Cache 支援**：一個 server 可以管理多個獨立的 cache（例如 `prod`、`dev`、`ci`）。
- **Chunked deduplication**：透過 chunking 演算法大幅減少儲存空間。
- **Garbage collection**：可以自動清理過期的 cache entry。
- **多種 storage backend**：支援本地檔案系統、S3、以及其他 S3-compatible 儲存服務。
- **存取控制**：支援 token-based authentication。

#### 安裝 Attic Server

```nix
# /etc/nixos/configuration.nix
{
  services.atticd = {
    enable = true;

    credentialsFile = "/var/secrets/attic-env";

    settings = {
      listen = "[::]:8080";

      # 使用 PostgreSQL 作為 metadata storage
      database.url = "postgresql:///atticd?host=/run/postgresql";

      storage = {
        type = "local";
        path = "/var/lib/atticd/storage";
      };

      # Chunking 設定
      chunking = {
        nar-size-threshold = 65536;  # 大於 64 KiB 的 NAR 才做 chunking
        min-size = 16384;            # 16 KiB
        avg-size = 65536;            # 64 KiB
        max-size = 262144;           # 256 KiB
      };

      # Garbage collection
      garbage-collection = {
        interval = "24 hours";
        default-retention-period = "30 days";
      };
    };
  };
}
```

#### 使用 Attic Client

```bash
# 設定 Attic server 連線
attic login my-server https://attic.your-domain.com <your-token>

# 建立一個 cache
attic cache create my-server:main

# 推送 build output
attic push my-server:main ./result

# 自動監控並推送（類似 cachix watch-exec）
attic watch-store my-server:main
```

### 方法比較

| 特性 | Cachix | nix-serve | Attic |
|------|--------|-----------|-------|
| 託管方式 | SaaS | 自建 | 自建 |
| 設定難度 | 最簡單 | 簡單 | 中等 |
| 多 cache 支援 | ✅ | ❌ | ✅ |
| Deduplication | ✅ | ❌ | ✅ |
| Garbage collection | ✅ | ❌ | ✅ |
| Storage backend | 自家 | 本地 | 本地 / S3 |
| 存取控制 | ✅ | ❌ | ✅ |
| 適合場景 | 個人 / 小團隊 | 內部測試 | 中大型團隊 |

---

## 實用技巧與除錯

### 確認 Cache Hit 狀態

想知道某個 derivation 是否在 cache 裡？

```bash
# 檢查特定 store path 是否存在於 cache
nix path-info --store https://my-team.cachix.org \
  /nix/store/abc123...-hello-2.12

# 列出某個 derivation 的所有依賴，並標示哪些需要建構
nix build .#my-package --dry-run 2>&1
```

`--dry-run` 會告訴你哪些 path 會從 cache 下載（`will be fetched`），哪些需要本地建構（`will be built`）。這在除錯 cache 問題時非常好用。

### 強制使用 / 忽略 Cache

```bash
# 忽略所有 substituter，強制本地建構
nix build .#my-package --option substituters ""

# 只使用特定的 cache
nix build .#my-package \
  --option substituters "https://my-team.cachix.org" \
  --option trusted-public-keys "my-team.cachix.org-1:xYzAbC..."
```

### 常見問題排查

**Q: 我確定 cache 裡有，但 Nix 還是在編譯？**

最常見的原因：

1. **Hash 不一致**：任何 input 的差異（不同的 nixpkgs commit、不同的 overlay、不同的 system architecture）都會導致不同的 hash。確認兩邊使用完全相同的 `flake.lock`。
2. **Public key 不匹配**：如果 trusted-public-keys 設定不正確，Nix 會拒絕使用 cache。
3. **User 不是 trusted user**：在 multi-user Nix 環境中，只有 trusted user 可以新增 substituter。

```nix
# 把你的使用者加入 trusted users
{
  nix.settings.trusted-users = [ "root" "@wheel" "your-username" ];
}
```

---

## 小結

今天我們學會了：

- **Binary Cache 的原理**：利用 Nix 的 content-addressable 特性，直接下載已編譯好的 store path，避免重複建構。
- **Cachix 的使用**：從註冊、建立 cache、到推送和拉取，以及與 CI/CD 的整合。
- **自建 Cache**：`nix-serve` 適合快速上手，Attic 則提供了企業級的功能。
- **除錯技巧**：透過 `--dry-run`、`nix path-info` 來確認 cache 狀態。

Binary Cache 是讓 Nix 生態系真正實用的關鍵基礎建設。沒有它，Nix 的 reproducibility 雖然美好，但每次建構的等待時間會讓人卻步。有了它，你既能享受可重現的建構流程，又不必犧牲開發者體驗。

> 📅 **明日預告**：Day 29 我們將進入「貢獻 Nixpkgs」的主題——學習如何向 nixpkgs 提交 PR，把你打包好的套件回饋給整個 Nix 社群。
