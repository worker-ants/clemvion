# RESOLUTION — cafe24 mall-dup-ux follow-up

연결된 리뷰: `review/code/2026/05/16/16_39_38/SUMMARY.md`
1차 리뷰 (rebase 전): `review/code/2026/05/16/16_26_10/SUMMARY.md`

## 요약

| 라운드 | Critical | Warning | INFO | 비고 |
|--------|---------:|--------:|-----:|------|
| 1차 (`16_26_10`) | 1 | 7 | 18 | PR #108/#109 가 main 에 merged 됐는데 본 branch 미흡수 → "Phase 8 51건 삭제" false positive |
| **rebase + prettier 분리** | — | — | — | `git rebase origin/main` 후 metadata 6 파일의 prettier-only 변경 revert |
| 2차 (`16_39_38`) | **0** | 4 | 15 | 본 PR 의 실제 변경만 대상 |
| 본 RESOLUTION | **0** | 0 | 일부 처리 | Warning 4건 모두 처리 + INFO 11 추가 처리 |

## 1차 Critical 처리

`git rebase origin/main` — planned.ts 1건 충돌 해소 (origin/main 의 빈 배열 채택 = Phase 8 implementation 완료). prettier-only metadata 변경 6 파일은 별도 PR 로 분리 정신에 따라 `git checkout origin/main --` 로 revert. 깨끗한 8 파일 / +228 / -81 diff.

## 2차 Warning 처리

- **W1 — workspaceId factory 누락** ✅
  - `buildFakeCafe24Integration` 반환 객체에 `workspaceId: overrides.workspaceId ?? 'ws-1'` 추가. type signature 에도 `workspaceId?: string` override 옵션 등재.
- **W2 — credentialsMallId null 전파 가능성** ✅ (false positive 분석 + 명시성 보강)
  - `??` 는 null/undefined 모두 nullish 처리하므로 `overrides.credentialsMallId ?? mallId ?? 'priv-shop'` 의 mallId=null 케이스가 'priv-shop' 으로 정상 fallback. 의미상 버그 없으나 명시성을 위해 `overrides.credentialsMallId ?? (mallId ?? 'priv-shop')` 로 괄호 추가 + 의도 주석.
- **W3 — Swagger description 의 Route order note 중복 관리** ✅
  - `@ApiOperation.description` 에서 Route order note 단락 제거. 코드 주석 (controller 의 `※ 라우트 선언 순서 주의` 블록) + e2e 테스트 (`integration-cafe24-precheck.e2e-spec.ts` 의 "route order" 케이스, PR #107) 가 단일 진실.
- **W4 — factory 자동 name 이 legacy 실제 name 과 다를 수 있음** ✅ (무영향 확인)
  - 기존 legacy 테스트들 (`legacy-conn`, `legacy-connected`) 이 모두 `name: 'legacy'` 등 명시 override 사용 중이라 무영향. 추가 조치 없음.

## 추가 처리한 INFO

- **INFO 6 — signal 이 axios fetch options 에 전달되는지 확인** ✅
  - `apiClient.get(url, { params, signal })` 형태로 정상 전달 확인. axios 가 AbortSignal 을 native 지원하므로 abort 시 실제 fetch 도 취소됨.
- **INFO 11 — `aborted` 이중 플래그 정리** ✅
  - 별도 boolean `aborted` 제거. `controller.signal.aborted` 단일 진실로 통일.

## Deferred (별도 PR 또는 장기)

- INFO 12 — `vi.advanceTimersByTime(360)` 매직 넘버 상수화
- INFO 13 — `validate()` 의 Cafe24 검증 메시지 i18n
- INFO 7 — `requestScopes` 의 Cafe24 분기를 OAuthService 로 위임 (전략 패턴)
- INFO 8 — factory 반환 타입을 `Partial<Integration>` 으로 강화
- INFO 10 — `save()` 성공 + `auditLogsService.record()` 실패 시나리오 테스트 추가
- INFO 14 — `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 코드명 rename (사용자 지시로 호환성 유지)
- 기타 4건 — 모두 장기 리팩토링·관측성 향상

## 검증

| 단계 | 결과 |
|-----|------|
| backend lint | 0 errors |
| backend unit test | 3731 / 3731 passed |
| backend build | success |
| frontend lint | clean |
| frontend unit test | 1425 / 1425 passed (precheck 11/11) |
| frontend build | success |
| e2e | 79 / 79 passed |
