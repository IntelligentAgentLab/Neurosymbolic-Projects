# Neurosymbolic Projects

한국어 | [English](README_en.md)

뉴로심볼릭 학습 실험 모음입니다. 기호 지식(논리 제약)을 신경망 학습에 넣는 방법을 다룹니다.
각 프로젝트는 독립된 폴더로 구성되어 있습니다.

| 프로젝트 | 주제 | 지식 (제약) |
|---|---|---|
| [SemanticLoss-MNIST](SemanticLoss-MNIST/) | 의미 손실, 준지도 MNIST (기초) | 숫자 10개에 대한 exactly-one |
| [SemanticLoss-CIFAR100](SemanticLoss-CIFAR100/) | CIFAR-100 클래스 계층에 대한 의미 손실 | exactly-one + 함의 100개 (*세부 클래스 → 상위 클래스*) |
| [SemanticLoss-AwA2](SemanticLoss-AwA2/) | AwA2 동물 5종의 속성 지식 베이스, semi/weak 지도 학습, 제로샷 | 동물-속성 행렬에서 자동 생성한 절 80개 (동물 50종에서 찾은 일반 상식 포함) |

추천 순서는 다음과 같습니다.
1. **MNIST**: 제약 하나, 닫힌 형태 뒤에 있는 세 가지 원리, 원 논문 재현 연구
2. **CIFAR-100**: 더 풍부한 제약, full / semi / weak 지도 학습, 대조 실험
3. **AwA2**: 자동 생성한 상식 규칙 베이스, 만족 세계 나열로 계산하는 정확한 의미 손실

## 프로젝트 구조

모든 프로젝트는 같은 구조를 따릅니다.

```
<프로젝트>/
├── README.md            # 설정, 결과, 실행 방법 (README_en.md: 영어판)
├── semloss/             # 라이브러리 코드 (손실, 데이터, 모형, 학습)
├── tests/               # 단위 테스트 (닫힌 형태와 전수 계산 대조)
├── run_experiments.py   # 전체 실험, 실행별로 결과 저장 (중단 후 이어서 실행 가능)
├── summarize.py         # results/*.json -> results/summary.md
└── results/             # 실행별 결과 JSON
```

## 실행

Python 3.10 이상, `torch`와 `numpy`가 필요합니다(torchvision 불필요). 데이터셋은 처음 실행할 때 각 프로젝트의
`data/` 폴더로 내려받으며, 이 폴더는 git에서 제외됩니다.

```bash
cd SemanticLoss-MNIST
python3 -m pytest -q tests
python3 run_experiments.py
python3 summarize.py
```

## 프로젝트 추가하기

위 구조로 최상위에 새 폴더를 만들고, 위 표에 한 줄을 추가합니다. 데이터셋은 git에 넣지 않습니다
(`data/`는 저장소 전체에서 제외됩니다).

## 참고문헌

J. Xu, Z. Zhang, T. Friedman, Y. Liang, G. Van den Broeck. *A Semantic Loss Function for Deep Learning with
Symbolic Knowledge.* ICML 2018.
