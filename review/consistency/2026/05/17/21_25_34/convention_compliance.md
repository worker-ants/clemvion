# 정식 규약 준수 Check — convention_compliance

검토 대상: `spec/4-nodes/3-ai/` (0-common.md, 1-ai-agent.md, 2-text-classifier.md, 3-information-extractor.md)
검토 모드: --impl-prep (구현 착수 전)
검토 기준: `spec/conventions/node-output.md`, `spec/conventions/conversation-thread.md`, CLAUDE.md 명명 컨벤션

---

### 발견사항

- **[INFO]** `0-common.md` 상단 — `_product-overview.md` 와의 구분 명시 없음
  - target 위치: `spec/4-nodes/3-ai/0-common.md` 파일 전체
  - 위반 규약: CLAUDE.md 명명 컨벤션 표 — `spec/<영역>/0-common.md` 는 "카테고리 공통 규약" 으로 정식 패턴이며, 해당 패턴은 준수되어 있다
  - 상세: 파일명 `0-common.md` 는 CLAUDE.md 의 `0-common` prefix 패턴에 정합한다. 단, 본 파일은 `## Rationale` 섹션이 없어 권장 3섹션 구성(Overview / 본문 / Rationale)의 Rationale 이 누락되어 있다
  - 제안: 문서 말미에 `## Rationale` 섹션을 추가하거나, 다른 AI 노드 상세 문서(1-ai-agent.md §12)로의 링크로 대체 표시. 엄격한 위반은 아니나 규약 권장사항 미준수

- **[INFO]** `2-text-classifier.md` — `## Rationale` 섹션 없음
  - target 위치: `spec/4-nodes/3-ai/2-text-classifier.md` 전체
  - 위반 규약: CLAUDE.md §프로젝트 스펙 문서 — "본문 끝에 `## Rationale` 섹션을 권장"
  - 상세: `1-ai-agent.md` 는 §12 Rationale 을 갖고, `3-information-extractor.md` 도 info extractor 특유의 설계 결정을 담아야 하나, `2-text-classifier.md` 와 `3-information-extractor.md` 모두 Rationale 섹션이 확인되지 않는다. 권장(WARNING 수준 아님) 사항 누락.
  - 제안: `2-text-classifier.md`, `3-information-extractor.md` 말미에 `## Rationale` 섹션 추가. 다음 spec 개정 시 함께 반영 예정으로 주석 처리해도 무방.

- **[INFO]** `3-information-extractor.md` §5.1 config echo 필드명 불일치
  - target 위치: `spec/4-nodes/3-ai/3-information-extractor.md` §5.1 JSON 예시 `config.schema` 키
  - 위반 규약: `spec/conventions/node-output.md` Principle 7 — `NodeHandlerOutput.config` 는 사용자가 설정한 필드 이름을 **그대로** echo
  - 상세: §1 의 config 정의에서 필드명은 `outputSchema` 이나, §5.1 의 JSON 예시에서는 `config.schema` 로 echo 되어 있다. 필드명 불일치. 후속 노드가 `$node["X"].config.outputSchema` 로 접근할지 `config.schema` 로 접근할지가 불명확해진다.
  - 제안: `spec/4-nodes/3-ai/3-information-extractor.md` §5.1 JSON 예시의 `"schema"` 키를 `"outputSchema"` 로 수정하거나, §5.1 표의 `config.schema` 설명을 `config.outputSchema` 로 통일. 또는 config echo 시 `outputSchema` → `schema` 로 별칭 매핑하는 의도라면 §5 의 Config echo 정책 주석에 명시.

- **[WARNING]** `1-ai-agent.md` §7.4 — `meta.interactionType` 이 `output.interaction` 아닌 `meta` 에 위치
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §7.4 (Waiting 상태 출력 구조), `meta.interactionType: "ai_conversation"` 필드
  - 위반 규약: `spec/conventions/node-output.md` Principle 2 — `meta` 는 실행 메트릭만 담는다. Principle 1 의 분류 표 — "사용자 상호작용 데이터는 `output.interaction`" 에 위치.
  - 상세: `meta.interactionType: "ai_conversation"` 은 run-results UI 의 "conversation Preview 탭 식별자" 로 설명되어 있으나, Principle 2 의 권장 `meta` 필드 목록(`model`, `inputTokens`, `outputTokens`, `totalTokens`, `thinkingTokens`, `toolCalls`, `contextInjection`)에 `interactionType` 은 포함되어 있지 않다. 탭 판별용 UI hint 라면 `output` 영역이 맞고, 실행 메트릭이라고 보기 어렵다. 다만 §7.4 표 설명에서 "Principle 1.1.4 의 노드 판별자가 아니라 인터랙션 타입 라벨" 이라고 별도 언급하여 정합성을 설명하려 시도한다.
  - 제안: `meta.interactionType` 의 위치를 재검토한다. UI hint 성격이면 `output.interaction.type` (기존 `output.interaction` 구조와 통합) 또는 별도 `output.interactionType` 으로 이동. `meta` 에 두는 이유가 "UI 탭 식별" 이라면 Principle 2 위배이므로 규약을 갱신하거나 위치를 바꾸어야 한다. 현재 구현이 이미 `meta.interactionType` 를 사용하고 있다면 규약(`spec/conventions/node-output.md` Principle 2)에 예외 항목으로 명시하는 것도 방법.

