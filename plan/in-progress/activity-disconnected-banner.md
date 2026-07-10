---
name: activity-disconnected-banner
worktree: .claude/worktrees/activity-disconnected-banner-8b7a7f
status: in-progress
started: 2026-07-10
owner: developer
spec_impact:
  - spec/2-navigation/4-integration.md
---

# 활동 탭 "연결 안 됨" 상태 배너 (§4.6)

## 배경

#501 진단 과정에서 나온 UX 개선(C). cafe24 활동 탭이 비면 사용자가 "활동 없음"과
"통합이 끊겨 새 활동이 기록되지 않음"을 구분하지 못한다. 통합 `status ≠ connected` 이면
AI Agent MCP bridge 가 통합을 skip(미연결 통합 tool 미노출) → 새 호출·기록 0.
직결 노드도 `INTEGRATION_NOT_CONNECTED` 로 즉시 실패. 따라서 status 를 배너로 구분 노출.

## 결정 (product)

- **트리거**: `integration.status !== "connected"` (error / expired / pending_install).
  connected 이지만 곧 만료(expires-soon)는 여전히 기록되므로 **미노출**.
- **배너**: 활동 목록/빈 상태 위에 경고 박스. "새 활동이 기록되지 않고 있어요" + 원인 안내 +
  [상태 확인] 버튼(개요 탭 이동 — 상태·재연결 landing).
- 빈 상태·기록 있는 상태 **양쪽** 위에 노출(과거 기록만 있고 새 기록이 끊긴 경우도 안내).

## 작업

- [x] spec §4.6 에 "연결 안 됨 배너" bullet 추가
- [x] FE: `ActivityDisconnectedBanner` 컴포넌트 추출(page.tsx 비-Page export 불가 → 별 파일, 기존 tab 추출 패턴), ActivityTab 이 `status`+`onNavigate` prop 으로 렌더(빈 상태·목록 양쪽 위)
- [x] i18n ko/en: `activityDisconnectedTitle`/`Hint`/`Action`
- [x] 단위 테스트: activity-disconnected-banner.test.tsx (connected 미노출 / error·expired·pending_install 노출 / 버튼→onGoToOverview / en 로케일) — 6 pass

## 워크플로

- [x] TEST WORKFLOW — lint[x]·unit[x]·build[x]·e2e[x](249) (초회 + fix 후 재통과)
- [~] REVIEW WORKFLOW — /ai-review(LOW·C0·W3)·impl-done(BLOCK:NO·W2) → WARNING 조치(톤 escalation·Inline Alert 등재·CHANGELOG·user-guide·role=status) + RESOLUTION.md. wiring 스모크 테스트 1건 defer(근거). fresh 재검토 대기
