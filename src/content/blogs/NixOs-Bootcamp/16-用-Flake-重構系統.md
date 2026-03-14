---
title: "Day 16：用 Flake 重構系統 — 從 Channel 遷移到現代化配置"
datetime: "2026-03-30"
description: "實作將傳統 channel-based 的系統配置完整遷移到 flake-based 架構，達成 100% 可重現的系統管理。"
parent: "NixOs Bootcamp"
---

# Day 16：用 Flake 重構系統 — 從 Channel 遷移到現代化配置

> 🗓 系列：NixOS 30 天學習之旅  
> 📦 階段：第三階段 — Flakes 與 Home Manager（Day 15 – Day 21）  
> 🎯 階段核心目標：現代化 Nix 流程（2024 年後的標準做法）

---

## 前言：是時候跟 Channel 說再見了

在 Day 15，我們認識了 Flake 的核心概念：`flake.nix`、`flake.lock`、inputs / outputs 的結構，以及為什麼 Flake 會成為 Nix 生態系的未來。

但光是知道概念還不夠。今天，我們要**真正動手**——把你那份跑在傳統 channel-based 模式下的 `configuration.nix`，完整遷移到 flake-based 的架構。

為什麼要遷移？回顧一下傳統做法的痛點：

- `nix-channel --update` 的結果取決於你「什麼時候」執行，無法 pin 住確切版本。
- 不同機器、不同使用者的 channel 狀態可能不一致，導致「在我這裡能 build」的窘境。
- 沒有 lock file，reproducibility 只是紙上談兵。

Flake 解決了這一切。它用 `flake.lock` 鎖定每一個 input 的確切 revision，讓你的系統配置真正做到 **100% reproducible**。

準備好了嗎？讓我們開始遷移。

---

## 遷移前的準備工作

### 1. 確認 Flake 功能已啟用

Flake 目前仍是 experimental feature（不過已經是社群的事實標準）。確認你的系統有啟用它：

```nix
# /etc/nixos/configuration.nix（遷移前的舊配置）
nix.settings.experimental-features = [ "nix-command" "flakes" ];
```

如果還沒加，先加上去然後 rebuild 一次：

```bash
sudo nixos-rebuild switch
```

### 2. 備份現有配置

養成好習慣，遷移前先備份：

```bash
sudo cp -r /etc/nixos /etc/nixos.bak
```

### 3. 確認目前的 channel 狀態

記下你目前使用的 channel 版本，待會兒需要對應到 Flake 的 input：

```bash
sudo nix-channel --list
# 輸出類似：
# nixos https://nixos.org/channels/nixos-24.11
```

記住這個版本號（例如 `24.11`），等一下建立 `flake.nix` 時會用到。

### 4. 初始化 Git repository

Flake **強制要求**所在目錄是一個 Git repository，且只會讀取被 Git 追蹤的檔案。這是 Flake 確保 reproducibility 的手段之一。

```bash
cd /etc/nixos
sudo git init
sudo git add .
sudo git commit -m "chore: snapshot before flake migration"
```

> 💡 **重要**：如果你的檔案沒有被 `git add`，Flake evaluation 時會直接忽略它們。這是新手最常踩到的第一個坑。

---

## 建立系統級 `flake.nix`

在 `/etc/nixos/` 目錄下建立 `flake.nix`：

```nix
# /etc/nixos/flake.nix
{
  description = "My NixOS System Configuration";

  inputs = {
    # 對應你原本的 channel 版本
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
  };

  outputs = { self, nixpkgs, ... }: {
    nixosConfigurations.my-nixos = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      modules = [
        ./configuration.nix
      ];
    };
  };
}
```

這就是最基本的系統級 Flake。讓我們拆解每一個部分。

### `inputs`：取代 channel 的依賴來源

```nix
inputs = {
  nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
};
```

這一行取代了原本的 `nix-channel`。它明確指向 GitHub 上的 `NixOS/nixpkgs` repository 的 `nixos-24.11` branch。

當你第一次 evaluate 這個 Flake 時，Nix 會自動產生 `flake.lock`，把當下 `nixos-24.11` branch 的最新 commit hash 鎖住。從此以後，不管什麼時候 rebuild，都會使用**同一個 commit** 的 nixpkgs——直到你主動執行 `nix flake update`。

### `outputs`：定義這個 Flake 產出什麼

```nix
outputs = { self, nixpkgs, ... }: {
  nixosConfigurations.my-nixos = nixpkgs.lib.nixosSystem {
    system = "x86_64-linux";
    modules = [
      ./configuration.nix
    ];
  };
};
```

