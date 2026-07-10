# 정식 규약 준수 검토 — A3 CRITICAL 해소 재검증 (convention_compliance)

대상: `spec/1-data-model.md` §2.16.1 LlmUsageLog 신설(작업트리 diff) + 연동 변경
(`spec/data-flow/7-llm-usage.md` §2.1, `spec/data-flow/6-knowledge-base.md`,
`spec/data-flow/13-agent-memory.md`).

## 발견사항

- **[WARNING]** LlmUsageLog.llm_config_id FK 표기가 문서 전역의 "ModelConfig 우선 표기" 관행과 어긋남
  - target 위치: `spec/1-data-model.md` §2.16.1, line 621 — `| llm_config_id | UUID? | FK → llm_config (=ModelConfig chat kind, SET NULL). 호출에 쓰인 config (JSONB \`config.llmConfigId\` 유래도 가능) |`
  - 위반 규약: 명문화된 `spec/conventions/**` 항목은 없음 — 그러나 본 문서(`1-data-model.md`) 자신의 §2.16 Rationale("단일 테이블(kind 판별)" — `llm_config`→`model_config` V088 rename 후 **ModelConfig 가 현재 정식 엔티티명**)과, 같은 FK 를 참조하는 기존 3개 선례가 이미 확립한 표기 패턴(명명 규약 관점)에서 벗어남: `AssistantSession.llm_config_id`(line 768) `FK → ModelConfig (kind=chat)`, `KnowledgeBase.extraction_llm_config_id`(line 350) `FK → ModelConfig (kind=chat)`, `KnowledgeBase.rerank_config_id`(line 358)·`rerank_llm_config_id`(line 361) 도 전부 동일하게 **"ModelConfig" 를 1순위 표기**로 쓴다.
  - 상세: 신규 §2.16.1 만 유일하게 legacy 테이블명 `llm_config` 를 1순위로 적고 `(=ModelConfig chat kind, ...)` 를 괄호 부연으로 격하시켰다. V014 원문 SQL 의 `REFERENCES llm_config(id)` 문자열을 그대로 인용한 것으로 보이나(append-only 라 V014 자체는 rename 반영 안 됨), Postgres 는 rename 을 OID 로 추적하므로 **현재 실제 FK 대상 테이블은 `model_config`** 다(`V088__*.sql` `ALTER TABLE llm_config RENAME TO model_config`). 다른 3곳 선례와 반대 순서라 독자가 "`llm_config` 라는 별도 테이블이 아직 있다"고 오독할 여지가 있다.
  - 제안: `FK → ModelConfig (kind=chat, SET NULL)` 을 1순위로 쓰고, 필요하면 `(V014 원문 컬럼명 llm_config_id 유지, 참조 대상은 V088 rename 으로 model_config)` 식 부연을 뒤에 붙여 다른 3개 선례와 표기 순서를 통일.

- **[INFO]** §3 "인덱스 전략" 전역 표에 LlmUsageLog 미등재 — "동형" 주장의 일부만 충족
  - target 위치: `spec/1-data-model.md` §2.16.1 line 631(`**인덱스**: ...`) vs `## 3. 인덱스 전략` 표(852~901행)
  - 위반 규약: 없음(이 표의 등재 기준을 규정하는 `spec/conventions/**` 문서 없음 — 문서 내부 관행 관찰)
  - 상세: 이번 수정의 근거는 "§2.10.1 IntegrationUsageLog·§2.23 AgentMemory 와 동형"인데, 그 두 엔티티는 **인라인 `**인덱스**:` 서술 + §3 전역 표 등재를 모두** 갖는다(IntegrationUsageLog → 899~900행 2개 행, AgentMemory → 890~893행 4개 행). 반면 신설 LlmUsageLog 는 인라인 서술만 있고 §3 에는 행이 없다. (다른 `.1`~`.4` 서브 엔티티 다수도 §3 미등재라 전역적으로 강제되는 규칙은 아니지만, 저자가 명시적으로 인용한 두 "동형" 파트너 모두 등재돼 있다는 점에서 부분적 괴리.)
  - 제안: §3 에 `LlmUsageLog | (workspace_id, created_at DESC) | ...` 등 3행 추가로 완전한 "동형"을 만들거나, 그대로 두려면 커밋 메시지/PR 설명에서 "동형" 범위를 "필드표·오프너·도입산문·인덱스 서술" 로 한정(§3 전역등재는 제외)한다고 명시.

- **[INFO]** `spec/1-data-model.md` line 610 "관련 문서" 오프너가 파일 내 기존 패턴과 다른 하위 스타일 사용
  - target 위치: `spec/1-data-model.md` §2.16.1, line 610 — `> 관련 문서: [Spec LLM Usage §1.3(Caller 카탈로그)·§2.1(스키마/인덱스)·§4(외부 의존)](./data-flow/7-llm-usage.md) — 적재 정책·attribution 채움 현황 SoT`
  - 위반 규약: 없음(마크다운 링크 스타일은 `spec/conventions/**` 로 규율되지 않음)
  - 상세: 파일 내 기존 "관련 문서" 오프너는 항목별 개별 `[텍스트](href)` 링크를 ` · ` 로 나열(예: line 11 파일 최상단, line 315 IntegrationUsageLog `[Spec 통합 화면 §Recent activity](...)·[PRD 통합/연동 INT-US-05](...#앵커)`)하며, 특정 섹션을 가리킬 때는 href 에 앵커를 포함한다. 신규 오프너는 세 섹션 라벨(§1.3·§2.1·§4)을 **하나의 링크 텍스트**에 압축하고 href 는 앵커 없이 파일 루트만 가리켜, 클릭해도 해당 섹션으로 스크롤되지 않는다.
  - 제안: 굳이 통일할 필요는 없으나(규약 위반 아님), 세 개의 개별 앵커 링크로 쪼개면 다른 절과 스타일이 맞고 클릭 시 실제 이동도 가능해진다.

