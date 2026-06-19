# 정식 규약 준수 검토 — `spec/4-nodes/3-ai/`

검토 모드: `--impl-prep` (구현 착수 전)
검토 일시: 2026-06-19
대상 경로: `spec/4-nodes/3-ai/` (0-common.md, 1-ai-agent.md, 2-text-classifier.md, 3-information-extractor.md)

---

## 발견사항

### [INFO] `0-common.md` frontmatter `id` 가 파일 basename 과 불일치
- target 위치: `spec/4-nodes/3-ai/0-common.md` frontmatter — `id: common`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — "파일 basename(확장자 제외) 기반 권장"
- 상세: basename 은 `0-common` 이나 `id` 는 `common` 으로 숫자 prefix 가 생략됐다. spec-impl-evidence §2.1 는 "파일 basename 기반 권장"이라 하며, 같은 basename 충돌 시 영역 prefix 로 회피하는 예외만 허용한다. 본 케이스는 충돌이 아닌 단순 prefix 생략이므로 "권장"에서 벗어난 형태다.
- 제안: `id: 0-common` 으로 변경하거나, 현행처럼 충돌 없는 짧은 id 를 선택하는 것이 의도라면 같은 영역 내 다른 문서(`1-ai-agent.md` → `id: ai-agent`)와 일관성 있게 `id: ai-common` 형태도 고려. 규약이 "권장" 수준이므로 강제 사항은 아니나 팀 컨벤션 일관성이 낫다.

---

### [INFO] `1-ai-agent.md` pending_plans 에 등재된 plan 중 구현 완료 후 complete 로 이동했을 가능성 확인 필요
- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter — `pending_plans: [ai-agent-tool-connection-rewrite.md, ai-context-memory-followup-v2.md, exec-park-durable-resume.md]`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §4 — spec-pending-plan-existence.test.ts` 가드 — pending_plans 의 모든 path 가 `plan/in-progress/` 또는 `plan/complete/`(in-progress→complete 치환) 에 실존해야 함
- 상세: build-time 가드가 이미 실존 여부를 검증하므로 직접 위반은 아니다. 그러나 impl-prep 단계에서 착수 전 점검 관점으로, 세 plan 파일 모두 현재 `in-progress/` 에 실존하는지 그리고 실제 구현 범위와 일치하는지 확인을 권장한다. 특히 `ai-agent-tool-connection-rewrite.md` 는 §4 Tool Area 가 "재작성 예정(현재 제거됨)" 으로 spec 본문에 이미 비활성 표시돼 있어, plan 의 현 상태와 spec 본문 기술이 정합하는지 점검이 필요하다.
- 제안: 구현 착수 전 세 plan 의 in-progress 실존을 확인하고, spec 에 "비활성(제거됨)" 으로 기술된 기능의 plan 이 아직 in-progress 인 경우 상태 일치 여부를 재검토한다.

---

### [WARNING] `1-ai-agent.md` §4 Tool Area 비활성 섹션이 spec 본문에 남아 있으나 `status: partial` 을 유지 중
- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §4 전체 및 도구 이름 규칙 `tool_*` 관련 서술
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — `partial` 은 "일부 구현됨" 상태이며, `pending_plans` 가 해소되면 `implemented` 로 승격 의무. 또한 CLAUDE.md 단일 진실 원칙 — spec 본문은 현재 계약 상태를 기술해야 한다.
- 상세: §4 와 §1 의 `toolNodeIds`/`toolOverrides` 설명 블록이 "재작성 예정 (현재 제거됨)" 경고 블록으로 표기되어 있다. 이는 spec 본문에 현재 구현되지 않고 계획도 미정인 내용이 살아있음을 의미한다. spec-impl-evidence 규약상 `partial` status + `pending_plans` 에 해당 plan 이 있으면 구조적으로는 허용되나, spec 본문이 "구현됨" 인 부분과 "비활성/미구현" 인 부분이 혼재하면 impl-prep 단계에서 구현자가 혼란을 겪을 수 있다.
- 제안: 비활성 섹션(§4 Tool Area, `tool_*` 도구 이름 규칙)을 spec 주 본문에서 분리하거나 collapsed/deprecated 표기를 강화한다. 또는 pending_plans 에 해당 plan 이 명시돼 있으므로 현 상태 유지는 규약 위반이 아니나, 구현자 혼란 방지를 위해 인라인 주석 보강을 권장한다.

---

### [INFO] `1-ai-agent.md` §7.4 `output.result.message` 첫 진입 시 `""` 값의 의미론이 Principle 1.1 관점에서 명시적 기술 부재
- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §7.4 표 — `output.result.message` 행 "현재 턴의 assistant 응답 (waiting 시점) — 첫 진입 시 `""`"
- 위반 규약: `spec/conventions/node-output.md` Principle 1.1 — "런타임에 계산/변형된 값은 `output` 만". Principle 4.3 — `ai_agent (multi)` 의 Waiting output 명세
- 상세: `output.result.message` 가 첫 진입 시 `""` 인 것은 LLM 이 아직 응답을 생성하지 않았으므로 런타임 도메인 값이 없음을 나타낸다. Principle 4.3 의 `ai_agent (multi)` 행 구조와 일치하나, `undefined` vs `""` 의 구분이 spec 에 명시되지 않아 구현자가 `undefined` 로 처리할 수 있다.
- 제안: §7.4 설명에 "첫 진입 시 LLM 호출 전이므로 빈 문자열(`""`) — `undefined` 가 아니다" 를 명시해 구현자 혼동을 방지한다.

---

### [INFO] `0-common.md` 의 `## Rationale` 섹션이 §11(시스템 컨텍스트 자동 주입)에 대해서만 있고 §1~§10 에 대한 Rationale 은 부재
- target 위치: `spec/4-nodes/3-ai/0-common.md` 전체 — Rationale 섹션
- 위반 규약: CLAUDE.md "문서 구조 규약 — Overview / 본문 / Rationale 3섹션 권장"
- 상세: Rationale 섹션이 §11 에 국한돼 있다. §1(LLM 모델 선택 인터페이스 통일), §5(응답 형식 wrapper 3분류 채택), §10(contextScope vs memoryStrategy 축 분리) 등 공통 규약의 핵심 설계 결정에 대한 근거가 0-common.md 에는 없고 각 노드 문서에 분산돼 있다.
- 제안: 공통 규약 자체의 핵심 결정에 대한 최소한의 Rationale 을 0-common.md 에 추가하면 문서 구조 권장 패턴에 부합한다. 강제 사항 아님.

