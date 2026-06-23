# 요구사항(Requirement) 리뷰 — M-8 1단계 API 레이어 추출

리뷰 대상 커밋: `0413433128321273c32d2ea1d12906ce201e4b2d`
리뷰어: requirement (spec fidelity)

---

## 발견사항

### 1. **[INFO]** `triggersApi.create` 반환 타입이 `void` — 생성된 리소스 ID를 버림

- 위치: `codebase/frontend/src/lib/api/triggers.ts` `create` 함수 (line 1278)
- 상세: `POST /api/triggers` 응답 바디에 생성된 트리거의 `id`·`endpointPath` 등이 포함돼 있을 수 있으나, `create: async (body): Promise<void>` 로 반환값을 버린다. 현재 `triggers/page.tsx`의 `createMutation.onSuccess` 는 단순히 query invalidate + toast 만 수행하고 생성 ID를 필요로 하지 않으므로 현재 동작에는 문제 없다. 단, 향후 생성 직후 해당 트리거의 drawer를 자동 오픈하는 UX가 추가될 경우 반환값이 필요해진다.
- 제안: 현재 범위(M-8 1단계) 내에서는 유지 가능. 추후 UX 확장 시 `Promise<{ id: string }>` 등으로 확장.

---

### 2. **[INFO]** `CreateTriggerBody.chatChannel` 필드 타입이 `Record<string, unknown>` — 타입 안전성 부재

- 위치: `codebase/frontend/src/lib/api/triggers.ts` `CreateTriggerBody` 인터페이스 (line 1233)
- 상세: `chatChannel?: Record<string, unknown>` 으로 선언됐다. 실제 전송 구조는 `{ provider, botToken, uiMapping, inboundSigningPlaintext(optional) }` 이며 spec §2.5 + 생성 다이얼로그 코드(`page.tsx` line 424-433)에서 필드가 명시되어 있다. `Record<string, unknown>` 은 타입 가드 없이 임의 키를 허용하므로, `botTokenRef` 나 `inboundSigningRef` 같은 금지 키가 실수로 포함되어도 컴파일 타임에 잡히지 않는다.
- 제안: 전용 타입(`CreateTriggerChatChannel`)으로 구체화하면 backend `assertChatChannelInputSafe` 400 에러를 컴파일 타임에 차단 가능. 현재 M-8 1단계 범위에서는 INFO 수준이나 M-8 2단계에서 ChatChannelCard 편집 타입 정비 시 함께 처리 권장.

---

### 3. **[INFO]** `TriggerUpdateBody.notification` / `.interaction` / `.chatChannel` 필드 타입이 `Record<string, unknown>` — 동일 관점

- 위치: `codebase/frontend/src/lib/api/triggers.ts` `TriggerUpdateBody` 인터페이스 (lines 1244-1252)
- 상세: 발견사항 2와 동일한 패턴. spec §3 / R-4 가 정의한 금지 키(`chatChannel.botTokenRef`, `inboundSigningPlaintext`)는 런타임에서만 400 으로 차단된다. drawer 각 카드가 직접 객체를 구성하므로 현재는 실수 위험이 낮으나, M-8 2단계 카드 추출 이후 호출 지점이 분산되면 실수 가능성이 높아진다.
- 제안: 발견사항 2와 동일 — M-8 2단계에서 구체화 권장.

---

### 4. **[INFO]** `getById` — `triggerId`가 `null`일 때 `enabled: !!triggerId` 가드에 의존, `triggersApi.getById(triggerId as string)` 캐스팅

- 위치: `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` 변경 부분 (`queryFn: () => triggersApi.getById(triggerId as string)`)
- 상세: 기존 코드도 동일 패턴(`enabled: !!triggerId`)이었으며, `triggerId`가 `null`이면 `enabled: false` 로 쿼리 자체가 실행되지 않는다. `as string` 캐스팅은 TypeScript 타입 검사를 위한 것이고 실행 경로상 `null`이 전달되지 않는다. 동작 보존이 확인된 패턴이므로 실질적 위험은 없다.
- 제안: 변경 불필요. 참고용 기록.

---

