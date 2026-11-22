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

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 305" width="720" height="305" role="img" aria-label="置换密码加密：按密钥顺序逐列读出明文">
  <title>置换密码加密过程示例</title>
  <desc>以密钥 CIPHER（排序 145326）按行写入明文 attackbeginsatfour，再按顺序号 1 至 6 逐列读出密文 abacnuaiotettgfksr。</desc>
  <g font-family="'PingFang SC','Noto Sans SC','Microsoft YaHei',system-ui,sans-serif">
    <rect x="8" y="8" width="704" height="228" rx="6" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5" data-role="group"/>
    <path d="M136 9 H232 V235 H136 Z" fill="#fffbeb"/>
    <path d="M232 9 H328 V235 H232 Z" fill="#f0fdfa"/>
    <path d="M328 9 H424 V235 H328 Z" fill="#eff6ff"/>
    <path d="M424 9 H520 V235 H424 Z" fill="#fef2f2"/>
    <path d="M520 9 H616 V235 H520 Z" fill="#f8fafc"/>
    <path d="M616 9 H711 V235 H616 Z" fill="#f0fdfa"/>
    <line x1="136" y1="8" x2="136" y2="236" stroke="#94a3b8" stroke-width="1"/>
    <line x1="232" y1="8" x2="232" y2="236" stroke="#94a3b8" stroke-width="1"/>
    <line x1="328" y1="8" x2="328" y2="236" stroke="#94a3b8" stroke-width="1"/>
    <line x1="424" y1="8" x2="424" y2="236" stroke="#94a3b8" stroke-width="1"/>
    <line x1="520" y1="8" x2="520" y2="236" stroke="#94a3b8" stroke-width="1"/>
    <line x1="616" y1="8" x2="616" y2="236" stroke="#94a3b8" stroke-width="1"/>
    <line x1="8" y1="46" x2="712" y2="46" stroke="#94a3b8" stroke-width="1"/>
    <line x1="8" y1="84" x2="712" y2="84" stroke="#1f2937" stroke-width="1.5"/>
    <line x1="8" y1="122" x2="712" y2="122" stroke="#94a3b8" stroke-width="1"/>
    <line x1="8" y1="160" x2="712" y2="160" stroke="#94a3b8" stroke-width="1"/>
    <line x1="8" y1="198" x2="712" y2="198" stroke="#1f2937" stroke-width="1.5"/>
    <text x="72" y="33" text-anchor="middle" font-size="15" font-weight="600" fill="#1f2937">密钥</text>
    <text x="72" y="71" text-anchor="middle" font-size="15" font-weight="600" fill="#1f2937">顺序</text>
    <text x="72" y="147" text-anchor="middle" font-size="15" font-weight="600" fill="#4b5563">明文</text>
    <text x="72" y="223" text-anchor="middle" font-size="15" font-weight="600" fill="#1f2937">读取结果</text>
    <text x="184" y="33" text-anchor="middle" font-size="16" font-weight="600" fill="#92400e">C</text>
    <text x="280" y="33" text-anchor="middle" font-size="16" font-weight="600" fill="#115e59">I</text>
    <text x="376" y="33" text-anchor="middle" font-size="16" font-weight="600" fill="#1e40af">P</text>
    <text x="472" y="33" text-anchor="middle" font-size="16" font-weight="600" fill="#991b1b">H</text>
    <text x="568" y="33" text-anchor="middle" font-size="16" font-weight="600" fill="#1f2937">E</text>
    <text x="664" y="33" text-anchor="middle" font-size="16" font-weight="600" fill="#115e59">R</text>
    <text x="184" y="71" text-anchor="middle" font-size="15" font-weight="600" fill="#92400e">1</text>
    <text x="280" y="71" text-anchor="middle" font-size="15" font-weight="600" fill="#115e59">4</text>
    <text x="376" y="71" text-anchor="middle" font-size="15" font-weight="600" fill="#1e40af">5</text>
    <text x="472" y="71" text-anchor="middle" font-size="15" font-weight="600" fill="#991b1b">3</text>
    <text x="568" y="71" text-anchor="middle" font-size="15" font-weight="600" fill="#1f2937">2</text>
    <text x="664" y="71" text-anchor="middle" font-size="15" font-weight="600" fill="#115e59">6</text>
    <text x="184" y="109" text-anchor="middle" font-size="15" font-weight="400" fill="#92400e">a</text>
    <text x="280" y="109" text-anchor="middle" font-size="15" font-weight="400" fill="#115e59">t</text>
    <text x="376" y="109" text-anchor="middle" font-size="15" font-weight="400" fill="#1e40af">t</text>
    <text x="472" y="109" text-anchor="middle" font-size="15" font-weight="400" fill="#991b1b">a</text>
    <text x="568" y="109" text-anchor="middle" font-size="15" font-weight="400" fill="#1f2937">c</text>
    <text x="664" y="109" text-anchor="middle" font-size="15" font-weight="400" fill="#115e59">k</text>
    <text x="184" y="147" text-anchor="middle" font-size="15" font-weight="400" fill="#92400e">b</text>
    <text x="280" y="147" text-anchor="middle" font-size="15" font-weight="400" fill="#115e59">e</text>
    <text x="376" y="147" text-anchor="middle" font-size="15" font-weight="400" fill="#1e40af">g</text>
    <text x="472" y="147" text-anchor="middle" font-size="15" font-weight="400" fill="#991b1b">i</text>
    <text x="568" y="147" text-anchor="middle" font-size="15" font-weight="400" fill="#1f2937">n</text>
    <text x="664" y="147" text-anchor="middle" font-size="15" font-weight="400" fill="#115e59">s</text>
    <text x="184" y="185" text-anchor="middle" font-size="15" font-weight="400" fill="#92400e">a</text>
    <text x="280" y="185" text-anchor="middle" font-size="15" font-weight="400" fill="#115e59">t</text>
    <text x="376" y="185" text-anchor="middle" font-size="15" font-weight="400" fill="#1e40af">f</text>
    <text x="472" y="185" text-anchor="middle" font-size="15" font-weight="400" fill="#991b1b">o</text>
    <text x="568" y="185" text-anchor="middle" font-size="15" font-weight="400" fill="#1f2937">u</text>
    <text x="664" y="185" text-anchor="middle" font-size="15" font-weight="400" fill="#115e59">r</text>
    <text x="184" y="223" text-anchor="middle" font-size="16" font-weight="600" fill="#92400e">aba</text>
    <text x="280" y="223" text-anchor="middle" font-size="16" font-weight="600" fill="#115e59">tet</text>
    <text x="376" y="223" text-anchor="middle" font-size="16" font-weight="600" fill="#1e40af">tgf</text>
    <text x="472" y="223" text-anchor="middle" font-size="16" font-weight="600" fill="#991b1b">aio</text>
    <text x="568" y="223" text-anchor="middle" font-size="16" font-weight="600" fill="#1f2937">cnu</text>
    <text x="664" y="223" text-anchor="middle" font-size="16" font-weight="600" fill="#115e59">ksr</text>
    <text x="360" y="264" text-anchor="middle" font-size="15" font-weight="400" fill="#4b5563" paint-order="stroke" stroke="#f7f6f2" stroke-width="2" stroke-linejoin="round">按顺序号 1→6 依次读各列：aba ｜ cnu ｜ aio ｜ tet ｜ tgf ｜ ksr</text>
    <text x="360" y="292" text-anchor="middle" font-size="16" font-weight="600" fill="#1f2937" paint-order="stroke" stroke="#f7f6f2" stroke-width="2" stroke-linejoin="round">密文 = abacnuaiotettgfksr</text>
  </g>
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


