# 정식 규약 준수 검토 — spec/3-workflow-editor/

검토 대상: `spec/3-workflow-editor/0-canvas.md` · `1-node-common.md` · `2-edge.md` · `3-execution.md`
대조 규약: `spec/conventions/**` (error-codes.md · node-output.md · node-cancellation.md · execution-context.md ·
interaction-type-registry.md · i18n-userguide.md · spec-impl-evidence.md · swagger.md · cross-node-warning-rules.md ·
audit-actions.md 등), CLAUDE.md 명명 컨벤션, `.claude/skills/project-planner/SKILL.md` 문서 구조 규칙.

## 발견사항

- **[INFO]** 미설정 경고 메시지 표의 i18n 처리 상태 미표기
  - target 위치: `spec/3-workflow-editor/0-canvas.md` §5.3.2 "노드별 미설정 경고 메시지" 표 (예: `⚠ Condition not set`)
  - 위반 규약: `spec/conventions/i18n-userguide.md` Principle 3 (백엔드 발행 `warningRules[].message` 는 영문 SoT + frontend `WARNING_KO` 매핑 의무)
  - 상세: 해당 표의 메시지들은 §5.3.5 에서 서술하는 `warningRules`/`warnWhen` DSL(스키마 레벨, backend 발행)에서 나온 문자열로 보이는데, 같은 문서 `2-edge.md` §2.2 는 유사한 사용자 가시 토스트(`"already connected"`)에 대해 "(영문 SoT, 표시 계층 로컬라이즈)" 주석을 명시적으로 달아 i18n-userguide Principle 3 준수를 문서상으로 드러낸 반면, 0-canvas.md §5.3.2 표는 그런 주석이 없어 이 메시지들이 `WARNING_KO` 매핑 대상인지 spec 본문만으로는 판단하기 어렵다.
  - 제안: `2-edge.md` §2.2 와 동일한 패턴으로 "(영문 SoT, `WARNING_KO` 매핑)" 류의 짧은 주석을 표 상단에 추가하면 문서 내 일관성이 높아진다. 실제 구현이 이미 이 규약을 지키고 있다면 spec 표기만 보강하면 되는 낮은 비용의 개선이다.

- **[INFO]** 컨테이너 노드 삭제 버튼 `aria-label="warning"` 의 dict 경유 여부 미언급
  - target 위치: `spec/3-workflow-editor/0-canvas.md` §5.3.2 "표시" 행 — `aria-label="warning"`
  - 위반 규약: `spec/conventions/i18n-userguide.md` Principle 1 ("영문 fallback / accessibility-only 문자열도 동일하게 dict 경유를 우선한다")
  - 상세: Principle 1 은 이 케이스를 강제(❌ 금지)가 아니라 권고("우선한다")로 다루므로 CRITICAL/WARNING 급 위반은 아니다. 다만 spec 이 하드코딩된 영문 리터럴처럼 보이는 값을 그대로 명세해 두어, 실제 구현이 dict 키를 경유하는지 spec만으로는 확인할 수 없다.
  - 제안: 별도 조치 불필요(권고 조항). 후속 spec 갱신 시 dict 키 경유 여부를 한 줄 덧붙이면 추적성이 좋아진다.

## 검토했으나 위반 없음으로 확인된 항목 (참고용)