- **[WARNING]** `1-ai-agent.md` §7.4 — `output.result.message` (단수) 필드가 `output.result.messages` 와 함께 병존
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §7.4 JSON 예시 및 §7.5
  - 위반 규약: `spec/conventions/node-output.md` Principle 8.1 — 불필요한 중첩/중복 금지. Principle 1.1 — config ↔ output 직교성.
  - 상세: §7.4 의 `output.result` 에는 `messages` (누적 배열) 와 별도로 `message` (현재 턴 assistant 응답, 단수 문자열) 가 함께 존재한다. §7.4 의 표에 따르면 `output.result.message` 는 "현재 턴의 assistant 응답 (waiting 시점) — 첫 진입 시 `""`" 이다. `messages` 배열의 마지막 assistant 항목과 내용이 중복될 수 있어 Principle 8 의 중복 제거 정신에 어긋난다. §7.5 (`resumed`) 에는 `message` 가 없고 `messages` 만 있어 두 상태 간 shape 이 달라진다.
  - 제안: `output.result.message` (단수) 를 제거하고 다운스트림이 `output.result.messages[messages.length-1].content` 로 마지막 assistant 메시지에 접근하도록 가이드. 또는 `message` 를 정식 편의 필드로 명시하고 Principle 8 에 이중 표기 예외로 등재. 현재 spec 에 D6 결정(2026-05-17)으로 `messages` 경로 단일화가 진행 중이므로 `message` 단수 필드 폐기를 D6 범위에 포함시키는 것이 자연스럽다.

- **[WARNING]** `3-information-extractor.md` §5 케이스 색인 — `§5.2` 번호가 건너뜀
  - target 위치: `spec/4-nodes/3-ai/3-information-extractor.md` §5 케이스 색인 헤더
  - 위반 규약: `spec/conventions/node-output.md` Principle 11 — Output 문서화 규칙. Case 별 분리 원칙.
  - 상세: §5 케이스 색인 주석에 "§5.1 (정상 — `out`) · §5.3 (에러)" 로 정의되어 §5.2 가 없다. 이는 color 다음 경우가 단순히 없는 것이지만, 번호 체계가 ai_agent(§7.1~§7.9) 와 달리 중간이 비어 있어 문서 독자에게 혼란을 줄 수 있다. (§5.4 Waiting, §5.5 Resumed, §5.6 종결 4종도 있어 전체 섹션 번호는 §5.1, §5.3, §5.4, §5.5, §5.6 으로 §5.2 가 공석)
  - 제안: §5.2 에 빈 케이스가 있거나 의도적으로 번호를 비운 것이라면 케이스 색인 주석에 "§5.2 — (예약/없음)" 로 명시. 또는 번호를 재배정하여 §5.1(정상), §5.2(에러), §5.3(Waiting), §5.4(Resumed), §5.5(종결 4종)로 연속 번호로 재편. `2-text-classifier.md` 는 §5.1~§5.3 을 연속으로 사용하는데 `3-information-extractor.md` 는 §5.1/§5.3/§5.4/§5.5/§5.6 으로 번호 규칙이 다르다.

