# Spec 감사 — 4-nodes

## 요약

- **감사 파일 수**: 46개
- **severity 분포**: none 2 / minor 12 / major 28 / severe 4
- **핵심 메시지**:
  1. **카테고리·노드 카운트 stale**가 영역 전반에 걸쳐 반복됨 — Integration "3종"(실제 cafe24 포함 4종), Presentation "6종"(실제 5종), 동적 포트 ID "UUID v4"(실제 slug), Custom/Marketplace/샌드박싱은 미구현 vaporware 인데 구현된 듯 서술 (`0-overview.md`, `_product-overview.md`, `4-integration/_product-overview.md`).
  2. **컨테이너 노드 출력 계약 불일치가 가장 위험** — Parallel `done` 포트가 allSettled-shape 가 아닌 raw 배열 + 제거됐다던 `count` 잔존(severe), Loop/ForEach `count`·`$loop.count`·`$item.isFirst`·`port:'done'`·`meta.durationMs` drift, Code 노드 `$helpers`/`$node` 전역 미주입(severe).
  3. **공통 drift 패턴 2종**: ① 캔버스 요약 `summaryTemplate` 부재(presentation/ai/flow/data/integration 다수 노드) ② `§6 에러 메시지` 한국어 인용 vs 코드 영문 SoT(i18n 번역 결과를 SoT 로 오인) — 후자는 거의 모든 노드 spec 에 공통으로 나타나는 minor.

---

## 파일별 발견사항

### spec/4-nodes/0-overview.md — major / partial / patch-content, add-frontmatter

영역 기술개요. 아키텍처/엔드포인트/카테고리는 잘 맞으나 동적 포트ID·Integration 노드 수·미구현 marketplace/샌드박싱이 구현된 듯 서술됨.

| claim | reality | evidence |
| --- | --- | --- |
| §1.3 동적 포트는 UUID v4 할당, 편집에도 불변 | 실제는 case/category/button id 파생 slug (`^[a-zA-Z0-9_-]{1,64}$`). UUID v4 생성 없음 | `nodes/core/port-id.util.ts:17,38`; `frontend/src/lib/node-definitions/resolve-dynamic-ports.ts:23` |
| §2.4 Integration 노드 (3종) | cafe24 포함 실제 4종 (`type:'cafe24', category:'integration'`) | `nodes/index.ts:25,63`; `nodes/integration/cafe24/cafe24.schema.ts:130-131` |
| §3 카테고리 표에 'Custom (마켓)' 행 | NodeCategory enum 에 custom 없음 (7개만) | `modules/nodes/entities/node.entity.ts:15-23`; `nodes/core/categories.ts` |
| §4 노드 플러그인 인터페이스(manifest/marketplace 표준) | marketplace/plugin/manifest 구현 전무. 빌트인만 정적 배열 부트스트랩 | grep 0건; `nodes/index.ts ALL_NODE_COMPONENTS` |
| §5 per-node 30초 타임아웃/메모리/FS 샌드박싱 | per-node 샌드박스 미발견. sub-workflow 300_000ms 만 존재 | `modules/execution-engine/execution-engine.service.ts:2573` |
| §1.0 공유 유틸은 `_shared/`·`_base/` 에 배치 (minor) | ai 카테고리는 `ai/shared/` (언더스코어 없음)로 컨벤션 불일치 | `nodes/ai/shared/system-context-prefix.ts` |
| §1.0 core 폴더 파일 목록 ~8개 (minor) | 실제 core/ 에 23개 .ts — 목록 stale | `ls nodes/core/` |

- **frontmatterIssues**: frontmatter 전무(status/code/id 없음). 최소 `code: nodes/**` 및 status 부여 권장 — 현재 spec-impl evidence 추적 불가.
- **structuralNotes**: §2.4 노드 수 카운트가 drift. §3 Custom 행·§4 전체는 미구현 marketplace 비전이므로 backlog/spec-only 분리 또는 'Planned' 마킹 권장.

### spec/4-nodes/1-logic/0-common.md — major / implemented / patch-content, fix-code-paths

대부분 정확하나 ConditionGroup 중첩구조·Parallel errorPolicy·Background 포트명 drift.

| claim | reality | evidence |
| --- | --- | --- |
| §1 ConditionGroup = logicalOperator(and/or)+conditions[] 2계층 | `logicalOperator` 필드 코드 0건. 실제는 단일조건 flat 배열 + top-level combineMode 1계층 | `if-else.schema.ts:25-47,53,82`; `filter.schema.ts:8,15,63` |
| §1 If/Else·Switch·Filter·ForEach 가 ConditionGroup 공통 사용 | ForEach 는 arrayField+errorPolicy 만, Switch 는 cases 구조. 실제 condition 배열 사용은 if_else/filter 둘뿐 | `foreach.schema.ts:17-18`; `switch.schema.ts:47-48` |
| §4 Parallel errorPolicy = stop/skip/continue | Parallel enum = `['stop','continue','cancel-others-on-fail']` — skip 없고 cancel-others-on-fail 추가. Map/ForEach 만 stop/skip/continue 일치 | `parallel.schema.ts:73-82,144-150` |
| §10/§11 Background 2번째 포트 'bg' (minor) | 실제 포트 id 'background' (label 'Background'). 'bg' 코드에 없음 | `background.schema.ts:67-72`; `background.handler.ts:78` |
| §6 Parallel maxConcurrency 0 = 무제한 (minor) | ui hint = '0 = same as branchCount' — branchCount 와 동일 | `parallel.schema.ts:45-57,116-124` |

- **frontmatterIssues**: 핵심 평가 SSOT `nodes/core/condition-evaluator.util.ts` 와 errorPolicy 오버라이트가 있는 `execution-engine.service.ts` 가 글로브 미포함 → fix-code-paths 권장. 본문을 코드 현실(flat conditions+combineMode)에 맞춰 patch 하면 implemented 유지 가능.

### spec/4-nodes/1-logic/1-if-else.md — major / implemented / patch-content

config/포트/실행로직/출력은 정합. regex 연산자 no-op·에러 메시지 언어만 drift.

| claim | reality | evidence |
| --- | --- | --- |
| §6 regex 연산자가 If/Else/Switch/Filter/Transform 모두 동일 동작 | If/Else 핸들러가 compiledRegex 미전달 → `case 'regex'` 항상 false (no-op). Filter/Transform 만 실제 매칭. 코드 주석도 명시 | `if-else.handler.ts:52-54`; `condition-evaluator.util.ts:150-154,84-86` |
| §6 에러 메시지 한국어 '최소 1개 이상의 조건...' (minor) | warningRule 실제 영문 'At least one condition must be added.' | `if-else.schema.ts:162,167` |

