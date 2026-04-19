# node-specs-improvement 구현 진행 체크리스트

> 참고 계획: `/Users/gehrig/.claude/plans/user-memo-node-specs-improvement-validated-candy.md`
> 규약 원문: `user_memo/node-specs-improvement/CONVENTIONS.md`
> 개시일: 2026-04-19

## 공통 규칙 (매 스테이지 적용)

- [ ] SDD: spec 문서 먼저 수정
- [ ] TDD: 테스트 수정/추가 먼저, 그 뒤 구현
- [ ] TEST WORKFLOW: lint → unit → integration → build (실패 시 1번부터 재실행)
- [ ] REVIEW WORKFLOW: `ai-review` 스킬 실행, Warning 이상 모두 해결
- [ ] Migration: `migrate-node-output-refs.ts` 에 매핑 확장 → `--dry-run` 로그 기록 → merge 후 `--apply`
- [ ] 각 스테이지 완료 시 `review/<timestamp>/RESOLUTION.md` 작성
- [ ] 이 체크리스트 갱신

---

## Stage 1 — information_extractor 이중 중첩 + LLM 에러 컨트랙트 (P0) ✅

### Spec / 문서
- [x] `spec/4-nodes/3-ai-nodes.md` information_extractor 섹션 재작성 (Principle 11 포맷)
- [ ] `spec/5-system/3-error-handling.md` 에 `output.error` 표준 shape 명시 추가 (Stage 4 에서 확장 예정)

### 테스트
- [x] `backend/src/nodes/ai/information-extractor/information-extractor.handler.spec.ts` 신규 shape 기대값으로 재작성
- [x] `information-extractor.schema.spec.ts` 갱신
- [x] `frontend/src/components/editor/expression/__tests__/node-output-schema-enrichers.test.ts` 갱신
- [x] `frontend/src/components/editor/run-results/__tests__/output-shape.test.ts` 갱신
- [x] Single-turn / multi-turn waiting / multi-turn ended (completed|user_ended|max_turns) / error 케이스 커버

### 구현
- [x] `backend/src/nodes/ai/information-extractor/information-extractor.handler.ts`
  - `{port, data:{config,output,meta}}` → `{config, output:{result:{...}}, meta, port, status:'ended'}`
  - `_llmCalls` → `meta.turnDebug`
  - `_multiTurnState` 는 Stage 2 에서 rename — 본 스테이지는 유지
  - 에러 → `port:'error' + output.error:{code,message,details?}` (multi-turn 은 `output.result` 와 병존)
  - `meta.interactionType` 폐지, `meta.durationMs` 추가
- [x] `information-extractor.schema.ts` 출력 스키마를 신규 shape 으로 재작성
- [x] 엔진 resume 경로(`execution-engine.service.ts`) 에서 `status:'ended'` 신규 shape 감지 + legacy `{port,data}` dual-support

### Migration
- [x] `backend/scripts/migrate-node-output-refs.ts`
  - `RELOCATED_FIELDS.information_extractor` 에 `maxCollectionRetries` 추가
  - 신규 `RESULT_FIELDS` 버킷 신설 (`extracted`, `messages`, `endReason`, `turnCount`, `originalInput`)
  - Pass 1~4 idempotent rewriter: `output.output.<f>` / `output.meta.<f>` / `output.config.<f>` / `output.<f>` 각 처리
  - `META_FIELDS.information_extractor` 에 `thinkingTokens`, `collectionRetryCount` 추가
- [ ] 로컬/스테이징 `--dry-run` 로그 기록 (PR 제출 시 실행)

### Frontend
- [x] `node-output-schema-enrichers.ts` — `output.result.extracted.<name>` 경로 enrich
- [x] `run-results/output-shape.ts` — `extractIeSnapshot` 이 `output.result.extracted` 우선 + 레거시 fallback, `isConversationOutput` 에 `output.result.messages` 경로 감지 추가
- [x] `frontend/src/content/docs/02-nodes/{overview,ai}.mdx` 예제 업데이트

