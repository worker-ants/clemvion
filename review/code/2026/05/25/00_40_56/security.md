# 보안(Security) 리뷰 결과

**리뷰 대상**: workflow-resumable-execution Phase 1 (Graceful Shutdown + Recovery Policy 변경)
**리뷰 일자**: 2026-05-25
**주요 파일**: `main.ts`, `execution-engine.module.ts`, `execution-engine.service.ts`, `shutdown-state.service.ts`, `workflows.controller.ts` 외 spec/plan 문서

---

## 발견사항

### [WARNING] SQL UPDATE WHERE 절 — nodeExecutionId 범위 제한 올바르나 executionId 범위 제한 부재
- **위치**: `shutdown-state.service.ts` `markRemainingAsInterrupted()` (lines 199–215)
- **상세**: `nodeExecutionRepository` UPDATE 는 `WHERE id IN (:...ids)` 로 본 인스턴스가 등록한 ID 만 정확히 지정한다. 반면 `executionRepository` UPDATE 는 `WHERE id IN (:...ids)` 로 `executionIds` 를 지정하면서 동시에 `AND status = 'running'` 조건을 추가한다. `executionIds` 는 `inFlightNodeExecutions.values()` 에서 파생된 Set 이므로 본 인스턴스의 NodeExecution 과 연결된 Execution 만 포함한다. 이 설계 자체는 적절하다. 단, 동일 `executionId` 에 속하는 **다른 NodeExecution 이 다른 인스턴스에서 동시 RUNNING 중**인 경우, 해당 Execution row 가 아직 정상 진행 중임에도 `FAILED` 로 덮어쓸 수 있다. 이는 다중 인스턴스 환경에서 같은 Execution 의 병렬 NodeExecution 이 서로 다른 인스턴스에 분산되어 있을 때 발생하는 race condition 이다.
- **제안**: `executionRepository` UPDATE 에 추가 조건을 도입한다. 예: 마킹 전 해당 Execution 에 다른 RUNNING NodeExecution 이 남아있지 않은지 확인하거나, `Execution` 상태 마킹을 별도 cleanup 잡으로 위임하여 인스턴스 간 경합을 회피한다. 또는 spec §7.5 rehydration 이 완성되기 전까지 `executionRepository` UPDATE 를 보수적으로 제거하고 stuck-recovery 에 위임하는 방안도 검토한다.

---

### [WARNING] process.env.SIGTERM_GRACE_MS 입력 검증 부재 — NaN / 음수 허용
- **위치**: `execution-engine.module.ts` provider `useFactory: () => Number(process.env.SIGTERM_GRACE_MS ?? 30_000)` (line 77)
- **상세**: `process.env.SIGTERM_GRACE_MS` 를 `Number()` 로 변환하는데, 환경변수가 비숫자 문자열(예: `"abc"`)로 설정되면 `NaN`, 음수(예: `"-1"`)이면 음수 ms 가 그대로 서비스에 주입된다. `waitForDrain(NaN, pollMs)` 호출 시 `Date.now() < deadline` 조건이 항상 `false` 가 되어 드레인 대기 없이 즉시 SERVER_INTERRUPTED 마킹이 발생한다. 결과적으로 SIGTERM 수신 시 유예 기간 없이 in-flight 실행이 즉시 FAILED 처리된다.
- **제안**: `useFactory` 에서 파싱 결과를 검증한다:
  ```typescript
  const parsed = Number(process.env.SIGTERM_GRACE_MS ?? 30_000);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30_000;
  ```

---

### [WARNING] 서버 점검 중 503 응답 — 에러 메시지에 내부 운영 정보 노출
- **위치**: `workflows.controller.ts` `ServiceUnavailableException` 본문 (lines 618–624)
- **상세**: 503 응답 body 에 `'Server is shutting down; new executions are temporarily refused. Retry after the indicated interval.'` 메시지를 그대로 외부 클라이언트에 노출한다. 이 메시지는 공격자에게 서버가 재시작 중임을 알려주어 서비스 가용성 정보가 노출된다. k8s 환경에서 롤링 배포 시 이 정보는 공격자가 패치 윈도우를 추론하거나 서비스 재시작 타이밍을 파악하는 데 활용될 수 있다.
- **제안**: 외부에 노출되는 메시지를 `'Service temporarily unavailable. Please retry.'` 처럼 중립적인 표현으로 교체하고, 상세 이유는 서버 로그에만 기록한다. `code: 'SERVER_SHUTTING_DOWN'` 도 내부 모니터링 코드로 취급해야 하며, API 클라이언트에 노출 수준을 spec `2-api-convention.md` 와 맞춰 검토한다.

---

### [INFO] `Retry-After` 헤더 값이 정수 검증 없이 설정됨
- **위치**: `workflows.controller.ts` `res.setHeader('Retry-After', String(this.shutdownState.retryAfterSec))` (line 619)
- **상세**: `retryAfterSec` 은 `Math.ceil(this.graceMs / 1000)` 이므로 `graceMs` 가 `NaN` 이면 `retryAfterSec` 도 `NaN` 이 되어 헤더가 `'NaN'` 으로 설정된다. RFC 7231 은 `Retry-After` 를 양수 정수로 정의하므로 `'NaN'` 이면 클라이언트가 헤더를 무시할 수 있다. `SIGTERM_GRACE_MS` 검증 (위 WARNING) 이 먼저 해결되면 연쇄적으로 해소된다.
- **제안**: `SIGTERM_GRACE_MS` 입력 검증 추가 후 자동 해소. 별도로 `retryAfterSec` getter 에 `Math.max(1, ...)` 가드 추가도 권장.

---

