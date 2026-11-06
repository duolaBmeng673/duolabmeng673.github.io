---
title: "密码分类、作用与基本设计原理"
description: "古典替换密码、统计密码分析、多表代替与置换密码的基本原理及示例。"
pubDate: "2026-11-06"
category: "Study Notes"
subcategory: "考研复习"
series: "HIT 837"
subject: "信息安全导论"
studySlug: "classical-ciphers-design-principles"
syllabusChapter: "02"
chapterTitle: "密码学基础"
syllabusSection: "2.a"
order: 201
published: true
tags: ["信息安全", "密码学", "古典密码", "置换密码"]
---
# 第二章 密码学基础


## 1 古典替换密码

### 1.1 移位密码（Shift Cipher）

将明文字母沿字母表右移 $k$ 个位置，对字母表长度 $q$ 做模运算。

- 加密函数：$E_k(m) = (m + k) \bmod q \;\to\; c$
- 解密函数：$D_k(c) = (c - k) \bmod q \;\to\; m$

> **凯撒密码**是 $q = 26,\ k = 3$ 的移位密码。

### 1.2 乘数密码（Multiplicative Cipher）

- 加密函数：$E_k(m) = k \cdot m \bmod q = c$
- 密钥条件：$\gcd(k, q) = 1$，即 $k$ 与 $q$ 的最大公因子为 1

当 $q = 26$ 时，密钥空间为：

$$
K = \{\, k \in \mathbb{Z} \mid 0 < k < 26,\ \gcd(k, 26) = 1 \,\}
$$

- 解密函数：

$$
D_{k^{-1}}(c) = k^{-1} c \bmod q = k^{-1}\,(k \cdot m \bmod q) \bmod q = m
$$

其中 $k^{-1}$ 为 $k$ 在模 $q$ 下的**乘法逆元**：

$$
k^{-1} \cdot k \bmod q = 1 \iff k^{-1} \cdot k = nq + 1,\qquad \gcd(k, q) = 1
$$

### 1.3 仿射密码（Affine Cipher）

仿射密码 = 移位密码 + 乘数密码。

密钥空间：

$$
K = \{\, (k_1, k_2) \in \mathbb{Z}^2 \mid 0 < k_1, k_2 < 26,\ \gcd(k_1, 26) = 1 \,\}
$$

- 加密函数：$E_k(m) = (k_1 m + k_2) \bmod q$
- 解密函数：$D_k(c) = k_1^{-1}\,(c - k_2) \bmod q$
- 密钥：$k = (k_1, k_2)$

---

## 2 基于统计的密码分析

- 简单替代密码是明文字母到密文字母的**一一映射**。
- 攻击者可统计密文中各字母的使用频度，与正常英文字母的使用频度进行匹配分析。
- 如果密文信息足够长，则很容易被破译。

---

## 3 多表代替密码

### 维吉尼亚密码（Vigenère Cipher）

$$
E_k(m) = C_1 C_2 \cdots C_n,\qquad C_i = (m_i + k_i) \bmod 26
$$

密钥 $k$ 可通过周期性反复使用，以达到任意长度。

---

## 4 置换密码（Transposition Cipher）

置换密码是按照某一规则**重新排列消息中的比特或字符顺序**（字符本身不变，只改变位置）。

### 4.1 密钥顺序的确定

以密钥 `CIPHER` 为例：按英文字母在 26 个字母中的先后顺序，得到密钥中每个字母的相对先后顺序。密钥中没有 A 和 B，因此 C 为第 1；同理 E 为第 2，H 为第 3，……，R 为第 6。于是密钥字母的相对先后顺序为 `145326`。

### 4.2 加密

