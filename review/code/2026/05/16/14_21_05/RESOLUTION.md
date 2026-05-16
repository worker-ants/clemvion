# RESOLUTION — Cafe24 HMAC 알고리즘 재정정 (raw URL-encoded 값 보존)

> SUMMARY.md 의 Critical 4건 / Warning ~25 / Info ~30 에 대한 조치 결과.

## Critical 조치

### Critical #1 (security) — spec-code 알고리즘 불일치 우려

- **분석**: 보고서가 spec commit (30be2f94) 만 본 시점의 일시 상태. **다음 commit (bffa3707)** 이 backend code + tests 동기 수정 완료. 단일 PR 머지 → main 에 spec / code / test 가 같은 commit 그룹으로 도달 → drift window 0.
- **조치**: 본 RESOLUTION 으로 명시. 코드 수정 없음.

### Critical #2 (architecture) — SDD+TDD 정합 사례 (positive observation)

- **분석**: Critical 등급으로 보고됐으나 실제는 칭찬. spec → code → test 세 계층이 같은 PR 안에서 응집된 사례라 평가.
- **조치**: 없음.

### Critical #3 (architecture) — 7개 stale worktree 누적

- **분석**: 본 PR 무관 pre-existing 운영 이슈. 다른 worktree 들의 PR 머지 후 cleanup 누락 누적. `plan_coherence` checker 의 false positive 노이즈 원인.
- **조치**: 별도 follow-up — `plan/in-progress/worktree-cleanup-followup.md` 에 추적. 본 PR 머지 후 사용자가 일괄 cleanup.

### Critical #4 (documentation) — 옛 CHANGELOG 의 존재하지 않는 세션 경로

- **분석**: `spec/4-nodes/4-integration/4-cafe24.md` §10 의 옛 `2026-05-16` 행에 `review/consistency/2026/05/16/11_11_07/` 참조. 본 PR 무관 pre-existing 오기 (PR #67 SEC H-1 commit 에서 도입). 인접 실존 경로 `11_43_07` 있음.
- **조치**: 본 PR 범위 밖. 별도 follow-up — 오기 정정 fix-typo PR.

## Warning / Info 조치

### 본 PR 직접 관련 (모두 의도된 설계)

- **maintainability**: `buildHmacMessage` 의 `{key, raw}` 객체 생성 가비지 — 호출 빈도 (install/sec) 가 낮아 무영향. 현재 유지.
- **performance**: 두 패스 (sort + map) — 정상 운영 N=10 미만이라 무영향. 현재 유지.
- **testing**: 회귀 테스트 3건 (raw `%20` accept / `+` accept / old algo reject) — self-fulfilling 패턴 차단 효과 확인. 추가 케이스 불필요.
- **scope**: `formUrlEncode` 제거 정당 (호출자 0개 확인). 변경 범위 최소.
- **side_effect**: 동시성·전역 상태 영향 없음.

### 본 PR 무관 (follow-up plan 인계)

- `cafe24Install` / `oauthCallback` catch 블록의 raw error message 노출 (PR #89 ai-review 에서도 발견)
- `isValidPostMessageOrigin` 단위 테스트 부재 (PR #89 에서도 발견)
- stale worktree 누적 7개 (Critical #3)
- CHANGELOG 세션 경로 오기 (Critical #4)

이상 4건은 본 PR 머지 후 별도 후속 PR 로 처리.

## TEST WORKFLOW 재실행

본 RESOLUTION 단계에서 코드 수정이 발생하지 않았으므로, 직전 commit (bffa3707) 의 TEST WORKFLOW 결과를 그대로 사용:

- `cd backend && npm run lint`: 0 errors / 17 warnings (모두 pre-existing in 무관 파일)
- `cd backend && npm test`: 3692 passed (cafe24 spec 40 passed)
- `cd backend && npm run build`: clean
- `cd frontend && npm run lint`: clean
- `cd frontend && npm test`: 1397 passed
- `cd frontend && npm run build`: clean
- `make e2e-test`: 66 e2e passed (12 suites)

## 결론

본 PR 의 실제 변경 (raw-value HMAC 알고리즘 + 테스트 3건 보강) 에 대한 직접적 Critical 결함 없음. Critical 4건 중 1건 (spec-code 동기) 은 본 PR 의 단일 머지로 자동 해소, 1건 (positive observation) 은 무조치, 2건 (stale worktree / CHANGELOG typo) 은 본 PR 무관 pre-existing 으로 별도 follow-up. 본 PR 머지 가능.
