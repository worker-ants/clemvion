# 아키텍처(Architecture) 리뷰 결과

## 발견사항

- **[WARNING]** `WebChatDetail` 컴포넌트의 단일 책임 과부하
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/codebase/frontend/src/app/(main)/web-chat/page.tsx` — `WebChatDetail` 함수 (약 line 485–678)
  - 상세: `WebChatDetail` 은 외형 편집(draft/save), 메타 편집(rename/toggleActive), 삭제, 이력 조회, 온보딩 배너, beforeunload 경고, 3개 다이얼로그 열림 상태 관리를 모두 수용한다. 현재 약 190줄이며 기능이 추가될수록 선형적으로 비대해지는 구조다.
  - 제안: `useWebChatDetailActions` 같은 전용 훅으로 toggleActive·save·콜백 로직을 분리하고, 다이얼로그 렌더 블록(`WebChatRenameDialog`, `TriggerHistoryDialog`, `TriggerDeleteDialog`)을 `WebChatDetailDialogs` 서브컴포넌트로 추출하면 각 단위의 책임이 명확해진다. 단, 현재 크기가 임계점을 막 넘는 수준이므로 즉각 리팩터링보다는 다음 기능 추가 시 분리를 권장한다.

- **[WARNING]** `TriggerDeleteDialog`의 이중 캐시 무효화 책임
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/codebase/frontend/src/components/triggers/trigger-delete-dialog.tsx` — `DialogInner` mutation `onSuccess`/`onError`
  - 상세: 컴포넌트 내부에서 `["triggers"]` 를 직접 무효화하면서 동시에 `onDeleted?()` 콜백으로 호출자의 추가 무효화를 위임한다. 두 경로가 병렬로 실행되는데, 이 컴포넌트가 다른 도메인(예: 스케줄, 매뉴얼 트리거)에서도 재사용되면 `["triggers"]` prefix 광역 무효화가 의도치 않은 refetch를 유발할 수 있다. JSDoc 에 이미 설명이 있으나, 아키텍처적으로는 "컴포넌트가 어느 캐시 키를 무효화할지 안다"는 설계 자체가 레이어 경계 침범이다.
  - 제안: 장기적으로는 캐시 무효화 책임을 `onDeleted` 콜백에 완전히 위임하고 컴포넌트 내부의 직접 `invalidateQueries` 를 제거하는 방향을 검토한다. 단기적으로는 현재 JSDoc 수준의 명시로 수용 가능하며, 단독 사용처(triggers 목록)가 있는 한 breaking change 없이 리팩터링하기 어려우므로 이 결정은 트리거 도메인 전체 리팩터링 시 함께 처리한다.

- **[INFO]** `WebChatDetail` 내부에서 `useQueryClient` 직접 사용
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/codebase/frontend/src/app/(main)/web-chat/page.tsx` line 162 (`const queryClient = useQueryClient()`)
  - 상세: 프레젠테이션 레이어(page.tsx)에서 캐시 인프라(`useQueryClient`)를 직접 참조한다. `onDeleted` 콜백에서 `WEB_CHAT_INSTANCES_KEY` 무효화를 수행하기 위한 것인데, 이 로직을 `useUpdateWebChatMeta`/`useWebChatInstances` 레이어로 내려보내거나 `onDeleted` 처리를 전용 훅에 캡슐화하면 페이지 컴포넌트가 캐시 키를 알 필요가 없어진다. 현재 범위에서는 허용 가능하나 패턴이 확산되면 결합도가 높아진다.
  - 제안: `useWebChatDeleteCallback` 등 작은 훅으로 `queryClient.invalidateQueries + onDeleted` 조합을 캡슐화하면 페이지 컴포넌트에서 캐시 키 상수(`WEB_CHAT_INSTANCES_KEY`)를 import할 필요가 사라진다. 현재는 INFO 수준.

- **[INFO]** `TriggerHistoryDialog`·`TriggerDeleteDialog` 를 `@/components/triggers/` 에서 직접 import
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/codebase/frontend/src/app/(main)/web-chat/page.tsx` line 368–372
  - 상세: `web-chat` 도메인 페이지가 `triggers` 도메인 컴포넌트를 직접 참조한다. 현재는 "신규 엔티티 없이 trigger CRUD 재사용" 전략을 의도적으로 선택한 결과이며 설계 결정이 커밋 메시지에도 명기되어 있다. 순환 의존성은 없다(triggers → web-chat 방향 없음).
  - 제안: 이 재사용 패턴이 더 많은 도메인으로 확산되면 `triggers` 컴포넌트를 `@/components/shared/` 레이어로 승격하는 것을 검토한다. 현재 범위에서는 수용 가능.

- **[INFO]** `useUpdateWebChatAppearance` 의 `enabled: true` 하드코딩
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/codebase/frontend/src/components/web-chat/use-web-chat.ts` line 2238
  - 상세: JSDoc에 "interaction 이 비활성인 인스턴스에 사용하면 silent mutation" 위험이 명시되어 있다. 현재는 `useWebChatInstances` 의 `interactionEnabled=true` 필터로 보호되나, 이 훅이 다른 컨텍스트로 재사용되면 계약 위반이 조용히 발생한다. 개방-폐쇄 원칙 관점에서 훅의 사용처 가정이 구현 내부에 하드코딩되어 있다.
  - 제안: `enabled` 를 파라미터로 노출하거나, 훅 이름을 `useUpdateWebChatInteractionAppearance` 처럼 용도를 명확히 제한하는 이름으로 변경해 오용 범위를 줄인다. 현재는 단일 사용처이므로 INFO 수준.

## 요약

이번 변경은 기존 trigger CRUD 인프라를 의도적으로 재사용해 웹채팅 생애주기 전체를 완결하는 설계로, 신규 엔티티·엔드포인트 없이 P0–P2 기능을 통합했다. 레이어 구조(`use-web-chat` hooks → 컴포넌트 → page)는 일관성이 있고 순환 의존성은 없다. 주요 아키텍처 우려사항은 두 가지다: `TriggerDeleteDialog` 내부의 이중 캐시 무효화(컴포넌트 직접 + 콜백 위임)는 장기 재사용 시 leaky abstraction 이 될 수 있으며, `WebChatDetail` 의 책임 집중은 기능 추가 시 분리가 필요한 시점에 근접했다. 현재 규모에서는 두 이슈 모두 허용 가능한 트레이드오프이나 다음 기능 슬라이스 전에 경계 설계를 재검토할 것을 권장한다.

## 위험도

LOW
