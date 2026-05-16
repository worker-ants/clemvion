# Code Review 통합 보고서 — Clean (rebase 후)

리뷰 세션: `review/code/2026/05/16/16_39_38`
대상: Cafe24 mall_id 중복 감지 UX follow-up (W20 factory, W21 Swagger, W23 트랜잭션 분석, INFO 6 AbortController)
리뷰어: 13 / 13 success / pending 0

---

## 전체 위험도

**LOW** — Critical 0건. 1차 리뷰 (`16_26_10`) 의 Critical 1건은 fork 시점 차이 (PR #108·#109 가 main 에 merged 됐는데 본 branch 가 미흡수) 의 false positive 였으며 rebase 로 해소.

## Critical 발견사항

없음.

## Warning (4건)

- **W1** workspaceId factory 누락 → ✅ 처리 (`overrides.workspaceId ?? 'ws-1'` 기본값 추가)
- **W2** `credentialsMallId` null 전파 가능성 → ✅ 분석 결과 `??` 가 null 도 nullish 처리하므로 false positive 였으나, 명시성을 위해 괄호 추가 + 의도 주석 보강
- **W3** Swagger description 의 Route order note 가 코드 주석과 중복 관리 → ✅ Swagger 에서 제거, 코드 주석 + e2e 테스트로 단일 진실
- **W4** factory 의 자동 생성 `name` 이 legacy row 실제 name 과 다를 수 있음 → 기존 테스트가 이미 명시 override 사용해 무영향, 별도 조치 없음

## INFO (15건 — 일부 처리)

- **INFO 6** `cafe24Precheck` 의 `signal` 이 axios config 에 전달되는지 확인 → ✅ 확인 (signal: signal 로 정상 전달)
- **INFO 11** `aborted` 이중 플래그 정리 → ✅ 처리 (controller.signal.aborted 단일 진실)
- **INFO 9** e2e 라우트 순서 회귀 테스트 → 이미 `integration-cafe24-precheck.e2e-spec.ts` 의 "route order — cafe24/precheck is matched before @Get(':id')" 케이스에 존재 (PR #107)
- 나머지 INFO 12건 (장기 리팩토링 / 별도 PR) — deferred

## 1차 리뷰 (16_26_10) 의 Critical 해소

- 1차 SUMMARY: "Phase 8 operation 51건 대규모 삭제 (scope 이탈)"
- 실제 상태: 본 branch fork 시점 `c2c3ae7d` (PR #105 merge) 이후 origin/main 에 PR #108 (Phase 8 operations 추가) + PR #109 (보안 medium) 가 merged. `git diff main..HEAD` 가 Phase 8 추가분을 본 branch 의 "삭제"로 표시.
- 조치: `git rebase origin/main` (planned.ts 1건 충돌 해소 — origin/main 의 빈 배열 채택). 이후 prettier-only metadata 변경 6건은 별도 PR 로 분리 (scope 정합화). 8 파일 / +228 / -81 의 깨끗한 diff.

## 검증

- backend: lint 0 errors / 3731 unit / build / e2e 79 통과
- frontend: lint clean / 1425 unit / build / 11 precheck 케이스 통과
