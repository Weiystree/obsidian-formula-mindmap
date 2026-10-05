# 单摆的周期

单摆是研究简谐运动的经典模型。一根不可伸长的细线，长度为 $L$，下端挂一个质量为 $m$ 的小球，拉开一个小角度后释放，小球就会来回摆动。

## 核心结论

单摆的周期公式为：
$$T = 2\pi\sqrt{\frac{L}{g}}$$

其中 $L$ 是摆长，$g$ 是重力加速度（约 $9.8\,\mathrm{m/s^2}$）。

## 定理

**小角度近似**：当摆角 $\theta \leq 5°$ 时，$\sin\theta \approx \theta$（弧度制），单摆可视为简谐运动，周期与振幅无关（等时性）。

## 推导过程

小球所受合力沿圆弧切线方向的分量为
$$F = -mg\sin\theta$$
小角度下 $\sin\theta \approx \theta$，于是
$$F \approx -mg\theta = -mg\frac{x}{L}$$
这正是胡克定律的形式：回复力与位移成正比、方向相反。因此加速度为
$$a = -\frac{g}{L}x$$
对比简谐运动标准方程 $a = -\omega^2 x$，可得 $\omega = \sqrt{g/L}$。

## 证明：周期与质量无关

由 $\omega = \sqrt{g/L}$ 得
$$T = \frac{2\pi}{\omega} = 2\pi\sqrt{\frac{L}{g}}$$
表达式中不含质量 $m$——因为重力 $mg$ 与惯性质量 $m$ 在方程中恰好约去，所以周期与摆球质量无关。

## 例 1：求 1 米长单摆的周期

取 $L = 1\,\mathrm{m}$，$g = 9.8\,\mathrm{m/s^2}$：
$$T = 2\pi\sqrt{\frac{1}{9.8}} \approx 2.0\,\mathrm{s}$$
即摆长约 1 米的单摆，一个来回大约 2 秒，这就是"秒摆"的由来。

## 例 2：月球上的单摆

月球表面重力约为地球的 1/6，即 $g_{月} \approx 1.63\,\mathrm{m/s^2}$，同一单摆的周期变为
$$T_{月} = T_{地}\sqrt{\frac{g_{地}}{g_{月}}} \approx 2.0 \times \sqrt{6} \approx 4.9\,\mathrm{s}$$
摆动会明显变慢。

注意：周期公式只在**小角度**下成立。摆角超过 10° 后实际周期会偏大，因为 $\sin\theta \approx \theta$ 不再准确；大角度情形需要用椭圆积分求解。

```python
import sympy as sp
L, g = sp.symbols('L g', positive=True)
T = 2 * sp.pi * sp.sqrt(L / g)
print(sp.simplify(T.subs({L: 1, g: 9.8})))  # ≈ 2.00
```
