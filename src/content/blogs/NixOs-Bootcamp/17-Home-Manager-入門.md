---
title: "Day 17：Home Manager 入門 — 用 Nix 宣告式管理你的 Dotfiles"
datetime: "2026-03-31"
description: "安裝 Home Manager 並學會用宣告式設定取代手動管理 dotfiles，統一管理使用者層級的開發環境。"
parent: "NixOs Bootcamp"
---

# Day 17：Home Manager 入門 — 用 Nix 宣告式管理你的 Dotfiles

> 📘 系列：NixOS 30 天學習之旅
> 📂 階段：第三階段 — Flakes 與 Home Manager（Day 15 – Day 21）
> 🎯 今日目標：安裝 Home Manager，學會用宣告式設定取代手動管理 dotfiles

---

## 前言：Dotfiles 管理的痛點

身為開發者，你的 dotfiles 就是你的「數位工作環境」。`.bashrc`、`.vimrc`、`.gitconfig`——這些散落在 `$HOME` 底下的小檔案，默默決定了你每天的操作體驗。

但管理它們向來是一件苦差事：

- **散落四處**：每個工具有自己的 config 路徑（`~/.config/git/config`、`~/.ssh/config`、`~/.tmux.conf`），毫無一致性可言。
- **手動同步**：換一台電腦，就得手動複製、貼上、修改——稍有遺漏就是滿滿的 debug 時間。
- **版本管理困難**：把 dotfiles 放進 Git repo 再用 symlink 串接？可以，但 symlink 管理本身就很脆弱，一不小心就斷了。
- **環境不可重現**：即使有 dotfiles repo，你也很難保證「安裝了哪些套件」和「對應的設定」是同步的。

傳統做法不外乎 `stow`、`chezmoi` 或自己寫 shell script。它們能解決部分問題，但始終缺少一個核心能力：**宣告式地描述整個使用者環境**。

這就是 Home Manager 登場的時候了。

### Home Manager 在不同環境中的角色

在我們的學習旅程中，會用到兩種截然不同的環境，Home Manager 在這兩者中扮演的角色也不同：

| 環境 | 系統管理工具 | Home Manager 角色 | 主要管理內容 |
|------|-------------|-------------------|-------------|
| **MacBook（本地）** | nix-darwin | 透過 standalone 或 nix-darwin module 管理使用者層級的 dotfiles 和工具 | shell、editor、Git、開發工具、GUI 應用程式設定 |
| **NixOS Server（遠端）** | NixOS | 透過 NixOS module 模式整合，與系統設定一起管理 | CLI 工具（vim、tmux、zsh）、伺服器上的使用者環境 |

簡單來說：

- **MacBook** 上，nix-darwin 負責系統層級的設定（如 Homebrew casks、系統偏好設定），Home Manager 則專注於**使用者層級**——你的 shell、editor、dotfiles 通通交給它。
- **NixOS Server** 上，Home Manager 作為 NixOS module 嵌入系統設定，讓你在 `nixos-rebuild switch` 時一併套用使用者環境，特別適合管理純 CLI 的伺服器工作環境。

不管是哪種環境，`home.nix` 的寫法幾乎完全相同——這正是 Home Manager 跨平台的優勢。

---

## Home Manager 是什麼？