### 5. **[INFO]** spec `2-trigger-list.md` frontmatter `code` 목록에 `lib/api/triggers.ts` 미등재

- 위치: `spec/2-navigation/2-trigger-list.md` frontmatter `code` 필드
- 상세: 신설된 `codebase/frontend/src/lib/api/triggers.ts` 가 spec `code` 목록에 없다. 현재 목록은 `page.tsx`, `*.tsx`, `webhook-url.ts`, backend controller/service/dto 를 나열한다. spec frontmatter의 `code` 필드는 spec-impl coverage 추적에 사용된다. 빠진 항목이 coverage gap 오탐을 유발할 수 있다.
- 제안: spec frontmatter 에 `codebase/frontend/src/lib/api/triggers.ts` 추가 (project-planner 트랙). 단, M-8 은 구현 리팩터이므로 spec 변경이 의무는 아님 (consistency-check I-6 과 동일 관점).

---

### 6. **[SPEC-DRIFT]** `lib/api/triggers.ts` 신설 — spec §3 API 표에 frontend API 레이어 규약 미반영

- 위치: `codebase/frontend/src/lib/api/triggers.ts` (신설 전체)
- 상세: spec `2-trigger-list.md §3` API 표는 엔드포인트/메서드/설명만 기술하며, "frontend 는 typed 카탈로그 함수를 통해 호출한다" 는 패턴이 명시되지 않는다. 코드베이스 관례(`lib/api/executions.ts` 등)로 존재하되 spec 본문에 반영된 바 없다. 이번 M-8 1단계가 해당 패턴을 triggers 도메인에 확립하는 첫 단계이므로, spec 미반영은 코드 오류가 아니라 spec 갱신 누락이다.
- 제안: 코드 유지 + spec 반영. 갱신 대상: `spec/2-navigation/2-trigger-list.md §3` 하단에 "frontend 구현은 `lib/api/triggers.ts` typed 카탈로그 경유" 주석 또는 note 추가 (project-planner 트랙, `2-trigger-list.md §3`).

---

### 7. **[INFO]** `TriggerUpdateBody`에 `config` 최상위 키 미포함 — spec §3 PATCH note 와 경미한 불일치

- 위치: `codebase/frontend/src/lib/api/triggers.ts` `TriggerUpdateBody` (lines 1244-1252), spec §3 PATCH note
- 상세: spec §3 PATCH note 는 "top-level 키 `name`, `isActive`, `endpointPath`, `authConfigId`, `config`, 그리고 `notification`/`interaction`/`chatChannel`" 을 허용한다고 명시한다. 그러나 `TriggerUpdateBody` 에는 `config` 키가 없다. 현재 drawer 카드들은 top-level `notification`/`interaction`/`chatChannel` 키로 직접 전송하므로 실제 동작에는 문제 없다. spec 이 `config`(JSONB 키 직접 패치)를 열거한 것은 "하위 호환 경로" 이며 현재 구현이 이를 사용하지 않는 것은 의도적이다.
- 제안: 현재 범위에서 변경 불필요. spec 의 `config` 키 항목이 혼란을 줄 경우 project-planner 가 spec 주석을 정리할 수 있다.

---

## 요약

M-8 1단계 변경은 본래 목적(god-component API 직접 호출 8곳 제거 + typed 카탈로그 집중화)을 완전히 달성했다. spec `2-trigger-list.md` 의 API 엔드포인트 계약(§3), 단일 PATCH 경로(R-4), rotate/revoke 전용 엔드포인트(EIA §7.1, EIA §7.3, Chat Channel R-CC-10), 생성 다이얼로그 필드(§2.5), 인증 경고(R-15), 필드 권한 매트릭스(§2.3.1) 등 핵심 비즈니스 규칙이 구현에 정확히 반영되어 있다. 발견된 사항은 모두 INFO 또는 SPEC-DRIFT 수준이며 코드 동작 오류는 없다. `chatChannel` 관련 `Record<string, unknown>` 타입 약화는 현재 범위 내 기능적 위험은 낮으나 M-8 2단계에서 정비가 권장된다.

---

## 위험도

LOW
