---
title: "Day 18：Home Manager 進階 —— 用 Nix 打造完整開發環境"
datetime: "2026-04-01"
description: "針對 MacBook 與 NixOS Server 兩種環境分別規劃工具鏈，學會共用通用設定並區隔環境差異。"
parent: "NixOs Bootcamp"
---

# Day 18：Home Manager 進階 —— 用 Nix 打造完整開發環境

> 系列：NixOS 30 天學習之旅
> 階段：第三階段 - Flakes 與 Home Manager（Day 15 – Day 21）

## 前言：兩台機器，一套設定哲學

在 Day 17，我們學會了用 Home Manager 管理基本的使用者環境。但真實世界中，開發者通常不只用一台機器——你可能同時擁有：

- 🖥️ **MacBook**：日常開發主力，有 GUI 環境，跑 VSCode、瀏覽器、各種桌面應用
- 🖧 **NixOS Server**：遠端純 CLI 環境，透過 SSH 連線，用 Neovim + tmux 作戰

這兩個環境的需求截然不同，但 Home Manager 的核心理念不變：**把所有開發工具的設定都用 Nix 宣告，讓你的開發環境變成 code。**

今天，我們會針對這兩種情境分別規劃工具鏈，並學會如何共用通用設定、區隔環境差異。

---

## 環境對照表

在開始之前，先釐清哪些工具該裝在哪裡：

| 工具 | 🖥️ MacBook | 🖧 NixOS Server | 說明 |
|------|:----------:|:----------------:|------|
| Zsh + Oh My Zsh | ✅ | ✅ | 兩邊共用，統一 shell 體驗 |
| Starship prompt | ✅ | ✅ | 跨平台 prompt，隨處可用 |
| Git + Delta | ✅ | ✅ | 版控是基本功 |
| GitHub CLI（gh） | ✅ | ✅ | PR / Issue 管理 |
| fzf | ✅ | ✅ | 模糊搜尋萬用刀 |
| bat / eza / zoxide | ✅ | ✅ | 現代 CLI 替代品 |
| ripgrep / fd | ✅ | ✅ | 快速搜尋工具 |
| direnv + nix-direnv | ✅ | ✅ | 專案級環境管理 |
| Neovim（基本） | ✅ | ✅ | 快速編輯用 |
| Neovim（完整 IDE） | ⚪ 選配 | ✅ | Server 主力編輯器 |
| tmux | ⚪ 選配 | ✅ | Server 必備 session 管理 |
| VSCode + extensions | ✅ | ❌ | 僅桌面環境適用 |
| WezTerm / 桌面應用 | ✅ | ❌ | 僅 GUI 環境適用 |
| btop / lazygit | ✅ | ✅ | TUI 監控與 Git |
| htop | ⚪ 選配 | ✅ | Server 監控必備 |

> ✅ = 建議安裝　⚪ = 依需求選配　❌ = 不適用

---

## 一、Zsh 完整配置（🖥️ MacBook ＋ 🖧 Server 通用）

Zsh 設定是兩個環境的共用基礎。不管你在 MacBook 還是 SSH 到 Server，都該有一致的 shell 體驗。

### 基本設定

Home Manager 內建了 `programs.zsh` module，可以直接宣告 Zsh 的所有設定：

```nix
# modules/shell.nix — 兩環境共用
{ config, pkgs, ... }:

{
  programs.zsh = {
    enable = true;
    
    # 自動建議（根據歷史紀錄提示指令）
    autosuggestion.enable = true;
    
    # 語法高亮
    syntaxHighlighting.enable = true;
    
    # 歷史紀錄設定
    history = {
      size = 50000;
      save = 50000;
      ignoreDups = true;        # 忽略重複指令
      ignoreAllDups = true;     # 忽略所有重複
      share = true;             # 跨 session 共享歷史
    };

    # Shell aliases
    shellAliases = {
      ll = "ls -la";
      gs = "git status";
      gd = "git diff";
      gc = "git commit";
      gp = "git push";
      k = "kubectl";
      d = "docker";
      dc = "docker compose";
      cat = "bat";
      find = "fd";
      # Nix 常用指令
      nrs = "sudo nixos-rebuild switch";
      hms = "home-manager switch --flake .";
    };

    # 額外的 Zsh 設定（會寫入 .zshrc）
    initExtra = ''
      # 按鍵綁定
      bindkey '^[[A' history-search-backward
      bindkey '^[[B' history-search-forward
      
      # 目錄跳轉不需要 cd
      setopt AUTO_CD
      
      # 進入目錄自動列出檔案
      chpwd() { ls }
    '';
  };
}
```

### Oh My Zsh 整合

如果你習慣使用 Oh My Zsh 的 plugin 和 theme，Home Manager 直接支援：

