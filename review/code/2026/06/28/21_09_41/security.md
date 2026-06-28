# 보안(Security) 코드 리뷰

리뷰 대상: D-12 — 공개 webhook IP 미식별 fail-open 강화
대상 파일: `public-webhook-quota.service.ts`, `public-webhook-throttle.guard.ts` 및 관련 테스트/plan/consistency 산출물

---

## 발견사항

### **[INFO]** 단일 공유 버킷의 DoS 상한 — per-IP 한도와 동일하여 집중 공격 시 정상 사용자 429 가능
- 위치: `public-webhook-quota.service.ts` line 164; `public-webhook-throttle.guard.ts` line 110-113
- 상세: `UNIDENTIFIED_IP_BUCKET`(`__no_client_ip__`)은 IP 를 제거한 모든 요청이 공유하는 단일 Redis 키다. IP 헤더를 제거하는 공격자 다수가 동시에 요청하면 분당 10건 한도에 정상적인 헤더-없는 클라이언트(레거시 HTTP/1.0, 특정 프록시 등)의 요청이 함께 계상된다. 공격자 10명이 각 1건씩 보내면 정상 미식별 클라이언트가 완전히 차단된다. 이는 의도된 설계(plan 결정 3: "무제한 → 유한 상한" 완화, fail-closed 기각)이며 spec §4 R6 에 명시되었으나, 실제 공유 버킷 포화 시 DoS 효과가 발생할 수 있음을 운영 차원에서 인지할 필요가 있다. rate-limit 은 인증 게이트가 아니므로 OWASP DoS(A05) 완전 차단이 목표가 아닌 설계다.
- 제안: 모니터링/알람 레벨에서 `wh:rl:min:__no_client_ip__` 키의 카운터 스파이크를 탐지해 공유 버킷 포화 시 인프라(WAF/Ingress) 차단으로 에스컬레이션하는 절차를 운영 가이드(spec 인프라 권고, 결정 1)에 명시하면 충분하다. 코드 수준 변경은 불필요.

---

### **[INFO]** Redis 키 인젝션 가능성 검토 — sentinel 설계로 차단됨
- 위치: `public-webhook-quota.service.ts` line 148-150; `public-webhook-throttle.guard.ts` line 110-113
- 상세: `makeMinKey(ip)` / `makeHourKey(ip)` 는 IP 문자열을 Redis 키에 직접 인터폴레이션한다(`wh:rl:min:${ip}`). 공격자가 IP 헤더를 제어할 수 있다면 `\r\n` 또는 Redis inline command 포함 문자열로 키를 오염시킬 수 있다. 그러나 두 가지 이유로 실질적 위험이 없다.
  1. `extractClientIpFromHeaders` 가 신뢰 헤더(XFF 첫 IP 또는 CF-Connecting-IP)에서 IP 를 파싱하며, 이 함수가 유효 IP 형식을 검증한다고 가정된다(upstream 에서 검토된 사항).
  2. null 반환 시 `UNIDENTIFIED_IP_BUCKET`(`__no_client_ip__`)으로 치환되어 공격자 제어 문자열이 키에 삽입되지 않는다.
- 제안: `extractClientIpFromHeaders` 의 IP 파싱 검증 수준(정규식 여부)을 별도로 확인하여 spec 에 "헤더 기반 IP 파싱은 유효 IP 형식만 허용" 을 명시하면 방어층이 명확해진다. 현 변경 범위에서는 문제 없음.

---

### **[INFO]** INCR 후 EXPIRE 분리로 인한 TTL 미설정 위험 — 코드 설계로 완화됨
- 위치: `public-webhook-quota.service.ts` line 115-137 (`incrWithWindow`)
- 상세: `count === 1` 일 때만 `EXPIRE` 를 별도 커맨드로 호출한다. 이 사이에 Redis 장애가 발생하면 TTL 없는 키가 영구 잔류한다. 그러나 이 경우에도 다음 요청이 INCR 해서 count > 1 이 되므로 EXPIRE 를 다시 걸지 않아 키가 누적된다. 이는 보안보다 운영(메모리 누수) 문제에 가깝고, 장애 후 Redis 재시작 시 키가 소멸되며, 한도 초과 차단의 보안 효과는 보존된다.
- 제안: 운영 관점에서 Redis 키 TTL 이 없는 상황을 탐지하는 모니터링을 추가하거나, Lua 스크립트 또는 `SET ... EX` + INCR 시뮬레이션 등으로 원자적 처리를 강화할 수 있으나 현 변경의 보안 범위(D-12)를 벗어난다. 현재 구현은 이미 pipeline INCR 을 사용하므로 count=1 EXPIRE 패턴은 실무상 표준이다.

---

### **[INFO]** 에러 메시지 노출 — CWE-209 패턴 적합 확인
- 위치: `public-webhook-throttle.guard.ts` line 116-130
- 상세: 429 응답의 메시지(`'Too many conversation starts from this client. Try again later.'`)는 내부 IP, Redis 키, 스택 트레이스 등 민감 정보를 포함하지 않는다. `reason` 값(`startup_rate` / `hourly_new`)은 클라이언트에게 노출되지 않고 에러코드(`PUBLIC_WEBHOOK_RATE_LIMIT` / `PUBLIC_WEBHOOK_HOURLY_LIMIT`)로만 반환된다. CWE-209 준수.
- 제안: 없음. 현 구현 적합.

---

### **[INFO]** 공개 webhook 진입 전 글로벌 throttler 우선성 — 방어 레이어 이해
- 위치: Guard 설계 전반
- 상세: 코드 주석 및 spec 에 따르면 글로벌 throttler(100 req/min, IP 무관)가 1차 방어이고, `PublicWebhookThrottleGuard` 의 IP/공유 버킷 rate-limit 은 2차 best-effort 방어다. 이 변경은 2차 방어의 IP 미식별 우회 구멍을 막는다. 공격자가 IP 헤더를 제거하더라도 글로벌 throttler 100 req/min 한도는 여전히 적용되므로 D-12 이전에도 완전 무제한은 아니었다. D-12 는 이를 IP 수준 한도(10/min)로 보강한다.
- 제안: 없음. 설계 이해 확인 메모.

---

## 요약

이번 변경(`D-12`)은 보안 관점에서 순수한 강화다. 기존에 `if (!ip) return true` 로 rate-limit 을 무제한 우회할 수 있던 취약점을 단일 공유 버킷(`UNIDENTIFIED_IP_BUCKET = '__no_client_ip__'`)으로 대체해 미식별 트래픽에도 동일한 fixed-window 한도를 적용한다. 하드코딩된 시크릿은 없으며, `__no_client_ip__` sentinel 은 공격자 제어 값이 아닌 내부 상수다. SQL/커맨드/경로 인젝션 표면은 없다. Redis 키 인터폴레이션은 `extractClientIpFromHeaders`(헤더 파싱 검증) + null 폴백(sentinel 치환) 이중 보호로 공격자 제어 문자열이 Redis 키에 삽입되지 않는다. 에러 응답은 내부 정보를 노출하지 않는다. 인증/인가 경계(인증 webhook vs 공개 webhook 분기)는 변경되지 않았다. 발견된 모든 사항은 INFO 등급으로, 주요 주의점은 공유 버킷 포화 시 정상 미식별 클라이언트가 429 를 받을 수 있다는 운영 리스크이며, 이는 spec 결정 3(완화 한도, fail-closed 기각)의 의도된 트레이드오프다.

---

## 위험도

LOW
