### 발견사항

- **[INFO]** `beforeunload` 핸들러 — `window` 전역 이벤트 부착 (의도적, 정상 처리)
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/codebase/frontend/src/app/(main)/web-chat/page.tsx` lines 178-186
  - 상세: `WebChatDetail` 컴포넌트가 `isDirty` 상태에서 `window.addEventListener("beforeunload", handler)` 를 붙인다. cleanup(`removeEventListener`)이 return 함수에서 정확히 수행되고, `isDirty` 의존성으로 effect 가 재실행되며 핸들러가 교체된다. 리마운트·탭 전환·`isDirty=false` 복귀 시 모두 제거된다.
  - 제안: 정상 동작. 다만 `WebChatDetail` 이 여러 인스턴스에 걸쳐 동시에 렌더되는 경우는 없으므로(단일 `selected`) 중복 핸들러 누적 위험 없음.

- **[INFO]** `TriggerDeleteDialog` 에 `onDeleted` optional prop 추가 — 기존 호출자 하위 호환성
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/codebase/frontend/src/components/triggers/trigger-delete-dialog.tsx`
  - 상세: `onDeleted?: () => void` 는 optional 이므로 기존 `triggers/page.tsx` 등 미전달 호출자는 기존 동작(캐시 무효화·toast·onClose)을 그대로 유지한다. 인터페이스 변경으로 인한 breaking change 없음.
  - 제안: 이상 없음.

- **[INFO]** `useUpdateWebChatMeta` 성공 시 `["triggers"]` 캐시 무효화 — Triggers 화면 refetch 유발
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/codebase/frontend/src/components/web-chat/use-web-chat.ts` lines 278-282
  - 상세: 이름·활성 PATCH 성공 시 `WEB_CHAT_INSTANCES_KEY` 와 `TRIGGERS_KEY`(`["triggers"]`) 양쪽을 무효화한다. Triggers 페이지가 동시에 열려 있으면 refetch 가 발생하지만, 이는 동일 자원을 두 화면이 공유하는 구조상 올바른 동작(기존 `useUpdateWebChatAppearance`·`useCreateWebChat` 도 동일 패턴)이다. 의도치 않은 refetch가 아니라 명시적 설계 결정.
  - 제안: 이상 없음.

- **[INFO]** `WebChatDetail.onDeleted` 콜백에서 `queryClient.invalidateQueries` 직접 호출
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/codebase/frontend/src/app/(main)/web-chat/page.tsx` lines 310-315
  - 상세: `TriggerDeleteDialog` 의 `onDeleted` 콜백 안에서 `WEB_CHAT_INSTANCES_KEY` 추가 무효화를 수행한다. `TriggerDeleteDialog` 내부는 이미 `["triggers"]` 를 무효화하므로 결과적으로 두 쿼리가 모두 무효화된다. 중복이 아니라 보완적 호출로 의도된 설계이며, 주석에 명시되어 있다.
  - 제안: 이상 없음.

- **[INFO]** `WebChatRenameDialog` key 패턴 `${instanceId}:${String(open)}` — `open=false` 시에도 리마운트
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/codebase/frontend/src/components/web-chat/web-chat-rename-dialog.tsx` line 360
  - 상세: `open` 이 `false → true` 로 바뀔 때 key 가 변해 `Inner` 가 리마운트되며 로컬 `name` state 가 `currentName` 으로 재초기화된다. 이는 의도된 동작(다이얼로그를 다시 열 때 최신 이름으로 reset). `open=false` 시 리마운트도 발생하지만, Dialog 가 닫혀 있으므로 DOM 에 아무런 가시적 부작용 없음.
  - 제안: 이상 없음. `TriggerDeleteDialog` 의 `key={props.trigger?.id ?? "__none__"}` 패턴과 일관성 있음.

- **[INFO]** `WebChatInstance` 인터페이스에 `lastTriggeredAt` 필드 추가 — 공개 타입 확장
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/codebase/frontend/src/components/web-chat/use-web-chat.ts` / `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/codebase/frontend/src/lib/types/trigger.ts`
  - 상세: `TriggerListItem.lastTriggeredAt?: string` (optional) 추가는 additive 변경이다. 기존 소비자가 이 필드를 읽지 않아도 타입 호환성이 유지된다. `WebChatInstance` 도 동일하게 optional.
  - 제안: 이상 없음.

- **[INFO]** `useUpdateWebChatMeta` 에서 body 필드를 조건부 포함 — silent mutation 방지
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/codebase/frontend/src/components/web-chat/use-web-chat.ts` lines 1271-1275
  - 상세: `name`/`isActive` 가 `undefined` 이면 body에서 제외해 불필요한 필드를 서버에 전송하지 않는다. `interaction` 객체를 포함하지 않으므로 외형·토큰 전략이 silent mutation 되지 않음. 테스트로도 검증됨.
  - 제안: 이상 없음.

- **[INFO]** i18n 사전 파일에 순수 데이터 추가 — 부작용 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/codebase/frontend/src/lib/i18n/dict/en/webChat.ts`, `ko/webChat.ts`
  - 상세: `list.inactive`, `list.lastTriggered`, `list.neverTriggered`, `manage.*`, `onboarding.*` 키 추가. 기존 키 미변경. 타입 `Dict["webChat"]` 확장이므로 빌드 시 타입 체크로 누락 감지 가능.
  - 제안: 이상 없음.

### 요약

이번 변경은 웹채팅 콘솔에 관리 기능(삭제·이름수정·활성토글·호출이력·목록 메타·이탈경고)을 추가하면서 기존 `TriggerDeleteDialog` 를 재사용하는 구조다. 부작용 관점에서 가장 주의할 지점은 (1) `window.beforeunload` 전역 이벤트 부착, (2) `onDeleted` 콜백으로 인한 이중 캐시 무효화, (3) 이름·활성 PATCH 시 `["triggers"]` 캐시 무효화로 인한 Triggers 화면 refetch 유발인데, 세 가지 모두 cleanup/optional prop/명시적 설계로 의도된 처리가 되어 있다. `TriggerDeleteDialog` 의 인터페이스 변경은 `onDeleted` 가 optional 이어서 기존 호출자에 영향 없다. 전역 변수·환경 변수·파일시스템·네트워크의 의도치 않은 부작용은 발견되지 않았다.

### 위험도

NONE