<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 332" width="720" height="332" role="img" aria-label="置换密码解密：按顺序把密文段写入各列，再按行读出明文">
  <title>置换密码解密过程示例</title>
  <desc>收到密文 abacnuaiotettgfksr 后按每 3 字母一段、依顺序号 1 至 6 填入对应列，最后按行读出明文 attackbeginsatfour。</desc>
  <g font-family="'PingFang SC','Noto Sans SC','Microsoft YaHei',system-ui,sans-serif">
    <rect x="8" y="8" width="614" height="228" rx="6" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5" data-role="group"/>
    <path d="M130 9 H212 V235 H130 Z" fill="#fffbeb"/>
    <path d="M212 9 H294 V235 H212 Z" fill="#f0fdfa"/>
    <path d="M294 9 H376 V235 H294 Z" fill="#eff6ff"/>
    <path d="M376 9 H458 V235 H376 Z" fill="#fef2f2"/>
    <path d="M458 9 H540 V235 H458 Z" fill="#f8fafc"/>
    <path d="M540 9 H621 V235 H540 Z" fill="#f0fdfa"/>
    <line x1="130" y1="8" x2="130" y2="236" stroke="#94a3b8" stroke-width="1"/>
    <line x1="212" y1="8" x2="212" y2="236" stroke="#94a3b8" stroke-width="1"/>
    <line x1="294" y1="8" x2="294" y2="236" stroke="#94a3b8" stroke-width="1"/>
    <line x1="376" y1="8" x2="376" y2="236" stroke="#94a3b8" stroke-width="1"/>
    <line x1="458" y1="8" x2="458" y2="236" stroke="#94a3b8" stroke-width="1"/>
    <line x1="540" y1="8" x2="540" y2="236" stroke="#94a3b8" stroke-width="1"/>
    <line x1="8" y1="46" x2="622" y2="46" stroke="#94a3b8" stroke-width="1"/>
    <line x1="8" y1="84" x2="622" y2="84" stroke="#1f2937" stroke-width="1.5"/>
    <line x1="8" y1="122" x2="622" y2="122" stroke="#94a3b8" stroke-width="1"/>
    <line x1="8" y1="160" x2="622" y2="160" stroke="#94a3b8" stroke-width="1"/>
    <line x1="8" y1="198" x2="622" y2="198" stroke="#1f2937" stroke-width="1.5"/>
    <text x="69" y="33" text-anchor="middle" font-size="15" font-weight="600" fill="#1f2937">密钥</text>
    <text x="69" y="71" text-anchor="middle" font-size="15" font-weight="600" fill="#1f2937">顺序</text>
    <text x="69" y="147" text-anchor="middle" font-size="15" font-weight="600" fill="#4b5563">明文</text>
    <text x="69" y="223" text-anchor="middle" font-size="15" font-weight="600" fill="#1f2937">密文段</text>
    <text x="171" y="33" text-anchor="middle" font-size="16" font-weight="600" fill="#92400e">C</text>
    <text x="253" y="33" text-anchor="middle" font-size="16" font-weight="600" fill="#115e59">I</text>
    <text x="335" y="33" text-anchor="middle" font-size="16" font-weight="600" fill="#1e40af">P</text>
    <text x="417" y="33" text-anchor="middle" font-size="16" font-weight="600" fill="#991b1b">H</text>
    <text x="499" y="33" text-anchor="middle" font-size="16" font-weight="600" fill="#1f2937">E</text>
    <text x="581" y="33" text-anchor="middle" font-size="16" font-weight="600" fill="#115e59">R</text>
    <text x="171" y="71" text-anchor="middle" font-size="15" font-weight="600" fill="#92400e">1</text>
    <text x="253" y="71" text-anchor="middle" font-size="15" font-weight="600" fill="#115e59">4</text>
    <text x="335" y="71" text-anchor="middle" font-size="15" font-weight="600" fill="#1e40af">5</text>
    <text x="417" y="71" text-anchor="middle" font-size="15" font-weight="600" fill="#991b1b">3</text>
    <text x="499" y="71" text-anchor="middle" font-size="15" font-weight="600" fill="#1f2937">2</text>
    <text x="581" y="71" text-anchor="middle" font-size="15" font-weight="600" fill="#115e59">6</text>
    <text x="171" y="109" text-anchor="middle" font-size="15" font-weight="400" fill="#92400e">a</text>
    <text x="253" y="109" text-anchor="middle" font-size="15" font-weight="400" fill="#115e59">t</text>
    <text x="335" y="109" text-anchor="middle" font-size="15" font-weight="400" fill="#1e40af">t</text>
    <text x="417" y="109" text-anchor="middle" font-size="15" font-weight="400" fill="#991b1b">a</text>
    <text x="499" y="109" text-anchor="middle" font-size="15" font-weight="400" fill="#1f2937">c</text>
    <text x="581" y="109" text-anchor="middle" font-size="15" font-weight="400" fill="#115e59">k</text>
    <text x="171" y="147" text-anchor="middle" font-size="15" font-weight="400" fill="#92400e">b</text>
    <text x="253" y="147" text-anchor="middle" font-size="15" font-weight="400" fill="#115e59">e</text>
    <text x="335" y="147" text-anchor="middle" font-size="15" font-weight="400" fill="#1e40af">g</text>
    <text x="417" y="147" text-anchor="middle" font-size="15" font-weight="400" fill="#991b1b">i</text>
    <text x="499" y="147" text-anchor="middle" font-size="15" font-weight="400" fill="#1f2937">n</text>
    <text x="581" y="147" text-anchor="middle" font-size="15" font-weight="400" fill="#115e59">s</text>
    <text x="171" y="185" text-anchor="middle" font-size="15" font-weight="400" fill="#92400e">a</text>
    <text x="253" y="185" text-anchor="middle" font-size="15" font-weight="400" fill="#115e59">t</text>
    <text x="335" y="185" text-anchor="middle" font-size="15" font-weight="400" fill="#1e40af">f</text>
    <text x="417" y="185" text-anchor="middle" font-size="15" font-weight="400" fill="#991b1b">o</text>
    <text x="499" y="185" text-anchor="middle" font-size="15" font-weight="400" fill="#1f2937">u</text>
    <text x="581" y="185" text-anchor="middle" font-size="15" font-weight="400" fill="#115e59">r</text>
    <text x="171" y="223" text-anchor="middle" font-size="16" font-weight="600" fill="#92400e">aba</text>
    <text x="253" y="223" text-anchor="middle" font-size="16" font-weight="600" fill="#115e59">tet</text>
    <text x="335" y="223" text-anchor="middle" font-size="16" font-weight="600" fill="#1e40af">tgf</text>
    <text x="417" y="223" text-anchor="middle" font-size="16" font-weight="600" fill="#991b1b">aio</text>
    <text x="499" y="223" text-anchor="middle" font-size="16" font-weight="600" fill="#1f2937">cnu</text>
    <text x="581" y="223" text-anchor="middle" font-size="16" font-weight="600" fill="#115e59">ksr</text>
    <text x="644" y="109" text-anchor="start" font-size="15" font-weight="600" fill="#1e40af" paint-order="stroke" stroke="#f7f6f2" stroke-width="2" stroke-linejoin="round">→ attack</text>
    <text x="644" y="147" text-anchor="start" font-size="15" font-weight="600" fill="#1e40af" paint-order="stroke" stroke="#f7f6f2" stroke-width="2" stroke-linejoin="round">→ begins</text>
    <text x="644" y="185" text-anchor="start" font-size="15" font-weight="600" fill="#1e40af" paint-order="stroke" stroke="#f7f6f2" stroke-width="2" stroke-linejoin="round">→ atfour</text>
    <text x="360" y="264" text-anchor="middle" font-size="15" font-weight="400" fill="#4b5563" paint-order="stroke" stroke="#f7f6f2" stroke-width="2" stroke-linejoin="round">密文每 3 个字母一段：aba ｜ cnu ｜ aio ｜ tet ｜ tgf ｜ ksr</text>
    <text x="360" y="290" text-anchor="middle" font-size="15" font-weight="400" fill="#4b5563" paint-order="stroke" stroke="#f7f6f2" stroke-width="2" stroke-linejoin="round">按顺序号 1→6 依次将各段填入对应的列</text>
    <text x="360" y="318" text-anchor="middle" font-size="16" font-weight="600" fill="#1f2937" paint-order="stroke" stroke="#f7f6f2" stroke-width="2" stroke-linejoin="round">最后按行读出明文：attackbeginsatfour</text>
  </g>
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

