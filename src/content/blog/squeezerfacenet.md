---
title: "SqueezerFaceNet"
description: "SqueezerFaceNet 轻量人脸识别模型论文笔记，整理网络剪枝与 Taylor 分数方法。"
pubDate: 2026-09-08
tags:
  - "Computer Vision"
  - "Face Recognition"
  - "Pruning"
---
# SqueezerFaceNet

# Abstract \& Induction:

由于移动设备摄像头的盛行以及它们在日常生活的应用，人像识别技术作为识别用户身份的可靠方法得到了迅速发展。但是大多数的脸部识别架构模型规模普遍较大，实用性普遍不强。

该论文的贡献在于提出了SqueezerFaceNet，轻量型的、参数量小于1M的人脸识别模型，它由基于泰勒分数\(Taylor scores\)的网络剪枝方法\(network pruning methods\)实现。

在此之前，人们致力于用各种方法来使模型减少参数并且提高生成速度。但是论文表明，人脸识别这项工作并不适用于现有架构，论文提出应用神经架构\(Neural Architecture Search, NAS\)搜索来设计一系列轻FR模型。

该论文提出使用基于过滤器重要性分数\(importance scores of network filters\)的剪枝方法来减少现有轻量FR网络的规模，该现有FR网络使用修改后的SqueezerNet架构，参数量为1\.24M。重要性分数来源于该参数移除后对错误发生的影响大小，它通过一阶泰勒近似计算，然后反向传播训练期间计算的梯度的元素。

# Network Pruning Method:

考虑网络参数***W ***：

![image\.png](/articles/squeezerfacenet/image%204.png)

以及以输入x和输出y对为元素的训练集***D ***：

![image\.png](/articles/squeezerfacenet/image.png)

网络训练的目标是最小化分类错误***E***，通过求解该式：

![image\.png](/articles/squeezerfacenet/image%205.png)

一个参数的重要性分数被定义为移除该参数后对错误的影响，该参数诱导误差可量化为参数去除前后的***E ***的差平方：

![image\.png](/articles/squeezerfacenet/image%203.png)

但是，这样做计算成本很高，为了避免这个问题，使用一阶泰勒展开来逼近***W ***附近的***Im***：

![image\.png](/articles/squeezerfacenet/image%207.png)

而梯度元素定义为：

![image\.png](/articles/squeezerfacenet/image%202.png)

梯度***g***可由反向传播获得，大大简化了***Im ***的计算

同时定义***s ***个参数组成的集合***Ws*** 的共同重要性分数为：

![image\.png](/articles/squeezerfacenet/image%208.png)

算法解释：

在一个数据集上，给定一个batch，计算梯度并通过梯度下降更新网络权重，每个过滤器中的重要性分数通过式[SqueezerFaceNet](https://pcncdejrwpcy.feishu.cn/wiki/EI9Swra1ViqHdQkTN2Lcv6EunAh?larkTabName=space#share-SaHVdsopsoIexOxvOhMcK9Ldncf)计算，在epoch末尾，过滤器的重要性得分在batchsize上取平均值，去除分数最小的过滤器会被移除，经过一定数量的epoch之后停止修剪。

然后可以在训练集上再次微调生成的网络，以恢复由于滤波器去除而导致的潜在精度损失。

# SqueezerFaceNet Architecture and Database:

基础模型使用的是SqueezerNet，最小通用CNN之一，其未压缩版本规模仅有18个卷积层、1\.24M参数和4\.6MB

迁移学习策略比从头开始初始化训练能带来更好的性能，这点已经被证明，因此团队使用现有模型并补充了原SqueezerNet模型卷积层和ReLU层之间缺少层归一化的缺陷，还实现了规模的缩小和精度损失的最小化

训练和评估数据集使用VGGFace2，覆盖图像种类广泛；另外使用MS\-Celeb\-1M database中的预清理数据集RetinaFace训练SqueezerFaceNet

# Experimental Protocol \& Results：

### 实验协议（Experimental Protocol）

在实验过程中，SqueezerFaceNet采用了基于 VGGFace2 数据集的训练和评估协议。训练时，输入图像的短边被调整为 129 像素，并随机裁剪为 113×113 的大小。为了增加数据多样性，使用了水平随机翻转。训练时，采用带有动量的随机梯度下降（SGDM）优化器，初始学习率为 0\.01，并在验证损失趋于平稳时逐步降低至 0\.005、0\.001 和 0\.0001。

在测试过程中，模型使用 VGGFace2\-Pose 数据集进行验证，数据集包括 368 名用户的 11040 张图像，覆盖正面、三分之四视角和侧面三种姿势。通过组合五张具有相同姿势的图像来生成用户身份模板，同时也进行了仅使用一张图像作为模板的实验。

### 实验结果（Results）

实验表明，SqueezerFaceNet 在 VGGFace2\-Pose 数据集上的表现优于 SqueezeFacePoseNet。具体结果表现在同姿势和跨姿势的实验中，SqueezerFaceNet 在正面与正面 \(F\-F\) 和三分之四视角 \(3/4\-3/4\) 的验证结果中表现更好。对于五图像模板的实验，网络的表现更加稳定，而对于单图像模板的实验，准确率下降更快。

![image\.png](/articles/squeezerfacenet/image%201.png)

剪枝实验表明，在剔除网络中 10\-15% 的卷积滤波器后，网络的性能略有回升，特别是在多图像模板的验证中，网络在剪除 30\-40% 的滤波器后仍然能够保持相当的性能。剪枝后通过重新训练，网络能恢复部分精度损失，直到约 15% 的滤波器被移除后，单图像模板的性能开始迅速下降。

![image\.png](/articles/squeezerfacenet/image%206.png)

最后，剪枝过程使得 SqueezerFaceNet 的参数数量从 1\.24M 减少到 0\.94M，而在五图像模板实验中，网络参数可减少至 0\.65M，精度损失仍然较小。

# Conclusions:

本论文致力于开发SqueezerFaceNet，一个轻量级的深度网络架构，专门用于移动设备上的人脸识别。为此，研究者应用了基于泰勒一阶展开的重要性得分的卷积神经网络剪枝方法，该方法通过评估每个滤波器对误差的影响来确定其重要性。然后，逐步剪除重要性较低的滤波器，并在剪枝后对网络进行重新训练以恢复潜在的精度损失。

实验结果表明，SqueezerFaceNet 的滤波器数量可以减少高达 40% 而不会显著降低准确率。

研究结果表明，经过剪枝的网络在参数数量和网络大小上都有显著减少，从 1\.24M 参数减少到 0\.65M，同时保持了较为稳定的性能表现，这使得该模型特别适合在资源受限的移动平台上部署。



