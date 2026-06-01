# Security Review — continuation-worker-concurrency-env

## 발견사항

### 발견사항 없음 (NONE)

이번 변경에서 보안 관점의 취약점이 발견되지 않았습니다. 각 점검 항목별 검토 결과는 아래와 같습니다.

---

**[INFO] 환경변수 파서 입력 검증 — 정규식 선검증 적용**
- 위치: `codebase/backend/src/modules/execution-engine/queues/continuation-execution.queue.ts` `resolveContinuationWorkerConcurrency()`
- 상세: `CONTINUATION_WORKER_CONCURRENCY` 환경변수 파싱 시 `/^\d+$/` 정규식으로 순수 양의 정수만 허용하고, 공학표기(`1e10`), 소수, 음수, 빈 문자열은 모두 기본값 fallback 처리한다. 이는 기존 DLQ monitor config의 파서 규약과 일치하는 안전한 패턴이다.
- 평가: 양호. 별도 수정 불필요.

**[INFO] 하드코딩된 시크릿 — `.env.example` 플레이스홀더 규약 준수**
- 위치: `codebase/backend/.env.example` (신규 추가 행: `CONTINUATION_WORKER_CONCURRENCY=1`)
- 상세: 새로 추가된 변수는 시크릿이 아닌 성능 조정 파라미터(정수 concurrency 값)이며, 기본값 `1`을 그대로 노출해도 보안 문제가 없다. 파일 내 다른 시크릿(`JWT_SECRET`, `ENCRYPTION_KEY`, `INTEGRATION_ENCRYPTION_KEY`, `S3_SECRET_KEY` 등)은 모두 `change-me-*` 플레이스홀더 또는 로컬 개발용 더미 값 규약을 유지하고 있다. 단, 기존 `ENCRYPTION_KEY=0123456789abcdef...` (64자 헥스 고정값)은 이번 변경 범위 외이나, `.env.example`에 개발용 더미 키가 고정값으로 기재되어 있어 운영 환경에 복사 시 위험할 수 있다 — 그러나 이는 기존 파일의 pre-existing 사항이며 이번 변경과 무관하다.
- 평가: 이번 변경 자체는 양호.

**[INFO] 인증/인가 — 변경 없음**
- 위치: 전체 변경 파일
- 상세: 이번 변경은 BullMQ worker의 동시성 파라미터를 환경변수로 설정화하는 내부 인프라 변경이다. 인증/인가 로직, 세션 관리, 엔드포인트 접근 제어에 대한 수정이 없다.

**[INFO] 에러 처리 — 민감 정보 미노출**
- 위치: `continuation-execution.processor.ts` `onFailed()` 핸들러
- 상세: 실패 로그에 `type`, `executionId`, `jobId`, `attemptsMade/maxAttempts`, `err.message`만 포함한다. payload 내용, 사용자 데이터, credential 등 민감 정보는 로그에 포함되지 않는다.
- 평가: 양호.

**[INFO] 동시성 상향 시 잠재적 race window — 설계 수준 고려사항**
- 위치: `continuation-execution.processor.ts` — `@Processor` concurrency 설정
- 상세: `CONTINUATION_WORKER_CONCURRENCY > 1`로 상향 시 동일 executionId에 대한 여러 job이 동시에 처리될 수 있다. 코드에서 `NodeExecution.status === 'waiting_for_input'` 재검증(멱등성 가드)을 수행하고 있으나, 두 job이 동시에 `stillWaiting` 체크를 통과한 뒤 `applyContinuation`을 동시 호출할 경우 DB 레이어의 상태 전이 원자성에 의존한다. 이는 보안 취약점이 아니라 설계상 알려진 trade-off이며, 스펙 §7.4의 "멀티 인스턴스 double-drive" 항목으로 이미 문서화되어 있다. 기본값이 1(직렬)이므로 기본 배포에서는 해당 없음.
- 평가: 보안 위험 없음. 설계 레벨 참고사항.

---

## 요약

이번 변경은 BullMQ continuation worker의 동시성을 `CONTINUATION_WORKER_CONCURRENCY` 환경변수로 설정화하는 범위가 제한된 인프라 변경이다. 새로운 코드 경로(`resolveContinuationWorkerConcurrency`)는 정규식 선검증을 통해 안전한 입력 파싱을 수행하며, 하드코딩된 시크릿·인젝션 취약점·인증 우회·민감 정보 노출 등 OWASP Top 10에 해당하는 취약점이 전혀 존재하지 않는다. `.env.example`에 추가된 변수는 시크릿이 아닌 성능 파라미터이며 플레이스홀더 규약을 준수한다. 보안 관점에서 배포에 장애가 없는 변경이다.

## 위험도

NONE
