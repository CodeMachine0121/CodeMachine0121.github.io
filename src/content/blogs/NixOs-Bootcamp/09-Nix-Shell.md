---
title: "Day 9：Nix Shell — 開發者的救星"
datetime: "2026-03-23"
description: "學會使用 nix-shell 快速建立臨時開發環境，不需安裝軟體就能擁有完整的工具鏈，解決版本衝突與環境不一致的痛點。"
parent: "NixOs Bootcamp"
---

# Day 9：Nix Shell — 開發者的救星

> 📦 系列：NixOS 30 天學習之旅
> 📚 階段：第二階段 — 掌握 Nix 語言與開發環境（Day 8 ~ Day 14）
> 🎯 今日目標：學會使用 `nix-shell`，不安裝軟體就能擁有完整開發環境

---

## 前言：傳統開發環境的痛點

身為開發者，你一定經歷過這些場景：

- 想測試一個 Python script，卻發現機器上沒裝 Python。
- 裝了 Node.js 14 的專案，結果另一個專案要求 Node.js 20，兩邊打架。
- 同事說「在我的電腦上可以跑啊」，但你花了一整個下午都裝不起來。
- 好不容易裝好一堆工具，升級系統後全部爆炸。

傳統的做法是用 `brew install`、`apt-get install`，或者搬出 Docker。但不管哪一種，背後都有著相同的問題 — **你正在汙染你的系統環境**。安裝的東西散落在 `/usr/local`、`/usr/bin`、各種 `lib` 資料夾裡，移除時總是不乾不淨。

今天要介紹的 `nix-shell`，正是為了解決這個痛點而生的工具。

---

## nix-shell 是什麼？

`nix-shell` 是 Nix 提供的一個指令，它能夠 **即時建立一個臨時的 shell 環境**，在裡面放入你指定的套件，讓你馬上就能使用。

核心概念很簡單：

1. **不需要安裝**：套件只存在 Nix store（`/nix/store/`）裡，不會汙染你的系統。
2. **用完即走**：離開 `nix-shell` 後，環境就消失了（套件仍快取在 store 裡，但不會出現在你的 `$PATH`）。
3. **可重現**：同樣的指令，在任何一台有 Nix 的機器上，都能得到一模一樣的環境。

你可以把它想像成一個 **極度輕量的 container**——不需要 image、不需要 Dockerfile、不需要等待 build，一行指令就搞定。

---

## 即時使用：`nix-shell -p`

最簡單的用法，就是 `-p`（`--packages`）參數。假設你想要一個有 Python 3 的環境：

```bash
nix-shell -p python3
```

執行後，你會進入一個新的 shell。在這個 shell 裡，`python3` 就是可用的：

```bash
[nix-shell:~]$ python3 --version
Python 3.12.5

[nix-shell:~]$ which python3
/nix/store/xxxxx-python3-3.12.5/bin/python3
```

注意 `which` 的輸出——Python 不是裝在 `/usr/bin` 或 `/usr/local/bin`，而是在 `/nix/store/` 裡。**你的系統完全沒有被動過。**

按下 `Ctrl+D` 或輸入 `exit` 離開後，`python3` 就從你的 `$PATH` 消失了：

```bash
$ which python3
python3 not found
```

乾乾淨淨，就像什麼都沒發生過一樣。

---

## 多個套件的組合使用

`-p` 後面可以接多個套件名稱，打造你需要的開發環境：

```bash
nix-shell -p python3 nodejs git curl jq
```

這一行指令，就給你了一個同時擁有 Python 3、Node.js、Git、curl 和 jq 的環境。不需要一個一個 `brew install`，更不需要擔心版本衝突。

再來看一個更實際的例子。假設你要寫一個小工具，需要用到 Go 和 SQLite：

```bash
nix-shell -p go sqlite
```

進入 shell 後，馬上就能開始開發：

