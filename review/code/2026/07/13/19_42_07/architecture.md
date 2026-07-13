### 발견사항

- **[WARNING]** 엣지 분할(split) 원자성 보장이 두 파일에 흩어진 암묵적 대응 관계(JSDoc 상호 참조)에만 의존 — 단일 진실(SoT) 부재
  - 위치: `spec/3-workflow-editor/2-edge.md` §4.1 "연결·불변식(원자성)" 단락(라인 ~1109) 및 `## Rationale` R-3 "커플링 주의" 단락(라인 ~1209, diff 상 `+`)
  - 상세: 문서 자체가 명시하듯, `buildEdgeSplitPlan`(가칭 `edge-utils.ts`)이 두 신규 Connection 을 항상 `onConnect` 성공시킬 수 있다는 원자성 보장은 `detectContainerConflict`(`editor-store.ts`)의 거부 분기가 "source `body` / target `emit`" 두 가지뿐이라는 사실과, `buildEdgeSplitPlan` 이 그 두 핸들을 낀 엣지·컨테이너형 신규 노드를 분할 대상에서 제외한다는 사실이 **정확히 대응**해야 성립한다. 이 대응 관계는 컴파일러/런타임이 강제하지 않고 "양쪽 JSDoc 에 상호 forward-pointer 기록"이라는 사람의 주의(리뷰 프로세스)에만 의존한다. 서로 다른 두 모듈(store 계층의 검증 로직 vs 유틸 계층의 계획 수립 로직)이 같은 불변식을 각자 하드코딩하는 전형적인 **hidden coupling / 반복된 진실(SoT 미분리)** 패턴이라, `detectContainerConflict` 에 신규 거부 분기가 추가되고 `buildEdgeSplitPlan` 갱신이 누락되면 "removeEdge 후 onConnect 반쪽 실패"로 인한 그래프 손상이 조용히 재발할 수 있다. (참고: 같은 종류의 SoT 상수 패턴이 이미 backend `shadow-workflow.ts` 의 `CONTAINER_LOOPBACK_PORTS` 로 존재해, 유사 접근을 frontend 쪽에도 적용할 전례가 있다.)
  - 제안: "분할 제외/거부 대상 핸들 집합"(현재 `{source: 'body', target: 'emit'}`)을 `edge-utils.ts` 에 단일 명명 상수로 추출해 `detectContainerConflict` 와 `buildEdgeSplitPlan` 양쪽이 그 상수를 import 하도록 통합하면, 문서상 "주의" 수준의 결합을 코드 레벨 의존성으로 바꿔 drift 를 원천 차단할 수 있다. (실제 소스 diff가 이번 review payload 에 포함돼 있지 않아, 이미 그렇게 구현돼 있다면 본 항목은 기각 가능 — spec 문구의 "커플링 주의" 서술만으로는 상수 추출 여부를 확인할 수 없어 WARNING 으로 표기.)

- **[INFO]** undo 체크포인트 중복 push 버그는 "계층마다 개별적으로 pushUndo 를 호출"하는 설계의 구조적 재발 패턴
  - 위치: `spec/3-workflow-editor/2-edge.md` `## Rationale` R-3 "undo 단일 체크포인트 실측 보강(ai-review 3회차)" 단락(라인 ~1211, diff 상 `+`)
  - 상세: 문서에 따르면 `buildAndAddNode`(래퍼)가 자체 `pushUndo` 를 호출하는데, 그 안에서 위임하는 `addNode`(store 액션)도 독립적으로 `pushUndo` 를 호출해 노드 삽입 1회가 undo 스냅샷 2개를 쌓던 결함이 이번 changeset 3회차 리뷰에서 발견·수정됐다. 문서는 이 결함이 §1.2(빈 영역 드롭 자동연결)에도 동일하게 존재했음을 자인한다. 즉 undo 경계 관리가 "각 함수가 자신의 책임만큼 pushUndo 를 부른다"는 방식으로 호출 체인 여러 계층에 분산돼 있어, 새로운 복합 액션(여러 store 호출을 사용자 입장에서 1회 동작으로 묶는 패턴)을 추가할 때마다 유사한 이중 push 버그가 재발하기 쉬운 구조다. 이번엔 리뷰로 잡혔지만, 재발 방지가 리뷰어 주의력이 아니라 설계 자체에 내장돼 있지 않다.
  - 제안: 개별 함수가 각자 `pushUndo`/`skipUndo` 를 챙기는 대신, 복합 액션을 감싸는 상위 헬퍼(예: `withUndoCheckpoint(fn)` — 실행 중 하위 호출의 pushUndo 를 억제하고 종료 시 1회만 커밋)로 undo 경계를 중앙화하면 이 버그 클래스를 구조적으로 예방할 수 있다. 차단 사유는 아니며, 향후 유사 복합 액션이 늘어날 것을 대비한 참고 제안.