```nix
programs.zsh = {
  enable = true;
  
  oh-my-zsh = {
    enable = true;
    
    # 選用的 plugins
    plugins = [
      "git"
      "docker"
      "kubectl"
      "fzf"
      "z"                # 智慧目錄跳轉
      "colored-man-pages"
      "command-not-found"
      "extract"          # 萬用解壓縮指令
    ];
    
    # Oh My Zsh theme（如果不用 Starship 的話）
    theme = "agnoster";
  };
};
```

> 💡 **小提醒**：如果你同時啟用了 Starship prompt（後面會介紹），建議將 `theme` 設為 `""`，避免 theme 跟 Starship 衝突。

### 使用獨立 plugin（不透過 Oh My Zsh）

有些 plugin 不在 Oh My Zsh 內建清單中，可以透過 `plugins` 選項手動加入：

```nix
programs.zsh = {
  enable = true;
  
  plugins = [
    {
      name = "zsh-nix-shell";
      file = "nix-shell.plugin.zsh";
      src = pkgs.fetchFromGitHub {
        owner = "chisui";
        repo = "zsh-nix-shell";
        rev = "v0.8.0";
        sha256 = "sha256-Z6EYQdasvpl1P78poj9efnnLj7QQg13Me8x1Ryyw+dM=";
      };
    }
    {
      name = "fzf-tab";
      src = pkgs.fetchFromGitHub {
        owner = "Aloxaf";
        repo = "fzf-tab";
        rev = "v1.1.2";
        sha256 = "sha256-Qv8zAiMtrr67CbLRrFjGaPzFZcOiMVEFLg1Z+N6VMhg=";
      };
    }
  ];
};
```

---

## 二、🖥️ MacBook 專屬：VSCode 與 GUI 應用程式

> 💻 **適用環境**：MacBook / 有桌面環境的機器
> 📌 **Home Manager 使用模式**：standalone mode（搭配 nix-darwin）

macOS 上無法使用 NixOS，但你可以透過 **Home Manager standalone mode** 來管理使用者環境。安裝方式在 Day 17 已介紹過，這裡聚焦在 macOS 專屬的工具設定。

### VSCode extensions 管理

這是 Home Manager 最令人驚豔的功能之一——**你可以用 Nix 宣告 VSCode 的所有 extension**：

```nix
# modules/vscode.nix — 僅用於 MacBook
{ pkgs, ... }:

{
  programs.vscode = {
    enable = true;
    
    # 選擇 VSCode 版本
    package = pkgs.vscode;  # 也可用 pkgs.vscodium
    
    # 宣告式管理 extensions
    extensions = with pkgs.vscode-extensions; [
      # 語言支援
      ms-python.python
      ms-python.vscode-pylance
      rust-lang.rust-analyzer
      golang.go
      jnoortheen.nix-ide
      
      # 工具
      eamodio.gitlens
      esbenp.prettier-vscode
      dbaeumer.vscode-eslint
      ms-azuretools.vscode-docker
      
      # 主題與外觀
      pkief.material-icon-theme
      dracula-theme.theme-dracula
      
      # AI 輔助
      github.copilot
      github.copilot-chat
    ] ++ pkgs.vscode-utils.extensionsFromVscodeMarketplace [
      # Marketplace 上有但 nixpkgs 沒收錄的 extension
      {
        name = "tokyo-night";
        publisher = "enkia";
        version = "1.0.6";
        sha256 = "sha256-VWdUAU6SC7ROgUTf2lFFFKlgSrR3bRVViTdP23G/S9Q=";
      }
    ];
  };
}
```

### 管理 VSCode settings.json

你甚至可以直接在 Nix 裡宣告 VSCode 的 `settings.json`：

```nix
programs.vscode = {
  enable = true;
  
  userSettings = {
    # 編輯器設定
    "editor.fontSize" = 14;
    "editor.fontFamily" = "'JetBrains Mono', 'Fira Code', monospace";
    "editor.fontLigatures" = true;
    "editor.tabSize" = 2;
    "editor.formatOnSave" = true;
    "editor.minimap.enabled" = false;
    "editor.bracketPairColorization.enabled" = true;
    "editor.guides.bracketPairs" = "active";
    
    # Terminal（macOS 用 zsh）
    "terminal.integrated.defaultProfile.osx" = "zsh";
    "terminal.integrated.fontSize" = 13;
    
    # 檔案設定
    "files.trimTrailingWhitespace" = true;
    "files.insertFinalNewline" = true;
    "files.autoSave" = "afterDelay";
    
    # Nix 語言設定
    "nix.enableLanguageServer" = true;
    "nix.serverPath" = "nil";
    "nix.serverSettings" = {
      nil = {
        formatting = { command = [ "nixfmt" ]; };
      };
    };
    
    # Theme
    "workbench.colorTheme" = "Dracula";
    "workbench.iconTheme" = "material-icon-theme";
  };

  # 鍵盤快捷鍵
  keybindings = [
    {
      key = "cmd+shift+t";
      command = "workbench.action.terminal.toggleTerminal";
    }
    {
      key = "cmd+d";
      command = "editor.action.duplicateSelection";
    }
  ];
};
```

