# Code Review 통합 보고서 (workflow-resumable-execution Phase 1)

**검토 모드**: branch vs main
**검토 일자**: 2026-05-25
**세션**: `review/code/2026/05/25/00_40_56`
**대상 commits**: `5466b21a` (graph-rag frontmatter), `e34d2db2` (Phase 1 hotfix)

---

## 전체 위험도

**HIGH** — WS execution.start gate 미구현(spec §11 요건), errorPolicy 분기 누락, 503 응답 body 규약 불일치, registerInFlight try 블록 외부 배치(drain 무기한 위험), SIGTERM_GRACE_MS 입력 검증 부재 등 운영 영향 발견사항 다수.

## Critical (1건)

| # | Reviewer | 발견 | 위치 | 제안 |
|---|---|---|---|---|
| C-1 | requirement | WS `execution.start` shutdown gate 누락 — spec §11 step 1 은 HTTP 및 WS 양 진입점 모두에 503 게이트를 요구하나 WS 경로에 `isShuttingDown` 체크 없음 | `websocket.gateway.ts` (미변경) | (a) WS 핸들러에 동일 gate 구현, 또는 (b) WS 경로가 Phase 2 예정임을 spec §11 + plan 에 명시 |

## Warning (22건) — 핵심 항목

| # | Reviewer | 발견 | 위치 | 제안 |
|---|---|---|---|---|
| W-1 | side_effect | `registerInFlight` 가 `try` 바깥 — `eventEmitter.emitNode()` throw 시 `finally` 의 `unregisterInFlight` 미실행 → Map 잔류 → drain 무기한 블로킹 | `execution-engine.service.ts` `executeNode()` | `registerInFlight` 를 `try` 첫 줄로 이동 |
| W-2 | security/testing | `SIGTERM_GRACE_MS` 입력 검증 없음 — 비숫자 시 NaN 주입 → 즉시 SERVER_INTERRUPTED 마킹 | `execution-engine.module.ts` useFactory | `Number.isFinite(parsed) && parsed > 0 ? parsed : 30_000` 방어 |
| W-3 | security | 503 응답 body 가 "Server is shutting down..." 내부 운영 상태 노출 | `workflows.controller.ts` | 중립 메시지 "Service temporarily unavailable. Please retry." |
| W-4 | security/concurrency | 다중 인스턴스 — 동일 executionId 의 다른 인스턴스 RUNNING NodeExecution 있을 때 Execution 조기 FAILED 마킹 race | `shutdown-state.service.ts` `markRemainingAsInterrupted()` | Execution 마킹 전 사이트 외 RUNNING 잔존 확인, 또는 cleanup 잡 위임 |
| W-5 | architecture | `WorkflowsController` 가 `ShutdownStateService` 직접 주입 — 프레젠테이션 레이어가 인프라 lifecycle 알게 됨 | controller / module | `ShutdownGuard` 추출 |
| W-6 | architecture | `SHUTDOWN_GRACE_MS` DI 토큰이 문자열 리터럴 — 오타 시 런타임만 검출 | module / service | `shutdown.tokens.ts` Symbol 상수 |
| W-7 | requirement | spec §11 step 4 — grace 초과 후 errorPolicy `stop`/`continue` 분기 미구현 (현재 모든 row 일괄 FAILED) | `shutdown-state.service.ts` | errorPolicy 분기 구현, 또는 "Phase 1.2 = stop 정책 동등" 을 spec §11 에 명시 |
| W-8 | requirement/api_contract | 503 응답 body 가 API 규약 `{ error: { code, message } }` 래핑 충족 여부 불명확 | `workflows.controller.ts` | 전역 필터 래핑 확인 + 테스트 |
| W-9 | side_effect | `@Res({ passthrough: true })` — 기존 인터셉터(ClassSerializerInterceptor) 영향 가능성 | controller | 정상 경로 통합 테스트 |
| W-10 | testing | `executeNode` 의 `registerInFlight`/`unregisterInFlight` 짝 호출 검증 없음 (특히 throw finally) | `execution-engine.service.spec.ts` | 성공/throw 두 케이스 추가 |
| W-11 | testing | `markRemainingAsInterrupted` DB UPDATE 실패 graceful degradation 검증 없음 | `shutdown-state.service.spec.ts` | mockRejectedValue 케이스 추가 |
| W-12 | testing | `SIGTERM_GRACE_MS=NaN` 엣지케이스 모듈 레벨 사각지대 | module factory | factory 방어 + 테스트 |
| W-13 | testing | 503 응답 테스트에 `body.message` 필드 검증 없음 | `workflows.controller.spec.ts` | message string assertion 추가 |
| W-14 | documentation | `WorkflowsController.execute()` 에 503 Swagger 데코레이터 누락 | controller | `@ApiResponse({ status: 503, ... })` 추가 |
| W-15 | documentation | `SIGTERM_GRACE_MS` `.env.example` 미반영 여부 불확실 | backend/.env.example | 추가 + k8s 동기화 주석 |
| W-16 | user_guide_sync | `run-results.mdx` 에러 코드 FieldTable 에 `SERVER_INTERRUPTED` 미등재 | `frontend/src/content/docs/05-run-and-debug/run-results.{mdx,en.mdx}` | 행 추가 |
| W-17 | concurrency | BullMQ worker close/pause 가 ShutdownStateService 와 lifecycle 순서 미조율 가능 | module | 순서 확인 |
| W-18 | maintainability | `30_000` 기본값 module factory + service 생성자 두 곳 중복 | module / service | `DEFAULT_GRACE_MS` 상수 단일화 |
| W-19 | maintainability | `graceMs`/`pollMs` 필드 선언이 생성자 아래 — 스타일 불일치 | service | 필드 상단 이동 |
| W-20 | maintainability | `@Res()` express 직접 의존 — Fastify 전환 시 영향 | controller | exception body + 공통 필터 패턴 |
| W-21 | api_contract | `recoverStuckExecutions` 메시지 변경(`'server restarted...'` → `'worker heartbeat timeout'`) breaking change | service | `code: 'WORKER_HEARTBEAT_TIMEOUT'` 구조화 |
| W-22 | api_contract | `SERVER_INTERRUPTED` 가 `spec/1-data-model.md §2.13` 코드 목록 미등재 | spec | 목록 추가 |

