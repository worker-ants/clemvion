# RESOLUTION — `review/consistency/2026/09/05/15_53_59`

**BLOCK: NO** · Critical **0** · WARNING **1** · INFO **5**. **조치 완료.**

직전 라운드의 WARNING 2건(plan 이 스스로 건 트리거 미이행)이 해소돼 `plan_coherence` 가
**MEDIUM → NONE** 으로 내려갔다.

## 조치 항목

| # | Checker | 지적 | 조치 |
|---|---|---|---|
| W1 | naming_collision | 신규 `response-contract.ts`/`ContractViolation` 이 기존 `swagger-dto-contract-guard.ts`/`ContractMismatch` 와 이름·주제가 근접해 `"Contract"` 검색 시 즉시 안 갈린다 | **등재.** 리네임 대신 spec 본문 명문화 — 아래 |

### 지적이 맞다 — 이름이 인접한 검증자가 둘이다

실측으로 확인했다:

| 파일 | 무엇을 대조하나 | 타입 |
|---|---|---|
| `repo-guards/__tests__/swagger-dto-contract-guard.ts` | **선언 vs 선언** — `@ApiProperty` 데코레이터와 TS 타입 (정적 AST) | `ContractMismatch` |
| `shared/testing/response-contract.ts` | **값 vs 선언** — 실 HTTP 응답과 생성된 OpenAPI 스키마 (런타임) | `ContractViolation` |

**리네임하지 않는다.** checker 자신이 *"리네임은 4개 e2e 배선을 건드리므로 강제하지 않음"*
이라 적었고, 4개 e2e 배선 + 37개 스펙을 건드려 얻는 것보다 잃는 것이 크다. checker 의
권고(*"다음 planner 턴에 두 검증자 역할 경계를 spec 본문 한 문장으로 명문화"*)를 그대로
트래커에 등재했고, 이미 있던 `code:` 등재 항목과 **같은 턴에 함께 집행**하도록 묶었다.

**이 처분이 `plan/` 편집으로 끝난다는 점이 중요하다** — `codebase/` 를 건드리지 않으므로 두
게이트가 재무장되지 않는다. 그래서 이 라운드가 마지막이 될 수 있었다.

## INFO 처분

| # | 지적 | 처분 |
|---|---|---|
| 1 | `response-contract.ts`·`swagger-probe.ts` 가 spec `code:` 미등재 | **이미 등재** (planner 트랙, 위 W1 과 같은 항목에 묶임) |
| 2 | `spec/5-system/*.md` 16개 중 6개에 `## Overview` 없음 | **이미 등재** — `--impl-prep 12_48_13` W1 로 이 트래커에 planner 항목이 있다 |
| 3 | 신규 코드가 리뷰 인용 규약 §2·swagger §5-1 준수, 오히려 기존 위반을 수정 | 확인 기록 |
| 4 | §5.4 검증자 미등재 — 이번 PR 로 시행 지점이 늘어 근거가 더 분명해짐 | **이미 등재** |
| 5 | 테스트 stub 컨트롤러 경로 `'stub'` 재사용 | 기존 관행과 일치, 격리 모듈이라 충돌 아님 |

## TEST 결과

| 단계 | 결과 |
|---|---|
| lint | **PASS** (`15:43:33`) |
| unit | **PASS** — 447 스위트 / 9,404 통과 (`15:44:38`) |
| build | **PASS** (`15:46:14`) |
| e2e | **PASS** — 51 스위트 / 295 통과 (`15:48:54`) |

## 보류·후속 항목

없음. W1 은 planner 항목으로 등재했고(`code:` 등재 항목과 묶음), 나머지는 전부 기존 등재의
재확인이다. 열린 항목은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의
미체크 체크박스 8건이 단일 진실이다.