### 검증
- [x] backend lint (eslint --fix) 통과
- [x] backend jest 전체 1326 test 통과
- [x] backend build (nest build) 통과
- [x] frontend lint 통과
- [x] frontend vitest 905 test 통과
- [x] frontend build 통과
- [ ] E2E: information_extractor + code 다운스트림 워크플로우 수동 실행 (PR merge 전 staging 에서)
- [ ] `ai-review` 실행 (Stage 종료 시)

### 진행 노트
- Stage 1 은 `_multiTurnState` / `conversationConfig` / `interactionType` 래퍼를 의도적으로 유지. Stage 2 에서 `_resumeState` 로 rename 하고 `resumed` 상태 + `output.interaction.*` 을 도입.
- `output.output.<f>` 이중 중첩 마이그레이션 스크립트는 idempotent (두 번 실행해도 결과 동일).

---

## Stage 2 — 공통 resume 컨트랙트 (`_resumeState`, `status:'resumed'`, `output.interaction`) (P0) ✅

### Spec
- [x] `spec/5-system/4-execution-engine.md` 에 §1.2.x 블로킹/재개 컨트랙트 섹션 추가 (CONVENTIONS §4.1/4.4/4.5 기준)
  - `status` enum (`waiting_for_input` / `resumed` / `ended` / …) 정의
  - `_resumeState` internal field 명명, legacy `_multiTurnState` dual-read 명시
  - `interaction.data` payload 표 추가
- [ ] `spec/5-system/6-websocket-protocol.md` — Stage 3 에서 presentation interaction payload 규격 변경 시 갱신 예정

### 구현
- [x] `execution-engine.service.ts` — internal variable `multiTurnState` → `resumeState` rename
- [x] Dual-read: `nodeOutput._resumeState ?? nodeOutput._multiTurnState`, `resultObj._resumeState ?? resultObj._multiTurnState`
- [x] 최종 출력 저장 시 `_resumeState` / `_multiTurnState` 양쪽 모두 삭제
- [ ] `status:'resumed'` observability 이벤트 방출 — Stage 3 (presentation 재작성 시 interaction payload 확정 후)
- [ ] `handler-output.adapter.ts` — Stage 3 에서 presentation 재작성 시 `interaction` placement 헬퍼 추가

### 테스트
- [x] 기존 `execution-engine.service.spec.ts` 회귀 테스트 전체 통과 (1326/1326)
- [x] backend build (`nest build`) 통과

### 검증
- [x] 레거시 handler(`_multiTurnState` emit) 가 dual-read 로 동작
- [ ] `ai-review` 실행 (Stage 종료 시)

### 진행 노트
- Stage 2 는 **내부 rename + dual-read + spec 문서화** 만 수행. `status:'resumed'` 방출과 `output.interaction.*` payload 표준화는 Stage 3 에서 presentation 핸들러 재작성과 함께 구현 (그래야 frontend 렌더러 변경을 한 스테이지로 묶을 수 있음).
- 모든 handler 는 당분간 `_multiTurnState` 를 계속 emit — Stage 5 에서 ai_agent 핸들러가 `_resumeState` 로 옮겨지면 Stage 7 adapter 제거 시 legacy 키를 완전히 삭제.

---

## Stage 3 — Presentation 5 노드 Principle 1.1 + waiting/resumed 재작성 (P0) ✅

### Spec
- [x] `spec/4-nodes/6-presentation-nodes.md` form 섹션 재작성 (waiting/resumed shape, interaction payload)
- [ ] carousel/chart/table/template 섹션 Principle 11 포맷 업데이트 (Stage 3 추가 정비 대상)

