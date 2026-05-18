# Convention Compliance — AI Timezone Context Spec Draft

Target: `plan/in-progress/spec-draft-ai-timezone-context.md`
검토 기준: `spec/conventions/` 정식 규약 전체 + CLAUDE.md 명명 컨벤션

---

## 발견사항

- **[WARNING]** `cafe24-api-metadata.md` §5 내 섹션 번호 shift 기술 불일치
  - target 위치: §1.1 변경 위치 요약 표 — "기존 §5/§6/§7/§8 → §6/§7/§8/§9 로 +1 shift"
  - 위반 규약: `spec/conventions/cafe24-api-metadata.md` §8 CHANGELOG (현행 §8 이 CHANGELOG)
  - 상세: 현행 `cafe24-api-metadata.md` 의 최상위 섹션은 §1 디렉토리 구조 / §2 Operation 메타데이터 형식 / §3 예시 / §4 Wire-format 규약 / §5 신규 endpoint 추가 절차 / §6 MCP Bridge 와의 매핑 / §7 allowlist 와의 관계 / §8 CHANGELOG 로 구성된다. draft 는 "기존 §5/§6/§7/§8 → §6/§7/§8/§9" 로 전체 shift 한다고 기술하나, 실제로는 §5(신규 endpoint 절차)·§6(MCP Bridge)·§7(allowlist)·§8(CHANGELOG) 가 모두 +1 이동해 §6/§7/§8/§9 가 된다. 이 점은 사실과 일치한다. 다만 shift 후 §9 가 CHANGELOG 임을 draft 어디에도 명시하지 않아 향후 spec 편집자가 섹션 번호를 혼동할 수 있다.
  - 제안: §1.2 신설 §5 본문 초입 또는 §1.1 표 비고 칸에 "기존 §8 CHANGELOG → §9 로 이동" 을 명시 추가.

- **[WARNING]** `operationToMcpTool` 의 description suffix 위치 모순 — "prepend" vs "append"
  - target 위치: §1.2 `cafe24-api-metadata.md` 새 §5.3 본문 — "모든 도구의 description 끝에 다음 한 줄을 자동 prepend 한다"
  - 위반 규약: 표준 한국어/영어 용어 혼용. 동 draft 의 §6. 의사결정 default 표 행 "Cafe24 description suffix 위치 → 도구 description 의 마지막 줄" 과 상충.
  - 상세: draft §5.3 본문은 "description 끝에 ... 자동 **prepend**" 라고 쓰고, §1.3 의 §8.1 참조 주석과 §6 표에서는 "description suffix" / "마지막 줄" 이라고 표현한다. "끝(append)" 과 "prepend" 는 반대 의미다. 또한 생성 결과 예시를 보면 timezone 명시 줄이 description **뒤** 에 나타나므로 실제 의도는 append(suffix)다.
  - 제안: §5.3 본문의 "자동 prepend 한다" → "자동 append(suffix)한다" 로 수정. prepend 는 앞에 붙이는 동작이므로 "끝에 prepend" 는 용어 모순.

- **[WARNING]** `cafe24-api-metadata.md` §5.2 의 예시 코드블록 내 `'ISO8601 date'` 단독 사용 금지 규약이 기존 §3 예시와 상충
  - target 위치: §1.2 새 §5.2 "메타데이터 row 작성 규약" — "단순 `'ISO8601 date'` 만 적는 것은 금지"
  - 위반 규약: 현행 `spec/conventions/cafe24-api-metadata.md` §3 예시 (`since: { description: 'ISO8601 date — created_after' }`)
  - 상세: draft §5.2 가 신설하는 규약("단순 `'ISO8601 date'` 만 적는 것은 금지")은 동일 파일의 현행 §3 예시 row(`since: { description: 'ISO8601 date — created_after' }`)를 즉시 위반 사례로 만든다. 신설 규약이 채택되면 §3 예시도 동시에 갱신돼야 한다. draft 는 이를 언급하지 않는다.
  - 제안: Phase A 체크리스트에 "§3 예시 `since.description` 을 `'ISO8601 datetime (KST, UTC+9) — created_after. e.g. ...'` 로 갱신" 항목 추가.