`outputs` 是一個 function，接收所有 `inputs` 作為參數（加上 `self` 代表自己），回傳一個 attribute set。

這裡我們定義了一個 `nixosConfigurations.my-nixos`，這代表一台名為 `my-nixos` 的 NixOS 機器配置。

---

## 將 `configuration.nix` 整合進 Flake

好消息：**你原本的 `configuration.nix` 幾乎不用改**。Flake 架構的優雅之處就在於，它是在原有的 module system 外面包了一層，而不是取代它。

不過，有幾個小地方需要調整。

### 移除 channel 相關的殘留

如果你的 `configuration.nix` 裡有手動設定 `nix.nixPath` 或 `nix.registry`，可以移除或改用 Flake 的方式管理：

```nix
# 舊的 channel-based 寫法（可移除）
# nix.nixPath = [ "nixpkgs=/nix/var/nix/profiles/per-user/root/channels/nixos" ];
```

### 確保 Flake 功能持續啟用

在 `configuration.nix` 中保留這項設定，確保 rebuild 後 Flake 依然可用：

```nix
nix.settings.experimental-features = [ "nix-command" "flakes" ];
```

### 建議：讓 `nixpkgs` 與 `nix-channel` 脫鉤

遷移後，你可以讓系統的 `nixpkgs` 路徑指向 Flake 鎖定的版本，避免 channel 與 Flake 混用造成混亂：

```nix
# /etc/nixos/configuration.nix 中加入
nix.registry.nixpkgs.flake = nixpkgs;

nix.nixPath = [
  "nixpkgs=flake:nixpkgs"
];
```

但等等——這裡的 `nixpkgs` 變數從哪裡來？它是 Flake 的 input，不是 `configuration.nix` 本身能直接存取的。我們需要透過 `specialArgs` 把它傳進去。

### 使用 `specialArgs` 傳遞 Flake inputs

回到 `flake.nix`，更新 `nixosSystem` 的呼叫：

```nix
# /etc/nixos/flake.nix
{
  description = "My NixOS System Configuration";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
  };

  outputs = { self, nixpkgs, ... }: {
    nixosConfigurations.my-nixos = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      specialArgs = { inherit nixpkgs; };
      modules = [
        ./configuration.nix
      ];
    };
  };
}
```

然後在 `configuration.nix` 中接收這個參數：

```nix
# /etc/nixos/configuration.nix
{ config, pkgs, nixpkgs, ... }:

{
  # ... 原有配置 ...

  # 讓 nix 指令使用 Flake 鎖定的 nixpkgs
  nix.registry.nixpkgs.flake = nixpkgs;
}
```

`specialArgs` 的作用是把額外的參數傳進 NixOS module system，讓所有 module（包括 `configuration.nix`）都能存取到 Flake 的 inputs。

---

## `nixosConfigurations` output 詳解

`nixosConfigurations` 是 Flake 專門為 NixOS 系統配置保留的 output 類型。讓我們深入了解它的結構與變化。

### 基本結構

```nix
nixosConfigurations.<hostname> = nixpkgs.lib.nixosSystem {
  system = "<architecture>";
  specialArgs = { ... };
  modules = [ ... ];
};
```

| 參數 | 說明 |
|------|------|
| `<hostname>` | 這台機器的識別名稱，通常與 `networking.hostName` 一致 |
| `system` | 目標架構，如 `x86_64-linux`、`aarch64-linux` |
| `specialArgs` | 傳遞額外參數給所有 module |
| `modules` | NixOS module 清單，就是你的系統配置 |

### 管理多台機器

Flake 最強大的優勢之一，就是可以在同一個 `flake.nix` 中管理多台機器的配置：

```nix
outputs = { self, nixpkgs, ... }: {
  nixosConfigurations = {

    # 你的桌機
    desktop = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      modules = [
        ./hosts/desktop/configuration.nix
        ./hosts/desktop/hardware-configuration.nix
      ];
    };

    # 你的筆電
    laptop = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      modules = [
        ./hosts/laptop/configuration.nix
        ./hosts/laptop/hardware-configuration.nix
      ];
    };

    # 雲端 server（ARM 架構）
    cloud-server = nixpkgs.lib.nixosSystem {
      system = "aarch64-linux";
      modules = [
        ./hosts/cloud-server/configuration.nix
        ./hosts/cloud-server/hardware-configuration.nix
      ];
    };
  };
};
```

每台機器有自己的 hostname 作為 key、自己的 module 清單、甚至可以是不同的 CPU 架構。而它們全都共享同一份 `flake.lock` 鎖定的 nixpkgs 版本——真正的 consistency。

### 抽取共用模組

當你管理多台機器時，一定會有許多重複的設定。把它們抽成獨立的 module：

