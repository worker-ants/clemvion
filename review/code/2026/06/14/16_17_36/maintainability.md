# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 3: interaction-token.service.ts — reconcileTerminalRevocations (변경 후)

- **[INFO]** 상수화 완료 — 이전 리뷰 지적사항 해소
  - 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` L113–124
  - 상세: 이전 리뷰(15_59_50)에서 지적된 매직 넘버 `500`, terminal 상태 목록 인라인 선언이 본 diff 에서 `RECONCILE_BATCH_LIMIT`, `RECONCILE_BATCH_MAX`, `RECONCILE_CONCURRENCY`, `TERMINAL_STATUSES` 상수로 모두 추출됐다. 기존 `IEXT_*`·`ITK_*` 상수 블록 바로 뒤에 위치하여 컨벤션 일관성을 충족한다.
  - 제안: 없음.

- **[INFO]** `TERMINAL_STATUSES` 동기화 주석 — 배열과 enum 의 결합 의존성을 적절히 문서화
  - 위치: `interaction-token.service.ts` L119 주석 `enum 확장 시 본 배열 동기화`
  - 상세: enum 에 새로운 terminal 상태가 추가될 경우 배열 갱신이 필요하다는 사실이 JSDoc 으로 명시돼 있다. 유지보수 시 누락을 방지하는 수준으로 적절하나, 컴파일 타임 exhaustiveness 체크는 여전히 적용되지 않는다. 런타임 실수 위험이 낮은 배경 작업이므로 현재 수준은 수용 가능하다.
  - 제안: 허용 범위. 향후 `ExecutionStatus` 확장 빈도가 높아지면 `satisfies` 또는 별도 타입 가드로 컴파일 타임 검증 추가를 검토.

- **[INFO]** bounded-concurrency 루프 내 `forEach` 와 index 루프 혼용 패턴
  - 위치: `interaction-token.service.ts` L178–192 (추가 블록)
  - 상세: 바깥 반복은 `for (let i = 0; ...)` 이터레이터 루프를 쓰고, 내부 `results.forEach(...)` 는 콜백 형식이다. 코드베이스 내 비동기 루프 스타일이 `for...of` 로 통일되어 있다면 `for (const [idx, r] of results.entries())` 형식이 더 일관적이다. 기능 차이는 없다.
  - 제안: 코드베이스 스타일 가이드에 따라 `results.forEach` 를 `for...of results.entries()` 로 교체하는 것을 고려. 현재 규모에서는 INFO 수준.

- **[INFO]** `Math.floor(batchLimit)` — 부동소수 방어 처리의 JSDoc 명시 부재
  - 위치: `interaction-token.service.ts` L145 `Math.min(Math.max(1, Math.floor(batchLimit)), RECONCILE_BATCH_MAX)`
  - 상세: `batchLimit` 의 타입이 `number` 이므로 부동소수 방어는 방어적 프로그래밍으로 올바르다. 다만 호출자가 의도치 않게 소수점 값을 전달할 수 있다는 힌트가 시그니처에 없다.
  - 제안: JSDoc `@param` 에 "정수를 기대하며, 소수는 내부적으로 floor 처리된다"는 단문 추가로 충분.

### 파일 5: terminal-revoke-reconciler.service.ts (변경 후)

- **[INFO]** 매직 넘버 상수 추출 완료
  - 위치: `terminal-revoke-reconciler.service.ts` L253–254
  - 상세: 이전 리뷰에서 지적된 `removeOnComplete: { age: 24 * 60 * 60 }`, `removeOnFail: { age: 7 * 24 * 60 * 60 }` 가 `REMOVE_ON_COMPLETE_AGE_SEC`, `REMOVE_ON_FAIL_AGE_SEC` 로 추출됐다. 상수 선언 위치가 파일 상단 상수 블록에 있어 컨벤션 일관성 양호.
  - 제안: 없음.

- **[INFO]** `reconcile()` 메서드 public 유지 + JSDoc 추가 — 의도 명시 개선
  - 위치: `terminal-revoke-reconciler.service.ts` L284–290
  - 상세: 이전 리뷰에서 지적된 `reconcile()` public 가시성에 대해 JSDoc 으로 "직접 테스트 위함" 의도가 명시됐다. 가시성을 `protected` 로 좁히지는 않았으나, JSDoc 이 그 결정의 근거를 설명하므로 향후 유지보수자가 이를 오해할 가능성은 낮아졌다.
  - 제안: 없음 (의도가 충분히 문서화됨).

- **[INFO]** 이중 로그 제거 — 단일 책임 개선
  - 위치: `terminal-revoke-reconciler.service.ts` diff L292–299 (삭제된 블록)
  - 상세: 이전 리뷰에서 지적된 이중 로그 문제를 reconciler 측 swept 로그를 제거하는 방식으로 해소했다. sweep 결과 로그는 `InteractionTokenService.reconcileTerminalRevocations` 가 단일 책임으로 관리한다. 의도가 JSDoc 에도 반영됐다.
  - 제안: 없음.

- **[INFO]** `@Processor(..., { concurrency: 1 })` 명시 — 의도 명확화 완료
  - 위치: `terminal-revoke-reconciler.service.ts` L265
  - 상세: 이전 리뷰(concurrency.md) 에서 권고된 concurrency 명시가 반영됐다. 주석도 단일 concurrency 의 이유(같은 인스턴스 내 중복 불요, 전역 1회는 Redis 가 보장)를 설명한다.
  - 제안: 없음.

### 파일 1: external-interaction.module.ts (변경 후)

- **[INFO]** 모듈 JSDoc 업데이트 완료
  - 위치: `external-interaction.module.ts` L35 (추가된 주석 라인)
  - 상세: 이전 리뷰에서 지적된 모듈 Wire-up 목록의 `TerminalRevokeReconcilerService` 누락이 한 줄 추가로 해소됐다. spec 참조(`EIA-RL-06`)와 BullMQ repeatable 특성이 함께 기재되어 정보 밀도가 적절하다.
  - 제안: 없음.

### 파일 2: interaction-token.service.spec.ts (변경 후)

- **[INFO]** `makeQB` / `makeService` 헬퍼 재사용 — 테스트 코드 DRY 양호
  - 위치: `interaction-token.service.spec.ts` diff L64–91
  - 상세: 신규 테스트 3건이 기존 `describe` 블록 내 헬퍼를 재사용한다. 각 테스트가 독립 repo mock 을 구성해 사이드 이펙트 격리도 양호하다.
  - 제안: 없음.

- **[INFO]** 만료 토큰 테스트 — 주석과 단언이 의도를 명확히 기술
  - 위치: `interaction-token.service.spec.ts` L75–91
  - 상세: `// 만료된 jti 는 blacklist SET skip` 주석이 단언과 함께 기재되어 의도가 명확하다. `redis.set.not.toHaveBeenCalled()` 와 조합해 복합 조건을 간결하게 검증한다.
  - 제안: 없음.

---

## 요약

이번 diff 는 이전 ai-review(15_59_50) 에서 유지보수성 관점으로 지적된 주요 항목(매직 넘버 상수화, terminal 상태 목록 중앙화, 이중 로그 제거, module JSDoc 업데이트, concurrency 명시)을 체계적으로 해소했다. 상수 추출 위치와 네이밍(`RECONCILE_BATCH_LIMIT`, `RECONCILE_BATCH_MAX`, `RECONCILE_CONCURRENCY`, `TERMINAL_STATUSES`, `REMOVE_ON_*_AGE_SEC`)이 기존 코드베이스 컨벤션과 일치하며, reconciler-service 간 로그 단일 책임 분리가 명확해졌다. 남은 사항은 `forEach` vs `for...of` 스타일 일관성, `batchLimit` JSDoc `@param` 부동소수 처리 기술, `TERMINAL_STATUSES` 의 컴파일 타임 exhaustiveness 검증 부재 정도이며 모두 INFO 등급이다. CRITICAL·WARNING 급의 유지보수성 문제는 발견되지 않는다.

## 위험도

LOW
