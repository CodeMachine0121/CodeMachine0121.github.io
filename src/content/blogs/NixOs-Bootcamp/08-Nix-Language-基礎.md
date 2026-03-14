---
title: "Day 8：Nix Language 基礎 — 學會寫 Nix Expression，不再只是複製貼上"
datetime: "2026-03-22"
description: "進入第二階段，學習 Nix 語言的基礎語法：資料型別、函式、let 綁定與 attribute set，從此不再只是複製貼上別人的配置。"
parent: "NixOs Bootcamp"
---

# Day 8：Nix Language 基礎 — 學會寫 Nix Expression，不再只是複製貼上

> 系列：NixOS 30 天學習之旅  
> 階段：第二階段 — 掌握 Nix 語言與開發環境（Day 8 ~ Day 14）  

---

## 前言

恭喜你走過了第一階段！在 Day 1 到 Day 7 的旅程中，我們已經成功安裝了 NixOS（或 Nix package manager），體驗了宣告式設定的魅力，也學會用 `nix-env` 與基本的 `configuration.nix` 來管理系統。不過你可能會發現，到目前為止，我們大多是在「複製貼上」別人的設定檔，對那些大括號、冒號、分號的語法似懂非懂。

**第二階段的核心目標，就是讓你真正學會寫 Nix expression。**

Nix 語言是整個 Nix 生態系的基石。無論是 `configuration.nix`、`flake.nix`、還是自訂 derivation，背後都是 Nix 語言在運作。它是一門純函數式（purely functional）、惰性求值（lazy evaluation）的領域特定語言（DSL），專門設計來描述軟體套件與系統組態。

聽起來很學術？別擔心，Nix 語言的語法其實相當精簡。今天我們就從最基礎的資料型別開始，一路認識 Attribute Sets、Lists、Functions，以及幾個你一定會用到的重要語法。

---

## 基本資料型別

Nix 語言支援以下幾種基本資料型別：

### String

字串用雙引號包裹，支援 `${...}` 進行字串插值（string interpolation）：

```nix
"hello world"

# 字串插值
let name = "NixOS"; in "Welcome to ${name}"
# => "Welcome to NixOS"
```

如果需要多行字串，可以使用兩個單引號 `''` 包裹：

```nix
''
  這是一段
  多行字串
''
```

### Integer 與 Float

```nix
42       # Integer
1.5      # Float
6 / 3    # => 2（整數除法）
7 / 2    # => 3（注意：整數除法會無條件捨去）
```

### Boolean

```nix
true
false

true && false   # => false
true || false   # => true
!true           # => false
```

### Path

Path 是 Nix 語言中比較特別的型別，用來表示檔案路徑。它不需要引號，且至少要包含一個 `/`：

```nix
/etc/nixos/configuration.nix    # 絕對路徑
./my-config.nix                 # 相對路徑
```

> ⚠️ 注意：Path 跟 String 是不同型別。Nix 在 evaluation 時會將 Path 解析為 Nix store 中的實際路徑，這在撰寫 derivation 時非常重要。

### Null

```nix
null    # 表示「沒有值」
```

---

## Attribute Sets 詳解

Attribute Set（簡稱 attrset）是 Nix 語言中最核心的資料結構，你可以把它想像成 JSON 的 object 或 Python 的 dictionary。它由一組 key-value pair 組成，用大括號 `{ }` 包裹：

```nix
{
  name = "my-package";
  version = "1.0.0";
  isStable = true;
}
```

### 存取 Attribute

使用 `.` 來存取 attribute 的值：

```nix
let
  pkg = {
    name = "hello";
    version = "2.12";
  };
in
  pkg.name
# => "hello"
```

### 巢狀 Attribute Sets

Attribute Set 可以任意巢狀，這也是為什麼 `configuration.nix` 的結構可以那麼深層：

```nix
{
  services = {
    nginx = {
      enable = true;
      virtualHosts = {
        "example.com" = {
          root = "/var/www/example";
        };
      };
    };
  };
}
```

Nix 也提供了語法糖，讓你直接用 `.` 來定義巢狀結構：

```nix
{
  services.nginx.enable = true;
  services.nginx.virtualHosts."example.com".root = "/var/www/example";
}
```

兩種寫法完全等價，挑你覺得可讀性較好的即可。

### Recursive Attribute Sets（`rec { }`）

一般的 attribute set 中，attribute 之間不能互相引用。如果你需要這個功能，要加上 `rec` 關鍵字：

```nix
rec {
  name = "hello";
  greeting = "Hi, I am ${name}";
}
# greeting => "Hi, I am hello"
```

