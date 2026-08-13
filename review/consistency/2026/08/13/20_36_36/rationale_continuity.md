# Rationale 연속성 검토

## 검토 대상

- 코드 diff: `common/utils/update-returning-rows.ts`(신규) + `execution-engine.service.ts`·
  `knowledge-base.service.ts` 7개소 적용 (TypeORM `UPDATE`/`DELETE` `RETURNING` 이
  `[rows, rowCount]` 튜플을 돌려주는데 행 배열로 오인하던 결함 수정)
- plan: `plan/in-progress/update-returning-tuple-shape.md` (`spec_impact: none`)
- target spec 영역: `spec/5-system/` (대부분 컨텍스트 예산으로 절단, `1-auth.md`·
  `2-api-convention.md`·`3-error-handling.md` 만 전문 포함)

## 발견사항

없음 — CRITICAL/WARNING 없음.

검토 근거:

1. **§8 동시 실행 제한(admission gate) 과의 정합** — 수정된 `admitExecutionOrDefer`
   는 `spec/5-system/4-execution-engine.md` §8 이 명시한 "per-workspace
   `pg_advisory_xact_lock` 으로 admission 직렬화 + 조건부 UPDATE(RETURNING)" 메커니즘을
   그대로 유지한다(`execution-engine.service.ts` L2867-2920 실측, advisory lock 호출이
   그대로 남아 있음). §8 Rationale "동시성 cap admission gate" 항목이 "조건부 UPDATE
   단독은 불충분 — advisory lock 필요" 라고 명시적으로 기각한 대안(conditional UPDATE
   단독)을 이번 diff 가 **재도입하지 않는다** — 이번 수정은 advisory lock 이후 단계인
   "RETURNING 행 추출" 로직만 건드렸다. 즉 과거 기각된 대안의 재도입이 아니다.
2. **KB CAS 락(`reextract_status`) 과의 정합** — `spec/5-system/10-graph-rag.md` §5.1·
   `spec/data-flow/6-knowledge-base.md` §1.5·`spec/5-system/3-error-handling.md` 는
   `KB_REEXTRACT_IN_PROGRESS` 를 "DB 컬럼 atomic compare-and-swap" (advisory lock
   없는 단순 조건부 UPDATE) 로 정의한다. 이번 diff 가 건드린 KB re-extract/re-embed
   CAS 두 지점도 같은 패턴(advisory lock 없는 단일 컬럼 CAS)을 그대로 유지하며, 잠금
   전략 자체는 바뀌지 않았다 — exec admission 의 "advisory lock 필수" 원칙과는 별개
   시나리오(단일 행 CAS vs 다중 행 COUNT 스냅샷)라 원칙 위반이 아니다.
3. **`updateExecutionStatus` else-분기 guarded UPDATE** — `4-execution-engine.md` L82-97
   이 문서화한 "짝 전이 조건부 UPDATE, `affected=0` 이면 no-op" 의미론은 diff 이후에도
   보존된다(`updateReturningRows(updated).length > 0` 는 옛 `updated.length > 0` 이
   *의도했던* 판정을 실제로 구현하도록 고친 것뿐, 판정 대상·의미 자체는 그대로).
4. **결정 번복 시 새 Rationale 동반** — 이번 fix 는 과거 결정(§8 admission gate·KB CAS
   패턴)을 뒤집지 않으므로 3항목("무근거 번복") 자체가 해당하지 않는다. 대신 plan 문서
   자체에 `## Rationale`("왜 assertRowArray 로는 못 잡았나" / "왜 코드가 아니라 mock 을
   먼저 의심했어야 했나")을 갖춰, 직전 방어(`assertRowArray`, "배열인가"만 검사)가
   불충분했던 이유를 명시적으로 남겼다 — 번복이 아니라 defense scope 확장이며 근거도
   기록돼 있다.
5. **`spec_impact: none` 의 타당성** — 이 fix 는 API 계약·상태 머신·에러 코드·엔드포인트
   중 어느 것도 바꾸지 않는다(순수 내부 버그 수정). spec 문서 어디에도 "UPDATE/DELETE
   RETURNING 은 행 배열" 이라는 잘못된 전제가 명시적으로 기술돼 있지 않으므로, spec 을
   수정하지 않은 것이 기존 Rationale 과 모순을 남기지도 않는다.

## 요약

이번 diff(`update-returning-rows` 헬퍼 도입 + 7개 소비 지점 교체)는 `spec/5-system/4-execution-engine.md` §8 이 명시한 "advisory lock + 조건부 UPDATE" admission 메커니즘과 `10-graph-rag.md`/`data-flow/6-knowledge-base.md` 가 명시한 KB CAS 패턴을 그대로 보존한 채, TypeORM 드라이버가 돌려주는 실제 반환 shape(`[rows, rowCount]` 튜플)만 정확히 해석하도록 고친 순수 버그 수정이다. 과거 Rationale 이 기각한 대안(조건부 UPDATE 단독)을 재도입하지 않았고, 합의된 admission·CAS 원칙을 우회하지도 않았으며, 결정을 뒤집는 부분도 없어(대신 plan 자체 Rationale 로 defense-scope 확장의 근거를 남김) target(spec/5-system) 과 관련 spec Rationale 사이에 연속성 위반은 발견되지 않았다. 다만 이 결함 클래스(TypeORM UPDATE/DELETE 튜플 shape)가 이번이 세 번째 개별 발생(과거 `agent-memory-admin`·`stuck-document-recovery`, 이번 7곳)인데도 이 invariant 가 `spec/conventions/` 어디에도 정본 문서로 남아있지 않다 — plan 문서는 라이프사이클상 `plan/complete/` 로 이동하면 이 reviewer 의 상시 검토 범위(spec/)에서 벗어나므로, 동일 결함의 네 번째 재발을 막으려면 이 invariant 를 conventions 문서(또는 관련 spec 의 데이터 접근 절)에 정식 등재하는 것을 권고한다(INFO, 비차단).

## 위험도

NONE