- §1 config·§3 포트·§5 출력 구조는 모두 코드와 정합 확인.

### spec/4-nodes/1-logic/10-parallel.md — severe / partial / patch-content, fix-code-paths

`done` 포트 출력 구조가 spec 약속과 근본적으로 다름.

| claim | reality | evidence |
| --- | --- | --- |
| **done.branches[i] 는 allSettled 모델** ({status, value/error}) | 엔진은 raw terminal output 을 `unknown[]` 로 push. status/value/error 래핑 전무 → 표현식 예시 동작 안 함 | `execution-engine.service.ts:7742-7760` |
| **count 필드는 제거됨** (branches.length 가 SSOT) | 엔진이 `{ branches, count: branchResults.length }` 로 내보냄 — count 잔존 | `execution-engine.service.ts:7758-7759,7771` |
| **branches[i].error.code/message 포함**, 'UNKNOWN_ERROR' fallback | done 에 분기 에러 정보 전무. failures[] 수집하나 branches 에 미매핑. 'UNKNOWN_ERROR' 0건 | `execution-engine.service.ts:7740-7772` |
| §6 에러 메시지 한국어 (minor) | 실제 영문 'branchCount must be an integer.' 등 | `parallel.schema.ts:108-152,181` |
| errorPolicy fallback / 중첩 clamp / cancel-others-on-fail | 모두 코드와 정확히 일치 (검증됨) | `execution-engine.service.ts:7660-7676`; `parallel-executor.ts:46,103-152,182` |

- **frontmatterIssues**: 글로브가 `nodes/logic/parallel/*.ts` 만 가리켜 실제 구현 `containers/parallel-executor.ts` 와 `execution-engine.service.ts (runParallel)` 누락 → fix-code-paths. done 출력 미구현으로 partial 강등 권장.

### spec/4-nodes/1-logic/11-merge.md — major / partial / patch-content

config echo 규칙이 코드와 정반대.

| claim | reality | evidence |
| --- | --- | --- |
| §4/§5.1 config 는 strategy/outputFormat 만 echo (timeout/partialOnTimeout dormant) | handler 가 4필드 모두 echo. 주석 'D1 — Echo every non-sensitive schema field' 로 의도적 추가 명시 | `merge.handler.ts:125-142` |
| §1/§4 dormant warningRule 은 blocking 아님, §6 에러표에 미포함 | warningRule 에 severity 없어 default 'blocking' 적용 → validate.valid=false. timeout default=300(>0) 라 기본값만으로 blocking 가능 | `node-summary/src/evaluator.ts:262-279`; `merge.schema.ts:37-47,90-112`; `merge.handler.ts:44` |
| §6 row1 strategy 누락 메시지 한국어 (minor) | 실제 영문 'Merge strategy must be selected.' | `merge.schema.ts:91-94` |
| §4 config echo 출처 (minor) | rawConfig 4필드 echo + DEFAULT 폴백 적용. spec 은 폴백 언급 없음 | `merge.handler.ts:138-141` |

### spec/4-nodes/1-logic/12-background.md — minor / implemented / patch-content

핵심 노드·모니터링 API·격리 컨트랙트 정밀 일치. Rationale 문서 정확도 drift 만.

| claim | reality | evidence |
| --- | --- | --- |
| §Rationale GIN 인덱스 + (executionId, JSONB) 복합 | 실제 V047 은 단일컬럼 B-tree expression 인덱스. GIN/복합 아님 | `migrations/V047__node_execution_background_run_id_index.sql` |
| §8.5 WS completed payload 에 status 'cancelled', failedNodeId | safeEmitRunCompleted 는 'completed'/'failed' 만, failedNodeId 키 없음 | `queues/background-execution.processor.ts:129-157` |
| §8.7 400 INVALID_LIMIT | `@Min(1)@Max(200)` 가 먼저 가로채 resolveLimit 분기 실질 unreachable 가능 | `query-background-run.dto.ts:31-34`; `background-runs.service.ts:136-145` |
| §5.1 meta.jobId? stamp (향후 확장) | scheduleBackgroundBody 가 jobId stamp 안 함 — spec 도 '부재' 명시(일치) | `execution-engine.service.ts:7121-7124` |

- status: implemented 유지 정확.

### spec/4-nodes/1-logic/2-switch.md — major / implemented / patch-content

대부분 일치. reserved case-id 차단 주체가 정반대로 기술됨.

| claim | reality | evidence |
| --- | --- | --- |
| 예약어 case id 차단은 frontend 입력 검증 | 실제 backend `validateSwitchConfig` 의 `RESERVED_CASE_IDS` 에서만 차단. frontend 0건 | `switch.schema.ts:148,163-166` |
| §6 에러 메시지 한국어 (minor) | 영문 'In Value mode, Switch Value must be entered.' 등 | `switch.schema.ts:232,237` |
| 마이그레이션 경로 `backend/scripts/migrate-node-output-refs.ts` (minor) | 실제 `backend/src/scripts/...` (src/ 누락) | `src/scripts/migrate-node-output-refs.ts:191` |
| §6 표에 reserved id 충돌 에러 누락 (minor) | backend 가 reserved port name throw 하나 표에 행 없음 | `switch.schema.ts:163-166` |

- id fallback·requiredWhen·hasDefault·meta.value 제거 등은 모두 일치 확인.

### spec/4-nodes/1-logic/3-loop.md — major / partial / patch-content

output.count 직교성 주장이 코드와 정반대.

| claim | reality | evidence |
| --- | --- | --- |
| §5.2/§5.7 output.count 제공 안 함 (직교 준수, done={iterations}) | 엔진이 `{ iterations, count: iterations.length }` 항상 포함. 테스트도 count:4 단언 | `execution-engine.service.ts:8024-8025`; `execution-engine.service.spec.ts:5935-5941` |
| §4.1 body 에서 $loop.count 접근 가능 | $loop 매핑은 index/iteration/isFirst/isLast 만. count 미노출 → undefined | `expression-resolver.service.ts:91-98`; `loop-executor.ts:85-90` |

- **frontmatterIssues**: 핵심 런타임 동작이 글로브(loop.*.ts) 밖 엔진 코드에 있어 검증 한계. partial 에 가까움.

### spec/4-nodes/1-logic/4-variable-declaration.md — major / partial / patch-content, fix-code-paths

coerceToType array/object 실패 fallback 이 spec(null)과 반대(원본 반환).

