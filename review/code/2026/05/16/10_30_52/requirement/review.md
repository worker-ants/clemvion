# 요구사항(Requirement) 코드 리뷰

## 발견사항

### 파일 6: ai-agent.handler.ts — mapTurnsToChatMessages

- **[WARNING]** `system` role 메시지에도 `source: 'injected'` 태깅
  - 위치: `ai-agent.handler.ts` diff, `case 'system':` 분기
  - 상세: `system` 메시지는 `buildConversationConfigFromOutput` 및 `withSourceMarker` 에서 `m.role !== 'system'` 필터로 이미 제거된다. 즉 `source: 'injected'` 를 붙여도 실제로 WS emit payload 에는 포함되지 않는다. 그러나 동일 `messages` 배열이 LLM 호출로 흘러갈 때 `LlmService.sanitize` 가 `source` 만 제거하고 `role: 'system'` 은 그대로 forwarding 되므로 기능상 무해하다. 다만 spec §4.4.6 이 `system` 에 대해 `source` 를 정의하는지 여부가 코드에서 불명확하고, `default:` 분기와 함께 `injected` 로 일괄 처리돼 향후 혼란을 유발할 수 있다.
  - 제안: `case 'system':` 분기에서 `source` 를 생략하거나 주석으로 "system 메시지는 emit 전 필터되므로 source 미정의" 라고 명시. 또는 spec §4.4.6 에 `system` role 에 대한 source 정의를 추가.

- **[WARNING]** `default:` 분기(알 수 없는 source) 도 `injected` 로 태깅
  - 위치: `ai-agent.handler.ts` diff, `default:` 분기
  - 상세: `ConversationTurn.source` 에 미정의 값이 들어오면 묵시적으로 `injected` 처리된다. 해당 메시지가 실제로는 `live` 성격일 경우 프론트엔드 turn index 계산이 틀어질 수 있다.
  - 제안: `default:` 분기에서도 `source: 'injected'` 유지는 현재 요구사항의 "주입된 데이터" 기본 가정으로 허용 가능하나, 명시적 주석("ConversationThread 에서 오는 모든 turn 은 injected")을 추가해 의도를 문서화.

### 파일 5: llm.service.ts — source strip

- **[WARNING]** `void source` 패턴 — 런타임엔 무해하나 혼동 유발
  - 위치: `llm.service.ts` diff, `map(({ source, ...rest }) => { void source; return rest; })`
  - 상세: `void source` 는 "사용하지 않는 변수" lint 경고를 억제하기 위한 관용구다. 그러나 `source` 는 구조 분해로 이미 소비(무시)된 상태이므로 `void source` 가 없어도 논리적으로 동일하다. `_source` 접두사 명명 또는 ESLint `no-unused-vars` 예외 주석이 더 관용적이다.
  - 제안: `map(({ source: _source, ...rest }) => rest)` 또는 `map(({ source: _, ...rest }) => rest)` 로 교체해 명시성을 높임. `void source` 제거.

- **[INFO]** `opts` 가 `undefined` 일 때 sanitized 적용 확인
  - 위치: `llm.service.ts` diff, `opts?.timeoutMs` 분기
  - 상세: `opts` 가 없어도 두 분기 모두 `sanitized` 를 사용하도록 수정되어 있어 기능 완전성 문제 없음. 단, `opts` 가 없는 케이스(`client.chat(sanitized)`)는 diff 에 명시적으로 있으므로 커버됨.
  - 제안: 해당 없음 (정상).

### 파일 2: execution-engine.service.ts — withSourceMarker

- **[INFO]** `withSourceMarker` 가 `'live'` 와 `'injected'` 외 값은 `'live'` 로 backfill
  - 위치: `withSourceMarker` 함수, 조건 `m.source === 'injected' || m.source === 'live'`
  - 상세: 제3의 source 값이 들어오면 `live` 로 처리된다. 현재 `ChatMessage.source` 타입이 `'live' | 'injected' | undefined` 로 제한되어 있으므로 런타임엔 사실상 불가능하다. 타입 시스템이 이를 보장하는 한 문제 없음.
  - 제안: 현 구현으로 충분. 필요 시 `never` guard 추가 고려.

