# 아키텍처(Architecture) 리뷰 결과

## 발견사항

- **[INFO]** `TriggerListParams.type`/`status` 리터럴 유니온 narrowing — 올바른 계약 강화
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/frontend/src/lib/api/triggers.ts` — `TriggerListParams` (L89–95)
  - 상세: 이전 `string` 오픈 타입에서 `"webhook" | "schedule" | "manual"` / `"active" | "inactive"` 리터럴 유니온으로 좁힌 것은 API 계약을 타입 시스템에서 명시하는 올바른 방향이다. 호출부(`page.tsx` L201–203)의 `activeTab`/`statusFilter` 할당도 typecheck PASS 확인됨.

- **[INFO]** JSDoc 추가 — 레이어 책임 문서화 개선
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/frontend/src/lib/api/triggers.ts` — `TriggerListParams` (L89), `create` 함수 (L149–152), `TriggerListItem.workflow` (L78)
  - 상세: `TriggerListParams` 의 Spec §3 참조 JSDoc, `create` 의 void 반환 의도("queryKey 무효화로 재조회") 문서화, `TriggerListItem.workflow` 의 backend shape 편차 흡수 설명이 추가됐다. API 레이어가 왜 이중 shape 를 흡수하는지 명시함으로써 레이어 책임 경계가 문서 수준에서도 명확해졌다.

- **[INFO]** `/workflows` apiClient 직접 호출 잔류 주석 추가 — 의도 명확화
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/frontend/src/app/(main)/triggers/page.tsx` L229–230
  - 상세: 동일 파일 내 `triggersApi` 패턴과 `apiClient` 직접 호출 패턴이 혼재하는 상황에서 m-2 workflows 트랙 이전 예정이라는 주석이 추가됐다. 도메인 경계 의사결정(workflows 도메인은 별도 트랙)이 코드 근처에 기록되어 후속 개발자의 혼란을 줄인다.

- **[INFO]** 유닛 테스트 신설 — API 레이어 계약 검증
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/frontend/src/lib/api/__tests__/triggers.test.ts`
  - 상세: `triggersApi` 의 모든 공개 메서드(list, getById 4-way, update, create, rotateNotificationSecret, revokeInteractionToken, rotateBotToken)에 대한 12개 테스트가 신설됐다. 테스트가 `vi.mock("../client")` 로 apiClient 를 격리하고 URL·HTTP verb·파라미터·응답 정규화를 검증하는 구조는 API 레이어의 단일 책임을 보강하는 좋은 설계다. 이중 envelope (`res.data.data`) 언래핑 검증이 포함돼 아키텍처적 shape 흡수 로직의 정확성이 확보됐다.

- **[WARNING]** 컴포넌트(`page.tsx`)의 뷰모델 매핑 로직 잔류 — SRP 미완성 (Deferred)
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/frontend/src/app/(main)/triggers/page.tsx` L205–219 (`queryFn` 내 `raw.map(...)`)
  - 상세: `triggersApi.list()` 가 `TriggerListItem[]` 을 반환하지만 컴포넌트 `queryFn` 내에서 `Trigger` 뷰모델로 15줄 수동 매핑이 여전히 수행된다. 이 매핑 함수는 API 레이어 또는 `lib/mappers/triggers.ts` 로 이관해야 컴포넌트가 UI 제어만 담당하는 단일 책임 원칙(SRP)이 달성된다. RESOLUTION.md 에 M-8 2단계 defer 로 명시됐고, 이번 review fix 의 범위(testing + type/doc 강화)를 벗어나므로 차단 수준은 아니다.

- **[WARNING]** `TriggerListItem`(raw) ↔ `Trigger`(뷰모델) 타입 이중 존재 — 타입 SoT 미통합 (Deferred)
  - 위치: `codebase/frontend/src/lib/api/triggers.ts` — `TriggerListItem`, `codebase/frontend/src/app/(main)/triggers/page.tsx` — `interface Trigger`
  - 상세: 두 타입에 `id`, `name`, `type`, `isActive`, `endpointPath`, `cronExpression`, `nextRunAt`, `authConfigId`, `chatChannelHealth` 가 중복 선언되어 있다. 현재는 매핑이 명시적이라 단방향 의존이 유지되지만, 필드 추가·제거 시 두 타입을 동시에 갱신해야 하는 drift 위험이 있다. M-8 2단계 hook 추출 시 mapper 를 공식 분리하면 해소된다. RESOLUTION.md 에 deferred 기록됨.

- **[WARNING]** `CreateTriggerBody.chatChannel` / `TriggerUpdateBody.chatChannel/notification/interaction` 오버-와이드 타입 (Deferred)
  - 위치: `codebase/frontend/src/lib/api/triggers.ts` L105, L121–123
  - 상세: `Record<string, unknown>` 으로 선언돼 컴파일 타임 필드 오남용 차단이 불가하다. `page.tsx` L278–287 에서 chatChannel 리터럴 객체를 직접 구성할 때 타입 안전성이 없다. `ChatChannelConfigView` 가 이미 정의된 상황에서 생성용 `ChatChannelCreateInput` 입력 타입 신설이 가능하나, behavior-preserving 보존 원칙과 M-8 2단계 defer 결정에 따라 이번 단계에서는 제외됐다. RESOLUTION.md W-6 에 명시됨.

## 요약

이번 review fix 커밋은 아키텍처 관점에서 두 가지 실질적 개선을 달성했다. 첫째, `TriggerListParams.type`/`status` 를 리터럴 유니온으로 narrowing 하여 API 레이어의 타입 계약이 강화됐다. 둘째, `triggers.test.ts` 신설로 API 레이어의 핵심 shape 흡수 로직(getById 4-way, 이중 envelope 언래핑)이 독립 테스트로 검증되어 레이어 단일 책임 경계가 보강됐다. 아키텍처 관점의 미결 항목(뷰모델 매핑 컴포넌트 잔류·타입 이중 존재·오버-와이드 chatChannel 타입)은 모두 M-8 2단계로 적절히 defer 됐으며, 이번 1단계 범위(behavior-preserving + testing/type/doc 강화)와 일관된 결정이다.

## 위험도

LOW