---

### [INFO] `2-text-classifier.md` 와 `3-information-extractor.md` 의 Rationale 섹션 부재
- target 위치: `spec/4-nodes/3-ai/2-text-classifier.md` 전체, `spec/4-nodes/3-ai/3-information-extractor.md` 전체
- 위반 규약: CLAUDE.md "문서 구조 규약 — Overview / 본문 / Rationale 3섹션 권장"
- 상세: 두 문서 모두 `## Rationale` 섹션이 없다. AI Agent (1-ai-agent.md) 는 §12 Rationale 이 매우 상세하게 작성돼 있는 반면, Text Classifier 와 Information Extractor 는 설계 근거 섹션이 누락돼 있다. Information Extractor 의 `memoryStrategy` 에서 `summary_buffer` 를 제외한 결정 근거, `finalize_extraction` 도구 설계 근거 등 구현자가 혼동할 수 있는 결정이 있다.
- 제안: 두 문서에 `## Rationale` 섹션을 추가하고 주요 설계 결정(특히 Text Classifier 의 memoryStrategy 미보유 이유, Information Extractor 의 summary_buffer 제외 이유)을 기록한다. 강제 사항 아님.

---

### [WARNING] `1-ai-agent.md` §7.3 에서 single-turn 모드 error 시 `_retryState` 미발행 여부가 명시되지 않음
- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §7.3 표 및 섹션 도입부
- 위반 규약: `spec/conventions/node-output.md` §4.2.1 — "`_retryState` 는 retryable error 종결 시 `output.error.details.retryable === true` 일 때만 보존" 으로 정의. `1-ai-agent.md` 의 생명주기 비교표는 `_retryState` 가 `buildMultiTurnFinalOutput` 에서만 발행(multi-turn 전용)임을 명시하고 있으나, §7.3 독립 독해 시 이 제약이 보이지 않는다.
- 상세: node-output.md §4.2.1 은 retryable error 시 `_retryState` 발행이라 정의하고, 1-ai-agent.md 의 생명주기 비교표에서 multi-turn 전용임을 기술한다. 그러나 §7.3 (single-turn error) 표에는 `_retryState` 가 발행되지 않는다는 명시적 언급이 없다. `execution.retry_last_turn` 명령이 multi-turn 전용임을 §7.3 에서 독립적으로 알 수 없어, 구현자가 single-turn error 에도 `_retryState` 를 발행해야 한다고 오해할 수 있다.
- 제안: §7.3 표 하단 또는 도입부에 "single-turn 모드에서는 `_retryState` 가 발행되지 않는다. `execution.retry_last_turn` 명령은 multi-turn 전용 (§7.9)" 주석을 추가한다.

