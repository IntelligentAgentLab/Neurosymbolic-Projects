"""Small CNN trained from scratch: four conv blocks (32-64-128-256) and one linear head whose outputs are
the 5 class logits followed by the attribute logits."""
import torch.nn as nn


def block(c_in, c_out):
    return nn.Sequential(
        nn.Conv2d(c_in, c_out, 3, padding=1, bias=False), nn.BatchNorm2d(c_out), nn.ReLU(inplace=True),
        nn.Conv2d(c_out, c_out, 3, padding=1, bias=False), nn.BatchNorm2d(c_out), nn.ReLU(inplace=True),
        nn.MaxPool2d(2))


class SmallCNN(nn.Module):
    def __init__(self, n_out, dropout=0.3):
        super().__init__()
        self.features = nn.Sequential(block(3, 32), block(32, 64), block(64, 128), block(128, 256),
                                      nn.AdaptiveAvgPool2d(1), nn.Flatten(), nn.Dropout(dropout))
        self.head = nn.Linear(256, n_out)

    def forward(self, x):
        return self.head(self.features(x))
