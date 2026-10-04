---
title: "TableSense"
description: "TableSense 电子表格表格检测框架论文笔记，记录单元格特征、CNN 与主动学习。"
pubDate: 2026-09-08
tags:
  - "Computer Vision"
  - "Spreadsheets"
  - "Detection"
---
# TableSense

# Introduction:

TableSense是一种用于电子表格表检测的新型端到端框架。题者为其设计了单元格特征化的方案以更好的利用每个单元格中的信息；开发了一个增强的卷积神经网络表格检测模型，以满足对精确表边界检测的需求；另外提出了一种基于有效不确定度度量方法来构建基于主动学习的智能采样算法，该算法能有效的对10220个表格上的22176 张表进行数据集构建。据评估，该方法具有高达91\.3% 的回报率以及 86\.5% 的准确率。

# Preliminaries:

SpreadSheet检测任务是检测给定表上的所有表并定位它们各自的范围的任务。输入表由单元格矩阵表示；输出是检测到的表列表，每个列表为一个四元组，分别记录了对角的x,y坐标。

IoU指标是评估表检测任务成功与否的指标之一，计算计算预测框与真实框的交集面积与二者并集的比例，其阈值常被设置为0\.5，但是为了适应以后的表结构分析和数据摘要发现任务，我们需要更加准确的边界检测方法。因此，我们定义了一个 **Error\-of\-Boundary \(EoB\)** 度量来衡量检测结果与基本事实边界框对齐的精度。EoB=0 表示检测到的边界框与预期答案完全匹配，而 EoB≤2 表示足够优秀。

![image\.png](/articles/tablesense/image%202.png)

TableSense数据集采用网络爬取的电子表格语料库数据集WebSheet ，包括 4,290,022 个Sheets。其中WebSheet10k 包含 10,220 个英文Sheets，全部由人类标记其准确表格区域并人为验证；WebSheet400为测试集

# TableSense:

## TableSense Framework:

![image\.png](/articles/tablesense/image%203.png)

上图展示了TableSense的架构，它分为三个部分：

1. 单元格特征化：在向下输入之前，需要提取单元格特征

![image\.png](/articles/tablesense/image%206.png)

2. CNN主干：CNN用于捕获单元格空间相关性并从输入单元格矩阵中学习高级表示。

3. 表检测头：

    1. 首先，由CNN提取图像特征，将特征输入到区域候选网络\(RPN\)根据图像生成一系列可能包含表格的区域\(Rols\)。之后，由基于双线性插值的RolAlign方法从特征图中提取精细的特征信息。

    2. 接着，一个CNN分支会对每个候选区域的边界进行微调，使预测的边界框更加贴近实际表格的边缘。另一个CNN分支会为每个RoI打分，判断它是否真正包含表格。

    3. 同时，还有一个分割分支会生成细粒度的单元格掩码，进一步确定表格内部结构\(具体来说，掩码是一个二值图像，其中每个单元格的区域用1表示，其他地方用0表示。这样，系统就可以准确地了解每个单元格的边界，而不仅仅是整个表格的边框\)。

    4. 最后，系统使用NMS算法对所有预测的边界框进行排序，并去除那些重叠过多的冗余候选框，只保留最优的检测结果。

## Precise Bounding Box Regression for TableSense:

### BBR:

在目标检测中，我们不太关心精确的边界框位置，而是检测到的边界框和地面实况之间的重叠比率。因此采用的 BBR 成本函数建模为

![image\.png](/articles/tablesense/image.png)

![image\.png](/articles/tablesense/image%205.png)

其中 x,y 表示边界框的质心坐标，h,w 表示边框的宽度和高度；x\*代表真实框的质心坐标；x\(a\)代表网格初始给定参考框\(锚框\)坐标。

这个公式用于将锚框（Anchor Box）调整到真实目标框（Ground Truth Box），通过归一化偏移量和对数尺度变换，使得目标检测网络更容易学习并回归准确的边界框。

因为我们的目标是最小化偏移量，所以 x,y,h,w 等变量的更新方式随边框尺度变化而变化，

![image\.png](/articles/tablesense/image%204.png)

BBR 损失计算方法缺乏对大表的误差较不敏感，针对小表的相对误差表现较好。

### PBR:

为了解决上述问题，题者提出使用精确辩解回归模块\(PBR\)来对 BBR 进行拓展，该机制防止RoIAlign模块在回归方向上对细胞特征进行下采样，有效地保留了单元级的精度进行边界回归。

将 BBR 和 PBR 结合，以从粗到细的方式预测精确的表边界，其中 BBR 用于探测近似表边界，并使用 PBR 来细化 BBR 返回的结果。

BBR 和 PBR 的损失一起添加到端到端训练中。虽然 BBR 和 PBR 都使用 CNN 作为主干，但采用了不同的预测目标、损失函数、感受野和 RoIAlign 目标。PBR模块可以有效地细化BBR预测，进一步提高定位精度。

## Active Learning Framework:

主动学习（Active Learning）框架在表格检测任务中的应用，旨在减少标注工作量的同时提升模型性能。文中提出了6个度量指标来衡量模型对某张电子表格的检测结果是否不确定，将上述6个指标组成向量，计算其 L2 范数作为最终不确定度分数。分数越高，说明检测结果越不可靠。

# Evaluation Results:

将 TableSense 方法与其他算法和检测方式进行EoB 指标评估，结果如下：

![image\.png](/articles/tablesense/image%201.png)

可见 TableSense表现优越。