> ⚠️ **注意**：啟用 `userSettings` 後，Home Manager 會接管 `settings.json`。手動在 VSCode 裡改的設定會在下次 `home-manager switch` 時被覆蓋。如果你希望保留手動修改的彈性，可以設定 `programs.vscode.mutableExtensionsDir = true;`。

### macOS 專屬：GUI 應用程式與 dotfiles

在 MacBook 上，你可能還需要管理一些 GUI 專屬的設定檔：

```nix
# modules/macos.nix — 僅用於 MacBook
{ pkgs, ... }:

{
  home.packages = with pkgs; [
    # GUI 應用程式（透過 Nix 安裝）
    wezterm                     # Terminal emulator
    
    # macOS 開發工具
    cocoapods
  ];

  # WezTerm 設定
  home.file.".config/wezterm/wezterm.lua".text = ''
    local wezterm = require 'wezterm'
    local config = wezterm.config_builder()
    
    config.font = wezterm.font 'JetBrains Mono'
    config.font_size = 14.0
    config.color_scheme = 'Dracula (Official)'
    config.hide_tab_bar_if_only_one_tab = true
    config.window_padding = { left = 10, right = 10, top = 10, bottom = 10 }
    
    return config
  '';

  # Karabiner-Elements 設定（鍵盤自訂）
  # home.file.".config/karabiner/karabiner.json".source = ./dotfiles/karabiner.json;
};
```

> 💡 **Homebrew Cask 整合提示**：部分 macOS GUI 應用（如 Raycast、Arc Browser）在 nixpkgs 中沒有收錄，建議搭配 nix-darwin 的 `homebrew.casks` 選項來管理，或直接使用 Homebrew Cask。Home Manager 負責 CLI 工具與 dotfiles，Homebrew 負責 GUI 應用，各司其職。

---

## 三、🖧 NixOS Server 專屬：Neovim IDE 與 tmux 戰鬥站

> 🖧 **適用環境**：遠端 NixOS Server（純 CLI，無 GUI）

在沒有 GUI 的 Server 上，你不需要 VSCode，而是需要一套強大的 CLI 開發環境。Neovim + tmux 是最經典的組合——Neovim 取代 IDE，tmux 取代多視窗管理。

### Neovim 完整 IDE 配置

Home Manager 提供了完善的 Neovim module，可以打造接近 IDE 等級的編輯體驗：

