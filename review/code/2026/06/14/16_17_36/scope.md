# 변경 범위(Scope) 리뷰

## 작업 의도 파악

이번 리뷰 대상은 **이전 ai-review(15_59_50)의 RESOLUTION fix 적용 후 변경된 코드**다.
RESOLUTION.md 에서 처리된 항목:
- W2 fix: `reconcileTerminalRevocations` 루프를 `Promise.allSettled` bounded-concurrency(20) 병렬화
- W3 부분 fix: `batchLimit` clamp(<=1000) 추가
- W6 fix: `Math.min(Math.max(1, floor(n)), RECONCILE_BATCH_MAX=1000)` clamp
- W7 fix: `service.reconcile()` 직접 호출 테스트(성공·throw swallow) 2건 추가
- I5/I6/I9 fix: 매직넘버 → 상수 추출(`RECONCILE_BATCH_LIMIT`, `RECONCILE_BATCH_MAX`, `RECONCILE_CONCURRENCY`, `TERMINAL_STATUSES`, `REMOVE_ON_*_AGE_SEC`)
- I7/I18 fix: `reconcile()` JSDoc 추가
- I8 fix: module JSDoc Wire-up 갱신
- I10 fix: `@Processor(..., { concurrency: 1 })` 명시
- I14/I15/I16/I17 fix: limit/distinct/select 단언 + 만료토큰(ttl<=0) 케이스 추가
- I19 fix: `@param batchLimit` JSDoc
- 중복 swept 로그 제거 (reconciler 의 `swept > 0` 로그 → token service 단일 책임)

---

## 발견사항

### [INFO] 파일 1 (external-interaction.module.ts) — JSDoc 1행 추가, 의도 내 변경
- 위치: `external-interaction.module.ts` diff line +35 (주석 블록에 `TerminalRevokeReconcilerService` 항목 추가)
- 상세: I8 처리 항목으로 명시된 module Wire-up JSDoc 갱신이다. RESOLUTION.md 에서 명시한 fix 범위 내의 1행 주석 추가이며 코드 동작 변경 없음. 범위 이탈 없음.
- 제안: 없음.

### [INFO] 파일 3 (interaction-token.service.ts) — 상수 추출 + clamp + 병렬화 복합 변경
- 위치: `interaction-token.service.ts` diff +113~192 구간
- 상세: 한 파일 내에 다음 4가지가 동시에 수행됐다:
  1. `RECONCILE_BATCH_LIMIT`, `RECONCILE_BATCH_MAX`, `RECONCILE_CONCURRENCY`, `TERMINAL_STATUSES` 상수 추출 (I5/I6/I9)
  2. `safeLimit` clamp 추가 (W6)
  3. `terminal` 인라인 배열 → `TERMINAL_STATUSES` 참조로 교체 (I9, 동작 동일)
  4. `for...of` 직렬 루프 → `Promise.allSettled` chunked 병렬 루프 (W2/W3)

  모두 RESOLUTION.md 에 명기된 fix 항목에 1:1 대응한다. 별도의 의도 외 리팩토링 또는 기능 확장 없음.
- 제안: 없음.

### [INFO] 파일 4 (terminal-revoke-reconciler.service.spec.ts) — 테스트 2건 추가
- 위치: `terminal-revoke-reconciler.service.spec.ts` diff +215~231
- 상세: W7 처리 항목에 명시된 `reconcile()` 직접 호출 테스트(성공/throw swallow) 2건 추가. 기존 테스트 수정 없음. 범위 내.
- 제안: 없음.

### [INFO] 파일 5 (terminal-revoke-reconciler.service.ts) — 상수 추출 + concurrency 명시 + JSDoc + 로그 제거
- 위치: `terminal-revoke-reconciler.service.ts` diff +253~303
- 상세: 다음 4가지 변경이 복합 적용됐다:
  1. `REMOVE_ON_COMPLETE_AGE_SEC`, `REMOVE_ON_FAIL_AGE_SEC` 상수 추출 (I9)
  2. `@Processor(..., { concurrency: 1 })` 명시 (I10)
  3. `reconcile()` JSDoc 추가 (I7/I18)
  4. `swept > 0` 성공 로그 제거 — token service 에 로그 책임 단일화 (I7 중복로그)

  중복 로그 제거(4번)는 RESOLUTION.md "I7(유지보수성 이중 로그) → reconciler 의 중복 swept 로그 제거(token service 단일 책임)" 항목에 명시된 의도적 처리다. 나머지도 모두 RESOLUTION.md fix 항목에 대응. 범위 내.
- 제안: 없음.

### [INFO] 파일 2 (interaction-token.service.spec.ts) — 단언 보강 + 새 케이스 추가
- 위치: `interaction-token.service.spec.ts` diff +58~91
- 상세: 기존 테스트 케이스에 `qb.select`, `qb.distinct`, `qb.limit` 단언 추가(I14~I16)와 만료토큰(ttl<=0) 케이스 추가(I17). 모두 RESOLUTION.md "I14/I15/I16/I17 테스트 갭" 에 1:1 대응. 범위 내.
- 제안: 없음.

### [INFO] 파일 6~8 (review/ 산출물) — 프로젝트 규약에 따른 산출물
- 위치: `review/code/2026/06/14/15_59_50/RESOLUTION.md`, `SUMMARY.md`, `_retry_state.json`
- 상세: CLAUDE.md 및 plan-lifecycle.md 규약에 따라 ai-review 산출물과 RESOLUTION.md 가 커밋에 포함된다. 규약 내 의도적 포함.
- 제안: 없음.

---

## 요약

변경된 5개 코드 파일(module.ts, interaction-token.service.ts/spec.ts, terminal-revoke-reconciler.service.ts/spec.ts)과 3개 review 산출물 파일 모두 이전 ai-review RESOLUTION.md 에 명기된 fix 항목(W2/W3/W6/W7, I5/I6/I7/I8/I9/I10/I14~I19)에 1:1 대응한다. 의도 외 추가 리팩토링, 무관한 기능 확장, 관련 없는 파일 수정, 불필요한 포맷팅 혼입, 의도하지 않은 임포트 변경은 발견되지 않았다. 모든 변경이 RESOLUTION.md 에 사전 기술된 범위 내에서 이루어졌다.

## 위험도

NONE
