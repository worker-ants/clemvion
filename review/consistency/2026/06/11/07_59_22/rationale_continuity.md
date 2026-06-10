# Rationale 연속성 검토 결과

검토 범위: `spec/4-nodes/4-integration/` (0-common, 1-http-request, 2-database-query, 3-send-email, 4-cafe24, 5-makeshop)
diff-base: origin/main
검토 기준: 기각된 대안 재도입 / 합의 원칙 위반 / 무근거 결정 번복 / 암묵적 invariant 우회

---

## 발견사항

### [INFO] Redis pub/sub 채택 — 기각된 continuation 채널과 도메인 구분 명시 필요
- **target 위치**: `spec/4-nodes/4-integration/2-database-query.md` §4 실행 로직 step 2 (멀티 인스턴스 무효화) + `## Rationale` 풀 캐시 멀티 인스턴스 무효화 항
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md` §Rationale "Durable Continuation" — "Redis pub/sub 유지 + Map 키 없으면 대기 후 재시도 — at-most-once 한계를 우회만 할 뿐 근본 해결이 아님"으로 기각. §9.1 표 — `execution:continuation` 채널은 BullMQ 큐로 대체되어 명시적 폐기.
- **상세**: execution-engine spec 이 Redis pub/sub 를 `execution:continuation` 용도로 기각한 것은 at-most-once 의미론이 **내구성(durable continuation)** 이 필요한 사용처에 부적합했기 때문이다. 신규 `integration:cache:invalidate` 채널은 정반대 성격 — "연결 풀 즉시 무효화"는 **best-effort(fail-safe)** 가 명시 설계이고, 유실 시 credsHash 비교 evict 로 안전 degrade 가 보장된다. 두 사용처는 at-most-once 허용 여부가 다르므로 **원칙 충돌이 아니라 적용 도메인이 다른 것**이다. 다만 target 의 Rationale 에 "execution-continuation 채널 기각과 어떻게 다른가" 를 한 줄도 언급하지 않아, 추후 검토자가 "기각된 패턴 재도입 아닌가" 를 의심할 가능성이 있다.
- **제안**: `spec/4-nodes/4-integration/2-database-query.md ## Rationale` 의 해당 항에 다음 취지의 한 문장 추가 — "execution-engine 의 `execution:continuation` 채널이 기각된 것은 내구성(at-least-once)이 필요한 재개 신호 용도이며, 본 채널은 fail-safe best-effort invalidation 으로 목적·허용 의미론이 다르다." 이는 기존 결정을 번복하지 않으며, 도메인 구분을 명문화해 향후 혼동을 예방한다.

### [INFO] cafe24 spec — `isRefreshCapable` 제거가 문맥 손실
- **target 위치**: `spec/4-nodes/4-integration/4-cafe24.md` §11.2 의 근거 문단 (diff 변경 라인)
- **과거 결정 출처**: `spec/4-nodes/4-integration/4-cafe24.md` 내 옛 `isRefreshCapable` 분기 설명은 `connected-expiry` scanner 의 cafe24 면제 로직을 설명하는 용도로 쓰였다.
- **상세**: 변경된 문장("§11.1 `connected-expiry` scanner 의 cafe24 분기 (refresh enqueue)") 은 이전 문장("§11.1 `connected-expiry` scanner 의 `isRefreshCapable` 분기 (cafe24 는 refresh enqueue + refresh_token 보유 행 격하 제외)") 에서 `isRefreshCapable` 키워드와 "refresh_token 보유 행 격하 제외" 설명이 삭제됐다. 코드 리팩토링으로 해당 필드가 제거됐기 때문이므로 문서 동기화는 적절하다. 그러나 이전 문장이 명시하던 "refresh_token 보유 행은 격하 제외" invariant 가 새 문장에서 완전히 사라져, 해당 scanner 의 분기 로직이 spec 어디에도 남지 않을 가능성이 있다.
- **제안**: `spec/2-navigation/4-integration.md` 또는 cafe24 spec §11.1 의 scanner 설명에서 "refresh_token 보유 행은 expired 격하 제외" 원칙이 여전히 기술되어 있는지 확인한다. 만약 그 원칙이 사라졌다면 현행 scanner 동작의 SoT 를 spec 어딘가에 복원해야 한다.

---

## 요약

`spec/4-nodes/4-integration/2-database-query.md` 에 추가된 Redis pub/sub 기반 멀티 인스턴스 풀 무효화 설계는 Rationale 까지 갖춰 작성됐으며, 기각된 대안(옵션 B — POOL_IDLE_TIMEOUT_MS 하향)도 명시적으로 기록했다. `spec/5-system/4-execution-engine.md` 가 Redis pub/sub `execution:continuation` 채널을 기각한 것은 at-most-once 의미론이 내구성 필요 사용처에 부적합했기 때문이고, 신규 `integration:cache:invalidate` 채널은 fail-safe best-effort invalidation 으로 의미론이 다르므로 CRITICAL 또는 WARNING 수준의 충돌은 없다. 다만 Rationale 에 그 도메인 구분을 명시하지 않아 독자의 오해 소지가 있다는 INFO 를 제기한다. cafe24 spec 의 단순 문구 정비는 내용 역전이 없는 코드-동기화 수준으로 판단된다.

---

## 위험도

LOW