### 테스트 (각 노드)
- [x] form handler spec — `output: {}` 기대, `meta.durationMs` 검증
- [x] carousel handler spec — `output.type` undefined, `config.layout` 이동 검증
- [x] chart handler spec — `output.{type,title,chartType}` undefined, `config.*` 이동 검증
- [x] table handler spec — `output.type` undefined
- [x] template handler spec — `output.rendered` 필드, `config.outputFormat`/`config.template` echo
- [x] carousel/chart/table/template `buttons.spec.ts` 일치

### 구현 (백엔드)
- [x] form.handler.ts — `output: null` → `output: {}`, `meta.durationMs: 0` 주입
- [x] carousel.handler.ts — `output.type/layout` 제거, `config` echo 확장 (layout/items/titleField/descriptionField/imageField/buttons/itemButtons)
- [x] chart.handler.ts — `output.{type,chartType,title}` 제거, config echo 확장
- [x] table.handler.ts — `output.{type,columns}` 제거, config echo 확장
- [x] template.handler.ts — `output.{type,format,content}` → `output.rendered`, `config.outputFormat/template` echo
- [x] engine `waitForFormSubmission` — `status:'submitted'` → `'resumed'`, `output.submittedData` → `output.interaction.{type:'form_submitted',data,receivedAt}`
- [x] engine `waitForButtonInteraction` — `status:'button_click'|'button_continue'` → `'resumed'`, `output.interaction.{type,data:{buttonId,buttonLabel,selectedItem?,url?},receivedAt}` 신설

### Migration
- [x] `migrate-node-output-refs.ts` `RELOCATED_FIELDS` 에 form/carousel/chart/table 리터럴 config 추가, template 에 `format` 추가
- [x] 신규 `RENAMED_OUTPUT_FIELDS` 버킷: `template.content` → `template.rendered`, `form.submittedData` → `form.interaction.data`
- [x] 판별자 `output.type === '<nodeType>'` 감지 및 경고 로그 (Pass 4 inline)
- [x] Pass 5: `status === 'submitted'|'button_click'|'button_continue'` → `'resumed'` 일괄 치환
- [ ] 로컬/스테이징 `--dry-run` 로그 기록 (PR 제출 시 실행)

### Frontend
- [x] `presentation-renderers.tsx` FormSubmittedContent 가 `output.interaction.data` 우선 + 레거시 `submittedData`/`formData` fallback
- [ ] carousel/chart/table/template 렌더러 — `output.type` 판별자 사용 유무 grep 후 판단 (Stage 3 후속에서 이어서 진행)
- [ ] WebSocket 이벤트 consumer 확인 (필요 시)

### 검증
- [x] backend lint + 1326 test pass + build
- [x] frontend lint + 905 test pass + build
- [ ] dev server 에서 form submit / carousel button click / chart / table 수동 시나리오
- [ ] `ai-review` 실행 (Stage 종료 시)

### 진행 노트
- Engine 은 Stage 3 에서 form/button resume 경로를 모두 unified `status:'resumed'` + `output.interaction.{type,data,receivedAt}` 로 이행. 레거시 WebSocket 이벤트 필드(`interactionType`, `clickedAt`)는 그대로 방출 (Stage 3 종료 후 frontend 호환성 조사 후 정리 예정).
- Carousel/Chart/Table/Template spec 섹션은 Principle 11 포맷으로 추가 정비 필요 — 현재 Stage 3 PR 은 핸들러 + 엔진 + 테스트 + migration 변경으로 blast radius 제한.
- AI Agent multi-turn 의 `status: 'ended'` + `output.interaction` 은 Stage 5 에서 (ai_agent 재작성과 함께) 처리.

---

## Stage 4 — 런타임 에러 컨트랙트 확산 (P0) ✅ (부분)

### Spec
- [ ] `spec/5-system/3-error-handling.md` — `output.error` 표준 + 에러 포트 정책 (차후 정비)
- [ ] `spec/4-nodes/{3-ai,4-integration,5-data,2-flow}-nodes.md` 각 노드 Error Case 추가 (후속)

