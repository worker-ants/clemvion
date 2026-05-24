# 정식 규약 준수 검토 결과

**검토 모드**: 구현 착수 전 (--impl-prep, scope=spec/4-nodes/3-ai)
**검토 대상**: `spec/4-nodes/3-ai/` — `0-common.md`, `1-ai-agent.md` (payload 내 제공 범위)
**참조 규약**: `spec/conventions/node-output.md`, `spec/conventions/interaction-type-registry.md`, `spec/conventions/swagger.md`, CLAUDE.md

---

## 발견사항

### 1. 출력 포맷 규약

- **[INFO]** `§7.3` 에러 출력 — `details.retryable` 필드 누락
  - target 위치: `1-ai-agent.md §7.3` JSON 예시 (`output.error.details`)
  - 위반 규약: `spec/conventions/node-output.md §3.2.1` — LLM 계열 노드에서 `details.retryable: boolean` 필수
  - 상세: `§7.3` 의 JSON 예시 `details` 객체에 `provider`, `statusCode`, `attempt` 만 있고 `retryable` 필드가 없다. 반면 `§7.9` 에러 예시에는 `retryable: true` 가 정확히 포함됨. 예시 불일치가 구현자 혼선을 유발할 수 있다.
  - 제안: `§7.3` JSON 예시의 `details` 에 `retryable: false` 를 추가한다 (`LLM_CALL_FAILED` HTTP 401/403 sub-case 에 대응하는 예시이므로 `false` 가 적합). `§10` 에러 코드 표에서 HTTP 401/403 의 `retryable: false` 와 일관되게.

- **[INFO]** `§7.1 meta.presentationSchemaViolations` 표 vs `§4.1` 필드 shape 불일치
  - target 위치: `1-ai-agent.md §7.1` 필드 설명 표 (`meta.presentationSchemaViolations` 행) vs `§4.1` 표
  - 위반 규약: `spec/conventions/node-output.md Principle 11` — 출력 예시 문서화 규칙 (필드 shape 일관성)
  - 상세: `§7.1` 표에서 `meta.presentationSchemaViolations` entry shape 가 `{toolName, issues, attempts}` 로 명시됐고, `§7.10` 표에서는 `{toolName, toolCallId, issues, attempts}` 로 `toolCallId` 가 추가됨. 두 표가 서로 다른 shape 를 명시하고 있다.
  - 제안: `§7.1` 의 entry shape 를 `{toolName, toolCallId, issues, attempts}` 로 통일 (§7.10 이 더 상세하므로 §7.10 을 단일 진실로 삼음).

### 2. 문서 구조 규약

- **[INFO]** `1-ai-agent.md §12` 의 Rationale 섹션 번호가 본문 섹션과 연속적
  - target 위치: `1-ai-agent.md §12 Rationale`
  - 위반 규약: CLAUDE.md "정보 저장 위치" — 결정의 배경·근거는 "해당 spec 문서 끝의 `## Rationale`"
  - 상세: Rationale 는 CLAUDE.md 기준으로 `## Rationale` heading (2레벨) 으로 문서 끝에 위치해야 하는데, `1-ai-agent.md` 에서는 `## 12. Rationale` 로 번호를 붙여 본문 섹션과 동일한 계층에 묶였다. `0-common.md` 는 `## Rationale` (번호 없음) 으로 규약을 준수하고 있어 두 문서 간 형식 불일치가 발생한다.
  - 제안: `1-ai-agent.md` 의 `## 12. Rationale` 를 `## Rationale` 로 변경해 CLAUDE.md 및 `0-common.md` 패턴과 통일. 내부 소절 (`### 12.1`, `### 12.2` 등) 은 `### <소절 제목>` (번호 없음) 으로 변경하거나, 번호 유지를 원하면 규약 자체를 갱신 필요.

- **[INFO]** `0-common.md §5` 에서 `CONVENTIONS §4.5` 참조가 불완전
  - target 위치: `0-common.md §4` ("Stage 2 의 공통 resume 컨트랙트에서 `status: 'resumed'` + … (CONVENTIONS §4.5)")
  - 위반 규약: spec 내 상호 참조는 파일 경로 기반 anchor 링크 사용 — `[Spec Conversation Thread §5](...)` 형태
  - 상세: 본문에서 `(CONVENTIONS §4.5)` 라고 약칭만 쓰고 있어 어느 convention 파일의 §4.5 인지 불명확하다. 같은 문서 §5 에서는 `[CONVENTIONS Principle 3.2.1](../../conventions/node-output.md#321-...)` 처럼 명시 링크를 제공하므로 일관성이 깨진다.
  - 제안: `(CONVENTIONS §4.5)` 를 `([CONVENTIONS Principle 4.5](../../conventions/node-output.md#45-interactiondata-payload-규격))` 로 변경.

### 3. 명명 규약