```nix
# modules/neovim-server.nix — Server 的完整 Neovim 配置
{ pkgs, ... }:

{
  programs.neovim = {
    enable = true;
    defaultEditor = true;          # 設為預設編輯器
    viAlias = true;                # vi 指向 neovim
    vimAlias = true;               # vim 指向 neovim
    
    # LSP server 與工具（Neovim 內部使用）
    extraPackages = with pkgs; [
      nil                          # Nix LSP
      nixfmt-rfc-style             # Nix formatter
      lua-language-server          # Lua LSP
      nodePackages.typescript-language-server
      pyright                      # Python LSP
      rust-analyzer                # Rust LSP
      gopls                        # Go LSP
    ];
    
    plugins = with pkgs.vimPlugins; [
      # ── 檔案瀏覽與搜尋 ────────────────────────
      nvim-tree-lua                # 檔案樹
      telescope-nvim               # 模糊搜尋（檔案、文字、buffer）
      telescope-fzf-native-nvim    # telescope 的 fzf 加速
      plenary-nvim                 # telescope 依賴
      
      # ── LSP（語言伺服器協議） ─────────────────
      nvim-lspconfig               # LSP 設定
      nvim-cmp                     # 自動補全引擎
      cmp-nvim-lsp                 # LSP 補全來源
      cmp-buffer                   # Buffer 補全
      cmp-path                     # 路徑補全
      cmp-cmdline                  # 指令列補全
      luasnip                      # Snippet 引擎
      cmp_luasnip                  # Snippet 補全來源
      
      # ── Treesitter（語法高亮與結構分析）───────
      (nvim-treesitter.withPlugins (p: [
        p.tree-sitter-nix
        p.tree-sitter-python
        p.tree-sitter-rust
        p.tree-sitter-go
        p.tree-sitter-javascript
        p.tree-sitter-typescript
        p.tree-sitter-json
        p.tree-sitter-yaml
        p.tree-sitter-toml
        p.tree-sitter-bash
        p.tree-sitter-lua
        p.tree-sitter-markdown
        p.tree-sitter-dockerfile
      ]))
      
      # ── Git 整合 ──────────────────────────────
      gitsigns-nvim                # 行號旁顯示 git 狀態
      fugitive                     # Git 指令整合
      diffview-nvim                # Diff 檢視器
      
      # ── 編輯效率 ──────────────────────────────
      comment-nvim                 # 快速註解 (gcc / gc)
      nvim-autopairs               # 自動括號配對
      nvim-surround                # 操作成對符號
      indent-blankline-nvim        # 縮排視覺線
      which-key-nvim               # 快捷鍵提示
      
      # ── 外觀 ──────────────────────────────────
      tokyonight-nvim              # 主題
      lualine-nvim                 # 狀態列
      nvim-web-devicons            # 檔案圖示
      bufferline-nvim              # Buffer 分頁列
    ];
    
    # Neovim 設定（Lua）
    extraLuaConfig = ''
      -- ── 基本設定 ─────────────────────────────
      vim.opt.number = true
      vim.opt.relativenumber = true
      vim.opt.tabstop = 2
      vim.opt.shiftwidth = 2
      vim.opt.expandtab = true
      vim.opt.termguicolors = true
      vim.opt.signcolumn = "yes"
      vim.opt.cursorline = true
      vim.opt.scrolloff = 8
      vim.opt.updatetime = 250
      vim.opt.undofile = true
      vim.opt.ignorecase = true
      vim.opt.smartcase = true
      vim.opt.splitright = true
      vim.opt.splitbelow = true
      
      -- Leader key
      vim.g.mapleader = " "
      
      -- 主題
      vim.cmd[[colorscheme tokyonight-night]]
      
      -- ── Telescope 快捷鍵 ─────────────────────
      local builtin = require('telescope.builtin')
      vim.keymap.set('n', '<leader>ff', builtin.find_files, { desc = 'Find files' })
      vim.keymap.set('n', '<leader>fg', builtin.live_grep, { desc = 'Live grep' })
      vim.keymap.set('n', '<leader>fb', builtin.buffers, { desc = 'Buffers' })
      vim.keymap.set('n', '<leader>fh', builtin.help_tags, { desc = 'Help tags' })
      vim.keymap.set('n', '<leader>fd', builtin.diagnostics, { desc = 'Diagnostics' })
      
      -- ── NvimTree ─────────────────────────────
      require('nvim-tree').setup()
      vim.keymap.set('n', '<leader>e', ':NvimTreeToggle<CR>', { desc = 'File tree' })
      
      -- ── LSP 設定 ─────────────────────────────
      local lspconfig = require('lspconfig')
      local capabilities = require('cmp_nvim_lsp').default_capabilities()
      
      -- 各語言 LSP
      local servers = { 'nil_ls', 'lua_ls', 'ts_ls', 'pyright', 'rust_analyzer', 'gopls' }
      for _, lsp in ipairs(servers) do
        lspconfig[lsp].setup({ capabilities = capabilities })
      end
      
      -- LSP 快捷鍵（attach 時才啟用）
      vim.api.nvim_create_autocmd('LspAttach', {
        callback = function(args)
          local opts = { buffer = args.buf }
          vim.keymap.set('n', 'gd', vim.lsp.buf.definition, opts)
          vim.keymap.set('n', 'gr', vim.lsp.buf.references, opts)
          vim.keymap.set('n', 'K', vim.lsp.buf.hover, opts)
          vim.keymap.set('n', '<leader>rn', vim.lsp.buf.rename, opts)
          vim.keymap.set('n', '<leader>ca', vim.lsp.buf.code_action, opts)
          vim.keymap.set('n', '<leader>f', function() vim.lsp.buf.format({ async = true }) end, opts)
        end,
      })
      
      -- ── 自動補全（nvim-cmp）──────────────────
      local cmp = require('cmp')
      local luasnip = require('luasnip')
      
      cmp.setup({
        snippet = {
          expand = function(args) luasnip.lsp_expand(args.body) end,
        },
        mapping = cmp.mapping.preset.insert({
          ['<C-b>'] = cmp.mapping.scroll_docs(-4),
          ['<C-f>'] = cmp.mapping.scroll_docs(4),
          ['<C-Space>'] = cmp.mapping.complete(),
          ['<CR>'] = cmp.mapping.confirm({ select = true }),
          ['<Tab>'] = cmp.mapping(function(fallback)
            if cmp.visible() then cmp.select_next_item()
            elseif luasnip.expand_or_jumpable() then luasnip.expand_or_jump()
            else fallback() end
          end, { 'i', 's' }),
        }),
        sources = cmp.config.sources({
          { name = 'nvim_lsp' },
          { name = 'luasnip' },
          { name = 'buffer' },
          { name = 'path' },
        }),
      })
      
      -- ── 其他 plugin 初始化 ───────────────────
      require('gitsigns').setup()
      require('Comment').setup()
      require('nvim-autopairs').setup()
      require('lualine').setup({ options = { theme = 'tokyonight' } })
      require('ibl').setup()
      require('which-key').setup()
    '';
  };
}
```

