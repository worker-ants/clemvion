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
| Phase 2 — Send Email + HTTP Request 트리거 | 완료 | `e1ecbc1f` (helpers) + `e516d3e1` (send-email) + `2ffdf058` (http-request) + `ef15242c` (spec) + `198bbefe` (style) + `104d1bb9` (ai-review 조치 12/16) |
| Phase 3 — 나머지 핸들러 마이그레이션 | 완료 | `c29ee55b` (PR-3a) + `75ec5eb6` (PR-3b) + `05b69896` (PR-3c) + `71e4fa7a` (PR-3d) + `6eeeb095` (PR-3e) + `7f7a9d3d` (PR-3f) — 25/25 핸들러 마이그레이션 |
| Phase 4 — Frontend 자동완성 회귀 점검 | 완료 | verification only — 코드 변경 없음 (`use-expression-suggestions.test.ts:667` envelope unwrap 가드가 회귀 차단) |
| Phase 5 — Swagger / OpenAPI 영향 검증 | 미진행 | |
| Phase 6 — DB / 실행 이력 호환성 검증 | 미진행 | |
| Phase 7 — 정리 / 클로저 | 미진행 | |

PRD 에서는 `ENG-RC-01` (엔진의 `rawConfig` 노출), `ENG-RC-02` (핸들러 echo 패턴), `ENG-RC-03` (raw + evaluated 양쪽 노출), `ENG-RC-04` (전체 핸들러 마이그레이션) 모두 ✅ — 25/25 핸들러 모두 raw-echo 패턴 적용 (AI Agent 의 final 출력 echo 두 곳은 후속 보강 후보 지만, 핵심 echo 지점은 모두 rawConfig 기반).

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

## 구현 완료 — Phase 2: Send Email + HTTP Request 마이그레이션

두 트리거 노드를 raw-echo 패턴으로 마이그레이션 + output 에 평가 결과 신규 필드 추가. 결정 사항 (256KB cap UTF-8 byte length / responseHeaders sanitize hybrid blacklist) 모두 보강 후 진입.

**공통 헬퍼** (`backend/src/nodes/integration/_base/`):
- `truncate-body.util.ts` — `truncateBodyForOutput(value, maxBytes = 256 * 1024)` 신설. 문자열·Buffer·객체 모두 `Buffer.byteLength` UTF-8 기준으로 cap, 멀티바이트 코드포인트 boundary 안전 절단. cyclic 객체는 `'[Unserializable]'` 플레이스홀더.
- `sanitize-response-headers.util.ts` — fetch `Headers` / `Record` / iterable / null·undefined / partial Headers-like mock 모두 처리. `EXACT_BLACKLIST` (authorization / cookie / set-cookie / x-api-key / location 등 11개) + 패턴 매칭 (auth / token / api-key / secret / cookie / credential / password). 매칭 시 값 `'[REDACTED]'`.
- `sanitizeUrlCredentials` 확장 (`http-request.handler.ts`) — `?api_key=…` / `?token=…` 스타일 query-string 자격증명 13개 키 마스킹.

**Send Email** (`backend/src/nodes/integration/send-email/`):
- `handler.ts` — `context.rawConfig` 를 사용해 integrationId / to / cc / bcc / subject / body / bodyType / attachments raw echo. output 에 subject (evaluated) / body (evaluated, 256KB cap) / bodyType + bodyTruncated 추가. 성공·`requires_integration`·error 포트 모두 동일 본문 echo.
- `schema.ts` — output schema 에 신규 필드 반영. `to`/`cc`/`bcc` 는 string|array sum-type → `z.unknown()`.
- `handler.spec.ts` — 55 pass (raw vs evaluated 직교성, html, 256KB cap, error 포트 본문 포함).

**HTTP Request** (`backend/src/nodes/integration/http-request/`):
- `handler.ts` — `{ ...rawConfig, url: rawUrl }` spread 로 12개 필드 자동 echo. output 에 requestBody (evaluated, 256KB cap) / requestBodyType (evaluated `'json'` 기본 포함) / responseHeaders (sanitized) / bodyTruncated. 3개 리턴 지점은 모듈 레벨 `buildBodyOutputFields(...)` 헬퍼로 통합. transport-error 분기는 `responseHeaders` 미포함 (Response 없음).
- `schema.ts` — output schema 에 12개 raw config 필드 + 4개 신규 output 필드 반영.
- `handler.spec.ts` — 56 + ENG-RC-* describe 7 케이스 (raw vs evaluated 직교성, GET no-body / body:null / x-www-form-urlencoded, 민감 헤더 마스킹, 256KB cap, non-2xx + transport-error 의 본문 보존).

**Spec 갱신** (`spec/4-nodes/4-integration/`):
- `0-common.md` §3 공통 출력 구조 — 평탄 `data`/`meta` 표기를 nested `config`/`output`/`meta`/`port` envelope 로 교정.
- `1-http-request.md` §3 — outdated `data`/`error` 표기 nested 형태로 교정 + requestBody / requestBodyType / responseHeaders 신규 필드 반영. transport-error 시 responseHeaders 미포함 명시.
- `3-send-email.md` §3 — config raw / output evaluated 직교성 + subject/body/bodyType 추가.
- `3-send-email.md` §5 Handler — transport 캐시 재사용 정정 + 반환 shape 를 §3 정본 참조로 대체.

