## 발견사항

### [INFO] `conversation-thread.md §5.1` — Anthropic `role: 'system'` 비호환 대응 미흡

- **target 위치**: `§5.1 messages 모드 매핑` — `system` source → `role: 'system'` 행의 비호환 주석
- **과거 결정 출처**: `spec/3-workflow-editor/4-ai-assistant.md` Rationale — "프로바이더 이상동작 대응" 절 (harmony control token, gpt-oss quirk 등 provider quirk 마다 **구체적 mitigation** 을 함께 기록하는 패턴 확립)
- **상세**: 컨벤션은 `system` source 의 Anthropic messages 배열 비호환을 문서화하면서 "v1 자동 push 없으므로 현재 실질 문제 없음"으로만 마무리한다. AI Assistant Rationale 에서 확립된 패턴은 provider quirk 를 발견하면 즉시 "우회 경로" 를 명문화하는 것인데, 이 항목에는 "수동 push 도입 시 검증 필수" 언급만 있고 구체적 우회 전략(예: `system_text` 모드 강제 fallback, provider 분기 헬퍼 호출)이 없다.
- **제안**: 해당 행에 "provider 가 anthropic 이면 `system_text` 모드를 강제하거나, `processSystemSourceTurn()` 에서 provider 분기를 통해 별도 처리한다" 수준의 구체적 upcall 지점을 명시 보강.

---

### [INFO] `conversation-thread.md §1.3` — `DEFAULT_THREAD_ID = 'default'` 와 포트 예약어 namespace 분리 근거 미기재

- **target 위치**: `§1.3 ConversationThread` id 필드 설명의 경고 주석
- **과거 결정 출처**: `spec/conventions/node-output.md` Principle 6 — "시스템 포트 예약어: `out`, `error`, `default`, `done`, …"
- **상세**: 컨벤션은 `id: 'default'` 에 대해 "port 예약어 `'default'` 와 무관 — namespace 분리"라고만 적고, 어떤 레이어에서 namespace 가 분리되어 혼동이 불가능한지를 설명하지 않는다. 구현자가 포트 라우팅 코드 옆에서 thread id 를 다룰 때 혼선이 생길 수 있다.
- **제안**: "thread id 는 `ExecutionContext.thread.id` 경로로만 접근되고, 포트 예약어는 `NodeHandlerOutput.port` 경로로만 사용되어 코드 상 교차점이 없다" 같은 1행 구현 근거를 추가.

---

### [INFO] `conversation-thread.md §1.4` — v2 text transform 규칙이 v1 컨벤션에 선제 박제

- **target 위치**: `§1.4 text 변환 규칙` 표 — `text_classifier` / `information_extractor` 두 행
- **과거 결정 출처**: `spec/3-workflow-editor/4-ai-assistant.md` Rationale 및 `spec/conventions/node-output.md` Principle 8.2 — v1/v2 경계를 "ai_agent 만" 으로 명확히 선을 긋는 기존 결정 패턴
- **상세**: v2 에서 활성화될 변환 규칙을 v1 컨벤션 본문에 `(v2)` 마커만으로 포함했다. `text_classifier` output shape(`output.result.categories` 가 객체 배열임)나 `information_extractor` 의 `responseFormat` 필드 제약 등은 해당 노드 핸들러 spec 변경 시 §1.4 의 v2 규칙이 자동으로 낡아지는 유지보수 위험이 있다. 기존 v1/v2 결정 패턴에서는 v2 항목을 본문에 박지 않고 §7 v2 로드맵으로만 언급하는 경향이 있다.
- **제안**: v2 행을 §1.4 본문에서 제거하고 §7 v2 로드맵에 "text_classifier / information_extractor text 변환 규칙은 해당 노드 핸들러 spec 확정 후 §1.4 에 추가" 로 이동 검토. 또는 현행 유지 시 §1.4 상단에 "v2 행은 해당 노드 spec 과 동기화 의무" 주의문 추가.

---

### [INFO] `cafe24-api-metadata.md §5` — `callTool` / `listTools` 가 노드 핸들러와 같은 호출 경로를 공유하는 설계 결정에 Rationale 부재

- **target 위치**: `§5 MCP Bridge 와의 매핑` 마지막 문장 "노드와 MCP 가 같은 호출 경로를 공유"
- **과거 결정 출처**: 기존 Rationale 에 이 설계를 **금지** 하는 기록은 없음. 단, 레이어 경계 원칙(MCP Client ↔ Internal Bridge 경계는 §5 첫 단락에 명시)이 이미 존재함.
- **상세**: "같은 호출 경로 공유" 는 아키텍처 결합도 선택이므로 왜 분리하지 않았는지 근거가 Rationale 에 없다. 나중에 노드 핸들러 계약 변경 시 MCP Bridge 도 함께 깨질 수 있다는 위험을 알 수 없다.
- **제안**: §5 끝 또는 CHANGELOG 에 1줄 Rationale 추가: 예) "노드 핸들러가 단일 진실로 필드 유효성·인증·rate limit 을 처리하므로, MCP Bridge 가 별도 호출 경로를 복제하면 행동 불일치가 발생한다. 공유 경로는 이 중복을 방지한다."

---

## 요약

`spec/conventions/` 내 다섯 컨벤션 문서 모두 기존 Rationale 에서 명시적으로 **기각된 대안을 재도입** 하거나 **합의된 invariant 를 위반** 하는 CRITICAL·WARNING 항목은 발견되지 않았다. node-output.md 의 원칙들(`output`/`meta`/`config` 직교성, 포트 모델, 에러 컨트랙트)이 conversation-thread 컨벤션에서 정합하게 상호 참조되고 있으며, migrations 컨벤션의 append-only·단조 증가·`outOfOrder=false` 결정은 data-model Rationale(V035/V036 패턴)과 일관된다. 발견된 네 개의 INFO 항목은 모두 "Rationale 근거 미기재" 또는 "알려진 비호환의 구체적 mitigation 부재" 수준으로, 결정을 번복하거나 기존 원칙을 위반하는 것이 아니라 문서 완결성 보완 제안이다.

## 위험도

**LOW**