### 구현
- [x] `backend/src/nodes/core/error-codes.ts` 신설 (UPPER_SNAKE_CASE enum + `buildErrorEnvelope` 헬퍼)
- [x] `http_request` — 5xx/4xx 응답도 `output.error:{code,message,details}` 추가 (`output.response` 병존), transport 실패 `HTTP_TRANSPORT_FAILED` 코드
- [x] `database_query` — 에러 코드 `DB_QUERY_FAILED` 로 통일
- [x] `code` — `meta.success:false` + 정상 포트 → `port:'error' + output.error:{code,message,details}` 신설, `meta.*` 는 legacy shim 으로 유지
- [x] `text_classifier` — `output.error:string` → `{code:'LLM_CALL_FAILED', message, details}` 구조화 (single + multi-label)
- [ ] `send_email` — throws→port:'error' 전환 (Stage 4 후속)
- [ ] `ai_agent` — throws→port:'error' 전환 (Stage 5 재작성 시 동시에 처리)
- [ ] `workflow` — sub-workflow 실패 `port:'error'` 확인 (후속)

### 테스트
- [x] code handler spec — `output.error` 존재 + `port:'error'` assert (4개 케이스)
- [x] text_classifier handler spec — `err.code/err.message` assert (single + multi-label)
- [ ] http_request handler spec — 5xx/4xx 에러 포트 assert (기존 테스트는 통과; 에러 케이스 보강 필요)
- [ ] send_email handler spec (Stage 4 후속)

### Migration
- [ ] `http_request.output.response.error` → `output.error.message` 변환 규칙 (후속)
- [ ] `code.meta.error` → `output.error.message` 변환 규칙 (후속)

### 검증
- [x] backend lint + 1326 test pass + build
- [ ] E2E: http 5xx → error port → downstream 전달 (staging)
- [ ] send_email 실패 전파 (후속)

### 진행 노트
- Stage 4 의 핵심 breakage (`code` 가 `port:'error'` 신설) 와 LLM 계열 `output.error.{code,message}` 구조화 완료. 
- send_email / ai_agent / workflow 의 throws → error 포트 전환은 스펙 재작성 + 프론트엔드 에디터의 포트 UI 대응이 필요해 Stage 4 후속 (또는 Stage 5 와 묶어) 진행 예정. 현재는 기존 throw 경로 유지로 정합성 보장.

---

## Stage 5 — P1: LLM `output.result.*` + Container 오버라이트 구조화 (P1) ✅ (부분)

### Spec
- [ ] `spec/4-nodes/1-logic-nodes.md` container 섹션 Principle 9 반영 (후속)
- [ ] `spec/4-nodes/3-ai-nodes.md` text_classifier 섹션 `output.result.*` 반영 (후속)
- [ ] `spec/5-system/4-execution-engine.md` container override 컨트랙트 명문화 (후속)

### 테스트
- [x] text_classifier handler spec — `data.result.category/categories/confidence/originalInput` assert 로 업데이트 (single + multi-label)
- [x] `execution-engine.service.spec.ts` — foreach/loop/map finalized shape (`{items|iterations|mapped, count}`) 기대값 업데이트
- [ ] ai_agent handler spec (`output.result.response`) — Stage 5 후속 (ai_agent 재작성과 함께)
- [ ] parallel executor `{branches, count}` 테스트 추가 (후속)

### 구현
- [x] `text-classifier.handler.ts` — single/multi-label 응답을 `output.result.{category|categories|confidence|originalInput}` 로 재구성, `_llmCalls` → `meta.llmCalls`
- [x] container override: `execution-engine.service.ts:3500-3555` — foreach → `{items, count}`, loop → `{iterations, count}`, map → `{mapped, count}`
- [ ] `ai-agent.handler.ts` — `output.response` → `output.result.response`, `output.metadata` → `meta.*` (복잡한 multi-turn 경로로 인해 Stage 5 후속 / 별도 PR)
- [ ] parallel executor `{branches, count}` override (후속)

