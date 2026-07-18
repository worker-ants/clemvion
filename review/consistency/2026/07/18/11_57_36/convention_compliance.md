# 정식 규약 준수 검토 — `spec/4-nodes/3-ai` (--impl-done)

## 검토 방법

- diff-base 는 prompt 상 `origin/main` 이나, `git merge-base HEAD origin/main` 기준 실제 diff 는
  `codebase/backend/src/nodes/core/node-handler.interface.ts` (JSDoc 정정) +
  `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.{ts,spec.ts}`
  (`endMultiTurnConversation` 시그니처 `_` prefix 3 인자 + docblock + pinning 테스트) +
  `plan/in-progress/ie-endmultiturn-errorpayload-contract.md` 뿐이다. **`spec/4-nodes/3-ai/**.md` 자체는
  이번 diff 에 포함되지 않는다** (`git diff origin/main -- spec/4-nodes/3-ai/` 결과 0). prompt 의
  `origin/main` 직접 비교는 이 worktree 분기점 이후 origin/main 이 별도로 전진해 `spec/conventions/interaction-type-registry.md` 등에 reverse-diff 오염을 일으키므로 merge-base 기준으로 교정해 판단했다.
- target 은 spec 텍스트가 아니라 **코드 docblock/JSDoc 이 spec 조항을 인용하는 방식**이 정확한지이므로,
  관점을 "docblock 인용 정확성"(신규) + "spec/4-nodes/3-ai 자체의 기존 규약 준수 상태"(회귀 확인) 로 나눠 검토했다.
- 대조 규약: `spec/conventions/node-output.md`, `error-codes.md`, `interaction-type-registry.md`,
  `conversation-thread.md`, `cross-node-warning-rules.md`, `spec-impl-evidence.md`.

## 발견사항

- **[INFO]** docblock 의 spec 인용은 정확 — 신규 위반 없음
  - target 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts:452-475` (`endMultiTurnConversation` JSDoc), `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts:1180-1220`
  - 위반 규약: 해당 없음 (positive confirmation)
  - 상세: JSDoc 이 인용하는 `spec/4-nodes/3-ai/3-information-extractor.md §5.3` 의 "IE `retryable` 은 code 기반 invariant (`LLM_CALL_FAILED`/`LLM_RATE_LIMIT` → `true`, `LLM_RESPONSE_INVALID`/`MAX_COLLECTION_RETRIES_EXCEEDED` → `false`)" 서술을 실제 spec 파일(§5.3, `output.error.details.retryable` 행)에서 대조 확인 — 정확히 일치한다. `output.error.code` 는 `LLM_CALL_FAILED`(UPPER_SNAKE_CASE, `error-codes.md` §1 정합), `_retryState` 미부착 검증도 `node-output.md` §4.2.1(`_retryState` 는 `retryable===true` 종결에서만·IE 는 `retry_last_turn` 미지원이므로 무관)과 정합. 신규 pinning 테스트(`information-extractor.handler.spec.ts` 신규 `describe` 블록)도 5필드(`config/output/meta/port/status`) 계약을 깨지 않고 `port`/`status`/`output.error`/`output.result`/`_retryState` 만 검증해 Principle 0 과 정합.
  - 제안: 없음 (준수 확인).

- **[WARNING]** (회귀 확인, 이번 diff 미도입) `0-common.md §5` 가 LLM 3 노드 출력 wrapper 계약을 실제와 다른 Principle 번호로 인용
  - target 위치: `spec/4-nodes/3-ai/0-common.md` §5 "응답 형식 규약 (Principle 11)" 제목 및 본문(§5 표 아래 "CONVENTIONS Principle 11" 인용), §9 인용부("공통 §5 응답 형식 규약 (Principle 11)")
  - 위반 규약: `spec/conventions/node-output.md` — 실제 **Principle 11**("출력 예시 문서화 규칙")은 spec 문서 Output 섹션의 **작성 서식**(`### Case: <케이스 이름>` + JSON + 표) 규칙일 뿐, `output.result.*`/`output.error.*`/`output.interaction.*` wrapper 공유 자체는 Principle **1.1**(config/output 직교, 사용자 상호작용은 `output.interaction`) · **3.2**(에러 표준 형태) · **4.4/4.5**(resumed·interaction.data 규격) · **8.2**("`output.result` 래핑은 LLM 계열 노드 한정")가 분담해 정의한다.
  - 상세: 같은 디렉터리의 형제 문서 `2-text-classifier.md`/`3-information-extractor.md`는 "CONVENTIONS Principle 11 포맷"이라는 표현을 **올바른 의미**(문서 서식)로 쓰는데, `0-common.md §5`만 같은 번호를 wrapper 구조의 근거로 잘못 인용해 동일 규약 번호가 같은 영역 안에서 두 가지 의미로 충돌한다. wrapper 구조 자체(동작)는 실제로 Principle 1.1/3.2/4.4/8.2 와 정합하므로 기능적 계약 위반은 아니고 **인용 라벨 오기**다. 이번 diff 는 `spec/4-nodes/3-ai/**.md` 를 건드리지 않으므로 신규 도입이 아니라 기존에 존재하던 상태의 **미해결 잔존**이다 — 동일 항목이 이 task 의 선행 `--impl-prep` 실행(`review/consistency/2026/07/18/11_19_02/convention_compliance.md`)에서도 WARNING 으로 발견됐고, `plan/in-progress/ie-endmultiturn-errorpayload-contract.md` 가 "project-planner 후속 위임(out-of-scope)"으로 명시 이관했다 (사용자 승인 bypass, §impl-prep 결과 섹션).
  - 제안: 이번 task 범위 밖 — `project-planner`가 `0-common.md §5` 제목/본문의 "(Principle 11)"을 "(Principle 1.1 / 3.2 / 4.4 / 8.2)"로, §9 앵커 텍스트도 동일하게 정정. 코드 변경 불필요(spec 텍스트 정정 사안).