> 💡 **為什麼在 Server 上用 Neovim 而不是 VSCode？** VSCode 是 Electron 應用，需要 GUI 環境才能運作。雖然有 code-server（網頁版 VSCode），但在 NixOS Server 上用原生 Neovim 更輕量、啟動更快、且完全可以透過 Home Manager 宣告式管理。上面的設定已經涵蓋了 LSP 補全、語法高亮、檔案搜尋、Git 整合——功能上完全能取代 VSCode。

### tmux 深度配置

在 Server 上，tmux 是你的「視窗管理員」——斷線重連、多視窗、多 pane 同時作業。以下是一套實戰級的設定：

```nix
# modules/tmux-server.nix — Server 深度 tmux 配置
{ pkgs, ... }:

{
  programs.tmux = {
    enable = true;
    
    # 基本設定
    clock24 = true;
    baseIndex = 1;                    # Window 從 1 開始編號
    escapeTime = 0;                   # 消除 ESC 延遲（Neovim 必備）
    historyLimit = 50000;
    mouse = true;                     # 啟用滑鼠支援
    terminal = "tmux-256color";
    keyMode = "vi";                   # Vi 模式
    
    # Prefix key 改為 Ctrl+a（比 Ctrl+b 更順手）
    prefix = "C-a";
    
    plugins = with pkgs.tmuxPlugins; [
      sensible                        # 合理的預設值
      yank                            # 剪貼簿整合
      resurrect                       # Session 持久化（重開機不怕）
      continuum                       # 自動儲存 session
      tmux-fzf                        # fzf 整合（快速切換 session/window）
      {
        plugin = dracula;
        extraConfig = ''
          set -g @dracula-show-battery false
          set -g @dracula-show-network true
          set -g @dracula-show-weather false
          set -g @dracula-plugins "git cpu-usage ram-usage time"
          set -g @dracula-show-left-icon session
          set -g @dracula-day-month true
          set -g @dracula-military-time true
        '';
      }
    ];
    
    extraConfig = ''
      # ── 視窗分割（更直覺的按鍵）─────────────
      bind | split-window -h -c "#{pane_current_path}"
      bind - split-window -v -c "#{pane_current_path}"
      unbind '"'
      unbind %
      
      # ── Vim 風格的 pane 切換 ─────────────────
      bind h select-pane -L
      bind j select-pane -D
      bind k select-pane -U
      bind l select-pane -R
      
      # ── Pane 大小調整（重複按壓）─────────────
      bind -r H resize-pane -L 5
      bind -r J resize-pane -D 5
      bind -r K resize-pane -U 5
      bind -r L resize-pane -R 5
      
      # ── 快速操作 ─────────────────────────────
      bind r source-file ~/.config/tmux/tmux.conf \; display "Config reloaded!"
      bind c new-window -c "#{pane_current_path}"
      
      # ── Session 持久化設定 ───────────────────
      set -g @resurrect-strategy-nvim 'session'
      set -g @continuum-restore 'on'
      set -g @continuum-save-interval '15'
      
      # ── 外觀微調 ─────────────────────────────
      set -g status-position top
      set -ga terminal-overrides ',*256col*:Tc'
    '';
  };
}
```

> 🔑 **tmux 常用操作速查**：
> - `Ctrl+a |` — 左右分割 pane
> - `Ctrl+a -` — 上下分割 pane
> - `Ctrl+a h/j/k/l` — 切換 pane（Vim 風格）
> - `Ctrl+a c` — 新建 window
> - `Ctrl+a d` — 離開 session（背景執行）
> - `tmux attach` — 重新連接 session

---

## 四、CLI 工具鏈（🖥️ MacBook ＋ 🖧 Server 通用）

以下這些現代 CLI 工具在兩個環境都該安裝，它們會大幅提升你的終端體驗。

### Starship Prompt

Starship 是一款跨 shell 的高速 prompt，用 Rust 寫成，資訊密度高又不拖慢速度：

