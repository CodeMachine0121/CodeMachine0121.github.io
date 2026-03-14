---
title: "Day 22：Secret 管理 — 用 sops-nix 和 agenix 守護你的密碼與 API Key"
datetime: "2026-04-05"
description: "介紹 NixOS 中兩大主流密鑰管理方案 sops-nix 與 agenix，解決將密碼和 API Key 安全存放於 Git repository 的實務需求。"
parent: "NixOs Bootcamp"
---

# Day 22：Secret 管理 — 用 sops-nix 和 agenix 守護你的密碼與 API Key

> 🗓 系列：NixOS 30 天學習之旅  
> 📦 階段：第四階段 — 工程師進階實務（Day 22 – Day 30）  
> 🎯 階段核心目標：佈署、自動化、安全性與貢獻

---

## 前言：進入第四階段，從「會用」到「用得安全」

恭喜你走到第四階段！前三個階段我們一路從基礎觀念、日常操作，走到了開發環境的建構。到了這裡，你已經能自在地撰寫 `configuration.nix`、用 Flakes 管理專案、甚至用 Home Manager 打造個人化的開發環境。

但有一件事，你可能一直在逃避——**密碼和 API Key 該放哪裡？**

也許你曾經偷偷把資料庫密碼寫在 `.nix` 檔案裡，心想「反正這是 private repo，應該沒關係吧？」又或者你把 API Key 硬編碼在 service 設定中，每次 commit 都心虛地看一眼。

今天，我們要正面解決這個問題。我們會介紹兩個 NixOS 社群中最主流的 secret management 方案：**sops-nix** 和 **agenix**，讓你安心地把密碼和機密資料放進 Git repository，而且完全不會外洩。

---

## 為什麼 Nix Store 不適合放密碼？

在深入工具之前，先搞清楚一個根本問題：**為什麼不能直接把密碼寫在 `.nix` 檔案裡？**

### 原因一：Nix Store 是全世界都看得到的

`/nix/store` 的所有內容預設權限是 `444`（world-readable）。這代表系統上的**任何使用者**都能讀取裡面的檔案。

```bash
# 隨便找一個 store path 看看權限
ls -la /nix/store/abc123...-some-config
# -r--r--r-- 1 root root ...
```

你的 `configuration.nix` 經過 evaluation 之後，所有的值都會被寫入 `/nix/store` 中的衍生檔案。如果你把密碼直接寫在 Nix expression 裡面，它就會以明文形式出現在 store 中，任何有 shell 存取權限的使用者都能看到。

### 原因二：Nix Store 的內容不會被刪除

還記得 Day 1 提到的 immutability 嗎？`/nix/store` 中的檔案一旦寫入就不會被修改或刪除（除非手動跑 garbage collection）。就算你後來把密碼從 `.nix` 中移除了，舊的 store path 裡可能還保留著那個含有密碼的檔案。

### 原因三：你的 `.nix` 檔案在 Git 裡

NixOS 最大的優勢之一就是把系統配置放進 Git 做版本控管。但如果密碼也跟著 commit 進去，那就是一場災難：

```bash
# 就算你之後刪掉密碼，Git 歷史裡面還找得到
git log -p --all -S 'my-secret-password'
```

Git 的歷史是永久的。一旦 secret 進了 history，要清除它就非常痛苦（`git filter-branch` 或 `BFG Repo-Cleaner`）。

### 那該怎麼辦？

我們需要的是一套機制，能夠：

1. **加密** — secret 在 Git repository 中以密文形式存在
2. **解密** — 在 NixOS rebuild 或 service 啟動時，自動解密成明文供系統使用
3. **權限控管** — 解密後的明文檔案只有特定 user/group 能存取，而且不放在 `/nix/store`

這就是 sops-nix 和 agenix 做的事。

---

## sops-nix 介紹與設定

### 什麼是 SOPS？

