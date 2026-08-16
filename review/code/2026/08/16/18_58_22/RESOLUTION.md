# RESOLUTION — `18_58_22` (6라운드, 최종)

**CRITICAL 0 · WARNING 2** — 조치 완료.

## W1 (maintainability) — 내 커밋 메시지가 거짓이었다

직전 커밋(`e88ac4bdf`)이 *"라운드 ID·자기정정 서사를 걷어내고 설계 근거만 남겼다"* 고
선언했는데, 실제로는 `redact-stored-error.ts` **한 파일에만** 적용됐다. `git show --stat` 으로
확인하면 그 커밋에 `executions.service.ts` 가 **아예 없다**. 자매 4파일에 라운드 ID 13건이
남아 있었고, **커밋 메시지가 예시로 인용한 그 문장**(`"종전 이 문장은 … 틀렸다"`)조차 원문 그대로였다.

이 저장소가 반복해 겪은 *"자매 중 하나만 고친다"* 가 **코드 품질 관리 그 자체에서** 재발한
형태다. 그리고 이 세션에서 *"내 주장이 실제보다 넓다"* 의 **다섯 번째** 사례다.

### 조치는 실측으로 갈랐다 — 인용을 전부 지우지는 않았다

지적의 **사실 부분은 맞지만**, "라운드 ID 를 소스에서 제거하라" 는 처방은 그대로 받지 않았다.
실측하면 그 인용은 **이 저장소의 기존 관용**이기 때문이다:

| 선존 파일 | 형태 |
|---|---|
| `common/utils/assert-row-array.ts` · `.spec.ts` | `(ai-review \`17_15_21\` 실측)` |
| `execution-engine/execution-engine.service.ts` | `(ai-review \`17_15_21\` WARNING 1)` — 4곳 |
| `shared/utils/strip-external-only-fields.ts` | `(\`15_58_26\` architecture W2)` |
| `websocket/websocket-events.types.ts` | `(\`18_53_27\` naming W3)` |
| `chat-channel/chat-channel.dispatcher.spec.ts` | `(ai-review \`18_38_10\` maintainability INFO 9)` |

즉 문제는 인용이 아니라 **내 장황한 자기정정 서사**다 — *"종전 이 문장은 … 틀렸다"*,
*"실제로 그렇게 됐다"* 류. 그쪽만 걷어내고 terse 인용은 관용대로 남겼다.

- `stop()` JSDoc **30줄 → 12줄** (동시성·반환 계약은 유지, 라운드 서사만 제거)
- `ResponseExecution` JSDoc 의 `— 실제로 그렇게 됐다` → `(ai-review …)` 표준 형태로 정렬

## W2 (documentation) — 정정이 plan 앞쪽에 역전파되지 않았다

소스 JSDoc 은 *"`return` 문 셋"* 으로 고쳤는데 plan `## 조치` 절(`:226`)은 여전히
*"반환 지점이 넷"* 이었다 — 같은 문서 안에 정정 전/후가 공존했다. 정정하고 경위를 각주로 남겼다.

## 이 라운드에서 확인된 것 (조치 불요)

- **security(NONE, 6라운드 연속)** — 이번엔 위임 대상 정규식의 **ReDoS 표면까지 직접 검사**
- **testing(NONE)** — 대상 3개 spec **68 tests 직접 재실행 PASS**
- **requirement(NONE)** — spec 6곳↔코드 line-level 재대조. **`pending_plans` 수치를
  frontmatter 파서로 독립 재현해 내 값(17·4)과 일치 확인** — 직전 라운드에서 두 리뷰어가
  `grep` 으로 과다 계상했던 항목이고, 이번 프롬프트에 파싱 기준을 명시한 결과다
- **scope(NONE)** — 되돌린 `explore-tools` 변경이 최종 diff 에 **흔적 없음** 재확인

## 검증

- 영향 스위트 **9 suites / 123 tests PASS**
- TEST WORKFLOW 4스테이지 (아래 커밋에서 재실측)