| claim | reality | evidence |
| --- | --- | --- |
| §1 coerceToType: array/object JSON.parse 실패 시 null | 실제 실패/비'['/'{' 시작 시 **원본 value 반환** (null 아님) | `coerce-type.ts:23-46` |
| §5.1/§6 coercionWarnings 가 array/object 실패도 가시화 | `raw!==null && coerced===null` 조건만 push. array/object 는 원본 반환이라 절대 안 잡힘 | `variable-declaration.handler.ts:67-73` |
| §6 메시지 한국어 (minor) | warningRule SoT 영문, 한글은 frontend i18n | `variable-declaration.schema.ts:117-128`; `metadata-validation.ts:6` |

- type 기본값·포트·meta 구조는 일치. **frontmatterIssues**: SoT `coerce-type.ts` 가 글로브 밖 → 추가 권장.

### spec/4-nodes/1-logic/5-variable-modification.md — minor / implemented / fix-code-paths, keep

백엔드와 정밀 일치. 프론트 dropdown 잔존 옵션이 major.

| claim | reality | evidence |
| --- | --- | --- |
| operation 화이트리스트 6종 | 백엔드 6종 일치. 그러나 **프론트 select 에 set_field/delete_field 잔존** (백엔드 미지원 → 무효 config 생성) | `frontend logic-configs.tsx:352-353`; `variable-modification.schema.ts:7-14` |
| meta.modifications 마스킹이 `_shared/value-masking.util.ts` 정책 따름 (minor) | 정확히 구현됨. 단 글로브가 _shared/ 미포함 | `_shared/value-masking.util.ts:22-87` |
| §6 메시지 한국어 (minor) | SSOT 영문, frontend 번역 | `variable-modification.schema.ts:166,171` |
| §2 다이어그램 (minor) | recordValues 체크박스 누락(본문엔 문서화됨) | `logic-configs.tsx:368-373` |

### spec/4-nodes/1-logic/9-foreach.md — major / partial / patch-content

$item.isFirst/isLast·port='done'·meta.durationMs 3건 미존재.

| claim | reality | evidence |
| --- | --- | --- |
| §3.3 body 에 $item.isFirst/$item.isLast 제공 | resolver 는 $item(raw)/$itemIndex 만. isFirst/isLast 는 내부 itemContext 전용, 노출 0건 | `expression-resolver.service.ts:99-100`; `foreach-executor.ts:78-83` |
| §5.2/§5.3 envelope 에 port:'done' | runContainer foreach 는 config/output/meta 만 write, port 키 없음 (Parallel 만 stamp) | `execution-engine.service.ts:8051-8064` vs `7757,7772` |
| §5.2 meta.durationMs (engine inject) (minor) | foreach meta = {iterations, skippedCount?} 만. durationMs 는 DB row/WS 만 | `execution-engine.service.ts:7950-7956,8045-8049` |
| §6 메시지 한국어 (minor) | SSOT 영문 'Array field must be entered.' | `foreach.schema.ts:81` |

- **frontmatterIssues**: 핵심 동작이 `containers/foreach-executor.ts`·engine 에 있어 글로브 밖.

### spec/4-nodes/2-flow/0-common.md — major / partial / patch-content, fix-code-paths

meta 4필드·캔버스 요약이 미구현.

| claim | reality | evidence |
| --- | --- | --- |
| §2 meta = {durationMs, recursionDepth, subExecutionId?, mode} | sync 는 `{durationMs}` 1필드만, async 는 meta 미반환. recursionDepth 는 호출 인자만 | `workflow.handler.ts:158-169,115-123` |
| §4 캔버스 요약 '{name} · {mode}' + '⚠ Missing workflow' | workflow 노드에 summaryTemplate 없음 → 요약 비어있음. 'Missing workflow' 0건 | `workflow.schema.ts:184-190`; `node-config-summary.ts:1-5` |
| §2 경고 텍스트 'Workflow not selected' (minor) | 실제 warningRule 'Target workflow must be selected.' | `workflow.schema.ts:179,188` |
| §2.1/§2.2 에러 컨트랙트·재귀 깊이 10 | 정확 일치 (세분 코드 NOT_FOUND/TIMEOUT/QUEUE_FAILED 만 표 누락) | `workflow.handler.ts:33,68-71,202-215` |

### spec/4-nodes/2-flow/1-workflow.md — major / partial / patch-content, fix-code-paths

핸들러/에러코드/포트는 정확하나 셀렉터 UI·요약 템플릿 미구현.

| claim | reality | evidence |
| --- | --- | --- |
| §2 'Target Workflow' 셀렉터 드롭다운 | widget 'workflow-selector' 가 **UnsupportedWidget(스텁)** 으로 매핑. 셀렉터 UI 없음 | `widget-registry.ts:49`; `workflow.schema.ts:75,87` |
| §7 캔버스 요약 템플릿 | workflowNodeMetadata 에 summaryTemplate 없음 (타 노드는 보유) | `workflow.schema.ts:169-192` |
| §4.1 warningRule 한국어 (minor) | 영문 'Target workflow must be selected.' | `workflow.schema.ts:188` |
| §1 MappingDef.expression 타입 unknown (minor) | zod 스키마는 `z.string()` (handler 만 unknown) | `workflow.schema.ts:19-28` |
| W-6 워크스페이스 격리 미기술 (minor) | assertSameWorkspace 로 cross-workspace 차단 구현됨 — spec 누락 | `workflow.handler.ts:99-101`; `execution-engine.service.ts:2562,2665` |

- **frontmatterIssues**: `workflow.component.ts` 누락. 핸들러 출력/에러코드 4종/manual_trigger throw 는 정확 일치.

### spec/4-nodes/3-ai/0-common.md — major / partial / patch-content

§2 Information Extractor KB 지원 과대주장.

| claim | reality | evidence |
| --- | --- | --- |
| §2 AI Agent/Info Extractor 가 knowledgeBases/ragTopK/ragThreshold 로 KB 검색 | Info Extractor 스키마/핸들러에 KB·RAG 필드 전무 (ragSources? passthrough 1곳). KB 는 AI Agent 만 | `information-extractor.schema.ts` grep 0건; `information-extractor.handler.ts:112` |
| §9/§7 Info Extractor KB 적용 (minor) | KB 도구 미노출 — 적용 범위 0-common 본문과 어긋남 | `information-extractor.schema.ts` 필드 목록 |
| §11 System Context Prefix / §3 McpServerRef / §10 v2 hedge | 모두 코드와 정확히 일치 (검증됨) | `system-context-prefix.ts:26-28,268-289`; `ai-agent.schema.ts:18-61,330-341,354-414` |

### spec/4-nodes/3-ai/1-ai-agent.md — minor / partial / patch-content, fix-code-paths

코어 스키마·실행·출력 정합 (partial 적정). 소소한 drift 3건.

