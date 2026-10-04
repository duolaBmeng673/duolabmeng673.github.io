---
title: "MathVista"
description: "MathVista 视觉数学推理基准论文笔记，整理任务类型、数据集与评测设计。"
pubDate: 2026-09-08
tags:
  - "Multimodal"
  - "Mathematics"
  - "Benchmarks"
---
# MathVista

# Abstract\&Introduction：

大语言模型在视觉环境下的数学推理能力仍未被系统性的研究。MathVista基准测试开创性地将多样化的数学和视觉任务相结合，实验显示当前表现最好的大模型GTP\-4V准确率仍比人类方低10\.4%，表明了MathVista未来将在开发能够处理数学和图像密集交错的现实任务的大模型过程中发挥关键性作用。

一直以来，许多专家致力于开发大语言模型的图像文字结合问题的处理能力，但是这些基础模型在视觉环境中执行数学推理的能力尚未得到系统检查，因此开发一个适用于此类任务的基准测试是必要的。

MathVista作为综合数学推理基准：

1. 包含7种数学推理类型：代数推理、算术推理、几何推理、逻辑推理、数字常识、科学推理和统计推理

2. 关注5个主要任务：图问题回答\(FQA\)、几何问题解决\(GPS\)、数学单词问题\(MWP\)、教科书问答\(TQA\)和视觉问题回答\(VQA\)

3. 涵盖多种图像类型：自然图像、几何图、抽象场景、合成场景以及各种图形、图表和图、科学图形、表格、函数图、拼图测试图等

# The MathVista Dataset:

## Collection Guidelines:

数据集的收集遵循以下准则：

1. 涵盖多个任务和主题并具有现实应用性

2. 包含不同的视觉环境和数学技能

3. 提供不同级别的挑战

4. 为确定性评估提供稳健的评估设置

## Data Collection:

### MathQA datasets:

收集了9个MathQA数据集，共有2666个示例。

### VQA datasets:

设计启发式规则来自动地从大量候选示例中选择进行数学推理的示例。

### Other three new datasets:

为实现拼图测试图的逻辑推理、功能图的统计推理和学术图的科学推理，引入三个数据集：IQTest、FunctionQA 和 PaperQA

## Metadata Annotation:

为全面分析模型在各个方面的推理能力，使用问题类型、答案类型、语言、源、类别、任务、等级级别和视觉上下文等信息对MathVista中的示例进行注释。另外实验证明人工和自动注释实验数据高度相同，证明了自动注释的高准确性。

## Data Preparation and Release:

MathVista包含两个子集：testmin和test，testmin包含1000个示例，而test包含5141个。之后对数据集进行质量检查和数据集分布测试。

## Data Analysis：

![image\.png](/articles/mathvista/image%203.png)

如图表所示，问题类型分为选择题和自由作答题。自由作答题的答案分为整数、浮点数或列表，同时大量的独特图像、问题和答案确保了MATHVISTA中模式的多样性。

# Experiences:

先前工作一直以定性的角度研究基础模型的推理能力，编者提出从定量和定性两个角度基于MathVista基准测试对基础模型进行系统的评估。

## Evaluation Protocols:

MathVista基准测试评估基于短回答文本，其主要步骤分为三步：1\. 回复生成\(response generation\)，答案提取\(answer extraction\)，分数计算\(score calculation\)。

首先，基线根据输入查询（输入有格式模版，包含任务描述、问题、选择、和元数据）生成回答；之后利用GPT\-4提取生成简化回答；最后，将简化答案归一化为所需格式并计算目标度量分数。

MathVista中示例回答为文本答案的多项选择题或数值答案。

![image\.png](/articles/mathvista/image%202.png)

## Experimental Setup\&Experimental Results:

对比各大模型（包括纯文本LLMs、增强LLMs、LLMs on MathVista）的性能，将随机机会和频率猜测作为原始基线，同时引用经验丰富的人工注释者作为人工基线。

纯文本LLMs中，使用思想程序提示\(PoT Programs\-of\-thought\)的2\-shot GPT\-4表现最好。

LLM方面，GPT\-4V表现最佳，但仍然比人类方表现落后10\.4%。此外，由于处理视觉的模型架构、语言等方面的不同，各模型表现差异巨大。

![image\.png](/articles/mathvista/image.png)

## Fine\-grained Results:

编者报告了模型对不同任务的综合学习能力的细粒度分数，综合分析发现，GPT\-4V不仅在几何问题解决\(GPS\)、教科书问答\(TQA\)和数学推理技能\(如代数推理\)等任务上优于人类的表现，而且在包括函数图、几何图、散点图和表在内的视觉环境中表现突出

该论文还对增强LLM\(augmented LLMs\)进行消融实验

## Qualitative Analysis:

团队在实验过程中对模型的故障原因进行分析

![image\.png](/articles/mathvista/image%201.png)

由图\(a\)可知44\.6%的错误由于错误的答案和解释，同时观察到Bard相应部分错误\(6\.8%和8\.1%\)的原因在于得出正确的答案而进行了错误的解释。

由图\(b\)可知49\.6%的反应包含幻觉，分析表明，幻觉是生成基础模型中错误的主要来源。

另外，外部模型增强的视觉信息的质量对准确的视觉感知有影响，从而影响最终的数学推理性能，进而导致错误答案。



# Related Work\&Conclusion：

MathVista是一个旨在系统地分析最先进模型在视觉复杂场景中的数学推理能力的基准，在基准测试中GPT\-4V与人类表现的差异为未来的研究设定了明确的方向，强调了需要将数学推理与视觉理解无缝集成的模型的需求。此外，本文对GPT\-4V的自我验证、自我一致性和聊天机器人交互的探索为未来的研究提供了有价值的见解。

