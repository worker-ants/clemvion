# Security Review — exec-intake-queue PR1

## 발견사항

### **[INFO]** .env.example 에 실제 개발용 자격증명이 평문 노출
- 위치: `codebase/backend/.env.example` 라인 88–89, 154–155, 184
- 상세: `DB_PASSWORD=workflow_dev`, `S3_ACCESS_KEY=minioadmin`, `S3_SECRET_KEY=minioadmin`, `ENCRYPTION_KEY=0123456789abcdef...` 가 파일에 평문 기재되어 있음. 이 파일은 git에 체크인되며 공개 저장소라면 자격증명 노출이 된다. `ENCRYPTION_KEY`가 특히 민감한데, 64자 hex 예시값이 실제처럼 보여 복사-붙여넣기 위험이 있음.
- 제안: `.env.example`의 convention은 파일 헤더에 이미 명시(`Secrets show "change-me-*" placeholders`)되어 있으나, `S3_ACCESS_KEY=minioadmin`, `S3_SECRET_KEY=minioadmin`은 placeholder 패턴을 따르지 않고 실제 MinIO 기본값을 직접 노출. `S3_ACCESS_KEY=change-me-minio-access-key` 형태로 변경 권장. `ENCRYPTION_KEY`도 `0123456789...` 예시값 대신 `change-me-64-hex-chars` 형태 권장. 단, 이번 PR1 변경(EXECUTION_RUN_WORKER_CONCURRENCY 추가)은 시크릿이 아닌 숫자 concurrency 값이므로 신규 도입 이슈는 없음.

---

### **[INFO]** job payload에 사용자 입력(input)을 그대로 직렬화하여 Redis에 적재
- 위치: `execution-engine.service.ts` 변경 `execute()` 내부 — `{ executionId, input }` 큐 발행
- 상세: `input: unknown` 이 BullMQ job payload로 직접 Redis에 저장됨. input이 매우 큰 경우(예: 사용자가 대용량 데이터 주입) Redis 메모리 압박 가능. 현재 코드에 input 크기 상한 검증 없음. 단, 이 경로에 도달하는 진입점(webhook, schedule, manual)에서 body 크기 제한이 상위 레이어(미들웨어/공개 웹훅의 `PUBLIC_WEBHOOK_MAX_BODY_BYTES`)에 의해 이미 걸려 있을 것이므로 직접적 취약점은 아니나, 내부 경로(executeAsync/executeSync를 통한 Sub-Workflow 호출 등)에서도 동일 검증이 적용되는지 확인 필요.
- 제안: `runExecutionFromQueue` 또는 `execute()`에서 input 직렬화 크기 상한을 방어적으로 체크하거나, 상위 레이어 보호가 모든 진입점을 커버하는지 문서화할 것.

---

### **[INFO]** DEAD-LETTER 로그에 executionId 노출(운영 로그 민감도)
- 위치: `execution-run.processor.ts` `onFailed()` — `execution=${job.data?.executionId}` 로그
- 상세: executionId를 warn 로그에 직접 출력함. executionId 자체는 내부 식별자이며 비밀 정보는 아니나, 로그 집계 시스템이 외부에 노출될 경우 실행 목록이 열거될 수 있음. err 객체도 `err?.message`만 로그하는 것은 적절하나, 에러 스택이 필요할 경우 debug 레벨로 분리하는 것이 바람직함.
- 제안: 현 수준은 일반적으로 허용 범위. 로그 집계를 외부 노출하지 않는 운영 정책 확인 권장.

---

### **[INFO]** `maxStalledCount: 0` + `attempts: 1` — crash 시 실행 silently drop 위험
- 위치: `execution-run.queue.ts` `EXECUTION_RUN_MAX_STALLED_COUNT = 0`, `EXECUTION_RUN_QUEUE_DEFAULT_OPTS.attempts = 1`
- 상세: worker crash 시 job이 stalled-redelivery 없이 dead-letter로 이동(또는 영구 drop)됨. 코드 주석과 spec(PR1 범위 의도)에 명시된 설계 결정이므로 보안 취약점은 아니나, 가용성(availability) 관점에서 실행이 silent drop 되어 사용자가 인지하지 못할 수 있음. `onFailed` 핸들러가 warn 로그를 남기나, Execution row의 상태가 PENDING으로 영구 고착될 수 있음.
- 제안: PR1 범위 내에서는 허용된 trade-off. 단, `recoverStuckExecutions`가 RUNNING 상태만 수거하므로 worker crash 직후 PENDING 상태가 stalled recovery 대상이 아닌지 확인 필요(PR3/4에서 해소 예정이지만 현 상태에서의 gap).

---

### **[INFO]** `execution-run` 큐 내 `input` 필드 타입이 `unknown` — 역직렬화 신뢰 경계
- 위치: `execution-run.queue.ts` `ExecutionRunJob.input?: unknown`, `execution-run.processor.ts` process() 내 `job.data` 역직렬화
- 상세: Redis에서 역직렬화된 `input`이 `unknown` 타입으로 그대로 `runExecutionFromQueue`에 전달됨. BullMQ는 JSON.parse 기반으로 역직렬화하므로 prototype pollution이나 JSON.parse 기반 gadget chain의 직접적 위험은 없으나, 상류에서 특수 객체나 class instance가 직렬화된 경우 예상치 못한 타입으로 역직렬화될 수 있음.
- 제안: 현 아키텍처에서 input은 pure JSON-serializable 값임이 관례적으로 보장되나, 명시적 zod 스키마 검증 또는 타입 가드를 worker 진입점에 추가하면 방어 심도가 높아짐.

---

## 요약

이번 PR1 변경(execution-run intake 큐 도입)은 보안 관점에서 신규 critical/high 취약점을 도입하지 않는다. fire-and-forget in-process 호출을 BullMQ 영속 큐로 전환하는 아키텍처 변경이며, executionId 기반 jobId dedup, status 재검증(PENDING 확인), routing context의 worker-side 재등록, stalled count 0 + attempts 1을 통한 비멱등 이중 실행 방지 등 보안 민감 설계가 의도적이고 적절하게 처리되어 있다. 지적 사항은 모두 기존 .env.example의 자격증명 예시 형식 불일치(INFO), Redis에 적재되는 input 크기 검증의 상위 레이어 의존성(INFO), 로그 민감도(INFO), 그리고 PR1 범위에서 의도적으로 보류된 crash-recovery gap(INFO) 수준이다. 하드코딩된 시크릿·인젝션·인증 우회·암호화 결함은 발견되지 않았다.

## 위험도

LOW