| claim | reality | evidence |
| --- | --- | --- |
| §6.1.3.a 미매칭 도구 → tool_call_not_implemented 회신 | 가짜 성공 stub `{result:"Tool <name> executed"}` 회신. tool_call_not_implemented 0건 | `ai-agent.handler.ts:1382-1390` |
| §6.1.3.a matches() 순서 cond→kb→mcp→render→tool | provider 들 먼저, cond 는 그 다음. prefix disjoint 라 결과 동일하나 순서 어긋남 | `ai-agent.handler.ts:2783-2794` |
| §10/§11 aiAgentSummary / 'Default provider not configured' | 심볼/문자열 소스 0건 (schema 주석만) | grep 0 매치 |

- **frontmatterIssues**: tool-providers/ 디렉터리, ai-agent.component.ts, classifyLlmError(execution-engine) 추가 권장. partial 적정.

### spec/4-nodes/3-ai/2-text-classifier.md — major / partial / patch-content

3개 surface 미구현.

| claim | reality | evidence |
| --- | --- | --- |
| §5.3/§6 error.details.retryable **필수** | catch 가 originalInput 만 set. retryable/retryAfterSec 없음. code 항상 'LLM_CALL_FAILED' 하드코딩 | `text-classifier.handler.ts:206-210` |
| §3.2 예약어(out/error/default/done/...) 충돌 검증 | name==='__none__'·id 중복만 거부. 나머지 예약어 검증 0건 | `text-classifier.schema.ts:148-179` |
| §7 캔버스 요약 '{model} · {N} categories' | summaryTemplate 미정의 → 요약 숨김 | `text-classifier.schema.ts:181-223` |
| §6 메시지 한국어 (minor) | 영문 'At least one category must be added.' 등 | `text-classifier.schema.ts:214,219` |

- no-llm-provider warningRule·sanitizeEvidence·port id fallback 은 일치.

### spec/4-nodes/3-ai/3-information-extractor.md — major / implemented / patch-content

error.details.retryable 필수 필드 미구현.

| claim | reality | evidence |
| --- | --- | --- |
| §5.3/§6 output.error.details.retryable 항상 set (필수) | 모든 error 경로 details 에 retryable 미충전. 'retryable' 0건 | `information-extractor.handler.ts:258-268,315-326,820-832,950-990` |
| §6 메시지 한국어 (minor) | 영문 'At least one extraction field must be defined.' 등 | `information-extractor.schema.ts:287,292` |
| §5.5 resumed interaction 출처 'handler' (minor) | handler 는 resumed/interaction emit 안 함 — engine 이 주입 | `information-extractor.handler.ts` grep |
| §8 ConversationThread push (minor) | component 가 conversationThreadService 미주입 → pushExtractorTurn no-op | `information-extractor.component.ts:15` |
| §3.2 out type 'data' (minor) | 프런트 resolve 는 'system', 정적 schema 는 'data' | `resolve-dynamic-ports.ts:98` |

### spec/4-nodes/4-integration/0-common.md — major / partial / patch-content

Handler 계약(§4)은 정합하나 캔버스 요약(§5) 다수 미구현.

| claim | reality | evidence |
| --- | --- | --- |
| §4.2 'INTEGRATION_NOT_FOUND' 공통 에러 코드 | requireEntity 는 'RESOURCE_NOT_FOUND' throw → handler 가 'INTEGRATION_CALL_FAILED' 로 surface. INTEGRATION_NOT_FOUND 는 spec mock 만 | `integrations.service.ts:1108-1124`; `_base/integration-handler-base.ts:137-149` |
| §5 DB Query 요약 '{queryType} · {쿼리}' | database-query.schema.ts summaryTemplate 부재 → 미표시 | `database-query.schema.ts`; `node-config-summary.ts:89` |
| §5 Send Email 요약 'to: {수신자} +N' | send-email.schema.ts summaryTemplate 부재 | `send-email.schema.ts` |
| §5 '⚠ Missing integration' 배지 | 문자열/warningRule 코드 0건 (docs mdx 만) | grep |
| §5 URL 35자 잘림 (minor) | 템플릿 truncate 필터 없음. 실제는 라인 전체 40자 잘림 | `evaluator.ts:292-296`; `node-config-summary.ts:92-98` |
| §4.1 logUsage clampMessage / §4.1 AES-256-GCM / §3/§7 4종 통일 | 모두 정합 (검증됨) | `integrations.service.ts:121-134,758-760`; `crypto.util.ts:3` |

### spec/4-nodes/4-integration/1-http-request.md — major / partial / patch-content

verifySsl·followRedirects 가 무효 옵션.

| claim | reality | evidence |
| --- | --- | --- |
| config.verifySsl (기본 true) SSL 검증 끌 수 있음 | 핸들러가 verifySsl 0번 읽음. rejectUnauthorized/dispatcher 미설정 → 항상 활성 | `http-request.handler.ts` grep 0건; `:260,385` |
| config.followRedirects (기본 true) 5홉 한도 | followRedirects 미참조. redirect:'manual' + integration 일 때만 무조건 5홉 follow | `handler.ts:385,390-406` |
| §1 responseType 'binary' (minor) | else 분기 res.text() — 실제 바이너리 디코딩 없음 | `handler.ts:411-418` |
| §1 bodyType 'binary'/'raw' (minor) | else 분기 — raw 와 동일 | `handler.ts:287-290` |
| §4 step8 SSRF assertSafeOutboundUrl (minor) | DNS rebinding 방어 assertSafeOutboundHostResolved 도 호출 (step8 누락) | `handler.ts:327-328` |

- **structuralNotes**: §5 절 번호 5.1→5.3 점프(5.2 부재) 독자 혼란 소지.

### spec/4-nodes/4-integration/2-database-query.md — minor / implemented / patch-content

본문은 handler/schema 와 정밀 일치. dry-run·abort-signal·error.details 가 spec 미기재(minor).

| claim | reality | evidence |
| --- | --- | --- |
| §5.3/§6.2 output.error.details.driverCode 1급 필드 | handler 는 채우나 databaseQueryNodeOutputSchema.error 가 code/message 만(details 미선언, passthrough) → 타입 surface 누락 | `database-query.schema.ts:41-48` |
| dry-run(재실행 mock) 미기술 (minor) | isDryRun + isWriteOperation 시 buildDryRunMock 단락(SELECT 는 실제 실행). supportsDryRun=true | `database-query.handler.ts:159-171`; `:157` |
| §4 6단계 계약(abort 미기술) (minor) | execute 진입 시 abortSignal aborted → AbortError 사전 throw | `database-query.handler.ts:121-125` |
| §4.6 MySQL SELECT fields (minor) | fields 비배열 시 undefined 반환 — 미세 경로 미명시 | `database-query.handler.ts:280-285` |

