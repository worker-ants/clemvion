# Cross-Spec 일관성 검토 — llm_usage_log 문서 정합화 draft

검토 대상: `spec-draft.md`(#501 후속 llm_usage_log 문서 정합화, docs-only)
모드: `--spec`
SoT 기준: `spec/data-flow/7-llm-usage.md §1.3`

## 발견사항

### [Warning] `7-llm-usage.md` §4 표 자체에 동일 클래스의 Text Classifier resume 모호 서술 잔존 — 변경 3(f) 스코프 누락

- target 위치: draft "변경 3 — (f)" (`spec/5-system/4-execution-engine.md:713` + `CHANGELOG.md:25` 만 정정 대상으로 명시)
- 충돌 대상: `spec/data-flow/7-llm-usage.md:163`
  ```
  | Execution | cross-ref | AI 노드 호출 진입. **노드 핸들러(AI Agent / Text Classifier / Information Extractor)가 `LlmCallContext` 로 workflow/execution/node_execution 을 채운다 — 첫 턴은 `ExecutionContext`, resume 턴은 재구성 `state`** (§1.3) |
  ```
- 상세: draft 가 "AI·멀티턴 핸들러(AI Agent / Text Classifier / Information Extractor)는 … resume 턴은 …" 형태의 모호 서술(Text Classifier 도 resume 턴을 갖는 것처럼 읽힘)을 `4-execution-engine.md:713` 과 `CHANGELOG.md:25` 2곳에서만 정정 대상으로 잡았다. 그런데 정확히 같은 패턴("첫 턴은 `ExecutionContext`, resume 턴은 재구성 `state`" — 3개 핸들러를 한 덩어리로 묶음)이 **바로 이 변경의 SoT 로 지정된 `7-llm-usage.md` 자신의 §4 외부 의존 표**에도 남아 있다. 같은 문서 §1.3 캐탈로그(106행: "Text Classifier 단발(`context.*`)")와 §1.3 attribution 요약(113행: "Text Classifier(단발 — resume 없음)")은 이미 정확히 구분해 서술하는데, §4 표만 예전 뭉뚱그림 표현이 남아 있어 **같은 문서 내부에서 §1.3 vs §4 불일치**가 생긴다. 참고로 `CHANGELOG.md:25` 자체는 이 문서의 §1.3·Rationale·**§4 표까지 정정했다고 주장**("spec/data-flow/7-llm-usage.md §1.3 표·Rationale·§4 표와 …정정")하지만 실제로 §4 표 163행은 미정정 상태로 남아 있어, 과거 PR 의 "정정 완료" 주장과 현재 파일 상태가 어긋난다.
- 제안: 변경 3(f) 스코프에 `spec/data-flow/7-llm-usage.md:163` 을 추가해 같은 방식으로 "Text Classifier 단발/resume 없음"을 명시하는 정정을 함께 적용할 것을 권고. SoT 문서 내부에 동일 모호성이 잔존하면 이번 정합화 작업의 목적(#501 계열 attribution 서술 정정)이 부분적으로만 달성된다.

### [Warning] 신설 `§2.16.1 LlmUsageLog` 의 "attribution 3열 주석" 이 §1.3 채움 현황을 재서술 — 중복 SoT drift 위험

- target 위치: draft "변경 2 — (c)", `spec/1-data-model.md` 신설 `### 2.16.1 LlmUsageLog` 항목 중 "attribution 3열 주석: 노드 발(AI Agent·IE 첫 턴+resume, Text Classifier 단발)은 채움. 워크플로우 밖 caller(KB graph 추출·listwise rerank grading·AgentMemory 추출 processor)는 NULL." 문장
- 충돌 대상: `spec/data-flow/7-llm-usage.md` §1.3 캐탈로그(99~122행) + §1.3 attribution 요약(113행) + Rationale "`llm_usage_log` 의 nullable context 컬럼들"(189~208행)
- 상세: draft 자신도 "채움 현황 SoT 는 data-flow §1.3(중복 금지)"라고 명시하지만, 실제로 적어 넣기로 한 문장은 caller 목록·채움/NULL 상태를 **다시 요약해 restate** 하는 내용이다. 이는 정확히 이번 작업의 발단이 된 문제 패턴 — "다른 문서가 §1.3 의 caller 카탈로그를 자기 말로 요약해 두었다가 §1.3 이 갱신될 때 따라가지 못해 stale 화" — 을 `1-data-model.md` 에도 새로 심는 셈이다. 자매 엔티티 `§2.10.1 IntegrationUsageLog`(312~332행)는 이런 "caller 별 채움 현황" 서술을 전혀 갖지 않고 필드 타입/제약/보존기간/인덱스만 기술하는 것과도 대비된다 — data-model.md 의 기존 관례(스키마 사실만 기술, 흐름·caller 서술은 data-flow 문서 책임)에서도 벗어난다.
- 제안: attribution 3열 주석은 caller 목록을 재서술하지 말고 "attribution 채움 현황은 [`llm-usage.md §1.3`](./data-flow/7-llm-usage.md#13-caller-카탈로그-코드-기준) 참고 — 본 절은 스키마 정의만 다룸" 형태의 순수 cross-ref 로 축소할 것을 권고(§2.10.1 의 관례와 정렬). 부득이 caller 예시를 남긴다면 "예: AI Agent/IE/Text Classifier 는 채움, KB·AgentMemory 추출 processor 는 NULL — 상세·전체 목록은 §1.3" 처럼 **비완전 목록임을 명시**해 두 문서가 서로 다른 완전성 수준의 caller 목록을 갖지 않도록 할 것.

### [Info] `LlmUsageLog` entity 의 `@Index` 데코레이터가 3개 인덱스 중 2개만 선언 — draft 서술과 code 표면 차이

- target 위치: draft "변경 2 — (c)" 인덱스 서술: "인덱스: `(workspace_id, created_at DESC)` · `(provider, model, created_at DESC)` · `(workflow_id, created_at DESC) WHERE workflow_id IS NOT NULL` (V014)"
- 충돌 대상: `codebase/backend/src/modules/llm/entities/llm-usage-log.entity.ts:9-14` (TypeORM `@Index` 데코레이터 2개만 선언 — `idx_llm_usage_log_workspace_created_at`, `idx_llm_usage_log_provider_model_created_at`)와 `codebase/backend/migrations/V014__llm_usage_logs.sql`(partial index `idx_llm_usage_log_workflow_created_at` 포함 3개 전부 SQL 로 존재)
- 상세: draft 가 인용하는 3개 인덱스는 실제 DB 에 전부 존재하며 migration SQL 과 정확히 일치한다(불일치 없음). 다만 entity 코드의 `@Index` 데코레이터는 partial index(`WHERE workflow_id IS NOT NULL`) 를 표현하지 못해 2개만 선언돼 있다 — TypeORM decorator 메타데이터만 보면 3번째 인덱스가 "안 보이는" 것처럼 오인될 수 있다. spec 문서(§2.1 표·신설 §2.16.1)는 migration 을 SoT 로 정확히 인용하고 있어 실제 충돌은 아니나, 코드 검토자가 entity 파일만 보고 인덱스 개수를 판단하면 spec 과 어긋난다고 오판할 여지가 있다.
- 제안: 실질 조치 불필요(spec 정확). 필요하면 §2.16.1 각주에 "3번째 인덱스는 partial 이라 entity `@Index` 로 표현되지 않고 migration SQL 에만 존재(다른 엔티티도 동일 패턴)" 한 줄만 덧붙이면 향후 혼선을 줄일 수 있음 — 필수는 아님.

## 재검증 결과에 대한 의견

- 변경 1(a) `13-agent-memory.md:231`·`6-knowledge-base.md:348` — before/after 텍스트 모두 실제 파일과 정확히 일치(citation 검증 완료). after 문구도 `7-llm-usage.md §1.3` 캐탈로그(AgentMemory 추출 processor=chat/NULL·저장·회수=embed/미적재, GraphExtractionService=chat/NULL·RerankService listwise=chat/NULL·EmbeddingService/probe/RAG query=embed/미적재)와 정확히 대응한다. 충돌 없음.
- 변경 2(c) 필드 표 — entity(`llm-usage-log.entity.ts`) + `V014`/`V018` migration 과 nullable·FK on-delete·타입/길이 전부 일치 확인(workspace_id NOT NULL FK CASCADE, workflow/execution/node_execution/llm_config_id nullable FK SET NULL, provider varchar(50)/model varchar(100) NOT NULL, tokens Integer default 0, thinking_tokens nullable(V018)·cost 미포함, cost_usd numeric(12,6) nullable). `llm_config_id` FK 대상은 `V088__model_config_rename_kind.sql` 의 `ALTER TABLE llm_config RENAME TO model_config`(in-place rename, FK 제약 보존)로 실제로 `model_config`(§2.16 ModelConfig)를 가리키는 것도 확인 — §2.16 자체가 이미 "`llm_usage_log.llm_config_id`" 참조를 명시하고 있어 정합. 중복 SoT 위험은 위 Warning 항목 참고.
- 변경 3(f) — `text-classifier.handler.ts` 코드 확인 결과 `state.*`/resume/multi-turn 관련 코드 경로가 전혀 없고 `context.nodeExecutionId` 만 사용하는 단발 핸들러임을 코드로 재확인. exec-engine.md:713 인용도 정확. 잔여 스코프 누락은 위 Warning(§4 표) 참고.
- no-op (b) — `spec/2-navigation/7-statistics.md`, `spec/2-navigation/9-user-profile.md` 전체를 grep 했으나 "attribution"·"갭"·"llm_usage_log"·"캐비어트" 관련 문구 0건. no-op 판정 타당.
- no-op (d) — `spec/4-nodes/3-ai/1-ai-agent.md:717-720`, `spec/5-system/4-execution-engine.md`(§1.3, R1, resume/retry addendum) 전체에서 "조작 필드"/"식별 필드" 2채널 구분이 이미 반영돼 있음을 확인(#884/#877/#879 이력과 일치). no-op 판정 타당.

## 요약

핵심 3건 변경(1a·2c·3f) 은 인용된 file:line 이 모두 실제 파일과 정확히 일치하고, 제안된 after 텍스트도 `spec/data-flow/7-llm-usage.md §1.3` 캐탈로그 및 code(entity/migration/handler)와 대조했을 때 사실관계 오류가 없다. no-op 판정 2건(b·d)도 독립 검증 결과 타당하다. 다만 두 가지 개선 여지가 있다: (1) 변경 3(f) 가 정정하려는 "Text Classifier 도 resume 턴을 갖는 것처럼 읽히는" 모호 서술이 정확히 같은 형태로 SoT 문서인 `7-llm-usage.md` 자신의 §4 표(163행)에도 남아 있어 스코프 확장이 필요하고, (2) 신설 `§2.16.1` 의 attribution 요약 문장이 `§1.3` 의 caller 채움 현황을 재서술해 향후 drift(이번 작업의 발단이 된 문제 패턴 자체)를 재생산할 소지가 있다. 두 건 모두 CRITICAL 급 모순은 아니며(문서 내부 불일치·중복 표현 수준), target 텍스트를 소폭 보강하면 해소된다.

## 위험도

LOW