**검증**: lint clean / 169 suite 2778 unit pass / build clean. ai-review 결과 — Critical 0 / Warning 16 / Info 15 중 Phase 2 scope 내 12건 즉시 조치 (Security 2 + Requirement 1 + Architecture 3 + Testing 4 + Documentation 4) + 9건 deferred (정책 결정 / 광범위 리팩터 / 미세 최적화). 상세는 `review/2026-05-08_15-05-03/RESOLUTION.md`.

**커밋**:
- `e1ecbc1f feat(integration): truncate-body + sanitize-response-headers 헬퍼` — 19개 단위 테스트 포함.
- `e516d3e1 refactor(send-email): config raw echo + output subject/body/bodyType (Phase 2)`.
- `2ffdf058 refactor(http-request): config raw echo + output requestBody/responseHeaders (Phase 2)`.
- `ef15242c docs(spec): integration 노드 §2.3 + §4.3 raw-echo / output 신규 필드 반영`.
- `198bbefe style(integration): Phase 2 prettier / lint --fix 자동 정리`.
- `104d1bb9 refactor(integration): ai-review Phase 2 조치 — Warning 11 + Info 1 (12/16)`.

## 구현 완료 — Phase 3: 나머지 핸들러 마이그레이션

25개 핸들러 (Trigger 1 + Logic 12 + Data 2 + Flow 1 + Integration 1 + Presentation 5 + AI 3) 모두 raw-echo 패턴 적용. 카테고리 단위로 6개 PR 로 분할 진행 — 각 PR 마다 backend lint·unit·build green 확인.

**적용 패턴** (모든 핸들러 공통):
- `const rawConfig = (context.rawConfig ?? config) as ...` — Phase 1 이 주입한 frozen rawConfig 를 사용, 단위 테스트가 engine 미경유로 호출하는 경로는 evaluated config 로 fallback.
- `config: { ...rawConfig fields }` 또는 spread — 사용자 입력 raw 그대로 echo.
- 평가 결과는 동작 로직에서만 사용 (LLM 호출 / DB 쿼리 / iteration 카운트 / 조건 평가 / 변수 할당 등).
- Container 노드 (loop / foreach / map / parallel / background) 는 `output: null` 또는 raw items 유지 — engine 이 iteration 결과로 덮어씀 (Principle 9 contract).

**카테고리별 결과**:

| PR | 핸들러 | 핵심 변경 |
| --- | --- | --- |
| `c29ee55b` PR-3a | manual-trigger / if-else / switch / filter / split / variable-declaration / variable-modification (7) | 단순 echo 마이그레이션 + ENG-RC-* 직교성 회귀 테스트 6건 |
| `75ec5eb6` PR-3b | loop / foreach / map / parallel / background / merge (6) | container Principle 9 contract 검증 + parallel 의 maxConcurrency 클램프 의미 정정 (raw 그대로 echo, observable 클램프는 `result.port.length`) |
| `05b69896` PR-3c | transform / code / workflow / database-query (4) | DB query / Code source / Sub-workflow inputMapping 의 raw expression 보존 |
| `71e4fa7a` PR-3d | form / carousel / chart / table / template (5) | Table 의 `resolvedColumns` (label expression 평가 결과) 를 `config.columns` stamp 에서 `output.columns` 로 이전 — Principle 1.1 위반 정정. Template 의 `config.template = evaluated content` 정정 |
| `6eeeb095` PR-3e | text-classifier / information-extractor (2) | 3개 echo 지점 (LLM 실패 / single / multi) 통합. Extractor 단일 turn 의 inputField/schema/instructions/examples raw echo |
| `7f7a9d3d` PR-3f | ai-agent (1) | non-tool 필드만 마이그레이션 (single-turn 종료 + multi-turn initial waiting + multi-turn resume waiting). multi-turn resume 는 `state.rawConfig` snapshot 사용 (Phase 1) |

**검증**:
- 모든 PR 에서 backend `npm run lint` clean / `npm run test` 169 suite 2788 / 2788 pass / `npm run build` clean.
- 누적 신규 테스트: 11건 (PR-3a 6건 + PR-3b 5건 ENG-RC-* 직교성 + parallel 의미 정정).
- 행동 회귀 0 — 기존 모든 테스트가 통과한 채 echo 의 의미만 raw 로 변경됨.

**남은 후속 보강** (Phase 7 또는 별도 PR):
- AI Agent 의 `buildMultiTurnFinalOutput` / `buildConditionOutput` 가 현재 `{mode, model}` 만 echo. `state.rawConfig` 를 helper 시그니처에 plumbing 하면 raw 전체 echo 가능 — 기능 회귀 없으므로 follow-up.
- Carousel / Table 의 256KB cap 적용 — 현재 cap 미적용. Phase 7 에서 검토.

---

## 남은 작업