```nix
modules = [
  ./modules/common.nix          # 共用設定（locale、timezone、基礎套件）
  ./modules/ssh.nix              # SSH 設定
  ./modules/users.nix            # 使用者管理
  ./hosts/desktop/configuration.nix
  ./hosts/desktop/hardware-configuration.nix
];
```

這就是 NixOS module system 的美妙之處——每個 `.nix` 檔案都是一個可組合的模組，Flake 只是在最外層提供了一個乾淨的進入點。

---

## 使用 `nixos-rebuild --flake` 重建系統

一切就緒，來 rebuild 吧！

### 第一步：確保所有檔案都被 Git 追蹤

```bash
cd /etc/nixos
sudo git add flake.nix
sudo git add -A  # 確保所有 .nix 檔案都被追蹤
```

> ⚠️ **再次提醒**：Flake 只會讀取被 `git add` 過的檔案。如果你新增了一個 module 但忘了 `git add`，evaluation 時會得到 `file not found` 的錯誤。

### 第二步：使用 `--flake` 旗標 rebuild

```bash
sudo nixos-rebuild switch --flake /etc/nixos#my-nixos
```

這個指令的結構是：

```
nixos-rebuild switch --flake <flake-path>#<hostname>
```

- `/etc/nixos`：Flake 所在的目錄路徑
- `#my-nixos`：對應 `nixosConfigurations.my-nixos` 的名稱

如果你的 hostname 與 `nixosConfigurations` 中的 key 一致，可以省略 `#<hostname>`：

```bash
# 如果你的 hostname 就是 "my-nixos"，可以簡化為：
sudo nixos-rebuild switch --flake /etc/nixos
```

### 第三步：觀察 `flake.lock` 的產生

第一次 rebuild 成功後，你會發現目錄中多了一個 `flake.lock` 檔案：

```bash
cat /etc/nixos/flake.lock
```

```json
{
  "nodes": {
    "nixpkgs": {
      "locked": {
        "lastModified": 1709312345,
        "narHash": "sha256-abc123...",
        "owner": "NixOS",
        "repo": "nixpkgs",
        "rev": "a1b2c3d4e5f6...",
        "type": "github"
      },
      "original": {
        "owner": "NixOS",
        "ref": "nixos-24.11",
        "repo": "nixpkgs",
        "type": "github"
      }
    },
    ...
  }
}
```

`rev` 欄位就是被鎖定的 commit hash。這個檔案**務必一起 commit 進 Git**：

```bash
sudo git add flake.lock
sudo git commit -m "feat: migrate to flake-based NixOS configuration"
```

### 更新 inputs

當你想升級 nixpkgs（等同於以前的 `nix-channel --update`）：

```bash
# 更新所有 inputs
nix flake update --flake /etc/nixos

# 只更新 nixpkgs
nix flake update nixpkgs --flake /etc/nixos

# 然後 rebuild
sudo nixos-rebuild switch --flake /etc/nixos#my-nixos
```

差別在於，這次的升級是**明確且可追蹤**的——`flake.lock` 的 diff 會清楚告訴你 nixpkgs 從哪個 commit 升到了哪個 commit。

---

## 遷移後的驗證與除錯

### 驗證清單

遷移完成後，逐一確認以下項目：

```bash
# 1. 確認系統正常運行
systemctl --failed          # 檢查是否有 failed service

# 2. 確認套件完整
which git && which vim      # 驗證常用套件

# 3. 確認 Flake 是否正確啟用
nix flake metadata /etc/nixos  # 應該能看到 metadata 輸出

# 4. 確認 generation 有正確建立
sudo nix-env --list-generations -p /nix/var/nix/profiles/system

# 5. 確認 nix 指令走的是 Flake 鎖定的 nixpkgs
nix eval nixpkgs#lib.version  # 應該對應你鎖定的版本
```

### 常見問題與解法

#### 問題一：`error: getting status of '/etc/nixos/flake.nix': No such file or directory`

**原因**：檔案沒有被 `git add`。Flake 會建立一個臨時的 working tree，只包含 Git 追蹤的檔案。

```bash
cd /etc/nixos
sudo git add flake.nix
sudo git add -A
```

#### 問題二：`error: attribute 'my-nixos' missing`

**原因**：`--flake` 指定的 hostname 與 `nixosConfigurations` 中的 key 不一致。

```bash
# 確認你的 hostname
hostname

# 確認 flake.nix 中的 key
grep "nixosConfigurations" /etc/nixos/flake.nix
```

確保兩者一致，或是明確指定 `#<key-name>`。

#### 問題三：`error: undefined variable 'nixpkgs'`（在 `configuration.nix` 中）

