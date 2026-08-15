# Rationale 연속성 검토 — spec/5-system/ (impl-prep)

## 범위 및 방법

- Target: `spec/5-system/14-external-interaction-api.md` (프롬프트 번들에서 유일하게 전문 포함, 나머지 `5-system/` 파일은 예산 초과로 절단됨).
- 실제 저장소(`git diff main...HEAD -- spec/5-system/14-external-interaction-api.md`)를 직접 대조해 이번 diff 가 `durationMs`(종결 이벤트 3종) 구현 완료 반영임을 확인. R8 "캐시 키 스코프" 등 기존 Rationale 항목(R1~R19, R-outbound-flood, R-replay-unavailable)은 이번 diff 로 변경되지 않음 — 그대로 유지.
- 관련 문서(`2-api-convention.md` §5.4, `4-execution-engine.md`, `13-replay-rerun.md`, `spec/conventions/node-cancellation.md`)를 직접 Read 로 열어 target 이 인용하는 앵커·경로·수치가 실제로 존재/정합하는지 실측.

## 발견사항

### INFO — `durationMs` 구현 완료 서술은 `## Rationale` 신규 항목 없이 §6 인라인 각주로만 기록됨, 그러나 이는 이미 확립된 문서 관행과 정합
- target 위치: `spec/5-system/14-external-interaction-api.md` §6 필드 집합 표(`durationMs` 행) 및 §6.5(`execution.cancelled` 페이로드) 의 "2026-08-15 구현/해소" 각주
- 과거 결정 출처: 같은 문서 §6 필드 집합 표의 `error` 행 — "`failed` 는 **전 경로 object** 다 (2026-08-14, `toTerminalErrorPayload` 로 일원화 — 종전의 '일부 경로는 string' 캐비엇 해소)" (line 578, 이번 diff 이전부터 존재)
- 상세: `durationMs` 는 종전에 "미구현 (Planned)" 으로 명시돼 있던 필드가 이번 diff 로 "구현됨" 전환됐다. 이 문서는 R17/R18/R19/R-outbound-flood/R-replay-unavailable 처럼 **설계 대안 간 선택**에는 전용 `## Rationale` 항목(R-n)을 두는 관행이 있는 반면, "이미 설계된 Planned 필드의 구현 완료"는 §6 표/본문에 날짜가 박힌 인라인 각주로만 기록하는 **별도의 관행**을 이미 쓰고 있다(2026-08-14 `error` object 일원화가 선례). `durationMs` 처리는 이 기존 선례를 그대로 따른 것이라 **문서 자체의 관행과 충돌하지 않는다** — "결정을 뒤집으면서 새 Rationale 를 안 썼다"는 점검 관점 3에 해당하는 위반으로 보기 어렵다.
- 제안: 조치 불요. 다만 §6.5 의 SQL `RETURNING`/`COALESCE` 재읽기 방식 선택 이유(엔티티 미로드 경로에서 JS 계산이 불가능해 SQL 내 계산으로 전환)는 대안(예: 별도 재조회 쿼리, in-memory 낙관값 유지)과 비교한 명시적 "채택/기각" 서술이 없다 — 향후 유사 케이스가 반복되면(예: 다른 필드도 raw UPDATE 전용 경로가 늘어나는 경우) 이 패턴 자체를 `## Rationale` 에 원칙으로 승격하는 것을 고려할 수 있다(강제 아님).

### INFO — 취소 경로 수치 표기 불일치("6곳 중 4곳" vs "5경로")는 Rationale 위반이 아니라 인접 subsystem(cross-spec) 점검 대상
- target 위치: §6.5 "`durationMs` (2026-08-15 구현)" 각주 — "취소 경로 6곳 중 4곳은 **엔티티를 로드하지 않는** raw UPDATE" (line ~838) vs §6 필드 집합 표 `durationMs` 행 — "엔티티를 로드하지 않는 **5경로**는 UPDATE 문 안에서 SQL 로 계산" (line 607)
- 과거 결정 출처: 해당 없음(이번 diff 내부 수치 상호 참조)
- 상세: 두 서술이 가리키는 모수가 다를 수 있다(§6.5 는 "취소 경로"만, §6 표는 `completed`/`failed`/`cancelled` 3종 전체 중 raw-UPDATE 경로 총합일 가능성) — `codebase/backend/src/shared/utils/terminal-duration.ts` 의 docstring 은 "`finalizeStalledExhausted`(1) + `emitCancellationEvent` 호출부(5)" 로 또 다른 조합을 제시해 세 서술이 서로 정확히 맞물리는지 이 리뷰만으로는 확정할 수 없었다. Rationale 위반(기각된 대안 재도입/원칙 위반/무근거 번복/invariant 우회) 은 아니며, 사실관계 수치 정합은 cross_spec 내지 코드-스펙 커버리지 점검이 더 적합하다.
- 제안: cross_spec 또는 구현 착수 시 실코드 대조로 "6곳 중 4곳"과 "5경로"가 같은 집합을 가리키는지 확정하고 표기를 통일.

