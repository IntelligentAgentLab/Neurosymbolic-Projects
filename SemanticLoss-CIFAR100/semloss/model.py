"""ResNet-9 (Myrtle.ai / DAWNBench style) with a single 120-way head: 100 fine + 20 coarse logits."""
import torch.nn as nn


def conv_bn(c_in, c_out, pool=False):
    layers = [nn.Conv2d(c_in, c_out, 3, padding=1, bias=False), nn.BatchNorm2d(c_out), nn.ReLU(inplace=True)]
    if pool:
        layers.append(nn.MaxPool2d(2))
    return nn.Sequential(*layers)


class Residual(nn.Module):
    def __init__(self, c):
        super().__init__()
        self.body = nn.Sequential(conv_bn(c, c), conv_bn(c, c))

    def forward(self, x):
        return x + self.body(x)


class ResNet9(nn.Module):
    def __init__(self, n_out=120):
        super().__init__()
        self.features = nn.Sequential(
            conv_bn(3, 64),
            conv_bn(64, 128, pool=True), Residual(128),
            conv_bn(128, 256, pool=True),
            conv_bn(256, 512, pool=True), Residual(512),
            nn.AdaptiveMaxPool2d(1), nn.Flatten(),
        )
        self.head = nn.Linear(512, n_out)

    def forward(self, x):
        return self.head(self.features(x))