- **[INFO]** (회귀 확인, 이번 diff 미도입) `1-ai-agent.md §7.x` 출력 케이스 헤더가 Principle 11 `Case:` 서식과 불일치
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §7.1~§7.9 (예: "### 7.1 Single Turn 모드 — 정상 완료 (`out` 포트)")
  - 위반 규약: `spec/conventions/node-output.md` Principle 11 — "`### Case: <케이스 이름>`" 리터럴 접두 규칙
  - 상세: 형제 문서(`2-text-classifier.md`, `3-information-extractor.md`)와 타 노드 문서(`1-if-else.md`, `1-http-request.md`)는 `### N.M Case: …` 접두를 일관 사용하나 `1-ai-agent.md`만 서술형 제목을 쓴다. 자동 가드 없음(순수 문서 서식). 이번 diff 는 이 파일을 건드리지 않으므로 기존 상태 그대로다.
  - 제안: 우선순위 낮음. 후속 spec 편집 시 `### 7.1 Case: Single Turn 정상 완료 (out 포트)` 형태로 통일 검토.

## 확인했으나 위반 아님 (참고)

- `endMultiTurnConversation` 시그니처의 `_errorPayload?` / `_failedUserMessage?` / `_failedUserMessageSource?` — TS 관용적 미사용 인자 prefix 이며, `ResumableNodeHandler<TEndReason>` 제네릭 계약(arity 유지)과 정합. `ResumableMessageSource`(`'ai_message' | 'form_submitted'`) 타입은 이번 diff 신규 도입이 아니라 기존 타입 재사용(import 추가만).
- `plan/in-progress/ie-endmultiturn-errorpayload-contract.md` frontmatter (`name`/`worktree`/`status`/`started`/`owner`/`spec_impact: none`) — `spec_impact: none` sentinel 은 `spec-impl-evidence.md` R-8 의 no-op sentinel 목록에 포함되어 유효.
- 신규 테스트 `describe('endMultiTurnConversation — engine errorPayload contract (deliberate self-fill)')` — `output.error.code` UPPER_SNAKE_CASE(`LLM_CALL_FAILED`), `output.result.extracted` 구조, `port`/`status` 5필드 계약 모두 `node-output.md` 위반 없음.
- API 문서 규약(OpenAPI/Swagger 데코레이터·DTO 명명) — 이번 diff·target 모두 REST DTO/Swagger 표면과 무관 (내부 노드 핸들러 인터페이스). 해당 관점은 적용 대상 아님.
- `cross-node-warning-rules.md`(`ai_agent:tool-payload-budget`) · `interaction-type-registry.md`(§1 `ai_conversation`/`ai_form_render`, §4 `AiAgentEndReason` 패키지 SoT) · `conversation-thread.md`(source enum·`presentations[]`·`data.via` sentinel) — target spec 원문과 대조해 모두 정합 확인(변경 없음, 회귀 없음).

## 요약

이번 diff (`ie-endmultiturn-errorpayload-contract`) 는 spec 텍스트를 건드리지 않고 `information-extractor.handler.ts`·`node-handler.interface.ts` 의 JSDoc/시그니처와 pinning 테스트만 추가하는 문서화-only 변경이다. 새로 추가된 docblock 이 인용하는 `spec/4-nodes/3-ai/3-information-extractor.md §5.3` invariant(retryable code-기반 고정)는 실제 spec 원문과 정확히 일치해 신규 규약 위반이 없다. `spec/4-nodes/3-ai` 영역 자체에는 이전부터 존재하던 WARNING 1건(`0-common.md §5`/§9 의 "Principle 11" 오귀속)·INFO 1건(`1-ai-agent.md` §7.x 헤더의 `Case:` 서식 미준수)이 여전히 남아있으나 둘 다 이번 diff 로 도입되지 않았고, WARNING 은 이미 이 task 의 선행 impl-prep 검토에서 발견되어 project-planner 후속 작업으로 명시 이관된 상태다.

## 위험도

LOW
