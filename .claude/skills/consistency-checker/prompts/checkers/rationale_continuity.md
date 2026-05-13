# Rationale Continuity Check

당신은 과거 의사결정과의 연속성을 점검하는 검토자입니다. 아래 target 문서가 기존 spec 의 `## Rationale` 섹션에서 **이미 기각·폐기된 결정** 을 다시 도입하거나, 과거 합의된 원칙을 무시하고 있지 않은지 분석하세요.

## 검토 모드
{mode}

## Target 문서
경로: {target_path}

```
{target_doc}
```

## 관련 Rationale 발췌 (기존 spec 의 ## Rationale 섹션 모음)

{rationale_excerpts}

## 검토 지침

다음 관점을 점검하세요:

1. **기각된 대안의 재도입** — target 이 과거 Rationale 에서 명시적으로 거부한 대안을 다시 채택하고 있는가 (이유 명시 없이)
2. **합의된 원칙 위반** — Rationale 에 박혀있는 설계 원칙(예: 트랜잭션 경계, 권한 모델, 노드 출력 컨벤션)을 따르지 않고 있는가
3. **결정의 무근거 번복** — 과거 결정을 뒤집으면서 새 Rationale 를 함께 작성하지 않고 있는가 (번복은 가능하나 근거가 함께 와야 함)
4. **암묵적 가정 충돌** — Rationale 에 기록된 시스템 invariant(예: "X 는 항상 Y 를 거친다")를 우회하는 설계가 들어와 있는가

## 등급 기준

- **CRITICAL** — 명시적으로 기각된 대안을 채택, 또는 합의된 invariant 직접 위반. 결정을 뒤집으려면 별도 Rationale 갱신이 선행되어야 함.
- **WARNING** — 결정 번복이 의도된 것 같으나 새 Rationale 가 부재. 또는 원칙과의 거리감이 큼.
- **INFO** — Rationale 와의 정합 보완 제안.

## 출력 형식

### 발견사항

- **[CRITICAL/WARNING/INFO]** 간단한 제목
  - target 위치: target 문서 내 섹션/라인
  - 과거 결정 출처: 어느 spec 의 ## Rationale 어느 항목
  - 상세: 충돌·번복의 내용
  - 제안: target 수정 또는 Rationale 명시적 갱신 방안

### 요약
1 문단으로 의사결정 연속성 평가.

### 위험도
NONE / LOW / MEDIUM / HIGH / CRITICAL
