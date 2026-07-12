# Cross-Spec 일관성 검토 — `spec/4-nodes/7-trigger/1-manual-trigger.md` (저장 시점 파라미터 스키마 검증 추가)

## 검토 방법

target 문서(`spec/4-nodes/7-trigger/1-manual-trigger.md`)의 실제 diff(`git diff HEAD~1`)를 확인한 뒤, 같은 커밋 세트에 포함된 동반 변경(`spec/5-system/3-error-handling.md`, `spec/data-flow/10-triggers.md`, `spec/data-flow/11-workflow.md`)과, diff 밖의 인접 영역(`spec/4-nodes/7-trigger/0-common.md`, `spec/3-workflow-editor/0-canvas.md`, `spec/3-workflow-editor/3-execution.md`, `spec/3-workflow-editor/5-version-history.md`, `spec/conventions/cross-node-warning-rules.md`, `spec/conventions/node-output.md`, `spec/5-system/2-api-convention.md`, `spec/1-data-model.md`)를 대조했다.

## 발견사항

- **[INFO]** `0-common.md` §1 공통 계약 표가 신규 저장 시점 구조 게이트를 반영하지 않음
  - target 위치: `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 신규 문단("저장 시점 발행 경로") 및 Rationale
  - 충돌 대상: `spec/4-nodes/7-trigger/0-common.md` §1 "트리거 진입 파라미터 공통 계약" 표 (Manual 행: "Execution 생성 전 400 응답 또는 RUNNING 진입 즉시 실패")
  - 상세: target 은 Manual Trigger 의 구조적 스키마 위반(`invalid_schema`)이 이제 **저장 시점**(`POST /:id/save`)에서도 `400 INVALID_TRIGGER_PARAMETERS` 로 선제 차단됨을 신설했다. 그러나 0-common.md 의 공통 계약 표는 여전히 "실행 실패 시점"만 열거하고 저장 시점 게이트를 언급하지 않는다. 모순은 아니다 — 표가 다루는 축(런타임 실패 시점)과 target 이 추가한 축(저장 시점 구조 검증)이 달라 직접 충돌은 없지만, 0-common.md 가 세 트리거의 "공통 계약"을 다루는 진입 문서이므로 완전성 관점에서 누락이다.
  - 제안: 급하지 않음(비차단). 후속 편집 시 0-common.md §1 표 또는 각주에 "구조 위반은 저장 시점에도 차단(§Manual Trigger §6)"을 1줄 추가해 동기화 권장.

- **[INFO]** `0-canvas.md` §8 저장 API 실패 모드 미문서화
  - target 위치: `spec/4-nodes/7-trigger/1-manual-trigger.md` Rationale ("사용자 편집 저장(`POST /:id/save`)은 ... `400 INVALID_TRIGGER_PARAMETERS` 로 즉시 거부")
  - 충돌 대상: `spec/3-workflow-editor/0-canvas.md` §8 "저장" (Save 버튼 비활성 조건 = "미저장 변경이 없거나 그래프 오류(hasError)가 있으면") 및 §8 "실행 직전 자동 저장"(Run 시 `isDirty` 면 저장 선행)
  - 상세: `hasError` 는 `evaluateGraphWarningsLocal`(`cross-node-warning-rules.md`)의 로컬 평가 결과이며, Manual Trigger 파라미터 스키마 구조 위반은 graphWarningRule 이 아니라 별도의 서비스 계층 DTO 검증(`validateManualTrigger`)이다. 즉 이 위반이 있어도 프런트 Save/Run 버튼은 비활성화되지 않고, 서버 400 응답으로만 드러난다. 특히 "실행 직전 자동 저장"(Run 클릭 시 `isDirty` 인 상태에서 무관한 편집 후 저장)이 이 신규 게이트에 걸려 실패할 수 있다는 실패 모드를 `0-canvas.md`/`3-execution.md` 어디에도 명시하지 않는다. 모순은 아니지만(두 문서 모두 이 케이스를 부정하지 않음), 신규 실패 표면이 워크플로우 에디터 영역 문서에 반영되지 않은 정보 공백이다.
  - 제안: 비차단 INFO. 필요 시 `3-execution.md` Run 흐름 또는 `0-canvas.md` §8 에 "저장 시 Manual Trigger 파라미터 스키마 위반이면 400 (Run 경로도 동일)"을 1줄 추가.

- **[INFO]** `1-data-model.md` §2.6 Node.type 목록에 `trigger`/`manual_trigger` 행 부재 (target 과 무관한 기존 갭)
  - target 위치: (해당 없음 — target 자체는 이 표를 참조/수정하지 않음. Manual Trigger 노드가 `Node.type='manual_trigger'`, `category='trigger'` 임을 전제로 서술)
  - 충돌 대상: `spec/1-data-model.md` §2.6 "Node.type 전체 목록" 표 — logic/flow/ai/integration/data/presentation 6개 category 만 행으로 나열되고 `trigger` category(`manual_trigger`)행이 없다. 같은 문서 §2.6 제약조건 절엔 `manual_trigger` 가 텍스트로 언급되고(container_id 불가 규칙), Node.category enum 서술에도 "trigger 는 V003 에서 추가"라고 명시돼 있어 값 자체는 존재를 인정하지만 목록 표에서만 누락됐다.
  - 상세: target 문서(Manual Trigger spec)가 의존하는 카탈로그성 정의가 SoT 문서에서 표 형태로 완비되지 않은 상태 — target 의 변경으로 생긴 문제는 아니고 이번 diff 범위 밖의 pre-existing 갭이다.
  - 제안: 이번 plan 범위 밖. 별도 spec 정리 항목으로 트래킹 권장(이번 저장-시점 plan 과 결합해 고칠 필요는 없음).

## 요약

target 문서의 이번 변경(Manual Trigger 파라미터 스키마 구조 위반의 저장 시점 `400 INVALID_TRIGGER_PARAMETERS` 게이트 신설 및 `restoreVersion` skip 비대칭 문서화)은 동반 수정된 `spec/5-system/3-error-handling.md`(§1.7 각주) · `spec/data-flow/10-triggers.md`(§1.1 각주) · `spec/data-flow/11-workflow.md`(저장 시퀀스 다이어그램)와 정확히 정렬돼 있으며, 에러 봉투 형식(`spec/5-system/2-api-convention.md §5.3`)·필드 코드 override 원칙·`RESERVED_VARIABLE_NAME` 의 기존 `skipLegacyDataGates` 선례(`error-handling.md` §1.3)와도 일관된다. `cross-node-warning-rules.md` 의 별도 `GRAPH_VALIDATION_FAILED` 게이트와도 트랜잭션 전/후 순서가 명확히 분리돼 있어 두 400 계열 검증이 충돌하지 않는다. CRITICAL/WARNING 급 모순은 발견되지 않았고, 인접 영역(0-common.md 공통 계약 표, workflow-editor 의 Save/Run 실패 모드 문서, data-model.md 의 Node.type 카탈로그 완비성) 쪽에 3건의 비차단 INFO 수준 동기화 권고만 존재한다.

## 위험도
LOW
