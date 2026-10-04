---
title: "SpreadsheetLLM"
description: "SpreadsheetLLM 论文笔记，整理 SheetCompressor 表格编码与压缩方法。"
pubDate: 2026-09-08
tags:
  - "LLM"
  - "Spreadsheets"
  - "Compression"
---
# SpreadsheetLLM

# Abstract\&Introduction:

LLM在电子表格处理方面有着巨大潜力，但其性能受到token约束的限制，为此论文提出SheetCompresessor编码框架，可以有效地压缩LLM电子表格，今儿显著提高电子表格检测任务的性能，该编码框架包含三个部分：

1. **保留有助于高效布局理解的结构锚：**

大型电子表格通常包含大量的同质行或列，为解决该问题，我们识别结构锚点，即表边界的异构行和列。

2. **token编码优化：**

弃用vanilla编码，采用json编码的形式。创建字典，合并具有相同数据的单元格的位置以减少token占用。

3. **对数据类型进行范围标注：**

考虑到精确的数值对于理解电子表格结构不太关键，而Excel结构通常将相同数据结构的数据聚集在一起，因此对不同区域的数据进行数据结构标注。

综上，效果如图所示

![image\.png](/articles/spreadsheet-llm/image.png)

该论文有以下贡献：1、提出SpreadSheet工作和SheetCompresessor编码；2、微调尖端LLM并证明SpreadSheet方法的超高性能；3、提出了 CoS 并在扩展表 QA 上对其进行了验证，突出了其在智能用户交互方面的潜力。



