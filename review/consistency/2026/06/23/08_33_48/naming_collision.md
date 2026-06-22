# 신규 식별자 충돌 검토 결과

검토 대상: `spec/2-navigation` — M-8 1단계 (`lib/api/triggers.ts` API 레이어 추출)
검토 모드: --impl-done (구현 완료 후 검토)

---

## 발견사항

### **[WARNING]** 백엔드 `TriggerDetail` 과 프론트엔드 신규 `TriggerDetail` 동명 공존

- **target 신규 식별자**: `export interface TriggerDetail` (`codebase/frontend/src/lib/api/triggers.ts:32`)
- **기존 사용처**: `export type TriggerDetail = Trigger & { ... }` (`codebase/backend/src/modules/triggers/triggers.service.ts:36`)
- **상세**: 두 정의는 서로 다른 TypeScript 컴파일 경계(frontend / backend)에 있어 런타임 충돌은 없다. 그러나 의미가 다르다 — 백엔드의 `TriggerDetail` 은 Typeorm `Trigger` 엔티티에 `cronExpression`/`timezone`/`nextRunAt` 을 overlay 한 ORM-레벨 타입이고, 프론트엔드의 `TriggerDetail` 은 `GET /triggers/:id` 응답을 sanitize·flatten 한 클라이언트-사이드 뷰 타입이다. 지금은 컴파일 격리로 충돌이 없지만, 향후 shared-types 패키지 도입 시 동명 타입이 충돌할 위험이 있다. 또한 코드 검색("TriggerDetail 이란?") 시 두 정의를 혼동할 수 있다.
- **제안**: 프론트엔드 타입을 `TriggerDetailView` 또는 `TriggerDetailDto` 로 개칭하거나, 백엔드 내부 타입을 `TriggerWithSchedule` 등 구현 전용 이름으로 변경하면 의미 분리가 명확해진다. 단, M-8 1단계는 behavior-preserving 리팩터이므로 즉시 변경보다는 M-8 2단계(god-component 분할) 계획에 이름 변경을 포함하는 것을 권장한다.

---

### **[INFO]** `page.tsx` 로컬 `Trigger` 인터페이스와 신규 `TriggerListItem` 혼재

- **target 신규 식별자**: `export interface TriggerListItem` (`codebase/frontend/src/lib/api/triggers.ts:72`)
- **기존 사용처**: `interface Trigger { ... }` (`codebase/frontend/src/app/(main)/triggers/page.tsx:59`) — 로컬 비공개 표시용 타입
- **상세**: `TriggerListItem` 은 백엔드 raw 응답 형태, `Trigger` 는 표시용 뷰 모델로 역할이 분리되어 있다 (page.tsx 내부에서 `.map()` 으로 변환). 두 타입은 다른 파일/스코프에 있어 컴파일 충돌 없음. 그러나 두 이름이 모두 "트리거 목록 행"을 가리켜 신규 기여자가 혼동할 수 있다.
- **제안**: 향후 M-8 2단계에서 page.tsx 의 로컬 `Trigger` 를 `TriggerRow` (표시 모델 관례)나 `TriggerViewItem` 으로 개칭하면 `TriggerListItem`(raw) ↔ 표시 모델이 명확히 구분된다. 현재는 INFO 수준 — 강제 변경 불요.

---

### **[INFO]** `ChatChannelConfigView` 는 신규 공개 식별자 — 기존 충돌 없음

- **target 신규 식별자**: `export interface ChatChannelConfigView` (`codebase/frontend/src/lib/api/triggers.ts:14`)
- **기존 사용처**: 이전에는 `trigger-detail-drawer.tsx` 내부의 비공개 `interface ChatChannelConfigView` 로만 존재. 이번 리팩터로 동일 정의가 `lib/api/triggers.ts` 로 이동·공개(export)됐고, drawer 파일은 이를 import 한다. 백엔드에는 `ChatChannelConfig`(다른 이름)가 존재하며 공유 경계 없음.
- **상세**: 이동 전 정의와 이동 후 정의가 동일 구조라 의미 충돌이 없다. 전역 검색에서도 단일 정의만 발견된다.
- **제안**: 현재 문제 없음. 참고 사항으로 기록.

---

### **[INFO]** `triggersApi` 네임스페이스 — 기존 충돌 없음

- **target 신규 식별자**: `export const triggersApi` (`codebase/frontend/src/lib/api/triggers.ts:126`)
- **기존 사용처**: `lib/api/` 내 다른 파일들은 `workflowsApi`, `executionsApi`, `integrationsApi` 등 동일 패턴. `triggersApi` 라는 이름은 이번에 신규 도입.
- **상세**: 네이밍 컨벤션 완전 준수. 충돌 없음.
- **제안**: 없음.

---

### **[INFO]** API 엔드포인트 충돌 없음

신규 도입된 API 호출(`GET /triggers`, `GET /triggers/:id`, `POST /triggers`, `PATCH /triggers/:id`, `POST /triggers/:id/notification/rotate-secret`, `POST /triggers/:id/interaction/revoke-token`, `POST /triggers/:id/chat-channel/rotate-bot-token`)은 모두 `spec/2-navigation/2-trigger-list.md §3` 에 이미 정의된 기존 엔드포인트이며, 신규 endpoint 를 도입하지 않는다. 충돌 없음.

---

### **[INFO]** 파일 경로 충돌 없음

신규 파일 `codebase/frontend/src/lib/api/triggers.ts` 는 기존 `lib/api/` 관례(`workflows.ts`, `executions.ts` 등)와 일치하는 위치이며 기존 파일과 겹치지 않는다.

---

## 요약

M-8 1단계에서 도입된 식별자(`triggersApi`, `TriggerDetail`, `ChatChannelConfigView`, `TriggerListItem`, `TriggerListParams`, `CreateTriggerBody`, `TriggerUpdateBody`)는 프론트엔드 범위 내에서 기존 이름과 충돌하지 않는다. 주목할 점은 `TriggerDetail` 이 백엔드(`triggers.service.ts`)에도 동명으로 존재하나, 두 타입은 서로 다른 컴파일 경계에 격리되어 현재 런타임 및 타입 충돌이 없다. 다만 shared-types 패키지 도입 시 충돌 위험이 있으므로 WARNING 으로 기록한다.

---

## 위험도

LOW
