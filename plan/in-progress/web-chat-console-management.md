---
title: 웹채팅 운영 콘솔 — 관리 기능 통합 (삭제·이름수정·활성토글·호출이력·목록 메타·UX 안전성)
worktree: web-chat-console-mgmt
started: 2026-06-24
owner: planner
status: in-progress
spec_impact:
  - spec/7-channel-web-chat/5-admin-console.md
related_spec:
  - spec/7-channel-web-chat/5-admin-console.md
  - spec/2-navigation/2-trigger-list.md
related_plans:
  - plan/complete/web-chat-console.md
---

# 배경

웹채팅 운영 콘솔(`/web-chat`)은 현재 **생성·외형편집·저장·스니펫복사·미리보기**만 제공한다.
삭제·이름수정·활성/비활성 토글·호출이력 같은 관리 기능이 전부 빠져 있어, 사용자는
같은 데이터(웹채팅 = `interaction.enabled` webhook 트리거)를 Triggers 메뉴로 왕복해야 한다.

백엔드 API(`DELETE`/`PATCH`/`/history`)와 Triggers 메뉴의 UI 컴포넌트
(`trigger-delete-dialog`·`trigger-history-dialog`)는 이미 존재하므로, **재사용 + 콘솔 전용
경량 UI** 로 생애주기 전체(생성→설정→운영→삭제)를 콘솔 한 곳에서 완결시킨다.

사용자 합의 범위: **P0~P2 전체**.

# 실행 계획

## P0 — 관리 기본
- [x] **타입·훅**: `lib/types/trigger.ts` `TriggerListItem` 에 `lastTriggeredAt` 추가(백엔드는 이미 응답: `trigger-response.dto.ts:43`); `use-web-chat.ts` `WebChatInstance` 에 `lastTriggeredAt` 매핑 + `useUpdateWebChatMeta()` mutation(`PATCH {name?, isActive?}`, WEB_CHAT+TRIGGERS 캐시 무효화)
- [x] **삭제**: `trigger-delete-dialog.tsx` 에 `onDeleted?: () => void` prop 추가(JSDoc 권고대로 — triggers/page.tsx 는 미전달 시 기존 동작 보존); 콘솔에서 `TriggerDeleteTarget`(webhook) 구성해 재사용, `onDeleted` 로 web-chat 캐시 무효화·선택 리셋
- [x] **이름 수정**: `web-chat-rename-dialog.tsx` 신규(경량) — `useUpdateWebChatMeta {name}`
- [x] **활성/비활성 토글**: 콘솔 관리 dropdown 항목 — `useUpdateWebChatMeta {isActive}`

## P1 — 상태 가시성
- [x] **목록 행 메타**: 비활성 배지(`badge`) + 마지막 호출 시각(`timeAgo`/`formatDate`)
- [x] **호출 이력**: `TriggerHistoryDialog` 그대로 재사용(triggerId/triggerName/workflowId/open/onClose)

## P2 — UX 완성도
- [x] **이탈 경고**: `WebChatDetail` 에서 `isDirty` 시 `beforeunload` 핸들러(미저장 외형 손실 방지)
- [x] **온보딩**: 생성 직후 다음 단계(외형→스니펫→설치) 경량 안내

## 마감
- [x] **i18n**: `ko/webChat.ts`·`en/webChat.ts` 에 `manage.*`·`list.inactive`·`list.lastTriggered`·`appearance.leaveWarning`·`onboarding.*` 키 추가(KO/EN parity)
- [x] **테스트**: `useUpdateWebChatMeta` mutation 단위 + 콘솔 관리 흐름(삭제 onDeleted·rename·toggle) 테스트
- [x] **spec 갱신**: `spec/7-channel-web-chat/5-admin-console.md` — 콘솔 관리 기능(삭제·이름·토글·이력·메타) 정식 반영
- [~] **검증·리뷰**: bootstrap·typecheck·lint·test(26 pass) 완료 → build 진행 → `/ai-review` → PR(base main)
