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

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 170" width="720" height="170" role="img" aria-label="单向陷门函数：正向简单，无陷门时反向困难，有陷门时反向容易">
  <title>单向陷门函数正向与逆向计算难度对比</title>
  <desc>从 x 计算 y=f(x) 正向简单；已知 y 无陷门求 x 困难；掌握陷门 δ 时求逆 x=f⁻¹(y) 相对容易。</desc>
  <defs>
    <marker id="td-k" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M2 1L8 5L2 9" fill="none" stroke="#1f2937" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
    <marker id="td-r" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M2 1L8 5L2 9" fill="none" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
    <marker id="td-t" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M2 1L8 5L2 9" fill="none" stroke="#14b8a6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
  </defs>
  <g font-family="'PingFang SC','Noto Sans SC','Microsoft YaHei',system-ui,sans-serif">
    <rect x="8" y="20" width="112" height="128" rx="8" fill="#fffbeb" stroke="#f59e0b" stroke-width="1.5"/>
    <text x="64" y="90" text-anchor="middle" font-size="18" font-weight="600" fill="#92400e">x</text>
    <rect x="600" y="20" width="112" height="128" rx="8" fill="#eff6ff" stroke="#3b82f6" stroke-width="1.5"/>
    <text x="656" y="90" text-anchor="middle" font-size="18" font-weight="600" fill="#1e40af">y</text>
    <path d="M120 38 H592" fill="none" stroke="#1f2937" stroke-width="1.5" marker-end="url(#td-k)"/>
    <text x="360" y="24" text-anchor="middle" font-size="15" font-weight="600" fill="#1f2937" paint-order="stroke" stroke="#f7f6f2" stroke-width="2" stroke-linejoin="round">y = f(x)：简单</text>
    <path d="M600 84 H128" fill="none" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="6 4" marker-end="url(#td-r)"/>
    <text x="360" y="108" text-anchor="middle" font-size="15" font-weight="600" fill="#991b1b" paint-order="stroke" stroke="#f7f6f2" stroke-width="2" stroke-linejoin="round">无陷门：已知 y 求 x 困难</text>
    <path d="M600 130 H128" fill="none" stroke="#14b8a6" stroke-width="1.5" marker-end="url(#td-t)"/>
    <text x="360" y="156" text-anchor="middle" font-size="15" font-weight="600" fill="#115e59" paint-order="stroke" stroke="#f7f6f2" stroke-width="2" stroke-linejoin="round">有陷门 δ：x = f⁻¹(y) 相对容易</text>
  </g>
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

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 416" width="720" height="416" role="img" aria-label="Diffie-Hellman 密钥交换：双方交换 Y 与 Z 后得到相同的共享密钥">
  <title>Diffie-Hellman 密钥交换流程</title>
  <desc>Alice 与 Bob 公开协商大素数 p 与原根 g，各自选取秘密整数 x 与 m 计算 Y=g^x mod p 和 Z=g^m mod p 并交换，双方独立算得相同共享密钥 K=g^(mx) mod p。</desc>
  <defs>
    <marker id="dh-k" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M2 1L8 5L2 9" fill="none" stroke="#1f2937" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
  </defs>
  <g font-family="'PingFang SC','Noto Sans SC','Microsoft YaHei',system-ui,sans-serif">
    <rect x="8" y="8" width="704" height="48" rx="8" fill="#fffbeb" stroke="#f59e0b" stroke-width="1.5"/>
    <text x="360" y="38" text-anchor="middle" font-size="15" font-weight="600" fill="#92400e">公开协商：大素数 p、原根 g（1 &lt; g &lt; p，p 与 g 无需保密）</text>
    <text x="118" y="84" text-anchor="middle" font-size="16" font-weight="600" fill="#1e40af" paint-order="stroke" stroke="#f7f6f2" stroke-width="2" stroke-linejoin="round">Alice</text>
    <text x="602" y="84" text-anchor="middle" font-size="16" font-weight="600" fill="#115e59" paint-order="stroke" stroke="#f7f6f2" stroke-width="2" stroke-linejoin="round">Bob</text>
    <rect x="8" y="98" width="220" height="44" rx="8" fill="#eff6ff" stroke="#3b82f6" stroke-width="1.5"/>
    <text x="118" y="126" text-anchor="middle" font-size="15" font-weight="400" fill="#1e40af">选择秘密整数 x</text>
    <rect x="492" y="98" width="220" height="44" rx="8" fill="#f0fdfa" stroke="#14b8a6" stroke-width="1.5"/>
    <text x="602" y="126" text-anchor="middle" font-size="15" font-weight="400" fill="#115e59">选择秘密整数 m</text>
    <line x1="118" y1="142" x2="118" y2="164" stroke="#1f2937" stroke-width="1.5" marker-end="url(#dh-k)"/>
    <line x1="602" y1="142" x2="602" y2="164" stroke="#1f2937" stroke-width="1.5" marker-end="url(#dh-k)"/>
    <rect x="8" y="170" width="220" height="46" rx="8" fill="#eff6ff" stroke="#3b82f6" stroke-width="1.5"/>
    <text x="118" y="199" text-anchor="middle" font-size="15" font-weight="600" fill="#1e40af">Y = g^x mod p</text>
    <rect x="492" y="170" width="220" height="46" rx="8" fill="#f0fdfa" stroke="#14b8a6" stroke-width="1.5"/>
    <text x="602" y="199" text-anchor="middle" font-size="15" font-weight="600" fill="#115e59">Z = g^m mod p</text>
    <path d="M188 216 L532 328" fill="none" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#dh-k)"/>
    <text x="208" y="256" text-anchor="middle" font-size="15" font-weight="600" fill="#1e40af" paint-order="stroke" stroke="#f7f6f2" stroke-width="2" stroke-linejoin="round">发送 Y</text>
    <path d="M532 216 L188 328" fill="none" stroke="#14b8a6" stroke-width="1.5" marker-end="url(#dh-k)"/>
    <text x="512" y="256" text-anchor="middle" font-size="15" font-weight="600" fill="#115e59" paint-order="stroke" stroke="#f7f6f2" stroke-width="2" stroke-linejoin="round">发送 Z</text>
    <rect x="8" y="334" width="204" height="74" rx="8" fill="#eff6ff" stroke="#3b82f6" stroke-width="1.5"/>
    <text x="110" y="377" text-anchor="middle" font-size="15" font-weight="600" fill="#1e40af">(Z)^x mod p</text>
    <text x="234" y="378" text-anchor="middle" font-size="18" font-weight="600" fill="#1f2937" paint-order="stroke" stroke="#f7f6f2" stroke-width="2" stroke-linejoin="round">=</text>
    <rect x="256" y="334" width="208" height="74" rx="8" fill="#fffbeb" stroke="#f59e0b" stroke-width="2"/>
    <text x="360" y="362" text-anchor="middle" font-size="15" font-weight="600" fill="#92400e">g^(mx) mod p</text>
    <text x="360" y="389" text-anchor="middle" font-size="15" font-weight="600" fill="#92400e">共享密钥 K</text>
    <text x="486" y="378" text-anchor="middle" font-size="18" font-weight="600" fill="#1f2937" paint-order="stroke" stroke="#f7f6f2" stroke-width="2" stroke-linejoin="round">=</text>
    <rect x="508" y="334" width="204" height="74" rx="8" fill="#f0fdfa" stroke="#14b8a6" stroke-width="1.5"/>
    <text x="610" y="377" text-anchor="middle" font-size="15" font-weight="600" fill="#115e59">(Y)^m mod p</text>
  </g>
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