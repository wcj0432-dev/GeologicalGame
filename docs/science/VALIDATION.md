# MELTS 科学资料包验证记录 · 2026-11-09

## 输入、版本与出处

- 官方发行版：[alphaMELTS v2.3.2](https://github.com/magmasource/alphaMELTS/releases/tag/v2.3.2)。下载`alphamelts-py-2.3.2-ubuntu_22_04-x86_64.zip`，通过TLS获取，SHA256与GitHub发行页公布值核对：`97ec2cdb53cae69822a41b5639d8b93edf95b2c361bc15e64e53b192ea9e1425`。
- 运行时报告：`2.3.2 (Jul 21 2026 17:06:24)`；`MELTSdynamic(1)`对应rhyolite-MELTS 1.0.2。
- 输入：[官方同版本Morb.melts](https://github.com/magmasource/alphaMELTS/blob/v2.3.2/examples/tutorial/app/Morb.melts)，本目录保存原始文件。官方引用“Allan et al. 1989 (see Ghiorso 1997)”，没有声称独立核实野外样品。模型文献：Ghiorso & Sack (1995), DOI 10.1007/s004100050036；Gualda et al. (2012), DOI 10.1093/petrology/egr080。
- 原始组分合计100.35，统一缩放到100；保留原值、因子、输入哈希、库哈希和全部非零组分。没有把教学样品的FeO*冒充FeO/Fe₂O₃测量。
- Python依赖tinynumpy 1.2.1，独立venv；库来自原始官方二进制，未修改。当前只在Linux x86_64实测。

## 场景与账本

500 bar = 0.05 GPa；不强加fO₂缓冲（官方教程亦为None），封闭氧体系，保留流体。液相线求得1220.1171875°C，取向上5°C取整且高于液相线至少10°C的1235°C为起点，并验证全液态。

每5°C调用`calcEquilibriumState(1, 0)`求平衡：无引擎自动分离。保留路径把全部相组成之和传给下步；分离路径把全部固相批次移入移出库存，液相与流体之和传给下步。每批矿物使用当步真实组成，不套用三种固定端元。所有相均进入账本，包括尖晶石等。

引擎以约100 g计算；游戏采用1 kg / 求解器g的统一示例尺度，对应100 kg初始物质。只换算质量，不使用这套尺度输出能量或时间。绝对相质量来自原始输出，不能将缺相输出重新归一化补足。

氧化物到元素换算采用与该版MELTS氧化物分子量一致的原子量（保存在包中并由客户端白名单核对）。这不是最新IUPAC原子量表；不得混用后用宽容差遮盖误差。守恒检查针对元素和物理质量，允许FeO／Fe₂O₃因内部红氧分配而变化。工程门槛每元素`max(1e-6 kg, element mass × 1e-8)`，总质量1e-6 kg；不把数值门槛称为地质预测误差。

## 实测结果

| 路径 | 节点 | 1110°C液相kg | 液相SiO₂ wt.% | 累计分离kg | 最大元素误差kg |
|---|---:|---:|---:|---:|---:|
| 保留晶体 | 26 | 21.046846013 | 49.363497009 | 0 | 7.25642e-10 |
| 每步分离全部固相 | 26 | 30.952264867 | 49.542237500 | 69.047735134 | 7.25635e-10 |

两份完整JSON分别在全新进程中重复生成，全部字段逐值相等；这是当前版本和平台的复现证据，不保证跨平台逐位一致。客户端重新核对：输入到平衡相、平衡相到保留/移出、相批次唯一划分、前后节点一致、初始到当前+累计移出，以及完整温度覆盖。非法包、漏相、负质量、错误压力单位、部分结果、重复转移均被测试拒绝。

初次保留路径完整算到1000°C（48节点）。初次分离路径在1100°C返回`status.failed`，最后有效节点为1105°C；停止并保存`failed-extension.json`及`remove.log.gz`。公开档案选择双方都重新完整验证过的1235–1110°C范围；没有截掉失败标志把原部分结果伪装为完整，也没有用教学代理补齐。低温不收敛原因尚未定位。

这验证了接口、账本和确定性，不等于已与独立实验数据校准精度。首版不允许插值外推、随意改变分离比例、输入样品、P、水或氧边界。

## 本地复现

普通游戏无需安装MELTS。研究者从上述发行页下载对应平台官方包并核对其公布的校验值，在隔离Python环境安装`tinynumpy==1.2.1`。Linux示例（请替换路径）：

```bash
export PYTHONPATH=/absolute/path/alphamelts-py-2.3.2-ubuntu_22_04-x86_64
export LD_LIBRARY_PATH="$PYTHONPATH"
python scripts/science/run_melts.py --policy retain-all --input docs/science/Morb.melts --output /tmp/morb-retain.json --end 1110
python scripts/science/run_melts.py --policy remove-all --input docs/science/Morb.melts --output /tmp/morb-remove.json --end 1110
```

每条路径必须新进程启动。建议外层设置超时并保留stdout/stderr；引擎表格存于输出JSON旁的`.raw`目录，失败包标为partial并以非零退出。`--end 1000`用于研究原有失败边界，部分包不能导入游戏。资料包的导入审计只验证数学与支持范围，不能证明任意外部文件的来源真实。

## 许可边界

[alphaMELTS LICENSE](https://github.com/magmasource/alphaMELTS/blob/v2.3.2/LICENSE)将接口标为AGPLv3-or-later，xMELTS部分列BSD3，GSL/Readline另有GPL说明。AGPL允许商业使用，捆绑、修改、链接或网络服务须按实际组件履行义务。本次仅分发本项目编写的调用脚本与生成的数值资料、原始科学输入引用，不捆绑这些第三方程序或复制其接口源代码；没有宣称“进程隔离即可免除许可”。未来本地引擎发行须单独核对所用发行包、源码提供与通知要求。
