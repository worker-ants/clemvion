---
worktree: (미정 — 신규 worktree 생성 필요)
started: 2026-05-22
owner: developer
source: ai-review W6/W7 / review/code/2026/05/22/15_08_07/testing.md
---

# TriggerDetailDrawer 단위 테스트 신설

## 배경

ai-review W6/W7: `trigger-detail-drawer.tsx` 에 전용 unit 테스트가 없어 컴포넌트 렌더링 로직, 조건부 카드 표시, i18n 키 사용 여부, Recent Calls 제거 회귀를 자동 검증할 수 없다.

## 작업 범위

`codebase/frontend/src/components/triggers/__tests__/trigger-detail-drawer.test.tsx` 신규 작성.

필수 커버리지:
1. `triggerId=null` 또는 `open=false` 시 API 호출 없음 (enabled: `!!triggerId && open` 조건)
2. trigger 미발견 시 `triggers.detail.notFound` 번역값 렌더링
3. `type="webhook"` — WebhookConfigCard + ExternalInteractionCard 렌더링, ScheduleConfigurationCard 미렌더링
4. `type="schedule"` — ScheduleConfigurationCard 만 렌더링
5. Recent Calls 카드 미렌더링 회귀 가드 (`/triggers/:id/history` 호출 없음)
6. ~~authType 별 i18n 값 렌더링 (hmac / bearer / none)~~ → **무효화 (2026-05-28, auth-config-webhook-wiring)**: inline `authType` 필드가 제거되고 trigger drawer 가 `authConfigId` → AuthConfig selector 로 전환됨 (`spec/2-navigation/2-trigger-list.md` R-14). 본 케이스는 **AuthConfig selector 렌더링** (목록 드롭다운 / "인증 없음" / "+ 새 인증 설정" 링크 + 선택된 AuthConfig 의 type chip 표시) 기준으로 재작성한다.
7. Enabled 배지 i18n 값 렌더링

## 완료 기준

- 위 7개 케이스 통과
- lint + unit + e2e 통과

## 관련

- source: `review/code/2026/05/22/15_08_07/testing.md` [WARNING W6/W7]