### Migration
- [ ] LLM: `output.response` → `output.result.response`, `output.category|categories` → `output.result.*` (migrate script 에 추가 필요)
- [ ] Container: 기존 `$node["Loop"].output[i]` 식 접근 rewrite — 수동 리뷰 권장
- [ ] dry-run × 2회

### Frontend
- [ ] enrichers 업데이트 (LLM + container) — 후속

### 검증
- [x] backend lint + 1326 test pass + build
- [x] frontend lint + 905 test pass + build

### 진행 노트
- Container override 정형화 + text_classifier LLM 결과 wrapper 통일 완료.
- ai_agent 재작성과 parallel executor override, migrate script LLM/container 매핑은 후속 PR 로 분리. Stage 5 의 blast radius 를 유지하기 위한 결정.

---

## Stage 6 — P2: 포트/config/fallback 정리 (P2) ✅ (부분)

### Spec
- [ ] `spec/5-system/4-execution-engine.md` 포트 네이밍 섹션 (후속)
- [ ] 각 노드 스키마 주석 (후속)

### 구현
- [x] `http_request` URL credential sanitize (`sanitizeUrlCredentials` 헬퍼 추가, `configEcho.url` 에만 적용 — 실제 fetch 는 원본 URL 유지)
- [x] 기존 foreach/map 핸들러가 이미 non-array 입력을 `[]` 로 fallback (Principle 10 준수)
- [x] carousel per-item button ID suffix `__item_${idx}` 는 이미 engine routing 에서 처리됨 (`buttonId.includes('__item_')` split 로직) — 승격된 유틸화는 후속
- [ ] 시스템 예약어(`out`, `error`, `default`, `done`, `user_ended`, `max_turns`, `completed`, `fallback`, `continue`) 충돌 pre-flight throw 는 후속 (스키마 검증 레이어 필요)
- [ ] frontend port id 검증 UI (후속)

### 테스트
- [x] http_request handler spec 에 URL credential sanitize 테스트 추가 (`https://secret:p4ss@...` → echo 에서 username/password 제거)

### 검증
- [x] backend lint + 1327 test pass + build
- [x] frontend 변경 없음 (회귀 없음 확인 생략)

### 진행 노트
- URL credential sanitize 는 보안 관련 빠른 승리 (Principle 7). 나머지 포트 네이밍 유틸화 / 예약어 pre-flight 검증 / null→[] 명시적 문서화는 스펙 정비 단계에서 이어서 진행.

---

## Stage 7 — Phase 3: Adapter 제거 (Breaking) ⏸ **대기 (선행 조건 미충족)**

### 선행 조건 미충족 사항
- [ ] ai_agent 핸들러가 여전히 조건 트리거에서 legacy `{ port, data }` shape 방출 (Stage 5 후속 작업 필요)
- [ ] ai_agent 의 `output.response` / `output.metadata.*` 가 `output.result.response` / `meta.*` 로 이전되지 않음 (Stage 5 후속)
- [ ] send_email / workflow 의 throws → `port:'error'` 전환 미완료 (Stage 4 후속)
- [ ] Stage 1~6 migration script prod DB `--apply` 미실행
- [ ] `_multiTurnState` → `_resumeState` handler 레벨 전환 미완료 (현재는 engine dual-read)

### 진행 노트
- Phase 3 는 Stage 1~6 이 prod 에 배포되고 migration 스크립트가 apply 된 후에 진행. 지금 제거하면 ai_agent condition trigger 경로가 깨짐.
- 미완 작업을 별도 PR 로 묶어 Stage 5.5 / 4.5 로 추진 후 Stage 7 재개 권장.

