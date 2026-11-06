---
title: "公开密钥密码、DH 密钥交换协议与 RSA"
description: "单向陷门函数、离散对数问题、Diffie–Hellman 密钥交换与 RSA 的密钥生成、加解密及正确性。"
pubDate: "2026-11-06"
category: "Study Notes"
subcategory: "考研复习"
series: "HIT 837"
subject: "信息安全导论"
studySlug: "public-key-cryptography-dh-rsa"
syllabusChapter: "02"
chapterTitle: "密码学基础"
syllabusSection: "2.c"
order: 203
published: true
tags: ["信息安全", "密码学", "公开密钥", "Diffie-Hellman", "RSA"]
---
# 公开密钥密码、DH 密钥交换协议与 RSA


## 1 公开密钥密码

### 1.1 单向陷门函数 $f(x)$

- 给定 $x$，求 $y = f(x)$：**简单**
- 给定 $y$，计算 $x$ 使 $y = f(x)$：**困难**（计算上几乎不可行）
- 存在**陷门** $\delta$：若知道 $\delta$，则求 $x = f^{-1}(y)$ **相对容易**

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 190" width="640" role="img" aria-label="单向陷门函数：正向简单，无陷门时反向困难，有陷门时反向容易">
<style>
text{font-family:'PingFang SC','Microsoft YaHei','Noto Sans CJK SC',sans-serif;fill:#222;text-anchor:middle;font-size:14px}
.s{font-size:13px}
.bx{fill:#fff;stroke:#444;stroke-width:1.5}
.y{fill:#fff3bf}.bl{fill:#d0ebff}
</style>
<defs>
<marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#444"/></marker>
<marker id="r" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#c92a2a"/></marker>
<marker id="g" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#2b8a3e"/></marker>
</defs>
<rect width="640" height="190" fill="#fff"/>
<rect class="bx y" x="40" y="70" width="80" height="80"/><text x="80" y="116" style="font-size:20px">x</text>
<rect class="bx bl" x="520" y="70" width="80" height="80"/><text x="560" y="116" style="font-size:20px">y</text>
<path d="M120 90H520" fill="none" stroke="#444" stroke-width="1.5" marker-end="url(#a)"/>
<text class="s" x="320" y="82">y = f(x)：简单</text>
<path d="M520 118H120" fill="none" stroke="#c92a2a" stroke-width="1.5" stroke-dasharray="6 4" marker-end="url(#r)"/>
<text class="s" x="320" y="136" style="fill:#c92a2a">无陷门：已知 y 求 x 困难</text>
<path d="M520 148H120" fill="none" stroke="#2b8a3e" stroke-width="1.5" marker-end="url(#g)"/>
<text class="s" x="320" y="166" style="fill:#2b8a3e">有陷门 δ：x = f⁻¹(y) 相对容易</text>
</svg>

---

## 2 Diffie–Hellman 密钥交换算法

### 2.1 离散对数问题

#### 素数的原根

若 $a$ 是素数 $p$ 的**原根**，则

$$
a \bmod p,\; a^2 \bmod p,\; \cdots,\; a^{p-1} \bmod p
$$

这 $p-1$ 个数互不相同，并且是 $1$ 到 $p-1$ 之间所有整数的某种排列。

于是，对任意整数 $b$，可找到**唯一**的幂 $i$，使得

$$
b \equiv a^i \pmod p,\qquad 1 \le i \le p-1
$$

> 同余的含义：$b \equiv a \pmod p \iff b \bmod p = a \bmod p$，称 $b$ 与 $a$ 模 $p$ 同余。

称 $i$ 为 $b$ 的以 $a$ 为基数且模 $p$ 的**幂指数**，即**离散对数**。

#### 离散对数问题

对于

$$
y \equiv g^x \pmod p \iff y \bmod p = g^x \bmod p,\qquad g \text{ 为素数 } p \text{ 的原根}
$$

其中 $y, x$ 均为正整数：

- 已知 $g, x, p$，计算 $y$：**容易**
- 已知 $y, g, p$，计算 $x$：**困难**，即求解 $y$ 的离散对数 $x$

### 2.2 D-H 算法

1. Alice 与 Bob 协商出一个大素数 $p$ 和大整数 $g$，$1 < g < p$，$g$ 是 $p$ 的原根。**$p$ 与 $g$ 无需保密。**
2. Alice 计算 $Y = g^x \bmod p$；Bob 计算 $Z = g^m \bmod p$。
3. 双方交换 $Y$ 与 $Z$。
4. Alice 计算 $Z^x$，Bob 计算 $Y^m$，二者相等，即为共享密钥：

$$
(Z)^x = (Y)^m = g^{mx} \bmod p
$$

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 310" width="700" role="img" aria-label="Diffie-Hellman 密钥交换：双方交换 Y 与 Z 后得到相同的共享密钥">
<style>
text{font-family:'PingFang SC','Microsoft YaHei','Noto Sans CJK SC',sans-serif;fill:#222;text-anchor:middle;font-size:14px}
.b{font-size:16px;font-weight:bold}
.s{font-size:12px}
.bx{fill:#fff;stroke:#444;stroke-width:1.5}
.y{fill:#fff3bf}.bl{fill:#d0ebff}.g{fill:#d3f9d8}.o{fill:#ffd8a8}
</style>
<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#444"/></marker></defs>
<rect width="700" height="310" fill="#fff"/>
<rect class="bx y" x="50" y="12" width="600" height="34"/>
<text x="350" y="34" style="font-size:13px">公开协商：大素数 p、大整数 g（1 &lt; g &lt; p，g 是 p 的原根），p 与 g 无需保密</text>
<text class="b" x="150" y="70">Alice</text><text class="b" x="550" y="70">Bob</text>
<rect class="bx o" x="50" y="80" width="200" height="30"/><text x="150" y="100">选择秘密整数 x</text>
<rect class="bx o" x="450" y="80" width="200" height="30"/><text x="550" y="100">选择秘密整数 m</text>
<rect class="bx g" x="50" y="130" width="200" height="36"/>
<text x="150" y="153">Y = g<tspan dy="-6" font-size="10">x</tspan><tspan dy="6"> mod p</tspan></text>
<rect class="bx g" x="450" y="130" width="200" height="36"/>
<text x="550" y="153">Z = g<tspan dy="-6" font-size="10">m</tspan><tspan dy="6"> mod p</tspan></text>
<g fill="none" stroke="#444" stroke-width="1.5" marker-end="url(#a)">
<path d="M150 110V130"/><path d="M550 110V130"/>
<path d="M200 166L500 250"/><path d="M500 166L200 250"/>
</g>
<text class="s" x="266" y="176" style="font-weight:bold">发送 Y</text>
<text class="s" x="434" y="176" style="font-weight:bold">发送 Z</text>
<rect class="bx bl" x="50" y="250" width="200" height="38"/>
<text x="150" y="274">(Z)<tspan dy="-6" font-size="10">x</tspan><tspan dy="6"> mod p</tspan></text>
<rect class="bx bl" x="450" y="250" width="200" height="38"/>
<text x="550" y="274">(Y)<tspan dy="-6" font-size="10">m</tspan><tspan dy="6"> mod p</tspan></text>
<rect class="bx y" x="280" y="250" width="140" height="38"/>
<text x="350" y="268">g<tspan dy="-6" font-size="10">mx</tspan><tspan dy="6"> mod p</tspan></text>
<text class="s" x="350" y="283">共享密钥 K</text>
<text x="265" y="276" style="font-size:20px">=</text><text x="435" y="276" style="font-size:20px">=</text>
</svg>

---

## 3 RSA 公开密钥算法

### 3.1 欧拉定理

若整数 $g$ 与 $n$ 互素，则

$$
g^{\varphi(n)} \equiv 1 \pmod n
$$

其中 $\varphi(n)$ 为比 $n$ 小、但与 $n$ 互素的正整数的个数，称为**欧拉函数**。

当 $n = pq$（$p, q$ 为素数）时：

$$
\varphi(n) = (p-1)(q-1)
$$

**推论**：给定两个素数 $p$ 与 $q$，以及两个整数 $m, n$，满足 $n = p \times q$ 且 $0 < m < n$，则对于任意整数 $k$，下列关系成立：

$$
m^{k\varphi(n)+1} = m^{k(p-1)(q-1)+1} \equiv m \pmod n,\quad\text{即}\quad m^{k\varphi(n)+1} \bmod n = m
$$

### 3.2 密钥生成

1. 选择两个素数 $p, q$
2. 计算 $n = p \times q$，$\varphi(n) = (p-1)(q-1)$
3. 选择整数 $e$，使 $\gcd(\varphi(n), e) = 1$，$1 < e < \varphi(n)$
4. 计算 $d$，使

$$
d = e^{-1} \pmod{\varphi(n)} \iff e \cdot d \bmod \varphi(n) = 1
$$

5. **公钥** $PK = \{e, n\}$，**私钥** $SK = \{d, n\}$

### 3.3 加密与解密

- 加密：$c = m^e \bmod n$
- 解密：$m = c^d \bmod n$

解密的推导：

$$
\begin{aligned}
c^d \bmod n &= m^{ed} \bmod n \\
&= m^{k\varphi(n)+1} \bmod n \\
&= m
\end{aligned}
$$

### 3.4 正确性证明

要证明 $m^{k\varphi(n)+1} \bmod n = m$，分两种情况：

**（1）$m$ 与 $n$ 互素**：由欧拉定理 $m^{\varphi(n)} \equiv 1 \pmod n$，直接得出结论。

**（2）$m$ 与 $n$ 不互素**：由 $n = pq$，$m$ 必是 $p$ 或 $q$ 的倍数。不妨令 $m = m_0 q$，则 $\gcd(m, p) = 1$。由欧拉定理（对素数 $p$）：

$$
m^{p-1} \bmod p = 1 \;\Rightarrow\; m^{k(p-1)(q-1)} \equiv 1 \pmod p
$$

因此存在整数 $k'$ 使 $m^{k\varphi(n)} = k'p + 1$。代入原式：

$$
\begin{aligned}
m^{k\varphi(n)+1} \bmod n &= (k'p+1)\,m \bmod n \\
&= (k'p\,m + m) \bmod n
\end{aligned}
$$

而 $k'p\,m = k'p\,q\,m_0 = k' m_0\, n$，是 $n$ 的倍数，$\bmod\ n$ 为 $0$，所以

$$
m^{k\varphi(n)+1} \bmod n = m
$$

### 3.5 安全性

- RSA 基于**单向函数** $e_K(x) = x^e \pmod n$，求逆很困难（陷门为 $d$）。
- 如果要求 RSA 是安全的，$p, q$ 必须是足够大的素数；已知 $n$，分解出 $p, q$ 极其困难。
- 解密的关键是知道 $\varphi(n) = (p-1)(q-1)$；若能分解 $n$，求 $\varphi(n)$ 就简单得多。