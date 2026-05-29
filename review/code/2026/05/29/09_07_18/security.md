# 보안(Security) 리뷰

**리뷰 대상 커밋**: staged changes (workflow-resumable-phase3)
**리뷰 일시**: 2026-05-29
**검토 파일**:
- `continuation-dlq-monitor.service.ts` (신규)
- `continuation-dlq-monitor.service.spec.ts` (신규)
- `continuation-execution.processor.ts` (수정)
- `continuation-execution.processor.spec.ts` (수정)
- `execution-engine.module.ts` (수정)
- `execution-engine.service.ts` (수정)
- `executions.controller.ts` (수정)
- `external-interaction/interaction.service.ts` (수정)
- `websocket/websocket.gateway.ts` (수정)

---

## 발견사항

### 에러 처리 / 정보 노출

- **[WARNING]** `InvalidExecutionStateError` 메시지가 클라이언트에 그대로 노출됨
  - 위치: `executions.controller.ts` `continueExecution` catch 블록 / `interaction.service.ts` `dispatchContinuation` / `websocket.gateway.ts` 에러 핸들러 4곳
  - 상세: `InvalidExecutionStateError` 의 `message` 는 내부 DB 상태 정보를 포함한다 (`No WAITING_FOR_INPUT NodeExecution for execution=${executionId}`, `Multiple (${rows.length}) WAITING_FOR_INPUT NodeExecutions for execution=${executionId}` 등). 이 메시지가 REST 422 응답 body 의 `error.message` 필드와 WS ack 의 `error` 필드에 원문 그대로 전달된다. 공격자는 이를 이용해 execution ID 유효성 탐색, execution 상태 확인, 내부 invariant 위반 현황 파악(다중 row 메시지의 `rows.length` 포함) 등에 활용할 수 있다.
  - 제안: 클라이언트로 반환하는 메시지는 고정된 사용자 향 문자열(`'Execution is not currently waiting for input'`)로 대체하고, 내부 상세 정보(`executionId`, `rows.length` 등)는 서버 로그에만 기록한다. `error.message` 노출 없이 `error.code: 'INVALID_STATE'` 만 반환하는 방식도 유효하다.

- **[INFO]** `onFailed` 로그에 `executionId`/`jobId` 포함
  - 위치: `continuation-execution.processor.ts` `onFailed` 메서드
  - 상세: warn 레벨 로그에 `execution=${job.data?.executionId}`, `jobId=${job.id}` 가 포함된다. 서버 측 내부 로그이므로 현재 아키텍처에서 직접 외부 노출 경로는 없다. 로그 집계 시스템이 외부에 노출되는 경우 execution ID 열거 가능성이 생긴다.
  - 제안: 현재 구조에서는 수용 가능. 로그 접근 권한 관리 정책 점검 권장.

- **[INFO]** DB 인프라 에러가 caller 체인을 통해 상위로 전파됨
  - 위치: `execution-engine.service.ts` `resolveWaitingNodeExecutionId` catch 블록
  - 상세: DB lookup 실패 시 원본 에러(`err`)를 그대로 재던진다. REST controller 에서 `InvalidExecutionStateError` 가 아닌 경우 `throw error` 로 재던져 NestJS 기본 500 핸들러가 처리한다. NestJS 프로덕션 모드에서는 상세 메시지를 숨기므로 현재 설정에서 노출 위험은 낮다.
  - 제안: 명시적인 글로벌 예외 필터에서 DB 에러 메시지를 sanitize하는 것을 권장한다.

### 입력 검증

- **[WARNING]** `CONTINUATION_DLQ_MONITOR_ENABLED` 환경변수 검증이 `!== 'false'` 단순 비교
  - 위치: `continuation-dlq-monitor.service.ts` 생성자
  - 상세: `process.env.CONTINUATION_DLQ_MONITOR_ENABLED !== 'false'` 는 `'FALSE'`, `'0'`, `'no'`, `'disabled'` 등 직관적으로 falsy한 값에 대해 `enabled=true` 로 동작한다. 보안 직접 위협보다는 운영 설정 오류(모니터를 비활성화하려 했으나 실제로는 활성 유지) 위험이다.
  - 제안: `['false', '0'].includes((raw ?? '').toLowerCase().trim())` 방식으로 다양한 falsy 입력을 처리하거나, 문서에 `'false'` 리터럴만 인정한다고 명시한다.

