# 데이터베이스(Database) 리뷰 결과

## 발견사항

### Redis 관련 (NoSQL/캐시 스토어)

- **[INFO]** INCR + EXPIRE 분리 실행 — race condition 허용 설계
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-rate-limit-baa15a/codebase/backend/src/modules/chat-channel/chat-channel-rate-limiter.service.ts` L267-276
  - 상세: pipeline 으로 `INCR` 을 실행한 뒤 `count === 1` 일 때만 별도 `await this.redis.expire(key, ...)` 를 호출한다. INCR 과 EXPIRE 가 단일 pipeline 에 묶이지 않아, 극히 드문 경우 두 연산 사이에 프로세스가 죽으면 TTL 없는 영구 키가 생길 수 있다. 다만 (a) 코드 주석에서 이미 `PublicWebhookQuotaService` 동형 패턴이라고 명시하고, (b) 실용적으로 Redis 재시작 시 키 소멸, (c) fail-open 정책이므로 최악 시나리오가 "영구적으로 rate-limit 이 적용된다"가 아닌 "해당 키가 만료되지 않아 첫 60건 이후에도 계속 차단" — 이는 운영 상황에서 문제가 될 수 있으나 CRITICAL 에 해당하지 않는다.
  - 제안: `pipeline.incr(key); pipeline.expire(key, CHAT_RATE_LIMIT_WINDOW_SEC);` 를 동일 pipeline 에 넣고, exec 결과에서 `count` 가 1인지 확인한 뒤 이미 pipeline 에 포함된 EXPIRE 가 무시되도록 조건부로 처리하는 대신, 항상 EXPIRE 를 pipeline 에 포함하는 방식으로 원자성을 강화할 수 있다. 단, 기존 `PublicWebhookQuotaService` 와의 패턴 정합을 깨지 않으려면 팀 합의 후 결정 권장.

- **[INFO]** `markChatChannelRateLimited` — 트리거 DB 업데이트는 best-effort
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` L704-727
  - 상세: `this.triggerRepository.update(...)` 실패 시 warn 로그만 남기고 swallow 한다. `chat_channel_health=degraded` 갱신이 실패해도 호출자는 `{ executionId: 'ignored' }` 를 반환한다. 이는 설계 문서(R-CC-19)의 "best-effort" 정책과 일치하므로 의도된 동작이다. 트랜잭션 불필요(단일 column 업데이트이며 정합성 요건 없음).
  - 제안: 해당 없음 (의도된 best-effort 설계).

- **[INFO]** `trigger.chatChannelHealth === 'degraded'` 중복 write 방지 — 메모리 값 기준
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` L709
  - 상세: `trigger` 객체는 `findOne` 으로 조회된 스냅샷이므로, 동일 시간대에 다른 인스턴스가 이미 `degraded` 로 갱신했더라도 이 인스턴스의 메모리 상태는 여전히 이전 값일 수 있다. 따라서 폭주 중 멀티 인스턴스 환경에서 중복 DB 업데이트가 발생할 수 있다. 그러나 `UPDATE WHERE id = ?` 의 비용이 미미하고, 같은 값을 재기록하는 것이므로 데이터 정합성 문제는 없다.
  - 제안: 현재 수준으로 충분. 필요 시 `UPDATE ... WHERE chatChannelHealth != 'degraded'` 조건 추가로 중복 write 을 DB 레벨에서 차단 가능.

### 관계형 DB (PostgreSQL / TypeORM)

- **[INFO]** `onApplicationBootstrap` 쿼리 — 인덱스 의존
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.module.ts` L506-512
  - 상세: 기존 코드(변경 없음)이며, `WHERE t.is_active = true AND t.config ->> 'chatChannel' IS NOT NULL` 조건을 사용한다. `is_active` 컬럼 인덱스 존재 여부에 따라 전체 스캔 가능. 단, 이 쿼리는 애플리케이션 부트스트랩 시 1회만 실행되므로 운영 중 성능 영향은 없다.
  - 제안: 본 변경 범위 외이나 `triggers` 테이블에 `is_active` 인덱스가 없다면 추가 권장.

## 요약

이번 변경의 핵심 데이터 저장소 연산은 관계형 DB 가 아닌 Redis 기반 rate-limit 카운터(`INCR + EXPIRE`)와 `Trigger` 테이블의 `chatChannelHealth` 필드 단일 컬럼 업데이트다. Redis 쪽에서는 INCR 과 EXPIRE 가 동일 pipeline 에 묶이지 않아 이론적으로 TTL 미설정 키가 발생할 수 있으나, 기존 `PublicWebhookQuotaService` 동형 패턴이며 fail-open 정책으로 실질 위험이 낮다. 관계형 DB 쪽에서는 단순 `UPDATE` 단건 연산이고 트랜잭션·마이그레이션·스키마 변경이 없어 무중단 배포 위험 없음. N+1, SQL 인젝션, 커넥션 풀 오용 등 주요 DB 위험 항목은 해당 없다. 전체 변경은 DB 관점에서 안전하다.

## 위험도

LOW
