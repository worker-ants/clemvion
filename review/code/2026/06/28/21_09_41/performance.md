# Performance Review

## 발견사항

### 발견사항 없음 (핵심 변경)

이번 변경의 핵심은 `public-webhook-throttle.guard.ts` 에서 `if (!ip) return true` 한 줄을
`const ip = extractClientIpFromHeaders(...) ?? UNIDENTIFIED_IP_BUCKET;` 로 대체한 것이며,
`public-webhook-quota.service.ts` 에는 상수 하나(`UNIDENTIFIED_IP_BUCKET`)와 JSDoc 만 추가됐다.

---

- **[INFO]** `incrWithWindow` 의 분·시간 두 번 순차 INCR — 이미 존재하는 구조, 이번 변경과 무관
  - 위치: `/codebase/backend/src/modules/hooks/public-webhook-quota.service.ts` lines 79-92
  - 상세: `consumeStart` 는 분 카운터 INCR 후 시간 카운터 INCR 을 순차 실행한다. UNIDENTIFIED_IP_BUCKET 이
    하나의 공유 키(`wh:rl:min:__no_client_ip__`, `wh:rl:hour:__no_client_ip__`)를 가리키므로
    미식별 요청 폭증 시 이 두 키에 대한 Redis 명령 수가 선형으로 증가한다. 그러나 이는 기존 per-IP
    로직과 동일한 구조이며, sentinel 추가로 추가 복잡도가 생기지 않는다. fixed-window 특성상
    O(1) Redis 연산(INCR/EXPIRE) 이다.
  - 제안: 현재 구현 범위에서 변경 불필요. 분 한도(`startupPerMinute=10`)가 선행 차단하므로 시간
    카운터 INCR 까지 도달하는 횟수는 제한된다.

- **[INFO]** 공유 버킷의 단일 Redis 키 경합 — 설계상 수용된 트레이드오프
  - 위치: `/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` lines 110-113
  - 상세: 모든 미식별 요청이 `wh:rl:min:__no_client_ip__` 단일 키에 집중된다. Redis INCR 은
    단일 키 원자 연산으로 이미 직렬화되어 있어 경합(hot-key) 이 발생할 수 있다. 단, 이는
    설계 문서(plan D-12 결정 3)에서 "단일 공유 버킷이 곧 보수적(미식별 트래픽 총량이 한 IP 분량으로
    상한)" 으로 명시된 의도된 트레이드오프다. 미식별 요청이 분당 10건을 초과하면 429 로 차단되어
    자연히 경합이 억제된다.
  - 제안: 현재 한도(분당 10/시간당 20)가 낮아 실제 hot-key 병목 위험은 미미하다. 미식별 트래픽이
    예상보다 크게 증가할 경우 Redis Cluster 샤딩 또는 로컬 메모리 1차 카운터 도입을 고려할 수 있으나,
    현재 규모에서는 조치 불필요.

- **[INFO]** `pipeline.exec()` 후 `expire` 를 별도 await 로 분리 실행 — 기존 구조, 이번 변경과 무관
  - 위치: `/codebase/backend/src/modules/hooks/public-webhook-quota.service.ts` lines 131-135
  - 상세: `count === 1` 일 때 `this.redis!.expire(key, windowSec)` 를 별도 await 한다. 이는
    키 생성 첫 증가에만 실행되므로 대부분의 요청(count > 1)에서는 추가 RTT 가 없다. UNIDENTIFIED_IP_BUCKET
    도 동일 경로를 따른다.
  - 제안: 변경 없음. 주석(W7)에 이미 "비원자 EXPIRE 분리 안전성 확보" 로 의도가 설명되어 있다.

---

## 요약

이번 변경(`D-12`)은 `if (!ip) return true` 조기 반환 제거와 `UNIDENTIFIED_IP_BUCKET` 상수 추가로
구성된 단순한 로직 수정이다. 알고리즘 복잡도·메모리 할당·블로킹 I/O·데이터 구조 측면에서 이전 대비
추가 비용이 없으며, 신규 N+1 쿼리·캐싱 누락·불필요한 연산도 발생하지 않는다. 공유 버킷의 단일 Redis
hot-key 가능성은 설계 문서에서 수용된 트레이드오프이고, 현재 한도 수준(분당 10)에서 실질 위험은 낮다.
테스트 파일 변경은 런타임 성능에 영향 없다.

## 위험도

NONE
