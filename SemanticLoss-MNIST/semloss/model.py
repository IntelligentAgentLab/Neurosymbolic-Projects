"""MLP used in the semi-supervised MNIST experiments of Xu et al. (2018), following the ladder-network
setup: 784-1000-500-250-250-250-10 with batch norm, ReLU and Gaussian input noise during training."""
import torch
import torch.nn as nn

HIDDEN = (1000, 500, 250, 250, 250)


class MLP(nn.Module):
    def __init__(self, n_in=784, n_out=10, hidden=HIDDEN, input_noise=0.3):
        super().__init__()
        layers, d = [], n_in
        for h in hidden:
            layers += [nn.Linear(d, h), nn.BatchNorm1d(h), nn.ReLU(inplace=True)]
            d = h
        layers.append(nn.Linear(d, n_out))
        self.net = nn.Sequential(*layers)
        self.input_noise = input_noise

    def forward(self, x):
        if self.training and self.input_noise > 0:
            x = x + self.input_noise * torch.randn_like(x)
        return self.net(x)