### 구현 (참고 — 실제 수행은 후속 PR)
- [ ] `handler-output.adapter.ts` 삭제
- [ ] `execution-engine.service.ts` adapter 호출 제거
- [ ] `expression-resolver.service.ts` legacy `{output: flat}` 분기 제거
- [ ] Stage 2 `_multiTurnState` dual-read 제거
- [ ] migrate-node-output-refs.ts 헤더에 "Phase 3 complete" 주석

### Spec
- [ ] `spec/5-system/4-execution-engine.md` "Legacy shapes (removed)" 노트
- [ ] `spec/4-nodes/0-overview.md` 요약표 갱신

### 검증
- [ ] 백엔드 전체 테스트 통과
- [ ] 카테고리별 smoke run
- [ ] 최종 RESOLUTION.md

---

## 진행 로그

- **2026-04-19** — 계획 승인, 체크리스트 생성, Stage 1 착수
- **2026-04-19** — Stage 1~7 + 후속 1/2/4/3a/5 완료, prod DB dry-run/apply 는 권한 차단으로 사용자 직접 실행 대기
  - Stage 1 ✅ information_extractor 이중 중첩 제거 + LLM 에러 컨트랙트
  - Stage 2 ✅ 공통 resume 컨트랙트 (`_resumeState` dual-read, spec 명문화)
  - Stage 3 ✅ Presentation 5 노드 Principle 1.1 + form/button resume `status:'resumed'` + `interaction.{type,data,receivedAt}`
  - Stage 4 ✅ 에러 컨트랙트 확산 — http_request, database_query, code, text_classifier, send_email (후속2), workflow (후속2)
  - Stage 5 ✅ text_classifier + ai_agent (후속1) `output.result.*`, container executors `{iterations|items|mapped|branches, count}`
  - Stage 6 ✅ http_request URL credential sanitize
  - Stage 7 ✅ handler-output.adapter 축소, expression-resolver 는 structured cache 우선, `_multiTurnState` → `_resumeState` handler 레벨 rename. `NodeHandlerOutput._resumeState` 필드 정식화
  - 후속 4 ✅ spec 정비 — error-handling / logic-nodes container / presentation 4 노드 output 형식 재작성
  - 후속 3a ✅ migration script unit tests — `rewriteExpression` / `walkAndRewrite` idempotency, 이중 중첩, RELOCATED/META/RESULT/RENAMED 모든 매핑 커버 (27 test)
  - 후속 5 ✅ information_extractor + ai_agent waiting shape — `output.messages` / `output.partial.*` 를 top-level 에 노출 (Principle 4.3). `conversationConfig` 는 WS 이벤트 호환용으로 legacy-bare 경로에서 병존 유지. 엔진 `waitForAiConversation` 이 structured cache 의 `output.messages` 를 우선 읽도록 업데이트
  - 후속 3 진행중 🚧 — 스크립트가 `backend/.env` 를 자동 로드하지 않아 `28P01 password authentication failed` 로 실패했음. `migrate-node-output-refs.ts` 상단에 `dotenv.config({ path: __dirname/../.env })` 로딩 추가해 해결. dry-run 로컬 실행 성공: 6 workflows scan, 2 hits (1 auto-rewrite `form.output.submittedData → form.output.interaction.data`, 1 manual-review `form.output.output.interaction`). 남은 단계: 사용자가 manual-review hit 검토 후 `--apply --workspace-id <uuid> --user-id <uuid>` 실행
  - **REVIEW ✅** — `ai-review` 스킬 실행 (2 배치). Critical + Warning 이슈를 `review/2026-04-19_20-06-57/RESOLUTION.md` / `review/2026-04-19_20-11-05/RESOLUTION.md` 에 조치 내역 기록. 주요 수정: send-email dead ternary 버그, http-request details.url sanitize, migration script 트랜잭션 래핑 + Pass 6(legacy error envelope 감지), adapter `_resumeState` 처리 11 테스트, error-codes 5 테스트, code handler 정규화 코드 단언, discriminator dropout 5 타입 커버, button_continue 치환 테스트, chart `output.rendered` spec, error-handling §1.4 코드표 재작성, execution-engine §1.3 번호 확정
  - **REVIEW 2차 조치 ✅** — 사용자 요청으로 후속 이월 항목 전부 처리: CLAUDE.md CONVENTIONS 경로, migration script `--workspace-id`/`--user-id` CLI + N+1 쿼리 JOIN 통합 + 재실행 audit 타임스탬프, CHANGELOG.md 신규, workflow 노드 `error` 포트 spec, `ResumableNodeHandlerOutput` 서브타입, `code.handler` 프로덕션 stack trace 제거 + 이중 에러 코드 JSDoc, frontend `resolveResultField` 헬퍼 + 6 테스트, 3 신규 `isConversationOutput` Stage 5 경로 테스트, error-codes `truncateForErrorDetails`/`maskEmailForErrorDetails` + 12 테스트, send-email `details.to` 마스킹 + subject 200자 truncate, text-classifier originalInput 500자 truncate, `sanitizeConfigEcho` 공통 헬퍼 + 4 테스트 + 15 credential 키, `USER_CANCELLED`/`INTERACTION_TIMEOUT` 에러 코드 enum 추가, send-email spec §4.2/4.3 재작성, `previousOutput` lifecycle JSDoc, Stage 선행 참조 주석 정리. 최종 backend 1403 test / frontend 914 test 통과
  - **Stage 7 production-strict 모드 ✅** — 사용자가 migration apply 완료 후 후속으로 adapter 강화: `adaptHandlerReturn` 이 `NODE_ENV==='production'` 일 때는 canonical shape 외 모든 리턴을 throw. 테스트/dev 에서는 bare-wrap lenient 동작을 `wrapBareAsNodeHandlerOutput()` 으로 분리해 export. 39개 기존 fixture 마이그레이션 없이도 production 계약이 runtime 에서 lock down. adapter spec +10 test (strict throw 5케이스 + wrap helper 3케이스). 최종 backend 1413 test 통과