### spec/4-nodes/4-integration/3-send-email.md — major / partial / patch-content

에러코드 surface 미라우팅.

| claim | reality | evidence |
| --- | --- | --- |
| §5.3 EMAIL_NO_RECIPIENTS → port:'error' 라우팅 | to.length===0 가드가 try 밖에서 plain Error throw → 노드 실행 자체 실패 (error 포트 미도달) | `send-email.handler.ts:124-126` |
| §5.3 INTEGRATION_NOT_FOUND surface | RESOURCE_NOT_FOUND → catch 에서 EMAIL_SEND_FAILED 로 흡수 | `integrations.service.ts:1108-1122`; `send-email.handler.ts:248-249` |
| §5.3 INTEGRATION_SERVICE_UNAVAILABLE | workspaceId 누락 plain Error → EMAIL_SEND_FAILED 매핑 | `integration-handler-base.ts:54-58` |
| §5 출력 3케이스 (성공/실패/stub) | spec 에 없는 Re-run dry-run 경로 구현됨 (supportsDryRun:true) | `send-email.handler.ts:132-138`; `send-email.schema.ts:277` |
| §4 step6 SSRF 주석 (minor) | spec 정확, 코드 주석 'SMTP_BLOCK_PRIVATE_HOSTS' 가 stale·반대 의미 | `send-email.handler.ts:176-178` |

### spec/4-nodes/4-integration/4-cafe24.md — major / implemented / patch-content, fix-code-paths

본문(포트·에러코드·rate-limit·HMAC)은 정밀 일치하나 MCP Bridge 클래스명/경로 실재 안 함.

| claim | reality | evidence |
| --- | --- | --- |
| §9.2 `src/integrations/mcp/imcp-client.ts` + Cafe24McpBridge | 디렉터리·파일·IMcpClient 심볼 전부 0건. 실제는 `Cafe24McpToolProvider` | `find/grep 0건`; `tool-providers/cafe24-mcp-tool-provider.ts` |
| §8 Cafe24McpBridge.listTools()/callTool() | 클래스 부재(주석만). 실제 buildTools()/execute() | `metadata/index.ts:4,91`; `cafe24-mcp-tool-provider.ts:99,788` |
| frontmatter code 4개 (minor) | mcp-tool-provider/token-refresh.processor/third-party-oauth.controller/install-rate-limit/component 누락 | frontmatter L4-8 |
| §1 dry-run 미언급 (minor) | supportsDryRun=true + re-run dry-run 분기 구현 | `cafe24.schema.ts:141`; `cafe24.handler.ts:178` |

- 포트/에러코드/rate-limit/401 refresh/install HMAC/상수는 모두 일치 확인.

### spec/4-nodes/4-integration/_product-overview.md — major / N/A(PRD) / keep, patch-content

Integration·KB 정합. Marketplace vaporware + 지원서비스 누락.

| claim | reality | evidence |
| --- | --- | --- |
| §4 Marketplace (16개 요구사항, 다수 '필수') | 백엔드/프론트 marketplace 모듈·라우트·식별자 전무 (0% 구현) | grep 0건 |
| §2.6 지원 서비스 5종 (HTTP/DB/Email/Webhook/Cafe24) | service-registry 에 google/github/mcp 3종 추가 등록 (OAuth 동작) — PRD 누락 | `service-registry.ts:287,333,557` |
| §2.3 상태 Enum connected/expired/error, reason 'unknown' (minor) | 'pending_install' 추가, fallback 'unknown_error' | `integration.entity.ts:16-20` |
| §2.2 insufficient_scope 서비스 일반 (minor) | cafe24-api.client 전용 (타 핸들러 0건) | `cafe24-api.client.ts:1005,1017,1318-1322` |

- **structuralNotes**: Marketplace 를 별도 backlog/spec-only 문서로 split 또는 '미구현/계획' 표식 권장.

### spec/4-nodes/5-data/0-common.md — major / implemented / patch-content

Data 인덱스 meta 형태 stale (index/detail drift).

| claim | reality | evidence |
| --- | --- | --- |
| §4 code meta = {success, logs?, error?, errorCode?, exitReason?} | handler 는 {success, logs} 만. error/errorCode/stack 'removed in Phase 1', exitReason 없음. 상세 2-code.md 는 정확 | `code.handler.ts:206,242-244,269-274` |
| §3 Code 요약 '{language} · {N} lines' | code.schema.ts summaryTemplate 없음 (Transform 만 구현) | `code.schema.ts:95-117` vs `transform.schema.ts:228-229` |
| §4 transform meta durationMs 만 (minor) | 실제 {operationsApplied, operationsSkipped} 반환 | `transform.handler.ts:161-165` |

- 상세 2개 문서는 코드와 정합 — 인덱스만 patch.

### spec/4-nodes/5-data/1-transform.md — minor / implemented / keep, patch-content, fix-code-paths

| claim | reality | evidence |
| --- | --- | --- |
| §4.3 object_pick/object_omit 모두 prototype 키 차단 | 차단은 objectOmit 만. objectPick 은 keys 그대로 복사 (차단 없음) | `transform.handler.ts:506-529` vs `531-553` |
| §5.8 메시지 한국어 (minor) | 영문 'At least one transform operation must be added.' / warnMessage 'No operations defined' | `transform.schema.ts:240-246,228-232` |
| §5.1 operationsApplied (minor) | setField 는 prototype pollution 차단 케이스도 applied:true 카운트 — skipped 정의와 미묘 어긋남 | `transform.handler.ts:220-229` |

### spec/4-nodes/5-data/2-code.md — severe / partial / patch-content, fix-frontmatter

핵심 실행 컨텍스트 표면 미구현.

| claim | reality | evidence |
| --- | --- | --- |
| **$helpers (date/crypto/uuid/base64) 전역 주입** | buildSandbox 에 $helpers 전무. schema hint 문자열만 언급 → 사용자 코드에서 ReferenceError | `code.handler.ts:35-90`; `code.schema.ts:53` |
| **$node (현재 노드 메타) 전역 노출** | sandbox 는 $input/$vars/$execution 만. $node 미주입 → ReferenceError | `code.handler.ts:47-49` |
| §1/§2 config.timeout (기본 30, 1~120, UI 위젯) | config schema 에 timeout 필드 없음. passthrough 통과 + 범위검증만 → 에디터 자동 렌더 불가 | `code.schema.ts:37-58,76-93` |
| §6 메시지 한국어 (minor) | 영문 'Body of the code to run must be entered.' | `code.schema.ts:113` |
| §7.3 차단 API 'undefined 셰도잉' (minor) | setTimeout/process/fetch/fs 등은 셰도잉 아닌 미주입(ReferenceError). undefined 셰도잉은 Reflect/Proxy/globalThis 등만 | `code.handler.ts:78-88,143-145` |

