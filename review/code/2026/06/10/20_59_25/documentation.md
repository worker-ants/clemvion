# 문서화(Documentation) Review

## 발견사항

### [INFO] 인라인 주석 정확성 — `sortByStartedAt` 잔존 주석이 교체 완료됨 (확인)
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 4004–4007, 4177–4180, 5581, 5907, 6572행; `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts` 291, 400행
- 상세: 이전 리뷰 세션(20_45_51)에서 INFO 1로 식별된 `sortByStartedAt` 잔존 주석 7곳이 본 diff 에서 `selectSortedNodeResults` 로 일괄 교체됐다. RESOLUTION.md 도 이를 "INFO 1 코드 조치 완료"로 기록한다. 주석 정확성 관점에서 해당 항목은 해소됐다.
- 제안: 없음.

### [INFO] 테스트 파일 신규 케이스 주석 — 맥락 참조 인라인 주석 적절
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 36–67행 (신규 추가)
- 상세: `resolveParallelEngineFlag` read-once 가드 2건의 테스트 케이스에 인라인 주석으로 재리뷰 이슈 번호(`재리뷰(20_45_51) W1`)와 cold/warm 상태의 의도가 기술돼 있다. 테스트 수준에서 "왜 이 케이스가 필요한지"를 설명하므로 독자 이해에 충분하다. 기존 `MAX_NODE_ITERATIONS` 케이스(이전 라인)와 동일한 주석 패턴을 따른다.
- 제안: 없음.

### [INFO] `selectSortedNodeResults` JSDoc — WeakMap 캐시 만료 조건 여전히 미기재
- 위치: `codebase/frontend/src/lib/stores/execution-store.ts` 382–394행 (이번 diff 에 미포함 — 선행 리뷰의 미조치 항목)
- 상세: 이전 리뷰(20_45_51 INFO 3)에서 "WeakMap 캐시 만료 조건 미기재" 가 식별됐고, RESOLUTION.md 는 이를 "비차단 후속 (refactor 백로그 grooming)"으로 보류했다. 이번 diff 에도 해당 JSDoc 수정은 포함되지 않았다. 기능 동작에 영향은 없으나 캐시 무효화 시점을 독자가 추론해야 하는 상태가 유지된다.
- 제안: 후속 작업 시 JSDoc 에 한 줄 추가 — `// Cache is keyed on the array reference; a new array (after addNodeResult replaces the ref) triggers a fresh sort.`

### [INFO] `importWorkflow` 배치 insert 전제 — spec Rationale 미기재 상태 유지
- 위치: `spec/2-navigation/1-workflow-list.md` `## Rationale` 섹션 (이번 diff 에 미포함)
- 상세: 이전 리뷰(20_45_51 INFO 2)에서 `workflows.service.ts`의 `importWorkflow()`가 `manager.insert` 배치로 전환되면서 `@BeforeInsert` hook·cascade 부재를 런타임 전제로 두는 점이 코드 주석에만 기술되고 spec Rationale 에 미기재됨이 식별됐다. RESOLUTION.md 는 이를 "비차단 후속" 으로 보류했으며 이번 diff 에도 조치가 없다. 코드 주석 ↔ spec 단일 진실 원칙 관점에서 여전히 미흡하다.
- 제안: `spec/2-navigation/1-workflow-list.md` Rationale 에 "현 구현은 `manager.insert` 배치를 사용 — `@BeforeInsert` hook·cascade 부재 전제; 향후 hook 추가 시 배열 `save` 로 복귀 필요" 를 1문장 추가.

### [INFO] RESOLUTION.md 문서화 완전성 — 후속 보류 항목 추적 가능
- 위치: `review/code/2026/06/10/20_45_51/RESOLUTION.md` (신규 파일)
- 상세: RESOLUTION.md 가 조치 항목(W1, INFO 1, INFO 4, INFO 15)과 보류 항목(INFO 2·3·7–14)을 표 형식으로 명확히 분리해 기록하고 있다. 보류 항목에 "refactor 백로그 grooming 에서 picking" 이라는 처리 경로가 명시돼 향후 추적이 가능하다. 리뷰 산출물 문서화 관점에서 적절하다.
- 제안: 없음.

### [INFO] `S3Service.deleteMany` JSDoc 도메인 문구 — 조치 미포함 (확인)
- 위치: `codebase/backend/src/common/services/s3.service.ts` (이번 diff 에 미포함)
- 상세: 이전 리뷰(20_45_51 INFO 4)에서 `deleteMany` JSDoc 내 "KB 삭제 cleanup 전용" 도메인 문구가 인프라 레이어에 도메인 의미론을 누출한다는 점이 식별됐다. RESOLUTION.md 는 "확인 — spec 진입점 불릿 표현은 후속"으로 기록했으며 이번 diff 에도 조치 없다. 기능 영향 없음.
- 제안: `deleteMany` JSDoc 에서 "KB 삭제 cleanup 전용" 문구를 제거하고 "다수 S3 키를 DeleteObjects 배치로 삭제한다" 와 같은 범용 설명으로 교체 (후속).

---

## 요약

이번 변경의 핵심 문서화 조치는 이전 리뷰(20_45_51)에서 식별된 `sortByStartedAt` 잔존 주석 7곳을 `selectSortedNodeResults` 로 일괄 교정한 것으로, 주석 정확성 관점에서 중요한 항목이 해소됐다. 신규 추가된 `resolveParallelEngineFlag` read-once 테스트 2건도 인라인 주석이 맥락을 충분히 설명한다. RESOLUTION.md 는 조치·보류 항목을 표 형식으로 명확히 분리해 향후 추적 가능성을 확보했다. 남아있는 미조치 항목은 세 가지이며 모두 이전 리뷰에서 비차단 후속으로 보류된 것이다: `selectSortedNodeResults` JSDoc WeakMap 캐시 만료 조건 미기재, `importWorkflow` 배치 insert 전제가 spec Rationale 에 미기재, `S3Service.deleteMany` JSDoc 의 도메인 문구 잔존. 세 건 모두 기능 동작에 영향 없는 문서화 개선 과제이며 차단 사항이 아니다.

---

## 위험도

LOW
