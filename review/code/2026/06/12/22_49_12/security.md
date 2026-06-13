# 보안(Security) 코드 리뷰

**대상**: CCH-NF-03 per-chat rate-limit 구현 (chat-channel-rate-limiter.service.ts, hooks.service.ts 등)

---

## 발견사항

### **[WARNING]** Redis 키에 외부 입력값이 새니타이징 없이 직접 삽입됨 (키 인젝션 위험)
- **위치**: `codebase/backend/src/modules/chat-channel/chat-channel-rate-limiter.service.ts` — `makeChatRateLimitKey` 함수
  ```
  export const makeChatRateLimitKey = (triggerId, conversationKey) =>
    `cc:rl:${triggerId}:${conversationKey}`;
  ```
- **상세**: `conversationKey` 는 외부 채널(Telegram, Slack, Discord 등)에서 파싱한 값이다. 콜론(`:`) 을 포함하거나 비정상적으로 긴 값이 들어올 경우 키 구조가 왜곡된다. Redis 키 자체에 대한 커맨드 인젝션은 불가능하나, 의도치 않은 키 공유(key collision)가 발생할 수 있다. 예를 들어 `conversationKey = "x:cc:rl:other-trigger"` 이면 전혀 다른 대화의 카운터를 덮어쓰거나 참조할 수 있다.
- **제안**: `triggerId` 와 `conversationKey` 에서 콜론(`:`) 을 제거하거나 인코딩(예: `encodeURIComponent`, `replace(/:/g, '_')`)한 뒤 키를 조합한다. 또한 키 총 길이 상한(예: 256바이트)을 강제해 Redis 메모리 남용을 방지한다.

---

### **[WARNING]** `chatChannelLastError` 필드에 외부 입력값(conversationKey)이 포함돼 DB에 저장됨
- **위치**: `codebase/backend/src/modules/hooks/hooks.service.ts` — `markChatChannelRateLimited` 메서드
  ```
  chatChannelLastError:
    `Inbound rate limit exceeded (${limitPerMinute}/min, chat=${conversationKey})`.slice(0, 1024),
  ```
- **상세**: `conversationKey` 는 외부 채널 플랫폼에서 수신한 값이다. `.slice(0, 1024)` 로 길이 제한은 하고 있으나, DB 저장 전 새니타이징이 없다. 이 필드를 관리자 UI가 렌더링할 경우 저장형 XSS(Stored XSS)가 발생할 수 있다. 특히 관리자 화면에서 별도 이스케이핑 없이 HTML에 직접 출력되는 경우 위험하다.
- **제안**: `conversationKey` 를 에러 메시지에 포함시킬 때 제어 문자(null byte, HTML 특수문자 등)를 strip하거나, 관리자 UI에서 이 필드를 출력 시 반드시 HTML 이스케이핑을 적용한다. 또는 외부 입력값 대신 `[external-id-redacted]` 처럼 고정 플레이스홀더를 사용한다.

---

### **[INFO]** fail-open 정책이 Redis 비가용 시 rate-limit을 완전히 무력화함 — 설계적 허용이나 남용 가능성 인지 필요
- **위치**: `chat-channel-rate-limiter.service.ts` — `consume` 메서드
- **상세**: Redis가 다운되거나 에러가 발생하면 `true`(허용)를 반환하는 fail-open 정책이 의도적으로 채택됐다. 이는 가용성 우선 결정으로 스펙(R-CC-19)에 명시된 설계 결정이다. 그러나 Redis 에러를 외부 공격자가 의도적으로 유발할 수 있는 경우(예: Redis 연결 고갈 공격), rate-limit 이 완전히 우회된다. 이는 분산 서비스 거부 공격(DDoS) 에 대한 보호가 제거되는 상황이다.
- **제안**: 현재 설계를 유지하되, Redis 에러가 연속으로 발생할 경우(예: 5초 내 N회 이상) 운영자에게 알람을 발송하는 circuit-breaker 또는 헬스체크 메커니즘을 추가하는 것을 고려한다. 현재 `logger.warn` 으로 로깅은 되고 있어 기본적인 가시성은 확보됐다.

---

### **[INFO]** Redis fixed-window의 경계 버스트(boundary burst) 허용 — 설계적 허용
- **위치**: `chat-channel-rate-limiter.service.ts` — 전체 로직
- **상세**: fixed-window 방식은 윈도우 경계에서 최대 2배 버스트를 허용한다. 예: 59초에 60건, 60초 이후 다시 60건 = 1초 안에 120건. 스펙(spec-draft-cch-nf-03-rate-limit.md Rationale)에서 "분 버킷 경계 burst 허용은 rate-limit 표준 trade-off"로 명시적으로 허용했다.
- **제안**: 현재 설계로 허용 가능하나, 향후 공격 패턴이 이 경계 burst를 악용하는 경우 sliding-window 방식(예: Redis sorted set 기반)으로 전환을 고려한다.

---

### **[INFO]** 하드코딩된 시크릿 없음 확인
- **위치**: 전체 변경 파일
- **상세**: API 키, 비밀번호, 토큰, 인증서 등 하드코딩된 시크릿이 없다. 상수(`CHAT_RATE_LIMIT_WINDOW_SEC = 60`, `CHAT_RATE_LIMIT_DEFAULT_PER_MIN = 60`)는 설정 값으로 적절하다.

---

### **[INFO]** 에러 메시지에 내부 스택 트레이스 미노출 확인
- **위치**: `chat-channel-rate-limiter.service.ts` 및 `hooks.service.ts`
- **상세**: catch 블록에서 `err.message` 만 로깅하고 스택 트레이스나 내부 구조를 외부에 노출하지 않는다. 에러는 `logger.warn`으로만 기록되고 호출자에게는 `true`(fail-open) 또는 비즈니스 결과만 반환된다.

---

### **[INFO]** 의존성 보안 — ioredis 사용
- **위치**: `chat-channel-rate-limiter.service.ts` — `import type Redis from 'ioredis'`
- **상세**: `ioredis` 는 잘 관리되는 라이브러리이나 `package-lock.json` 이 변경된 점(git status에 `M codebase/backend/package-lock.json`)을 고려해 `npm audit` 결과를 확인하는 것을 권장한다. `type` import 이므로 런타임 의존성은 이미 존재하던 것으로 추정된다.

---

## 요약

이번 변경(CCH-NF-03 per-chat rate-limit 구현)은 전반적으로 보안 설계가 양호하다. 하드코딩된 시크릿 없음, 에러 정보 최소 노출, 인증 우회 없음, 표준 NestJS DI 패턴 사용이 확인된다. 주요 보안 우려 사항은 두 가지다: (1) Redis 키에 외부 `conversationKey`를 새니타이징 없이 삽입해 키 콜리전이 가능한 점, (2) `chatChannelLastError` DB 필드에 외부 입력값이 포함되어 저장형 XSS 가능성이 있는 점. 두 항목 모두 즉각적인 CRITICAL은 아니나 운영 중 실제 공격 시나리오로 이어질 수 있어 WARNING으로 분류한다. fail-open 정책과 fixed-window 경계 버스트는 의도된 설계 trade-off로 INFO 수준에서 기록한다.

---

## 위험도

**LOW**

STATUS: SUCCESS
