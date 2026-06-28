# Code Review 통합 보고서

리뷰 대상: D-12 — 공개 webhook IP 미식별 fail-open 강화
(`UNIDENTIFIED_IP_BUCKET` sentinel 도입, `if (!ip) return true` 제거)

---

## 전체 위험도

**LOW** — Critical 발견사항 없음. 전체 발견사항이 INFO 수준이며, WARNING 으로 집계할 항목은 plan 체크리스트 미갱신(추적 문서 불일치) 및 테스트 커버리지 보강 제언 2건으로 즉각적인 기능 결함은 없다.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Plan 추적 정확성 | Phase B 체크리스트 `I-1`(sentinel 상수 export + unit 테스트), `I-2`(guard null-IP → 공유 버킷 라우팅 + guard.spec)가 `[ ]` 미완료로 커밋됨. 실제 구현은 완료된 상태라 plan 과 구현 불일치 | `plan/in-progress/webhook-public-ip-failopen-hardening.md` Phase B I-1, I-2 | `I-1`, `I-2` 를 `[x]` 로 갱신 |
| 2 | 테스트 커버리지 | sentinel 경로(`UNIDENTIFIED_IP_BUCKET`)에 대한 `hourly_new` 초과 케이스(`PUBLIC_WEBHOOK_HOURLY_LIMIT`)가 service.spec 및 guard.spec 양쪽 모두 미검증 | `public-webhook-quota.service.spec.ts`, `public-webhook-throttle.guard.spec.ts` | sentinel hourly 케이스 추가 |

---

## 참고 (INFO) — 발췌

| # | 카테고리 | 발견사항 | 처리 |
|---|----------|----------|------|
| 7 | 부작용 — `??` vs falsy | `??` 는 null/undefined 만 포착, 빈 문자열 미포착(이전 `if (!ip)` 는 빈 문자열도 처리) | **반영** — `|| UNIDENTIFIED_IP_BUCKET` 으로 교체(방어적, 이전 semantics 일치) |
| 8 | 테스트 — IPv6 비충돌 | sentinel 이 IPv6 패턴과 비충돌인지 미검증 | **반영** — 단언 1줄 추가 |
| 9 | 테스트 — W14 trigger 첨부 | sentinel 경로에서 `req.__publicWebhookTrigger` 첨부 미검증 | **반영** — noIp 테스트에 단언 추가 |
| 1 | 보안 — 운영 위험 | 공유 버킷 포화 시 정상 미식별 클라이언트도 429 가능(의도된 트레이드오프, 결정 3) | 모니터링 followup — plan 이월 |
| 4·5 | 아키텍처 — sentinel guard 누출·param 명 | `consumeStart(ip)` 시그니처에 sentinel 수용 | 동일 모듈 결합·JSDoc 명시로 충분, 즉각 리팩터링 불필요(reviewer 동의) — 미변경 |
| 6 | 설정 유연성 | 공유 버킷 한도 튜닝 불가 | 결정 3(동일 한도)은 의도. config 배율은 followup 이월 |
| 2·3·13 | Redis 인젝션·TTL·hot-key | 이중 보호로 인젝션 불가, TTL/hot-key 는 현 한도서 위험 낮음 | 현 범위 밖 — 미변경 |
| 10·11·12 | 주석/JSDoc 중복 | 보안 정책 주석은 가치 있어 유지 | 미변경 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 |
|----------|--------|
| security | LOW (공유 버킷 포화 운영 위험 — 의도된 트레이드오프) |
| performance | NONE |
| architecture | LOW (sentinel guard 누출 INFO) |
| requirement | NONE (D-12 완전 구현, spec 정합) |
| scope | NONE |
| side_effect | LOW (`??` vs falsy INFO → 반영) |
| maintainability | NONE |
| testing | LOW (sentinel hourly 미커버 → 반영) |
| documentation | LOW (plan 체크박스 → 반영) |
| concurrency | NONE |

라우터: 10명 실행(security/performance/architecture/requirement/scope/side_effect/maintainability/testing/documentation/concurrency), 4명 제외(dependency/database/api_contract/user_guide_sync).

---

## 처리 결과 (RESOLUTION.md 참조)

WARNING 2건 + INFO 7·8·9 반영. 나머지 INFO 는 followup 이월 또는 의도된 설계로 미변경.
e2e 는 docker.io flyway:10-alpine manifest fetch DeadlineExceeded(레지스트리 인프라)로 보류 — 사용자 결정 필요.
