---
name: consistency-checker
description: spec / plan / 구현 착수 직전에 기존 문서들과의 위배를 사전에 검출하는 다관점 일관성 검토자입니다. 사용자가 "consistency check", "정합성 점검", "사전 검토", "spec 충돌 확인", "/consistency-check" 를 호출하거나, project-planner 가 `spec/` 에 쓰기 전, developer 가 구현에 착수하기 전에 의무 호출됩니다. 5개의 관점(Cross-Spec, Rationale Continuity, Convention Compliance, Plan Coherence, Naming Collision)으로 병렬 검토하며, Critical 위배 발견 시 spec write·구현 착수를 차단합니다.
---

# Consistency Checker

spec / plan / 구현 변경이 **저장되기 전** 단계에서, 기존 문서들과 위배되는 지점을 사전에 검출하는 다관점 검토자다. 사후 코드 리뷰(`ai-review`)와 달리 **결정이 박히기 전 단계**에서 동작한다.

## 절대 원칙

- **사전 검출**: target 문서가 디스크에 쓰이기 전에 호출되는 것이 정상 동선. 사후 호출도 가능하지만 차단력은 호출 시점에 달려있다.
- **Critical = 차단**: Critical 등급 위배가 1건이라도 발견되면 호출자는 즉시 멈춘다. 사용자에게 보고하고 해결 방안을 결정한 뒤 재실행한다.
- **출력은 markdown**: `review/consistency/<timestamp>/SUMMARY.md` 가 단일 결과 진입점. 5개 checker 의 상세는 같은 디렉토리의 `<checker>/review.md`.
- **재진입성**: 같은 검토를 여러 번 돌려도 부수 효과가 없다 (산출물 디렉토리만 누적). plan/spec 을 자동 수정하지 않는다.

## 5개 Checker

| Checker | 검출 대상 |
| --- | --- |
| `cross_spec` | 다른 영역 spec 의 데이터 모델·API 계약·요구사항 ID 와의 충돌 |
| `rationale_continuity` | 과거 Rationale 에서 기각·폐기된 결정의 재도입 |
| `convention_compliance` | `spec/conventions/**` 정식 규약 위반 (노드 Output, Swagger 패턴 등) |
| `plan_coherence` | `plan/in-progress/**` 의 미해결 결정·후속 항목과의 충돌 |
| `naming_collision` | 신규 식별자(요구사항 ID, 엔드포인트, 엔티티명 등)의 기존 사용처 중복 |

## 실행 방법

### 슬래시 커맨드 (권장)

```
/consistency-check --spec <path>       # spec 작성/개정 직전 (강제 차단 모드)
/consistency-check --plan <path>       # plan 작성 시 검토
/consistency-check --impl-prep <scope> # 구현 착수 직전 (scope = spec 영역 경로)
```

### CLI 직접 호출

```bash
python3 .claude/skills/consistency-checker/hooks/consistency_orchestrator.py [옵션]
```

옵션은 슬래시 커맨드와 동일합니다. **Exit code**:
- `0` — 위배 없음 또는 Warning 이하만 발견
- `2` — **Critical 발견** (호출자가 차단)
- `1` — orchestrator 실행 오류

### 환경변수

| 환경변수 | 기본값 | 설명 |
| --- | --- | --- |
| `CONSISTENCY_MODEL` | `sonnet` | 사용할 Claude 모델 |
| `CONSISTENCY_AGENTS` | (전체) | 실행할 checker 쉼표 구분 (예: `cross_spec,naming_collision`) |
| `CONSISTENCY_OUTPUT_DIR` | `./review/consistency` | 결과 디렉토리 |
| `CONSISTENCY_TIMEOUT` | `1800` | checker 별 타임아웃(초) |
| `CONSISTENCY_MAX_CONTEXT_SIZE` | `262144` | checker 한 개에 주어지는 max prompt 크기(자)  |
| `DISABLE_CONSISTENCY_CHECK` | `0` | `1`이면 비활성화 (CI 등 예외 상황만) |

## 호출자 워크플로 (planner / developer)

### project-planner

1. spec 변경안을 `plan/in-progress/spec-draft-<name>.md` 에 작성한다 (디스크 직접 spec/ 수정 금지).
2. `/consistency-check --spec plan/in-progress/spec-draft-<name>.md` 호출.
3. Critical 0 건일 때만 `spec/` 본문에 반영한다. Critical 발견 시 즉시 멈추고 사용자와 해결.
4. Warning 은 RESOLUTION 노트를 같은 spec 의 `## Rationale` 섹션에 남긴 뒤 진행.

### developer

1. `/consistency-check --impl-prep <spec/영역경로>` 를 구현 착수 전 호출.
2. Critical 발견 시 사용자/`project-planner` 에 위임. 구현 진입 금지.
3. Warning 은 `plan/in-progress/<task>.md` 에 기록하고 진행하되, 구현 결과로 해소되는지 자가 점검.

## 결과 확인 절차

1. orchestrator 출력에서 세션 디렉토리 경로(`./review/consistency/<timestamp>/`)와 exit code 를 받는다.
2. `SUMMARY.md` 를 Read 도구로 읽어 Critical / Warning / Info 분포를 확인한다.
3. Critical 항목은 각 checker 의 `<checker>/review.md` 에서 상세 근거를 본다.
4. 조치 결과는 호출자(planner/developer)가 자기 워크플로의 RESOLUTION/Rationale 에 기록한다.

## 동작 방식

1. orchestrator 가 mode 에 따라 target 문서와 관련 문서(spec/, conventions/, plan/in-progress/)를 수집해 컨텍스트를 만든다.
2. 5 checker prompt 를 동시에 `claude -p` 로 호출 (`ThreadPoolExecutor`).
3. 각 checker 결과를 `<checker>/review.md` 로 저장.
4. summary checker 가 결과를 통합해 `SUMMARY.md` 와 `meta.json`(severity 포함)을 생성.
5. Critical 한 개라도 발견되면 exit code `2` 로 종료.

## code-review-agents 와의 관계

본 skill 은 `.claude/skills/code-review-agents/lib/` 의 `agent_runner`·`session`·`summary` 를 그대로 import 하여 병렬 실행·결과 저장 인프라를 공유한다. 동일한 ThreadPoolExecutor 패턴, 동일한 timeout/모델 추상화. 차이는 **입력 컨텍스트(코드 diff vs. 문서 컨텍스트)** 와 **5 vs. 13 checker**, 그리고 **차단력(exit code 2)** 이다.
