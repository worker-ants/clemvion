# 변경 범위(Scope) Review

## 발견사항

- **[INFO]** 변경 전반이 plan 백로그 항목과 1:1 대응
  - 위치: 전 파일 + `plan/in-progress/refactor/01-performance.md`
  - 상세: 모든 코드 변경에 `perf #N` 태그가 달려 있고, plan 의 항목(#1 rehydration 배치, #2 s3 deleteMany, #4 dashboard 집계 2쿼리, #5 container cycle nodeMap 재사용, #6 queue 포인터, #7 카탈로그 캐시, #10 import 배치 insert, #14 env read-once, #3/#8 frontend 정렬 accessor)과 정확히 매칭된다. 범위 밖 기능 추가나 무관 파일 수정은 발견되지 않았다.
  - 제안: 없음. 추적성 양호.

- **[INFO]** 신규 public 함수/메서드는 모두 backlog 요구에 직접 종속
  - 위치: `s3.service.ts deleteMany`, `execution-store.ts selectSortedNodeResults`·`findNodeResult`, `system-prompt.ts renderNodeCatalogCached`·`resetNodeCatalogCacheForTesting`
  - 상세: 추가된 API 표면은 모두 해당 perf 항목의 직접 산물이며 즉시 호출처가 존재한다(over-engineering 아님). `resetNodeCatalogCacheForTesting`·`resetExpressionCacheForTesting` 와 동일 규율의 테스트 전용 진입점으로, 프로덕션 비호출 주석이 명시돼 있다.
  - 제안: 없음.

- **[INFO]** 테스트 파일의 인접 영역 수정은 변경에 종속적이며 무관 수정 아님
  - 위치: `dashboard.service.spec.ts`, `workflows.service.spec.ts`, `use-execution-events.test.ts`, `execution-store.test.ts`, frontend expression 테스트 2건
  - 상세: `workflows.service.spec.ts` 의 `findSavedNode`/`update` 단언이 `insert` 배치 단언으로 바뀐 것, frontend 테스트의 `sortByStartedAt` → `selectSortedNodeResults` 명칭/단언 전환, expression 테스트 mock 의 `selectSortedNodeResults: actual.selectSortedNodeResults` partial-mock 추가는 모두 구현 변경이 강제하는 동반 수정이다. 무관한 테스트 케이스를 건드리지 않았다.
  - 제안: 없음.

- **[INFO]** 임포트 추가는 모두 사용처 존재
  - 위치: `execution-engine.service.ts`(`In`), `workflows.service.ts`(`randomUUID`, `QueryDeepPartialEntity`), frontend 4개 파일(`selectSortedNodeResults`), `s3.service.ts`(`DeleteObjectsCommand`)
  - 상세: 추가된 임포트는 전부 동일 diff 내에서 사용된다. 사용하지 않는 임포트 추가나 무관한 import 정리는 없다.
  - 제안: 없음.

- **[INFO]** 주석은 변경 근거 설명에 집중, 잡음 없음
  - 위치: 전 파일
  - 상세: 추가 주석이 다소 장황하나(예: `execution-store.ts` index Map 유지보수, `workflows.service.ts` hook 우회 주의) 모두 변경된 로직의 불변식·회귀 위험을 설명하는 실질적 내용이다. 무관 코드의 주석 삭제/추가는 없다.
  - 제안: 없음.

- **[INFO]** plan 종결 항목(#11·#12·#15)은 코드 변경 없이 문서만 갱신 — 범위 일관
  - 위치: `plan/in-progress/refactor/01-performance.md`
  - 상세: wontfix/종결 처리된 항목은 plan 문서에서만 상태가 갱신되고 해당 코드(`rag-search.service.ts`, `clearLlmDefaultConfigCache`, conversation `.map()`)는 손대지 않았다. 종결과 구현 범위가 정확히 분리돼 있다.
  - 제안: 없음.

- **[INFO]** spec 변경은 코드에 미포함, draft 위임으로 분리
  - 위치: `plan/in-progress/spec-update-perf-backlog-01.md` (신규)
  - 상세: developer 가 `spec/` read-only 규약을 지켜 spec 직접 수정 대신 planner 위임 draft 를 생성했다. perf #2/#14 의 spec 문구 동기화를 별도 트랙으로 분리한 것으로, 코드 변경 범위에 spec 오염이 섞이지 않았다.
  - 제안: 없음.

- **[INFO]** 포맷팅-only 변경 없음
  - 위치: 전 파일
  - 상세: 의미 없는 공백/줄바꿈/재정렬이 실질 변경과 섞인 흔적 없음. `assertNoContainerCycle` 시그니처 변경, `planContainerBody` 의 nodeMap/children 빌드 순서 이동(#5)은 의미 있는 perf 변경이며 동작 불변임이 주석/테스트로 고정돼 있다.
  - 제안: 없음.

## 요약
이번 변경은 `plan/in-progress/refactor/01-performance.md` 의 성능 백로그를 항목별(`perf #N`)로 구현한 것으로, 모든 코드 수정이 추적 가능한 backlog 항목과 1:1 대응하며 의도 범위를 벗어나는 기능 확장·무관 리팩토링·포맷팅 잡음·미사용 임포트가 발견되지 않았다. 테스트 동반 수정은 구현 변경이 강제하는 것에 한정되고, 종결 항목(#11/#12/#15)은 코드를 건드리지 않고 plan 문서만 갱신했으며, spec 갱신은 developer 의 read-only 규약을 지켜 별도 planner-위임 draft 로 깔끔히 분리됐다. 신규 API 표면(deleteMany, selectSortedNodeResults, findNodeResult 등)은 모두 즉시 호출처가 있어 over-engineering 이 아니다.

## 위험도
NONE