**原因**：你在 `configuration.nix` 中引用了 `nixpkgs`，但沒有在 `flake.nix` 的 `specialArgs` 中傳入。

回去檢查 `flake.nix`，確認有加上：

```nix
specialArgs = { inherit nixpkgs; };
```

#### 問題四：遷移後 `nix-shell` 或 `nix search` 行為不同

這是因為舊的 `nix-*` 指令（如 `nix-shell`、`nix-env`）仍然走 channel 路徑，而 Flake 是透過新的 `nix` 指令（如 `nix develop`、`nix search`）來操作。

建議在 `configuration.nix` 中加入以下設定，讓新舊指令的 nixpkgs 來源一致：

```nix
nix.nixPath = [ "nixpkgs=flake:nixpkgs" ];
```

這樣即使用舊指令，也會走 Flake 鎖定的 nixpkgs。

### 清除舊的 channel（可選）

遷移確認穩定後，可以移除不再需要的 channel：

```bash
sudo nix-channel --remove nixos
sudo nix-channel --update
```

> ⚠️ **建議**：先保留 channel 一段時間，等你確定一切運作正常後再移除。畢竟 NixOS 的精神就是可以隨時 rollback，不急。

---

## 遷移前後的對照

讓我們用一張表快速對比遷移前後的差異：

| 面向 | 傳統 Channel-based | Flake-based |
|------|-------------------|-------------|
| 依賴來源 | `nix-channel --add / --update` | `flake.nix` 的 `inputs` |
| 版本鎖定 | ❌ 無（取決於 update 時間） | ✅ `flake.lock` 精確鎖定 commit |
| Rebuild 指令 | `nixos-rebuild switch` | `nixos-rebuild switch --flake .#hostname` |
| 多機器管理 | 每台各自維護 channel 與配置 | 同一個 `flake.nix` 統一管理 |
| Reproducibility | 盡力而為 | 確保完全一致 |
| Git 整合 | 可選 | 強制（Flake 要求 Git repo） |

---

## 完整遷移後的檔案結構

```
/etc/nixos/
├── flake.nix                  # Flake 入口
├── flake.lock                 # 自動產生的 lock file
├── configuration.nix          # 系統主配置（幾乎不用改）
└── hardware-configuration.nix # 硬體配置（安裝時自動產生）
```

隨著你的配置變複雜，可以進化成：

```
/etc/nixos/
├── flake.nix
├── flake.lock
├── hosts/
│   ├── desktop/
│   │   ├── configuration.nix
│   │   └── hardware-configuration.nix
│   └── laptop/
│       ├── configuration.nix
│       └── hardware-configuration.nix
└── modules/
    ├── common.nix
    ├── ssh.nix
    └── users.nix
```

---

## 小結

今天我們完成了一件重要的事：**把系統從傳統的 channel-based 配置遷移到 flake-based 架構**。

回顧一下完成的關鍵步驟：

| 步驟 | 說明 |
|------|------|
| 啟用 Flake | 在 `configuration.nix` 中加入 `experimental-features` |
| 初始化 Git | Flake 強制要求 Git repository |
| 建立 `flake.nix` | 定義 `inputs`（nixpkgs）與 `outputs`（nixosConfigurations） |
| 調整 `configuration.nix` | 移除 channel 殘留、透過 `specialArgs` 接收 Flake inputs |
| 使用 `--flake` rebuild | `nixos-rebuild switch --flake /etc/nixos#hostname` |
| 驗證與除錯 | 確認 service、套件、`flake.lock` 皆正常 |

從這一刻起，你的 NixOS 配置正式進入了 reproducible、version-controlled、可跨機器共享的現代化流程。每一次變更都有 `flake.lock` 的 diff 可以審閱，每一次 rebuild 都能保證一致的結果。

---

## 明日預告

**Day 17：Home Manager 入門 — 用 Nix 管理你的 dotfiles**

系統層級的配置搞定了，但你的 `.bashrc`、`.gitconfig`、`.vimrc` 這些使用者級的設定呢？明天我們會介紹 Home Manager，讓你用同樣的 declarative 方式管理個人環境，並且把它整合進今天建好的 Flake 架構中。

我們明天見！ 🚀

---

📚 **延伸閱讀**
- [NixOS Wiki: Flakes](https://wiki.nixos.org/wiki/Flakes)
- [Nix Reference Manual: Flakes](https://nix.dev/concepts/flakes)
- [nixos-rebuild man page](https://nixos.org/manual/nixos/stable/#sec-changing-config)
- [Zero to Nix: Flakes](https://zero-to-nix.com/concepts/flakes)