### [INFO] ShutdownStateService — Map 비원자적 접근
- **위치**: `shutdown-state.service.ts` `registerInFlight` / `unregisterInFlight` / `onApplicationShutdown` (lines 102–150)
- **상세**: Node.js 는 싱글 스레드 이벤트 루프이므로 동기적 Map 조작은 일반적으로 안전하다. 그러나 `waitForDrain` 루프 내 `await new Promise(resolve => setTimeout(resolve, pollMs))` 사이의 microtask / macrotask 구간에서 `unregisterInFlight` 가 호출될 수 있으므로 drain 감지는 정상 동작한다. 현행 구현은 Node.js 단일 스레드 전제 하에 안전하다. 단, 향후 worker_thread 또는 클러스터 모드 도입 시 재검토가 필요하다.
- **제안**: 현재 구현에서 즉각 조치 불필요. 코드 주석에 "단일 스레드 이벤트 루프 전제, worker_thread 도입 시 재검토" 를 명시 권장.

---

### [INFO] `recoverStuckExecutions` — `RUNNING` 상태만 복구 대상으로 올바르게 제한
- **위치**: `execution-engine.service.ts` `recoverStuckExecutions()` 변경 (lines 664–278)
- **상세**: 기존에 `WAITING_FOR_INPUT` 상태의 Execution 을 일괄 FAILED 처리하던 로직이 제거되고, `RUNNING` 상태만 복구 대상이 되었다. 이 변경으로 인해 사용자가 입력 대기 중인 Execution 이 서버 재시작 시 무단으로 종결되는 보안/UX 위험이 해소되었다. 에러 메시지도 `'worker heartbeat timeout'` 으로 명확해져 로그 분석 시 오해가 줄어든다. 보안 관점에서 양호한 변경이다.
- **제안**: 없음.

---

### [INFO] `app.enableShutdownHooks()` 추가 — Nest 라이프사이클 훅 활성화
- **위치**: `main.ts` line 41
- **상세**: SIGTERM 수신 시 Nest 라이프사이클 훅이 호출되도록 설정한다. 이는 표준 Graceful Shutdown 패턴이며 보안적 우려는 없다. 다만 `onApplicationShutdown` 구현이 예외를 throw 하면 프로세스가 비정상 종료될 수 있으므로, `ShutdownStateService.onApplicationShutdown` 내부에서 충분한 `try/catch` 가 필요하다. 현재 구현은 `markRemainingAsInterrupted` 내에 `try/catch` 를 갖추고 있어 적절하다.
- **제안**: 없음.

---

### [INFO] `shutdown-state.service.ts` `fromConfig` 정적 팩토리 — DI 우회 경로
- **위치**: `shutdown-state.service.ts` `static fromConfig(...)` (lines 69–80)
- **상세**: `fromConfig` 는 DI 컨테이너 외부에서 `ShutdownStateService` 인스턴스를 직접 생성하는 경로를 제공한다. 이 메서드가 실제 NestJS DI 수명주기와 다른 인스턴스를 생성하면 shutdown 상태가 두 인스턴스에 각각 분리되어 동기화되지 않는 논리적 취약점이 생길 수 있다. 현재 사용처가 주석으로 "테스트 직접 호출 목적" 으로 명시되어 있고 실 production 코드에서 호출되지 않는 것으로 보이나, public 접근 제어자로 외부 노출되어 있다.
- **제안**: `fromConfig` 를 `private` 또는 `@internal` 처리하거나, 실제 사용처가 없다면 제거를 검토한다.

---

### [INFO] `_retry_state.json` 파일에 절대 경로 포함
- **위치**: `review/consistency/2026/05/24/23_26_13/_retry_state.json` 등 다수 (lines 825–875)
- **상세**: JSON 파일에 `/Volumes/project/private/clemvion/.claude/worktrees/...` 형식의 로컬 절대 경로가 하드코딩되어 있다. 이 파일들이 git 에 커밋되면 개발자의 로컬 파일시스템 구조가 저장소 이력에 기록된다. 직접적인 취약점은 아니지만 정보 노출(Information Exposure, OWASP A05:2021 — Security Misconfiguration) 의 경계 케이스에 해당한다.
- **제안**: `_retry_state.json` 파일들을 `.gitignore` 에 추가하거나, 절대 경로 대신 프로젝트 루트 상대 경로로 기록하도록 도구를 수정한다. 또는 `review/` 전체를 `.gitignore` 처리를 검토.

---

## 요약

이번 변경의 핵심은 SIGTERM 수신 시 in-flight NodeExecution 을 안전하게 완료하거나 SERVER_INTERRUPTED 로 마킹하는 Graceful Shutdown 기능 추가, 그리고 `WAITING_FOR_INPUT` 상태를 stuck-recovery 대상에서 제외하는 Recovery 정책 변경이다. 보안 관점에서 가장 주목할 이슈는 두 가지다. 첫째, `SIGTERM_GRACE_MS` 환경변수 입력 검증이 없어 비숫자 값이 주입되면 유예 기간 없이 즉시 마킹이 발생하는 예측 불가능한 동작이 발생할 수 있다. 둘째, 동일 Execution 에 속한 NodeExecution 이 다른 인스턴스에도 분산되어 있을 경우 Execution row 를 FAILED 로 over-marking 하는 다중 인스턴스 race condition 이 잠재한다. 503 응답에 서버 재시작 상태를 알리는 정보가 외부에 노출되는 점도 보안 관행상 개선이 필요하다. 인젝션 취약점, 하드코딩된 시크릿, 인증/인가 우회, 평문 전송 등 주요 OWASP Top 10 항목은 이번 변경에서 해당 사항이 없다. 전체적으로 구조적 취약점보다는 운영 안정성과 정보 노출 수준의 이슈가 주를 이룬다.

---

## 위험도

MEDIUM
