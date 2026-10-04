---
title: "MMMU"
description: "MMMU 多学科多模态理解与推理基准论文笔记。"
pubDate: 2026-09-08
tags:
  - "Multimodal"
  - "Benchmarks"
  - "Reasoning"
---
# MMMU

# Abstract \& Introduction:

MMMU\(Massive Multi\-discipline Multimodal Understanding and Reasoning\)是一个全新的模型评估基准，其主要用处为在需要高级学科知识和详尽推理的大量多学科任务方面对多模态模型进行评估。

MMMU包含了11\.5k的在大学考试中精心收集的多模态问题，这些问题涉及知识面广泛。此外，MMMU专注于使用特定领域的知识进行高级推理，执行类似于专家面对的任务。综上可知，MMMU可用于专家生成式人工智能\(**Expert AGI**\)的评测。

MMMU基准测试满足对模型进行广度和深度两个维度的训练和评测：在广度\(breadth，也可称泛用性generality\)上，MMMU涵盖六个学科，30个不同的主题，183个子领域，具有11\.5k个多模态问题；在深度\(depth，也可称性能performance\)上，MMMU中的很多问题需使用大学知识来解决。

MMMU涵盖不同的图像格式，考验模型的感知能力；同时具有图像和文字的交错输入，要求模型共同理解图像和文本。

# Related Work：

MMMU通过收集更困难的专家级问题与从前的基准形成差距，它需要更加细微的感知，回忆特定领域的知识来逐步推理得出答案。

# The MMMU Benchmark:

## Overview of MMMU:

MMMU用于评估基础模型在广泛的任务中的专家级多模态理解能力

MMMU分为三部分：few\-shot开发集、验证集和测试集；few\-shot数据集包含每个主题5个问题，验证集有约900个问题，测试集有10\.5k个问题。

MMMU基准测试为多模态基础模型引入了四个关键挑战（如图）特别强调了专家级视觉感知能力和详细推理能力

![image\.png](/articles/mmmu/image%203.png)

## Data Curation Process:

1. 数据收集阶段：首先基于视觉输入的原则来决定主题，之后从六个学科中选择30个主题，之后收集多模态问题并用专业知识创造新的问题

2. 数据质量控制：首先清理重复数据，之后检查格式和拼写错误以及分配问题，最后根据难度等级将数据分为四类

## Comparisons with Existing Benchmarks:

MMMU对比其他数据集在深度和广度上进行扩充，从广度的角度来看，MMMU基准测试旨在涵盖30种图像格式的大学级知识，包括图表、表格、图表、化学结构、照片、绘画、几何形状、音乐片、医学图像等。在深度方面，以前的基准通常需要常识知识或简单的物理或时间推理。相比之下，MMMU基准需要对大学级主题知识进行深思熟虑的推理。

![image\.png](/articles/mmmu/image%202.png)



# Experiences:

## Baselines:

### LLMs：

对于各种多模态大模型，使用每个系列中版本最新，规模最大和性能最佳的可用模型进行训练。

### Text\-only LLMs:

对于纯文本llm，选用性能最佳的llm，同时利用通过MMOCR部署的OCR或者LLAVA\-1\.5字幕给llm提供识别后的文本。

### Human Experts:

选用90个大学生，分为30个单位，每单位有三位学生，每个单位负责完成30个问题。此外，学生可以查阅书籍但不能进行联网搜索。



## Main Results:

结果显示，人类专家对该基准测试的准确率高于表中所有大模型，这证明了人类专业知识与当前模型在 MMMU 基准上的性能之间的仍然存在差距。这反映了基准的严格标准。在 Science、Health \& Medicine 和 Technology \&amp; Engineering 等领域，任务通常涉及复杂的感知和复杂的推理，模型的性能较低。

![image\.png](/articles/mmmu/image.png)

## Analysis of Image Types and Difficulties:

对于照片和绘画作品，模型表现良好，但对于不太普遍的图形如几何形状，音乐和化学结构等，模型表现较差。

随着难度提高，模型之间的性能差异逐渐减小，说明当前模型对于专业级问题仍有着巨大限制。



# Error Analysis and Future Work:

![image\.png](/articles/mmmu/image%201.png)

## Perceptual Errors

认知错误\(Percceptual Errors\)很大程度上导致了GPT\-4V的不准确性，其主要分为基础认知错误和专业领域认知错误，前者来源于模型在基础视觉解释上的错误，而后者主要来源于知识储备的不足。

## Lack of Knowledge

专业知识的不足导致模型在解决特定领域的问题时对词语产生误解，进而产生错误的推理。

## Reasoning Errors\&Other Errors





# Conclusion:

总之，MMMU的出现标志着以Expert AGI的视角来评估LLM能力可能会带来重要的发展，为多模态模型的图文结合复杂推理

能力的进步提供了动力和方向。

