# Rationale 연속성 검토 — `plan/in-progress/spec-draft-assistant-i18n-table-sync.md`

## 발견사항

없음 (CRITICAL/WARNING 없음).

검토 근거를 실측으로 하나씩 확인했다:

- **Principle 3-C 이중 중괄호 보간**: target 이 `{label}`→`{{label}}` 등 6곳을 바꾸는 근거로 든 `spec/conventions/i18n-userguide.md` Principle 3-C(115~124행)는 "frontend 템플릿은 기존 `core.ts` 의 `interpolate()` + `{{name}}` 이중 중괄호 컨벤션을 재사용한다 (신규 보간 문법 금지)"를 명시한다. target 은 이 기존 규약을 그대로 따르는 것이지 새 문법을 들여오는 것이 아니다.
- **글로서리 §2/§5 (엣지→연결선, 해요체)**: `codebase/frontend/src/content/docs/_glossary.md` §2 "Edge | 연결선 | "엣지" 금지", §5 "옵션 값을 넣어주세요 류 수동태 → 능동태" 를 그대로 인용하고 있고 지어낸 근거가 아니다.
- **사전 값 일치**: `codebase/frontend/src/lib/i18n/dict/{ko,en}/assistant.ts` 를 직접 확인한 결과 target 이 "바꿀 값"으로 제시한 13행 전부(`planQuestionsHint`·`autoResumedHint`·`autoResumedHintShort`·`errorNoLlmConfig`·`errorRateLimit`·`opAdded`·`opUpdated`·`opRemoved`·`edgeAdded`·`edgeRemoved`·`exploreLookup`·`exploreExecutionsList`·`exploreExecutionDetails`·`executionNotInScope`)가 실제 코드 값과 정확히 일치한다. "현재" 값으로 인용한 spec 표(727~763행)도 실제 파일과 라인 단위로 일치한다.
- **🔄 아이콘 분리 사실**: `assistant-message.tsx` L4(`import { … RotateCw } from "lucide-react"`), L160(`<RotateCw size={11} … aria-hidden="true" />`)이 텍스트(`t("assistant.autoResumedHint", …)`)와 별도 렌더됨을 확인 — target 의 "🔄 는 문자열이 아니라 아이콘" 주장은 정확하다. Rationale 1346행 정정도 "결정 서술이 아니라 렌더 모양의 사실 정정"이라고 스스로 명시해, 결정 번복이 아님을 인지하고 있다.
- **`change_summary` 비대상 처리**: `spec/3-workflow-editor/0-canvas.md` §8.1(526행)이 말하는 자동 생성이 실제로는 `workflows.service.ts` 의 버전 복원 경로(`Restored from v${version}`)에만 있고, 프론트는 `changeSummary` 필드를 저장 요청에 싣지 않음(그레핑 결과 프론트 쪽은 표시·타입 정의뿐)을 확인 — target 이 이를 "다른 결함"으로 분리해 트래커로 넘긴 판단이 타당하다. 이 문서를 고치지 않기로 한 것은 기존 R-3(자동저장 파기) 등 인접 Rationale 항목과도 무관해 충돌 없음.
- **선례 정합성**: target 이 취한 "spec 표를 실제 코드/사전에 맞춘다"는 방향은 이 문서 자체의 기존 Rationale(예: `WorkflowVersion.snapshot 구성 서술 정정`, `0-canvas.md` R-3 "구현을 옛 스펙에 맞추지 않음")과 저장소 커밋 이력(`3796c7308 docs(spec): 배선이 끝났으니 SoT 를 그 상태로 맞춘다`)에서 이미 확립된 패턴과 일치한다. 새로운 원칙을 만들거나 기존에 기각된 대안(예: `select: false` 재도입류)을 되살리는 사례는 발견되지 않았다.
- **표 완전성 미보증 주장**: target 이 "§13 표 머리말은 전수를 약속하지 않는다"고 적은 것도 실제로 §13 위 배너(729행)와 문서 전체를 grep(`전수|모든 키|빠짐없이|누락 없이`)해도 그런 완전성 invariant 가 없어 정확하다 — 존재하지 않는 규약을 어기고 있다는 오판을 방지한 서술이다.

## 요약
target 이 인용하는 모든 규약(Principle 3-C·Principle 6·글로서리 §2·§5)과 사전/코드 실측값을 직접 대조한 결과 전부 일치했고, 취한 "spec 을 사전에 맞춘다"는 방향은 같은 문서·인접 문서에 이미 여러 차례 기록된 선례(WorkflowVersion.snapshot 정정, 0-canvas R-3, `#1318` SoT 정합 커밋)와 동일한 패턴이다. Rationale 1346행 정정은 스스로 "결정 번복이 아니라 사실 정정"임을 명시해 무근거 번복 우려를 사전에 해소했고, 범위 밖 항목(사전 키 3종·`change_summary` 자동생성 미구현·기존 WARNING들)은 근거를 들어 트래커로 명확히 분리했다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, 암묵적 invariant 우회 — 네 관점 모두에서 문제되는 지점을 찾지 못했다.

## 위험도
NONE