## Info (16건)

`Retry-After` NaN 가능성 (W-2 해소 시 연쇄), `fromConfig` dead code, `_retry_state.json` 절대경로, ExecutionEngineService God Object 징후, BullMQ lifecycle 순서 명문화, `app.enableShutdownHooks()` e2e 미커버, plan 체크박스 미갱신, Phase 레이블 stale 위험, ERROR_KO 매핑 미존재, 등.

## Reviewer별 위험도

| Reviewer | 위험도 | 핵심 |
|---|---|---|
| requirement | HIGH | C-1 (WS gate 누락) + W-7 (errorPolicy) + W-8 (503 body) |
| security | MEDIUM | W-2 / W-3 / W-4 |
| side_effect | MEDIUM | W-1 (drain 무기한 위험) |
| testing | MEDIUM | W-10 / W-11 / W-12 |
| api_contract | MEDIUM | W-8 / W-21 / W-22 |
| user_guide_sync | MEDIUM | W-16 |
| architecture | LOW | W-5 / W-6 + I-4 |
| concurrency | LOW | W-4 / W-17 |
| maintainability | LOW | W-18 / W-19 / W-20 |
| documentation | LOW | W-14 / W-15 |
| scope | LOW | dead code 정리 |

## 제외된 Reviewer (router)

- performance — 반복 I/O·캐시 변경 없음
- dependency — package.json 변경 없음
- database — schema migration 없음

## 권장 조치 순서

1. **[C-1 + W-1 + W-2]** 즉시 fix (요구사항 누락 + drain 무기한 위험 + NaN 주입)
2. **[W-3 + W-7 + W-8]** spec §11 정합 (메시지 중립화 / errorPolicy scope 명시 / 503 body 규약 검증)
3. **[W-10 + W-11 + W-12 + W-13]** 테스트 보강 4종
4. **[W-14 + W-15 + W-16 + W-22]** 문서 / spec 보완 (Swagger / .env / user-guide / data-model)
5. **[W-4 + W-17 + W-21]** 다중 인스턴스 안전성 + lifecycle 순서 + 에러 코드 구조화
6. **[I 일괄]** Phase 2 전 정리 (plan 체크박스, fromConfig 제거, ShutdownGuard 추출 등)
