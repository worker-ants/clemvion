# 정식 규약 준수 검토 — `spec/5-system/4-execution-engine.md`

## 검토 범위

- target: `spec/5-system/4-execution-engine.md` (1593줄, frontmatter `id: execution-engine`, `status: partial`)
- 대조 대상: `spec/conventions/**` 전수 확인 — 특히 `node-output.md`(§0/1/1.1/4/4.1–4.5/5/7/9), `error-codes.md`, `node-cancellation.md`, `execution-context.md`, `spec-impl-evidence.md`, `interaction-type-registry.md`, `swagger.md`.
- CLAUDE.md 의 문서 구조(Overview/본문/Rationale)·frontmatter·명명 규칙도 함께 확인.

## 발견사항

- **[WARNING] `interaction.data` payload 표가 인용한 CONVENTIONS §4.5 원본과 불일치 (`form_submitted` 행)**
  - target 위치: §1.3 "`interaction.data` payload 규격 (CONVENTIONS §4.5)" 표 (파일 내 약 203~210번째 줄 부근, `## 1.3 블로킹/재개 컨트랙트` 절 하단)
  - 위반 규약: `spec/conventions/node-output.md` §4.5 "interaction.data payload 규격" 표
  - 상세: target 표는 `form_submitted` 의 `data` 형태를 `{ [fieldName]: value }`, 적용 노드를 `form` 단독으로 적고 있다. 그러나 SoT 인 `node-output.md` §4.5 는 동일 행을 `{ [fieldName]: value, via?: 'ai_render' }` (AI Agent 의 `render_form` 도구 응답일 때만 `via: 'ai_render'` sentinel 이 실린다) 로 정의하고 적용 노드를 `form`, `ai_agent`(`render_form`) 두 개로 명시한다 ([Spec AI Agent §6.1.d.ii](../4-nodes/3-ai/1-ai-agent.md) 참조). target 은 이 표를 "(CONVENTIONS §4.5)" 라고 명시적으로 인용하면서도 `via` 필드와 `ai_agent` 적용 범위를 누락해, 두 문서를 비교하는 독자에게 `form_submitted` 가 `form` 노드 전용이며 부가 필드가 없다는 잘못된 인상을 준다. (target 본문 다른 곳에도 `render_form`/`via`/`ai_render` 언급이 전혀 없어 우연한 축약이 아니라 구버전 표가 그대로 남아있는 것으로 보인다.) 나머지 3행(`button_click`/`button_continue`/`message_received`)은 canonical 표와 정확히 일치한다.
  - 제안: target 의 `form_submitted` 행을 `node-output.md` §4.5 원문과 동기화 — `data` 열을 `{ [fieldName]: value, via?: 'ai_render' }` 로, 적용 노드 열을 `` `form` / `ai_agent` (`render_form`) `` 로 갱신. (규약 자체를 바꿀 사안은 아님 — `node-output.md` 가 더 최신·정확하며 target 이 그것을 따라가야 하는 케이스.)

- **[INFO] `variables.__workspaceId` 등 이중 밑줄(`__`) 시스템 변수 prefix 의 명명 SoT 부재**
  - target 위치: §6.1 "컨텍스트 구조" JSON 예시 및 필드 표 (`variables.__workspaceId`), §6.2 "park 시 시스템 `__*` 제외 사용자분" 서술
  - 위반 규약: 직접 위반은 아님 — `spec/conventions/execution-context.md` 원칙 4 는 `ExecutionContext` **top-level** 필드의 단일 밑줄(`_`) prefix(엔진 전용, 핸들러 비소비)만 규정하며, `variables` **맵 내부** key 의 이중 밑줄(`__`) 시스템 예약 prefix 는 어느 conventions 문서에도 정식으로 정의돼 있지 않다.
  - 상세: 두 prefix(`_`-top-level 엔진 필드 vs `__`-variables 시스템 키)는 의미·소비 주체가 다른데, 이를 구분해 명시한 conventions 문서가 없어 target 문서가 사실상 유일한 근거가 된다. 즉시 문제를 일으키진 않지만, 향후 `__`-prefix 규칙이 다른 spec(예: 1-data-model.md, expression-language.md)에서 재사용될 때 SoT 부재로 표류할 위험이 있다.
  - 제안: `execution-context.md` 또는 신규 항목에 "`variables.__*` 는 시스템 예약 네임스페이스" 규칙을 1줄 명문화하고 target 이 그 SoT 를 인용하도록 갱신 검토(단, 이번 target 만의 결함은 아니므로 규약 보강 쪽이 더 적절).