- 에러코드 정규화·stack 노출·createContext 옵션은 일치.

### spec/4-nodes/6-presentation/0-common.md — major / implemented / patch-content, keep

고충실도 (bus/합성/backfill/cap 정합). UI 토글·link warning 표현만 drift.

| claim | reality | evidence |
| --- | --- | --- |
| §4.6 excludeFromConversationThread UI 'Advanced > Conversation' 토글 | presentation/AI 노드용 토글 프론트 0 매치. 백엔드 generic enforce 만 | `presentation-configs.tsx` grep 0건; `conversation-thread.service.ts:224` |
| §1.1 link+userMessage '무시 (warning 아님)' (minor) | validateButtons 가 errors 에 push, 테스트는 'advisory warning' — 'warning 아님' 문구와 충돌 | `_shared/button.types.ts:113-119` |
| §4.6 5 노드 모두 excludeFromConversationThread 필드 '가진다' (minor) | 5 schema 어디에도 선언 없음 (AI 노드만). service generic 읽기로 동작 | `presentation/{...}/*.schema.ts` 0 매치 |

- partial 강등까지는 불필요(백엔드 완비). **structuralNotes**: §4→§4.6, §8→§10 절 번호 gap (cosmetic).

### spec/4-nodes/6-presentation/1-carousel.md — minor / implemented / patch-content

| claim | reality | evidence |
| --- | --- | --- |
| §7 에러 메시지 한국어 (minor) | 영문 'In Dynamic mode, a Title field must be entered.' 등 | `carousel.schema.ts:453-469` |
| §1/§4 layout (card/image/minimal) 재구성 (minor) | CarouselContent 가 config.layout 미참조 — 항상 가로 스크롤 카드 | `presentation-renderers.tsx:194-291` |
| §5.1 meta:{durationMs:0} (minor) | 핸들러 non-blocking 은 {config,output} 만 (durationMs engine inject) | `carousel.handler.ts:234` |

### spec/4-nodes/6-presentation/2-table.md — minor / implemented / patch-content

| claim | reality | evidence |
| --- | --- | --- |
| §5.1 config echo = mode/columns/pageSize/sortBy/sortOrder 만 | D1 으로 dataSource/rows/pagination 도 무조건 enumerate (표 누락) | `table.handler.ts:166-177` |
| §4 정렬 'null 항상 끝으로' (minor) | asc 한정. desc 는 null 이 앞으로 | `table.handler.ts:118-126` |
| §1/§6 warningRule 한국어 (minor) | 영문 SoT, i18n 정확 매핑 — drift 아님 | `table.schema.ts:311-322` |

### spec/4-nodes/6-presentation/3-chart.md — minor / implemented / patch-content

| claim | reality | evidence |
| --- | --- | --- |
| §6 caveat (A) '렌더러 구현' 전제 (minor) | ChartContent 가 이미 bar/line/area/pie/donut 5종 렌더. 미해결은 handler.validate 확장뿐 | `chart.handler.ts:22`; `presentation-renderers.tsx:309-362` |
| §4 step1 config.dataSource 사용 (minor) | handler 가 schema 미정의 키 dataSource 에 의존 (§1 표·schema 에 없음, §6 caveat 미명시) | `chart.handler.ts:48-57`; `chart.schema.ts:81-122` |
| §6 에러 메시지 한국어 (minor) | 영문 SoT, i18n 정확 매핑 | `chart.schema.ts:176,181,186` |
| §5/§5.4 출력 (minor) | data 만 emit (일치). chartOutputSchema 는 미사용 legacy export 잔재 | `chart.handler.ts:77,106`; `chart.schema.ts:128-133` |

### spec/4-nodes/6-presentation/4-form.md — major / partial / patch-content, fix-frontmatter

Form 핵심 약속 다수 미구현.

| claim | reality | evidence |
| --- | --- | --- |
| §4 step5/§6.2 서버측 폼 검증(필수/type/validation/file) + 재표시 | waitForFormSubmission 은 화이트리스트 필터만. 검증·재표시 전무 | `execution-engine.service.ts:3216-3256`; `websocket.gateway.ts:375-431` |
| §1.5 file 클라이언트 검증(MIME/size/count reject) | DynamicFormUI 가 FileList 를 그대로 onChange — 검증 0 | `dynamic-form-ui.tsx:181-202` |
| §1 ValidationPreset(phone) regex/share_contact | validationRuleSchema 에 preset 필드 없음. ValidationPreset 코드 부재 | `form.schema.ts:20-29` |
| §1 file 기본값(13종 MIME, 10MB/50MB/5) | 4필드 모두 optional·default 없음. 코드에서 미적용 | `form.schema.ts:71-74`; `dynamic-form-ui.tsx:190` |
| §5.5 resumed meta.durationMs 경과시간 inject (minor) | prevStructured.meta 재사용 → durationMs 0 잔존 | `execution-engine.service.ts:3242-3256`; `form.handler.ts:47` |
| §6.1 메시지 한국어 (minor) | 영문 'At least one field must be defined.' | `form.schema.ts:181-187` |

### spec/4-nodes/6-presentation/5-template.md — major / partial / patch-content

| claim | reality | evidence |
| --- | --- | --- |
| §7 캔버스 요약 'html · 9 lines' / 'html · 2 buttons' | templateNodeMetadata 에 summaryTemplate 전무 → 캔버스 요약 항상 비어있음 | `template.schema.ts:146-173`; `node-config-summary.ts:89` |
| §6 에러 메시지 한국어 (minor) | 영문 'Template body must be entered.' (i18n 번역) | `template.schema.ts:165-171` |

### spec/4-nodes/7-trigger/0-common.md — minor / partial / patch-content, fix-code-paths

Trigger 3종 공통 컨트랙트는 정확 일치. 캔버스 요약만 drift.

| claim | reality | evidence |
| --- | --- | --- |
| §2 Manual Trigger 요약 'Parameters: 2' / '(none)' | manualTriggerMetadata 에 summaryTemplate 부재 → 요약 미생성 | `manual-trigger.schema.ts:50-72` |
| frontmatter code 2개 (minor) | webhook(hooks.service)·schedule(schedule-runner)·manual(workflows.controller)·resolver 누락 | spec frontmatter |

### spec/4-nodes/7-trigger/1-manual-trigger.md — major / implemented / patch-content