```bash
[nix-shell:~]$ go version
go version go1.22.5 linux/amd64

[nix-shell:~]$ sqlite3 --version
3.46.0 2024-05-23 ...
```

這就是 `nix-shell` 的魔力——**把「安裝開發工具」這件事，變成了一行指令**。

---

## `--run` 與 `--command` 參數

有時候你不需要進入互動式的 shell，只是想 **跑一個指令就走**。這時候 `--run` 和 `--command` 就派上用場了。

### `--run`：執行完就離開

```bash
nix-shell -p python3 --run "python3 -c 'print(1 + 1)'"
```

輸出：

```
2
```

指令執行完畢，自動回到原本的 shell。非常適合用在一次性的任務，像是：

```bash
# 快速用 jq 處理一個 JSON 檔案
nix-shell -p jq --run "cat data.json | jq '.users[] | .name'"

# 用 httpie 測試一個 API endpoint
nix-shell -p httpie --run "http GET https://api.github.com/users/octocat"
```

### `--command`：執行指令，但保留 shell 環境

```bash
nix-shell -p nodejs --command "node --version && bash"
```

`--command` 和 `--run` 的差異在於，`--command` 會在 nix-shell 的環境中執行指令。如果你在指令最後加上 `bash`，就能留在那個環境裡繼續操作。

> 💡 **小技巧**：在 script 或 CI/CD pipeline 中，`--run` 特別好用。你可以在不安裝任何東西的情況下，直接在 pipeline 裡取得需要的工具。

---

## nix-shell 與系統環境的隔離

這是 `nix-shell` 最重要的特性之一——**它不會影響你的系統環境**。

讓我們來做一個實驗：

```bash
# 先確認系統上的 PATH
$ echo $PATH
/usr/local/bin:/usr/bin:/bin

# 進入 nix-shell
$ nix-shell -p python3 nodejs

# 在 nix-shell 裡檢查 PATH
[nix-shell:~]$ echo $PATH
/nix/store/xxxxx-python3-3.12.5/bin:/nix/store/xxxxx-nodejs-20.15.0/bin:/usr/local/bin:/usr/bin:/bin
```

你會發現，`nix-shell` 做的事情其實很單純——**它只是把 Nix store 中對應套件的 `bin` 路徑，加到你的 `$PATH` 前面**。

這代表：

| 特性 | 說明 |
|------|------|
| ✅ 不動系統檔案 | 不會在 `/usr/local` 或 `/usr/bin` 裡塞東西 |
| ✅ 不影響其他 shell | 只有當前這個 shell session 受影響 |
| ✅ 離開就恢復 | `exit` 之後，`$PATH` 回到原本的狀態 |
| ✅ 多個 nix-shell 可並存 | 你可以同時開好幾個不同的 nix-shell |

和 Docker 相比，`nix-shell` 更加輕量。Docker 需要建立 image、啟動 container，還需要處理 volume mount 和 port mapping。而 `nix-shell` 就是在你當前的 terminal 裡，零延遲地切換環境。

```
╔══════════════════════════════════════════════════╗
║              你的系統環境                          ║
║                                                  ║
║    ┌───────────────────┐  ┌──────────────────┐   ║
║    │  nix-shell A      │  │  nix-shell B     │   ║
║    │  python3 + flask  │  │  nodejs + npm    │   ║
║    │  (Terminal 1)     │  │  (Terminal 2)    │   ║
║    └───────────────────┘  └──────────────────┘   ║
║                                                  ║
║    系統的 $PATH 和檔案系統完全不受影響              ║
╚══════════════════════════════════════════════════╝
```

---

## 實戰場景：快速測試不同版本

`nix-shell` 最實用的場景之一，就是 **快速切換不同版本的工具來測試**。

### 場景一：測試 Python 2 vs Python 3

```bash
# Terminal 1：Python 3 環境
nix-shell -p python3 --run "python3 -c 'print(type(1/2))'"
# 輸出：<class 'float'>
```

不需要 `pyenv`，不需要切換 symlink，直接就能比較行為差異。

