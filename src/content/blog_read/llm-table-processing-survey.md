---
title: "LLM for Table Processing Survey"
description: "LLM 表格处理综述笔记，梳理表格类型、任务、数据集与代理式方法。"
pubDate: 2026-09-08
tags:
  - "LLM"
  - "Tables"
  - "Survey"
---
# LLM for Table Processing Survey

# Introduction

本篇综述旨在全面回顾LLM在表格处理方面的技术进步，并总结当前的研究方向。

该综述的主要贡献在于它广泛包含了各种表格任务，包括最近提出的制表软件操作和数据分析；另外，作者重点关注重点关注指令调优、数据合成、思维链、ReAct和LLM驱动的代理方法，并收集了最近的数据集、基准和训练语料库，以及论文、代码和数据集等资源。

# Table Types and Table Tasks

## Table Definition

1. SpreadSheet：电子表格通常具有具有合并单元、分层列和注释的不规则布局，这使得机器解析变得困难。

2. Web Table \(WT\)：Web 表以各种格式存在，从 HTML 到 markdown、JSON 和 XML。由于 Web 表嵌入在网页中，可能存在很多上下文信息。WDC Web表语料库项目将来自 Common Crawl 语料库的数十亿个网页转换为结构化表 。

3. Database \(DB\)：关系数据库中的表是高度结构化的，即每个数据库表在创建时都使用模式显式定义。用户应该使用 SQL 与数据库表交互。

4. Document\(DOC\)：用户希望从这些文档中提取表格、构建它们并将它们转换为表格原生格式（SpreadSheet或 HTML）。要求 LLM 的文本识别和内容提取能力。此外，与普通图像或纯文本文档不同，文档嵌入表依赖于精确的二维坐标系。行和列中的任何错位都可以显著提高对所呈现的信息的理解。

## Differences Between Table and Text

文本是单向的，两个标记的交换通常会改变句子的含义。而表是二维的，需要水平和垂直阅读。

## Table Tasks

表格任务可以大致分为表相关、制表软件相关、数据库相关和文档相关任务。这些任务要求 AI 模型直接理解表内容，编写代码来操纵电子表格，编写 SQL 访问数据库，或从文档中提取表数据。

![image\.png](/articles/llm-table-processing-survey/image.png)