[SOPS（Secrets OPerationS）](https://github.com/getsops/sops) 是 Mozilla 開發的開源加密工具。它的特色是**只加密 value，不加密 key**，所以你可以直接看到一份被加密過的 YAML/JSON 檔案的結構，但看不到實際的值：

```yaml
# secrets/db.yaml（加密後的樣子）
database:
  password: ENC[AES256_GCM,data:abc123...,iv:xyz...,tag:...,type:str]
  host: ENC[AES256_GCM,data:def456...,iv:uvw...,tag:...,type:str]
api_key: ENC[AES256_GCM,data:ghi789...,iv:rst...,tag:...,type:str]
```

你能看到「有一個 `database.password`」和「有一個 `api_key`」，但它們的實際值是加密的。這讓 code review 和 diff 變得容易許多。

SOPS 支援多種加密後端：**age**、**PGP**、**AWS KMS**、**GCP KMS**、**Azure Key Vault**。在 NixOS 的情境中，最推薦使用 **age**，因為它輕量、快速，而且不需要額外的雲端服務。

### sops-nix 是什麼？

[sops-nix](https://github.com/Mic92/sops-nix) 是將 SOPS 整合進 NixOS module 系統的工具。它會在 `nixos-rebuild switch` 的過程中自動解密 secrets，並把明文放到 `/run/secrets/` 目錄下（這是一個 `tmpfs`，重開機就消失），確保 secret 不會出現在 `/nix/store` 裡。

### 設定步驟

#### Step 1：產生 age key pair

```bash
# 安裝 age
nix-shell -p age

# 產生 key pair
age-keygen -o ~/.config/sops/age/keys.txt

# 記下 public key（待會要用）
age-keygen -y ~/.config/sops/age/keys.txt
# 輸出類似：age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p
```

如果你要讓 NixOS 主機解密（例如在 server 上），也需要取得主機的 SSH host key 並轉換成 age public key：

```bash
# 從主機的 SSH host key 轉換
nix-shell -p ssh-to-age --run \
  'cat /etc/ssh/ssh_host_ed25519_key.pub | ssh-to-age'
# 輸出類似：age1rgffpespcyjn0d8jglk7km9kfrfhdyev6camd3rck6pn8y47ze4sug23v3
```

#### Step 2：建立 `.sops.yaml` 配置

在 repository 根目錄建立 `.sops.yaml`，告訴 SOPS 用哪些 key 來加密：

```yaml
# .sops.yaml
keys:
  - &admin age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p
  - &server age1rgffpespcyjn0d8jglk7km9kfrfhdyev6camd3rck6pn8y47ze4sug23v3

creation_rules:
  - path_regex: secrets/[^/]+\.(yaml|json|env|ini)$
    key_groups:
      - age:
          - *admin
          - *server
```

#### Step 3：建立並加密 secret 檔案

```bash
# 建立 secrets 目錄
mkdir -p secrets

# 用 sops 建立加密檔案（會自動開啟 editor）
nix-shell -p sops --run 'sops secrets/example.yaml'
```

在 editor 中輸入你的 secrets：

```yaml
db_password: super-secret-password-123
api_key: sk-abcdef1234567890
smtp_password: mail-pass-456
```

存檔關閉後，SOPS 會自動加密。你可以用 `cat` 確認：

```bash
cat secrets/example.yaml
# 你會看到 value 全部被加密了，但 key 仍是明文
```

#### Step 4：在 Flake 中引入 sops-nix

```nix
# flake.nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    sops-nix = {
      url = "github:Mic92/sops-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, sops-nix, ... }: {
    nixosConfigurations.my-server = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      modules = [
        sops-nix.nixosModules.sops
        ./configuration.nix
      ];
    };
  };
}
```

#### Step 5：在 NixOS 配置中使用 secrets

```nix
# configuration.nix
{ config, pkgs, ... }:

{
  # 指定 sops 的設定
  sops = {
    defaultSopsFile = ./secrets/example.yaml;
    age = {
      # 主機的 SSH key 會自動轉換為 age key 來解密
      sshKeyPaths = [ "/etc/ssh/ssh_host_ed25519_key" ];
      # 也可以指定額外的 age key 路徑
      keyFile = "/var/lib/sops-nix/key.txt";
      generateKey = true;
    };
    secrets = {
      db_password = {
        # 解密後的檔案權限設定
        owner = "postgres";
        group = "postgres";
        mode = "0400";
      };
      api_key = {
        owner = "myapp";
        mode = "0400";
      };
    };
  };

  # 使用解密後的 secret
  services.postgresql = {
    enable = true;
    # 透過 config.sops.secrets 取得解密後的檔案路徑
    # 路徑會是 /run/secrets/db_password
  };
}
```

解密後的 secret 會出現在 `/run/secrets/` 底下：

```bash
ls -la /run/secrets/
# -r-------- 1 postgres postgres 28 Jan 15 10:00 db_password
# -r-------- 1 myapp    root     32 Jan 15 10:00 api_key

cat /run/secrets/db_password
# super-secret-password-123
```

注意：**只有指定的 owner 能讀取**，其他使用者完全看不到內容。

---

## agenix 介紹與設定

### 什麼是 agenix？

[agenix](https://github.com/ryantm/agenix) 是另一個 NixOS secret management 方案，直接使用 **age** 加密工具（不經過 SOPS）。它的設計哲學更貼近 Nix 的風格——用一份 `secrets.nix` 檔案來宣告哪些 secret 給哪些主機解密。

### 設定步驟

#### Step 1：準備 age public key

與 sops-nix 類似，你需要取得主機的 age public key：

```bash
# 從主機的 SSH host key 轉換為 age public key
nix-shell -p ssh-to-age --run \
  'cat /etc/ssh/ssh_host_ed25519_key.pub | ssh-to-age'
```

#### Step 2：建立 `secrets.nix`

在 repository 中建立 `secrets.nix`，宣告每個 secret 檔案可以被哪些 key 解密：

```nix
# secrets.nix
let
  # 管理員的 age public key
  admin = "age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p";
  # server 的 age public key（從 SSH host key 轉換）
  server = "age1rgffpespcyjn0d8jglk7km9kfrfhdyev6camd3rck6pn8y47ze4sug23v3";
  # 所有可以解密的 key
  allKeys = [ admin server ];
in
{
  "secrets/db_password.age".publicKeys = allKeys;
  "secrets/api_key.age".publicKeys = allKeys;
  "secrets/smtp_password.age".publicKeys = allKeys;
}
```

#### Step 3：加密 secret 檔案

```bash
# 進入含有 agenix CLI 的環境
nix-shell -p agenix

# 建立並加密 secret（會開啟 editor，輸入明文密碼後存檔）
agenix -e secrets/db_password.age
agenix -e secrets/api_key.age
```

加密後的 `.age` 檔案可以安全地 commit 進 Git。

#### Step 4：在 Flake 中引入 agenix

```nix
# flake.nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    agenix = {
      url = "github:ryantm/agenix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, agenix, ... }: {
    nixosConfigurations.my-server = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      modules = [
        agenix.nixosModules.default
        ./configuration.nix
      ];
    };
  };
}
```

#### Step 5：在 NixOS 配置中使用 secrets

```nix
# configuration.nix
{ config, pkgs, ... }:

{
  age.secrets = {
    db_password = {
      file = ./secrets/db_password.age;
      owner = "postgres";
      group = "postgres";
      mode = "0400";
    };
    api_key = {
      file = ./secrets/api_key.age;
      owner = "myapp";
      mode = "0400";
    };
  };

  # secret 解密後的路徑：/run/agenix/db_password
  # 可以透過 config.age.secrets.db_password.path 取得
}
```

解密後的 secret 位於 `/run/agenix/` 目錄下：

```bash
ls -la /run/agenix/
# -r-------- 1 postgres postgres 28 Jan 15 10:00 db_password
# -r-------- 1 myapp    root     32 Jan 15 10:00 api_key
```

---

## sops-nix vs agenix 比較

兩個工具都能解決同樣的問題，但各有特色。以下是詳細比較：

| 面向 | sops-nix | agenix |
|------|----------|--------|
| **底層工具** | SOPS（支援 age、PGP、AWS KMS 等） | 純 age |
| **加密格式** | YAML / JSON / ENV / INI（只加密 value） | 單一檔案（整個檔案加密） |
| **可讀性** | ⭐ 高。加密後仍可看到 key 名稱與結構 | 一般。每個 secret 是一個獨立的 `.age` 檔案 |
| **Code review 友善** | ⭐ 較佳。diff 能看出哪個 key 的值被修改 | 一般。`.age` 檔案的 diff 是 binary diff |
| **Key 管理** | 用 `.sops.yaml` 管理 | 用 `secrets.nix` 管理（更 Nix 風格） |
| **多 secret 管理** | 可以把多個 secret 放在同一個 YAML 檔案中 | 每個 secret 一個 `.age` 檔案 |
| **雲端 KMS 支援** | ⭐ 支援 AWS / GCP / Azure KMS | 不支援 |
| **學習曲線** | 稍高（需理解 SOPS 配置） | 較低（概念簡單直觀） |
| **社群活躍度** | 高 | 高 |
| **解密路徑** | `/run/secrets/` | `/run/agenix/` |

### 我該選哪一個？

- **選 sops-nix**：如果你管理大量 secrets、需要雲端 KMS 整合、或是重視 code review 時的可讀性。
- **選 agenix**：如果你偏好簡潔、想要更 Nix-native 的體驗、或是只需要管理少量 secrets。

兩者都是成熟的方案，社群支持度也都很高。選擇哪一個，很大程度取決於你的偏好和使用情境。

---

## 實戰：管理資料庫密碼與 API Key

來看一個完整的實戰範例。假設你有一台 NixOS server，上面跑著 PostgreSQL 和一個自訂的 web application，需要管理以下 secrets：

- PostgreSQL 的 superuser 密碼
- Web application 的 API key
- SMTP 寄信服務的密碼

### 使用 sops-nix 的完整範例

#### 1. 加密檔案

```yaml
# secrets/production.yaml（加密前的明文，存檔後會自動加密）
postgres_password: my-db-password-2024
app_api_key: sk-prod-abcdef1234567890
smtp_password: smtp-secret-456
```

#### 2. NixOS 配置

```nix
# modules/secrets.nix
{ config, ... }:

{
  sops = {
    defaultSopsFile = ../secrets/production.yaml;
    age.sshKeyPaths = [ "/etc/ssh/ssh_host_ed25519_key" ];

    secrets = {
      postgres_password = {
        owner = "postgres";
        group = "postgres";
        mode = "0400";
      };
      app_api_key = {
        owner = "myapp";
        group = "myapp";
        mode = "0400";
      };
      smtp_password = {
        owner = "myapp";
        group = "myapp";
        mode = "0400";
      };
    };
  };
}
```

```nix
# modules/postgresql.nix
{ config, pkgs, ... }:

{
  services.postgresql = {
    enable = true;
    package = pkgs.postgresql_16;
    # 使用解密後的密碼檔案來初始化 superuser 密碼
    initialScript = pkgs.writeText "init-db" ''
      ALTER USER postgres PASSWORD '$(cat ${config.sops.secrets.postgres_password.path})';
    '';
  };
}
```

```nix
# modules/webapp.nix
{ config, pkgs, ... }:

{
  # 建立 application 的 systemd service
  systemd.services.myapp = {
    description = "My Web Application";
    after = [ "network.target" "postgresql.service" ];
    wantedBy = [ "multi-user.target" ];

    serviceConfig = {
      User = "myapp";
      Group = "myapp";
      ExecStart = "${pkgs.myapp}/bin/myapp";

      # 透過環境變數檔案載入 secrets
      # 注意：直接用 EnvironmentFile 或 LoadCredential 比較安全
    };

    # 用 script 包裝，在啟動時讀取 secret 檔案
    script = ''
      export API_KEY=$(cat ${config.sops.secrets.app_api_key.path})
      export SMTP_PASSWORD=$(cat ${config.sops.secrets.smtp_password.path})
      exec ${pkgs.myapp}/bin/myapp
    '';
  };

  users.users.myapp = {
    isSystemUser = true;
    group = "myapp";
  };
  users.groups.myapp = {};
}
```

### 使用 systemd 的 LoadCredential（更安全的做法）

從 systemd 246 開始，可以使用 `LoadCredential` 來傳遞 secrets，這樣連 environment variable 都不需要：

```nix
systemd.services.myapp = {
  serviceConfig = {
    User = "myapp";
    Group = "myapp";
    ExecStart = "${pkgs.myapp}/bin/myapp";
    LoadCredential = [
      "api_key:${config.sops.secrets.app_api_key.path}"
      "smtp_password:${config.sops.secrets.smtp_password.path}"
    ];
  };
};

# 在 application 中，可以從以下路徑讀取 credential：
# $CREDENTIALS_DIRECTORY/api_key
# $CREDENTIALS_DIRECTORY/smtp_password
```

---

## 與 Flakes 整合

在實際專案中，你的 Flake 結構可能長這樣：

```
my-nixos-config/
├── flake.nix
├── flake.lock
├── .sops.yaml               # SOPS 加密規則
├── secrets/
│   ├── production.yaml       # 加密後的 production secrets
│   └── staging.yaml          # 加密後的 staging secrets
├── hosts/
│   ├── web-server/
│   │   └── configuration.nix
│   └── db-server/
│       └── configuration.nix
└── modules/
    ├── secrets.nix
    ├── postgresql.nix
    └── webapp.nix
```

### 完整的 `flake.nix`

```nix
{
  description = "My NixOS Infrastructure";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

    sops-nix = {
      url = "github:Mic92/sops-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    # 如果你選擇 agenix
    # agenix = {
    #   url = "github:ryantm/agenix";
    #   inputs.nixpkgs.follows = "nixpkgs";
    # };
  };

  outputs = { self, nixpkgs, sops-nix, ... }: {
    nixosConfigurations = {
      # Web Server
      web-server = nixpkgs.lib.nixosSystem {
        system = "x86_64-linux";
        modules = [
          sops-nix.nixosModules.sops
          ./hosts/web-server/configuration.nix
          ./modules/secrets.nix
          ./modules/webapp.nix
        ];
      };

      # Database Server
      db-server = nixpkgs.lib.nixosSystem {
        system = "x86_64-linux";
        modules = [
          sops-nix.nixosModules.sops
          ./hosts/db-server/configuration.nix
          ./modules/secrets.nix
          ./modules/postgresql.nix
        ];
      };
    };
  };
}
```

### 為不同環境管理不同的 secrets

你可以透過 `.sops.yaml` 的 `creation_rules` 來區分不同環境的加密規則：

```yaml
# .sops.yaml
keys:
  - &admin age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p
  - &web-server age1abc...
  - &db-server age1def...
  - &staging-server age1ghi...

creation_rules:
  # Production secrets — 只有 admin 和對應的 server 能解密
  - path_regex: secrets/production\.yaml$
    key_groups:
      - age:
          - *admin
          - *web-server
          - *db-server

  # Staging secrets — admin 和 staging server
  - path_regex: secrets/staging\.yaml$
    key_groups:
      - age:
          - *admin
          - *staging-server
```

這樣一來，即使某台 server 被入侵，攻擊者也只能解密**該台 server 有權限存取的 secrets**，不會波及其他環境。

---

## 常見陷阱與最佳實踐

### ⚠️ 別踩的坑

**1. 不要用 `builtins.readFile` 讀 secret**

```nix
# ❌ 千萬不要這樣做！
services.some-app.password = builtins.readFile ./secrets/password.txt;
# 這會把密碼的明文直接寫入 /nix/store！
```

**2. 不要用 Nix string interpolation 組裝 secret**

```nix
# ❌ 這也不行！
environment.etc."app.conf".text = ''
  password = ${builtins.readFile ./secrets/password.txt}
'';
# 同樣會把密碼寫入 /nix/store
```

**3. 注意 secret 路徑是檔案，不是字串值**

sops-nix 和 agenix 提供的是**檔案路徑**，不是 secret 的值本身。你需要在 runtime 讀取這個檔案：

```nix
# ✅ 正確做法：把檔案路徑傳給 service
config.sops.secrets.db_password.path
# 結果是 "/run/secrets/db_password"，而不是密碼本身
```

### ✅ 最佳實踐

1. **一台 server 一組 age key** — 使用 SSH host key 轉換而來的 age key，這樣每台 server 自動有獨立的解密能力。
2. **最小權限原則** — 每個 secret 只授權給需要它的 server 和管理員。
3. **定期 rotate secrets** — 修改 secret 後重新加密：`sops secrets/production.yaml`。
4. **把 `.sops.yaml` 或 `secrets.nix` 也 commit 進 Git** — 這些檔案只包含 public key，不含任何敏感資訊。
5. **用 `systemd` 的 `LoadCredential`** — 比 environment variable 更安全，避免 secret 出現在 `/proc/<pid>/environ` 中。

---

## 小結

今天我們解決了一個在 NixOS 實務中不可迴避的問題——**如何安全地管理 secrets**。

| 重點 | 說明 |
|------|------|
| **Nix Store 不安全** | `/nix/store` 是 world-readable，絕對不能放密碼 |
| **sops-nix** | 基於 SOPS，支援多種加密後端，加密後仍可看到 key 結構 |
| **agenix** | 純 age 加密，概念簡潔，更貼近 Nix 風格 |
| **解密位置** | 兩者都把明文放在 `tmpfs`（`/run/`），不碰 `/nix/store` |
| **最小權限** | 透過 `owner`、`group`、`mode` 控制誰能讀取解密後的檔案 |

Secret management 是從「能用」到「能上線」的關鍵一步。沒有它，你的 NixOS 配置就只能停留在個人實驗階段。有了它，你才能真正放心地把整套系統配置放進 Git，做到 Infrastructure as Code 的理想。

---

## 明日預告

**Day 23：Remote Deployment** — 學會管理 secrets 之後，下一步就是把配置佈署到遠端機器上。我們會介紹如何用 `nixos-rebuild --target-host`、`deploy-rs` 或 `colmena` 等工具，把你的 NixOS 配置安全地推送到遠端 server，實現真正的遠端佈署自動化。

我們明天見！ 🚀

---

📚 **延伸閱讀**
- [sops-nix GitHub Repository](https://github.com/Mic92/sops-nix)
- [agenix GitHub Repository](https://github.com/ryantm/agenix)
- [SOPS — Secrets OPerationS](https://github.com/getsops/sops)
- [age — A simple, modern and secure encryption tool](https://github.com/FiloSottile/age)
- [NixOS Wiki — Comparison of Secret Managing Schemes](https://wiki.nixos.org/wiki/Comparison_of_secret_managing_schemes)