- **[CRITICAL]** `spec/conventions/cafe24-api-catalog/_overview.md` — 파일명이 `_overview.md` 로 언더스코어 prefix 사용
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` 파일명
  - 위반 규약: CLAUDE.md 명명 컨벤션 표 — `spec/<영역>/_product-overview.md` (언더스코어 prefix) 는 "영역의 제품 정의(옛 PRD). 다중 spec 파일을 가진 영역에 둔다". `spec/conventions/*.md` 는 **평문** 파일명을 사용해야 한다.
  - 상세: `spec/conventions/` 하위 파일은 "정식 규약(노드 Output, Swagger 등)" 으로, 명명 컨벤션 표에서 패턴이 **평문**(언더스코어 prefix 없음) 으로 명시되어 있다. `_overview.md` 의 언더스코어 prefix 는 "영역의 제품 정의" 를 의미하는 `spec/<영역>/_product-overview.md` 패턴과 혼동될 수 있다. conventions 폴더 내에서 `_overview.md` 라는 파일명은 규약 정의와 충돌한다. 단, 실제로 `_overview.md` 가 cafe24-api-catalog **하위 디렉토리**의 인덱스 파일로 사용되고 있어 `_product-overview.md` 의미로 쓰인 것이 아닌, 특별한 하위 디렉토리 인덱스로 사용된 것으로 보임. CLAUDE.md 에 `spec/conventions/` 하위 디렉토리(카탈로그) 내 언더스코어 파일에 대한 명시적 예외가 없다.
  - 제안: `spec/conventions/cafe24-api-catalog/_overview.md` 를 `spec/conventions/cafe24-api-catalog/overview.md` 또는 `spec/conventions/cafe24-api-catalog/0-overview.md` 로 변경. 또는 CLAUDE.md 의 명명 컨벤션 표에 "`spec/conventions/<카탈로그>/` 하위 인덱스는 `_overview.md` 허용" 예외를 추가. 현재 이 파일을 참조하는 다른 spec 링크들도 함께 갱신 필요.

- **[INFO]** `1-ai-agent.md` §4 Tool Area 연동 — 폐기 콘텐츠가 본문에 그대로 유지
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §4
  - 위반 규약: CLAUDE.md §프로젝트 스펙 문서 — "spec/ 하위 문서는 제품의 최종 상태를 정의한다. history 가 아닌 latest 에 대한 기술"
  - 상세: §4 전체가 "⚠ 재작성 예정 (현재 제거됨)" 경고 박스로 시작하며 비활성 상태다. 폐기된 `toolNodeIds` / `toolOverrides` 필드와 Tool Area 연동 스펙이 본문에 그대로 남아있어 스펙 문서가 "latest" 상태가 아닌 "history" 상태를 기술하고 있다. 단, 새 도구 연결 입력 경로 디자인이 미결정인 상태에서 경고 박스로 보존하는 것은 구현자 혼란 방지 목적으로 이해할 수 있다.
  - 제안: 재설계가 결정될 때까지 §4 본문은 "재설계 예정, 현재 비활성" 한 줄로 요약하고 세부 내용은 `plan/` 또는 `## Rationale` 에 이동. spec 문서에 이미 폐기된 API 구조가 상세히 기술되어 있으면 구현자가 폐기 여부를 놓칠 위험이 있다. 단, 현재 상태가 의도적 보존이라면 규약 갱신 필요는 없음.

- **[INFO]** 문서 구조 — `0-common.md` §11 CHANGELOG 위치
  - target 위치: `spec/4-nodes/3-ai/0-common.md` §11 CHANGELOG
  - 위반 규약: CLAUDE.md §프로젝트 스펙 문서 — 권장 3섹션 (Overview / 본문 / Rationale). 본문 끝에 `## Rationale` 권장.
  - 상세: `0-common.md` 의 마지막 섹션이 `## 11. CHANGELOG` 로 끝나며 `## Rationale` 이 없다. CHANGELOG 는 history 성격으로 spec 최종 상태 원칙과 다소 어긋난다. 단 다른 conventions 파일들도 CHANGELOG 를 유지하고 있으므로 프로젝트 내 관행으로 자리잡은 패턴이다.
  - 제안: CHANGELOG 를 `## Rationale` 뒤에 두거나, CHANGELOG 를 Rationale 의 하위 섹션으로 통합. 엄격한 위반은 아님.

---

### 요약

`spec/4-nodes/3-ai/` 하위 4개 문서(`0-common.md`, `1-ai-agent.md`, `2-text-classifier.md`, `3-information-extractor.md`)는 전반적으로 `spec/conventions/node-output.md`의 Principle 0~11 구조를 잘 따르고 있다. 5필드 invariant(config/output/meta/port/status), `output.result.*` wrapper, `output.error.{code,message,details?}` 표준 shape, Principle 7 config echo, Principle 11 케이스별 문서화가 체계적으로 적용되어 있다.

주요 이슈는 두 가지다: (1) **`spec/conventions/cafe24-api-catalog/_overview.md`** 파일명이 CLAUDE.md 의 conventions 파일 명명 규칙("평문")에 어긋나며 언더스코어 prefix 의미 혼동 우려가 있다(CRITICAL). (2) **`meta.interactionType` 의 `meta` 위치** 가 Principle 2("meta 는 실행 메트릭만") 정신과 맞지 않는다(WARNING). **`output.result.message` (단수) 와 `messages` 중복** 도 Principle 8 관점에서 정리 여지가 있다(WARNING). `3-information-extractor.md` 의 **`config.schema` vs `outputSchema` 필드명 불일치** 는 구현 시점에 혼란을 줄 수 있으므로 확인 필요(INFO).

conventions 카탈로그 파일들(`application.md`, `category.md`, `collection.md` 등)은 `spec/conventions/cafe24-api-catalog/` 하위의 내용이며, `_overview.md` 에 정의된 컬럼 규칙(id/라벨/method/path/scope/restricted/paginated/status/docs)을 일관되게 따르고 있어 내부 형식 준수는 양호하다.

---

### 위험도

MEDIUM

(CRITICAL 1건은 파일명 규약 위반으로 시스템 invariant를 깨는 직접적 기능 오류는 아니나, 명명 컨벤션 체계의 일관성을 훼손한다. WARNING 2건은 구현 착수 전 검토이므로 구현 코드가 spec 의 모호한 부분을 어떻게 해석하느냐에 따라 output 구조 불일치가 발생할 수 있다.)
