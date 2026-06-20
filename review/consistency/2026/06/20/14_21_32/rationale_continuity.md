# Rationale 연속성 검토 — spec/4-nodes (--impl-prep)

## 발견사항

- **[CRITICAL]** Logic 공통 §7 이 폐기된 UUID v4 동적 포트 ID 를 재주장 (overview §1.3 의 slug 결정과 정면 충돌)
  - target 위치: `spec/4-nodes/1-logic/0-common.md` §7 "포트 ID 불변성 (동적 포트)" — "동적 포트: 생성 시 **UUID v4** 를 할당."
  - 과거 결정 출처: 동일 target 번들 내 `spec/4-nodes/0-overview.md` §1.3 "포트 정의 (PortDef)" — "동적 포트: config 항목 … 이 보유한 **stable slug id** 를 포트 ID 로 사용한다. slug 는 `^[a-zA-Z0-9_-]{1,64}$` … 검증·해석 단일 출처는 backend `nodes/core/port-id.util.ts` 와 frontend `lib/node-definitions/resolve-dynamic-ports.ts` 가 lockstep 으로 보유한다. **(UUID v4 는 사용하지 않는다.)**"
  - 상세: overview §1.3 은 동적 포트 ID 를 slug 기반으로 확정하고 UUID v4 를 **명시적으로 기각**(괄호로 직접 부정)했으며, 구체 코드 SoT(`port-id.util.ts`/`resolve-dynamic-ports.ts`)까지 박아 두었다. 그런데 같은 구현 대상 번들의 logic §7 은 옛 "UUID v4 할당" 결정을 그대로 남겨 두어 두 문서가 동일 메커니즘을 상반되게 규정한다. 이는 단순 INFO 급 표현 차이가 아니라 **합의된 invariant(slug 불변성) 를 우회/대체하는 폐기된 대안의 잔존**이다. 더욱이 `10-parallel.md §3.2` 는 동적 포트를 `branch_<index>` slug(CONVENTIONS Principle 6) 로 올바르게 규정하면서 ID 불변성 근거로 `[공통 §7]` 을 인용한다 — 즉 잘못된(UUID) 메커니즘을 담은 §7 이 다른 노드 문서에서 권위 출처로 **능동적으로 참조**되고 있어, 구현자가 §7 을 따르면 slug 기반 코드(`port-id.util.ts`)와 어긋난 핸들러를 작성하게 된다. (overview §1.3 의 fallback 규칙 `case_0`/`branch_1` 인덱스 폴백과도 §7 의 UUID 서술은 양립 불가.)
  - 제안: logic §7 본문의 "동적 포트: 생성 시 UUID v4 를 할당" 항을 overview §1.3 과 동일한 slug 기반 서술(stable slug id, `^[a-zA-Z0-9_-]{1,64}$`, 형식 위반 시 인덱스 fallback, SoT = `port-id.util.ts` + `resolve-dynamic-ports.ts`)로 교체하거나, §7 을 `[overview §1.3]` 으로의 단순 포인터로 축약한다. UUID→slug 가 의도된 결정 번복이라면(코드 SoT 가 이미 slug 이므로 사실상 그러함) 번복 사유를 `## Rationale` 한 항으로 명시(예: "동적 포트 ID: UUID → config-stable slug 전환 근거 — 엣지 보존 + 사람 가독 포트 ID + 직렬화 안정")해 무근거 잔존이 아니라 기록된 결정으로 만든다.

- **[INFO]** Background `meta.backgroundRunId` 의 UUID v4 사용은 §7 충돌 대상 아님 (오탐 방지 메모)
  - target 위치: `spec/4-nodes/1-logic/12-background.md` §5.1 — `meta.backgroundRunId` (UUID v4), §8 모니터링 API path 키.
  - 과거 결정 출처: overview §1.3 의 "UUID v4 는 사용하지 않는다" 는 **동적 포트 ID 한정**.
  - 상세: backgroundRunId 는 포트 ID 가 아니라 background run 식별자(모니터링 API 조회 키)이므로 §1.3 의 포트-ID 결정과 무관하며 UUID v4 사용이 정상이다. 위 CRITICAL 의 slug 전환 시 background 의 UUID 식별자까지 휩쓸어 바꾸지 않도록 범위를 포트 ID 로 한정한다.

## 요약
target 번들 대다수(parallel·merge·background·if-else 본문 및 각 `## Rationale`)는 기존 결정과 정합하며, 특히 parallel 의 `waitAll=false` spec-out·중첩 깊이≤2·`cancel-others-on-fail`·`count` 복원(drift B) 등은 기각 대안과 번복 근거를 Rationale 에 충실히 기록해 연속성이 우수하다. 단 하나의 결정적 단절은 Logic 공통 §7 이 동적 포트 ID 를 여전히 "UUID v4 할당" 으로 서술하는 점이다 — 같은 번들 overview §1.3 이 이를 명시적으로 기각하고 slug 기반(+코드 SoT)으로 확정했으며 parallel §3.2 가 slug 규약을 따르면서 §7 을 권위 출처로 인용하기까지 한다. slug 가 실제 코드 SoT(`port-id.util.ts`)인 현행 상태이므로 §7 의 UUID 서술은 폐기된 대안의 무근거 잔존이며, 구현자가 §7 을 신뢰하면 코드와 어긋난다. 본 항을 slug 로 정정(또는 overview §1.3 포인터화)하고 UUID→slug 번복을 Rationale 로 명문화하면 연속성이 회복된다.

## 위험도
HIGH
