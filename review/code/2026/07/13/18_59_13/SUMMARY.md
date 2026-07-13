# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 은 없으나, `onDrop` 통합 배선과 컨테이너 내부 체인 엣지 분할 시 `containerId` 전파를 검증하는 테스트가 없어(testing 리뷰 MEDIUM) 회귀 시 자동 검출이 안 되고, 여기에 더해 `architecture`/`user_guide_sync` 두 리뷰어가 `status=success` 로 보고됐음에도 output 파일이 디스크에 없어(disk-write gap) 두 관점의 실제 발견사항을 확인할 수 없는 커버리지 공백이 있다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 리뷰 커버리지(REVIEW-GAP) | `architecture`, `user_guide_sync` 리뷰어가 `ran` 목록에 `status=success` 로 보고됐으나 지정된 output 파일이 세션 디렉터리에 실제로 존재하지 않는다(`ls` 로 부재 확인, 세션 내 다른 경로·journal 에서도 복구 불가). 두 관점(아키텍처 영향, 유저가이드 동기화)의 실제 발견사항이 이번 통합 보고서에서 완전히 누락돼 있다 — "발견 없음" 이 아니라 "미확인" 이다 | `review/code/2026/07/13/18_59_13/architecture.md`, `.../user_guide_sync.md` (둘 다 부재) | 두 리뷰어를 재실행해 output 을 확보한 뒤 SUMMARY 를 갱신할 것. 그 전까지 아키텍처 영향·유저가이드 동기화 관점은 "위험 없음" 으로 간주하지 말 것(다만 `documentation`/`requirement`/`scope` 리뷰가 유저가이드 ko/en 갱신·spec 정합을 이미 부분적으로 교차 확인했으므로 완전한 사각지대는 아님) |
| 2 | 테스트 커버리지 | `onDrop` 의 실제 통합 배선(hit-test → `buildEdgeSplitPlan` → `removeEdge`+`onConnect`×2 시퀀스)을 실행하는 자동 테스트가 전혀 없다. 검증은 순수 헬퍼 단위테스트 + 코드 추론에만 의존하며, 라운드 1 CRITICAL(컨테이너 새 노드 body 재편입)이 바로 이 통합 지점 근방에서 나왔다는 점에서 배선 자체의 회귀(가드 순서 실수, id 오사용, skipUndo 누락 등)는 향후에도 테스트로 못 잡는다 | `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` `onDrop`(L706-744) | canvas RTL 하네스 없이도, `useEditorStore` 에 대해 `removeEdge(id,{skipUndo:true})`→`onConnect`×2 시퀀스를 그대로 재현하는 store-레벨 통합 테스트 추가("onConnect 2회 항상 성공, toast.error 미호출, 최종 edges 2개"를 assertion 으로 고정) |
| 3 | 테스트 커버리지 | 컨테이너 body 내부(경계 아닌) 평범한 체인 엣지를 분할할 때 `removeEdge`(전역 `deriveContainerAssignments` 재도출)와 `onConnect`×2(증분 `propagateContainerOnConnect`)조합을 거쳐 새 노드가 올바른 `containerId` 를 상속받는지 검증하는 테스트가 없다. 코드 추적상으로는 정상 동작하는 것으로 보이나 이를 잠그는 테스트가 없어 향후 리팩터가 조용히 깨뜨려도 검출 불가 | `codebase/frontend/src/lib/stores/editor-store.ts` `removeEdge`/`onConnect`, `edge-utils.ts` `buildEdgeSplitPlan` | `editor-store.test.ts` 에 "Loop 컨테이너 body 내부 체인 엣지 분할 시 새 노드가 containerId 를 상속한다" 통합 테스트 1건 추가(§1.3 재연결 테스트의 `deriveContainerAssignments` 검증 패턴 재사용 가능) |
| 4 | UX / 부작용 | `onDrop` 이 사전 시각 피드백 없이 "노드 추가" 의미를 "엣지 분할" 로 조용히 전환한다. `findEdgeIdAtPoint` 가 React Flow 엣지의 기본 20px 히트 폭을 그대로 재사용하므로, 사용자가 엣지 옆 빈 공간에 노드를 두려 해도 판정 폭 안이면 조용히 엣지가 분할될 수 있다. 드래그 중 하이라이트 등 예고 없음(밀집 캔버스에서 마찰 가능) | `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` `onDrop`(L714-737) | 필수 차단 사유는 아님(spec·유저가이드에 의도 동작으로 문서화됨). 드래그 중 커서 아래 엣지를 하이라이트하는 시각 프리뷰를 후속 개선으로 고려 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | 1회차 ai-review CRITICAL("컨테이너 새 노드 body 재편입")이 `buildEdgeSplitPlan` 의 `definition?.isContainer` 가드로 실제 해소됐음을 backend 노드 스키마(loop/foreach/map/parallel) 대조 + 회귀 테스트까지 재검증 완료 | `codebase/frontend/src/lib/utils/edge-utils.ts` `buildEdgeSplitPlan` | 조치 불요(확인 완료) |
| 2 | requirement | `spec/3-workflow-editor/2-edge.md` §4.1 + `## Rationale` R-3 의 서술 6개 항목이 코드(핸들 셋·조건 분기)와 line-level 로 정확히 일치 | `spec/3-workflow-editor/2-edge.md` §4.1/R-3 | 조치 불요 |
| 3 | documentation | 1회차 documentation WARNING 2건(유저가이드 §4.1 미서술, spec 자기참조 오독) + INFO 1건(테스트 개수 미표기) 모두 이번 diff 에서 해소 확인 | `connecting-nodes.mdx`/`.en.mdx`, `spec/3-workflow-editor/2-edge.md`, `CHANGELOG.md` | 조치 불요 |
| 4 | maintainability | `onDrop` 인라인 오케스트레이션이 점점 두꺼워지고 있음(이미 1회차 `RESOLUTION.md` #9 로 이월 추적 중) | `workflow-canvas.tsx` `onDrop` | 다음 유사 캔버스 드롭 기능 착수 시 `useNodeDropOnEdge` 류 전용 훅 추출 검토(지금 당장 불요) |
| 5 | side_effect | `removeEdge`→`onConnect`×2 는 store 원자 액션이 아닌 비트랜잭션 시퀀스 — 현재는 `buildEdgeSplitPlan` 게이트(경계 엣지 제외·컨테이너 신규노드 제외·자기연결/중복 구조적 불가)로 구성적으로 안전하나, `evaluateConnection` 에 신규 거부 규칙이 추가되면 게이트가 동반 갱신되지 않는 한 반쪽 그래프 재발 가능(구조적 부채) | `editor-store.ts` `evaluateConnection`/`detectContainerConflict`, `edge-utils.ts` `buildEdgeSplitPlan` | 향후 `evaluateConnection` 확장 PR 에서 이 불변식 재검토 필요성을 인지해 둘 것 |
| 6 | maintainability | 매직 스트링(`body`/`emit`/`.react-flow__edge`/`data-id`)·타입 중복(`SplitConnection` vs 기존 인라인 shape) 등은 스타일 nit 수준, 일부는 RESOLUTION.md 에 이미 이월 기록됨 | `edge-utils.ts` | 우선순위 낮음, 후속 정리 시 검토 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 순수 프런트엔드 상태 조작, 인젝션/인증/시크릿 표면 없음 |
| performance | NONE | 신규 로직은 전부 단발성 드롭 이벤트 내 O(1)~O(포트 수) 순수 함수, 실질 병목 없음 |
| architecture | **재확인 필요** | output 파일 부재(disk-write gap) — 미확인 |
| requirement | NONE | 1회차 CRITICAL 해소 재검증 완료, spec §4.1/R-3 코드와 line-level 일치 |
| scope | NONE | 33개 파일 전부 §4.1 기능 및 필수 프로세스 산출물에 정확히 귀속, 무관한 변경 없음 |
| side_effect | LOW | onDrop UX 조용한 전환(WARNING), evaluateConnection 확장 시 재검토 필요한 구조적 부채(INFO) |
| maintainability | LOW | onDrop 오케스트레이션 비대화·매직스트링 등 경미한 스타일 이슈, 대부분 이미 이월 추적 중 |
| testing | MEDIUM | onDrop 통합 배선 테스트 부재, 컨테이너 내부 체인 엣지 containerId 전파 통합 테스트 부재 |
| documentation | NONE | 1회차 WARNING 2건 전부 해소 확인, JSDoc·spec·CHANGELOG·RESOLUTION 상호 정합 |
| user_guide_sync | **재확인 필요** | output 파일 부재(disk-write gap) — 미확인(단, documentation 리뷰가 유저가이드 ko/en §4.1 절 신설을 교차 확인함) |

## 발견 없는 에이전트

security, performance, scope — 위험도 NONE, 실질 발견사항 없음(전부 확인/정상 판정).

## 권장 조치사항

1. `architecture`, `user_guide_sync` 리뷰어를 재실행해 output 을 확보하고 SUMMARY 를 갱신할 것(disk-write gap — 두 관점 미검증 상태로 남아있음).
2. `editor-store.test.ts` 에 "Loop 컨테이너 body 내부 체인 엣지 분할 시 containerId 상속" 통합 테스트 추가(라운드 1 CRITICAL 이 나온 근방 상호작용이라 투자 가치 높음).
3. store-레벨 통합 테스트로 `onDrop` 의 `removeEdge`→`onConnect`×2 시퀀스(원자성 불변식)를 assertion 으로 고정.
4. (선택) 드래그 중 커서 아래 엣지를 하이라이트하는 시각 프리뷰 후속 개선 검토.
5. (선택, 낮은 우선순위) `onDrop` 오케스트레이션을 전용 훅으로 추출, 매직스트링/타입 중복 정리 — 이미 이월 추적 중이므로 이번 라운드 차단 사유 아님.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync` (10명)
  - **제외**: 표 (4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing, user_guide_sync` (8명 — router 가 자체 판단으로 선택한 것은 `performance`, `architecture` 2명뿐이고 나머지 8명은 router_safety 가 강제 포함)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 신규 패키지/의존성 추가·변경 없음(프론트엔드 로컬 상태 로직만 변경) |
  | database | DB 스키마·쿼리·마이그레이션 변경 없음 |
  | concurrency | 서버 동시성 로직 변경 없음(클라이언트 단일 스레드 UI 상태 조작) |
  | api_contract | REST API·DTO·wire 계약 변경 없음(CHANGELOG 에 "백엔드·wire 무변경" 명시, side_effect 리뷰도 네트워크 호출 없음을 확인) |