> 💡 實務上建議少用 `rec`，因為它可能導致無限遞迴。大多數情況下，`let...in` 是更好的替代方案。

### 用 `//` 合併 Attribute Sets

`//` 運算子可以合併兩個 attribute set，若有重複的 key，右邊會覆蓋左邊：

```nix
{ a = 1; b = 2; } // { b = 3; c = 4; }
# => { a = 1; b = 3; c = 4; }
```

這在撰寫可覆寫的預設值時非常實用。

---

## Lists 詳解

List 是有序的集合，用方括號 `[ ]` 包裹，元素之間用空白分隔（**不是逗號**）：

```nix
[ 1 2 3 ]
[ "vim" "git" "curl" ]
[ true 42 "mixed" ]    # 可以混合不同型別
```

> ⚠️ Nix 的 list 元素之間**不使用逗號**，這是新手最常踩到的坑之一。

### 常見的 List 操作

Nix 內建了一些處理 list 的 built-in function：

```nix
builtins.length [ 1 2 3 ]          # => 3
builtins.head [ 1 2 3 ]            # => 1
builtins.tail [ 1 2 3 ]            # => [ 2 3 ]
builtins.elemAt [ "a" "b" "c" ] 1  # => "b"（index 從 0 開始）
```

用 `++` 運算子來串接兩個 list：

```nix
[ 1 2 ] ++ [ 3 4 ]
# => [ 1 2 3 4 ]
```

### List 與 `map`

`map` 是函數式程式設計的經典操作，對 list 中的每個元素套用一個 function：

```nix
builtins.map (x: x * 2) [ 1 2 3 ]
# => [ 2 4 6 ]
```

`filter` 則是篩選出符合條件的元素：

```nix
builtins.filter (x: x > 2) [ 1 2 3 4 5 ]
# => [ 3 4 5 ]
```

---

## Functions 與 Lambda

Nix 語言中的 function 只接受**一個參數**，用冒號 `:` 分隔參數與函式本體：

```nix
x: x + 1
```

這就是一個 lambda（匿名函式），接受 `x`，回傳 `x + 1`。

### 呼叫 Function

直接把參數寫在 function 後面，**不需要括號**：

```nix
let
  increment = x: x + 1;
in
  increment 5
# => 6
```

### 多參數 Function（Currying）

由於 function 只接受一個參數，多參數的情境是透過 currying 來實現的——也就是一個 function 回傳另一個 function：

```nix
let
  add = a: b: a + b;
in
  add 3 5
# => 8
```

`add 3 5` 實際上是 `(add 3) 5`：先呼叫 `add 3` 得到一個新的 function `b: 3 + b`，再把 `5` 傳入。

### 用 Attribute Set 當作參數（Destructuring）

這是 Nix 中非常常見的模式。function 可以直接解構一個 attribute set 作為參數：

```nix
{ name, version }:
  "${name}-${version}"
```

呼叫時傳入 attribute set：

```nix
let
  fullName = { name, version }: "${name}-${version}";
in
  fullName { name = "hello"; version = "1.0"; }
# => "hello-1.0"
```

#### 預設值

你可以為參數指定預設值：

```nix
{ name, version ? "0.0.1" }:
  "${name}-${version}"
```

#### 允許額外的 Attributes（`...`）

加上 `...` 表示「可以接受其他額外的 attribute，但我不處理」：

```nix
{ name, version, ... }:
  "${name}-${version}"
```

這在撰寫 Nix module 或 overlay 時非常常見。

---

## `let...in` 與 `with` 表達式

### `let...in`

`let...in` 用來定義區域變數，是 Nix 語言中最常用的表達式之一：

```nix
let
  name = "NixOS";
  year = 2024;
in
  "${name} was great in ${toString year}"
# => "NixOS was great in 2024"
```

你可以在 `let` 區塊中定義多個變數，甚至定義 function。這些變數只在 `in` 之後的 expression 中有效。

```nix
let
  square = x: x * x;
  nums = [ 1 2 3 4 5 ];
in
  builtins.map square nums
# => [ 1 4 9 16 25 ]
```

> 💡 前面提到 `rec { }` 的替代方案就是 `let...in`。在 `let` 區塊中，變數之間可以互相引用，而且不會有 `rec` 的潛在風險。

### `with` 表達式

`with` 可以把一個 attribute set 的所有 attribute 引入 scope，省去反覆打前綴的麻煩：

```nix
let
  config = {
    enableSSH = true;
    enableNginx = false;
    hostname = "my-server";
  };
in
  with config; "Host: ${hostname}, SSH: ${toString enableSSH}"
# => "Host: my-server, SSH: 1"
```

在 `configuration.nix` 中，你一定看過這樣的寫法：

