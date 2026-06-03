# Rationale 연속성 검토 결과

## 발견사항

- **[INFO]** `spec/1-data-model.md §Rationale` 에 NodeExecution.status `cancelled` 추가 근거 항목 없음
  - target 위치: `spec/1-data-model.md §2.14` — status enum 에 `cancelled` 추가 (inline 설명: "외부 abortSignal 로 노드 외부 I/O 가 중단되어 핸들러가 throw 한 AbortError 를 엔진이 분류한 상태")
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §Rationale §4` ("rehydration 단말 상태 이분") 에 "NodeExecution `cancelled` enum 은 2026-06-03 abortSignal cancellation 경로용으로 신설됐으나" 라는 문장이 이미 기재됨
  - 상세: target 계획이 변경한 6파일 중 `spec/1-data-model.md` 는 `## Rationale` 절에 이번 enum 신설 근거 항목을 추가하지 않았다. `execution-engine.md §Rationale §4` 와 `node-cancellation.md §Rationale §5.1` 이 정식 Rationale SoT 이므로 data-model 자체에 항목이 없어도 cross-link 로 추적 가능하지만, data-model Rationale 는 현재 데이터 구조 변경(V035→V036 등) 을 직접 기록하는 패턴이며 V069 migration(NodeExecution.status CHECK에 `cancelled` 추가)도 같은 범주에 해당한다.
  - 제안: `spec/1-data-model.md §Rationale` 에 "NodeExecution.status `cancelled` 신설 (V069)" 항목을 추가하고, `execution-engine.md §Rationale §4` / `node-cancellation §5.1` 로 cross-link.

---

## 분석 요약

target 문서(`plan/in-progress/spec-draft-node-execution-cancelled.md`)는 `execution-engine.md §Rationale §4` 의 "cancelled 는 NodeExecution enum 에 없다 / 신설 안 택함" 문장을 번복하는 결정이다. 현재 worktree 의 spec 파일들을 확인한 결과, 이 번복은 **적절히 문서화**되어 있다:

- `execution-engine.md §Rationale §4`(line 1218–1225)는 번복 사실을 명시하고 ("NodeExecution `cancelled` enum 은 2026-06-03 abortSignal cancellation 경로용으로 신설됐으나"), 이분 정책(abortSignal 경로 → `cancelled`, rehydration 인프라 실패 → `failed` 유지)의 근거를 구체적으로 기술한다.
- `node-cancellation.md §Rationale`(lines 139–154)는 abortSignal API 채택 근거 + 옵션 B(전용 status) 설계 이유를 포함한다.
- 기각된 옵션 A(`failed`+`AbortError` 재사용)도 target 문서 `## 설계 결정`에 명시 기각됐다.
- 합의된 invariant("rehydration 인프라 실패는 `failed` 유지" — Rationale §4 이분 정책)를 target 이 명시적으로 보존하고 있다.

유일한 미비점은 `spec/1-data-model.md §Rationale` 에 V069 migration과 enum 신설 근거 항목이 없다는 것으로, 같은 파일이 V035/V036 마이그레이션 근거를 직접 기록하는 선례와 비교해 미흡하다. 그러나 정식 Rationale SoT는 `execution-engine.md §Rationale §4`에 이미 존재하므로 연속성 위반은 아니며 INFO 수준이다.

## 위험도

LOW
