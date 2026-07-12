# Rationale 연속성 검토 — spec/7-channel-web-chat

## 발견사항

### [WARNING] "EIA 호출은 @workflow/sdk 재사용" 주장이 실제 위젯 SPA(M1, channel-web-chat) 구현과 불일치 — 새 Rationale 미기재

- **target 위치**:
  - `spec/7-channel-web-chat/_product-overview.md` §4 표 (구성요소 B: SDK) — "EIA 호출은 기존 `@workflow/sdk` 재사용. SPA 와 분리 패키지"
  - `spec/7-channel-web-chat/2-sdk.md` §2 첫 문장(볼드) — "**EIA HTTP/SSE 호출은 기존 `@workflow/sdk`(EIA 클라이언트, PR #230) 재사용**"
- **과거 결정 출처**: 위 두 문서 자체가 이 주장의 유일한 출처이며, 이를 뒷받침하는 실제 구현 근거가 없다. 관련 결정은 `plan/complete/channel-web-chat-followups.md`(2026-06-27 "비목표 확정")에 "`unwrapEnvelope`/`ExecutionStatus` ↔ `@workflow/sdk` 통합... 현재 web-chat·sdk 양 패키지 독립 구현" 이라고 기록돼 있으나, 이 plan 은 **`@workflow/web-chat` npm 패키지(component B)** 의 SDK 코어 배선에 한정된 결정이다.
- **상세**: 실제 EIA HTTP/SSE 호출은 M1 hosted iframe 안에서 도는 **위젯 SPA(`codebase/channel-web-chat`, component A)** 가 수행한다(`0-architecture.md §5.1` "EIA webhook/SSE/REST 호출은 iframe 내부에서 발생", `5-admin-console.md` 라인 182 "위젯 SPA 는 자체 `eia-client.ts` 로 ... 직접 호출한다"). 코드 확인 결과:
  - `codebase/channel-web-chat/src/lib/eia-client.ts` 는 `@workflow/sdk` 를 **import 하지 않고** 독자적으로 EIA HTTP/SSE 로직을 재구현했다(`import type { ... } from "./eia-types"` 만 존재).
  - `codebase/channel-web-chat/package.json` 에는 `@workflow/sdk` 의존성 자체가 없다.
  - `codebase/packages/web-chat-sdk/package.json` description 과 `README.md`(라인 4)도 "EIA 호출은 `@workflow/sdk` 재사용" 을 사실처럼 명시하지만, 실제로는 `@workflow/sdk` 가 devDependencies 에만 있고(`workspace:*`) import 되지 않는다 — `2-sdk.md §2` 자신도 이를 인정한다("`@workflow/sdk` 는 아직 import 되지 않는다").
  - 즉 **M1 의 주력 경로(위젯 SPA, component A)가 `@workflow/sdk` 를 전혀 재사용하지 않고 독립 재구현**했다는 사실은, `2-sdk.md §2` 의 "비목표" 해명(SDK 코어=component B 한정)으로도, `channel-web-chat-followups.md` 의 2026-06-27 결정(같은 component B 범위)으로도 설명되지 않는다. 결과적으로 "EIA 호출은 `@workflow/sdk` 재사용" 이라는 문장은 시스템의 실제 동작(대부분의 트래픽을 처리하는 M1 위젯 SPA는 독립 구현)과 어긋난 채 spec 의 SoT 문서(`_product-overview.md` §4, `2-sdk.md` §2)에 현재형 사실로 남아 있다 — "결정의 무근거 번복"(과거 아키텍처 의도가 뒤집혔지만 그 사실을 설명하는 새 Rationale 이 정작 해당 컴포넌트(component A)에는 없음).
- **제안**: 다음 중 하나로 정합화:
  1. `_product-overview.md §4` 표와 `2-sdk.md §2` 첫 문장을 "M1 위젯 SPA(component A)는 독자적 `eia-client.ts` 를 쓰고, `@workflow/sdk` 재사용은 M2 BYO-UI headless client(0-architecture §5.3) 경로에 한정된다" 로 정정.
  2. 혹은 정말 향후 재통합할 계획이라면, 왜 component A 가 별도로 재구현됐는지(번들 사이즈·CSR export 제약·타입 결합 회피 등)를 `2-sdk.md` 또는 `0-architecture.md` Rationale 에 명시.

### [INFO] `0-architecture.md §R1` "완전 분리" 문구가 `4-security.md §R5` 의 same-origin 예외를 backlink 하지 않음

- **target 위치**: `spec/7-channel-web-chat/0-architecture.md` §R1 (및 본문 §2)
- **과거 결정 출처**: `spec/7-channel-web-chat/4-security.md §R5`("iframe sandbox `allow-same-origin` — 완전 격리 원칙의 한정 적용")
- **상세**: `4-security.md §R5` 는 스스로 "[0-architecture §R1]은 iframe으로 쿠키·스토리지를 **완전 분리**한다고 선언하는데... 이와 표면적으로 긴장한다" 고 인정하고, 동봉(co-deploy) same-origin 경로에서 `allow-same-origin` 이 필요한 이유·트레이드오프·공급망 무결성 전제를 상세히 설명해 긴장을 해소한다. 이는 "결정 번복을 새 Rationale 로 문서화" 하는 모범 사례이지만, 참조가 `4-security → 0-architecture` 단방향이라 `0-architecture.md §R1`(및 본문 §2 "완전 격리") 을 먼저 읽는 독자는 이 한정 적용 사실을 모른 채 "완전 분리" 를 무조건적 불변식으로 오해할 수 있다.
- **제안**: `0-architecture.md §R1` 또는 본문 §2 말미에 "단, admin 콘솔 동봉 미리보기의 same-origin 경로는 `allow-same-origin` 이 필요하며 그 한정 적용 근거는 [4-security §R5]" 정도의 1줄 backlink를 추가하면 두 문서 간 참조가 양방향으로 닫혀 향후 드리프트를 예방.

## 요약

`spec/7-channel-web-chat` 영역은 Rationale 연속성 관리가 전반적으로 매우 잘 되어 있다 — 결정 번복 시 "초기 결정(기각)/전환 결정(채택)" 패턴(`1-widget-app.md R6`), "기존 결정의 부분 번복" 명시(`5-admin-console.md R2`), 표면적 긴장을 스스로 인정하고 해소하는 패턴(`4-security.md R5`), 사실이 아니었던 과거 서술을 정정하며 근거를 남기는 패턴(`1-widget-app.md R8`) 등이 일관되게 적용돼 있고, EIA/conversation-thread 등 외부 spec 의 invariant(단일 sink 정책 EIA §R10, per_execution 기본 EIA §R4, durable thread 의 `source: ai_assistant` 한정, EIA-RL-07 idle-wait 등)에 대한 인용도 실제 원본과 대조 검증한 결과 정확했다. 유일하게 실질적인 continuity 갭은 "EIA 호출이 `@workflow/sdk` 를 재사용한다"는 주장이 정작 트래픽 대부분을 처리하는 M1 위젯 SPA(component A, `channel-web-chat`)의 실제 독립 구현과 어긋나 있고, 이 번복을 설명하는 Rationale 이 다른 컴포넌트(SDK 코어, component B) 범위에만 존재한다는 점이다. 기각된 대안의 재도입이나 합의 원칙의 직접 위반은 발견되지 않았다.

## 위험도

LOW