- **[INFO]** `buildConversationConfigFromOutput` 와 line 2182 의 `condMessages` 두 군데에 `withSourceMarker` 적용 — 이중 적용 위험 여부
  - 위치: `execution-engine.service.ts` diff, 두 번째 변경(line 2182)
  - 상세: 두 경로는 독립된 배열(`messagesAll` vs `sourceMessages`)을 처리하므로 이중 적용은 없다. 이미 `'live'` 또는 `'injected'` 가 있는 메시지는 idempotent 하게 통과하므로 중복 호출도 안전함.
  - 제안: 해당 없음 (정상).

### 파일 9: conversation-utils.ts — turnIndex 엣지 케이스

- **[WARNING]** 첫 메시지가 `injected` 인 경우 `turnIndex: currentTurn || 1` — `0 || 1` 로 1이 되는 점은 의도적이나, 이 injected 메시지의 turnIndex 가 이후 live 사용자의 turnIndex(1)와 동일
  - 위치: `conversation-utils.ts` diff, `turnIndex: currentTurn || 1` 라인
  - 상세: 맨 앞에 injected 메시지들이 있고 뒤이어 live 사용자 메시지가 나올 때, injected 메시지의 `turnIndex = 1`과 첫 live 사용자 메시지의 `turnIndex = 1` 이 같다. 이는 테스트("Two injected user messages do not bump turn", liveUser?.turnIndex toBe(1))에서 의도된 것으로 확인되므로 스펙 합치. 그러나 UI가 `turnIndex` 로 그룹핑한다면 injected 메시지들이 같은 turn 그룹에 시각적으로 묶일 수 있어 별도 `isInjected` 구분이 필수적이다.
  - 제안: `isInjected` 플래그가 추가되어 있으므로 UI 구현 시 injected 그룹을 별도 처리하는 요구사항이 명시돼야 한다. 현재 `ConversationItem.isInjected` 는 `optional` 이므로 UI 소비 측에서 undefined 처리를 빠뜨릴 수 있다. WARNING 정도의 주의 필요.

- **[WARNING]** `injected` assistant 메시지에 대한 `assistantIdxInTurn` 미증가 — 테스트 미비
  - 위치: `conversation-utils.ts` diff, `if (!isInjected) { assistantIdxInTurn++; }` 분기
  - 상세: injected assistant 뒤에 여러 live assistant 메시지가 나오는 시나리오(tool call + 최종 응답이 섞인 복합 케이스)에서 `assistantIdxInTurn` 이 올바른 `llmCalls[]` 슬롯을 가리키는지 검증하는 테스트가 없다. 현재 추가된 테스트("tool message inherits turnIndex")는 injected assistant 없이 구성되어 있다.
  - 제안: injected assistant → live tool call → live assistant 시나리오의 테스트 케이스 추가.

- **[INFO]** `tool` role 메시지에 `isInjected` 설정 — tool 메시지 source 미전송 케이스
  - 위치: `conversation-utils.ts` diff, tool 분기의 `isInjected` 추가
  - 상세: 테스트 "tool message inherits turnIndex" 에서 `role: 'tool'` 메시지에 `source` 없음. `isInjected` = `false` (기본값)로 처리되어 `turnIndex` 가 `currentTurn` 에서 계산된다. 이는 현재 요구사항에서 tool 메시지가 항상 live call 과 연관된다는 가정과 일치하므로 정상. 그러나 injected assistant의 tool call 이 존재하는 미래 시나리오에서 `source: 'injected'` 를 붙여야 할 필요가 있을 수 있다.
  - 제안: 현재 요구사항에서는 허용. spec §4.4.6 에 tool 메시지의 source 정의 추가 고려.

### 파일 4: llm-client.interface.ts

- **[INFO]** `source` 필드가 optional — 타입 레벨에서 backfill 보장 없음
  - 위치: `ChatMessage` 인터페이스의 `source?: 'live' | 'injected'`
  - 상세: `source` 가 optional 이므로 컴파일 타임에 미설정된 메시지가 WS emit 으로 흘러가는 것을 막을 수 없다. `withSourceMarker` 가 런타임 backfill 을 담당하지만, 이를 거치지 않는 emit 경로가 존재한다면 undefined 가 클라이언트에 노출될 수 있다.
  - 제안: `withSourceMarker` 가 적용되는 경로 목록을 주석으로 열거하거나, 변환 후 타입을 `Required<Pick<ChatMessage, 'source'>> & Omit<ChatMessage, 'source'>` 형태로 강화해 static 보장 추가 고려.

