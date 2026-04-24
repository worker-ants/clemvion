# Review Resolution — 2026-04-24_18-27-09

리뷰 대상: 커밋 `88e0120` (label-as-id 방어 — prompt 강화 + shadow hint).
Critical 0 + Warning 8 + Info 16 중 **Warning 전건 + 주요 Info** 조치. backend 1913 / lint / build clean.

## Warning

| ID | 조치 |
|----|------|
| **W-1** | `add_edge` 의 target_id 만 label 인 fallback 경로를 회귀 고정하는 테스트 추가 (`source_id: TRIGGER_NODE.id`, `target_id: 'SendEmail'`). 아울러 source·target 양쪽 label 케이스(I-15) 도 같은 describe 에 추가. |
| **W-2** | `system-prompt.spec.ts` 의 `/UUID/` · `/never.*label/` 독립 pattern 을 정확한 slogan 한 줄(`/always reference a node by its UUID, never by its label/i`)로 교체. `result.id` · `nodes[*].id` 도 각각 고정 매칭. |
| **W-3** | `ShadowResult.hint` JSDoc 에 `update_node`/`remove_node`/`add_edge` 의 label-lookalike 경로 2종을 명시하고 `[hint] … [/hint]` 마커 방침을 추가. |
| **W-4** | `labelLookalikeHint` → `buildLabelAsIdHint` 로 개명 (build* 네이밍 컨벤션 준수). 순회 로직은 기존 `findByLabel` 에 위임해 중복 제거. |
| **W-5** | 동어반복이던 `safeValue` / `safeLabel` 중복 sanitize 를 제거. `node.label === value` 조건 진입 시 하나의 `safeLabel` 만 만들어 재사용. 메시지를 `Value <safeLabel> matches the label of an existing node (id: <uuid>). …` 로 단순화. |
| **W-6** | SRP 침식 (hint 전략 3종 누적) 은 현 규모에서 조치 불필요로 판정 (4번째 전략 시점에 `HintEnricher` 분리). Follow-up 기록. |
| **W-7** | hint 문자열을 `[hint] … [/hint]` 고정 마커로 감싸 LLM 이 자연어 instruction 구간으로 오인하지 않게 한다. system prompt 의 안내 문구도 이 마커를 언급. |
| **W-8** | `result.hint` 포맷을 `^\[hint\] / matches the label of an existing node / \[\/hint\]$` 3단 어서션으로 고정. prompt 의 예시 문구도 실제 구현 문자열과 일치시킴. |

## 선택 반영한 Info

| ID | 조치 |
|----|------|
| **I-1** | `sanitizeLlmProvidedString` 제거 범위 C1 제어 문자 (0x7F–0x9F) 추가. |
| **I-2** | zero-width + Bidi 제어 문자 (U+200B–U+200F, U+2028–U+2029, U+202A–U+202E, U+2066–U+2069, U+FEFF) 제거 범위 확장 — Trojan source 스타일 공격 완화. regex 는 `new RegExp` 문자열로 구성 + `eslint-disable-next-line no-control-regex` 로 의도적 예외 명시. |
| **I-3** | `buildLabelAsIdHint` 진입부에 `value.length > LABEL_HINT_MAX_LEN * 4` 조기 반환 — 터무니없이 긴 값은 label 후보에서 제외. |
| **I-4** | `node.id` 는 UUID 형식(`[0-9a-f-]`)이므로 `JSON.stringify` 래핑 제거, 단순 문자열 보간. |
| **I-9** | `add_edge` 의 존재 판정을 `sourceExists` / `targetExists` 지역 변수로 추출해 중복 평가 제거. |
| **I-10** | source/target 힌트 우선순위를 `if (!sourceExists) hint = ...; if (hint === null && !targetExists) hint = ...` 로 명시화 — "source 존재해서 null" vs "매치 없어서 null" 의 의미가 한눈에 드러남. |
| **I-11** | 메서드명을 `buildLabelAsIdHint` 로 변경 (W-4 와 함께). |
| **I-12** | `removeNode` 에도 `updateNode` 와 동일한 주석 추가. |
| **I-13** | 공백 전용 (`'   '`) id 값 → hint undefined 회귀 케이스 추가. |
| **I-14** | cascading FIFO 비어있을 때 label-lookalike 가 fallback 으로 선택되는 반례를 별도 테스트로 고정. |
| **I-15** | `add_edge` source/target 양쪽 모두 label 인 케이스 — source 힌트 하나만 노출되는 계약을 고정. |

## Follow-up (이번 범위 밖)

- **W-6**: `HintEnricher` 분리는 4번째 hint 전략 도입 시점에 진행.
- **I-5**: `spec/3-workflow-editor/4-ai-assistant.md` 에 label-lookalike hint 절 + cascading 우선순위 규칙 추가. spec 개정이라 `project-planner` 로 분기.
- **I-6**: spec 절 번호 주석은 W-2 수정 시 `§8 "LLM 시스템 프롬프트 구성"` 로 한 줄 추가해 반영.
- **I-7**: 3번째 이상 hint 전략 도입 시 `hintSource?` 필드 검토.
- **I-8 / I-16**: 현재 경로 밖.

## 재검증 결과

- `backend/npm run lint` — clean.
- `backend/npm test` — 1913/1913 passed.
- `backend/npm run build` — clean.
- `shadow-workflow.spec` / `system-prompt.spec` — 98/98 passed (+신규 11 케이스).
