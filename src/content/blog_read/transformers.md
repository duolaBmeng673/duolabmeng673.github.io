---
title: "Transformers"
description: "Transformer 架构论文笔记，整理编码器、解码器与多头注意力机制。"
pubDate: 2026-09-08
tags:
  - "NLP"
  - "Transformers"
  - "Attention"
---
# Transformers

# 1\.Introduction\&Background

## 1\.递归卷积神经网络

大多数转义模型都基于复杂的递归卷积神经网络，有些表现好的模型将编码器和解码器通过注意力机制连接\(RNN\+Attention\)，其不利之处在于这种固有的顺序性质无法实现模型训练的并行化，而且内存也限制了示例的批处理。

## 2\.Transformers架构

Transformer架构提出完全摈弃递归卷积神经网络，完全依靠注意力机制来构造输入与输出之间的全局依赖关系。Transformers架构支持更多的并行训练，提高了效率；同时利用多项注意力机制抵消注意力的加权平均数导致的有效分辨率降低的效果，有利于处理长序列数据而不丢失重要信息。

# 2\.Model Architecture

## 1\.Encoding\&Decoding

### 图示：

![image\.png](/articles/transformers/image%206.png)

### Encoding编码器：

根据论文描述，编码器由六个相同的层组成，每个层又由两个子层构成：多头注意力机制和位置全连接的前馈网络，每个子层采用残差连接，最后进行层归一化。

每个子层的输出为如图，其中Sublayer\(x\)为子层本身的函数。

![image\.png](/articles/transformers/image%203.png)

为了便于残差连接，所有子层和嵌入层的输出维度为d\(model\)=512。

### Decoding解码器：

解码器在encoding编码器的基础上插入了第三层，对encoding编码器的输出执行多头注意力。层之间仍以残差连接，之后进行层归一化。另外，他们对第一层的多头注意力机制加入了遮蔽。

## 2\.Attention

计算过程包括四个向量：查询、键、值和输出，输出为值的加权和，加权函数由查询值和相应键决定\(?\)

### Scaled Dot\-Product Attention按比例缩放的点积注意力

输入：查询\(Q\)和键\(K\)，维度为dk；值\(V\)，维度为dv。

计算：计算查询和键的点积，之后除以dk的二分之一次方，将结果代入到softmax函数中，得到Attention结果\(Q矩阵是一组查询的注意力函数，矩阵K和V对应键和值\)。

![image\.png](/articles/transformers/image%208.png)

![image\.png](/articles/transformers/image%204.png)

### Multi\-Head Attention多头注意力

由上述描述易知softmax函数结果维度dv与d\(model\)不一致，个人理解该方法在每个子层内并行执行注意力函数，输出维度均为dv，最后对结果进行矩阵投影计算，将维数转化为d\(model\)。

多头注意力有利于使模型关注不同方面的重点信息。

每层多头注意力由h=8层等比例缩放点积注意力构成。

![image\.png](/articles/transformers/image.png)

![image\.png](/articles/transformers/image%205.png)

### Applications of Attention in our Model

首先，参考了序列\-序列模型架构，查询来源于上一个解码器，内存键和值来源于编码器的输出，有利于模型可以关注本序列中的所有位置。

编码器包含自注意力层，键、值、查询来源相同，来源于编码器前一层的输出，编码器的每个位置都可以关注前一层的所有位置。以此类推，编码器一层可以关注包括其本身的所有位置，为保留自回归属性，对非法连接的softmax的输入值加入遮蔽。

## 3\.Position\-wise Feed\-Forward Networks

每层都包含全连接的前馈网络，有两个线性变换构成，中间有一个ReLU激活。

![image\.png](/articles/transformers/image%209.png)

## 4\.Embeddings and Softmax

利用学习嵌入，将输出标记转化为维度为d\(model\)的向量；利用线性变换和softmax函数将解码器输出转换为下一个令牌的概率。

## 5\.Positional Encoding

由于摒弃了递归和卷积，该论文提出通过在编码器和解码器底部输入嵌入中添加位置编码（为便于计算，使其与d\(model\)维度相同）

使用正余弦函数来进行位置编码、学习和固定（pos:位置；i:维度）

![image\.png](/articles/transformers/image%201.png)

易知位置编码的每个维度对应一个函数值，语序模型轻松关注相对位置。

# 3\.Why Self\-Attention

为了表现自注意力机制的优越性，编者将其与递归卷积神经网络构成的典型序列转导编码器和解码器作对比，主要对比三个方面：

1\.每层计算复杂度\(Complexity per Layer\)

2\.可并行计算量\(Sequential Operations\)

3\.网络中远程依赖关系之间的路径长度\(Maximum Path Length\)

数据对比如下所示：

![image\.png](/articles/transformers/image%207.png)

由此可见，自注意力机制在普遍情况下可以做到更少的计算复杂度，可以产生更多的可解释型模型。

# 4\.Training

## Training Data and Batching

数据集来源：标准WMT 2014英语\-德语数据集

批处理：每次批训练包含一组句子对，包含大约25000个源标记和25000个目标标记。

## Hardware and Schedule

硬件：8 \* NVIDIA P100 GPU

训练总时间：3\.5天

## Optimizer优化器

Adam优化器，学习率根据下列公式变化：

![image\.png](/articles/transformers/image%202.png)

## Regularization正则化

将dropout添加到子层输入中进行层归一化，并将其应用于编码器和解码器的嵌入和位置编码中。

# 5\.Results\&Conclusion

1\.机器翻译：Transformers模型比之前最好模型高出2个BLEU以上，且训练成本不足之前最先进模型的1/4，表现优异。

2\.模型变体：团队对基础模型加以适当改动并测试性能得出推断：减少注意力键会损坏模型质量；利用比点积更复杂的函数可能有益；dropout对防止过拟合有帮助。

3\.英语选区分析：除了在特定任务中需要调优，Transformers在大多数情况下表现良好。

总结：Transformers架构达到了新的技术水平高度，未来还有诸多问题可改善，还可应用于图像及音视频处理等他方面。

