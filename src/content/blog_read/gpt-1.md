---
title: "GPT-1"
description: "GPT-1 论文笔记，整理无监督预训练与有监督微调结合的语言理解方法。"
pubDate: 2026-09-08
tags:
  - "NLP"
  - "Language Models"
  - "Pretraining"
---
# GPT\_1

# Abstract\&Introduction

普通自然语言理解模型的训练受到预训练过程中标记数据量的限制，该论文编者证明可以利用未标记文本语料库对模型进行预训练（即无监督学习）且该方法也能产生巨大收益。

人工为数据添加标记费时费力，可处理文本信息的模型提供了一个可行的替代方法。另外，无监督环境下训练的优质模型可能比有监督训练模型具有更好的性能。

同时，利用无标记数据进行训练面临两个挑战：

1. 不清楚哪种优化目标在对文本进行迁移学习时最有效

2. 缺乏受广泛认可的最有效方法

该论文探索一种针对文本理解任务的半监督方法，即将无监督预训练和有监督微调相结合。将训练分为两个步骤：

1. 首先，利用未标记文本给神经网络模型初始化参数

2. 然后，针对有监督目标对参数进行调试，使模型适应特定任务

对于模型架构，GPT采用Transformers架构；对于传输过程，利用遍历方法将结构化文本处理为单个连续标记序列（经证明，这种方法可以在保证对模型架构影响最小的前提下保证微调的有效性）

对于模型评估，利用四种任务进行评估：

1. 自然语言推理

2. 问答

3. 语义相似度分析

4. 文本分类

经评估对比，得知GPT表现优异，与具有针对特定任务的架构的模型相比，在所研究的12个任务中的9个中提高了现有技术水平。



# Related Work

## Semi\-supervised learning for NLP

GPT的研究隶属于自然语言的半监督学习领域内。然而，以前的研究范例大多数迁移词级信息，此团队旨在捕捉更高级别的词义。个人理解为将无标记语料库的句子级或段落级嵌入对象，编码为可以进行目标任务训练的向量表示。

## Unsupervised pre\-training

在GPT之前，有人采用过语言模型建模之后对其进行有监督微调这些方法，不过由于LSTM模型的使用，最终结果的预测能力被限制在短程范围之内。而Transformers的使用允许捕获更远距离的语言结构。

## Auxiliary training objectives

添加辅助无监督训练目标是半监督学习的另一种形式。此前研究证明将辅助语言建模目标添加到目标任务中可以带来标记任务的性能提升。论文编者认为无监督训练已经学习几个目标任务相关的几个方面。

# Framework

## 3\.1 Unsupervised pre\-training

给定一组无监督的tokens语料库 U=\{u1, \. \. \. , un\}，使用标准语言建模目标使该值最大化：

![image\.png](/articles/gpt-1/image%205.png)

k是上下文窗口的大小，条件概率P使用参数为Θ的神经网络建模，用随机梯度下降来训练这些参数。

模型架构使用多层Transformer编码器（transformers变体），该模型能够对上下文tokens进行多头注意力操作，之后在位置前馈层产生目标tokens的输出分布：

![image\.png](/articles/gpt-1/image%208.png)

U = \(u\(−k\),\., u\(−1\)\) 是标记的上下文向量，n是层数，We 是token嵌入矩阵，Wp 是位置嵌入矩阵。

## 3\.2 Supervised fine\-tuning

继预训练之后，根据有监督目标对参数进行调试。

对于数据C=\{x1,x2, \.\.\. ,xm\}，和对应标签y，输入预训练模型来获得最终的Transformers激活h\(l , m\)：

![image\.png](/articles/gpt-1/image%209.png)

进一步提供了最大值目标：

![image\.png](/articles/gpt-1/image%2012.png)

此外，将语言建模目标作为辅助目标加入到微调步骤中可以提高模型的泛化能力并且加速收敛。故可引用3\.1中的L1\(U\)，给其权值为λ：

![image\.png](/articles/gpt-1/image%2013.png)

总体而言，微调期间需要的唯一额外参数为Wy，分隔符标记的嵌入。

