# Code Review 통합 보고서 — HMAC raw-value 재정정

> 세션: `review/code/2026/05/16/14_21_05`
> 대상: PR 의 main..HEAD 범위 — `spec/4-nodes/4-integration/4-cafe24.md`, `spec/2-navigation/4-integration.md`, `backend/src/modules/integrations/integration-oauth.service.ts`, `backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts`
> 리뷰어: 13/13 success (Critical 4, Warning ~25, Info ~30)

## 종합

**BLOCK: NO** — 모든 Critical 이 (a) 본 PR 의 단일 머지로 해소되는 spec-code 동기화 우려, (b) 본 PR 무관 pre-existing 오기, (c) false positive 임. 본 PR 의 새 변경 자체에 Critical 결함 없음.

## Critical 분석

| # | Checker | 발견 | 분석 | 조치 |
|---|---------|------|------|------|
| 1 | security | spec-code 알고리즘 불일치 ("backend 가 아직 formUrlEncode 사용") | 보고서가 작성된 시점에 spec commit (30be2f94) 만 보았기 때문. **본 PR 의 다음 commit (bffa3707) 이 코드+테스트 동기 수정 완료** — spec + 코드 + 테스트가 같은 PR 머지에 묶여 main 에 도착하므로 drift window 없음 | RESOLUTION 에 명시 |
| 2 | architecture | "SDD+TDD 가 의도대로 적용된 사례" (positive observation) | Critical 등급이지만 실제로는 칭찬 | 없음 |
| 3 | architecture | 7개 stale worktree 누적 (정책-실행 gap) | **본 PR 무관 pre-existing 운영 이슈** — 사용자의 worktree 정리 영역 | 별도 plan |
| 4 | documentation | `spec/4-nodes/4-integration/4-cafe24.md` CHANGELOG 의 옛 `2026-05-16` 행에 존재하지 않는 세션 경로 `review/consistency/2026/05/16/11_11_07/` 참조 | **본 PR 무관 pre-existing 오기** (PR #67 SEC H-1 commit 에서 도입). 인접 실존 경로 `11_43_07` 있음 | 별도 plan (후속 fix-typo PR) |

## Warning / Info 주요 항목

본 PR 직접 관련 (조치 대상):

- **maintainability**: `buildHmacMessage` 내부 객체 `{key, raw}` 생성이 가비지 압력. 호출 빈도 (install/sec) 가 낮아 무시 가능. 향후 핫패스 진입 시 재검토.
- **performance**: O(N log N) sort + O(N) map 두 패스 — 정상 운영 N=10 미만이라 무영향.
- **testing**: 신규 회귀 테스트 3건이 잘 분할됨 (raw `%20` accept / `+` accept / old algo reject). self-fulfilling 패턴 차단 효과 확인.
- **scope**: 변경 범위 최소. `formUrlEncode` 헬퍼 제거가 정당 (호출자 0개 확인).
- **side_effect**: 동시성·전역 상태 변경 없음.

본 PR 무관 (별도 plan):

- `cafe24Install` / `oauthCallback` catch 블록의 raw error message 노출 (PR #89 의 ai-review 에서도 발견 — security)
- `isValidPostMessageOrigin` 단위 테스트 부재 (PR #89 에서도 발견)
- `2026-05-16 (Critical 0)` CHANGELOG 의 세션 경로 오기 (documentation)
- stale worktree 누적 7개 (architecture)

## Checker별 위험도

| Checker | 위험도 | 본 PR 직접 관련 |
|---------|--------|----------------|
| security | LOW (Critical 1 은 PR scope 내 해소) | spec-code drift window 0 (동시 머지) |
| testing | LOW | 회귀 테스트 3건 충분 |
| architecture | LOW (Critical 2 는 positive, Critical 3 은 pre-existing) | 변경 영역 응집도 양호 |
| documentation | LOW (Critical 1 은 pre-existing 오기) | 새 본문은 정합 |
| 그 외 9 checker | NONE | — |

## 권장 조치

1. **본 PR 머지 즉시** — RESOLUTION 에 위 Critical 분석 명시 후 머지.
2. **별도 follow-up plan** — Critical 3 (stale worktree 누적), Critical 4 (CHANGELOG 세션 경로 오기), PR #89 무관 발견 (catch block error leak, origin validator test) 의 추적.
