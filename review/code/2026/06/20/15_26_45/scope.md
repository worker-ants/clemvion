# 변경 범위(Scope) 리뷰 결과

## 작업 의도

M-5 레이어1 — `NodeBootstrapService` 의 `ALL_NODE_COMPONENTS` 정적 import 를 `NODE_COMPONENT` DI 토큰 주입으로 전환하고, 카테고리별 `<category>/index.ts` 단일 출처 배열 + 단일 aggregator `NodeComponentsModule` 을 도입한다 (behavior-preserving 리팩터).

## 발견사항

### [INFO] 카테고리 index 파일 7개 신규 생성
- 위치: `nodes/trigger/index.ts`, `nodes/logic/index.ts`, `nodes/flow/index.ts`, `nodes/ai/index.ts`, `nodes/integration/index.ts`, `nodes/data/index.ts`, `nodes/presentation/index.ts`
- 상세: 각 카테고리 디렉토리에 `<CATEGORY>_COMPONENTS` 배열을 export 하는 index 파일을 신규 생성. 기존에 개별 노드 컴포넌트를 `nodes/index.ts` 에서 직접 import 하던 구조를 카테고리 단위 집약으로 재편. 이는 M-5 레이어1 설계(D-1 격리 = per-category 배열)의 필수 구성 요소이며 범위 내.
- 제안: 해당 없음.

### [INFO] `nodes/index.ts` 개별 import → spread 파생으로 대규모 교체
- 위치: `codebase/backend/src/nodes/index.ts`
- 상세: 25개 개별 노드 컴포넌트 import 가 삭제되고 7개 카테고리 배열 spread 로 대체. `ALL_NODE_COMPONENTS` 구조는 유지하면서 카테고리 배열을 재-export 하는 구문이 추가됨. 의도된 범위(hotspot 해소, 단일 출처 구조)의 직접 구현이며 동작 보존 변경.
- 제안: 해당 없음.

### [INFO] `node-bootstrap.service.ts` JSDoc 전면 개정
- 위치: `codebase/backend/src/modules/execution-engine/node-bootstrap.service.ts`
- 상세: 클래스 JSDoc 이 구 "정적 import" 서술에서 DI 주입·정렬키·레이어1 목적으로 전면 재작성됨. 분량이 상당히 늘었으나, 전환 배경(대체 이유, 미래 확장 seam)을 명시하는 것은 behavior-preserving 구조 변경에서 필요한 문서화. 순수 주석 변경이므로 행동에 영향 없음.
- 제안: 해당 없음.

### [INFO] `node-bootstrap.service.spec.ts` 테스트 구조 전면 개편 + 정렬 결정성 테스트 추가
- 위치: `codebase/backend/src/modules/execution-engine/node-bootstrap.service.spec.ts`
- 상세: 공유 `setup()` / `bootstrapArgs()` 헬퍼 추출, DI 주입 패턴에 맞게 생성자 시그니처 갱신, 정렬 결정성을 검증하는 두 번째 `it` 블록 추가. 정렬(`sortComponents`)은 신규 프로덕션 로직이므로 이를 검증하는 테스트 추가는 범위 내. `deps 누락 회귀 가드` 케이스는 기존 테스트의 DI 대응 갱신이라 범위 내.
- 제안: 해당 없음.

### [INFO] `review/` 하위 아티팩트 3건 커밋 포함
- 위치: `review/code/2026/06/20/15_14_06/SUMMARY.md`, `review/code/2026/06/20/15_14_06/RESOLUTION.md`, `review/consistency/2026/06/20/14_21_32/SUMMARY.md`, `review/consistency/2026/06/20/14_21_32/_retry_state.json`
- 상세: 이전 ai-review 산출물(`15_14_06`)과 consistency-check 산출물(`14_21_32`)이 커밋에 포함됨. 프로젝트 규약(`CLAUDE.md`)상 `review/` 는 gitignore 대상이 아니고 SUMMARY/RESOLUTION 도 커밋 대상으로 명시(memory: plan 체크박스 = 실제 상태). 이 패턴은 의도된 워크플로의 일부.
- 제안: 해당 없음.

### [INFO] `plan/in-progress/refactor/README.md` 행 갱신
- 위치: `plan/in-progress/refactor/README.md`
- 상세: M-5 행의 "결정 대기" 상태를 "방향 확정 + 레이어1 착수"로 갱신하고, 카운터(✅ 5건→6건 / 대기 10건→9건)를 동기화. consistency-check W-PC1 대응이며 plan 정합 유지 목적의 변경 — 범위 내.
- 제안: 해당 없음.

## 요약

이번 변경은 M-5 레이어1(노드 등록 정적 배열 → DI 주입 전환)로 명확히 정의된 범위 안에 정확히 수렴한다. 신규 파일(카테고리 index 7개, `NodeComponentsModule`, spec 테스트)은 모두 설계 문서(D-1/D-2/D-3)가 명시한 구성 요소이며, `nodes/index.ts` 의 구조 재편과 `node-bootstrap.service.ts` 의 DI 전환은 주 변경 사항의 직접 구현이다. 관련 없는 파일 수정, 불필요한 리팩토링, over-engineering, 무관한 포맷팅 변경은 발견되지 않는다. `review/` 아티팩트와 `plan/README.md` 동기화는 프로젝트 규약에 의한 의무 수반 변경이다.

## 위험도

NONE

---
STATUS: SUCCESS
