# RESOLUTION — kb-unsearchable-warning (ai-review 22_20_59)

ai-review 결과 **Critical 0 / 위험도 LOW**. WARNING 6건은 전부 naming·JSDoc·주석·중복
수준의 유지보수성·문서화 nit(동작 불변)으로, `code-review-summary` sub-agent 가 주간
사용 한도에 걸려 실패했기에 main Claude 가 **수동 처리**했다.

## 조치 항목

| SUMMARY # | 발견 (reviewer) | fix commit |
|-----------|------------------|------------|
| W1/W6 | RagAccumulator 카운터 이름·클래스 JSDoc 판정 규칙 (architecture/maintainability/documentation) | `bd9a8d98` |
| W2/W5 | `withUnsearchable`→`mergeUnsearchable`, JSDoc 블록 재배치 (maintainability/documentation) | `bd9a8d98` |
| W3 | `results.length===0` 가드 INVARIANT 주석 (architecture/maintainability) | `bd9a8d98` |
| W4 | 프론트 `reembedStatus` 중복 → 단일 참조점 (maintainability) | `bd9a8d98` |
| doc INFO | `note` i18n 비대상 주석, plan owner 표준화 | `bd9a8d98` |

### 후속으로 이관 (reviewer 권고 일치)
- `UnsearchableKbBadge` 컴포넌트 추출 / `KbToolProvider.execute` 멀티-KB 레이어 재검토 /
  KB 통합 가이드 "임베딩 모델 변경" 절 보강 → `plan/in-progress/kb-model-change-reembed-followup.md`
  및 `rag-rerank-followup.md`. W3 INVARIANT 주석으로 단일-KB 전제를 코드에 고정해 안전장치 확보.

## TEST 결과 (fix 후 재수행)

- **lint**: 통과 (`lint-20260610-070830`)
- **unit**: 통과 — 40 (backend 329 suites + frontend) (`unit-20260610-071021`)
- **build**: 통과 (`build-20260610-071110`)
- **e2e**: 통과 — 176 (`e2e-20260610-071222`)

## 보류·후속 항목

- **`/consistency-check --impl-done`** (spec 연결 코드 변경 → 의무, SPEC-CONSISTENCY 가드):
  sub-agent fan-out 경로라 **주간 사용 한도(resets Jun 11 07:00 KST)** 로 현재 실행 불가.
  한도 리셋 후 실행 예정. push 는 그 이후.
- 근본 원인(`update()` 모델 변경 시 재임베딩 미트리거) 자동화 → `kb-model-change-reembed-followup`.