- **[WARNING]** `0-common.md` Rationale 섹션 경로 참조 오류
  - target 위치: §3.3 `0-common.md` Rationale 신규 항 내 — `[Cafe24 API Metadata §5.3](../../conventions/cafe24-api-metadata.md#53-ai-agent--mcp-도구-description-자동-부기)`
  - 위반 규약: CLAUDE.md §명명 컨벤션 — spec 문서 간 상대 경로는 실제 파일 위치 기준. `spec/4-nodes/3-ai/0-common.md` 에서 `spec/conventions/` 까지의 상대 경로는 `../../conventions/` 가 아닌 `../../../conventions/` (3 depth up: `3-ai` → `4-nodes` → `spec` → `conventions`)
  - 상세: `spec/4-nodes/3-ai/0-common.md` 의 위치에서 `../../conventions/cafe24-api-metadata.md` 로 올라가면 `spec/4-nodes/conventions/` 를 가리키게 되어 링크가 깨진다. 동일 오류가 §2.2 (새 §11) 본문의 `[spec/2-navigation/_product-overview.md](../../2-navigation/_product-overview.md)` 에도 존재한다 — `spec/4-nodes/3-ai/` 에서 `../../2-navigation/` 은 `spec/4-nodes/2-navigation/` 이 된다(실제 경로는 `../../../2-navigation/`).
  - 제안: `0-common.md` 기준 상대 경로를 `../../../conventions/cafe24-api-metadata.md` 및 `../../../2-navigation/_product-overview.md` 로 수정.

- **[WARNING]** `4-cafe24.md` §4.3 draft 의 §8.1 참조 anchor 오류
  - target 위치: §1.3 `4-cafe24.md` 새 §4.3 — "(§8.1, 메타데이터 §5.3)" 및 §8.1 에 추가할 한 줄 — `[Cafe24 API Metadata §5.3](../../conventions/cafe24-api-metadata.md#53-ai-agent--mcp-도구-description-자동-부기)`
  - 위반 규약: 현행 `spec/conventions/cafe24-api-metadata.md` 의 섹션 구조. draft 가 신설하는 §5 의 하위 섹션 번호가 확정되지 않은 상태에서 Markdown anchor `#53-ai-agent--mcp-도구-description-자동-부기` 를 사용.
  - 상세: draft §5.3 의 실제 섹션 제목이 "AI Agent / MCP 도구 description 자동 부기" 이므로 Markdown anchor 는 GitHub-flavored 규칙상 `#53-ai-agent--mcp-도구-description-자동-부기` 가 맞다(슬래시 제거, 공백→하이픈, 특수문자 제거). 단, `cafe24-api-metadata.md` 기준 `spec/4-nodes/4-integration/4-cafe24.md` 에서의 상대 경로 `../../conventions/cafe24-api-metadata.md` 는 올바르다 (`4-integration` → `4-nodes` → `spec` → `conventions` = `../../conventions/`). anchor 자체는 문제 없으나 §5.3 이 실제로 신설될 때까지 링크가 404 임을 명시할 필요가 있다.
  - 제안: Phase A 체크리스트에 "spec 파일 실제 편집 후 anchor 유효성 검증" 항목 추가. anchor 자체는 의도와 일치하므로 별도 수정 불필요.

- **[INFO]** 문서 구조 규약 — `0-common.md` Rationale 섹션 위치 권장
  - target 위치: §3.3 — "`0-common.md` 끝에 `## Rationale` 섹션 신설"
  - 위반 규약: CLAUDE.md §프로젝트 스펙 문서 — "각 spec 문서는 권장 3섹션 구성: Overview / 본문 / Rationale" + `spec/<영역>/0-common.md` 패턴(공통 규약)
  - 상세: draft 가 `## Rationale` 를 문서 끝에 신설하는 것은 CLAUDE.md 의 권장 구조에 정확히 부합한다. 다만 `0-common.md` 가 `0-` prefix 파일이라 카테고리 공통 규약 문서에 해당하며, 이 파일에 Rationale 섹션이 지금까지 없었다는 사실은 기존 구조 채무다. 신설 자체는 올바른 방향.
  - 제안: 현재 draft 내용대로 진행. Rationale 섹션을 문서 최하단에 두는 것이 권장 위치에 일치함을 확인.

