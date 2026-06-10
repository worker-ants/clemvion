# 아키텍처(Architecture) 리뷰 결과

리뷰 대상: 재리뷰 세션 (20_45_51 W1 fix + INFO 1 fix) — resolveParallelEngineFlag read-once spy 2건 추가, sortByStartedAt 잔존 주석 교체, 이전 리뷰 산출물 파일 신규 추가

---

## 발견사항

### [INFO] 테스트 내 private 상태 직접 조작 패턴 — 캡슐화 침투
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 신규 테스트 cold-start 케이스 (parallelEngineFlagOnce = null 리셋)
- 상세: cold-start 테스트에서 `(service as unknown as { parallelEngineFlagOnce: string | null }).parallelEngineFlagOnce = null` 로 private 캐시 필드를 직접 초기화한다. 이 방식은 타입 시스템을 우회(unknown as)해 white-box 방식으로 구현 내부를 조작하는 것으로, 기존 `maxNodeIterationsOnce` 테스트와 동일 패턴이다. 일관성은 있으나 private 구현 세부(필드명, null 초기값)에 테스트가 강하게 결합된다. 필드명이나 초기화 전략이 바뀌면 테스트도 같이 깨진다.
- 제안: 현재 private 메서드이고 테스트 전용 reset 노출 패턴(`resetXxxForTesting`)이 이미 프로젝트에 존재한다(`resetNodeCatalogCacheForTesting`, `resetExpressionCacheForTesting`). 동일 규율로 `resetParallelEngineFlagCacheForTesting` 을 제공하면 캡슐화를 보존하면서 cold-start 테스트를 안정화할 수 있다. INFO 등급 — 현 시점 기능 문제 없음, 중기 개선 과제.

---

### [INFO] 이전 리뷰 산출물 파일군 — 아키텍처 무관, 확인용 기록
- 위치: `review/code/2026/06/10/20_45_51/` 하위 파일 전체 (SUMMARY.md, RESOLUTION.md, 각 reviewer 출력, _retry_state.json, meta.json)
- 상세: 이번 diff 에 포함된 review 산출물 파일들은 리뷰 워크플로 자체의 상태 추적 데이터이며 애플리케이션 아키텍처와 무관하다. 아키텍처 관점에서 분석할 대상이 아니다.
- 제안: 없음.

---

### [INFO] 주석 교체(sortByStartedAt → selectSortedNodeResults) — 레이어 경계 문서 정합 개선
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 4개소, `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts` 2개소
- 상세: 삭제된 함수 이름이 백엔드 실행 엔진과 프론트엔드 테스트 주석에 잔존했던 것을 정확한 이름으로 교체했다. 아키텍처적으로는 레이어 간 공유 어휘(노드 결과 정렬 함수 이름)가 코드 내 문서에서 일관성을 회복한 것이다. 변경은 순수 주석이므로 런타임 동작에 영향 없다.
- 제안: 없음. 올바른 수정.

---

## 요약

이번 재리뷰 diff 는 세 가지 성격의 변경으로 구성된다: (1) `resolveParallelEngineFlag` read-once 캐시에 대한 회귀 가드 테스트 2건 추가 — 이전 리뷰 W1 조치. (2) `sortByStartedAt` 잔존 주석 6곳 교체 — INFO 1 조치. (3) 이전 리뷰 세션(20_45_51) 산출물 파일군 신규 추가 — 아키텍처 무관. 아키텍처 관점에서 심각한 문제는 없다. 유일한 관찰 사항은 cold-start 테스트가 private 캐시 필드를 `unknown as` 캐스팅으로 직접 리셋하는 패턴으로, 기존 `maxNodeIterationsOnce` 케이스와 동일한 캡슐화 침투다 — 프로젝트 내 `resetXxxForTesting` 패턴과 비교하면 정합성이 낮다. 신규 순환 의존성, 모듈 경계 위반, SOLID 위반, 레이어 책임 혼재는 발견되지 않는다.

---

## 위험도

NONE
