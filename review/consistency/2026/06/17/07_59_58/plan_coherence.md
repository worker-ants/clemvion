# Plan 정합성 검토 결과

검토 모드: `--impl-done` (scope: `spec/7-channel-web-chat`, diff-base: `origin/main`)

## 검토 대상

실제 target diff 는 `spec/7-channel-web-chat/4-security.md` 단일 파일에 집중:
- `code:` frontmatter 에 `codebase/channel-web-chat/src/lib/safe-html.ts` 추가
- `§1.1` 마크다운/HTML sanitize 정책 매트릭스 신설 (위젯 + 메인 앱 이중 렌더러)
- `§R4` deny-by-default allowlist 채택 근거 신설

코드 diff(별도)는 `backend` 의존성 업그레이드(`otplib v12→v13`, `@types/node ^22→^24` 등)와 `totp.service` 리팩터로, `spec/7-channel-web-chat` 영역과 직접 연관이 없다.

---

## 발견사항

### [INFO] safe-html.ts 구현 완료 사실이 plan 에 이미 기록됨

- target 위치: `spec/7-channel-web-chat/4-security.md` — `code:` frontmatter, `§1.1`
- 관련 plan: `/Volumes/project/private/clemvion/.claude/worktrees/deps-backlog-residual/plan/in-progress/channel-web-chat-followups.md` §4 ("presentation 보강 완료 2026-06-02")
- 상세: `safe-html.ts` 구현은 `channel-web-chat-followups.md §4`에 이미 ✅ 완료로 기록되어 있다. 이번 spec 갱신은 구현된 사실을 spec 에 사후 문서화하는 정합 조치다. 충돌 없음.
- 제안: 조치 불요.

### [INFO] channel-web-chat-impl.md 에 sanitize spec sync 항목 미추적

- target 위치: `spec/7-channel-web-chat/4-security.md` §1.1
- 관련 plan: `/Volumes/project/private/clemvion/.claude/worktrees/deps-backlog-residual/plan/in-progress/channel-web-chat-impl.md`
- 상세: `channel-web-chat-impl.md` 의 작업 범위 체크리스트에 "sanitize 정책 spec 문서화" 항목이 없다. 이번 spec 변경이 해당 gap 을 메운 것이나, plan 에는 반영 기록이 없다. plan 은 `status: partial` + `pending_plans` 유지 중이므로 정합성 하자는 아니다. 단, 추적 완결을 위해 간단한 메모를 추가하면 좋다.
- 제안: `channel-web-chat-impl.md` 에 "spec/7-channel-web-chat/4-security.md §1.1 sanitize 매트릭스 + §R4 문서화 완료" 한 줄 메모 추가 — 선택 사항(INFO 수준).

### [INFO] webchat-eager-start.md 및 fix-webchat-sse-field-map.md — plan complete 이동 미완

- target 위치: 해당 없음 (이번 변경과 직접 연관 없음)
- 관련 plan: `/Volumes/project/private/clemvion/.claude/worktrees/deps-backlog-residual/plan/in-progress/webchat-eager-start.md` (마지막 체크박스 미완), `/Volumes/project/private/clemvion/.claude/worktrees/deps-backlog-residual/plan/in-progress/fix-webchat-sse-field-map.md` (마지막 체크박스 미완)
- 상세: 두 plan 모두 `spec/7-channel-web-chat` 의 `pending_plans` 에 등록되어 있고 구현 작업은 완료됐으나 "plan complete 이동" 항목이 아직 미체크다. 이번 spec 변경과 내용 충돌은 없다. 그러나 두 plan 이 `in-progress/` 에 남아 있어 `0-architecture.md`, `1-widget-app.md`, `3-auth-session.md` 의 `pending_plans` 목록이 계속 이 파일들을 가리킨다.
- 제안: 본 변경과 별개로, 두 plan 의 "plan complete 이동" 을 완료하는 것이 바람직하다. 단, 이번 spec 변경을 차단하는 사유는 아니다.

---

## 요약

이번 `spec/7-channel-web-chat/4-security.md` 변경은 이미 구현 완료된 `safe-html.ts` 및 메인 앱 `markdown-renderer.tsx` 의 sanitize 정책을 spec 에 사후 문서화하는 작업이다. 관련 in-progress plan(`channel-web-chat-followups.md`)에서 해당 구현이 ✅ 완료로 기록되어 있어 미해결 결정과의 충돌이 없고, 선행 plan 미해소 문제도 없다. 후속 항목 누락(INFO)으로는 `channel-web-chat-impl.md` 에 spec sync 완료 기록이 없는 점과, 두 plan(`webchat-eager-start.md`, `fix-webchat-sse-field-map.md`)의 `complete/` 이동이 미완인 점이 있으나 모두 차단 수준이 아니다.

## 위험도

NONE