```nix
environment.systemPackages = with pkgs; [
  vim
  git
  curl
  firefox
];
```

這裡的 `with pkgs;` 讓你可以直接寫 `vim` 而不用寫 `pkgs.vim`，大幅提升可讀性。

> ⚠️ `with` 雖然方便，但過度使用會讓人搞不清楚某個變數到底從哪裡來。建議只在 `systemPackages` 這類明確場景使用。

---

## `inherit` 關鍵字

`inherit` 是 Nix 語言提供的語法糖，讓你可以快速把變數「繼承」進 attribute set 中。

### 基本用法

```nix
let
  name = "hello";
  version = "1.0";
in
{
  inherit name version;
  # 等同於：
  # name = name;
  # version = version;
}
# => { name = "hello"; version = "1.0"; }
```

### 從其他 Attribute Set 繼承

你也可以從某個特定的 attribute set 中繼承 attribute：

```nix
let
  src = {
    owner = "NixOS";
    repo = "nixpkgs";
    rev = "abc123";
  };
in
{
  inherit (src) owner repo;
  # 等同於：
  # owner = src.owner;
  # repo = src.repo;
}
# => { owner = "NixOS"; repo = "nixpkgs"; }
```

`inherit` 在實際的 Nix 設定檔中無所不在，理解它的運作方式能幫助你更輕鬆地閱讀與撰寫 Nix expression。

---

## 在 `nix repl` 中練習

理論學完了，現在打開終端機來實際操作吧！`nix repl` 是你最好的練習場：

```bash
$ nix repl
```

進入 REPL 後，試試以下練習：

```nix
# 1. 基本型別
nix-repl> "hello" + " " + "world"
"hello world"

nix-repl> 1 + 2
3

nix-repl> if true then "yes" else "no"
"yes"

# 2. Attribute Set
nix-repl> mySet = { a = 1; b = 2; c = 3; }

nix-repl> mySet.a
1

nix-repl> mySet // { b = 99; d = 4; }
{ a = 1; b = 99; c = 3; d = 4; }

# 3. List
nix-repl> myList = [ 10 20 30 ]

nix-repl> builtins.length myList
3

nix-repl> builtins.map (x: x * 2) myList
[ 20 40 60 ]

# 4. Function
nix-repl> double = x: x * 2

nix-repl> double 21
42

nix-repl> add = a: b: a + b

nix-repl> add 10 20
30

# 5. let...in
nix-repl> let x = 10; y = 20; in x + y
30

# 6. with
nix-repl> let s = { a = 1; b = 2; }; in with s; a + b
3

# 7. Attribute Set Destructuring
nix-repl> greet = { name, greeting ? "Hello" }: "${greeting}, ${name}!"

nix-repl> greet { name = "NixOS"; }
"Hello, NixOS!"

nix-repl> greet { name = "NixOS"; greeting = "Hi"; }
"Hi, NixOS!"
```

> 💡 在 `nix repl` 中，你可以用 `:t` 查看某個 expression 的型別，用 `:q` 離開 REPL。

---

## 小結

今天我們涵蓋了 Nix 語言的核心語法：

| 概念 | 語法 | 範例 |
|------|------|------|
| String | `"..."` / `''...''` | `"hello ${name}"` |
| Attribute Set | `{ key = value; }` | `{ name = "nix"; }` |
| List | `[ elem1 elem2 ]` | `[ "vim" "git" ]` |
| Function | `arg: body` | `x: x + 1` |
| Destructuring | `{ a, b }: ...` | `{ name, version }: ...` |
| `let...in` | `let x = 1; in x` | 定義區域變數 |
| `with` | `with set; expr` | 引入 attribute set 的 scope |
| `inherit` | `inherit name;` | 繼承變數到 attribute set |
| 合併 | `a // b` | `{ x = 1; } // { y = 2; }` |
| 串接 | `a ++ b` | `[ 1 ] ++ [ 2 ]` |

這些語法構成了 Nix 語言的骨架，掌握了它們，你就能讀懂大多數 Nix 設定檔，也有能力開始自己動手寫。

**明日預告：Day 9 — 用 Nix 打造你的開發環境（`nix-shell` 與 `devShell`）**

明天我們將把今天學到的 Nix 語言知識付諸實踐，學習如何用 `nix-shell` 和 `flake` 的 `devShell` 來打造可重現的開發環境。不再需要為了不同專案手動安裝各種 dependency，讓 Nix 幫你搞定一切。

---

*這是 NixOS 30 天學習之旅的第 8 天。如果你覺得這篇文章有幫助，歡迎分享給同樣對 Nix 感興趣的朋友！*