| claim | reality | evidence |
| --- | --- | --- |
| §6 4가지 distinct 검증 메시지 (identifier/duplicate/array/type) | validateTriggerParameterSchema 모두 'invalid_schema' 단일 → 'parameters.<field>: invalid_schema' | `resolve-trigger-parameters.ts:67,79,83,94` |
| §6 Manual required 누락 → INVALID_INPUT (minor) | 주 경로 workflows.controller 는 INVALID_TRIGGER_PARAMETERS. INVALID_INPUT 은 re-run 만 | `workflows.controller.ts:297-303` |
| §6 Webhook required 누락 → 400 (minor) | code:'INVALID_WEBHOOK_PAYLOAD' (응답 code 미명시) | `hooks.service.ts:135-145` |
| §5 output 5필드 meta? (minor) | manualTriggerOutputSchema 에 meta 미정의 (handler 는 반환) | `manual-trigger.schema.ts:29-47` |

### spec/4-nodes/7-trigger/providers/discord.md — major / partial / patch-content, fix-frontmatter

| claim | reality | evidence |
| --- | --- | --- |
| §3.1 setupChannel public_key verify + botIdentity.publicKey 저장 | verify_key 타입만, 검증 0. botId 는 int 해시, publicKey 미저장, BOT_TOKEN_INVALID 분기 없음 | `discord.adapter.ts:74-122` |
| §5.1(b) 'v1 default UX' Reply 버튼+clemvion_reply modal | renderAiMessage 가 Reply 버튼 미첨부. __reply__ 분기·modal open 경로 부재 → 도달 불가 | `discord-message.renderer.ts:76-88`; `discord-update.parser.ts:81-116` |
| §5.4 carousel auto v1 embed/image (minor) | imageUrl 무시, bold title+desc 텍스트만. embeds 호출처 없음 | `discord-message.renderer.ts:429-441` |
| §3 sendMessage(image) multipart/embeds (minor) | content 만 POST (v1 미구현 주석) | `discord.adapter.ts:232-238` |
| §3.1 slash desc 'Run workflow' / §3.3 modal title (minor) | 실제 'Workflow assistant' / title 하드코딩 '양식' / min_length·max_length 미부여 | `discord.adapter.ts:86-100,261-283` |

- **frontmatterIssues**: discord-message.renderer.ts(§5 UI 매핑 구현체) 누락.

### spec/4-nodes/7-trigger/providers/slack.md — minor / partial / keep, patch-content

| claim | reality | evidence |
| --- | --- | --- |
| R-S-7 file_shared → files.info 보강 후 submit_form | SlackClient 에 filesInfo 없음. file_upload 'Phase 4 스텁' 주석만 | `hooks.service.ts:586`; `slack-client.ts` |
| §3 sendMessage(text) mrkdwn=true (minor) | mrkdwn 파라미터 미전달 (서버 default true) | `slack-client.ts:38-52` |
| §3.1 botId = raw bot_id (minor) | hashStringToInt 로 int 변환 저장 | `slack.adapter.ts:81-95` |
| §8 백오프 1s/2s/4s (minor) | 실제 1s·2s 두 번 (4s 미사용) | `slack-client.ts:110-160` |
| §5.2 response_url POST / §5.4 uploadV2 (minor) | response_url POST 경로 부재. filesUploadV2 Phase 3 스텁 | `slack.types.ts:70,95`; `slack-client.ts:73-87` |

### spec/4-nodes/7-trigger/providers/telegram.md — major / partial / patch-content

| claim | reality | evidence |
| --- | --- | --- |
| §7 /help 정적안내 발송 | parser 가 /start·/cancel 외 /-prefix null 반환 → /help 도달 불가 (dead). hooks 분기는 text_message='/help' 요구 | `telegram-update.parser.ts:117-120`; `hooks.service.ts:249-267` |
| §8 update_id 30초 dedup | idempotencyKey 채워지나 소비 consumer 0건. dedup 미존재 | `telegram-update.parser.ts:21`; grep 0 consumer |
| §5.1 LLM 직전 sendChatAction typing 1회 | kind:'typing' ChannelMessage producer 0건 — 실제 미발송 | `telegram-message.renderer.ts:94-106` |
| §5.2 editMessageReplyMarkup 중복클릭 차단 (minor) | editMessage 메서드 0건. answerCallbackQuery 만 | `telegram.adapter.ts:244-254` |
| §8 per-chat rate-limit 큐 (minor) | chat 큐/delay 구현 없음 | `telegram-client.ts:183-240` |
| §5.4 carousel auto v1 imageUrl 분기 (minor) | 항상 text. imageUrl 은 `🖼 {url}` 텍스트만. §5.4 매트릭스 내부 모순 | `telegram-message.renderer.ts:814-888` |
| §5.4/§3 image → sendPhoto (minor) | image kind 는 text fallback. sendPhoto 미호출 | `telegram.adapter.ts:212-234` |

- setWebhook secret_token·RESUME_* 분기는 정합.

### spec/4-nodes/_product-overview.md — major / N/A(PRD) / patch-content

| claim | reality | evidence |
| --- | --- | --- |
| §9 헤더 'Presentation 노드 (6종)' | 실제 5종(carousel/chart/form/table/template). 형제 문서들은 5종 — _product-overview.md 만 stale | `_product-overview.md:312` vs `presentation/` 5 dir; `0-overview.md:183` |
| §7 헤더 'Integration 노드 (3종)', cafe24 누락 | cafe24 완전 구현·등록된 4번째 노드 (전용 spec status:implemented) | `_product-overview.md:243` vs `nodes/index.ts:63`; `4-cafe24.md` |
| §6.1 toolNodeIds/toolOverrides 제거 (minor) | 코드 일치하나 표 상태 컬럼 여전히 ✅ (머리말로 보완) | `ai-agent.handler.ts:1922,2869` |

- **structuralNotes**: cafe24 drift 는 형제 0-overview.md §2.4(line 168)에도 동일하게 stale — 함께 보정 권고.

---

## 일치 확인됨 (severity: none)

- **spec/4-nodes/1-logic/6-split.md** — handler/schema 와 1:1 정밀 일치 (config·포트·실행·output·meta 모두 정합). §6 메시지 한/영 표기 차이만 minor.
- **spec/4-nodes/7-trigger/providers/_overview.md** — telegram/slack/discord 3종 adapter·registry 등록·식별자 모두 일치. registry 헤더가 _overview.md 갱신 명시 — 양방향 정합.

> 그 외 minor/major 파일 중 다수 항목도 다수 surface 가 정합 확인됨 (예: 7-map.md, 8-filter.md, 2-database-query.md, 3-ai/_product-overview.md, 5-variable-modification.md 는 본문 대부분 일치하며 minor drift 1~2건만 보유).

