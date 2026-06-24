# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

## 발견사항

### [WARNING] 웹채팅 관리 기능(rename/delete/activate/history) 유저 가이드 미갱신

- 변경 파일: `codebase/frontend/src/app/(main)/web-chat/page.tsx`, `codebase/frontend/src/components/web-chat/web-chat-rename-dialog.tsx`
- 매트릭스 항목: `integration-provider-change` — "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지", `userguide-gui-flow-section` — "<ImplAnchor kind=\"ui-entry\"> 동반 작성 — file/symbol 실존 의무"
- 누락된 동반 갱신:
  - `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/codebase/frontend/src/content/docs/06-integrations-and-config/web-chat.mdx`
  - `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/codebase/frontend/src/content/docs/06-integrations-and-config/web-chat.en.mdx`
- 상세: 이번 커밋에서 웹채팅 콘솔에 생애주기 관리 기능 전체(이름 변경·삭제·활성화·비활성화·호출 이력·목록 비활성 배지·lastTriggeredAt·온보딩 배너)가 추가됐다. 그러나 `web-chat.mdx`와 `web-chat.en.mdx`는 기존 섹션 5(라이브 미리보기)까지만 기술되어 있고, 신규 관리 기능을 다루는 절이 전혀 없다. 사용자는 가이드만 보아서는 인스턴스 삭제·이름 변경·활성화·비활성화·호출 이력 조회 방법을 알 수 없다. 특히 `web-chat.mdx`에는 `WebChatRenameDialog`, `TriggerDeleteDialog`, `TriggerHistoryDialog` 에 대응하는 `<ImplAnchor>` 가 없어 `impl-anchor-existence` 가드 실패 위험이 있다.
- 제안:
  - `web-chat.mdx` 에 **§ 6. 인스턴스 관리** 절을 추가하고 이름 변경·활성/비활성·삭제·호출 이력 조회 방법을 기술한다.
  - `web-chat.en.mdx` 에 동일 절의 영문 버전을 추가한다(KO/EN 동반 필수).
  - 신규 심볼에 대응하는 `<ImplAnchor kind="ui-entry">` 블록을 각 절에 추가한다 (`WebChatRenameDialog`, `TriggerDeleteDialog`, `TriggerHistoryDialog` 등).
  - 목록 행에 표시되는 비활성 배지(inactive badge)·마지막 호출 시각(lastTriggeredAt) 도 §1 또는 §6 에서 한 줄 이상 언급한다.

## i18n parity 확인

- `codebase/frontend/src/lib/i18n/dict/ko/webChat.ts` 신규 키: `list.inactive`, `list.lastTriggered`, `list.neverTriggered`, `manage.*`(15 키), `onboarding.hint`
- `codebase/frontend/src/lib/i18n/dict/en/webChat.ts` 신규 키: 동일 집합
- 키 집합 diff 결과: 차이 없음 — **i18n parity 충족**, CRITICAL 이슈 없음.

## 요약

매트릭스 총 17개 trigger 중 2개(`new-ui-string`, `integration-provider-change`/`userguide-gui-flow-section`)가 이번 변경에 매칭됐다. `new-ui-string`(i18n parity)은 KO/EN 양쪽 webChat.ts 동시 갱신으로 충족됐다. `integration-provider-change`/`userguide-gui-flow-section`에 해당하는 `06-integrations-and-config/web-chat.{mdx,en.mdx}` 관리 기능 절 갱신이 누락됐다(WARNING 1건). backend-labels, locale.ts, error-codes.ts 등 다른 trigger 경로에 해당하는 변경은 없다.

## 위험도

WARNING