- **에러 코드 명명** (`CONTAINER_INVALID_CHILD` / `CONTAINER_CYCLE` / `CONTAINER_MISSING_EMIT` / `CONTAINER_MULTIPLE_EMIT` / `INVALID_STATE` / `DUPLICATE_NAME`): 전부 `UPPER_SNAKE_CASE` + 의미 기반 명명으로 `spec/conventions/error-codes.md` §1 준수. `DUPLICATE_NAME`/`INVALID_STATE` 는 시스템 전역 공용 코드 범주(§1 의 `VALIDATION_ERROR` 와 동류)로 prefix 없음이 예외 위반이 아니다.
- **`.config.*` vs `.output.*` 직교성** (`1-node-common.md` §3.2, §2.4 `errorHandling` 저장 형태): `spec/conventions/node-output.md` Principle 1.1 / Principle 7 (config raw echo vs output evaluated) 과 정확히 일치.
- **동적 포트 ID / 시스템 포트 예약어** (`1-node-common.md` §1.2, §1.3, §1.5): `node-output.md` Principle 6 의 예약어(`out`/`error`/`done`/`user_ended`/`max_turns`/`completed`/`fallback`/`continue`) 및 `<prefix>_<index>` 패턴과 정합.
- **금지 patterns 미사용**: `output.view` / `output.metadata.*` / `output.submittedData` / `output.previousOutput` / `output.output.*` 등 `node-output.md` §1.1.4·§4.2·§8.1 에서 명시적으로 폐기된 패턴이 대상 문서 4개 어디에도 등장하지 않음.
- **`execution.node.cancelled` 이벤트** (`3-execution.md` §8.1): `spec/conventions/node-cancellation.md` §5.1 의 WS 이벤트 계약과 일치.
- **`interactionType: form/buttons/ai_conversation` (3값)** (`3-execution.md` §8.1): `spec/conventions/interaction-type-registry.md` §1.1 이 "내부 4값(ai_form_render 포함) vs 외부/문서 관점 3값은 모순이 아니다" 라고 명시적으로 해소해 둔 케이스 — 위반 아님.
- **REST API 명명** (`3-execution.md` §9): `PUT` 미사용(전부 GET/POST/PATCH/DELETE), kebab-case 리소스(`test-datasets`), `PATCH /api/test-datasets/:id` 등 `5-system/2-api-convention.md` §2.2·§3 과 정합. `POST /api/workflows/:id/nodes/:nodeId/execute` 의 3단 중첩·action 명명은 문서 자체의 §Rationale R-1.3 이 "api-convention §2.2 단일 동사 action 패턴(`/execute`·`/stop` 선례)" 을 근거로 명시 — 자기 정당화된 설계로 위반 아님.
- **문서 구조 (Overview/본문/Rationale)**: 4개 문서 모두 `## Rationale` 섹션 보유. `## Overview` 전용 섹션은 없으나 이는 `.claude/skills/project-planner/SKILL.md` §명명 컨벤션 "다중 spec 파일을 가진 영역은 `_product-overview.md` 별도 파일" 규칙과 일치 — `spec/3-workflow-editor/_product-overview.md` 가 실존하며 각 문서 상단이 이를 참조링크로 명시.
- **파일 명명**: `0-canvas.md`~`3-execution.md` 는 `N-name.md` 패턴, `_product-overview.md` 는 `_` prefix 패턴 — CLAUDE.md·SKILL.md 명명 컨벤션과 일치.
- **frontmatter (`spec-impl-evidence.md`)**: 4개 문서 모두 `id`/`status`/`code:` 보유. `status: partial` 인 `0-canvas.md`·`2-edge.md` 는 `pending_plans:` 를 갖추었고, 기재된 4개 plan 경로(`ai-agent-tool-connection-rewrite.md`·`spec-sync-canvas-gaps.md`·`spec-sync-edge-gaps.md`) 모두 `plan/in-progress/` 에 실존 확인. `code:` glob 경로 표본 점검(10개) 전부 실제 파일/디렉토리 존재 확인.
- **cross-doc 정합**: `0-canvas.md` §Rationale R-4 가 "컨테이너 중첩 깊이 제한 미도입 확정" 을 선언하며 `spec/conventions/cross-node-warning-rules.md §9` 갱신을 요구한 부분이, 실제로 해당 문서 §9 에 취소선 + "미도입 확정" 주석으로 정확히 반영되어 있음을 확인 — 정합.

## 요약

`spec/3-workflow-editor/` 의 대상 4개 문서(`0-canvas.md`·`1-node-common.md`·`2-edge.md`·`3-execution.md`)는 `spec/conventions/**` 의 명명·출력 포맷·문서 구조·API 규약을 폭넓게 준수하고 있다. 에러 코드 명명(UPPER_SNAKE_CASE + 의미 기반), 노드 output 5필드/config-output 직교성/포트 예약어(node-output.md), cancellation WS 이벤트(node-cancellation.md), interactionType 3값/4값 관점 차이(interaction-type-registry.md), REST 엔드포인트 명명(api-convention.md, 자체 Rationale 로 근거 명시), frontmatter lifecycle(spec-impl-evidence.md), 파일·디렉토리 명명(CLAUDE.md/SKILL.md) 모두에서 위반이 발견되지 않았다. 특히 각 문서가 규약 위반 가능성이 있는 지점(예: 3단 중첩 API 경로, interactionType 내부/외부 값 차이, cross-node-warning-rules 동기화)을 스스로 Rationale 로 선제 정당화해 둔 점이 인상적이다. 유일하게 지적할 만한 부분은 `0-canvas.md` §5.3.2 의 사용자 가시 경고 메시지 표가 i18n-userguide.md Principle 3 의 "영문 SoT + WARNING_KO 매핑" 처리 여부를 명시하지 않아, 같은 문서군 내 `2-edge.md` 의 명시적 주석 관행과 비교했을 때 표기 일관성이 다소 떨어진다는 점이다 — 이는 문서 표기 보강 수준의 INFO 사안이며 구조적 위반은 아니다.

## 위험도

LOW