- **[INFO]** `7-llm-usage.md` §2.1 신규 크로스링크 라벨 "엔티티" — 관용 라벨과 어휘 차이
  - target 위치: `spec/data-flow/7-llm-usage.md` line 133 — `` `llm_usage_log` ([엔티티 §2.16.1](../1-data-model.md#2161-llmusagelog)) ``
  - 위반 규약: 없음(링크 라벨 어휘는 정식 규약 대상 아님) — href·앵커는 §2.16.1 실제 heading slug 와 정확히 일치(GitHub 슬러그 규칙상 `.` 제거 → `2161-llmusagelog`), 기능적으로 정확함.
  - 상세: 저장소 전역에서 `1-data-model.md` 특정 섹션을 가리킬 때 관용적으로 쓰는 라벨은 "데이터 모델 §X.Y" / "Spec 데이터 모델 §X.Y"(예: `spec/2-navigation/4-integration.md:17` `[데이터 모델 - IntegrationUsageLog](../1-data-model.md#2101-integrationusagelog)`, `spec/data-flow/10-triggers.md:220` 등 다수). 이번 추가만 "엔티티" 라는 다른 어휘를 쓴다.
  - 제안: "데이터 모델 §2.16.1" 로 맞추면 향후 grep/일관성 점검에 유리하나 필수는 아님.

## 검증 확인 사항 (참고, 문제 없음)

- §2.16.1 신규 필드 표 14컬럼은 `codebase/backend/migrations/V014__llm_usage_logs.sql`(13컬럼) + `V018__llm_usage_thinking_tokens.sql`(`thinking_tokens` 1컬럼) 과 컬럼명·nullable·default·FK cascade 정책(workspace_id=CASCADE, 나머지=SET NULL) 이 정확히 일치.
- 인덱스 서술(`(workspace_id, created_at DESC)` · `(provider, model, created_at DESC)` · `(workflow_id, created_at DESC) WHERE workflow_id IS NOT NULL`)도 V014 의 3개 `CREATE INDEX` 와 일치.
- 신규 서브섹션은 `spec/data-flow/0-overview.md ## Rationale`("`1-data-model.md` = 엔티티 *정의* 단일 진실", "도메인 문서 Schema 매핑 표는 컬럼 전체를 복사하지 않고 1-data-model.md 를 링크")와 정합 — `7-llm-usage.md §2.1` 의 Sink 행은 여전히 발췌(컬럼명만 나열)이고 이제 §2.16.1 링크까지 추가돼 SoT 위임 관계가 더 명확해짐. 직전 CRITICAL(§2.16.1 "lean 포인터"로 필드 표 없이 신설하려던 시도가 §2.10.1/§2.23 의 "모든 엔티티 full 표" 관행과 상충)은 **해소됨** — 신규 §2.16.1 은 다른 모든 엔티티와 동형의 `> 관련 문서:` 오프너 + 도입 산문 + 필드 표 + 인덱스 서술 구조를 갖춘다.
- `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` 재실행 결과 11/11 PASS 확인(`./data-flow/7-llm-usage.md` 상대경로·앵커 포함).
- ERD 트리(line 38) `LlmUsageLog (1:N)` 이 Workspace 서브트리에 CASCADE 부모(Workspace)와 일치하는 위치에 정확히 삽입됨. 헤딩 앵커 중복 없음(`### 2.16.1` 단일).

## 요약

직전 회차 CRITICAL(§2.16.1 을 필드 표 없는 lean 포인터로 신설하려다 `spec/data-flow/0-overview.md ## Rationale`("1-data-model.md = 엔티티 정의 단일 진실")·§2.10.1/§2.23 의 "모든 엔티티 full 표" 관행과 상충)은 이번 수정으로 완전히 해소되었다. 신설된 `spec/1-data-model.md` §2.16.1 LlmUsageLog 는 필드 14컬럼이 `V014`+`V018` DDL 과 정확히 일치하고, FK cascade 정책·인덱스 서술도 실측과 부합하며, `7-llm-usage.md`/ERD 트리와 모순이 없다. 다만 (1) `llm_config_id` FK 표기가 문서 전역에서 이미 확립된 "ModelConfig 우선 표기" 선례(AssistantSession·KnowledgeBase 3건)와 반대 순서를 취해 명명 규약 관점의 WARNING 대상이며, (2) 저자가 명시한 "IntegrationUsageLog·AgentMemory 와 동형" 주장 중 §3 전역 인덱스 표 등재 부분은 실제로는 반영되지 않았고, (3) 관련 문서 오프너 링크 스타일과 (4) 신규 크로스링크 라벨 어휘가 기존 관용 패턴과 소폭 다르다 — 모두 `spec/conventions/**` 에 명문화된 규칙을 위반하는 것은 아닌 INFO 성 관찰이다. 신규 CRITICAL 은 없다.

## 위험도

LOW
