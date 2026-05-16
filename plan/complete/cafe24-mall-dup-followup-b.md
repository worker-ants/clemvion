---
worktree: cafe24-mall-dup-followup-b-4d8e2a
started: 2026-05-16
owner: developer
---

# Cafe24 mall-dup-ux follow-up B — frontend 리팩토링 묶음

PR #112 (follow-up A) 의 후속. ai-review RESOLUTION 의 remaining deferred 항목 중
frontend 영역에 응집된 5건을 하나의 PR 로 묶어 처리.

큰 작업 (W19 status 유니온 중앙화, INFO 7 requestScopes 전략 패턴) 은 별도 worktree.

## 대상 항목

- **W9** — `useCafe24MallIdPrecheck(mallIdInput, enabled)` 커스텀 훅 추출.
  현재 `page.tsx` 가 debounce + AbortController + state 3가지를 직접 보유.
  훅으로 분리해 page.tsx 응집도 향상.
- **W11** — `formatErrorToast` 의 에러 코드 분기 → 도메인 상수 + 매핑.
  현재 컴포넌트 레벨에서 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 를 하드코딩.
  공유 위치에 `CAFE24_DUPLICATE_ERROR_CODE` 상수 + i18n 키 매핑.
- **INFO 10** — `IntegrationsService.create` 의 `save()` 성공 + `auditLogsService.record()`
  실패 시나리오 단위 테스트 추가. 트랜잭션 미적용 결정의 회귀 안전망.
- **INFO 12** — `cafe24-precheck.test.tsx` 의 `vi.advanceTimersByTime(360)`
  반복을 `DEBOUNCE_ADVANCE_MS = 360` 상수 + 헬퍼로 통일.
- **INFO 13** — `validate()` 의 Cafe24 검증 메시지 4건 (Mall ID 패턴, app type,
  client_id, client_secret) 을 i18n 키로 추출.

## 범위 외

- W19 status 유니온 중앙화 — shared package 신설 검토 필요, 큰 작업
- INFO 7 requestScopes Cafe24 분기 → OAuthService 위임 — 전략 패턴 도입
- INFO 14 error code rename — 사용자 호환성 유지 지시로 기각

## consistency-check 생략 사유

- spec 변경 없음. 모두 frontend 내부 리팩토링 + backend 의 audit fail 테스트 추가.
- W9/W11 은 ai-review (PR #107 RESOLUTION) 가 이미 사전 approval.

## 진행 상태

- [x] W9 useCafe24MallIdPrecheck 훅 추출 — `frontend/src/lib/integrations/use-cafe24-mall-id-precheck.ts` + 6 단위 테스트
- [x] W11 formatErrorToast 도메인 상수 분리 — `lib/api/integration-error-codes.ts` 신설, `getIntegrationErrorI18nKey()` 헬퍼
- [x] INFO 10 save+audit fail 테스트 — 실제 결함 발견 (audit 실패 시 user 500) → `create()` 에 별도 try/catch 추가, 회귀 테스트
- [x] INFO 12 debounce 상수 — `DEBOUNCE_ADVANCE_MS` + `advanceDebounce()` 헬퍼, 11회 패턴 통일
- [x] INFO 13 validate() i18n — 4개 메시지 ko/en parity
- [x] TEST WORKFLOW — backend 3734 / frontend 1431 / build / e2e 79
- [ ] AI-REVIEW
- [ ] PR
