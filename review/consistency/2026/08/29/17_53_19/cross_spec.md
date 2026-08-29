# Cross-Spec 일관성 검토 — `spec/data-flow/` (--impl-done)

## 검토 범위 및 방법 메모

diff-base `origin/main` 대비 코드 변경은 **단일 파일**뿐이다:
`codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
(`git diff origin/main...HEAD --stat` 로 확인 — 나머지 변경분은 전부 `review/**` 산출물이고
spec 문서 변경은 0건).

diff 내용을 실측한 결과, 이 변경은 **순수 리팩터링**이다 — `intercept()` 의 `switchMap` 콜백
본문(캐시 조회 결과를 신규 처리/discard/409/재현으로 분기하는 로직)을 동일 로직 그대로
`private resolveCacheHit(cachedJson, { redisKey, bodyHash, context, next })` 메서드로 추출했을
뿐, 조건·순서·상태코드·캐시 대상 목록 중 **어느 것도 바뀌지 않았다**. 새 JSDoc(7-갈래 표)은
추출 전 인라인 주석이 흩어져 있던 것을 한 표로 정리한 문서화다.

target(`spec/data-flow/`)이 이 동작을 어떻게 기술하는지, 그리고 인접 spec 영역과 상충하는지
아래 세 축으로 대조했다:

- `spec/data-flow/15-external-interaction.md` §1.2·§2.2·§Rationale "Fail-open 정책의 일관 표기"
  — prompt 번들에 전문 포함, 직접 대조.
- `spec/5-system/14-external-interaction-api.md` §1 EIA-IN-11·§2 EIA-RL-02·§R8 — prompt 에서는
  컨텍스트 예산 초과로 생략됐으므로 워크트리에서 **절대경로로 직접 Read** (`grep -n
  "EIA-IN-11|Idempotency|EIA-RL-02"` 로 대상 라인 확인).
- `spec/data-flow/9-observability.md`(NF-OB-07 `clemvion.redis.fail_open` 라벨 카탈로그)·
  `spec/data-flow/14-chat-channel.md`(§2.2 `cc:dedup:{triggerId}:{idempotencyKey}`) — prompt
  전문 포함, 직접 대조. 이전 라운드(`review/consistency/2026/08/29/17_23_43/cross_spec.md`,
  --impl-prep)에서 이미 대조된 인접 영역이라 재확인만 수행.

## 발견사항

교차 대조 결과 **CRITICAL/WARNING 없음**. 새 발견 없음 — 이 diff 는 스펙이 이미 기술한 동작을
1:1 로 유지한 채 코드 구조만 바꿨다.

diff 의 7-갈래 JSDoc 표를 spec 문장과 축별로 대조한 결과:

| diff JSDoc 분기 | spec 대응 서술 | 일치 여부 |
| --- | --- | --- |
| 1. 캐시 미스 → 신규 처리 | `15-external-interaction.md` §2.2 "캐시 miss" 암묵 전제 | 일치 |
| 2. 엔트리 문법 손상 → discard(warn) | §2.2 "엔트리가 **손상**(형태 불일치·... 파싱 실패)된 경우도 fail-open — 버리고 신규 처리(+warn), 500 아님" | 일치 |
| 3. 엔트리 형태 불일치 → discard(warn) | 상동 + §Rationale "형태 불일치... truthiness 로는 배열·필드 누락이 통과" | 일치 |
| 4. bodyHash 불일치 → 409 | EIA §R8 "같은 key + 다른 body → 409" / §2.2 "같은 키+다른 body → 409" | 일치 |
| 5. responseJson 손상 → discard(warn) | §2.2 "내부 `responseJson` 파싱 실패" 항목 | 일치 |
| 6. 캐시된 상태코드 409/410 → 예외 채널 재현 | EIA §R8 "캐시 대상은 닫힌 목록 — 2xx·409·410" + "`400` 중 `VALIDATION_ERROR` 제외" | 일치 |
| 7. 그 외(=2xx) → 성공 채널 재현 | 상동 | 일치 |

캐시 키 스코프(`interaction:idempotency:<executionId>:<route>:<key>`)·TTL(24h)·fail-open 정책
문구도 diff 가 손대지 않은 기존 코드 그대로이며 `spec/data-flow/15-external-interaction.md` §2.2,
`spec/5-system/14-external-interaction-api.md` §R8 "캐시 키 스코프" 와 문자 그대로 동일하다.

인접 영역과의 관계도 diff 로 인해 달라진 것이 없다:

- **Observability** (`9-observability.md` Rationale "`clemvion.redis.fail_open` 의 `component`
  를 실제 배선된 값만 열거하는 이유") — 이 리팩터링은 `this.metrics?.recordRedisFailOpen(...)`
  호출 지점·인자를 바꾸지 않았다(diff 컨텍스트 라인에 그대로 유지). 닫힌 라벨 유니온과의 정합에
  변화 없음.
- **Chat Channel** (`14-chat-channel.md` §2.2 `cc:dedup:{triggerId}:{idempotencyKey}`) — 이전
  라운드에서 이미 "동명이의(스키마·TTL 상이, 각자 SoT 분리 등재)" 로 INFO 처리된 항목이며, 이번
  diff 는 EIA 쪽 인터셉터 내부 구조만 바꿨을 뿐 그 필드·키 명명에 관여하지 않는다 — 재차 INFO 로
  격상할 근거 없음, 이번 diff scope 밖.

## 요약

이번 diff 는 `IdempotencyInterceptor` 의 캐시-히트 판정 로직을 동일 동작으로 `resolveCacheHit`
private 메서드로 추출한 순수 리팩터링이며, spec 문서(`spec/**`)는 한 글자도 변경되지 않았다.
diff 의 새 JSDoc 7-갈래 표를 `spec/data-flow/15-external-interaction.md` 및
`spec/5-system/14-external-interaction-api.md` §R8/EIA-IN-11/EIA-RL-02 와 축별로 대조한 결과
캐시 대상 목록·상태코드 매핑·키 스코프·fail-open 정책 전부 문자 그대로 일치했고, 동작이
바뀌지 않았으므로 observability/chat-channel 등 인접 영역과의 관계도 이전 라운드(--impl-prep,
LOW)에서 이미 확인된 상태 그대로 유지된다. Cross-Spec 관점에서 새로 도입된 충돌은 없다.

## 위험도

NONE
