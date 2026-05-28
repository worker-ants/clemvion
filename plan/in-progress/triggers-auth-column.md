---
name: triggers-auth-column
status: in-progress
worktree: .claude/worktrees/triggers-auth-column-a80393
branch: claude/triggers-auth-column-a80393
spec_area: spec/2-navigation/2-trigger-list.md
created: 2026-05-29
---

# /triggers 목록 — "인증" 컬럼 + 무인증 웹훅 경고

## 배경

사용자 요청: `/triggers` 목록 테이블의 "유형" 컬럼 다음에 "인증" 컬럼을 추가한다.
외부 노출(webhook) 트리거가 인증(AuthConfig) 미설정이면 보안에 취약하므로 경고
아이콘을 함께 표시한다.

## 데이터 가용성 (조사 결과)

- 목록 응답 `TriggerDto` 에 `authConfigId?: string | null` 이미 포함
  (`codebase/backend/.../dto/responses/trigger-response.dto.ts:39`). **백엔드 변경 불필요.**
- 프론트는 `useAuthConfigs()` (`components/triggers/auth-config-select.tsx`) 로
  워크스페이스 AuthConfig 목록(`{id,name,type}`)을 이미 조회 가능 → `authConfigId` → type 해석.
- 현재 page.tsx 의 `RawTrigger`/`Trigger`/매핑에는 `authConfigId` 누락 → 추가 필요.

## 설계

- 컬럼 헤더: 기존 i18n `triggers.authenticationLabel` ("인증"/"Authentication") 재사용. "유형" `<th>` 바로 뒤.
- 셀 표시:
  - `type !== "webhook"` → `-` (muted). webhook 외 타입은 inbound HTTP 인증 N/A.
  - webhook + `authConfigId` 해석됨 → AuthConfig type 뱃지 (HMAC / Bearer 등, `AUTH_CONFIG_TYPE_LABEL_KEYS`).
  - webhook + `authConfigId` 있으나 목록서 미해석 → `triggers.authConfigured` 폴백 뱃지.
  - webhook + `authConfigId == null` → `AlertTriangle` (amber/destructive) + "인증 없음", `title`/`aria-label` = `triggers.authUnauthenticatedWarning`.

## Phase

- [x] **P1. spec 갱신 (project-planner 위임)** — §2.1 표에 "인증" 요소 행 추가 + R-15 등록 + NAV-TR-10/11. `consistency-check --spec` 완료 (C-1 false positive 문서화). commit cba766a5.
- [x] **P2. consistency-check --impl-prep spec/2-navigation** — P1 의 --spec 검토가 동일 변경 전수 커버 + 신규 식별자 lightweight 충돌 점검으로 갈음 (사유 본문).
- [x] **P3. 테스트 선작성** — `triggers-page.test.tsx`: 헤더/type 뱃지/경고/비대상 + (리뷰 후) unresolved 폴백·manual·isError 케이스 (총 12).
- [x] **P4. 구현** — page.tsx (`TriggerAuthCell` 컴포넌트) + ko/en i18n.
- [x] **P5. TEST WORKFLOW** — lint ✓ / unit ✓ 5004 / build ✓ / e2e ✓ 127 (2회차 transient register-500 → 재수행 PASS).
- [x] **P6. REVIEW WORKFLOW** — /ai-review 8 reviewer + SUMMARY. Critical-1·W-1·W-5 false positive 판정, 유효 Warning(W-3/6/7/8/9/10/11) 반영. RESOLUTION.md 작성. 재테스트 PASS.

## 메모

- user-guide 동반 갱신: `/triggers` 목록 컬럼을 서술하는 user-guide 페이지 없음 → 매트릭스 미해당.