```nix
# modules/starship.nix — 兩環境共用
{ ... }:

{
  programs.starship = {
    enable = true;
    enableZshIntegration = true;
    
    settings = {
      # 整體設定
      add_newline = true;
      command_timeout = 1000;
      
      # 各 module 設定
      character = {
        success_symbol = "[➜](bold green)";
        error_symbol = "[✗](bold red)";
      };
      
      directory = {
        truncation_length = 3;
        truncate_to_repo = true;
        style = "bold cyan";
      };
      
      git_branch = {
        symbol = " ";
        style = "bold purple";
      };
      
      git_status = {
        conflicted = "⚡";
        ahead = "⇡\${count}";
        behind = "⇣\${count}";
        diverged = "⇕⇡\${ahead_count}⇣\${behind_count}";
        untracked = "?\${count}";
        modified = "!\${count}";
        staged = "+\${count}";
      };
      
      # 語言版本顯示
      nix_shell = {
        symbol = " ";
        format = "via [$symbol$state( \\($name\\))]($style) ";
      };
      
      nodejs.symbol = " ";
      python.symbol = " ";
      rust.symbol = " ";
      golang.symbol = " ";
      docker_context.symbol = " ";
      
      # 右側 prompt 顯示指令執行時間
      cmd_duration = {
        min_time = 2000;          # 超過 2 秒才顯示
        format = "took [$duration](bold yellow)";
      };
      
      # 顯示主機名稱（SSH 時特別有用）
      hostname = {
        ssh_only = true;
        format = "on [$hostname](bold red) ";
      };
      
      username = {
        show_always = false;
        format = "[$user]($style)@";
      };
    };
  };
}
```

### fzf（模糊搜尋）

fzf 是終端界的瑞士刀——搜尋檔案、歷史紀錄、切換目錄，全部模糊搜尋：

```nix
programs.fzf = {
  enable = true;
  enableZshIntegration = true;
  
  # Ctrl+T 搜尋檔案時的預設指令
  fileWidgetCommand = "fd --type f --hidden --follow --exclude .git";
  fileWidgetOptions = [ "--preview 'bat --color=always --style=numbers {}'" ];
  
  # Ctrl+R 搜尋歷史紀錄的選項
  historyWidgetOptions = [ "--sort" "--exact" ];
  
  # Alt+C 切換目錄的預設指令
  changeDirWidgetCommand = "fd --type d --hidden --follow --exclude .git";
  changeDirWidgetOptions = [ "--preview 'tree -C {} | head -50'" ];
  
  # 預設選項（外觀）
  defaultOptions = [
    "--height 40%"
    "--layout=reverse"
    "--border"
    "--color=fg:#f8f8f2,bg:#282a36,hl:#bd93f9"
  ];
};
```

### 現代 CLI 替代品

這些工具用更現代的方式取代了傳統指令，提供更好的輸出格式與效能：

```nix
# bat（取代 cat —— 語法高亮、行號、Git 整合）
programs.bat = {
  enable = true;
  config = {
    theme = "Dracula";
    pager = "less -FR";
    style = "numbers,changes,header";
  };
};

# eza（取代 ls —— 顏色、圖示、Git 狀態）
programs.eza = {
  enable = true;
  enableZshIntegration = true;      # 自動設定 ls alias
  icons = "auto";
  git = true;
  extraOptions = [
    "--group-directories-first"
    "--header"
  ];
};

# zoxide（取代 cd —— 記住你常去的目錄，模糊跳轉）
programs.zoxide = {
  enable = true;
  enableZshIntegration = true;
  options = [ "--cmd cd" ];         # 取代內建 cd
};

# direnv（目錄級環境變數，搭配 Nix 使用效果極佳）
programs.direnv = {
  enable = true;
  enableZshIntegration = true;
  nix-direnv.enable = true;         # 搭配 Nix 使用，大幅加速
};
```

額外建議在 `home.packages` 中加入的工具：

```nix
home.packages = with pkgs; [
  ripgrep          # rg — 比 grep 快上數十倍的搜尋工具
  fd               # fd — 比 find 更直覺的檔案搜尋
  jq               # JSON 處理利器
  yq               # YAML 版的 jq
  tree             # 目錄結構顯示
  httpie           # 比 curl 更人性化的 HTTP client
  btop             # 系統監控 TUI
  lazygit          # Git TUI 介面
  lazydocker       # Docker TUI 介面
  du-dust          # 比 du 更直覺的磁碟用量工具
  duf              # 比 df 更漂亮的磁碟資訊
  procs            # 比 ps 更好用的 process 檢視
  tokei            # 程式碼行數統計
];
```

---

## 五、Git 進階設定（🖥️ MacBook ＋ 🖧 Server 通用）

Day 17 介紹了 Git 的基本設定，今天來看更進階的用法：