### 場景二：測試不同版本的 Node.js

```bash
# 使用 Node.js 20
nix-shell -p nodejs_20 --run "node -e 'console.log(process.version)'"
# 輸出：v20.15.0

# 使用 Node.js 18
nix-shell -p nodejs_18 --run "node -e 'console.log(process.version)'"
# 輸出：v18.20.3
```

> 💡 **小技巧**：想知道有哪些套件可以用？可以到 [Nix Packages Search](https://search.nixos.org/packages) 搜尋，或在 terminal 中用以下指令查找：
>
> ```bash
> nix-env -qaP | grep nodejs
> ```

### 場景三：臨時需要一個工具

同事丟了一個 YAML 檔案給你，但你的系統沒有裝 `yq`：

```bash
nix-shell -p yq-go --run "yq '.services' docker-compose.yml"
```

不需要 `brew install yq`，不需要等待安裝，也不會在系統上留下任何痕跡。用完就走。

### 場景四：在 script 中使用

你甚至可以在 shell script 的 shebang 中使用 `nix-shell`：

```bash
#!/usr/bin/env nix-shell
#!nix-shell -i python3 -p python3

import sys
print(f"Hello from Python {sys.version}")
print("This script doesn't need Python pre-installed!")
```

把這個檔案存成 `hello.py`，給它執行權限後直接跑：

```bash
chmod +x hello.py
./hello.py
```

Nix 會自動幫你準備好 Python 3 的環境，然後執行這個 script。**收到這個 script 的人，只要有裝 Nix，就能直接執行，不需要任何額外設定。**

---

## 進階小技巧

在結束之前，再分享幾個實用的小技巧：

### 1. 使用 `--pure` 參數

加上 `--pure` 會建立一個更乾淨的環境，它會把你系統原本的 `$PATH` 清掉，只保留 nix-shell 裡指定的套件：

```bash
nix-shell --pure -p python3 coreutils
```

這在你需要確保「這個環境只用到了我指定的工具」時特別有用，例如測試你的 build script 是否有遺漏的 dependency。

### 2. 搭配 `nix-shell` 與 `shellHook`

在 Day 10 我們會深入介紹 `shell.nix` 檔案，屆時你可以在裡面定義 `shellHook`，讓進入 nix-shell 時自動執行特定指令（例如設定環境變數、啟動 service 等）。

### 3. 第一次使用會比較慢

第一次使用 `nix-shell -p` 時，Nix 需要從 binary cache 下載套件，所以會花一些時間。但下載過一次之後，後續使用都是即時的——因為套件已經快取在你的 `/nix/store/` 裡了。

---

## 小結

今天我們學會了 `nix-shell` 的核心用法：

| 指令 | 用途 |
|------|------|
| `nix-shell -p python3` | 建立一個有 Python 3 的臨時環境 |
| `nix-shell -p python3 nodejs` | 建立一個有多個套件的臨時環境 |
| `nix-shell -p jq --run "..."` | 執行一次性指令後離開 |
| `nix-shell --pure -p python3` | 建立一個純淨的隔離環境 |

`nix-shell` 的哲學可以用一句話概括：**不要在系統上安裝你不需要永久存在的東西。**

需要用什麼工具？`nix-shell -p` 進去用，用完 `exit` 離開。就這麼簡單。

這正是 Nix 被越來越多開發者推崇的原因——它讓你的系統保持乾淨，同時又不犧牲開發效率。

---

## 明日預告

Day 10 我們將從「即時使用」進階到「可重現的開發環境」——學習如何撰寫 `shell.nix` 檔案，把今天用 `-p` 指定的套件寫成一個 **可以 commit 進 repo 的設定檔**，讓團隊裡的每個人都能用同一個指令、得到同一個開發環境。

> 🔑 Day 9 關鍵收穫：`nix-shell -p` 就是你的「免安裝開發環境」，用完即走、不汙染系統。