### 파일 1: execution-engine.service.spec.ts

- **[INFO]** 기존 테스트 수정: `source: 'live'` backfill 기대값 추가
  - 위치: diff 라인 38–43 (기존 테스트 수정)
  - 상세: 기존 테스트가 `source` 없는 메시지를 expect 했던 것을 `source: 'live'` 포함으로 갱신. 요구사항 변경 반영으로 정상.
  - 제안: 해당 없음 (정상).

- **[INFO]** 신규 테스트: `injected` 보존 케이스
  - 위치: diff 라인 46–68 (신규 테스트)
  - 상세: unmarked assistant 메시지(source 미설정)가 `'live'` 로 backfill 되는 것을 검증. 의도와 구현 일치.
  - 제안: 해당 없음 (정상).

### 파일 7: ai-agent.thread.spec.ts

- **[WARNING]** `live` 메시지 수 검증이 `expect(live.length).toBe(0)` 로 설정 — 테스트 의도와 실제 코드 흐름의 잠재적 불일치
  - 위치: `ai-agent.thread.spec.ts` diff, 라인 384
  - 상세: 테스트는 "handler push site 에서는 `source: 'live'` 를 직접 붙이지 않는다 (`live.length === 0`)"를 검증한다. 이는 `buildConversationConfigFromOutput` 이 `withSourceMarker` 로 backfill 한 후 상태가 아니라, handler 내부 `messages` 배열의 상태를 검증한다. `turnResult.output.messages` 가 `withSourceMarker` 를 거친 후의 값인지, 거치기 전의 값인지 테스트에서 명확하지 않다. 만약 `output.messages` 가 이미 backfill 된 상태라면 `live.length === 0` 은 실패할 것이므로, 실제로는 backfill 전 상태임을 전제로 한다.
  - 제안: 테스트 주석에 "이 assertions 는 `buildConversationConfigFromOutput` 의 `withSourceMarker` 적용 이전 raw handler output 을 검증한다" 를 명시해 혼동 방지.

### 파일 3: third-party-oauth.controller.spec.ts

- **[INFO]** `String(contentType ?? '')` → `contentType ?? ''` 타입 캐스팅 개선
  - 위치: `third-party-oauth.controller.spec.ts` diff
  - 상세: `headers` 타입을 `Record<string, unknown>` → `Record<string, string>` 으로 좁혀 `String()` 래핑 제거. 타입 정확도 향상으로 기능 완전성과 무관하나 코드 명확성 개선.
  - 제안: 해당 없음 (정상).

### 파일 12: plan/in-progress/spec-update-impl-prep-findings.md

- **[INFO]** Plan 문서 frontmatter 및 구조 적합
  - 위치: 신규 파일 전체
  - 상세: `worktree`, `started`, `owner` frontmatter 정상 기재. C1–C4 체크박스 미처리 상태이므로 `in-progress/` 위치 적합. 위임 섹션 명확. 요구사항 관점 이슈 없음.
  - 제안: 해당 없음 (정상).

---

## 요약

이번 변경은 WebSocket emit payload 의 `messages[].source` 마커(`'live' | 'injected'`) 도입을 위한 전체 스택 구현이다. 핵심 요구사항(spec §4.4.6의 injected 태깅, live backfill, LLM API 전송 전 strip, 프론트엔드 turn index 계산 보정)은 기능적으로 올바르게 구현되어 있으며, 양방향 backfill 경로(`withSourceMarker`)와 strip 경로(`LlmService.sanitize`)가 모두 구현되어 있다. 다만 몇 가지 요구사항 관점의 잠재적 문제가 있다: `system` role 메시지에 대한 `source` 정의 불명확, injected assistant 뒤에 live tool/assistant 가 섞이는 복합 시나리오의 테스트 미비, `live.length === 0` assertion 의 검증 전제(backfill 전/후)가 테스트 주석에서 불명확한 점이다. `ConversationItem.isInjected` 가 optional 이므로 UI 소비 측에서 undefined 처리 누락 리스크도 존재한다. 전체적으로 구현 완성도는 높으며, 지적된 WARNING 들은 향후 확장 시 혼란을 예방하기 위한 명확화 수준이다.

## 위험도

LOW