- **[INFO]** `§7.3` 에러 예시에서 `meta.thinkingTokens: 0` 을 포함
  - target 위치: `1-ai-agent.md §7.3` JSON 예시 `meta` 블록
  - 위반 규약: `spec/conventions/node-output.md Principle 11` — `undefined` 필드는 JSON 예시에서 생략
  - 상세: `§7.3` 에러 케이스에서 `meta.thinkingTokens: 0` 이 포함됐으나, `thinkingTokens` 는 선택적 필드(공통 §6에서도 "선택")이고 에러 케이스에서는 LLM 호출이 실패한 상황이므로 통상 `0`/미제공이다. `§7.1` 에는 포함됐지만 에러 케이스인 `§7.3` 에서는 생략이 자연스럽다. 더 중요하게, Principle 11 은 `undefined` 필드를 JSON 예시에서 생략하도록 명시하므로, 의미 없는 `0` 을 운반하지 않는 케이스라면 생략이 규약에 부합한다.
  - 제안: `§7.3` 예시에서 `thinkingTokens` 를 생략하거나, 에러 케이스에서도 partial 메타를 포함한다는 의도라면 필드 설명 표에 명시.

### 4. 금지 항목 (CONVENTIONS 명시 금지 패턴)

- **[WARNING]** `§7.4 output.result.message` — 리터럴 config 값이 아닌 런타임 값이나, Principle 1.1 경계 모호
  - target 위치: `1-ai-agent.md §7.4` (`output.result.message: string`)
  - 위반 규약: `spec/conventions/node-output.md Principle 1.1` — 리터럴 config 는 `config` 에만; 런타임 값은 `output` 에만
  - 상세: `output.result.message` 는 "현재 턴의 assistant 응답"으로, 이는 런타임 값이므로 `output.result` 에 두는 것은 규약상 허용된다. 그러나 `§7.4` 필드 표에서 `output.result.messages[]` 와 `output.result.message` 가 별도로 공존하는 이유가 불명확하다 — `messages[].content` 에서 마지막 assistant 메시지를 추출하면 중복 없이 동일 정보를 제공할 수 있다. Principle 8.1 ("이중/불필요한 중첩 제거")의 정신에 부합하지 않을 여지가 있다.
  - 제안: `output.result.message` 유지 근거를 문서에 명시하거나 (예: "편의 접근자 — messages 배열의 last assistant content 와 동일"), Principle 8 위반 여지를 설계 의도로 수용한다면 §7.4 필드 표 주석에 명시적으로 이를 기재.

- **[INFO]** `§7.4 waiting_for_input` 에서 `output.result.maxTurns` — config 값 echo 가 `output` 에 위치
  - target 위치: `1-ai-agent.md §7.4` (`output.result.maxTurns: number`, 설명: "config 의 `maxTurns` 값 echo")
  - 위반 규약: `spec/conventions/node-output.md Principle 1.1` — 리터럴 config 값은 `output` 에 echo 금지. 후속 노드는 `config.maxTurns` 로 접근
  - 상세: `output.result.maxTurns` 가 "config 의 `maxTurns` 값 echo" 라고 명시되어 있다. 이는 Principle 1.1 의 "사용자가 UI/schema 로 설정한 리터럴 값은 `config` 만" 규칙에 반한다. waiting/resumed 사용 사례는 클라이언트 UI 가 남은 턴 수를 표시하기 위한 편의 필드로 볼 수도 있으나, `config.maxTurns` 접근으로 동일하게 달성 가능하다.
  - 제안: `output.result.maxTurns` 를 제거하고 클라이언트가 `config.maxTurns` 와 `output.result.turnCount` 를 조합해 남은 횟수를 계산하도록 유도. 만약 클라이언트 편의 목적으로 유지한다면 Principle 1.1 예외 사유를 문서에 명시하거나 규약 §1.1 에 예외를 공식 등록.

### 5. API 문서 규약

- **[INFO]** `spec/4-nodes/3-ai/` 파일들에 대한 OpenAPI/Swagger 데코레이터·DTO 패턴 검토 대상 아님
  - 본 target 문서들은 노드 동작 명세(spec)이며 코드(DTO, Controller)가 아니므로 `spec/conventions/swagger.md` 의 규칙은 직접 적용 대상이 아님. 이행은 `codebase/` 구현 시 검토.

---

## 요약

`spec/4-nodes/3-ai/0-common.md` 와 `spec/4-nodes/3-ai/1-ai-agent.md` 는 전반적으로 `spec/conventions/node-output.md` Principle 0–11 을 잘 준수하고 있다. 5필드 invariant, `output.result.*` wrapper, `output.error.{code, message, details}` 형태, `config` raw echo 원칙, `_resumeState`/`_retryState` top-level 허용 예외, `details.retryable` 의무 모두 §7.9 등 핵심 케이스에서 충족된다. 발견된 항목은 `§7.3` 예시에서 `details.retryable` 누락(INFO), `meta.presentationSchemaViolations` entry shape 가 §7.1과 §7.10 사이에서 불일치(INFO), Rationale 섹션 번호 형식의 문서 간 불일치(INFO), `output.result.maxTurns` 가 config 리터럴을 `output` 에 echo 하는 Principle 1.1 경계 위반 여지(INFO), `output.result.message` 의 `messages[]` 중복 필드 구조(WARNING) 등 소규모 형식·포맷 이슈에 한정된다. 어느 항목도 다른 시스템이 가정한 invariant 를 즉각 파괴하는 CRITICAL 위반에는 해당하지 않는다.

---

## 위험도

LOW

STATUS: OK
