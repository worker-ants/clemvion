# 정식 규약 준수 검토 — spec/4-nodes/3-ai/

검토 모드: `--impl-done` (scope=`spec/4-nodes/3-ai/`, diff-base=`origin/main`)
target: `spec/4-nodes/3-ai/{0-common,1-ai-agent,2-text-classifier,3-information-extractor}.md` (+ `_product-overview.md`)
대조 대상: `spec/conventions/{node-output,error-codes,cross-node-warning-rules,interaction-type-registry,spec-impl-evidence,execution-context,conversation-thread}.md`

코드 확인은 모두 워크트리 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/funny-mahavira-50d003`) 기준 `git grep`/`Read` 로 수행했다.

---

## 발견사항

### [WARNING] `information_extractor` config echo 필드명 불일치 — 자가진단된 Principle 7 위반이 미해소 상태로 잔존

- **target 위치**: `spec/4-nodes/3-ai/3-information-extractor.md` §9.3 (Rationale, "알려진 결함 — 이연 (W-1)")
- **위반 규약**: `spec/conventions/node-output.md` **Principle 7** ("`config` 는 워크플로우 작성자가 설정한 원본(pre-evaluation) 값을 **그대로** echo") + Principle 1.1 (config↔output 직교)
- **상세**: 본 노드는 사용자가 설정한 필드명이 `outputSchema` 인데, `NodeHandlerOutput.config` echo 시 키를 `schema` 로 바꿔 노출한다. 코드로 재확인:
  - `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts:501` → `schema: rawConfig.outputSchema ?? outputSchema,`
  - 동일 패턴이 `:1366`, `:1485` 에도 반복.
  - 즉 후속 노드는 `$node["IE"].config.outputSchema` 로 접근할 수 없고 `$node["IE"].config.schema` 로만 접근 가능 — Principle 7 이 보장하는 "원본 필드명 그대로" 계약이 깨져 있다.
  - spec 스스로 이를 인지하고 있다 ("doc 전반 ~15곳 + expression 접근 예에 걸쳐 있어 일괄 rename 은 후속 작업으로 이연한다") — 즉 CRITICAL 수준의 미인지 위반은 아니나, `status: implemented` + `pending_plans:` 없음 상태로 남아 있어 [`spec-impl-evidence.md`](../../../../spec/conventions/spec-impl-evidence.md) §3 lifecycle 관점에서 추적 근거가 없다 (known-defect 인데 어떤 plan 도 소유하지 않음).
- **제안**: (a) 필드 rename 작업을 `plan/in-progress/` 항목으로 등록하고 spec frontmatter `pending_plans:` 에 반영 (status 는 `implemented` 유지하되 결함 추적을 명시), 또는 (b) rename 자체를 지금 수행해 `config.schema` → `config.outputSchema` 로 정합화. 규약 갱신은 불필요 — Principle 7 은 이미 명확하며 본 사례는 규약이 아니라 구현/문서 쪽 결함이다.

### [INFO] AI Agent 전용 에러 코드가 "canonical" `ErrorCode` enum 밖에 정의됨

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §10 (에러 코드 표) — `TOOL_DEFINITION_PAYLOAD_EXCEEDED`, `MAX_TOOL_CALLS_EXCEEDED`, `TOOL_EXECUTION_FAILED`
- **위반 규약**: 엄밀히는 `spec/conventions/error-codes.md` 자체 위반은 아니다 (§Overview: "본 규율은 `code:` 의 `ErrorCode` enum … 뿐 아니라 **프로젝트 전체의 에러 코드 문자열**에 적용된다" — 즉 중앙 enum 등록을 의무화하지 않음). 다만 `codebase/backend/src/nodes/core/error-codes.ts` 파일 자체의 선언 주석("Canonical error-code enum for **node handlers' `output.error.code`**")과는 어긋난다.
- **상세**: `git grep` 로 확인한 결과 `LLM_CALL_FAILED`/`LLM_RATE_LIMIT`/`LLM_RESPONSE_INVALID`/`MAX_COLLECTION_RETRIES_EXCEEDED`/`RETRY_STATE_NOT_FOUND` 는 `error-codes.ts` 에 등록되어 있으나, AI Agent 가 §10 에서 `output.error.code` 값으로 명시하는 `TOOL_DEFINITION_PAYLOAD_EXCEEDED`(`tool-payload-budget.ts:172` 의 `ToolDefinitionPayloadExceededError.code` 리터럴) · `MAX_TOOL_CALLS_EXCEEDED`(예약, 미발행) · `TOOL_EXECUTION_FAILED`(미발행) 는 중앙 enum에 없다. 이름 자체는 의미 기반·UPPER_SNAKE_CASE 라 §1 명명 원칙은 준수하지만, "canonical" 을 표방하는 단일 enum 이 실제로는 완전하지 않다는 코드-수준 drift 다.
- **제안**: 규약 위반은 아니므로 CRITICAL/WARNING 대상은 아니지만, `error-codes.ts` 주석의 "canonical" 표현을 완화하거나(예: "grep 대상 대표 surface" 로 수정 — `error-codes.md` §Overview 문구와 동일하게), 혹은 AI Agent 전용 코드도 enum 에 합류시켜 이름이 실제로 canonical 해지도록 정리. 어느 쪽이든 규약 문서(`error-codes.md`) 자체 갱신은 불필요.

### [INFO] AI Agent 조건 ID 예약어 검사가 `node-output.md` Principle 6 전역 목록의 부분집합만 커버

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §5.1 ("예약된 포트 ID(`out`, `in`, `error`, `user_ended`, `max_turns`)와 충돌 불가")
- **위반 규약**: `spec/conventions/node-output.md` **Principle 6** — "시스템 포트 예약어: `out`, `error`, `default`, `done`, `user_ended`, `max_turns`, `completed`, `fallback`, `continue`. 사용자 설정 ID가 이 값과 충돌하면 프런트엔드에서 거부."
- **상세**: 코드(`codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts:587` `RESERVED_PORT_IDS`) 는 spec 과 정확히 동일한 5개(`out`/`in`/`error`/`user_ended`/`max_turns`)만 검사하고, `default`/`done`/`completed`/`fallback`/`continue` 는 대상에서 빠져 있다 — spec·코드는 서로 정합(진짜 위반 아님)하지만, 두 문서 모두 Principle 6 의 전역 9개 목록보다 좁다. `fallback` 은 실제로 `text_classifier` 가 no-match 시스템 포트로 쓰고 있음을 확인했다(`2-text-classifier.md` §5.2 `"port": "fallback"`), 즉 이 단어들은 실체가 있는 예약어다.
- **제안**: 낮은 우선순위. AI Agent 의 condition id 로 `"fallback"`/`"done"`/`"completed"`/`"continue"` 를 사용자가 지정해도 AI Agent 자체 포트와는 충돌하지 않으므로 기능 결함은 아니나, 전역 예약어라는 Principle 6 취지에 맞추려면 `RESERVED_PORT_IDS` 를 9개 전체로 확장하거나(하드닝), 혹은 Principle 6 자체를 "노드별 로컬 예약어 + 전역 안내 목록" 으로 명확히 구분하도록 `node-output.md` 문구를 다듬는 편이 향후 유사 논쟁을 줄인다.

---

## 준수 확인 (컴플라이언스가 확인된 주요 항목 — 참고용)

아래는 이번 검토에서 실제로 코드 대조까지 마치고 **위반이 없음을 확인**한 항목들이다 (false positive 방지 목적으로 기록):

- **`retryable`/`retryAfterSec` invariant** (`node-output.md` §3.2.1): `retryAfterSec` 이 `retryable === true` 일 때만 set 된다는 규칙이 `1-ai-agent.md`/`2-text-classifier.md`/`3-information-extractor.md` 전체에서 일관되게 서술됨.
- **에러 코드 표기**: 3개 노드 문서의 모든 `output.error.code` 값이 `UPPER_SNAKE_CASE`.
- **`output.result.*` 래핑**: 3개 LLM 노드 모두 Principle 8.2 규칙(도메인 결과는 `output.result.*`) 준수, `output.output.*`/`output.metadata.*`/`output.data` 1차 wrapper 등 Principle 4.2/8.1 이 금지한 패턴 미발견 (grep 결과 0건, deprecated 언급 문맥만 존재).
- **config echo 명시 enumeration** (Principle 7 D1): `ai-turn-executor.ts` 의 waiting/ended 출력 모두 spread 패턴이 아닌 명시 키 나열 — 금지 패턴(`{ ...rawConfig }`) 미사용.
- **도구 이름 규칙** (`kb_*`/`mcp_<sid>__<toolName>`/`cond_*`/`render_*`): `mcp-tool-provider.ts` 의 `PREFIX='mcp_'`, `SEP='__'`, 메타도구 이름(`list_resources` 등)이 spec §4 표와 정확히 일치. `render_*` 5종(`render_table/chart/carousel/template/form`)도 `interaction-type-registry.md` §3 매트릭스와 일치.
- **`meta.memory` 노드별 스코프**: `node-output.md` §2 는 "`information_extractor` 는 `meta.memory` 를 echo 하지 않는다"고 명시 — `3-information-extractor.md` 전체에 `meta.memory` 언급이 없고 `meta.contextInjection` 만 사용, 정합.
- **동적 포트 네이밍** (Principle 6 `<prefix>_<index>`): `text_classifier` 의 `class_0`/`class_1` 이 예시와 정확히 일치.
- **frontmatter 스키마** (`spec-impl-evidence.md`): 4개 노드 문서 모두 `id`/`status`/`code:` 필드 보유, `status: partial` 인 `1-ai-agent.md` 만 `pending_plans:` 보유(의무 충족), `pending_plans` 경로(`plan/in-progress/ai-agent-tool-connection-rewrite.md`) 실존 확인. `_product-overview.md` 는 밑줄 prefix 로 frontmatter 면제 대상, 실제로 frontmatter 없음 — 정합.
- **`interaction-type-registry.md`**: `meta.interactionType: 'ai_conversation'`/`'ai_form_render'` 사용이 레지스트리 §1 정의와 일치.
- **`GraphWarningRule` id 명명** (`cross-node-warning-rules.md` §8): `ai_agent:tool-payload-budget` 이 `<node_type>:<kebab-case>` 패턴과 등재 표에 일치. 최근 diff 로 spec 서술이 "Planned" → "구현됨" 으로 갱신됐고 `cross-node-warning-rules.md` §8 설명과도 모순 없음.

## 참고 (범위 밖 — 정보 공유 목적)

`1-ai-agent.md` frontmatter 에서 `pending_plans: plan/in-progress/ai-agent-tool-payload-budget-followups.md` 항목이 이번 변경으로 제거됐다(§4.2 payload 예산 저장 경고가 "Planned" → 구현 완료 서술로 바뀐 것과 정합). 다만 해당 plan 파일은 여전히 `plan/in-progress/` 에 남아 있고 체크리스트 항목 A 는 전부 `[x]` 상태다. 이는 `spec/conventions/**` 준수와는 무관한 **plan-lifecycle** 이슈(`.claude/docs/plan-lifecycle.md` 소관)라 본 리포트의 등급 판정에는 포함하지 않았으나, plan-coherence 계열 체커가 함께 확인하는 편이 안전하다.

---

## 요약

`spec/4-nodes/3-ai/` 문서군은 `spec/conventions/node-output.md`(Principle 0~11)·`error-codes.md`·`cross-node-warning-rules.md`·`interaction-type-registry.md`·`spec-impl-evidence.md` 를 대체로 매우 촘촘하게 준수하고 있으며, 코드 대조 결과 명명(도구 prefix, 동적 포트, 에러 코드 표기)과 출력 포맷(5필드 invariant, `output.result.*` 래핑, config echo enumeration, retryable invariant) 모두 정식 규약과 일치했다. 유일하게 확인된 실질적 규약 위반은 `information_extractor` 의 `config.schema`(실제 필드명 `outputSchema`) echo 불일치로, 문서가 스스로 "알려진 결함" 으로 인정하고 있으나 `pending_plans` 로 추적되지 않아 lifecycle 상 방치 리스크가 있다(WARNING). 그 외 두 건은 코드-문서 모두 self-consistent 하지만 상위 규약 문서(`error-codes.ts` 의 "canonical" 자기선언, `node-output.md` Principle 6 전역 예약어 목록)와의 경계가 다소 느슨한 INFO 수준 관찰이다. CRITICAL 은 없다.

## 위험도

LOW
