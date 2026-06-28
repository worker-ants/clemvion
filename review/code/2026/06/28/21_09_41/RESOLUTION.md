# RESOLUTION — D-12 공개 webhook IP 미식별 fail-open 강화

리뷰 세션: `review/code/2026/06/28/21_09_41` (RISK: LOW, Critical 0, Warning 2)

## 조치 항목

| SUMMARY # | 분류 | 발견 | 조치 | 위치 |
|---|---|---|---|---|
| WARNING 1 | plan 추적 | Phase B I-1/I-2 체크박스 미갱신 | `[x]` 로 갱신 + e2e/ai-review 결과 기록 | `plan/in-progress/webhook-public-ip-failopen-hardening.md` |
| WARNING 2 | 테스트 커버리지 | sentinel 경로 `hourly_new` 미검증 | quota.service.spec·guard.spec 양쪽에 sentinel hourly 케이스 추가 | `public-webhook-quota.service.spec.ts`, `public-webhook-throttle.guard.spec.ts` |
| INFO 7 | `??` vs falsy | `??` 가 빈 문자열 미포착(이전 `if(!ip)` 와 불일치) | `\|\| UNIDENTIFIED_IP_BUCKET` 으로 교체(방어적, 이전 semantics 보존) | `public-webhook-throttle.guard.ts` |
| INFO 8 | 테스트 | sentinel IPv6 비충돌 미검증 | `/^[0-9a-f:]+$/i` 비매칭 단언 추가 | `public-webhook-quota.service.spec.ts` |
| INFO 9 | 테스트 | sentinel 경로 W14 trigger 첨부 미검증 | noIp 테스트에 `__publicWebhookTrigger` 단언 추가 | `public-webhook-throttle.guard.spec.ts` |

> 위 fix 는 본 세션의 REVIEW WORKFLOW 단일 커밋(`refactor(hooks): ai-review D-12 반영`)에 포함된다.

### 미변경 (의도 / 범위 밖)
- INFO 4·5 (sentinel guard import 결합·`consumeStart(ip)` param 명): 동일 모듈 내 결합 + JSDoc 명시로 충분, reviewer 도 즉각 리팩터링 불필요 동의 → 미변경.
- INFO 1·6 (공유 버킷 포화 모니터링·한도 config 배율): plan §Followup 이월. 결정 3은 "동일 한도"가 기본.
- INFO 2·3·13 (Redis 인젝션·TTL·hot-key): 이중 보호로 인젝션 불가, 현 한도서 위험 낮음 → 미변경.
- INFO 10·11·12 (주석/JSDoc 중복): 보안 정책 주석은 4-loc 동기화 부담보다 가치가 커 유지.

## TEST 결과

- **lint**: 통과 (`_test_logs/lint-20260628-211851.log`)
- **unit**: 통과 — 48 suites (`_test_logs/unit-20260628-211932.log`). sentinel 신규 케이스 포함 green.
- **build**: 통과 (`_test_logs/build-20260628-212021.log`)
- **e2e**: 보류 — docker.io `flyway/flyway:10-alpine` manifest fetch `DeadlineExceeded`(레지스트리 인프라; 빌드 4회+직접 pull+classic-builder 우회 모두 동일, 이미지 layer 로컬 캐시·registry root 도달·node 이미지 로드됨 → flyway namespace 특정 차단, 코드 무관). 사용자 결정: **"로컬 e2e 재시도 대기"** — 레지스트리 회복 후 로컬 e2e 통과 시 push. 회복까지 push 보류.

## 보류·후속 항목
- **e2e**: 레지스트리 회복 후 로컬 재시도 → 통과 시 push + PR (사용자 응답 "로컬 e2e 재시도 대기").
- INFO 1 (미식별 버킷 모니터링), INFO 6 (한도 config 배율): `plan §Followup 이월` 기재.