- **[INFO]** `spec/conventions/cafe24-api-metadata.md` §5 신설 시 `cafe24-api-catalog/_overview.md` §6 의 "신규 endpoint 추가 절차" 주석 갱신 필요
  - target 위치: §4 Side-effects 점검 표 — "`spec/conventions/cafe24-api-catalog/*.md` 18 resource — 변경 불요"
  - 위반 규약: `spec/conventions/cafe24-api-catalog/_overview.md` §6 step 주석 — "spec 본문 수정 불요 — `4-cafe24.md` 는 형식만 정의"(`cafe24-api-metadata.md` §5 step 8의 설명이기도 함)
  - 상세: `_overview.md` §6 마지막 줄이 `spec/conventions/cafe24-api-metadata.md §5` 의 신규 endpoint 추가 절차를 참조한다. `cafe24-api-metadata.md` 에 §5 Timezone Semantics 가 신설되면 기존 §5(신규 endpoint 추가 절차)가 §6 으로 renumber 된다. `_overview.md §6` 의 마지막 주석 `> spec/conventions/cafe24-api-metadata.md §5 의 신규 endpoint 추가 절차도 본 카탈로그 row 갱신을 step 으로 포함한다.` 의 섹션 번호가 깨진다.
  - 제안: Phase A 체크리스트에 "`spec/conventions/cafe24-api-catalog/_overview.md` §6 마지막 주석의 섹션 번호를 `§5 → §6` 으로 갱신" 항목 추가.

- **[INFO]** `node-output.md` Principle 7 의 `config echo` 대상 목록 갱신 누락 언급
  - target 위치: §4 Side-effects 점검 표 — "`output.config` echo (CONVENTIONS Principle 7) — 새 필드 `includeSystemContext?` / `systemContextSections?` 를 echo 대상에 추가 (각 노드 §7 명시)"
  - 위반 규약: `spec/conventions/node-output.md` Principle 7 "항상 echo" 목록 — `mode`, `model`, `systemPrompt`, `maxTurns` 등이 예시로 열거됨
  - 상세: draft 가 Principle 7 준수를 각 노드 §7 에서 명시하겠다고 기술하는 것은 올바르다. 그러나 `node-output.md` Principle 7 본문의 "항상 echo" 예시 목록에 `includeSystemContext`·`systemContextSections` 가 추가되지 않아도 규약 위반은 아니다(목록은 exhaustive가 아닌 예시다). 단, 컨벤션 문서 자체의 예시를 갱신하면 일관성이 높아진다.
  - 제안: Phase A 또는 별도 후속 작업으로 `node-output.md` Principle 7 예시 목록에 `includeSystemContext?`·`systemContextSections?` 를 추가하는 것을 고려. 필수는 아님.

---

## 요약

target 문서(`spec-draft-ai-timezone-context.md`)는 전반적으로 `spec/conventions/` 정식 규약 구조(CHANGELOG 행 포함, Rationale 섹션 권장, 섹션 번호 부여, CLAUDE.md 명명 패턴)를 잘 따르고 있다. CRITICAL 위반은 없다. 주요 우려 사항은 두 가지다: (1) §5.3 에서 "끝에 prepend" 라는 용어 모순 — 의도는 append(suffix)인데 prepend 라고 기술해 구현자에게 잘못된 신호를 줄 수 있다(WARNING). (2) `0-common.md` 및 신설 Rationale 내부의 상대 경로가 파일 depth 를 잘못 계산해 링크가 깨질 것이 예상된다(WARNING). 그 외 기존 §3 예시 코드(`since.description`)가 신설 §5.2 규약을 즉시 위반하게 되는 점, `_overview.md §6` 의 섹션 번호 참조가 shift 로 인해 깨지는 점을 Phase A 체크리스트에 반영해야 한다. 이 문제들은 모두 spec 파일을 실제로 편집하는 Phase A 단계에서 수정 가능한 수준으로, 본 draft 자체의 설계 방향은 정식 규약과 정합한다.

---

## 위험도

LOW