## 확인했으나 위반 아님 (참고)

- **문서 구조**: `## Overview` → 11개 번호 절(§1~§11) → 단일 `## Rationale` 로 CLAUDE.md 의 3섹션 권장 구조를 그대로 따름.
- **frontmatter**: `id: execution-engine` 는 형제 문서(`1-auth.md→auth`, `6-websocket-protocol.md→websocket-protocol` 등)와 동일하게 파일명 숫자 prefix 를 제거한 basename 패턴을 따르며, `status: partial` 에 필요한 `code:`(4개 glob, 모두 실존 확인) · `pending_plans:`(2개, 모두 `plan/in-progress/` 실존 확인)이 `spec-impl-evidence.md` §2·§3 요건을 충족.
- **에러 코드 명명**: `CONTAINER_MISSING_EMIT`/`RESUME_CHECKPOINT_MISSING`/`EXECUTION_TIME_LIMIT_EXCEEDED`/`WORKER_HEARTBEAT_TIMEOUT`/`RETRY_STATE_NOT_FOUND` 등 target 이 정의·인용하는 모든 엔진 레벨 에러 코드가 `error-codes.md` §1 의 `UPPER_SNAKE_CASE` 규칙을 예외 없이 준수. lowercase 코드 없음.
- **`NodeHandlerOutput`/Principle 인용**: Principle 0·1.1·4·4.1·4.2·4.2.1·4.4·4.5·5·7 인용이 모두 `node-output.md` 실제 절 번호와 정확히 일치 (위 `form_submitted` 표 본문 제외).
- **`node-cancellation.md` §5 인용**(`AbortError` 분류)·**`execution-context.md` 원칙 4 인용**(`_`-prefix 엔진 내부 필드) 모두 실제 절 제목·내용과 일치.
- **Redis 키 네이밍(§9)**: `spec/conventions/` 에 별도 승격되어 있지 않지만, `4-cafe24.md`·`15-chat-channel.md` 등 다른 도메인 spec 도 동일하게 자체 "Redis 키" 절을 로컬로 두는 기존 프로젝트 관행과 일치 — 승격 누락으로 보지 않음.
- **Swagger/DTO 규약**: target 은 REST controller/DTO 코드 예시를 포함하지 않아(`swagger.md` 대상 영역 아님) 해당 규약 위반 소지 없음.
- **금지 패턴**: `node-output.md` §4.2 가 폐기한 `_multiTurnState`/`output.submittedData`/`output.view` 래퍼/`output.type` 판별자 등을 target 이 재도입한 곳 없음 — 오히려 "Stage 2/5 제거 완료, 현재 코드·페이로드에 미존재"로 명시적으로 정리.

## 요약

target 문서는 명명 규약(UPPER_SNAKE_CASE 에러 코드, kebab-case id, `_`/`__` prefix 사용)·문서 구조(Overview/본문/Rationale)·frontmatter(spec-impl-evidence.md 의무 필드 및 실존성)·CONVENTIONS Principle 인용 정확도 전반에서 정식 규약을 충실히 따른다. 유일하게 실질적인 결함은 §1.3 의 `interaction.data` payload 표가 스스로 "CONVENTIONS §4.5" 를 SoT 로 명시하면서도 `form_submitted` 행에서 `via?: 'ai_render'` 필드와 `ai_agent(render_form)` 적용 범위를 누락한 documentation drift 이며, 이는 채택 시 다른 시스템 invariant 를 깨뜨리는 CRITICAL 이 아니라 인용 표의 신뢰도를 낮추는 WARNING 수준이다. 그 외 `variables.__*` 이중 밑줄 prefix 의 SoT 부재는 target 자체의 결함이라기보다 규약 쪽 보강 여지로 INFO 수준에 그친다.

## 위험도

LOW
