# Rationale 연속성 검토 — SSE/fanout `nodeOutput` allowlist 확장 (EIA §R17 잔여 항목 종결)

## 검토 대상

- target 계획: `plan/in-progress/sse-nodeoutput-allowlist.md` (spec_impact: `spec/5-system/14-external-interaction-api.md`)
- 기존 spec Rationale: `spec/5-system/14-external-interaction-api.md` §R17 (특히 "`nodeOutput` 일반 키 allowlist … 해소(2026-08-23)" 항목의 표·문장), `spec/conventions/node-output.md` Principle 0/8
- 진행 중 코드: `codebase/backend/src/shared/utils/node-output-allowlist.ts` (검토 도중 developer 세션이 실시간으로 편집 중이었음 — 아래는 그 최신 상태 기준)

## 결론 먼저

이 작업은 R17이 스스로 이미 열거하고 예고해 둔 "SSE 잔여" 항목("SSE 잔여는 정본 트래커에 별도 항목으로 등재돼 있다")을 닫는 **계획된 후속 작업**이다. 기각된 대안을 다시 채택하거나 R17의 invariant를 우회하는 형태는 발견되지 않았다. 다만 R17이 명시한 확장 기준("위젯 파서가 top-level 로 읽는 wire 키")을 새 소비처(chat-channel 어댑터)로 넓히면서, 그 확장을 **spec 본문에는 아직 반영하지 않은 채 코드만 앞서 나가고 있어** 산문·표 두 군데에서 실제 동기화 갭이 즉시 확인된다.

## 발견사항

### [WARNING] R17 "allowlist 집합" 서술이 곧 stale 해진다 — planner 턴 체크리스트가 좁게 적혀 있음

- target 위치: `plan/in-progress/sse-nodeoutput-allowlist.md` §작업 — `- [ ] (planner 턴) §R17 표의 SSE 행 flip + "강도가 다르다" 서술 제거`
- 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` §R17, "`nodeOutput` 일반 키 allowlist … 해소(2026-08-23)" 항목 마지막 문단 — `allowlist 집합은 NodeHandlerOutput 공개 키(config·output·meta·port·status) + 위젯 파서가 top-level 로 읽는 wire 키(formConfig·conversationConfig·buttonConfig·interactionType)이며, 컴파일타임 assertion 이 전자를 결속한다.`
- 상세: 이 문장은 allowlist 구성을 "핸들러 공개 5필드 + **위젯 파서**가 읽는 4개 wire 키"로만 한정해 정의한다. 그러나 `node-output-allowlist.ts` 는 이미 `payload`·`title`·`rendered`·`nodeType` 4키를 "wire 전용 (chat-channel)" 그룹으로 추가했고, 이 넷은 위젯이 아니라 Discord/Telegram/Slack 렌더러가 top-level 로 읽는 legacy flat shape 다(코드 주석·`extractRendered`/`buttonConfig.nodeOutput?.nodeType` 로 실측 확인). 즉 코드가 "위젯 파서" 라는 R17의 한정어를 벗어난 새 소비처 그룹을 이미 추가했는데, plan 의 planner-턴 항목은 "SSE 행 flip"과 "강도가 다르다 서술 제거"만 명시하고 **"allowlist 집합은 …" 구성 문장을 chat-channel 4키까지 포함하도록 갱신**하는 일은 명시하지 않는다. 이대로 두면 spec 이 실제 allowlist 구성보다 좁은, 부정확한 서술을 계속 유지하게 된다.
- 제안: planner 턴 작업 항목에 "allowlist 집합 구성 문장(§R17 마지막 문단)을 `위젯 파서` + `chat-channel 어댑터(Discord/Telegram/Slack, legacy flat shape)` 두 그룹으로 갱신"을 명시적으로 추가한다. R17 표의 "SSE/fanout emit" 행 상태(`deny-list 유지 → fail-closed allowlist`)뿐 아니라, 그 근거 열도 "REST 와 표면이 다름(chat-channel 이 같은 subject 구독)"에서 "확장 완료, 4키 legacy 호환 근거"로 갱신해야 한다.

### [WARNING] `node-output-allowlist.ts` 상단 요약 표가 배열 구성과 어긋남 (2-그룹 vs 3-그룹)

- target 위치: `codebase/backend/src/shared/utils/node-output-allowlist.ts` — 파일 상단 JSDoc "이 목록은 타입에 결속돼 있다" 절의 `| 그룹 | 키 | 근거 |` 표 (핸들러 계약 공개분 / wire 전용 2행만 존재)
- 과거 결정 출처: 같은 파일 하단 `NODE_OUTPUT_ALLOWED_KEYS` 배열 — 지금은 `// wire 전용 (위젯)` 그룹과 `// wire 전용 (chat-channel)` 그룹이 **분리**되어 3그룹 구성이다. 이 파일 자신의 JSDoc이 "이 목록은 타입에 결속돼 있다 — **산문 주장이 아니다**"라고 못박고 있으므로, 이 표는 사실상 R17 §R17과 동급의 "정본 열거"로 기능한다.
- 상세: 상단 표는 여전히 두 행(`핸들러 계약 공개분`, `wire 전용`)만 나열하고 `wire 전용`의 근거를 "위젯 파서가 top-level 로 읽는다"로만 적어, chat-channel 4키의 존재와 근거(legacy flat shape)를 요약 표에서 찾을 수 없다. 이 저장소가 반복해 겪은 "표 행이 실제 배열/코드보다 낡는다" 패턴과 동일한 형태이며, R17 §"적용 범위는 총칭이 아니라 열거다" 원칙(열거된 표가 정본이라는 원칙)과 정확히 같은 이유로 이 표도 갱신 대상이다.
- 제안: 상단 표에 세 번째 행 `wire 전용 (chat-channel) | payload · title · rendered · nodeType | Discord/Telegram/Slack 렌더러가 top-level(legacy flat shape) 로 읽는다` 를 추가해 배열과 1:1 대응시킨다. 캐너리·테스트 갱신 작업 항목에 "JSDoc 표 동기화"도 함께 넣을 것을 권장.