## 3\.3 Task\-specific input transformations

为保证GPT的多任务泛用性，需保证输入形式一致，模型可接受的输入为（以文本分类任务为例）

![image\.png](/articles/gpt-1/image%2011.png)

因为该模型基于连续性文本序列进行预训练，编者采用遍历式方法将结构性的输入转化成模型可处理的输入。

### Textual entailment

连接前提p和假设h，中间有分隔符标记\($\)：

![image\.png](/articles/gpt-1/image%202.png)

### Similarity

评估两段文本相似度，对文本顺序没有固有要求，于是可以独立构造两段序列表征（二者文本顺序不同）。在输入到线性输入层之前他们是按元素添加的：

![image\.png](/articles/gpt-1/image%204.png)

### Question Answering and Commonsense Reasoning

对于问答和常识推理任务，考虑正文文档\(z\)，问题\(q\)和一组可能回答\{a\(k\)\}，按照\[z; q; $; a\(k\)\]顺序连接，构造\|\{a\(k\)\}\|个序列，分别独立输入模型，最后在softmax层归一化以产生可能回答的输出分布：

![image\.png](/articles/gpt-1/image%203.png)

# Experiments

## 4\.1 Setup

### Unsupervised pre\-training

无监督训练采用BooksCorpus数据集，一个替代数据集是the 1B Word Benchmark。

### Model specifications

本节主要介绍了模型架构和预训练细节

采用Transformers变体架构：拥有自注意力头的仅有12层的编码器的Transformers。

对于位置前馈网络，使用3072维内部状态和Adam优化器，在 64 个随机采样的连续 512 个标记的序列 minibatch 上训练 100 个 epoch。

### Fine\-tuning details

本节主要介绍了微调过程的细节

## 4\.1 Supervised fine\-tuning

### Natural Language Inference

课题组根据五个数据集进行评估，包括图像字幕 \(SNLI\)、转录语音、流行小说和政府报告 \(MNLI\)、维基百科文章 \(QNLI\)、科学考试 \(SciTail\) 或新闻文章 \(RTE\)，结果如下所示

![image\.png](/articles/gpt-1/image%201.png)

尽管有些结果不太理想\(RTE\)，编者猜测使用更大的数据集可能改善模型性能表现。

### Question answering and commonsense reasoning

使用含有更多推理类型问题的RACE数据集以及还在the Story Cloze Test上进行评估，模型表现由于先前最佳结果

![image\.png](/articles/gpt-1/image.png)

### Semantic Similarity

使用Microsoft Paraphrase 语料库 \(MRPC\)、Quora Question Pairs \(QQP\) 数据集和语义文本相似度基准\(STS\-B\)，在三个语义相似性任务中的两个上获得了最先进的结果

![image\.png](/articles/gpt-1/image%2014.png)

### Classification

利用CoLA数据集和经典二元分类任务进行评估，其结果与最先进的结果相比很有竞争力。

# Analysis

## Impact of number of layers transferred

![image\.png](/articles/gpt-1/image%207.png)

由图像可知，在试验范围内随着迁移层数的增加，两个任务在训练和验证步骤上的验证准确率均有增加，课件每个层在解决特定任务上均有有效功能。

## Zero\-shot Behaviors

为解释语言模型的预训练和transformers架构的有效性的原因，课题组从迁移学习和零样本行为方面入手，设计底层生成模型执行任务而进行无监督微调作为LSTM架构模型与GPT模型作对比，结果显示LSTM模型有更大的方差。相比之下，Transformers架构在迁移学习上性能表现稳定

![image\.png](/articles/gpt-1/image%206.png)

## Ablation studies

从事哪个方面进行消融实验：

1. 有无辅助目标

2. LSTM/Transformers架构

3. 预训练过程有无监督

![image\.png](/articles/gpt-1/image%2010.png)

结果可知当前模型为最佳选择。

# Conclusion

通过引入一个架构，利用任务无关模型获得先进的自然语言理解能力。课题组证明Transformers架构和长距离文本数据集能为模型带来显著的性能提升。