将明文 `attackbeginsatfour` 按行写入，每行 6 个字符；再按密钥顺序 1 → 6 依次**按列**读出。

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 456 300" width="456" role="img" aria-label="置换密码加密：按密钥顺序逐列读出明文">
<style>
text{font-family:ui-monospace,Menlo,Consolas,'PingFang SC','Microsoft YaHei',monospace;fill:#222;text-anchor:middle}
.m{font-size:18px}
.l{font-size:14px;font-family:'PingFang SC','Microsoft YaHei',sans-serif}
.b{font-size:16px;font-weight:bold}
</style>
<rect x="20" y="20" width="80" height="216" fill="#f1f3f5"/>
<rect x="100" y="20" width="56" height="216" fill="#fff3bf"/>
<rect x="156" y="20" width="56" height="216" fill="#d3f9d8"/>
<rect x="212" y="20" width="56" height="216" fill="#d0ebff"/>
<rect x="268" y="20" width="56" height="216" fill="#ffe3e3"/>
<rect x="324" y="20" width="56" height="216" fill="#e5dbff"/>
<rect x="380" y="20" width="56" height="216" fill="#c5f6fa"/>
<g stroke="#555" stroke-width="1">
<line x1="20" y1="20" x2="436" y2="20"/>
<line x1="20" y1="56" x2="436" y2="56"/>
<line x1="20" y1="128" x2="436" y2="128" stroke-opacity=".35"/>
<line x1="20" y1="164" x2="436" y2="164" stroke-opacity=".35"/>
<line x1="20" y1="236" x2="436" y2="236"/>
<line x1="20" y1="20" x2="20" y2="236"/>
<line x1="100" y1="20" x2="100" y2="236"/>
<line x1="156" y1="20" x2="156" y2="236"/>
<line x1="212" y1="20" x2="212" y2="236"/>
<line x1="268" y1="20" x2="268" y2="236"/>
<line x1="324" y1="20" x2="324" y2="236"/>
<line x1="380" y1="20" x2="380" y2="236"/>
<line x1="436" y1="20" x2="436" y2="236"/>
</g>
<g stroke="#555" stroke-width="2">
<line x1="20" y1="92" x2="436" y2="92"/>
<line x1="20" y1="200" x2="436" y2="200"/>
</g>
<text class="l" x="60" y="43">密钥</text>
<text class="l" x="60" y="79">顺序</text>
<text class="l" x="60" y="155">明文</text>
<text class="l" x="60" y="223">读取结果</text>
<g class="m">
<text x="128" y="44">C</text><text x="184" y="44">I</text><text x="240" y="44">P</text><text x="296" y="44">H</text><text x="352" y="44">E</text><text x="408" y="44">R</text>
<text x="128" y="80">1</text><text x="184" y="80">4</text><text x="240" y="80">5</text><text x="296" y="80">3</text><text x="352" y="80">2</text><text x="408" y="80">6</text>
<text x="128" y="116">a</text><text x="184" y="116">t</text><text x="240" y="116">t</text><text x="296" y="116">a</text><text x="352" y="116">c</text><text x="408" y="116">k</text>
<text x="128" y="152">b</text><text x="184" y="152">e</text><text x="240" y="152">g</text><text x="296" y="152">i</text><text x="352" y="152">n</text><text x="408" y="152">s</text>
<text x="128" y="188">a</text><text x="184" y="188">t</text><text x="240" y="188">f</text><text x="296" y="188">o</text><text x="352" y="188">u</text><text x="408" y="188">r</text>
<text x="128" y="224" font-weight="bold">aba</text><text x="184" y="224" font-weight="bold">tet</text><text x="240" y="224" font-weight="bold">tgf</text><text x="296" y="224" font-weight="bold">aio</text><text x="352" y="224" font-weight="bold">cnu</text><text x="408" y="224" font-weight="bold">ksr</text>
</g>
<text class="l" x="228" y="262">按顺序号 1→6 依次读各列：aba ｜ cnu ｜ aio ｜ tet ｜ tgf ｜ ksr</text>
<text class="b" x="228" y="288">密文 = abacnuaiotettgfksr</text>
</svg>

读取步骤：

| 顺序 | 对应密钥字母 | 读出的明文列 |
| :-: | :-: | :-: |
| 1 | C | `aba` |
| 2 | E | `cnu` |
| 3 | H | `aio` |
| 4 | I | `tet` |
| 5 | P | `tgf` |
| 6 | R | `ksr` |

因此密文为：`abacnuaiotettgfksr`

### 4.3 解密

收到密文 `abacnuaiotettgfksr` 后，按顺序号 1 → 6 依次把各段密文**写入对应的列**，写完后**按行读出**明文。


<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 320" width="540" role="img" aria-label="置换密码解密：按顺序把密文段写入各列，再按行读出明文">
<style>
text{font-family:ui-monospace,Menlo,Consolas,'PingFang SC','Microsoft YaHei',monospace;fill:#222;text-anchor:middle}
.m{font-size:18px}
.l{font-size:14px;font-family:'PingFang SC','Microsoft YaHei',sans-serif}
.s{font-size:13px;font-family:'PingFang SC','Microsoft YaHei',sans-serif}
.r{font-size:16px;text-anchor:start}
.b{font-size:14px;font-weight:bold;font-family:'PingFang SC','Microsoft YaHei',sans-serif}
</style>
<rect x="20" y="20" width="80" height="216" fill="#f1f3f5"/>
<rect x="100" y="20" width="56" height="216" fill="#fff3bf"/>
<rect x="156" y="20" width="56" height="216" fill="#d3f9d8"/>
<rect x="212" y="20" width="56" height="216" fill="#d0ebff"/>
<rect x="268" y="20" width="56" height="216" fill="#ffe3e3"/>
<rect x="324" y="20" width="56" height="216" fill="#e5dbff"/>
<rect x="380" y="20" width="56" height="216" fill="#c5f6fa"/>
<g stroke="#555" stroke-width="1">
<line x1="20" y1="20" x2="436" y2="20"/>
<line x1="20" y1="56" x2="436" y2="56"/>
<line x1="20" y1="128" x2="436" y2="128" stroke-opacity=".35"/>
<line x1="20" y1="164" x2="436" y2="164" stroke-opacity=".35"/>
<line x1="20" y1="236" x2="436" y2="236"/>
<line x1="20" y1="20" x2="20" y2="236"/>
<line x1="100" y1="20" x2="100" y2="236"/>
<line x1="156" y1="20" x2="156" y2="236"/>
<line x1="212" y1="20" x2="212" y2="236"/>
<line x1="268" y1="20" x2="268" y2="236"/>
<line x1="324" y1="20" x2="324" y2="236"/>
<line x1="380" y1="20" x2="380" y2="236"/>
<line x1="436" y1="20" x2="436" y2="236"/>
</g>
<g stroke="#555" stroke-width="2">
<line x1="20" y1="92" x2="436" y2="92"/>
<line x1="20" y1="200" x2="436" y2="200"/>
</g>
<text class="l" x="60" y="43">密钥</text>
<text class="l" x="60" y="79">顺序</text>
<text class="l" x="60" y="155">明文</text>
<text class="l" x="60" y="223">密文段</text>
<g class="m">
<text x="128" y="44">C</text><text x="184" y="44">I</text><text x="240" y="44">P</text><text x="296" y="44">H</text><text x="352" y="44">E</text><text x="408" y="44">R</text>
<text x="128" y="80">1</text><text x="184" y="80">4</text><text x="240" y="80">5</text><text x="296" y="80">3</text><text x="352" y="80">2</text><text x="408" y="80">6</text>
<text x="128" y="116">a</text><text x="184" y="116">t</text><text x="240" y="116">t</text><text x="296" y="116">a</text><text x="352" y="116">c</text><text x="408" y="116">k</text>
<text x="128" y="152">b</text><text x="184" y="152">e</text><text x="240" y="152">g</text><text x="296" y="152">i</text><text x="352" y="152">n</text><text x="408" y="152">s</text>
<text x="128" y="188">a</text><text x="184" y="188">t</text><text x="240" y="188">f</text><text x="296" y="188">o</text><text x="352" y="188">u</text><text x="408" y="188">r</text>
<text x="128" y="224" font-weight="bold">aba</text><text x="184" y="224" font-weight="bold">tet</text><text x="240" y="224" font-weight="bold">tgf</text><text x="296" y="224" font-weight="bold">aio</text><text x="352" y="224" font-weight="bold">cnu</text><text x="408" y="224" font-weight="bold">ksr</text>
</g>
<text class="r" x="450" y="116">→ attack</text>
<text class="r" x="450" y="152">→ begins</text>
<text class="r" x="450" y="188">→ atfour</text>
<text class="s" x="228" y="262">密文每 3 个字母一段：aba ｜ cnu ｜ aio ｜ tet ｜ tgf ｜ ksr</text>
<text class="s" x="228" y="282">按顺序号 1→6 依次将各段填入对应的列</text>
<text class="b" x="228" y="308">最后按行读出明文：attackbeginsatfour</text>
</svg>


解密步骤：

| 顺序 | 写入的密文段 | 写入的列（对应密钥字母） |
| :-: | :-: | :-: |
| 1 | `aba` | 第 1 列（C） |
| 2 | `cnu` | 第 5 列（E） |
| 3 | `aio` | 第 4 列（H） |
| 4 | `tet` | 第 2 列（I） |
| 5 | `tgf` | 第 3 列（P） |
| 6 | `ksr` | 第 6 列（R） |

最后按行读出明文：`attackbeginsatfour`