---

### [WARNING] `1-ai-agent.md` pending_plans 에 `exec-park-durable-resume.md` 포함 — spec 본문 상세 기술과 plan 상태 정합 확인 필요
- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `status: partial` + `pending_plans: [exec-park-durable-resume.md]`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3.1` — partial → implemented 전이 규칙 및 `spec-status-lifecycle.test.ts` (c) 가드: "partial 의 pending_plans 모두 complete 인데 status 미승격"
- 상세: `exec-park-durable-resume.md` 가 정확히 무엇을 남긴 미구현 surface 로 커버하는지 spec 본문에서 명시적으로 알 수 없다. §7.4 의 `_resumeCheckpoint` / `_resumeState` 생명주기 상세는 이미 spec 에 기술돼 있다. 만약 해당 plan 이 이미 complete 로 이동했다면 `spec-status-lifecycle.test.ts` (c) 가드가 fail 할 수 있다.
- 제안: 구현 착수 전에 `plan/in-progress/exec-park-durable-resume.md` 의 실존 여부와 현재 구현 범위를 확인한다. plan 이 complete 로 이동했으면 spec status 를 `implemented` 로 승격하거나 나머지 pending plan 이 있으면 그 상태를 유지한다.

---

### [INFO] `0-common.md` §5 에서 참조하는 CONVENTIONS Principle 번호가 node-output.md 의 실제 번호와 일치함 — 정합 확인
- target 위치: `spec/4-nodes/3-ai/0-common.md` §5 — "CONVENTIONS Principle 11", "Principle 3.2.1", "Principle 4.5", "Principle 7"
- 위반 규약: 해당 없음 (일치 확인)
- 상세: 0-common.md 에서 참조하는 CONVENTIONS 번호들을 node-output.md 와 대조한 결과 모두 정합한다. Principle 11 (출력 예시 문서화 규칙), Principle 3.2.1 (details 공통 표준 필드), Principle 7 (config echo), Principle 4.5 (interaction.data payload 규격) 모두 node-output.md 에 실재한다.
- 제안: 현행 유지. 향후 node-output.md Principle 번호 변경 시 0-common.md 참조 동기 갱신 필요.

---

## 요약

`spec/4-nodes/3-ai/` 의 4개 문서는 정식 규약(`spec/conventions/`)과 전체적으로 높은 수준의 정합성을 유지한다. 출력 포맷 규약(Principle 11 — `output.result.*` / `output.error.*` / `output.interaction.*` wrapper, UPPER_SNAKE_CASE 에러 코드, config echo 원칙, `retryable` 필수 표기)은 충실히 준수되고 있다. frontmatter 의 필수 필드(`id`/`status`/`code`/`pending_plans`)도 구조적으로 갖춰져 있다. 주된 관찰 사항은 (1) `pending_plans` 에 포함된 plan 들의 실존 및 현 상태 확인 필요 — 특히 `exec-park-durable-resume.md` 와 `ai-agent-tool-connection-rewrite.md` 가 이미 complete 로 이동했다면 spec-status-lifecycle 가드가 fail 할 수 있다는 점, (2) Text Classifier 와 Information Extractor 문서의 Rationale 섹션 부재(권장 사항), (3) Tool Area 비활성 섹션이 spec 본문에 혼재하여 구현자 혼동 가능성, (4) single-turn error 에서 `_retryState` 미발행 여부를 spec 에 명시해 multi-turn 전용 재시도 흐름과 혼동을 방지할 필요 등이다. CRITICAL 위반은 발견되지 않았다.

---

## 위험도

LOW
