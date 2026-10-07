---
title: "Python ACM / OJ 模式：输入与输出"
description: "面向机考的 Python 标准输入、数据解析、标准输出、多组测试、EOF 与性能优化笔记。"
pubDate: 2026-10-04
category: "Computer Science"
subcategory: "Algorithms"
series: "ACM / OJ"
tags:
  - "Huawei Examination"
  - "ACM/OJ"
  - "Python"
  - "Input/Output"
---

# Python ACM/OJ模式：输入与输出

在 LeetCode 中，平台通常负责读取输入、调用函数并检查返回值；在 ACM / OJ 模式中，提交的是一个完整的可执行程序。程序必须自己完成：

1. 从标准输入 \`stdin\` 读取字符
2. 按题目描述解析数据
3. 执行算法
4. 按要求写入标准输出 \`stdout\`

可以把题目理解为一条数据管道：

~~~text
stdin -> 读取 -> 解析 -> 算法 -> 组织答案 -> stdout
~~~

ACM 输入输出的核心是识别输入的层次：有几组测试、每组有几行、每行有几个字段、是否以特殊值或 EOF 结束，以及最终输出是否需要换行、空格或多行。

## 1. 从一行输入开始

\`input()\` 读取一行，并返回字符串：

~~~python
s = input()
# 输入: 10 20 30
# s == "10 20 30"
~~~

因此下面的写法不是把三个数字读入变量，而是尝试按字符拆分：

~~~python
# 不要这样写
a, b, c = input()
~~~

### \`split()\`：按空白切分

~~~python
parts = input().split()
# ["10", "20", "30"]
~~~

不传参数时，\`split()\` 会处理连续空格、Tab 和换行带来的空白。需要整数时，再用 \`map(int, ...)\`：

~~~python
a, b, c = map(int, input().split())
~~~

这行代码等价于：

~~~python
parts = input().split()
a = int(parts[0])
b = int(parts[1])
c = int(parts[2])
~~~

### 读取一整行数组

Python 3 中 \`map()\` 返回迭代器。如果需要列表，需要显式调用 \`list()\`：

~~~python
numbers = list(map(int, input().split()))
# 输入: 1 2 3 4 5
# numbers == [1, 2, 3, 4, 5]
~~~

这条语句可以拆成四步：读取字符串、按空白切分、逐项转成整数、收集成列表。

## 2. 按题目结构读取数据

### 固定数量的一维数据

第一行是 \`n\`，接下来 \`n\` 行每行一个整数时：

~~~python
n = int(input())
numbers = [int(input()) for _ in range(n)]
~~~

### 二维数据

输入为行数、列数，之后有 \`n\` 行：

~~~text
3 4
1 2 3 4
5 6 7 8
9 10 11 12
~~~

~~~python
n, m = map(int, input().split())
matrix = [
    list(map(int, input().split()))
    for _ in range(n)
]
~~~

\`m\` 是结构信息，实际读取时仍应以题目保证的每行字段数量为准。

## 3. 大量输入：\`readline()\` 与 \`read()\`

### 逐行读取

机考中常见的模板是：

~~~python
import sys

input = sys.stdin.readline
n = int(input())
numbers = list(map(int, input().split()))
~~~

\`sys.stdin.readline()\` 通常比 \`input()\` 更适合大量逐行输入。小数据时二者差异不大，只有在输入量很大时才需要优先考虑它。

### 一次读取全部输入

当换行结构不重要，只需要按顺序得到所有数字时，可以使用：

~~~python
import sys

data = list(map(int, sys.stdin.read().split()))
~~~

例如多行输入会被当成一个连续数据流。输入量特别大时，可以进一步使用：

~~~python
data = list(map(int, sys.stdin.buffer.read().split()))
~~~

\`buffer\` 减少文本解码开销，但也让代码更偏向性能优化，确认题目确实需要后再使用。

选择方式时要看题目结构：有明确行含义时使用 \`readline()\`；换行只是排版、数据本质上是连续 token 时使用 \`read()\`。

## 4. 多组测试、哨兵与 EOF

### 第一行给出测试组数

~~~python
T = int(input())
for _ in range(T):
    a, b = map(int, input().split())
    # 独立处理这一组数据
~~~

每组数据必须按自己的边界读取，不能把上一组的数组或状态混入下一组：

~~~python
T = int(input())
for _ in range(T):
    n = int(input())
    values = list(map(int, input().split()))
    # solve(values)
~~~

### 特殊值结束：哨兵 Sentinel

~~~python
while True:
    a, b = map(int, input().split())
    if a == 0 and b == 0:
        break
    # 处理 a, b
~~~

结束标记不属于有效数据，判断后要立即 \`break\`。

### 读到 EOF

题目没有给出组数，也没有哨兵时，输入通常持续到文件结束：

~~~python
import sys

for line in sys.stdin:
    if not line.strip():
        continue
    a, b = map(int, line.split())
    # 处理 a, b
~~~

EOF 是 \`End Of File\`，表示标准输入中已经没有数据。不要把 EOF 和空行混为一谈：空行仍然是读取到的一行，只是内容为空。

## 5. 空行、字符串和 \`strip()\`

规范 OJ 通常不会随意插入空行，但如果题目明确允许空行，可以跳过没有内容的行：

~~~python
while True:
    line = input().strip()
    if line:
        break
~~~

字符串输入不一定要转成整数：

~~~python
a, b = input().split()
text = input().strip()
~~~

\`input()\` 通常已经去掉行尾换行；\`sys.stdin.readline()\` 可能保留 \`\\n\`，这时 \`strip()\` 可以去掉首尾空白。但如果下一步本来就是 \`split()\`，通常不需要额外调用 \`strip()\`。

## 6. 标准输出：严格匹配题目格式

### \`print()\`、\`sep\` 与 \`end\`

~~~python
print(10)
print(1, 2, 3)             # 1 2 3
print(1, 2, 3, sep=",")    # 1,2,3
print(1, end=" ")
print(2)                   # 1 2
~~~

\`print()\` 默认使用 \`sep=" "\` 和 \`end="\\n"\`。题目需要什么分隔符，就显式写出什么分隔符。

### 输出数组

直接输出列表会带有方括号和逗号，通常不是 OJ 要求的格式：

~~~python
values = [1, 2, 3, 4]
print(values)   # [1, 2, 3, 4]
print(*values)  # 1 2 3 4
~~~

需要自定义连接符时使用 \`join()\`：

~~~python
print(" ".join(map(str, values)))
print(",".join(map(str, values)))
~~~

\`join()\` 只能连接字符串，所以整数列表必须先使用 \`map(str, ...)\`。二维数组通常逐行展开：

~~~python
for row in matrix:
    print(*row)
~~~

### 不要输出调试信息

如果题目只要求输出答案 \`2\`，\`Answer: 2\`、\`答案：2\` 或 \`dp = [...]\` 都可能导致判题失败。提交前删除调试输出，只保留题目要求的结果。严格 OJ 甚至会因为多一个空格或额外文本而判错。

## 7. 常用 ACM 输入模板

~~~python
# 第一行一个整数
import sys
input = sys.stdin.readline
n = int(input())
~~~

~~~python
# 第一行多个整数
n, m = map(int, input().split())
~~~

~~~python
# 一行数组
values = list(map(int, input().split()))
~~~

~~~python
# n 行、每行一个整数
n = int(input())
values = [int(input()) for _ in range(n)]
~~~

~~~python
# n 行、每行多个整数
n = int(input())
rows = [list(map(int, input().split())) for _ in range(n)]
~~~

~~~python
# 多组测试
T = int(input())
for _ in range(T):
    # 读取并处理一组数据
    pass
~~~

~~~python
# 直到 EOF
import sys
for line in sys.stdin:
    data = list(map(int, line.split()))
    # 处理 data
~~~

~~~python
# 一次读取全部数据
import sys
data = list(map(int, sys.stdin.read().split()))
~~~

## 8. 推荐的完整程序结构

结构明确的题目可以统一写成：

~~~python
import sys

input = sys.stdin.readline


def solve():
    n = int(input())
    values = list(map(int, input().split()))

    # 算法处理
    answer = ...

    print(answer)


if __name__ == "__main__":
    solve()
~~~

输入特别大时，再考虑 \`sys.stdin.buffer.read()\`。输出很多行时，先构造结果字符串，再一次写出：

~~~python
answers = [1, 2, 3, 4, 5]
sys.stdout.write("\\n".join(map(str, answers)) + "\\n")
~~~

\`sys.stdout.write()\` 只接受字符串，因此 \`sys.stdout.write(123)\` 是错误的，必须先转换为 \`str(123)\`。

## 9. 输入输出知识树

~~~text
Python ACM 输入输出
├── 输入
│   ├── input()                         读取一行字符串
│   ├── split()                        按空白切分
│   ├── map(int, ...)                  字符串转换为整数
│   ├── list(...)                      收集为列表
│   ├── sys.stdin.readline()           逐行读取
│   ├── sys.stdin.read()               一次读取全部文本
│   └── sys.stdin.buffer.read()        大规模输入优化
└── 输出
    ├── print()                        默认空格分隔并换行
    ├── print(*values)                 展开输出数组
    ├── " ".join(map(str, values))     控制字符串格式
    ├── sys.stdout.write()             直接写字符串
    └── 批量构造字符串                 大量输出时减少调用次数
~~~

最值得先练熟的六行：

~~~python
import sys
input = sys.stdin.readline
n = int(input())
values = list(map(int, input().split()))
print(*values)
~~~

以及把全部输入当成数据流读取：

~~~python
data = list(map(int, sys.stdin.read().split()))
~~~

最终要形成的能力是：看到输入描述，就能判断“多少组、每组多少数据、每个数据占几行、是否由 EOF 或特殊值结束”，再把这层结构直接翻译为 \`input\`、\`split\`、\`map\`、\`for\` 和 \`while\`。模板是起点，输入结构才是需要真正理解的内容。