```nix
# modules/git.nix — 兩環境共用
{ ... }:

{
  programs.git = {
    enable = true;
    userName = "Your Name";
    userEmail = "you@example.com";
    
    # 預設分支名稱
    extraConfig = {
      init.defaultBranch = "main";
      
      # 更好的 diff 演算法
      diff.algorithm = "histogram";
      
      # 自動 rebase（pull 時）
      pull.rebase = true;
      
      # 自動 stash（rebase 時）
      rebase.autoStash = true;
      
      # 記住 merge conflict 的解法
      rerere.enabled = true;
      
      # 排序 branch 顯示（最近使用的在前）
      branch.sort = "-committerdate";
      
      # 排序 tag（版本號排序）
      tag.sort = "version:refname";
      
      # Push 設定
      push.autoSetupRemote = true;
      push.followTags = true;

      # URL 替換（SSH 取代 HTTPS）
      url."git@github.com:".insteadOf = "https://github.com/";
    };

    # Git aliases
    aliases = {
      co = "checkout";
      br = "branch";
      ci = "commit";
      st = "status";
      lg = "log --oneline --graph --decorate --all";
      unstage = "reset HEAD --";
      last = "log -1 HEAD";
      # 互動式 rebase 最近 N 個 commit
      reb = "!f() { git rebase -i HEAD~$1; }; f";
    };
    
    # Delta（更漂亮的 diff 輸出）
    delta = {
      enable = true;
      options = {
        navigate = true;
        side-by-side = true;
        line-numbers = true;
        syntax-theme = "Dracula";
      };
    };

    # 全域 .gitignore
    ignores = [
      ".DS_Store"
      "*.swp"
      ".envrc"
      ".direnv/"
      "result"        # Nix build output
      ".idea/"
      ".vscode/"
      "node_modules/"
      "__pycache__/"
    ];

    # GPG 簽章（選用）
    signing = {
      key = "YOUR_GPG_KEY_ID";
      signByDefault = true;
    };
  };

  # GitHub CLI
  programs.gh = {
    enable = true;
    settings = {
      git_protocol = "ssh";
      prompt = "enabled";
      aliases = {
        co = "pr checkout";
        pv = "pr view --web";
      };
    };
  };
}
```

---

## 六、自訂檔案與腳本（home.file）

有些設定沒有對應的 Home Manager module，這時可以用 `home.file` 直接管理任意檔案：

```nix
# 建立自訂腳本並加入 PATH
home.file.".local/bin/dev-setup" = {
  executable = true;
  text = ''
    #!/usr/bin/env bash
    set -euo pipefail
    
    echo "🚀 Setting up development environment..."
    
    # 檢查 Nix 是否可用
    if ! command -v nix &> /dev/null; then
      echo "❌ Nix not found. Please install Nix first."
      exit 1
    fi
    
    # 套用 Home Manager 設定
    echo "📦 Applying Home Manager configuration..."
    home-manager switch --flake .
    
    echo "✅ Development environment is ready!"
  '';
};

home.file.".local/bin/cleanup" = {
  executable = true;
  text = ''
    #!/usr/bin/env bash
    echo "🧹 Cleaning up Nix store..."
    nix-collect-garbage -d
    echo "✅ Cleanup complete!"
  '';
};
```

---

## 七、環境變數管理

### home.sessionVariables

用 `home.sessionVariables` 宣告環境變數，Home Manager 會自動在 shell 初始化時載入：

```nix
home.sessionVariables = {
  EDITOR = "nvim";
  LANG = "en_US.UTF-8";
  LC_ALL = "en_US.UTF-8";
  
  # 開發相關
  GOPATH = "${config.home.homeDirectory}/go";
  CARGO_HOME = "${config.home.homeDirectory}/.cargo";
  
  # 減少 telemetry
  DOTNET_CLI_TELEMETRY_OPTOUT = "1";
  
  # FZF 預設指令
  FZF_DEFAULT_COMMAND = "fd --type f --hidden --follow --exclude .git";
};
```

### home.sessionPath

將自訂路徑加入 `$PATH`：

```nix
home.sessionPath = [
  "$HOME/.local/bin"
  "$HOME/go/bin"
  "$HOME/.cargo/bin"
];
```

---

## 八、完整範例：多環境 module 架構

實際專案中，建議將設定拆分成「共用 module」和「環境專屬 module」：

### 目錄結構

```
~/.config/home-manager/
├── flake.nix                     # 定義不同環境的 homeConfigurations
├── hosts/
│   ├── macbook.nix               # MacBook 入口
│   └── server.nix                # NixOS Server 入口
└── modules/
    ├── shell.nix                 # 🔄 共用：Zsh + Oh My Zsh
    ├── starship.nix              # 🔄 共用：Starship prompt
    ├── git.nix                   # 🔄 共用：Git + GitHub CLI
    ├── cli-tools.nix             # 🔄 共用：fzf, bat, eza, zoxide, direnv
    ├── vscode.nix                # 🖥️ MacBook：VSCode + extensions
    ├── macos.nix                 # 🖥️ MacBook：GUI 應用 + macOS 設定
    ├── neovim-server.nix         # 🖧 Server：完整 Neovim IDE
    └── tmux-server.nix           # 🖧 Server：深度 tmux 配置
```

### flake.nix（定義兩個環境）

