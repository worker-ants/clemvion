# 보안(Security) Review

## 검토 대상 요약

`ExecuteOptions.triggerType`(`manual`/`webhook`/`schedule`) 필드를 신설해 `execute()` → BullMQ
`execution-run` 큐의 job priority 계산(`resolveExecutionRunPriority`)에 threading 하는 변경.
호출부 3곳(webhook `hooks.service.ts`, chat-channel `hooks.service.ts`, cron
`schedule-runner.service.ts`)이 서버 내부에서 리터럴 문자열(`'webhook'`/`'schedule'`)을 하드코딩해
전달하며, `manual` 은 여전히 `executedBy` 유무로 판정한다. 나머지 변경은 대응 unit spec, plan
문서(`plan/complete/exec-intake-queue-impl.md`), 일관성 검토 산출물(`review/consistency/...`),
spec 문서(`spec/5-system/4-execution-engine.md`) 갱신으로 실행 코드가 아니다.

## 발견사항

없음 (No security findings)

### 근거 (점검 관점별)

1. **인젝션 취약점**: 신규 필드 `triggerType` 은 외부 입력(HTTP body/header/query)에서 직접 오지
   않는다 — 세 호출부 모두 서버 코드가 정적 문자열 리터럴(`'webhook'`, `'schedule'`)을 하드코딩해
   전달한다(`hooks.service.ts:226,234`, `schedule-runner.service.ts:1062`). 사용자가 이 값을 통제할
   경로가 없다. `resolveExecutionRunPriority`(`execution-run.queue.ts:39-46`)도
   `triggerType in EXECUTION_RUN_PRIORITY` 화이트리스트 검증 후에만 조회하고, 그 외 값은 안전한
   기본값(`schedule`, 최저 우선순위)으로 폴백한다 — 설령 향후 신뢰할 수 없는 입력이 흘러들어도
   객체 프로토타입 오염이나 임의 코드 경로 진입 위험이 없는 닫힌 열거형 lookup 이다.
2. **하드코딩된 시크릿**: 해당 없음. 추가된 문자열은 열거형 태그일 뿐 시크릿이 아니다.
3. **인증/인가**: 변경이 인증/인가 로직에 관여하지 않는다. webhook 인증(`authConfigId` 검증),
   chat-channel inbound 서명 검증, schedule 활성 여부 검사 등 기존 가드는 모두 `triggerType` 필드
   추가 이전 코드 경로에서 그대로 유지된다 — diff 는 이미 인증/필터를 통과한 뒤의 `execute()` 호출
   인자에만 필드를 추가한다.
4. **입력 검증**: `triggerType` 은 `ExecutionRunTriggerType`(`'manual'|'webhook'|'schedule'`) 유니온
   타입으로 컴파일 타임 제한되고, 런타임에도 안전한 화이트리스트 lookup + fallback 이 있어 별도
   검증이 불필요하다. `ExecuteOptions` 판별 유니온(`executedBy` variant 는 `triggerType?: never`)이
   `manual` 과 `triggerId` 경로가 동시에 값을 갖지 못하도록 타입 레벨에서 강제한다.
5. **OWASP Top 10**: 이 변경만으로 새로 노출되는 attack surface(엔드포인트, 파라미터, 직렬화 등)가
   없다. Job priority 값은 숫자(1/2/3)로 BullMQ 내부 스케줄링에만 쓰이고 API 응답이나 클라이언트에
   노출되지 않는다(`ExecutionRunJob` payload 에도 `triggerType` 을 싣지 않는다는 것이 명시적 설계
   결정 — `execution-engine.service.ts` 주석, priority 계산 전용 경계).
6. **암호화**: 관련 없음(암호화/해시 대상 데이터 없음).
7. **에러 처리**: 변경된 코드 경로에 에러 메시지 생성/노출 로직 자체가 없다(단순 필드 전달 + lookup).
8. **의존성 보안**: 신규/변경 외부 의존성 없음.

### 참고 (보안과 무관하지만 확인한 사항)
- DoS/자원소진 관점: priority 는 BullMQ 처리 "순서"에만 영향, 처리 자체를 막거나 무기한 지연시키는
  경로는 아니다(schedule 도 fallback 최저 우선순위일 뿐 실행은 진행). 별도 조치 불요.
- 문서/plan/review 산출물(파일 7~15)은 실행 코드가 아니므로 보안 리뷰 대상에서 실질적 위험 없음.

## 요약

이번 diff 는 내부 전용 타입(`ExecuteOptions.triggerType`)을 신설해 이미 서버가 신뢰하는 값(호출부
하드코딩 리터럴)을 BullMQ job priority 계산에 threading 하는 순수 리팩터링 성격의 변경으로, 사용자
입력이 개입할 경로가 없고 안전한 화이트리스트+fallback lookup 을 사용하며 인증/인가/암호화/에러
처리 로직을 건드리지 않는다. 보안 관점에서 유의미한 신규 리스크를 발견하지 못했다.

## 위험도
NONE

STATUS: SUCCESS
