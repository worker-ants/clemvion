### 발견사항

- **[CRITICAL]** i18n 키 표에 금지어 "엣지" 사용 + 실제 구현과 불일치
  - target 위치: `spec/3-workflow-editor/4-ai-assistant.md` §13 "i18n 키" 표, 768~769행 (`assistant.edgeAdded` → "엣지 추가", `assistant.edgeRemoved` → "엣지 삭제")
  - 위반 규약: `spec/conventions/i18n-userguide.md` Principle 6 (글로서리·문체) — "금지어 (예: "엣지" → "연결선" ...) 사용 금지"는 UI 사용자 가시 한국어 문자열에 적용됨. 글로서리 SoT(`codebase/frontend/src/content/docs/_glossary.md`)도 "Edge | 연결선 | "엣지" 금지"를 명시.
  - 상세: 본 표는 dict 키 `assistant.edgeAdded`/`edgeRemoved`의 한국어 값을 규정하는 자리인데 금지어 "엣지"를 그대로 쓰고 있다. 실제 구현(`codebase/frontend/src/lib/i18n/dict/ko/assistant.ts:43-44`)은 이미 규약대로 `"연결선 추가"`/`"연결선 삭제"`를 쓰고 있어, spec 표가 코드보다 뒤처지고 동시에 금지어를 담고 있는 이중 결함이다. 이 표를 근거로 재구현하거나 회귀 검토를 하면 금지어가 되살아난다.
  - 제안: 표의 두 행을 "연결선 추가" / "연결선 삭제"로 정정해 코드·글로서리와 일치시킨다.

- **[WARNING]** 같은 i18n 키 표 안에서 보간(interpolation) 문법이 두 가지로 혼재
  - target 위치: `spec/3-workflow-editor/4-ai-assistant.md` §13, 765~772행 (`assistant.opAdded`/`opUpdated`/`opRemoved`/`exploreLookup`/`exploreExecutionsList`/`exploreExecutionDetails`)
  - 위반 규약: `spec/conventions/i18n-userguide.md` Principle 3-C — "frontend 템플릿은 기존 `core.ts` 의 `interpolate()` + `{{name}}` 이중 중괄호 컨벤션을 재사용한다 (신규 보간 문법 금지)". 같은 표의 다른 행들(`turnCompletedHint`·`autoResumedHint`·`candidatePickerTitle` 등)과 실제 코드(`dict/ko/assistant.ts`·`dict/en/assistant.ts`)는 모두 `{{label}}`/`{{count}}`/`{{nodeCount}}` 이중 중괄호를 쓴다.
  - 상세: 위 6개 행만 `{label}`/`{count}`/`{nodeCount}` 단일 중괄호로 적혀 있어 표 내부적으로 비일관적이고, 실제 값과도 다르다. 문서를 그대로 새 키 작성 템플릿으로 삼으면 `interpolate()`가 치환하지 못하는 깨진 문자열이 만들어진다. 덧붙여 `assistant.executionNotInScope`(773행) 예시문 "이 실행은 현재 **워크플로**의 것이 아니에요"도 실제 값("워크플로**우**")·글로서리 표기("Workflow → 워크플로우")와 다르다.
  - 제안: 6개 행의 중괄호를 이중 중괄호로, `executionNotInScope` 텍스트를 "워크플로우"로 정정.

- **[WARNING]** `change_summary` 예시 문자열에 금지어 "엣지" 사용
  - target 위치: `spec/3-workflow-editor/0-canvas.md` §8.1, 526행 — "버전에는 자동 생성된 `change_summary` 포함 (예: "노드 3개 추가, 엣지 2개 수정")"
  - 위반 규약: `spec/conventions/i18n-userguide.md` Principle 6 (금지어 "엣지" → "연결선")
  - 상세: `change_summary`는 Version History 패널에 "변경 요약"으로 그대로 노출되는 사용자 가시 문자열이다(`5-version-history.md` §3). 동일 개념(엣지 추가/삭제)의 실제 UI 문자열은 이미 "연결선"을 쓰고 있어(`dict/ko/assistant.ts` `edgeAdded`/`edgeRemoved`), 이 예시가 구현 가이드로 읽히면 금지어가 재도입될 소지가 있다.
  - 제안: 예시를 "노드 3개 추가, 연결선 2개 수정"으로 정정.

