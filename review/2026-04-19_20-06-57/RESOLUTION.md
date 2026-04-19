# AI Review Resolution — 2026-04-19_20-06-57 + 2026-04-19_20-11-05

두 SUMMARY (노드 핸들러 / 엔진 / 프런트 / migration / spec) 에서 나온 Critical + Warning 이슈 중 구현 가능한 항목을 이 세션에서 조치했다. 본 문서는 그 이행 내역과 의도적으로 이월한 항목을 정리한다.

## 조치 완료

### Critical

| # | 이슈 | 조치 |
|---|------|------|
| C1 | `send-email.handler.ts` dead ternary — 양쪽 분기가 동일 `'EMAIL_SEND_FAILED'` 반환해 `IntegrationError.code` 소실 | `err instanceof IntegrationError ? err.code : 'EMAIL_SEND_FAILED'` 로 수정. `details.integrationCode` 는 관찰성 백업으로 유지. `durationMs` 도 단일 캡처로 통합 (INFO #2 동반 해소) |
| C3/S1 | 컨테이너 출력 구조 변경 마이그레이션 — 에러 envelope `nodeId/nodeType/timestamp/originalInput` legacy 필드 rewrite 누락 | `migrate-node-output-refs.ts` 에 Pass 6(감사 전용) 추가. 자동 변환은 불안전하므로 경고만 기록하고 수동 리뷰를 요구 |
| C5 | Migration script 전체 apply 가 트랜잭션 미보호 | pending updates 를 메모리에 누적한 후 `ds.transaction` 한 블록에서 `UPDATE` + `audit_log INSERT` 를 원자적으로 적용. 부분 적용 불가능 |
| C6 | `handler-output.adapter.ts` `_resumeState` 경로 테스트 전무 | `handler-output.adapter.spec.ts` 신규 작성 — canonical/bare/primitive 3 경로 + `_resumeState` lift + null/array 거부 + `toEngineFlatShape` 전 경로 검증 |
| C7 | `code.handler.ts` 에러코드 정규화 단언 없음 | 런타임 에러 / 문법 에러 / timeout / async timeout 4 케이스에 `output.error.code === 'CODE_EXECUTION_FAILED' \| 'CODE_TIMEOUT'` 단언 추가 |

### Warning

| # | 이슈 | 조치 |
|---|------|------|
| W10 | `http-request.handler.ts` `output.error.details.url` 자격증명 노출 | 비-2xx 경로와 catch 경로 모두 `sanitizeUrlCredentials(url)` 적용 |
| W20 | Workflow/send-email 에러 포트가 spec 에 미기재, 에러 코드 표가 구형 코드(`NODE_EXECUTION_FAILED`/`LLM_ERROR`) 나열 | `spec/5-system/3-error-handling.md §1.4` 를 **엔진 레벨 에러** / **노드 런타임 에러** 두 표로 재작성. 노드 런타임 에러는 `error-codes.ts` 참조 링크. 구 코드는 "노드 envelope 에 사용하지 않음" 명시 |
| W22 | AI Agent / Text Classifier 사용자 문서 Stage 5 경로 미반영 | `frontend/src/content/docs/02-nodes/ai.mdx` 끝에 신규 expression 경로 요약 블록 추가 (`output.result.response`, `output.result.category/categories`, `meta.*`, `output.error?.code`) |
| W13 | `http-request.handler.spec.ts` URL sanitize 엣지 케이스 없음 | 이미 Stage 6 에서 `secret:p4ss@api.example.com` 단일 케이스 추가 완료. 추가 fallback/catch 커버리지는 후속 PR 로 보류 |
| B2.W1/2 | Chart 출력에 `rendered` 부재 → carousel/table 와 비대칭 | `spec/4-nodes/6-presentation-nodes.md §3.3` 에 `output.rendered` SVG 필드 명시 |
| B2.W2 | status 통합 치환 시 `button_click` / `button_continue` 분기 의미 손실 | migration script Pass 5 의 reason 에 "verify matching output.interaction.type === '...' branch" 주석 추가. 테스트에 `output.interaction.type === 'button_click'` 이 치환되지 않음을 단언 |
| B2.W5 | `buildErrorEnvelope` 헬퍼 테스트 파일 부재 | `error-codes.spec.ts` 신규: enum 키=값 일관성, details 포함/미포함, 객체 identity, 빈 details 4 케이스 |
| B2.W6 | `button_continue` 치환 테스트 누락 | migration script spec 에 추가 |
| B2.W7 | discriminator dropout 경고가 carousel 만 커버 | `it.each` 로 carousel/table/chart/template/form 5 타입 모두 검증 |
| B2.W10 | `submittedData` 루트 참조 테스트 부재 | `$node["F"].output.submittedData` (no trailing field) 치환 케이스 추가 |
| B2.W12 | §1.2.x 플레이스홀더 섹션 번호 | `spec/5-system/4-execution-engine.md` 에서 §1.3 으로 확정 |
| B2.W14 | interaction.type === "button_click" 비교가 status Pass 에 오염될 가능성 | 그대로 유지됨을 단언하는 테스트 추가 (Pass 5 는 `.status ...` 패턴만 매칭하므로 실제로 안전) |

### INFO

| # | 이슈 | 조치 |
|---|------|------|
| B2.I14 | `$node` 참조 없는 표현식 pass-through 테스트 부재 | `$input.user.email` 류 표현식이 원문 그대로 반환되는 테스트 추가 |
| B2.I15 | `walkAndRewrite` 혼합 배열 (null/primitive/object/string) 미커버 | 해당 케이스 추가 |
| B2.I3 | `buildErrorEnvelope` 반환 타입 재사용성 낮음 | 타입 export 는 후속 리팩터에서 (이번 PR 로는 scope 외) |

## 2차 조치 (사용자 요청으로 후속 이월 항목 처리)

사용자가 "후속 작업도 전부 진행" 지시 후 같은 세션에서 추가로 해결한 항목:

| # | 이슈 | 조치 |
|---|------|------|
| C8 | CONVENTIONS 문서 경로 표시 | `CLAUDE.md` 에 `user_memo/node-specs-improvement/` 경로를 폴더 구조 트리에 명시. 핸들러 주석의 "CONVENTIONS §N" 참조 출처가 명확 |
| C9 | audit_log workspace/user `LIMIT 1` | Migration script 에 `--workspace-id <uuid>` / `--user-id <uuid>` CLI 플래그 추가. `--apply` 시 필수로 강제 (미지정 시 throw) |
| W3 | 에러 코드 rename 영향 | Repository 루트에 `CHANGELOG.md` 신규 작성 — 브레이킹 변경 13개 항목 + migration 절차 포함 |
| W4 | workflow 미연결 error 포트 silent success | `spec/4-nodes/2-flow-nodes.md` 에 workflow 노드 포트 정의 + `ERROR_PORT_FALLBACK` 참조 추가. dead-end 감지 구현은 `§3.2` 일반 정책에 위임 |
| W6 | `NodeHandlerOutput._resumeState` ISP | `ResumableNodeHandlerOutput extends NodeHandlerOutput` 서브타입을 `node-handler.interface.ts` 에 신설. 멀티턴 핸들러가 명시적 narrowing 가능 |
| W7 | `code.handler.ts` 이중 에러 코드 | `output.error.code` (표준) / `meta.errorCode` (legacy 로그) 역할을 JSDoc 으로 명확히 문서화. `meta.errorCode` 는 one-release deprecation 윈도우 명시 |
| W8 | Frontend DRY 위반 | `resolve-result-field.ts` 신규 + 6 테스트. `conversation-inspector.tsx` 가 사용 |
| W11 | `code.handler.ts` stack trace 프로덕션 노출 | `process.env.NODE_ENV !== 'production'` 일 때만 `output.error.details.stack` 포함. `meta.stack` 은 서버 로그 전용으로 유지 |
| W16 | Frontend conversation fallback 경로 테스트 | `output-shape.test.ts` 에 Stage 5 terminal + 모든 endReason + result 키를 가진 비-conversation 시나리오 검증 3건 추가 |
| W17 | Parallel `{branches, count}` 검증 | `execution-engine.service.spec.ts` 의 기존 "collect branch results" 테스트에 `received.count === 2` 단언 추가 |
| W18 | Migration script N+1 쿼리 | 워크플로우별 반복 SELECT 를 single JOIN 쿼리 (`SELECT w.id, n.* FROM workflow w JOIN node n …`) 로 통합. 메모리 내 workflow → nodes 그룹핑 유지 (label→type 스코프 보존) |
| W19 | 재실행 멱등성 | audit_log 항목에 `appliedAt` ISO 타임스탬프 추가. rewriter 는 이미 idempotent (Pass 1~4 구조적 skip, Pass 5 이미 `resumed` 는 매치 없음), 재실행은 zero-hit 로그만 남김 |
| W24/25 | Stage 선행 참조 주석 | `presentation-renderers.tsx` / `output-shape.ts` 주석의 "Stage 2/3 선행 참조" 문구를 "CONVENTIONS §4.3/4.5 (완료)" 형태로 수정 |
| W26/S3 | 에러 details PII | `backend/src/nodes/core/error-codes.ts` 에 `truncateForErrorDetails()` / `maskEmailForErrorDetails()` 헬퍼 + 12 테스트. `send-email.details.to` 를 `a***@domain` 로 마스킹, `subject` 를 200자로 truncate. `text-classifier.details.originalInput` 500자로 truncate |
| B2.W4 | config echo credential sanitize 공통화 | `integration-handler-base.ts` 에 `sanitizeConfigEcho()` + 15 credential 키 allowlist + 4 테스트. 재귀적 객체/배열 정화, 원본 불변성 보장 |
| B2.W8 | `previousOutput` lifecycle 문서화 | `execution-engine.service.ts` 의 `previousOutput` emit 지점 주석에 CONVENTIONS §4.2 명시 + Phase 3 precondition 참조 |
| B2.W11 | `USER_CANCELLED` / `INTERACTION_TIMEOUT` 에러 코드 | `error-codes.ts` enum 에 추가. spec `§1.4` 도 업데이트 |
| B2.W12 | §1.2.x 플레이스홀더 | `spec/5-system/4-execution-engine.md` 에서 §1.3 으로 확정 |
| B2.W21 | send-email spec 에 error 포트 기재 | `spec/4-nodes/4-integration-nodes.md §4.2/4.3` 재작성 — error 포트 + 성공/실패 예시 + IntegrationError preserve 정책 |

## 의도적 이월 (별도 PR)

| # | 이슈 | 이월 사유 |
|---|------|-----------|
| C2 | `_multiTurnState` → `_resumeState` 인플라이트 세션 | 엔진의 dual-read fallback 으로 충분. 배포 운영 가이드 CHANGELOG 에 기재 |
| W12 | presentation `meta.durationMs: 0` 하드코딩 | waiting 시점 측정 불가 (tick 즉시 완료). 설계 의도로 유지 |
| B2.C2/S9 | Form `output.submittedBy` 필드 | 핸들러/엔진이 처음부터 emit 한 적 없음. 인증 컨텍스트 통합이 선행 필요한 요구사항 PR |

## 검증

최종 조치(2차 포함) 반영 후 full TEST WORKFLOW 재실행:

- **backend**: `pnpm lint` ✅ / `pnpm test` → 98 suites / **1403 tests** 통과 (initial 1327 → +37 review batch → +12 follow-up: error-codes PII helpers 7건, sanitizeConfigEcho 4건, +1 conversion) / `pnpm build` ✅
- **frontend**: `pnpm lint` ✅ / `pnpm test` → 70 files / **914 tests** 통과 (+9: `resolveResultField` 6건, `isConversationOutput` Stage 5 paths 3건) / `pnpm build` ✅

## 관련 파일

- 핸들러 수정: `send-email.handler.ts`, `http-request.handler.ts`
- 테스트 신규/보강: `handler-output.adapter.spec.ts`, `error-codes.spec.ts`, `code.handler.spec.ts`, `migrate-node-output-refs.spec.ts`
- Migration 로직 강화: `scripts/migrate-node-output-refs.ts` (트랜잭션, Pass 6, 상태 치환 reason 보강)
- 문서: `spec/5-system/3-error-handling.md`, `spec/5-system/4-execution-engine.md` §1.3, `spec/4-nodes/6-presentation-nodes.md §3.3`, `frontend/src/content/docs/02-nodes/ai.mdx`
