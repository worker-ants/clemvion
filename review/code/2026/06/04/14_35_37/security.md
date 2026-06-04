## 발견사항

### [INFO] ExecutionTimeLimitError 메시지에 내부 수치 포함
- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` — `ExecutionTimeLimitError` constructor
- 상세: 에러 메시지에 `activeRunningMs`(누적 실행 ms)와 `limitMs`(한도 ms)가 포함된다. 이 메시지가 클라이언트에 직접 노출되는지 여부가 핵심이다. `execution-failure-classifier.ts` 주석(CCH-ERR-03)에 따르면 `error.message` 는 분류 결정에 사용하지 않으며 반환값에도 포함하지 않는다고 명시되어 있으므로, 채널 어댑터 경로에서는 메시지가 사용자에게 전달되지 않는다. 단, 이 에러가 다른 경로(REST 등)로 표면화될 때 메시지 원문이 노출될 가능성은 별도로 확인이 필요하다. `activeRunningMs` 자체는 PII는 아니지만 내부 실행 구조를 드러낸다.
- 제안: 이 에러가 외부 응답에 message 문자열로 누출되지 않음을 run 실패 빌더에서 검증하거나, 메시지를 "Execution active-running time limit exceeded." 같은 고정 문자열로 단순화하고 수치는 서버 로그에만 기록하는 방식 고려.

### [INFO] `segmentStartMs` in-memory Map — 단일 인스턴스 전제
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `private readonly segmentStartMs = new Map<string, number>()`
- 상세: 세그먼트 시작 시각이 in-memory Map 에 보관된다. 코드 주석에 "세그먼트는 한 인스턴스 안에서 처리되므로 in-memory Map 으로 충분(누적값은 row 에 영속)"이라고 명시되어 있고 설계 근거가 타당하다. 그러나 다중 인스턴스 배포 환경에서 인스턴스 재시작(크래시, 롤링 배포 등) 발생 시 segmentStart 가 소실되어 해당 세그먼트의 active 시간이 누적되지 않는 undercount 가 발생한다. 이는 타임아웃 미집행(bypass)이 아닌 undercount 이므로 보안 취약점이라기보다 기능적 한계이며, plan 에 PR3/PR4 로 후속 처리가 계획되어 있다. 보안 측면에서 타임아웃 한도 우회 경로가 되는지는 악의적 사용자가 직접 크래시를 유발할 수 없는 환경이라면 낮은 위험이다.
- 제안: 현재 설계 의도대로 진행하되, PR3에서 crash-recovery 시 segmentStart 복원 또는 crash-at-segment-start 케이스의 active 시간 보정 방식을 명시적으로 결정할 것.

### [INFO] `resolveMaxActiveRunningMs` — 정규식 이중 검증 중복
- 위치: `codebase/backend/src/modules/execution-engine/execution-limits.ts` — `resolveMaxActiveRunningMs` 함수
- 상세: `/^\d+$/.test(raw.trim())` 로 비음수 정수를 사전 검증한 뒤 `Number.isInteger(parsed) && parsed >= 0` 를 다시 확인한다. 정규식 통과 후 `Number()` 변환이 실패하거나 정수 아닌 값이 될 수는 없으므로 이중 검증이지만, 방어적 코딩으로 허용 가능하다. 보안상 의미 있는 취약점은 아니다.
- 제안: 이중 검증은 무해하므로 그대로 유지 가능. 단, 공학표기(`1e6`)가 정규식에 의해 올바르게 거부되는지 테스트에서 이미 확인하고 있어 양호.

### [INFO] `execution-failure-classifier.ts` — unknown code 경고 로그에 `triggerId` 포함
- 위치: `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` — fallback warn log (라인 320~327)
- 상세: unknown 코드 fallback 시 `triggerId` 가 구조화 로그에 기록된다. `triggerId` 는 내부 식별자이므로 서버 로그 수준의 노출은 운영상 필요하며 위험하지 않다. 다만 이 로그가 외부 모니터링 시스템(예: Sentry, ELK)으로 집계될 때 `triggerId` 가 포함되는 점을 인식해야 한다. CCH-ERR-03에 따라 반환값에는 포함되지 않으므로 클라이언트 노출 위험은 없다.
- 제안: 현재 구현은 규약(CCH-ERR-03·04)을 준수하고 있어 조치 불필요.

### [INFO] SQL 마이그레이션 — 인젝션 위험 없음
- 위치: `codebase/backend/migrations/V073__execution_active_running_ms.sql`
- 상세: DDL 전용 마이그레이션(`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`)으로 사용자 입력을 받지 않으며 파라미터화가 필요한 동적 쿼리가 없다. SQL 인젝션 위험 없음.
- 제안: 없음.

### [INFO] `.env.example` — placeholder 및 주석 정보 노출 수준
- 위치: `codebase/backend/.env.example` — 신규 `EXECUTION_MAX_ACTIVE_RUNNING_MS` 항목
- 상세: 예제 파일에 실제 시크릿이 없고, 신규 변수는 비밀 값이 아닌 숫자 타임아웃 설정이다. 기존 컨벤션("Non-secret 변수는 실사용 dev 기본값 표기")을 준수하고 있다. 하드코딩된 시크릿 없음.
- 제안: 없음.

---

## 요약

이번 변경(PR2a — active-running 누적 타임아웃)은 보안 관점에서 전반적으로 양호하다. 주요 보안 패턴(에러 코드 sentinel 타입으로 임의 `.code` 누수 방지, 사용자 대면 분류 시 `error.message`/`nodeId`/`executionId` 미포함, 입력 검증 정규식 + 폴백, DDL 전용 마이그레이션)이 모두 바르게 구현되어 있다. 유일한 주의 사항은 `ExecutionTimeLimitError` 메시지에 내부 수치(`activeRunningMs`, `limitMs`)가 포함되어 있어, 이 에러가 채널 어댑터 외 경로(REST 응답 등)로 message 원문이 노출되지 않도록 run 실패 빌더 경로를 별도 검증할 것을 권장한다. `segmentStartMs` in-memory Map 의 크래시 시 undercount 는 기능적 한계이며 PR3에서 계획된 사항이다. SQL 인젝션·XSS·커맨드 인젝션·하드코딩 시크릿·인증 우회·안전하지 않은 암호화 알고리즘에 해당하는 취약점은 발견되지 않았다.

---

## 위험도

LOW

STATUS: OK
