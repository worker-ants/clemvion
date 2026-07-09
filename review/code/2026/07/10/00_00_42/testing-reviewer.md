# 테스트 리뷰 — conversation-thread-secret-hardening (HEAD f456adedf)

리뷰 대상: `git show HEAD` (commit f456adedf) — 구조화 필드 JSON-safe redaction (`deepRedactSecrets`/`redactSecretsInJsonString`) + `execution.ai_message` egress 마스킹.

## 실행 결과

```
cd codebase/backend && <root>/node_modules/.bin/jest sanitize-error-message thread-renderer ai-turn-orchestrator.service
```
(worktree `codebase/backend/node_modules` 는 main 심링크지만 jest 바이너리 자체는 root pnpm workspace `node_modules/.bin/jest` 에 있어 그걸로 실행)

```
Test Suites: 3 passed, 3 total
Tests:       124 passed, 124 total
```

전량 통과 확인 (`sanitize-error-message.spec.ts`, `thread-renderer.spec.ts`, `ai-turn-orchestrator.service.spec.ts`).

## 발견사항

- **[CRITICAL]** `ai_message` **terminal branch**(정상 turn 종료, "Terminal state" 블록)의 egress 마스킹이 전혀 테스트되지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:842-874` (`message: redactSecrets(responseText)`, `messages: deepRedactSecrets(condMessages)`, `presentations: deepRedactSecrets(terminalPresentations)`) / 대응 테스트 부재 — `ai-turn-orchestrator.service.spec.ts` 전체를 grep 해도 `newResult.response`/`output.result.response` 를 채운 케이스가 하나도 없음 (`grep -n "\.response\b"` 결과 이 브랜치와 무관한 err.response.status 테스트 1건뿐).
  - 상세: 신규 추가된 (b2) 테스트(`ai-turn-orchestrator.service.spec.ts:744`)는 `processMultiTurnMessage` 가 `status: 'waiting_for_input'` 을 반환하는 **waiting branch만** 구동한다. 같은 커밋이 동일 정책·동일 SoT 함수로 patch 한 **terminal branch**(handler 가 `status:'ended'` 를 반환하는 정상 종료 — `processAiResumeTurn` 의 "Terminal state" 코드 블록, PR-H 의 명시적 `ai_end_conversation`(`handleAiEndConversation`)과는 다른 경로)는 기존/신규 테스트 어디에서도 `response`/`messages`/`presentations` 에 실제 콘텐츠를 채워 이 emit 경로를 구동하지 않는다. `status:'ended'` 를 리턴하는 기존 테스트(예: W5 방어 가드, `processAiResumeTurn — ai_end_conversation 종료` describe)는 전부 `output: {}` 로 message/messages 가 항상 빈 값이라 이 코드가 실행은 되어도 실질적으로 아무 것도 검증하지 못한다. 즉 waiting branch 와 대칭으로 patch 된 terminal branch 는 **기능·보안 양쪽 다 회귀 가드가 0** — 향후 리팩터링에서 `redactSecrets(responseText)`→`responseText`, `deepRedactSecrets(condMessages)`→`condMessages` 로 되돌아가도(예: b2 유사 패턴 복붙 실수로 한쪽만 고치는 경우) 어떤 테스트도 실패하지 않는다.
  - 제안: (b2) 와 대칭인 `(b3)` 테스트 추가 — `processMultiTurnMessage` mock 이 `status: 'ended'` + `output.result.response`(secret 포함) + `output.result.messages`(secret 포함)를 반환하도록 하고, 두 번째(terminal) `AI_MESSAGE` emit 의 `message`/`messages` 가 마스킹됐는지 단언.

- **[CRITICAL]** `presentations` 필드 마스킹이 orchestrator 레벨에서 두 emit site 모두 미검증
  - 위치: `ai-turn-orchestrator.service.ts:748-753`(waiting branch, `nextConv.presentations` → `deepRedactSecrets`), `:864-869`(terminal branch, `terminalPresentations` → `deepRedactSecrets`)
  - 상세: `ai-turn-orchestrator.service.spec.ts` 전체를 grep 하면 `"presentations"` 매치가 0건이다(`grep -n "presentations" ai-turn-orchestrator.service.spec.ts` → 결과 없음). 커밋 메시지 자체가 "message/messages/**presentations**를 ... 두 emit site 에서 egress 마스킹"이라 명시하는데, 정작 이 필드는 waiting/terminal 어느 브랜치에서도 시험되지 않는다. (b2) 는 `output.result` 에 `presentations` 키를 아예 넣지 않으므로 `nextConv.presentations` 자체가 `undefined` 라 spread 분기(`...(nextConv.presentations ? {...} : {})`)를 타지 않는다 — 마스킹 호출부가 실행조차 안 된 상태로 테스트가 통과한다.
  - 제안: (b2) 의 mock output 에 `presentations: [{ type: 'table', payload: { note: 'Bearer sk-...' } }]` 류를 추가하고 emit payload 의 `presentations` 가 마스킹됐는지 단언(위 terminal branch 신규 테스트에도 동일하게 포함).

- **[WARNING]** `redactThreadForPublic`(thread-renderer) 의 frozen-turn 최적화가 "구조화 필드가 존재하지만 secret 이 없는" 케이스로 검증되지 않음
  - 위치: `thread-renderer.spec.ts:337` `'returns clean turns by reference (no re-allocation when nothing to mask)'` / 대응 구현 `thread-renderer.ts:87-104` (`changed` 판정: `data !== turn.data`, `toolCalls.some(...)`, `presentations.some(...)`)
  - 상세: 이 테스트는 `makeTurn()` 기본값(= `data`/`toolCalls`/`presentations` 필드 자체가 없음)만 사용한다. 새로 추가된 `changed` 계산 로직 — 특히 `toolCalls`/`presentations` 는 매번 `.map()` 으로 **새 배열 레퍼런스**를 만든 뒤 `.some()` 으로 원소별 비교하는 구조라, "필드가 존재하고 secret 이 없어 원소는 모두 동일 레퍼런스로 되돌아오지만 배열 자체는 새 레퍼런스" 케이스가 코드 경로상 실재한다. 이 케이스에서 `turn` 이 실제로 원본 레퍼런스 그대로 반환되는지(= 새로 만든 `toolCalls`/`presentations` 배열이 버려지는지) 확인하는 테스트가 없다. `.some` 을 배열 레퍼런스 비교(`toolCalls !== turn.toolCalls`)로 바꾸는 흔한 회귀가 들어와도 잡히지 않는다.
  - 제안: `data`/`toolCalls`/`presentations` 를 secret 없이 채운 turn 으로 "frozen turn by reference" 케이스를 별도 추가 (`out.turns[0]).toBe(thread.turns[0])`).

- **[INFO]** JSON.stringify 기반 `toContain('***')` 어서션이 구조 보존을 검증하지 않음
  - 위치: `thread-renderer.spec.ts` `'deep-masks secrets in structured turn.data'`, `'deep-masks secrets in presentations[].payload'` (약 line 285-320)
  - 상세: 두 테스트 모두 `JSON.stringify(out)).not.toContain(secret)` + `.toContain('***')` 형태다. 같은 파일의 `toolCalls[].arguments` 테스트는 `JSON.parse` 후 `parsed.url`/`parsed.headers.Authorization` 처럼 **비-secret 필드가 그대로 보존됐는지**까지 확인하는 반면, 이 두 테스트는 그렇지 않다. 만약 구현이 (가상의) 회귀로 필드 전체를 통째로 `'***'` 로 뭉개 버려도(즉 `type`/`toolCallId`/`rows` 구조가 소실돼도) 이 두 어서션은 여전히 green 이다 — "secret 값이 사라지고 `***` 문자열이 존재한다"는 사실만으로는 과잉 마스킹(구조 파괴)을 잡아내지 못하는 우연 통과 위험.
  - 제안: 최소 한 케이스는 `JSON.parse`/구조 접근으로 non-secret 필드(`nested` 의 다른 키, `presentations[0].type`/`toolCallId`)가 원본 그대로인지 단언.

- **[INFO]** thread-renderer 통합 레벨에서 key-based(bare credential-key) 마스킹 커버리지가 value-pattern 으로 대체됨
  - 위치: `thread-renderer.spec.ts` — 이번 diff 에서 `turn.data` 테스트가 `{ api_key: 'AKIA...' }`(bare key-based) 에서 `{ nested: { note: 'key is api_key=AKIA...' } }`(value-pattern, 문자열 내부 regex 매치) 로 교체됨
  - 상세: `deepRedactSecrets` 자체의 key-based 분기는 `sanitize-error-message.spec.ts` 유닛 테스트(`'masks bare values under credential-named keys (key-based)'`)로 별도 커버되므로 로직 자체는 안전하다. 다만 `redactThreadForPublic`(wiring) 레벨에서는 이제 `turn.data`/`presentations[].payload` 어느 테스트도 bare-key 케이스를 구동하지 않아, "thread-renderer 가 실제로 key-based 분기까지 태우는 `deepRedactSecrets` 를 호출한다"는 배선 확인이 value-pattern 테스트에 암묵적으로만 의존한다(값 패턴 정규식이 우연히 같이 매치하기 때문에 현재는 문제 없음). 이전 커밋에 있던 bare-key 케이스(`{ api_key: 'AKIA...' }`, value 자체가 정규식 미매치)가 사라진 건 실질적 커버리지 축소.
  - 제안: `turn.data = { config: { api_key: 'AKIA...' } }` 류 bare-key 케이스를 최소 1개 thread-renderer 레벨에도 유지.

- **[INFO]** `CREDENTIAL_KEY_PATTERN` 분기의 소소한 엣지 케이스 미검증
  - 위치: `sanitize-error-message.ts` `deepRedactSecrets` — `typeof v === 'string' && v.length > 0 && CREDENTIAL_KEY_PATTERN.test(k)`
  - 상세: 빈 문자열(`{ api_key: '' }` → 마스킹 없이 그대로 유지되어야 함)과 비문자열 값(`{ token: 12345 }` → `deepRedactSecrets` fallback 으로 그대로 통과) 두 분기 모두 테스트가 없다. 로직 자체는 read 상 정상이나(빈 문자열/비문자열은 key-based 분기를 우회해 재귀 fallback 으로 감), 명시적 회귀 테스트는 없음. 우선순위 낮음.

## 요약

핵심 신규 로직(`deepRedactSecrets`/`redactSecretsInJsonString`)은 `sanitize-error-message.spec.ts` 에 copy-on-change·무변형·key/value 두 마스킹 경로·JSON 무결성 회귀(`{"api_key":"x"}`→`{***}` 금지)까지 폭넓고 견고하게 커버되어 있고, `thread-renderer.spec.ts` 도 `toolCalls[].arguments`/`turn.data`/`presentations[].payload` 각각에 대해 이전의 "out of scope" 플레이스홀더 테스트를 실제 마스킹 회귀 테스트로 정확히 교체했다. 다만 이번 커밋의 두 번째 축인 `ai-turn-orchestrator.service.ts` egress 마스킹은 **waiting_for_input 브랜치의 message/messages 만** 신규 (b2) 테스트로 커버됐고, 커밋이 명시적으로 다룬다고 밝힌 **terminal branch(정상 종료 emit)** 와 **presentations 필드(양 브랜치 공통)** 는 실행조차 되지 않거나(빈 mock output) 전혀 참조되지 않아 사실상 미검증 상태다 — 같은 정책·같은 SoT 함수를 두 곳에 대칭 적용한 만큼 대칭적인 회귀 테스트도 필요하다. 이 갭들을 메우면 이번 hardening 작업의 테스트 커버리지는 완결된다고 판단.

## 위험도

**HIGH** — 핵심 유닛 레벨(SoT 함수·thread-renderer)은 견고하지만, 이번 커밋이 새로 건드린 egress 지점(`ai_message` terminal branch + presentations 양 브랜치)에 대한 보안 회귀 가드가 사실상 없어, 향후 리팩터링에서 실제 secret 유출이 재발해도 테스트 스위트가 감지하지 못할 구조적 공백이 있다.