## 확인된 정합 사례 (참고 — 위반 아님, false positive 방지 목적)

- §5.4 "부재 표현" cross-ref: 종전에는 `[§5.4 부재 표현 규약](#54-명시적-취소-...)` 로 **자기 문서의 다른 절**(§5.4 명시적 취소)을 잘못 가리키던 깨진 앵커였는데, 이번 diff 가 `[API 규약 §5.4 부재 표현](./2-api-convention.md#54-부재-표현--null-vs-키-생략)` 로 정정했다. 실제로 `spec/5-system/2-api-convention.md:172` 에 해당 앵커가 존재함을 확인 — 정정이 맞고 오히려 연속성을 강화한다.
- `spec/conventions/node-cancellation.md` 의 `finalizeCancelledExecution` 관련 정정(같은 날짜, 별도 파일)은 "두 번 정정됐다. 두 번째가 첫 번째를 뒤집는다" 를 취소선 + 순번(①②③)으로 명시하며 왜 1차 처방이 틀렸는지(사용자가 누른 Stop 이 무음화됨)까지 남겼다 — 이는 본 점검 관점 3("결정 번복 시 새 Rationale 동반")의 **모범 사례**다.
- §6.5 duplicate-emit 각주는 "알려진 갭은 invariant 옆에 적는다(R14·R17·§6.4 와 동형)" 는 문서 자신의 관행을 명시적으로 인용하며 추적 링크(plan/in-progress)를 유지 — 자기 정합성 점검이 이미 내재화돼 있다.
- Re-run API 경로 `/api/v1/executions/:id/re-run` → `/api/executions/:id/re-run` 정정은 `spec/5-system/13-replay-rerun.md` 의 실제 SoT(`POST /api/executions/:executionId/re-run`, `/v1/` 없음)와 대조해 확인 — 오탈자 수정이며 원칙 위반 아님.
- R7(seq 공유)·R8(캐시 키 스코프)·R10(단일 sink)·R14(토큰 401 통일) 등 기존 Rationale 은 이번 diff 대상 밖이며 target 본문의 관련 요구사항(EIA-RL-01 at-least-once, EIA-NX-04 delivery id)과 여전히 정합한다. §6.5 의 "복수 종결자가 각각 emit" 신규 서술은 R10 의 "엔진은 단일 sink 하나만 호출" 원칙(호출 지점의 단일성)과는 다른 축(같은 sink 를 여러 종결자가 각각 부른 횟수)이라 R10 을 깨지 않으며, EIA-RL-01 의 at-least-once 원칙과도 부합한다.

## 요약

이번 diff(`durationMs` 종결 이벤트 구현 완료 + 관련 캐비엇 해소 + 앵커/경로 오탈자 정정)는 기존 `## Rationale` (R1~R19, R-outbound-flood, R-replay-unavailable) 의 어떤 항목도 재도입·번복·우회하지 않는다. 오히려 문서가 이미 확립한 "완료된 Planned 필드는 표/본문에 날짜 각주로 기록"(2026-08-14 `toTerminalErrorPayload` 선례), "결정 번복 시 취소선+순번으로 이력 보존"(node-cancellation.md), "알려진 갭은 invariant 옆에 적는다"(§6.5) 세 관행을 일관되게 재사용하고 있어 Rationale 연속성 관점에서 모범적이다. 발견된 두 항목은 모두 INFO 수준이며 실질적 위반이 아니라 후속 정합화 제안에 가깝다.

## 위험도

LOW