- **[WARNING]** `5-version-history.md` 에 `## Rationale` 섹션 부재
  - target 위치: `spec/3-workflow-editor/5-version-history.md` 전체 (§1~§9로 끝나며 Rationale 없음)
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` — "각 spec 문서는 3섹션 (Overview / 본문 / Rationale)" 권장. `CLAUDE.md`도 "Spec 문서 3섹션 구성"을 각 SKILL.md 참고로 명시.
  - 상세: 같은 디렉터리의 형제 문서(`0-canvas.md`·`1-node-common.md`·`2-edge.md`·`3-execution.md`·`4-ai-assistant.md`)는 모두 `## Rationale` 섹션을 갖고 있어 이 문서만 예외다. 문서 안에 이미 근거를 요구할 만한 결정들(예: §7.1 목록 응답에서 `snapshot` 필드 제외 — "m-3", §6 복원 후 페이지 리로드 이유)이 산문으로 흩어져 있어 Rationale로 응집할 근거가 충분하다. 다만 이 구조는 "권장"이며 `4-nodes/1-logic/`의 단순 노드 문서들처럼 Rationale 없이 남기는 선례도 존재해 강제 위반은 아니다.
  - 제안: 결정 배경(목록 응답 필드 제외 이유, 페이지 리로드 채택 이유 등)을 모아 `## Rationale` 섹션으로 분리하거나, 의도적 생략이면 그 사실을 명시.

- **[INFO]** `5-version-history.md` frontmatter `id` 가 형제 문서 패턴과 다름
  - target 위치: `spec/3-workflow-editor/5-version-history.md` 2행 (`id: workflow-version-history`)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 — "`id`: 파일 basename(확장자 제외) 기반 권장. 같은 basename 이 영역을 달리해 중복될 때는 후발 문서가 영역 prefix 로 충돌을 회피"
  - 상세: 형제 문서들은 숫자 접두를 뗀 basename을 그대로 `id`로 쓴다(`0-canvas.md`→`canvas`, `2-edge.md`→`edge`, `3-execution.md`→`execution`, `4-ai-assistant.md`→`ai-assistant`). 같은 규칙이면 `5-version-history.md`는 `version-history`가 되어야 하는데 `workflow-` 접두가 붙어 있다. 저장소 전체를 grep한 결과 `id: version-history` 충돌은 없어(`nav-agent-memory`류 충돌 회피 사례와 달리) 접두를 붙일 문서화된 이유가 보이지 않는다. 이 규칙은 "권장"이고 어떤 빌드 가드도 `id`-basename 일치를 강제하지 않아(spec-frontmatter 테스트에 해당 검증 없음) 실질 위험은 낮다.
  - 제안: 의도된 명명(예: `execution-history`와의 구분 목적)이면 그 사유를 frontmatter 인접 주석이나 Rationale에 남기고, 아니면 `version-history`로 정정.

### 요약
`spec/3-workflow-editor/` 는 frontmatter 스키마(`id`/`status`/`code`/`pending_plans`)·문서 구조(`_product-overview.md`·`0-` 접두)·에러 코드 명명(`UPPER_SNAKE_CASE`)·cross-node warning rule·interaction-type 4↔3값 관점 차이 등 대부분의 정식 규약을 잘 따르고 있으며, `code:`/`pending_plans:` 경로도 실존을 확인했다. 다만 §13 i18n 키 표와 §8.1 예시 문자열에서 글로서리 금지어 "엣지"가 실제 구현(이미 "연결선"으로 수정됨)과 어긋난 채 남아 있고, 같은 표 안에서 보간 문법(`{{ }}` vs `{ }`)이 혼재하는 등 i18n-userguide.md 규약을 정면으로 위반하는 구체적 drift가 발견됐다. 이는 문서만의 문제가 아니라 이 spec을 참조해 재구현·리뷰할 경우 이미 고쳐진 금지어·문법이 되살아날 수 있는 실질적 위험이다. 그 외에는 `5-version-history.md`의 Rationale 섹션 부재, `id` 명명 이탈 등 경미한 구조적 지적에 그친다.

### 위험도
MEDIUM
