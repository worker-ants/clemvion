# 신규 식별자 충돌 검토 결과

## 발견사항

### 발견사항 1

- **[WARNING]** 프론트엔드 `TriggerDetail` 인터페이스와 백��드 `TriggerDetail` 타입 동명 충돌
  - target 신규 식별자: `export interface TriggerDetail` — `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/frontend/src/lib/api/triggers.ts:32`
  - 기존 사용처: `export type TriggerDetail = Trigger & { cronExpression?; timezone?; nextRunAt? }` — `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/backend/src/modules/triggers/triggers.service.ts:36`
  - 상세: 두 정의는 서로 다른 레이어(프론트엔드 API 클라이언트 vs 백엔드 ���비스 내부 타입)에 있어 TypeScript 컴파일 타임 충돌은 ��생하지 않는다. 그러나 이름이 동일하여 개발자가 두 타입을 혼동할 가능성이 있다. 프론트엔드 `TriggerDetail`은 응답 DTO 정규화 후 뷰 모델(workflowName, chatChannelHealth 등 UI 전용 필드 다수 포함)이고, 백엔드 `TriggerDetail`은 `Trigger` 엔티티에 `cronExpression/timezone/nextRunAt`을 join한 서비스 내부 조합 타입이라 의��가 다르다. 백엔드 `TriggerDetail`이 API 응답 계약(`triggers.controller.ts`)을 통해 직접 시리얼라이즈되지는 않고 내부 사용에만 쓰이지만, 코드 검색 시 혼선 여지가 있다.
  - 제���: 백엔드 내부 타입을 `TriggerWithSchedule`(또는 `TriggerWithMeta`)으로 rename하여 이름 충돌을 해소한다. 또는 프론트엔드 측을 `TriggerDetailView`로 변경해 UI 뷰 모델임을 명시한다. 두 파일 모두 현재 브랜치에서 변경 가능하다.

---

### 발견사항 2

- **[INFO]** `triggersApi` 네임스페이스 신규 도입 — 기존 패턴과 정합
  - target 신규 식별자: `export const triggersApi` — `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/frontend/src/lib/api/triggers.ts:126`
  - 기존 사용처: 기존에 `triggersApi`라는 이름이 사용된 곳은 없음. `executionsApi`, `workflowsApi` 등 동일 `*Api` 컨벤션 사용 중.
  - 상세: 기존 충돌 없음. `lib/api/` 폴더의 `executionsApi`(`executions.ts:171`), `backgroundRunsApi`(`executions.ts:291`) 등과 동일 naming 컨벤션을 따름. 신규 파일(`triggers.ts`)이 기존 파일(`triggers.ts`)을 새로 생성(신규 파일이므로 ��어쓰기 없음).
  - 제안: 없음. 패턴 일관성 충족.

---

### 발견사항 3

- **[INFO]** `ChatChannelConfigView` 인터페이스 — 기존 동명 타입 없음
  - target 신규 식별자: `export interface ChatChannelConfigView` — `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/frontend/src/lib/api/triggers.ts:14`
  - 기존 사용처: 프론트엔드·백엔드 전체에서 해당 이름 없음.
  - 상세: 충돌 없음. 백엔드 `ChatChannelConfig` DTO 와 이름이 달라 혼동 소지 적음. `View` suffix 가 프론트엔드 정규화 후 sanitized 형태임을 명시하므로 의미도 명확하다.
  - 제안: 없음.

---

### 발견사항 4

- **[INFO]** `TriggerListItem`, `TriggerListParams`, `CreateTriggerBody`, `TriggerUpdateBody` — 기존 충돌 없음
  - target 신규 식별자: 위 4개 인터페이스 — `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/frontend/src/lib/api/triggers.ts`
  - 기존 사용처: 프론트엔���·백엔드 전체 검색 결과 동명 인터페이스/타입 없음. 백엔드에는 `CreateTriggerDto`, `UpdateTriggerDto`가 있으나 이름이 다르다.
  - 상세: 충돌 없음.
  - 제안: 없음.

---

### 발견사항 5

- **[INFO]** `TriggerDetailDrawer` 컴포넌트 ��� 기존 동명 없음
  - target 신규 식별��: `export function TriggerDetailDrawer` — `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx:57`
  - 기존 사용처: 기존에 해당 이름 없음. 파일 자체는 기존 파일을 리팩터한 것으로 신규 export명.
  - 상세: 충돌 없음.
  - 제안: 없음.

---

## 요약

이번 M-8 1단계 리팩터링이 도입한 ���규 식별자 중 실질적 충돌 위험은 `TriggerDetail` 이름 중복 1건이다. 프론트엔드 `lib/api/triggers.ts`의 `TriggerDetail`(UI 뷰 모델)과 백엔드 `triggers.service.ts`의 `TriggerDetail`(내부 조합 타입)이 동명이나 레이어가 달라 컴파일 오류는 없다. 그러나 개발자 혼선 가능성이 있어 백엔드 측 이름을 `TriggerWithSchedule` 등으로 구분하는 것이 권장된다. 나머지 신규 식별자(`triggersApi`, `ChatChannelConfigView`, `TriggerListItem` 등)는 기존 코드베이스와 충돌하지 않으며 기존 `*Api` 컨벤션과 정합한다. spec 파일 ID(`trigger-list`)도 `spec/2-navigation/` 내에서 단일 정의이며 충돌 없다.

## 위험도

LOW
