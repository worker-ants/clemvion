# 아키텍처(Architecture) 리뷰 결과

## 발견사항

- **[INFO]** API 레이어 추출 방향 — 정석 레이어 분리 달성
  - 위치: `codebase/frontend/src/lib/api/triggers.ts` (신설)
  - 상세: `triggersApi` 객체를 `lib/api/` 하위에 배치하고 `apiClient` 직접 호출을 컴포넌트에서 완전히 제거한 방향은 프레젠테이션/데이터 레이어 책임 분리(레이어 책임 원칙) 측면에서 올바른 결정이다. `executions.ts` 관례를 답습해 팀 내 일관성도 유지된다.

- **[WARNING]** 컴포넌트(`page.tsx`)가 여전히 비즈니스 로직(매핑·검증)을 직접 보유
  - 위치: `codebase/frontend/src/app/(main)/triggers/page.tsx` — `queryFn` 내 `raw.map(...)` 변환 블록(약 15줄), `handleCreate` 내 hex-regex 클라이언트 검증 블록
  - 상세: `triggersApi.list()`가 `TriggerListItem[]`을 반환하지만, 컴포넌트 내 `queryFn`에서 해당 raw 항목을 다시 `Trigger` 뷰모델로 수동 매핑한다. 이 매핑 로직(필드 선택·기본값 보정)은 API 레이어 또는 별도 뷰모델 변환 함수로 이동시키는 것이 단일 책임 원칙(SRP)에 부합한다. 또한 `handleCreate`의 hex 정규식 검증도 폼 검증 전용 함수나 hook으로 분리되어야 컴포넌트가 UI 제어만 담당하는 역할 경계를 지킬 수 있다. 단, 이는 M-8 2단계(hooks 추출)가 의도한 후속 작업으로 현재 1단계 범위 내에서는 동작 보존이 우선됐기 때문에 차단 수준은 아니다.

- **[WARNING]** `TriggerListItem`과 `Trigger`(뷰모델) 타입이 이중으로 존재하며 SoT 경계가 불명확
  - 위치: `lib/api/triggers.ts`의 `TriggerListItem`, `page.tsx`의 `interface Trigger`
  - 상세: `TriggerListItem`(API 응답 raw shape)과 `Trigger`(페이지 뷰모델)가 별도 타입으로 존재한다. 현재는 `queryFn` 내 명시적 매핑으로 의존 방향이 단방향이므로 아키텍처 문제는 아니지만, 두 타입의 필드가 상당 부분 겹쳐 drift가 발생하기 쉽다. M-8 2단계에서 `useTrigger` hook을 추출할 때, 매핑 함수(`TriggerListItem -> Trigger`)를 `lib/api/triggers.ts`에 포함시키거나 별도 `lib/mappers/triggers.ts`로 공식 분리하는 방안을 권장한다.
  - 제안: 매핑 책임을 API 레이어 또는 전용 mapper 모듈로 이관해 컴포넌트가 뷰모델 타입만 import하게 구성.

- **[WARNING]** `CreateTriggerBody.chatChannel`이 `Record<string, unknown>` 오버-와이드 타입
  - 위치: `lib/api/triggers.ts` — `interface CreateTriggerBody` 및 `interface TriggerUpdateBody`의 `chatChannel`/`notification`/`interaction` 필드
  - 상세: `chatChannel?: Record<string, unknown>`은 컴파일 타임에 필드 오남용을 전혀 차단하지 못한다. `page.tsx`의 `createMutation`에서 `chatChannel` 객체를 직접 리터럴로 구성하는데, 이 과정에서 타입 안전성이 사실상 없다. `ChatChannelConfigView`가 이미 정의돼 있으므로 생성용 입력 타입(`ChatChannelCreateInput`)을 별도로 정의하고 `CreateTriggerBody.chatChannel`을 강타입으로 교체하면 아키텍처 경계가 명확해진다.
  - 제안: `chatChannel: ChatChannelCreateInput`으로 타입을 좁히거나, 최소한 필수 필드(`provider`, `botToken`)를 required로 명시.

- **[INFO]** `getById`의 backend shape 편차 흡수 로직이 API 레이어에 집중됨 — 긍정적
  - 위치: `lib/api/triggers.ts` — `getById` 함수 내 `body?.data ?? body` + `workflow.name` 평탄화
  - 상세: backend 응답이 `{data: {...}}` wrapper를 사용하거나 직접 반환하는 두 가지 패턴 편차를 API 레이어에서 흡수하는 점은 컴포넌트를 backend shape 변화로부터 보호하는 좋은 설계다. 다만 이 로직은 `normalizePagedResponse`처럼 공유 유틸로 추출 가능한 패턴(`unwrapData<T>`)이므로, 다른 API 파일에 동일 패턴이 반복된다면 통합 고려.

- **[INFO]** `page.tsx`의 `/workflows` 호출이 `apiClient` 직접 호출로 잔류
  - 위치: `codebase/frontend/src/app/(main)/triggers/page.tsx` — `queryFn: () => apiClient.get("/workflows")`
  - 상세: 현재 `/workflows` 호출을 `workflows` 도메인 트랙으로 명시적으로 분리한 결정은 도메인 경계 측면에서 적절하다. 단, 동일 파일 내에서 `triggersApi`와 `apiClient` 두 패턴이 혼재하여 가독성상 일관성이 떨어진다. m-2 workflows 트랙 착수 시 해소될 예정이므로 현재는 INFO 수준.

- **[INFO]** `triggersApi`가 plain object singleton으로 export — 테스트 대체 가능성 제한
  - 위치: `lib/api/triggers.ts` — `export const triggersApi = { ... }`
  - 상세: `executions.ts` 관례를 따른 결정이나, plain object는 Jest/Vitest에서 mock 교체 시 `jest.mock('…/triggers')` 모듈 수준 교체에 의존해야 한다. 의존성 주입 인터페이스(DI) 방식보다 테스트 격리가 어렵다. 현재 프로젝트 관례가 이 패턴이므로 변경은 팀 결정 사항이지만 기록해 둔다.

## 요약

이번 변경(M-8 1단계)은 `lib/api/triggers.ts` 신설로 컴포넌트가 `apiClient`를 직접 호출하던 8곳을 typed 카탈로그로 집중시켜 데이터 레이어 분리의 첫 단계를 완성했다. 도메인 타입 SoT 통합(로컬 중복 제거), backend shape 편차 흡수의 API 레이어 집중, 도메인 경계(`/workflows` 분리) 의사결정 등 아키텍처 측면의 판단이 전반적으로 타당하다. 다만 `page.tsx` 내 뷰모델 매핑 로직과 클라이언트 검증이 컴포넌트에 잔류하고, `CreateTriggerBody.chatChannel`이 과도하게 와이드한 타입으로 정의된 점은 M-8 2단계(hooks 추출) 착수 시 함께 해소되어야 레이어 책임 분리가 완성된다.

## 위험도

LOW
