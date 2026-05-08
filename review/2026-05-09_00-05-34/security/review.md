## Security Code Review

### 발견사항

---

**[HIGH] Redis 연결에 인증/TLS 미적용**
- 위치: `continuation-bus.service.ts` - `onModuleInit()`
- 상세: `new Redis({ host, port })` 생성 시 `password`, `tls`, `username` 등 인증 옵션이 없다. Redis가 네트워크 수준에서만 격리된 경우, 동일 네트워크에 접근 가능한 공격자가 `execution:continuation` 채널에 임의 메시지를 publish해 진행 중인 어떤 execution이든 강제 취소(cancel)하거나, 임의 form data로 재개(continue)하거나, 임의 AI 메시지를 주입할 수 있다.
- 제안:
  ```typescript
  this.publisher = new Redis({
    host, port,
    password: this.configService.get<string>('redis.password'),
    tls: this.configService.get<boolean>('redis.tls') ? {} : undefined,
  });
  ```

---

**[WARNING] Redis 수신 메시지의 executionId 미검증**
- 위치: `continuation-bus.service.ts:109-117` - `dispatch()`
- 상세: `msg.executionId`가 truthy인지만 확인하고 UUID 포맷 검증이 없다. Redis 채널이 신뢰할 수 없는 메시지를 받을 경우(비정상 publisher) 비정상 executionId가 Map 키로 사용된다. 현재는 Map miss → silent skip이라 직접 피해는 없으나, 향후 executionId가 DB 쿼리에 직접 쓰이는 경로가 추가되면 위험하다.
- 제안:
  ```typescript
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(msg.executionId)) {
    this.logger.warn(`Invalid executionId format: ${msg.executionId.slice(0, 50)}`);
    return;
  }
  ```

---

**[WARNING] `continueExecution`의 formData 크기 제한 없음**
- 위치: `execution-engine.service.ts` - `continueExecution()`
- 상세: `continueAiConversation`은 `MAX_MESSAGE_LENGTH`(10,000자)로 입력을 제한하지만, `continueExecution`의 `formData?: unknown`에는 크기 제한이 없다. 악의적인 클라이언트가 수 MB의 payload를 전송하면 Redis pub/sub을 통해 모든 인스턴스로 fan-out되어 메모리 압박을 유발할 수 있다.
- 제안: controller 레이어에서 요청 body size 제한을 명시하거나, 서비스 레이어에서도 serialized size 상한을 적용한다.

---

**[WARNING] AI 메시지 길이 검증 우회 가능 (Redis 직접 publish)**
- 위치: `execution-engine.service.ts:1711-1724` + `continuation-bus.service.ts`
- 상세: `continueAiConversation()`에서 10,000자 제한을 검증한 뒤 `bus.publish()`하지만, Redis에 직접 publish할 수 있는 환경에서는 이 게이트를 우회할 수 있다. `registerContinuationHandlers`의 `ai_message` 핸들러는 `msg.payload.message` 길이를 재검증하지 않는다.
- 제안: `ai_message` 핸들러 내부에서도 길이 재검증을 추가한다:
  ```typescript
  this.continuationBus.on('ai_message', (msg) => {
    const message = (msg.payload as { message?: string } | undefined)?.message;
    if (typeof message === 'string' && message.length > MAX_MSG_LEN) return;
    ...
  });
  ```

---

**[WARNING] `acquireLock` 키 파라미터 무제한 수용**
- 위치: `continuation-bus.service.ts` - `acquireLock(key, ttlSeconds)`
- 상세: `key`가 검증 없이 Redis SET 명령의 키로 직접 전달된다. 현재는 하드코딩된 `'exec:recover:lock'`만 사용하지만, 이 public 메서드가 외부 모듈에서 user-controlled 값으로 호출될 경우 Redis 키 네임스페이스 오염이 발생할 수 있다. 특히 `ttlSeconds`가 0 또는 음수로 전달되면 즉시 만료되어 lock 의미가 무력화된다.
- 제안: 키 접두사 강제 + ttl 범위 검증:
  ```typescript
  if (!key.startsWith('exec:') || ttlSeconds <= 0 || ttlSeconds > 3600) {
    throw new Error('Invalid lock parameters');
  }
  ```

---

**[INFO] 로그 인젝션 가능성**
- 위치: `continuation-bus.service.ts:112` - `dispatch()`
- 상세: `raw.slice(0, 200)`를 경고 로그에 그대로 포함한다. Redis 메시지에 개행문자(`\n`), ANSI 이스케이프 코드, 로그 집계 시스템의 구분자가 포함될 경우 로그 위조나 SIEM 파싱 오류를 유발할 수 있다.
- 제안: `JSON.stringify(raw.slice(0, 200))` 또는 제어문자 strip 후 로깅.

---

**[INFO] 복구 Lock 값으로 process.pid 사용**
- 위치: `continuation-bus.service.ts` - `acquireLock()`
- 상세: `String(process.pid)`를 lock 값으로 저장한다. PID는 프로세스 재시작 시 재사용될 수 있어 "이 lock이 현재 살아있는 프로세스 소유인가"를 판별하기 어렵다. 현재 설계(60초 TTL, 자동 만료)에서는 실질적 문제가 없으나, 향후 lock 소유자 검증이 필요해지면 UUID v4 사용을 권장한다.

---

**[INFO] V035 마이그레이션 단일 트랜잭션 장시간 lock 위험**
- 위치: `V035__execution_node_log.sql`
- 상세: `executeInTransaction=true`로 `INSERT INTO execution_node_log ... SELECT FROM execution` + `ALTER TABLE execution DROP COLUMN`이 단일 트랜잭션으로 묶인다. 운영 DB의 `execution` 테이블에 대용량 데이터가 있는 경우, 트랜잭션 전체 기간 동안 테이블 lock이 유지되어 다른 쿼리가 블로킹된다. 파일 자체에도 이미 "V035a / V035b 분리 검토" 주석이 있으므로 확인 완료.

---

### 요약

전반적인 아키텍처(append-only log, BIGSERIAL로 순서 보장, Redis pub/sub fan-out + local Map resolve)는 보안 설계상 합리적이며, TypeORM 파라미터화 쿼리 사용, 메시지 포맷 검증, 에러 흡수 구조 등 기본적인 방어 코드가 잘 갖춰져 있다. 다만 Redis 연결에 인증·TLS가 명시적으로 없다는 점이 가장 큰 취약점으로, Redis가 네트워크 격리만으로 보호되는 경우 채널 메시지를 신뢰하는 현재 설계는 Redis 접근 제어가 유일한 방어선이 된다. `formData` 크기 미검증과 AI 메시지 길이의 서비스 레이어 우회 가능성도 함께 보완이 필요하다.

### 위험도

**MEDIUM** — Redis 인증 적용 여부와 네트워크 격리 수준에 따라 HIGH까지 상승 가능.