### [INFO] chat-channel 4키를 "legacy 호환 carve-out"으로 명시해 `node-output.md` Principle 0 과의 경계를 분명히 할 것

- target 위치: `plan/in-progress/sse-nodeoutput-allowlist.md` §설계, `node-output-allowlist.ts` 배열 주석("이 넷도 §R17 이 정의한 '렌더에 필요한 키' 에 해당한다")
- 과거 결정 출처: `spec/conventions/node-output.md` Principle 0 (`NodeHandlerOutput`의 5필드는 불변 — 허용 예외는 `_resumeState`/`_resumeCheckpoint`/`_retryState` 세 개뿐) 및 Principle 8(이중/불필요한 중첩 제거 — `rendered`는 `output.rendered`에 두어야 한다는 표)
- 상세: `payload`·`title`·`rendered`·`nodeType` 는 Principle 0의 세 허용 예외에 들지 않고, Principle 8의 표는 `rendered`의 정본 위치를 `output.rendered`(중첩)로 규정한다. chat-channel 코드 자신도 이 넷을 "flat legacy shape"라 부르며 `nodeOutput.output.rendered`(구조화 형태)를 **우선** 시도한 뒤에야 top-level `rendered`를 폴백으로 본다 — 즉 이 넷은 node-output.md 가 규정한 "현재/정상" 형태가 아니라 과거 데이터 호환용 잔재다. plan/코드 주석의 "§R17 이 정의한 '렌더에 필요한 키'"라는 표현은 R17 이 실제로 쓴 문구가 아니며(R17 원문은 "위젯 파서가 top-level 로 읽는 wire 키"만 언급), 새 근거를 R17 에 소급 부여하는 형태로 읽힐 소지가 있다. allowlist 에 넣는 결정 자체는 타당하지만(실제로 chat-channel 이 이 경로를 읽고 있으므로 막으면 렌더가 깨진다), spec Rationale 갱신 시 "이 4키는 향후 신규 노드 핸들러가 본떠도 되는 패턴이 아니라, 기존 chat-channel 소비처의 legacy flat shape 를 보존하기 위한 한정적 carve-out"이라는 점을 명문화하면 node-output.md Principle 0 의 닫힌 예외 목록과의 경계가 흐려지지 않는다.
- 제안: §R17 갱신 시(또는 코드 주석 보강 시) "이 4키는 신규 handler 설계 가이드가 아니다 — Principle 0/8 의 정본 위치는 `output.*` 이며, 이 carve-out 은 기존 chat-channel 소비처 호환용" 문장을 한 줄 추가.

## 요약

이 작업은 R17이 스스로 예고하고 정본 트래커에 등재해 둔 "SSE/fanout 잔여" 항목을 닫는 계획된 후속 작업으로, 기각된 대안의 재도입이나 명시적 invariant 위반은 없다. 위험은 전부 "진행 중" 성격 — R17이 정의한 확장 기준("위젯 파서")을 새 소비처(chat-channel)로 넓히는 코드 변경이 spec 산문·JSDoc 요약표보다 앞서 나가고 있어, planner 턴에서 그 확장을 명시적으로 반영하지 않으면 §R17 이 실제 allowlist 구성보다 좁고 부정확한 서술로 남는다. 두 WARNING 모두 이번 작업의 남은 체크리스트 항목(§R17 갱신, JSDoc 표 동기화)을 조금 더 구체화하면 해소되는 수준이며, 별도의 spec 재설계나 결정 번복은 필요 없다.

## 위험도

LOW