[Home Manager](https://github.com/nix-community/home-manager) 是 Nix 生態系中專門管理**使用者層級設定**的工具。它讓你用 Nix 語言寫一份 `home.nix`，宣告式地描述：

- 你要安裝哪些使用者套件（`home.packages`）
- 你的 shell、editor、Git 等工具要怎麼設定（`programs.*`）
- 你的 dotfiles 內容長什麼樣（`home.file`）

然後只要一個指令 `home-manager switch`，Home Manager 就會：

1. 根據宣告安裝所需套件
2. 產生對應的 config 檔案
3. 用 symlink 精準地放到正確位置

**重點在於：你不再手動編輯 dotfiles，而是編輯 Nix 設定檔，讓 Home Manager 幫你產生一切。**

它可以獨立使用（standalone mode），也可以當作 NixOS 的 module 整合進系統設定。兩種方式各有適合的場景，接下來我們會說明。

---

## 安裝 Home Manager

Home Manager 有三種安裝模式，選擇取決於你的使用情境：

| 模式 | 適合場景 | 設定位置 |
|------|---------|---------|
| **Standalone** | macOS 上獨立使用，或尚未整合 nix-darwin | `~/.config/home-manager/home.nix` |
| **nix-darwin Module** | macOS 上已使用 nix-darwin，想統一管理系統與使用者設定 | `flake.nix` 內（nix-darwin module） |
| **NixOS Module** | NixOS server，想把使用者設定和系統設定整合在一起 | `flake.nix` 內（NixOS module） |

### Standalone 安裝（macOS 使用者的起點）

Standalone 模式是 MacBook 使用者最快上手的方式——不需要 nix-darwin，只要有 Nix 就能用。由於我們在 Day 15 已經啟用了 Flakes，這裡直接用 Flakes 方式安裝：

```bash
# 初始化 Home Manager（使用與你的 nixpkgs 相同的 release）
nix run home-manager/release-24.11 -- init
```

這會在 `~/.config/home-manager/` 底下產生初始的 `flake.nix` 和 `home.nix`。

如果你偏好手動設定，也可以自己建立：

```bash
mkdir -p ~/.config/home-manager
```

> 💡 **macOS 注意事項**：在 macOS 上，`home.homeDirectory` 要設為 `/Users/你的使用者名稱`（不是 `/home/`），例如：
>
> ```nix
> home.homeDirectory = "/Users/james";
> ```

#### Standalone 模式的特點

- **獨立運作**：`home-manager switch` 即可套用，不依賴任何系統管理工具。
- **跨平台**：同一份 `home.nix` 稍作調整就能在 macOS 和 Linux 上共用。
- **適合入門**：先用 standalone 熟悉 Home Manager，之後再整合進 nix-darwin 也很容易。

### nix-darwin + Home Manager 整合（macOS 推薦方式）

如果你的 MacBook 已經在使用 nix-darwin 管理系統設定，更推薦將 Home Manager 作為 nix-darwin 的 module 來使用。這樣只需一個 `darwin-rebuild switch` 就能同時套用系統與使用者設定。

```nix
# flake.nix（macOS + nix-darwin + Home Manager）
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-24.11-darwin";

    darwin = {
      url = "github:LnL7/nix-darwin/nix-darwin-24.11";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    home-manager = {
      url = "github:nix-community/home-manager/release-24.11";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { nixpkgs, darwin, home-manager, ... }: {
    darwinConfigurations.my-macbook = darwin.lib.darwinSystem {
      system = "aarch64-darwin";  # Apple Silicon；Intel 用 "x86_64-darwin"
      modules = [
        ./darwin-configuration.nix
        home-manager.darwinModules.home-manager
        {
          home-manager.useGlobalPkgs = true;
          home-manager.useUserPackages = true;
          home-manager.users.james = import ./home.nix;
        }
      ];
    };
  };
}
```

套用方式：

```bash
darwin-rebuild switch --flake .
```

> 💡 注意：nix-darwin 使用 `home-manager.darwinModules.home-manager`，而非 NixOS 的 `nixosModules`。這是常見的混淆點。

### NixOS Module 模式（遠端 Server 推薦方式）

在遠端 NixOS server 上，Home Manager 作為 NixOS module 整合進系統設定是最自然的方式。你的使用者環境會跟著 `nixos-rebuild switch` 一起套用，不需要額外執行 `home-manager switch`。

```nix
# flake.nix（NixOS Server + Home Manager）
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";

    home-manager = {
      url = "github:nix-community/home-manager/release-24.11";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { nixpkgs, home-manager, ... }: {
    nixosConfigurations.my-server = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      modules = [
        ./configuration.nix
        home-manager.nixosModules.home-manager
        {
          home-manager.useGlobalPkgs = true;
          home-manager.useUserPackages = true;
          home-manager.users.james = import ./home.nix;
        }
      ];
    };
  };
}
```

> 💡 `inputs.nixpkgs.follows = "nixpkgs"` 這行很重要——它確保 Home Manager 使用跟你系統同一份 nixpkgs，避免重複下載或版本衝突。

本文後續範例以 **Standalone 模式** 為主，概念完全通用於 nix-darwin module 和 NixOS module 模式。

---

## 基本配置結構：home.nix

不管哪種安裝模式，核心都是一份 `home.nix`。來看最基本的結構：

```nix
# ~/.config/home-manager/home.nix
{ config, pkgs, ... }:

{
  # 你的使用者名稱與家目錄
  home.username = "james";
  home.homeDirectory = "/home/james";

  # Home Manager 版本（與你安裝的 release 對應）
  home.stateVersion = "24.11";

  # 讓 Home Manager 管理自己
  programs.home-manager.enable = true;

  # 使用者層級的套件
  home.packages = with pkgs; [
    ripgrep
    fd
    jq
    htop
    tree
  ];
}
```

幾個關鍵欄位：

- **`home.username` / `home.homeDirectory`**：告訴 Home Manager 你是誰、家目錄在哪。
- **`home.stateVersion`**：跟 NixOS 的 `system.stateVersion` 類似，設定後**不要隨意更改**，它影響 migration 邏輯。
- **`home.packages`**：安裝使用者層級的套件，跟 `nix profile install` 類似，但由設定檔統一管理。
- **`programs.home-manager.enable`**：讓 Home Manager 把自己也納入管理，方便後續升級。

---

## 管理 Dotfiles：.bashrc 與 .gitconfig

Home Manager 提供兩種管理 dotfiles 的方式：**低階的 `home.file`** 和**高階的 `programs.*`**。先來看低階方式。

### 方法一：home.file — 直接管理檔案內容

`home.file` 讓你宣告「哪個路徑要放什麼內容」：

```nix
{
  # 直接寫入內容
  home.file.".bashrc".text = ''
    # 基本 Bash 設定
    export EDITOR="vim"
    export LANG="en_US.UTF-8"

    # Aliases
    alias ll='ls -alF'
    alias gs='git status'
    alias gd='git diff'

    # Prompt
    PS1='\[\033[01;32m\]\u@\h\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]\$ '
  '';

  # 從現有檔案複製
  home.file.".vimrc".source = ./dotfiles/vimrc;

  # 管理整個目錄
  home.file.".config/tmux".source = ./dotfiles/tmux;
  home.file.".config/tmux".recursive = true;
}
```

這種方式的好處是**完全掌控內容**，適合沒有對應 `programs.*` module 的工具。但缺點是你得自己處理完整的 config 語法。

### 方法二：programs.* — 結構化的高階設定

Home Manager 為上百個常用工具提供了 `programs.*` module，讓你用 Nix attribute set 來設定，而不用記住每個工具的 config 語法：

```nix
{
  # Git 設定 — 不用手寫 .gitconfig
  programs.git = {
    enable = true;
    userName = "James Hsueh";
    userEmail = "james@example.com";

    extraConfig = {
      init.defaultBranch = "main";
      pull.rebase = true;
      push.autoSetupRemote = true;
      core.editor = "vim";
    };

    # Git aliases
    aliases = {
      co = "checkout";
      br = "branch";
      ci = "commit";
      st = "status";
      lg = "log --oneline --graph --decorate";
    };

    # 啟用 delta 作為 diff 工具
    delta = {
      enable = true;
      options = {
        navigate = true;
        side-by-side = true;
      };
    };
  };
}
```

Home Manager 會根據這些 Nix 設定，自動幫你產生正確的 `.gitconfig` 檔案。你不用記住 Git config 的 INI 語法，也不用擔心格式錯誤。

---

## programs.* 選項介紹

`programs.*` 是 Home Manager 最強大的功能之一。它涵蓋了大量常見工具的結構化設定。以下是幾個實用範例：

### Bash

```nix
{
  programs.bash = {
    enable = true;

    shellAliases = {
      ll = "ls -alF";
      ".." = "cd ..";
      "..." = "cd ../..";
      gs = "git status";
      gp = "git push";
    };

    # 加入 .bashrc 的額外內容
    initExtra = ''
      export EDITOR="vim"
      export PATH="$HOME/.local/bin:$PATH"

      # 啟用 direnv hook
      eval "$(direnv hook bash)"
    '';

    # .bash_profile 的額外內容
    profileExtra = ''
      # 登入時執行
    '';
  };
}
```

### Vim / Neovim

```nix
{
  programs.vim = {
    enable = true;
    defaultEditor = true;  # 設定 $EDITOR

    settings = {
      number = true;         # 顯示行號
      relativenumber = true; # 相對行號
      expandtab = true;      # 用空格取代 tab
      shiftwidth = 2;
      tabstop = 2;
    };

    extraConfig = ''
      " 搜尋設定
      set ignorecase
      set smartcase
      set incsearch
      set hlsearch

      " 外觀
      syntax on
      set cursorline
      colorscheme desert
    '';

    plugins = with pkgs.vimPlugins; [
      vim-nix
      vim-fugitive
      fzf-vim
    ];
  };
}
```

### Starship（跨 shell 的 prompt）

```nix
{
  programs.starship = {
    enable = true;
    enableBashIntegration = true;

    settings = {
      add_newline = true;

      character = {
        success_symbol = "[➜](bold green)";
        error_symbol = "[✗](bold red)";
      };

      git_branch = {
        symbol = "🌱 ";
        style = "bold purple";
      };

      nix_shell = {
        symbol = "❄️ ";
        format = "via [$symbol$state]($style) ";
      };
    };
  };
}
```

### 其他推薦的 programs.*

| Module | 說明 |
|--------|------|
| `programs.tmux` | Terminal multiplexer 設定 |
| `programs.fzf` | Fuzzy finder，含 shell integration |
| `programs.direnv` | 自動載入 `.envrc` |
| `programs.ssh` | SSH config 管理 |
| `programs.zsh` | Zsh 設定，含 oh-my-zsh 整合 |
| `programs.neovim` | Neovim 設定，含 plugin 管理 |
| `programs.bat` | `cat` 的現代替代品，支援 syntax highlighting |

> 🔍 想知道有哪些可用的 `programs.*`？可以查閱 [Home Manager 選項搜尋](https://home-manager-options.extranix.com/)，或是在 terminal 執行：
>
> ```bash
> man home-configuration.nix
> ```

---

## 完整範例：MacBook（Standalone 模式）

讓我們把以上的設定整合成一份完整的 `home.nix`，適用於 MacBook 上的 standalone 或 nix-darwin module 模式：

```nix
# ~/.config/home-manager/home.nix（macOS）
{ config, pkgs, ... }:

{
  home.username = "james";
  home.homeDirectory = "/Users/james";  # macOS 用 /Users/
  home.stateVersion = "24.11";

  programs.home-manager.enable = true;

  # ── 使用者套件 ──────────────────────────────
  home.packages = with pkgs; [
    ripgrep
    fd
    jq
    htop
    tree
    curl
    wget
    bat        # cat 的替代品，支援 syntax highlighting
    eza        # ls 的現代替代品
  ];

  # ── Shell ────────────────────────────────────
  programs.bash = {
    enable = true;
    shellAliases = {
      ll = "eza -alh --git";
      cat = "bat";
      gs = "git status";
      gd = "git diff";
    };
    initExtra = ''
      export EDITOR="vim"
    '';
  };

  # ── Git ──────────────────────────────────────
  programs.git = {
    enable = true;
    userName = "James Hsueh";
    userEmail = "james@example.com";
    delta.enable = true;
    extraConfig = {
      init.defaultBranch = "main";
      pull.rebase = true;
    };
    aliases = {
      co = "checkout";
      st = "status";
      lg = "log --oneline --graph --decorate";
    };
  };

  # ── Editor ───────────────────────────────────
  programs.vim = {
    enable = true;
    defaultEditor = true;
    settings = {
      number = true;
      expandtab = true;
      shiftwidth = 2;
    };
    plugins = with pkgs.vimPlugins; [
      vim-nix
    ];
  };

  # ── Prompt ───────────────────────────────────
  programs.starship = {
    enable = true;
    enableBashIntegration = true;
    settings.nix_shell.symbol = "❄️ ";
  };

  # ── 其他工具 ─────────────────────────────────
  programs.fzf = {
    enable = true;
    enableBashIntegration = true;
  };

  programs.direnv = {
    enable = true;
    enableBashIntegration = true;
    nix-direnv.enable = true;  # 搭配 Nix devShell 使用
  };
}
```

---

## 遠端 NixOS Server 的使用情境

在遠端 server 上，你的需求和 MacBook 很不一樣——沒有 GUI、沒有桌面環境，你需要的是一個**高效的 CLI 工作環境**。Home Manager 在這裡的角色是管理 vim、tmux、zsh 等 CLI 工具的設定。

### Server 專用的 home.nix 範例

```nix
# home.nix（NixOS Server — 純 CLI 環境）
{ config, pkgs, ... }:

{
  home.username = "james";
  home.homeDirectory = "/home/james";  # Linux 用 /home/
  home.stateVersion = "24.11";

  programs.home-manager.enable = true;

  # ── Server 上常用的 CLI 工具 ──────────────────
  home.packages = with pkgs; [
    ripgrep
    fd
    jq
    htop
    tree
    curl
    wget
    bat
    eza
    unzip
    ncdu       # 磁碟用量分析
  ];

  # ── Zsh（Server 上偏好 Zsh）────────────────
  programs.zsh = {
    enable = true;
    enableCompletion = true;
    autosuggestion.enable = true;
    syntaxHighlighting.enable = true;

    shellAliases = {
      ll = "eza -alh --git";
      cat = "bat";
      gs = "git status";
    };

    initExtra = ''
      export EDITOR="vim"
    '';
  };

  # ── Tmux（Server 必備）──────────────────────
  programs.tmux = {
    enable = true;
    clock24 = true;
    baseIndex = 1;       # 視窗編號從 1 開始
    escapeTime = 0;      # 消除 Esc 延遲
    terminal = "screen-256color";

    extraConfig = ''
      # 使用 Ctrl-a 作為 prefix（取代 Ctrl-b）
      unbind C-b
      set -g prefix C-a
      bind C-a send-prefix

      # 更直覺的分割視窗快捷鍵
      bind | split-window -h
      bind - split-window -v

      # 啟用滑鼠支援
      set -g mouse on
    '';
  };

  # ── Vim ──────────────────────────────────────
  programs.vim = {
    enable = true;
    defaultEditor = true;
    settings = {
      number = true;
      expandtab = true;
      shiftwidth = 2;
    };
    plugins = with pkgs.vimPlugins; [
      vim-nix
      vim-fugitive
    ];
  };

  # ── Git ──────────────────────────────────────
  programs.git = {
    enable = true;
    userName = "James Hsueh";
    userEmail = "james@example.com";
    extraConfig = {
      init.defaultBranch = "main";
      pull.rebase = true;
    };
  };

  # ── SSH ──────────────────────────────────────
  programs.ssh = {
    enable = true;
    matchBlocks = {
      "github.com" = {
        hostname = "github.com";
        user = "git";
        identityFile = "~/.ssh/id_ed25519";
      };
    };
  };

  # ── Starship Prompt ──────────────────────────
  programs.starship = {
    enable = true;
    enableZshIntegration = true;
    settings.nix_shell.symbol = "❄️ ";
  };
}
```

> 💡 **MacBook vs Server 的差異重點**：
>
> - `home.homeDirectory`：macOS 是 `/Users/james`，Linux 是 `/home/james`
> - Server 上通常用 Zsh + Tmux 的組合，MacBook 則視個人偏好
> - Server 不需要 GUI 相關設定（如 terminal emulator、桌面通知等）
> - 套用方式不同：Server 用 `sudo nixos-rebuild switch`，MacBook standalone 用 `home-manager switch`

---

## 第一次 home-manager switch

設定寫好了，是時候讓它生效。套用方式取決於你的安裝模式：

### Standalone 模式（MacBook）

```bash
# 套用設定
home-manager switch

# 如果你是用 flake 初始化的
home-manager switch --flake ~/.config/home-manager
```

### nix-darwin Module 模式（MacBook）

```bash
# 系統與使用者設定一起套用
darwin-rebuild switch --flake .
```

### NixOS Module 模式（遠端 Server）

```bash
sudo nixos-rebuild switch --flake .
```

不管哪種模式，第一次執行時，Home Manager 都會：

1. 解析你的 `home.nix`
2. 從 Nix store 下載 / 建構所需套件
3. 產生 config 檔案並建立 symlink

```
Starting Home Manager activation
Activating checkFilesChanged
Activating checkLinkTargets
Activating writeBoundary
Activating installPackages
Installing 12 packages...
Activating linkGeneration
Creating profile generation 1
Activating onFilesChange
```

### 驗證結果

套用完成後，來確認一切正常：

```bash
# 確認套件已安裝
which ripgrep   # 或 which rg
which bat
which eza

# 確認 Git 設定
git config --global user.name
git config --global init.defaultBranch

# 看看 Home Manager 產生的 symlink
ls -la ~/.bashrc
# lrwxr-xr-x  1 james  staff  ... .bashrc -> /nix/store/xxxx-home-manager-files/.bashrc

ls -la ~/.gitconfig
# lrwxr-xr-x  1 james  staff  ... .gitconfig -> /nix/store/xxxx-home-manager-files/.gitconfig

# 列出目前的 Home Manager generation
home-manager generations
```

注意到了嗎？你的 `.bashrc` 和 `.gitconfig` 現在都是指向 Nix store 的 symlink。這代表它們是**由 Home Manager 產生的**，具備完整的可追溯性與可重現性。

### 如果出了問題？

Home Manager 支援 rollback，就像 NixOS 一樣：

```bash
# 列出歷史 generation
home-manager generations

# 回滾到特定 generation
home-manager activate /nix/store/xxxxx-home-manager-generation
```

---

## 常見問題與注意事項

### 現有 dotfiles 衝突

如果你的家目錄已經有 `.bashrc` 或 `.gitconfig`，Home Manager 會拒絕覆蓋：

```
Existing file '/home/james/.bashrc' is in the way of
'/nix/store/xxxx-home-manager-files/.bashrc'
```

解法：先備份再移除現有檔案。

```bash
mv ~/.bashrc ~/.bashrc.bak
mv ~/.gitconfig ~/.gitconfig.bak
home-manager switch
```

### home.file vs programs.* 怎麼選？

- 如果工具有對應的 `programs.*` module → **優先使用 `programs.*`**，因為它提供型別檢查、預設值、與其他 module 的整合。
- 如果沒有對應 module → 使用 `home.file` 直接管理。
- 兩者可以混用，不衝突。

### 查詢可用選項

```bash
# 搜尋特定 program 的選項
man home-configuration.nix | grep -A 5 "programs.git"

# 或使用線上文件
# https://home-manager-options.extranix.com/
```

---

## 小結

今天我們學會了：

| 概念 | 說明 |
|------|------|
| Home Manager | Nix 生態系的使用者環境管理工具，跨 macOS 與 Linux |
| Standalone 模式 | MacBook 上獨立使用，`home-manager switch` 套用 |
| nix-darwin Module | MacBook 上與 nix-darwin 整合，`darwin-rebuild switch` 一併套用 |
| NixOS Module | 遠端 Server 上與 NixOS 整合，`nixos-rebuild switch` 一併套用 |
| `home.nix` | 宣告式描述使用者環境的設定檔 |
| `home.packages` | 安裝使用者層級套件 |
| `home.file` | 低階方式管理 dotfiles 內容 |
| `programs.*` | 高階結構化設定，涵蓋上百個工具 |

從今天開始，你的 dotfiles 不再是散落各處的「手工藝品」，而是由 Nix 統一管理的**宣告式設定**。不管是你的 MacBook、遠端 NixOS server，還是一台全新的機器，都能透過 Home Manager 重現完全一致的使用者環境。

---

## 明日預告

> **Day 18：Home Manager 進階**
>
> 明天我們會深入 Home Manager 的進階用法，學習如何在 `flake.nix` 中管理多台機器的使用者設定，並搭配 `inputs` 鎖定版本，打造真正可重現的個人環境。

---

📌 *這是 NixOS 30 天學習之旅的第 17 天。如果這篇文章對你有幫助，歡迎分享給同樣在摸索 Nix 的朋友！*