---

## 영역 구조·네이밍 이슈

- **노드/카테고리 카운트가 인덱스 문서 3곳에 걸쳐 stale**: `0-overview.md`, `_product-overview.md`, `4-integration/_product-overview.md` 가 Integration "3종"·Presentation "6종" 등을 잔존시킴. cafe24 추가/노드 추가 시 **인덱스 동기화 누락 패턴**. 인덱스 문서에는 노드 수 하드코딩 대신 "하위 N-name 문서 자동 나열" 패턴 또는 갱신 체크리스트 도입 권장.
- **미구현 비전(Marketplace/Custom 카테고리/per-node 샌드박싱/노드 플러그인 인터페이스)이 implemented 본문에 혼재** (`0-overview.md §3~§4`, `4-integration/_product-overview.md §4`). backlog/spec-only 문서로 split 하거나 'Planned/미구현' 명시 마킹으로 spec-만-보는 독자 오해 방지.
- **frontmatter `code:` 글로브가 컨테이너/엔진 SoT 를 누락하는 패턴**이 logic 영역에 반복(parallel/loop/foreach/variable-declaration). 노드 spec 본문이 약속하는 핵심 런타임 동작이 `modules/execution-engine/containers/*`·`expression-resolver`·`coerce-type.ts` 에 있는데 글로브가 `nodes/<cat>/<node>/*.ts` 만 가리켜 evidence 추적 단절 → fix-code-paths 일괄 보강.
- **0-overview.md frontmatter 전무** — 영역 기술개요 문서임에도 status/code 부재로 spec-impl evidence 추적 불가. add-frontmatter.
- **절 번호 gap**(`1-http-request.md` 5.1→5.3, `0-common.md(presentation)` §4→§4.6/§8→§10, `3-send-email.md` 5.1→5.3→5.4)은 대부분 의도된 케이스 공유 컨벤션이나 단독 독해 시 누락처럼 읽힘 — cosmetic.

---

## 우선 액션 (정렬)

**severe**
1. `spec/4-nodes/1-logic/10-parallel.md` — done 포트 출력을 코드 현실(raw `branches[i]` 배열 + `count` 잔존, 분기 에러 미포함)에 맞춰 §3.2/§5.2/§5.7 전면 patch + allSettled-shape/error.code·message 표현식 예시 제거. frontmatter 에 `containers/parallel-executor.ts`·`execution-engine.service.ts` 추가.
2. `spec/4-nodes/5-data/2-code.md` — `$helpers`(date/crypto/base64)·`$node` 전역이 sandbox 에 미주입(ReferenceError)·`config.timeout` schema 필드 부재. 본문 patch 또는 구현 갭으로 backlog 등록. status implemented → partial.

**major (출력 계약/미구현 surface)**
3. `spec/4-nodes/1-logic/3-loop.md` — `output.count` 제공됨/`$loop.count` 미노출 정정 (직교성 주장 반전).
4. `spec/4-nodes/1-logic/9-foreach.md` — `$item.isFirst/isLast`·`port:'done'`·`meta.durationMs` 미존재 정정.
5. `spec/4-nodes/4-integration/3-send-email.md` — EMAIL_NO_RECIPIENTS/INTEGRATION_NOT_FOUND/INTEGRATION_SERVICE_UNAVAILABLE 가 error 포트로 surface 되지 않음(EMAIL_SEND_FAILED 흡수/노드 실패) 정정 + dry-run 경로 문서화.
6. `spec/4-nodes/6-presentation/4-form.md` — 서버측 검증·file 클라이언트 검증·ValidationPreset(phone)·file 기본 제약값 미구현. 본문 patch + status partial. waitForFormSubmission/websocket.gateway code 경로 추가.
7. `spec/4-nodes/2-flow/1-workflow.md` & `2-flow/0-common.md` — workflow-selector(UnsupportedWidget)·summaryTemplate·meta 4필드 미구현 정정.
8. `spec/4-nodes/3-ai/2-text-classifier.md` & `3-information-extractor.md` — `error.details.retryable` 필수 필드 미구현 정정(+text-classifier 예약어 검증·summaryTemplate).
9. `spec/4-nodes/4-integration/1-http-request.md` — verifySsl·followRedirects 무효 옵션 명시(echo only).
10. `spec/4-nodes/1-logic/11-merge.md` — config echo 4필드 정정 + dormant warningRule severity 'blocking' 충돌 정리.
11. `spec/4-nodes/1-logic/0-common.md` & `1-if-else.md` — ConditionGroup 1계층 정정 + If/Else regex no-op 명시.
12. `spec/4-nodes/1-logic/2-switch.md` — reserved case-id 차단 주체 backend 로 정정 + 마이그레이션 경로 src/ 보정.
13. `spec/4-nodes/4-integration/4-cafe24.md` — Cafe24McpBridge/`imcp-client.ts` → Cafe24McpToolProvider/buildTools/execute 로 §8/§9.2 정렬.
14. `spec/4-nodes/3-ai/0-common.md` — §2 Info Extractor KB 지원 과대주장 제거.
15. `spec/4-nodes/4-integration/0-common.md` — INTEGRATION_NOT_FOUND 미사용 + DB/Email summaryTemplate·Missing integration 배지 미구현 정정.

**major (인덱스/카운트 stale, 함께 처리)**
16. `spec/4-nodes/_product-overview.md` + `0-overview.md` + `4-integration/_product-overview.md` — Presentation 6→5종, Integration 3→4종(cafe24), 동적 포트 UUID→slug, Marketplace/Custom/샌드박싱 'Planned' 마킹 일괄 보정. `0-overview.md` frontmatter 추가.
17. `spec/4-nodes/6-presentation/5-template.md` & `5-data/0-common.md` & `7-trigger/0-common.md` & `3-ai/2-text-classifier.md` — summaryTemplate 부재로 캔버스 요약 미구현 일괄 정정(공통 패턴).
18. 트리거 providers — `discord.md`(Reply 버튼/modal·public_key verify 미구현), `telegram.md`(/help dead·dedup·typing 미구현), `slack.md`(files.info 미구현) 본문 'v1 동작' 단정형 → 미구현/Phase 마킹.

**minor**
19. `§6 에러 메시지` 한국어 인용 → 영문 SoT 명시(거의 모든 노드 spec 공통) + i18n indirection 1줄 주석으로 일괄 정리.
20. `5-variable-modification.md` — 프론트 dropdown set_field/delete_field 잔존(백엔드 미지원)은 spec drift 아닌 코드 정리 대상으로 developer 위임.
