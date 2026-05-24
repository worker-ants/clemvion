# RESOLUTION — review/code/2026/05/25/00_40_56

**대상**: workflow-resumable-execution Phase 1 hotfix (branch: claude/workflow-resumable-execution-6b105e)
**처리일**: 2026-05-25

---

## 조치 항목

| SUMMARY # | 분류 | 조치 | 비고 |
|-----------|------|------|------|
| C-1 | spec | draft 위임 | `plan/in-progress/spec-fix-graceful-shutdown-phase-scope.md` — §11 step 1 Phase 1 scope 명시 필요 |
| W-1 | 코드 | 8a4ad936 | registerInFlight → try 블록 첫 줄 이동. emitNode throw 시 drain 무기한 위험 해소 |
| W-2 | 코드 | 8a4ad936 | SIGTERM_GRACE_MS `Number.isFinite && > 0` 방어 추가. NaN/음수 → 30_000 fallback |
| W-3 | 코드 | 8a4ad936 | 503 message 중립화: "Service temporarily unavailable. Please retry." |
| W-4 | 보류 | Phase 2 | 다중 인스턴스 race 문서화. continuation-queue 구현 후 재검토 |
| W-5 | 보류 | Phase 2 | ShutdownGuard 추출 — architecture 개선. Phase 2 refactor 대상 |
| W-6 | 보류 | Phase 2 | DI token Symbol 화 — Phase 2 리팩터 대상 |
| W-7 | spec | draft 위임 | `plan/in-progress/spec-fix-graceful-shutdown-phase-scope.md` — §11 step 4 errorPolicy Phase 1 = stop 동등 명시 |
| W-8 | 코드 | 확인 완료 | GlobalExceptionFilter 가 `{ error: { code, message, requestId } }` 로 래핑 확인. 별도 fix 불필요 |
| W-9 | 보류 | Phase 2 | `@Res()` + ClassSerializerInterceptor 영향 통합 테스트. 정상 경로 현재 동작 중 |
| W-10 | 코드 | 8a4ad936 | executeNode registerInFlight/unregisterInFlight 짝 호출 테스트 추가 (성공+throw 양 경로) |
| W-11 | 코드 | 8a4ad936 | markRemainingAsInterrupted DB UPDATE 실패 graceful degradation 테스트 추가 |
| W-12 | 코드 | 8a4ad936 | SIGTERM_GRACE_MS factory NaN/0/음수 방어 단위 테스트 신설 |
| W-13 | 코드 | 8a4ad936 | 503 body.message assertion 테스트 추가 |
| W-14 | 코드 | 8a4ad936 | `@ApiResponse({ status: 503 })` Swagger 데코레이터 추가 |
| W-15 | 코드 | 8a4ad936 | `.env.example` SIGTERM_GRACE_MS 항목 추가 |
| W-16 | 보류 | user-guide-writer | `run-results.mdx` SERVER_INTERRUPTED 행 추가 — 별도 문서화 작업 위임 |
| W-17 | 보류 | Phase 2 | BullMQ worker/ShutdownStateService lifecycle 순서 — Phase 2 continuation-queue 때 확인 |
| W-18 | 코드 | 8a4ad936 | DEFAULT_GRACE_MS 상수 → `shutdown/shutdown.constants.ts` 단일화 |
| W-19 | 코드 | 8a4ad936 | graceMs/pollMs 필드 선언 생성자 위로 이동 |
| W-20 | 보류 | Phase 2 | `@Res()` express 의존 → exception body + 공통 필터 패턴 전환. Phase 2 refactor |
| W-21 | 코드 | b3feedb0 | recoverStuckExecutions error `{ code: 'WORKER_HEARTBEAT_TIMEOUT', message }` 구조화 |
| W-22 | 확인 완료 | — | `spec/1-data-model.md §2.13` SERVER_INTERRUPTED 이미 등재 확인. plan 체크박스 [x] 갱신 포함 |

---

## TEST 결과

- lint  : 통과
- unit  : 통과 (4757 passed)
- e2e   : 통과 (119/119)

---

## 보류·후속 항목

### Spec Draft (project-planner 위임 필요)

`plan/in-progress/spec-fix-graceful-shutdown-phase-scope.md` — 3개 변경 포함:
1. spec §11 step 1: Phase 1 = HTTP gate only (WS `execution.start` 미구현, Phase 2 예정) 명시
2. spec §11 step 4: Phase 1 = `stop` 정책 동등 처리, `continue` 분기는 Phase 2
3. spec/1-data-model.md §2.13: `WORKER_HEARTBEAT_TIMEOUT` 코드 어휘 추가

처리 경로: `/consistency-check --spec spec/5-system/4-execution-engine.md` → BLOCK:NO 확인 → project-planner 가 spec 반영 → resolution-applier 재호출 (동일 session_dir).

### Phase 2 대상 (continuation-queue 구현 후)

- W-4: Execution 조기 FAILED 마킹 race — 다중 인스턴스 동일 executionId 처리 확인
- W-5: ShutdownGuard NestJS Guard 로 추출 — 프레젠테이션 레이어 인프라 의존 분리
- W-6: `'SHUTDOWN_GRACE_MS'` Symbol 상수화 — `shutdown.tokens.ts`
- W-9: `@Res({ passthrough: true })` ClassSerializerInterceptor 영향 통합 테스트
- W-17: BullMQ worker close/pause 와 ShutdownStateService lifecycle 순서 조율
- W-20: `@Res()` express 직접 의존 → exception body + 공통 필터 패턴

### user-guide-writer 위임

- W-16: `frontend/src/content/docs/05-run-and-debug/run-results.mdx` — SERVER_INTERRUPTED 에러 코드 행 추가

### INFO 항목 (자동 수정 대상 아님)

- I-2: `fromConfig` static method — dead code. 현재 사용처 없으나 삭제는 별도 PR에서 안전하게.
- I-12: plan 체크박스 갱신 — Phase 1.1/1.2 [x] 완료 (본 RESOLUTION 에서 처리).
- 나머지 INFO: Phase 2/3 정리 대상.