- **[INFO]** `parsePositiveInt` 에서 공학 표기법 입력이 통과됨
  - 위치: `continuation-dlq-monitor.service.ts` `parsePositiveInt` 함수
  - 상세: `Number('1e10')` 은 `Number.isInteger` 검사를 통과하므로, `CONTINUATION_DLQ_ALARM_THRESHOLD=1e10` 같은 입력이 그대로 적용되어 알람 임계값이 실질적으로 무력화될 수 있다. 서비스 가용성에 대한 간접 위험.
  - 제안: 상한선 검증 추가(`parsed > 0 && parsed <= SOME_REASONABLE_MAX`) 고려.

### 인증/인가

- **[NONE]** `executions.controller.ts` `continueExecution` — 기존 `verifyOwnership`(IDOR 차단) 호출이 `InvalidExecutionStateError` 처리보다 선행한다. 인가 검증 순서 변경 없음, 우회 위험 없음.

### 하드코딩된 시크릿

- **[NONE]** 변경된 모든 파일에서 API 키, 비밀번호, 토큰, 인증서 등 하드코딩 시크릿 없음. 테스트 파일의 더미 ID(`'exec-1'`, `'ne-1'`, `'job-x'`)는 테스트 픽스처로 실제 시크릿 아님.

### 인젝션 취약점

- **[NONE]** `execution-engine.service.ts` `resolveWaitingNodeExecutionId` — TypeORM `find()` ORM 레이어 사용, 파라미터 바인딩으로 SQL 인젝션 위험 없음. XSS, 커맨드 인젝션, 경로 탐색 등 기타 인젝션 관련 변경 없음.

### OWASP Top 10

- **[WARNING]** A09 보안 로깅 및 모니터링 — DLQ 알람이 `logger.error` 단일 채널에 의존
  - 위치: `continuation-dlq-monitor.service.ts` `checkOnce`
  - 상세: DLQ depth 임계 초과 알람이 로그 파이프라인 단일 채널에 의존한다. 로그 수집기 장애, 로그 레벨 설정 오류 시 알람이 누락될 수 있다. Phase 3.1 범위(OTel traces-only, 메트릭 미구축) 내 의도된 설계이나, 운영 가시성 저하 위험이 있다.
  - 제안: Phase 3.1 범위에서는 수용 가능. 이후 Phase에서 메트릭 파이프라인 구축 시 해당 알람을 메트릭 카운터로도 발행하도록 TODO 추가 권장.

### 암호화

- **[NONE]** 변경 범위 내 암호화/해시 알고리즘 사용 없음. 평문 전송 로직 없음.

### 의존성 보안

- **[NONE]** 신규 패키지 추가 없음. `bullmq`, `@nestjs/bullmq` 는 기존 의존성.

---

## 요약

이번 변경(Phase 3.1 DLQ 모니터 서비스 신규 추가 및 `InvalidExecutionStateError` publisher 측 사전 검증 도입)은 전반적으로 안전하게 구현되었으며 하드코딩 시크릿, SQL 인젝션, 인가 우회 등 고위험 취약점은 발견되지 않았다. 주요 개선이 필요한 사항은 두 가지다. 첫째, `InvalidExecutionStateError.message` 에 포함된 내부 DB 상태 정보(`executionId`, `rows.length`)가 REST 422 응답 및 WS ack 에 원문으로 노출되므로(WARNING), 클라이언트 향 메시지를 고정 문자열로 대체하고 상세 정보는 서버 로그에만 기록해야 한다. 둘째, `CONTINUATION_DLQ_MONITOR_ENABLED` 의 `!== 'false'` 단순 비교는 운영자의 설정 오류를 유발할 수 있다(WARNING). 그 외 사항은 INFO 수준이며 현재 아키텍처 컨텍스트에서 수용 가능하다.

## 위험도

**LOW**