진행되지 않은 phase 들을 한 단락으로 모은다. 각 phase 의 범위·출력물·PR 단위는 그대로 유효하지만, 실행은 Phase 4 → Phase 5 → Phase 6 → Phase 7 순서로 트리거 한다 (Phase 4~6 은 병렬 가능, Phase 7 은 마지막).

### Phase 4 — Frontend Expression Auto-complete 회귀 점검 (완료)

**검증 결과**: 영향 0 — 코드 변경 없이 verification 만 수행.

**메커니즘 확인**:
- Backend SSOT (`backend/src/nodes/integration/send-email/send-email.schema.ts`, `http-request/http-request.schema.ts` 등) 의 zod `*OutputSchema` 는 `node-component.registry.ts:65` 에서 `z.toJSONSchema()` 로 JSONSchema 변환되어 `/api/node-definitions` 응답에 노출.
- Frontend store (`frontend/src/lib/stores/node-definitions-store.ts:41`) 가 그대로 `outputSchema` 필드에 저장.
- `frontend/src/components/editor/expression/use-expression-suggestions.ts:178-187` 가 envelope `{config, output, meta, port, status}` 를 한 단계 unwrap 해서 `$node["X"].output.<inner>` / `$node["X"].config.<inner>` 후보로 노출.
- 회귀 가드: `use-expression-suggestions.test.ts:667` "unwraps envelope-shaped outputSchema to the output accessor" — Carousel envelope 패턴으로 검증되어 있음. 신규 필드 (Send Email `output.subject`/`body`/`bodyType`/`bodyTruncated`, HTTP Request `output.requestBody`/`requestBodyType`/`responseHeaders`/`bodyTruncated`) 도 동일 메커니즘으로 자동 노출.

**`node-output-schema-enrichers.ts` 호환성**: Phase 2/3 의 schema 변경이 `output: z.object({...}).partial().passthrough().optional()` envelope 형태를 유지하므로 Information Extractor / Form / Table / Transform 의 동적 enrichment 메커니즘 영향 없음.

**검증 명령**:
- `cd frontend && npm run lint` — clean.
- `npm test -- --run` — 1217/1217 pass (103 suite).
- `npm run build` — success.

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
| Phase 1 | `ExecutionContext.rawConfig` 제거. (배포 완료 — Phase 2/3 가 이미 의존하므로 단독 rollback 시 함께 revert 필요) |
| Phase 2 | Send Email / HTTP Request handler revert. legacy 워크플로의 `$node["X"].config.subject` 가 evaluated 로 되돌아감. (배포 완료) |
| Phase 3 | 카테고리별 revert (PR-3a~3f 단위 — 6개 commit). (배포 완료) |
| Phase 4 | frontend 변경 revert (영향 있을 경우) |
| Phase 5 | API release note 정정 |
| Phase 6 | DB 변경 없으므로 rollback 불필요 |

긴급 rollback 이 필요한 경우, Phase 2 까지의 변경만 부분 revert 하면 (Phase 1 의 `rawConfig` 노출만 유지) 다른 핸들러는 이미 evaluated 사용 패턴이라 영향 없다.

---

## 결정 보강 (Phase 2 진입 전)

### HTTP responseHeaders sanitize 정책

산업 표준 hybrid blacklist + 패턴 마스킹. 헤더 이름은 case-insensitive 비교, 매칭 시 값을 `'[REDACTED]'` 로 치환하고 헤더 이름 자체는 유지 (관찰성 — 어떤 헤더가 mask 됐는지 알 수 있도록).

**Exact-match 블랙리스트** (lowercased): `authorization`, `proxy-authorization`, `www-authenticate`, `proxy-authenticate`, `cookie`, `set-cookie`, `x-api-key`, `x-auth-token`, `x-csrf-token`, `x-amz-security-token`.

**패턴 매칭** (lowercased name 에 다음 substring 중 하나 포함 시 mask): `auth`, `token`, `api-key`, `apikey`, `secret`, `cookie`, `credential`, `password`.

### 256KB cap 의 측정 단위

UTF-8 byte length 기준. 헬퍼 시그니처: `truncateBodyForOutput(value, maxBytes = 256 * 1024): { value, truncated }`.

- 문자열 → `Buffer.byteLength(value, 'utf8')`.
- `Buffer` → `.length`.
- 객체 → `JSON.stringify` 후 byte length 측정. 직렬화 실패 시 `[Unserializable]` 문자열로 대체.
- 그 외 → `String(value)` 후 동일 처리.
- 임계 초과 시 `value` 를 byte 단위에서 안전하게 자른 문자열 + `truncated: true` 반환 (절단 위치는 마지막 완전한 UTF-8 코드포인트 경계 — `Buffer.slice` + 끝부분 `�` 절단 정리).

### Replay 시 raw 재평가 vs 저장된 evaluated 재사용

Phase 6 검증 단계에서 결정 후 spec 에 명시. Phase 2 와 무관 — 보류.

---

## 미해결 설계 질문

위 두 결정이 보강된 상태. Replay 정책만 Phase 6 진입 전 결정이 필요하다.

이 질문들이 결정되어 모든 phase 가 끝난 순간 본 문서를 `plan/complete/` 로 옮긴다.
