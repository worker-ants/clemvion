# Architecture Review — 2026-06-24 21:15:24

## 발견사항

### [INFO] 캐시 무효화 책임의 이중 위치 (장기 백로그 인식됨)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/codebase/frontend/src/components/web-chat/use-web-chat.ts` — `useUpdateWebChatMeta`, `useUpdateWebChatAppearance` 의 `onSuccess`
- 상세: 캐시 무효화 로직(`invalidateQueries`)이 훅 내부 `onSuccess` 에 하드코딩되어 있다. 현재는 WEB_CHAT_INSTANCES_KEY + TRIGGERS_KEY 두 키를 모두 무효화하는데, 실제로 어떤 키를 무효화할지는 호출자(컴포넌트) 컨텍스트에 따라 달라질 수 있다. 커밋 메시지에서 "장기 백로그: 캐시 무효화 책임을 onDeleted 콜백에 완전 위임"으로 인식하고 있어 의식적 결정임은 확인됨.
- 제안: 현 상태를 유지하되, 향후 캐시 전략이 다양해질 경우 `onSuccess?: () => void` 콜백을 외부에서 주입받는 패턴으로 리팩터링 고려. 단, 현재 사용 범위(단일 콘솔 경로)에서는 현행이 과도한 추상화를 피하는 합리적 선택.

### [INFO] `useUpdateWebChatMeta` 의 빈 바디 전송 방어 미비
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/codebase/frontend/src/components/web-chat/use-web-chat.ts` 587-592행
- 상세: `name`과 `isActive` 모두 `undefined`이면 빈 객체(`{}`)를 PATCH로 전송한다. 서버가 멱등 처리한다면 기능상 무해하지만, 의미 없는 네트워크 요청이 발생하고 호출자가 실수로 빈 입력을 넘길 경우 조용히 성공으로 처리된다.
- 제안: `if (!name && isActive === undefined) return Promise.reject(new Error("no fields to update"))` 또는 TS 레벨에서 `name` | `isActive` 중 하나 이상을 required로 강제하는 `Require<T, K>` 패턴 적용.

### [INFO] `WebChatRenameDialog` 의 key-remount 패턴 — 인라인 Inner 함수 명명 일관성 확보
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/codebase/frontend/src/components/web-chat/web-chat-rename-dialog.tsx` 695-700행
- 상세: `Inner` → `WebChatRenameDialogInner` 로 변경해 `TriggerDeleteDialog.DialogInner` 패턴과 일관성을 맞춘 것은 명명 응집도 측면에서 긍정적이다. key-remount 패턴 자체는 React 관용적 state 초기화 기법으로 적합하며, 계층 구조(외부 Shell → 내부 Inner)가 단일 책임을 적절히 분리하고 있다.
- 제안: 현 구조 유지. 다만 `WebChatRenameDialogInner`가 파일 외부에서 직접 사용될 위험을 막으려면 파일 상단에 "이 함수는 내부 전용, WebChatRenameDialog 를 통해서만 사용" 주석을 추가하거나, 모듈 외 export 없이 함수 선언을 유지하는 현행을 문서화.

### [INFO] `useWebChatInstances` 의 이중 필터링(서버+클라이언트) 패턴
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/codebase/frontend/src/components/web-chat/use-web-chat.ts` 437-471행
- 상세: 서버 측 `interactionEnabled=true` 필터와 클라이언트 측 `.filter(t => t.type === "webhook" && t.config?.interaction?.enabled)` 가 중복 적용된다. 주석에 "캐시 오염·응답 변형에 대한 방어"로 명시되어 있어 의도적임. 방어적 프로그래밍 관점에서 타당하나, 향후 서버 필터 변경 시 클라이언트 필터가 silent drift될 수 있다.
- 제안: 이중 필터 의도를 JSDoc에 명시(현행)로 충분. 서버/클라이언트 필터 조건이 동기화 상태임을 단위 테스트에서 검증하는 스냅숏 테스트 추가를 장기 고려사항으로 등록.

### [INFO] 테스트 파일의 단일 `patchMock` 공유
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/codebase/frontend/src/components/web-chat/__tests__/use-web-chat.test.ts` 89-97행
- 상세: `useUpdateWebChatAppearance` 테스트 스위트와 `useUpdateWebChatMeta` 테스트 스위트가 동일한 `patchMock` 인스턴스를 공유한다. `beforeEach(() => patchMock.mockReset())`로 각 `describe` 블록 내 초기화가 이루어져 현재 격리는 충분하지만, 테스트 파일에 세 번째 훅이 추가될 때 `describe` 블록 간 의존성이 생길 위험이 있다.
- 제안: 현 규모에서는 허용 가능. 향후 추가 스위트가 생기면 `describe` 블록마다 `vi.fn()` 을 각각 선언하는 패턴으로 전환 고려.

## 요약

이번 변경은 `useUpdateWebChatMeta` JSDoc 보강, `WebChatRenameDialogInner` 명명 일관성 확보, reject 경로 테스트 추가, 사용자 가이드 §6 추가로 구성되며, 기능 구현보다 문서화·테스트 coverage·코드 명확성 향상에 집중된 개선 커밋이다. 아키텍처 관점에서 레이어 책임 분리(데이터 훅 / UI 다이얼로그 / 문서)가 명확하게 유지되고 있고, 각 훅의 단일 책임 원칙이 잘 지켜지고 있다. `useUpdateWebChatAppearance`와 `useUpdateWebChatMeta`의 공통 패턴(onSuccess invalidate, onError 미처리)이 JSDoc으로 명시되어 팀 지식이 코드에 내재화되었다. 캐시 무효화 책임의 훅 내 위치는 현재 사용 범위 기준 합당하며, 빈 바디 전송 방어 미비는 낮은 우선순위 INFO 사항으로 즉각 차단 불필요. 전반적으로 구조적 위험 없음.

## 위험도

NONE