- **[INFO]** 레이어 분리(R-2) 원칙이 올바르게 재사용됨 — 확인, 조치 불요
  - 위치: `spec/3-workflow-editor/2-edge.md` §4.1 첫 단락(라인 ~1103)
  - 상세: DOM/뷰포트 의존 hit-test(`findEdgeIdAtPoint`)는 canvas 컴포넌트(`workflow-canvas.tsx` `onDrop`) 쪽에, 프레임워크 비의존 순수 판정/조립 로직(`buildEdgeSplitPlan`)은 `edge-utils.ts` 에 배치한 것은 `0-canvas.md` R-2("뷰포트/RF 의존 로직을 store 에 두지 않는 계층 분리")를 그대로 재사용한 것으로, 이번 §4.1 신규 기능이 기존 아키텍처 경계를 깨지 않고 확장됐음을 확인했다.

- **[INFO]** 신규 기능 스코프를 "plain 엣지 + 입출력 보유 노드"로 좁힌 결정(R-3 대안 c)은 안전하지만 기존 불변식과의 재사용 관계가 §4.1 본문에서 한 방향으로만 링크됨
  - 위치: `spec/3-workflow-editor/2-edge.md` R-3 본문(라인 ~1205) vs §4.1 "컨테이너 경계 엣지 제외"/"컨테이너 새 노드 제외" 항목(라인 ~1107-1108)
  - 상세: 컨테이너 경계 엣지·컨테이너형 신규 노드를 분할 대상에서 제외해 기존 §6 emit 단일성·§11.2.1 containerId 동기화 불변식을 건드리지 않는 설계는 확장 리스크를 최소화하는 합리적 트레이드오프다(YAGNI). R-3 는 §4.1 을 참조하지만, §4.1 본문에는 "왜 지금 컨테이너 경계를 지원하지 않는지 / 나중에 확장 시 무엇을 재설계해야 하는지"에 대한 R-3 역참조가 없어, 향후 이 기능을 확장하려는 개발자가 Rationale 섹션까지 내려가 읽지 않으면 설계 배경을 놓칠 수 있다.
  - 제안: 차단 사유 아님. §4.1 "컨테이너 경계 엣지 제외" 항목 옆에 "(스코프 배경: R-3)" 각주를 추가하면 탐색성이 좋아진다.

- **[INFO]** (참고, 코드베이스 아키텍처와 무관) convention-compliance 서브에이전트 prompt payload 번들링 순서 결함은 이미 별도 트래킹됨
  - 위치: `review/consistency/2026/07/13/18_06_53/convention_compliance.md` "검토 방법" 단락 및 WARNING 항목
  - 상세: `spec/conventions/**` 번들이 알파벳 순으로(무관한 `cafe24-api-catalog/**` 우선) 채워지다 크기 한도로 조기 절단되어 실제 관련 규약 파일이 누락된 절차 결함이다. 이는 이번 changeset 의 코드베이스 아키텍처 문제는 아니고 orchestrator 스크립트(harness 도구)의 콘텐츠 선정 로직 문제이지만, "관련도 우선순위와 나열 순서를 분리하지 못한" 설계 관점에서는 동일한 종류의 이슈(우선순위 없는 그리디 채움)다. 이미 해당 리포트에서 WARNING 으로 자체 포착·우회 완료했고 개선 권고도 남겼으므로 본 리뷰에서는 중복 차단 사유로 재기표하지 않는다.

### 요약

이번 changeset 의 실질 아키텍처 대상은 `spec/3-workflow-editor/2-edge.md` §4.1(엣지 분할/mid-insert) 신설과 R-3 Rationale 이다. 레이어 분리(hit-test는 canvas seam, 순수 판정은 edge-utils.ts)와 기존 `onConnect` 표준 경로 재사용은 R-2 원칙을 잘 따르고 있고, 컨테이너 경계·컨테이너형 노드를 스코프에서 제외해 기존 §6/§11.2.1 불변식을 보존한 설계 결정(R-3)도 합리적이다. 다만 그 원자성 보장이 `detectContainerConflict`(editor-store.ts)와 `buildEdgeSplitPlan`(edge-utils.ts) 두 파일에 흩어진 암묵적 대응 관계(사람이 관리하는 JSDoc 상호참조)에만 의존해 향후 한쪽만 변경되면 조용히 깨질 수 있는 hidden-coupling 리스크가 있고(WARNING), undo 체크포인트 중복 push 버그가 이번 changeset 내에서도 재발했던 사실(§1.2 와 공유)은 undo 경계 관리가 계층별로 분산돼 있어 구조적으로 반복되기 쉬운 설계임을 시사한다(INFO). 두 항목 모두 즉시 차단할 사유는 아니며, 리뷰 리포트(consistency-check)에서 이미 지적된 사항이 spec 문서에 잘 반영돼 CRITICAL 급 아키텍처 결함은 없다.

### 위험도

LOW