## 후속 작업 (정리)

다음은 현 세션에서 의도적으로 다음 PR 로 분리한 작업 목록:

### 후속 1: ai_agent 재작성 (P1)
- `ai-agent.handler.ts` single-turn: `output.response` → `output.result.response`, `output.metadata.*` → `meta.*`
- multi-turn conditional trigger: `{ port, data }` legacy → unified `NodeHandlerOutput` shape
- `_multiTurnState` → `_resumeState` 완전 이전
- Frontend: `ai_agent` renderer/enricher/LLM info tab 업데이트
- Migration script: LLM-쪽 매핑 추가

### 후속 2: send_email/workflow 에러 포트 (P0 마무리)
- `send_email`: throws → `port:'error' + output.error.{code,message}` (스키마 `error` 포트 추가)
- `workflow`: sub-workflow 실패 시 `port:'error'` 라우팅 문서화
- Frontend 에디터: 에러 포트 자동 추가 UI

### 후속 3: Migration script dry-run + apply (P0 마무리)
- 로컬 DB 에 `npx ts-node backend/scripts/migrate-node-output-refs.ts --dry-run` 실행
- 스테이징 → prod 순서로 `--apply`
- `review/<timestamp>/RESOLUTION.md` 에 결과 기록

### 후속 4: Spec 잔여 정비
- `spec/5-system/3-error-handling.md` — `output.error` 표준 shape + 에러 포트 정책 재작성
- `spec/4-nodes/6-presentation-nodes.md` — carousel/chart/table/template 섹션을 Principle 11 포맷으로 (form 은 완료)
- `spec/4-nodes/1-logic-nodes.md` — container 섹션 §9.2 반영
- `spec/5-system/6-websocket-protocol.md` — `interaction.{type,data,receivedAt}` 기반 이벤트 필드 업데이트

### 후속 5: Stage 7 실행
- 위 1~4 완료 후 adapter 제거
