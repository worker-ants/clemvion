# Engine Raw Config Exposure — Implementation Tracking

## 배경

엔진이 expression 평가를 끝낸 뒤 평가된 config 만 핸들러에 넘기는 구현 때문에 CONVENTIONS Principle 1.1.3 (config = 원본 템플릿, output = 평가 결과) 의 설계 의도가 핸들러 레벨에서 실현되지 않고 있었다. Principle 7 ("해석/치환 후 echo") 의 표현이 1.1.3 과 모순된 채 남아 있었고, Send Email · HTTP Request 두 노드의 output 에 expression 평가 결과 (발송된 본문 / 전송한 request body) 를 추가하려는 작업이 의미적으로 진행 불가했다.

본 PR (project-planner) 에서 PRD `ENG-RC-*` + Spec + CONVENTIONS Principle 7 개정을 완료했다. 본 문서는 이후 모든 implementation phase 를 추적한다.

## 결정 사항 (확정)

| 결정 | 내용 |
| --- | --- |
| 마이그레이션 전략 | 하드 스위치 — 모든 핸들러가 일관되게 raw echo 패턴 |
| API 명식 | `ExecutionContext.rawConfig: Readonly<Record<string, unknown>>` (optional) |
| PRD ID prefix | 신규 `ENG-RC-*` (Engine Raw Config). 기존 `ND-*` / `ED-*` 와 동일 그룹 수준 |
| Send Email 출력 형태 | flat additive: `output.subject`, `output.body`, `output.bodyType` (이전 대화 결정 #1) |
| HTTP Request 출력 형태 | flat additive: `output.requestBody`, `output.requestBodyType` + `output.responseHeaders` (이전 결정 #2, #5) |
| 본문 크기 cap | 256KB 임계값 — `output.bodyTruncated: true` 플래그와 함께 truncate (이전 결정 #3) |
| Error 포트 본문 포함 | 포함 — 디버깅 용이성 (이전 결정 #4) |
| Legacy DB 데이터 | historical record 보존, 백필 X (배포 전 NodeExecution rows 의 config 는 evaluated 형태로 남아있음) |

## 현재 구현 상태 (2026-05-08)

| Phase | 상태 | 비고 |
| --- | --- | --- |
| Phase 1 — 엔진 plumbing | 완료 | `6953cafb` + 후속 quality gate `ce059405` |
| Phase 2 — Send Email + HTTP Request 트리거 | 미진행 | HTTP Request 에 `configEcho` 가 일부 존재하나 `context.rawConfig` 를 사용하지 않음. Send Email 은 미착수 |
| Phase 3 — 나머지 핸들러 마이그레이션 | 미진행 | |
| Phase 4 — Frontend 자동완성 회귀 점검 | 미진행 | |
| Phase 5 — Swagger / OpenAPI 영향 검증 | 미진행 | |
| Phase 6 — DB / 실행 이력 호환성 검증 | 미진행 | |
| Phase 7 — 정리 / 클로저 | 미진행 | |

PRD 에서는 `ENG-RC-01` (엔진의 `rawConfig` 노출), `ENG-RC-03` (raw + evaluated 양쪽 노출) 가 ✅ 로, `ENG-RC-02` (핸들러 echo 패턴), `ENG-RC-04` (전체 핸들러 마이그레이션) 가 🚧 로 정렬되어 있다.

## 구현 완료 — Phase 1: 엔진 plumbing

엔진이 핸들러에 raw config 를 노출. 행동 변화 0 — 모든 핸들러는 여전히 evaluated config 만 사용 (이전 PR 호환 유지).

**적용 위치**:
- `backend/src/nodes/core/node-handler.interface.ts:54` — `ExecutionContext` 인터페이스에 `rawConfig?: Readonly<Record<string, unknown>>` 필드 추가.
- `backend/src/modules/execution-engine/execution-engine.service.ts:2434–2437` — 메인 경로 `nodeContext` 에 `rawConfig: Object.freeze({ ...(node.config ?? {}) })` 무조건 주입. expression 사용/미사용 / `nodeMap === undefined` (legacy / 테스트 경로) 모두 자동 커버.
- 같은 파일 `:1687` — multi-turn resume 경로에서 `resumeState.rawConfig` 를 보존 + freeze. 첫 turn 의 frozen snapshot 을 후속 turn 이 일관되게 참조 (replay reproducibility).
- `ExpressionResolverService.resolveConfig` 시그니처 변경 없음 (입력은 여전히 raw, 출력은 resolved).

**검증**:
- `execution-engine.service.spec.ts` 에 회귀 테스트 추가 — 메인 경로 + executeInline 경로 노출 검증, shallow freeze (top-level mutation strict-mode throw) 검증, expression 미사용 노드의 raw === evaluated 동치 검증.
- backend lint·unit·build green (167 suite, 2732/2732 pass — `review/2026-05-06_17-27-43/RESOLUTION.md` 기록).
- 기존 모든 핸들러 unit test pass — 행동 변화 0 확인.

**커밋**:
- `6953cafb feat(engine): expose ExecutionContext.rawConfig to node handlers (Phase 1)` — 트리거 PR.
- `ce059405 refactor(engine): ai-review 조치 — Phase 1 quality gate (Doc 1 + Test 2 + Spec 1)` — INFO #3 (shallow freeze 한계 명시) / WARN #17 (`context.rawConfig` vs `state.rawConfig` 의도된 차이 spec 박스) / WARN #20 (`executeInline` rawConfig 검증) / INFO #18 (테스트명 정정) 일괄 반영.
- 추가 후속 정리: `f8bb87df` (CRITICAL — IDOR + duck-typing + edge map), `64d928df` (CRIT #5 partial — executeSync/Async 미테스트), `62f369ac` (Warning + INFO 28/51 일괄). 51건 review 결과 중 28건 즉시 처리 + 23건 deferred (`plan/in-progress/ai-review-deferred-items.md`).

---

## 남은 작업

진행되지 않은 phase 들을 한 단락으로 모은다. 각 phase 의 범위·출력물·PR 단위는 그대로 유효하지만, 실행은 Phase 2 → Phase 3 순서로 트리거 한다 (Phase 4~6 은 Phase 3 진행 중·이후 병렬 가능, Phase 7 은 마지막).

### Phase 2 — Send Email + HTTP Request 마이그레이션 (트리거 작업)

두 노드를 raw-echo 패턴으로 마이그레이션하면서 output 에 평가 결과 신규 필드를 추가한다.

**Send Email** (`backend/src/nodes/integration/send-email/`):
- `send-email.handler.ts` — `config` echo 를 `context.rawConfig` 기반으로 전환해 `{integrationId, to, cc, bcc, subject, body, bodyType, attachments}` 의 **원본** 을 그대로 echo. `output` 에 `subject` (evaluated), `body` (evaluated, 256KB cap), `bodyType` 신규 필드 추가. error 포트 리턴값에도 동일 필드 포함.
- `send-email.schema.ts` — `sendEmailNodeOutputSchema.config` 에 모든 raw 필드 표기 (subject·body 도 raw 표시), `output` 에 `subject?`, `body?`, `bodyType?`, `bodyTruncated?` 추가.
- `send-email.handler.spec.ts` — 성공 케이스의 `output.subject/body/bodyType` 검증, expression 평가 (`{{ $input.name }}`) 케이스에서 `config.subject` 가 raw / `output.subject` 가 evaluated 인지 검증, HTML 본문 케이스 (bodyType=html), 256KB cap 케이스 (`bodyTruncated: true` 포함), error 포트의 본문 포함 검증.

**HTTP Request** (`backend/src/nodes/integration/http-request/`):
- `http-request.handler.ts` — `configEcho` 를 `context.rawConfig` 로 교체해 method, url (sanitize), authentication, integrationId, headers, queryParams, body (raw), bodyType, responseType, timeout, followRedirects, verifySsl 의 **원본** echo. `output` 에 `requestBody` (evaluated, 256KB cap), `requestBodyType`, `responseHeaders` 추가. 세 리턴 지점 (success / non-2xx / transport error) 모두 적용. sensitive header (`Authorization`, `Cookie`, `X-Api-Key`, `X-Auth-Token`) 는 `responseHeaders` 에서 mask 또는 제외.
- `http-request.schema.ts` — `httpRequestNodeOutputSchema.output` 에 `requestBody?`, `requestBodyType?`, `responseHeaders?`, `bodyTruncated?` 추가.
- `http-request.handler.spec.ts` — POST + JSON body 의 `output.requestBody` 검증, form-data / form-urlencoded / raw 별 `output.requestBodyType` 검증, GET (no body) 의 `output.requestBody` undefined 검증, error 케이스 (4xx/5xx, transport) 의 신규 필드 포함 검증, response header sanitize 검증, 256KB cap 검증.

**공통 헬퍼**:
- `backend/src/nodes/integration/_base/truncate-body.util.ts` 신규 — `truncateBodyForOutput(value, maxBytes = 256 * 1024): { value, truncated }` 시그니처. JSON / string / Buffer 모두 처리.

**Spec 갱신**:
- `spec/4-nodes/4-integration-nodes.md` §2.3 (HTTP Request 출력 구조) — 현재 outdated 한 평탄 `data`/`error` 표기를 nested CONVENTIONS §8 형태로 교정 + 신규 필드 반영.
- `spec/4-nodes/4-integration-nodes.md` §4.3 (Send Email 출력 구조) — `output.subject/body/bodyType` 추가.
- `user_memo/node-specs-improvement/integration/send_email.md` 및 `user_memo/node-specs/integration/send_email.md` (선택, 일관성).

**PR 분할 권장**: 2~3건. (1) `refactor(send-email): config raw echo + output subject/body/bodyType`, (2) `refactor(http-request): config raw echo + output requestBody/responseHeaders`, (3) `refactor(integration): truncate-body helper + spec output examples`.

### Phase 3 — 나머지 핸들러 마이그레이션

25 핸들러를 카테고리별로 raw-echo 패턴으로 마이그레이션. expression-widget 필드를 식별 → `output.*` 로 노출.

**영향 매트릭스**:

| 카테고리 | 노드 | expression 사용 필드 (output 신설 후보) | echo 정책 영향도 |
| --- | --- | --- | --- |
| Presentation (5) | Form, Carousel, Chart, Table, Template | items, columns, template, fields 의 표현식 부분 | 높음 — config 가 광범위하게 echo 됨 |
| AI (3) | Agent, Classifier, Extractor | systemPrompt, userPrompt, knowledgeBases (UUID) 등 | 중 — `output.result.*` 하위에 평가 결과 정착 |
| Logic (12) | If/Else, Switch, Loop, Variable, Map, ForEach, Filter, Parallel, Merge, Background, Split | 조건식, count, target | 낮음 — 대다수 echo 안 함 |
| Data (2) | Transform, Code | operations (Transform), code (Code 는 expression-exclusions) | 낮음 |
| Trigger (1) | Manual Trigger | (없음) | 영향 없음 |
| Flow (1) | Workflow | parameters | 중 |
| Integration (1) | Database Query | query, parameters | 중 |

**작업 흐름** (각 노드별): handler 의 echo 를 `context.rawConfig` 기반으로 변경 → expression 사용 필드의 evaluated 값을 `output.*` 로 노출 (Principle 8.2 의 카테고리 명명 규칙) → schema `*OutputSchema` 갱신 → unit test 갱신 → 노드별 spec 출력 예시 갱신.

**PR 분할 권장**: 카테고리 단위 PR (Presentation 1건, AI 1건, Logic 1건, Data 1건, Flow 1건, DB Query 1건 — 총 ~6건). 각 PR 내부에서 노드별 commit 분리.

### Phase 4 — Frontend Expression Auto-complete 회귀 점검

backend `*OutputSchema` 가 SSOT 이므로 자동 반영 예상. expression 자동완성 후보의 `$node["X"].config.<expression-field>` 가 raw 표시인지, `$node["X"].output.<신규-field>` (`output.subject`, `output.body`, `output.requestBody` 등) 가 자동완성에 노출되는지 확인. 기존 워크플로 expression 의 type-check / lint 가 깨지지 않는지 schema diff 후 회귀 테스트. 영향 발견 시 `frontend/src/components/editor/expression-editor/` 또는 `frontend/src/lib/node-definitions/` 의 type derivation 코드를 점검·갱신. frontend lint·unit·build green 확인.

**PR 분할 권장**: 1건 (영향 없으면 verification commit, 있으면 fix commit).

### Phase 5 — Backend Swagger / OpenAPI 영향 검증

API 클라이언트 (외부 통합) 에서 응답 DTO 의 `config` 형태가 raw 로 변경되는 의미를 검증·노출. Swagger 가 노출하는 endpoint 식별 (`execution-history`, `node-execution`, `executions/:id` 등 실행 결과 조회 경로 — `grep -rn "@ApiProperty" backend/src/modules/`), 응답 DTO 에 `NodeHandlerOutput.config` / `output` 형태가 직간접 포함되는지 확인. 영향이 있다면 `@ApiProperty` 주석·타입 갱신 + Swagger 예시 갱신. CHANGELOG / API release note — "이 버전부터 `NodeExecution.outputData.config` 는 expression 평가 전 원본을 담는다. evaluated 값은 `outputData.output.*` 에서 얻을 수 있다. expression 미사용 필드는 동일." 기존 API 테스트 (e2e / integration) 의 응답 shape 검증 영향 확인.

**PR 분할 권장**: 1건.

### Phase 6 — DB / 실행 이력 호환성 검증

NodeExecution.outputData JSONB 의 의미 변화에 대한 호환성 + UI 표시 안내. DDL 변경 없음 확인 (JSONB 그대로). 옛 NodeExecution rows 는 config = evaluated 형태 (배포 전), 새 rows 는 config = raw 형태 — historical 보존 (백필 X) 정책을 spec/PRD 또는 release note 에 명시. replay (재실행) 의 입력 경로가 raw 를 다시 evaluate 하는지 vs 저장된 evaluated 를 재사용하는지 확정. frontend execution-history UI 의 config 표시 부분에 "기록 시점의 config 형태" 안내 한 줄 (필요 시). 기존 워크플로 expression `$node["X"].config.<expression-field>` 가 옛 실행 caching 환경에서 동작 차이 발생하는지 확인.

**PR 분할 권장**: 1건 (DDL 무변경 → release note + UI 안내만).

### Phase 7 — 정리 / 클로저

`spec/4-nodes/*.md` 전체에서 각 노드별 출력 예시가 `config` (raw) / `output` (evaluated) 패턴을 일관되게 보여주는지 grep 검증. CONVENTIONS Principle 7 / Principle 1.1.3 / Principle 8.2 가 모든 노드 spec 에 반영됐는지 확인. `memory/engine-raw-config-decision.md` 의 "결정" 메모를 "완료" 메모로 갱신. 본 plan 문서를 `plan/complete/` 로 `git mv`. release note / migration guide 최종본 (API 사용자·워크플로 작성자용) 게시.

**PR 분할 권장**: 1건.

---

## Rollback 가이드

각 Phase 별 rollback 시나리오:

| Phase | Rollback 방법 |
| --- | --- |
| Phase 1 | `ExecutionContext.rawConfig` 제거. 행동 변화 없으니 단순 revert (현재 배포된 상태 — Phase 2 트리거 시 의미 발생) |
| Phase 2 | Send Email / HTTP Request handler revert. legacy 워크플로의 `$node["X"].config.subject` 가 evaluated 로 되돌아감 |
| Phase 3 | 카테고리별 revert |
| Phase 4 | frontend 변경 revert (영향 있을 경우) |
| Phase 5 | API release note 정정 |
| Phase 6 | DB 변경 없으므로 rollback 불필요 |

긴급 rollback 이 필요한 경우, Phase 2 까지의 변경만 부분 revert 하면 (Phase 1 의 `rawConfig` 노출만 유지) 다른 핸들러는 이미 evaluated 사용 패턴이라 영향 없다.

---

## 미해결 설계 질문

- **HTTP responseHeaders sanitize 정책** — 어떤 헤더를 mask 할지 정확한 화이트리스트 / 블랙리스트 결정 필요. Phase 2 진입 전 보안 리뷰.
- **256KB cap 의 정확한 측정** — UTF-8 byte length 기준인지 character length 기준인지. 헬퍼 구현 시 명시.
- **Replay 시 raw 재평가 vs 저장된 evaluated 재사용** — Phase 6 검증에서 결정 후 spec 에 명시.

이 질문들이 결정되어 모든 phase 가 끝난 순간 본 문서를 `plan/complete/` 로 옮긴다.