```nix
{
  description = "Home Manager configurations";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { nixpkgs, home-manager, ... }: {
    homeConfigurations = {
      # 🖥️ MacBook 設定
      "james@macbook" = home-manager.lib.homeManagerConfiguration {
        pkgs = nixpkgs.legacyPackages.aarch64-darwin;
        modules = [ ./hosts/macbook.nix ];
      };
      
      # 🖧 NixOS Server 設定
      "james@server" = home-manager.lib.homeManagerConfiguration {
        pkgs = nixpkgs.legacyPackages.x86_64-linux;
        modules = [ ./hosts/server.nix ];
      };
    };
  };
}
```

### hosts/macbook.nix

```nix
{ config, pkgs, ... }:

{
  imports = [
    ../modules/shell.nix
    ../modules/starship.nix
    ../modules/git.nix
    ../modules/cli-tools.nix
    ../modules/vscode.nix           # 🖥️ MacBook 專屬
    ../modules/macos.nix            # 🖥️ MacBook 專屬
  ];
  
  home.username = "james";
  home.homeDirectory = "/Users/james";
  home.stateVersion = "24.05";

  # MacBook 可以裝基本版 Neovim（快速編輯用）
  programs.neovim = {
    enable = true;
    defaultEditor = true;
    viAlias = true;
    vimAlias = true;
  };
  
  # macOS 專屬環境變數
  home.sessionVariables = {
    EDITOR = "nvim";
    VISUAL = "code --wait";         # GUI 環境用 VSCode 當 VISUAL editor
    LANG = "en_US.UTF-8";
    HOMEBREW_NO_ANALYTICS = "1";
  };

  home.sessionPath = [
    "$HOME/.local/bin"
    "/opt/homebrew/bin"             # Homebrew on Apple Silicon
  ];

  programs.home-manager.enable = true;
}
```

### hosts/server.nix

```nix
{ config, pkgs, ... }:

{
  imports = [
    ../modules/shell.nix
    ../modules/starship.nix
    ../modules/git.nix
    ../modules/cli-tools.nix
    ../modules/neovim-server.nix    # 🖧 Server 專屬：完整 IDE
    ../modules/tmux-server.nix      # 🖧 Server 專屬：深度 tmux
  ];
  
  home.username = "james";
  home.homeDirectory = "/home/james";
  home.stateVersion = "24.05";

  # Server 專屬套件
  home.packages = with pkgs; [
    htop                            # 系統監控
    ncdu                            # 磁碟用量分析
    iotop                           # I/O 監控
    nmap                            # 網路掃描
    tcpdump                         # 封包擷取
  ];

  home.sessionVariables = {
    EDITOR = "nvim";
    VISUAL = "nvim";                # Server 上 VISUAL 也是 Neovim
    LANG = "en_US.UTF-8";
  };

  home.sessionPath = [
    "$HOME/.local/bin"
    "$HOME/go/bin"
    "$HOME/.cargo/bin"
  ];

  programs.home-manager.enable = true;
}
```

### 套用設定

```bash
# 🖥️ 在 MacBook 上套用
home-manager switch --flake .#james@macbook

# 🖧 在 NixOS Server 上套用
home-manager switch --flake .#james@server
```

---

## 查詢可用的 programs 選項

想知道 Home Manager 還支援哪些 programs？有幾個查詢方式：

```bash
# 搜尋所有可用的 Home Manager options
man home-configuration.nix

# 線上搜尋（推薦）
# https://home-manager-options.extranix.com/

# 列出所有 programs 相關選項
home-manager option programs
```

---

## 小結

今天我們學會了依據不同環境，用 Home Manager 打造量身訂做的開發環境：

| 面向 | 🖥️ MacBook | 🖧 NixOS Server | 管理方式 |
|------|:----------:|:----------------:|----------|
| Shell（Zsh） | ✅ | ✅ | `programs.zsh` + Oh My Zsh |
| Starship prompt | ✅ | ✅ | `programs.starship` |
| Git + Delta | ✅ | ✅ | `programs.git` + delta |
| CLI 工具鏈 | ✅ | ✅ | fzf, bat, eza, zoxide, direnv |
| VSCode | ✅ | ❌ | `programs.vscode`（桌面專用） |
| Neovim（完整 IDE） | ⚪ | ✅ | `programs.neovim` + LSP + Treesitter |
| tmux（深度配置） | ⚪ | ✅ | `programs.tmux` + plugins |
| 環境變數 | ✅ | ✅ | `home.sessionVariables` + `home.sessionPath` |

核心觀念：**共用設定抽成 module，環境差異透過不同的 host 檔案組合。** 這樣一來：

- **MacBook 重灌**：`home-manager switch --flake .#james@macbook` → GUI + CLI 一次到位
- **新 Server 上線**：`home-manager switch --flake .#james@server` → 完整 CLI IDE 就緒
- **改設定**：共用 module 改一次，兩邊同步生效

## 明日預告

Day 19 我們將進入 **多模組架構**。當你有更多機器、更多角色（開發機、CI runner、production server）時，如何用 Nix module system 優雅地管理所有差異？我們明天見！
