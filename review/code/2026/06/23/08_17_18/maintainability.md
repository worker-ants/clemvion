# 유지보수성(Maintainability) 리뷰

## 발견사항

### lib/api/triggers.ts

- **[INFO]** `chatChannel` 필드 타입이 `Record<string, unknown>`으로 느슨하게 정의됨
  - 위치: `CreateTriggerBody.chatChannel`, `TriggerUpdateBody.chatChannel`
  - 상세: `chatChannel` 필드가 `Record<string, unknown>`으로 선언되어 있어 IDE 자동완성 및 타입 검사 혜택을 받지 못한다. `provider`, `botToken`, `uiMapping`, `inboundSigningPlaintext` 등 알려진 키가 있는 구조인데도 타입이 불투명하여, 호출부(`page.tsx`의 `chatChannel` 객체 생성 코드)에서도 `Record<string, unknown>`으로 수동 타입 선언해야 하는 연쇄 약화가 발생한다.
  - 제안: `ChatChannelCreateInput` 또는 `ChatChannelPatchInput` 인터페이스를 신설하고 `provider`, `botToken`, `uiMapping`, `inboundSigningPlaintext?` 필드를 명시적으로 선언한다. 이미 `ChatChannelConfigView`가 응답 타입으로 존재하므로 요청 측 대칭 타입을 추가하는 패턴이 자연스럽다.

- **[INFO]** `getById` 내부에서 `as` 단언이 2단계로 중첩됨
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/frontend/src/lib/api/triggers.ts` `getById` 함수 (lines ~1275-1283 전체 파일 컨텍스트 기준)
  - 상세: `res.data as { data?: unknown }` → `(body?.data ?? body) as TriggerDetail & {...}` 순서로 타입 단언이 연쇄된다. 이는 backend 응답 shape 편차(중첩 `data` 래퍼 유무)를 흡수하는 의도로 주석에 설명되어 있어 의도는 명확하지만, 단언이 두 번 겹치면 타입 안전성을 추론하기 어렵다.
  - 제안: 중간 타입을 `interface RawTriggerResponse`로 명시적으로 분리하거나, `normalizeEnvelope<T>(data: unknown): T` 헬퍼를 `paginated.ts` 옆에 두어 재사용성을 높인다. `executions.ts`에 동일 패턴이 있다면 공통화 여부도 검토할 만하다.

- **[INFO]** `TriggerListParams.type`과 `status`가 `string`으로 열려 있음
  - 위치: `TriggerListParams` 인터페이스
  - 상세: `type?: string`, `status?: string`으로 선언되어 있으나 실제 허용 값은 각각 `"webhook" | "schedule" | "manual"`, `"active" | "inactive"`로 한정된다. `FILTER_TABS`, `STATUS_FILTERS` 상수가 `page.tsx`에 이미 정의되어 있으므로 이 타입을 재사용하거나 동일 리터럴 유니온을 `triggers.ts`에 직접 선언하면 오타 방지와 IDE 지원이 강화된다.
  - 제안: `type?: "webhook" | "schedule" | "manual"`, `status?: "active" | "inactive"` 로 좁힌다.

---

### triggers/page.tsx

- **[WARNING]** `TriggersPage` 컴포넌트가 상태·쿼리·뮤테이션·폼 검증·렌더 전체를 단일 함수에서 처리하며 함수 길이가 과도함
  - 위치: `TriggersPage` 함수 전체 (~302~900+ 라인)
  - 상세: 이번 변경의 직접 대상은 아니나, `apiClient` 직접 호출 3곳이 `triggersApi`로 교체된 후에도 컴포넌트 자체는 여전히 폼 상태 8개, 쿼리 3개, 뮤테이션 2개, 복잡한 JSX 렌더를 단일 함수에서 관리한다. 이는 이번 변경이 "god-component 분해의 API 레이어 선행 단계"임을 명시하고 있으므로, 현재 단계로서는 의도적 잔존이지만 2단계에서 반드시 해소가 필요한 부채다.
  - 제안: 계획된 M-8 2단계에서 `useCreateTriggerForm` hook(폼 상태 8개 + `handleCreate` + `resetForm` 캡슐화)과 Create Dialog를 별도 컴포넌트로 추출하는 것이 최우선 분리 지점이다.

- **[INFO]** Create Dialog 내부의 `chatChannel` 섹션에서 provider별 분기 렌더가 JSX 인라인 3단계 중첩으로 작성됨
  - 위치: `page.tsx` `{formChatChannelEnabled ? (...) : null}` 블록, 약 584~683 라인
  - 상세: `formChatChannelEnabled` 조건 → `{formChatChannelProvider !== "telegram" ? ... : null}` 분기 → Label 내 `formChatChannelProvider === "slack" ? ... : ...` 분기가 중첩된다. 각 분기마다 `t("triggers.chatChannel.inboundSigning...")` 키가 placeholder, label, help text에 3회 반복된다.
  - 제안: `<InboundSigningField provider={formChatChannelProvider} ... />` 컴포넌트로 추출하면 중첩 깊이와 i18n 키 반복을 동시에 줄일 수 있다. M-8 2단계 Create Dialog 컴포넌트 추출 시 함께 처리하면 적절하다.

- **[INFO]** `apiClient`가 `page.tsx`에 여전히 import되어 사용 중
  - 위치: `page.tsx` 3번째 import 라인 `import { apiClient } from "@/lib/api/client";`
  - 상세: `triggersApi`로 trigger 도메인 호출 3곳을 이전한 후에도 `/workflows` 쿼리에서 `apiClient`를 직접 사용한다. 이는 commit 메시지에 "workflows 도메인이라 잔류(m-2 workflows 트랙)"로 명시된 의도적 잔존이다. 코드 자체에 이 이유를 설명하는 주석이 없어 후속 개발자가 미완료 작업으로 오해할 수 있다.
  - 제안: `apiClient.get("/workflows")` 바로 위 또는 해당 query 정의부에 `// m-2 workflows 트랙: lib/api/workflows.ts 이전 전 임시` 한 줄 주석을 추가한다.

---

### trigger-detail-drawer.tsx

- **[INFO]** 로컬 정의 타입(`ChatChannelConfigView`, `TriggerDetail`)이 삭제되고 `lib/api/triggers.ts`로 이동됨 — 중복 제거 효과 양호
  - 위치: diff `-57 lines` 제거
  - 상세: 63줄에 달하는 로컬 타입 정의가 제거되고 `lib/api/triggers.ts`의 export로 대체되었다. 타입 SoT 중앙화가 명확히 개선되었으며 추가 지적 사항 없음.

---

## 요약

이번 변경은 `trigger-detail-drawer.tsx`의 `apiClient` 직접 호출 8곳과 `page.tsx`의 호출 3곳을 `lib/api/triggers.ts` typed 카탈로그로 집약한 구조 개선이다. API 레이어 분리라는 단일 목적에 집중하여 동작 보존이 명확하고, 타입 중복 제거(로컬 인터페이스 63줄 제거)와 호출 경로 단순화 효과가 크다. 주요 잔여 과제는 `CreateTriggerBody.chatChannel`의 느슨한 `Record<string, unknown>` 타입(타입 안전성 감소), `TriggersPage` 컴포넌트의 god-component 구조(계획된 2단계 대상), 그리고 `apiClient` 잔류에 대한 주석 부재로, 모두 현재 단계의 의도적 범위 제한에서 비롯된 것이다. 치명적 유지보수성 문제는 없으며 2단계 분리 작업이 진행되면 나머지 우려 사항도 자연스럽게 해소될 구조다.

## 위험도

LOW
