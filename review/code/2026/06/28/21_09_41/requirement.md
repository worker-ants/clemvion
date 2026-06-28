# 요구사항(Requirement) 리뷰 결과

리뷰 대상: D-12 공개 webhook IP 미식별 fail-open 강화
변경 파일: public-webhook-quota.service.ts / .spec.ts, public-webhook-throttle.guard.ts / .spec.ts, plan 및 consistency review 문서

---

## 발견사항

### [INFO] 기능 완전성 — 핵심 변경 3건 모두 구현 완료

- 위치: `public-webhook-quota.service.ts` line 164, `public-webhook-throttle.guard.ts` line 110–113
- 상세: D-12 결정 사항 3건이 모두 구현됐다.
  1. `UNIDENTIFIED_IP_BUCKET = '__no_client_ip__'` sentinel 상수 export (I-1)
  2. Guard 의 `if (!ip) return true` 제거 → `?? UNIDENTIFIED_IP_BUCKET` 폴백 (I-2)
  3. `consumeStart(ip)` 는 변경 없이 sentinel 을 일반 IP 처럼 처리 (설계 의도 그대로)
- 제안: 없음.

### [INFO] 테스트 완전성 — 두 핵심 케이스 모두 커버

- 위치: `public-webhook-quota.service.spec.ts` line 45–64, `public-webhook-throttle.guard.spec.ts` line 172–202
- 상세:
  - `UNIDENTIFIED_IP_BUCKET` 값이 `'__no_client_ip__'` 이며 유효 IPv4 정규식과 불일치함을 unit 단위로 검증.
  - `makeMinKey`/`makeHourKey` 가 sentinel 을 일반 IP 처럼 변환함을 확인.
  - guard spec 에서 IP 미식별 시 `consumeStart(UNIDENTIFIED_IP_BUCKET)` 가 호출됨과 한도 초과 시 `429` 반환을 모두 테스트.
- 제안: 없음.

### [INFO] 엣지 케이스 — null/undefined IP 처리

- 위치: `public-webhook-throttle.guard.ts` line 110–113
- 상세: `extractClientIpFromHeaders(...)` 가 `null` 또는 `undefined` 를 반환할 때 `?? UNIDENTIFIED_IP_BUCKET` nullish coalescing 으로 처리한다. `extractClientIpFromHeaders` 가 빈 문자열(`''`)을 반환하는 경우는 nullish coalescing 으로 포착되지 않으나(빈 문자열은 falsy 이지만 `??` 는 null/undefined 만 포착), `extractClientIpFromHeaders` 구현이 null 또는 undefined 만 반환한다면 문제없다. 기존 구현이 빈 문자열을 반환하지 않는다고 가정해도 되나 방어적으로 `|| UNIDENTIFIED_IP_BUCKET` 을 쓰는 방법도 있다. 기존 코드베이스에서 `extractClientIpFromHeaders` 의 반환값이 null/undefined 로 일관된다면 현행 `??` 로 충분하다.
- 제안: INFO 수준. `extractClientIpFromHeaders` 반환값이 이미 null/undefined 로 정규화돼 있으면 현행 코드로 충분하다.

### [INFO] TODO/FIXME 없음

- 위치: 변경된 파일 전체
- 상세: TODO, FIXME, HACK, XXX 주석이 존재하지 않는다. 미완성 작업 신호 없음.

### [INFO] 의도와 구현 간 일치

- 위치: `public-webhook-quota.service.ts` JSDoc (`@param ip`) 및 `UNIDENTIFIED_IP_BUCKET` JSDoc
- 상세: 함수명·JSDoc 과 실제 구현이 일치한다. `consumeStart` 는 sentinel 을 받아 일반 IP 처럼 동작하며 별도 분기 없이 공유 버킷 키(`wh:rl:min:__no_client_ip__`)를 생성한다. 문서와 동작이 정합적이다.

### [INFO] 에러 시나리오 — Redis 미가용 시 fail-open 동작 변화 없음

- 위치: `public-webhook-quota.service.ts` line 77, 94–98
- 상세: sentinel 경로도 Redis 미가용(`!this.redis`) 시 `{ allowed: true, reason: null }` fail-open 경로를 그대로 따른다. D-12 변경 이후에도 Redis 장애 시 sentinel 버킷이 차단하지 않는다. 이는 기존 정책(Redis/DB 장애 시 fail-open)과 일관된다. 의도된 동작이다.

### [INFO] [SPEC-DRIFT] plan Phase B 체크리스트 — I-1/I-2 미완료 표시 상태로 커밋

- 위치: `plan/in-progress/webhook-public-ip-failopen-hardening.md` Phase B I-1, I-2
- 상세: 변경된 plan 파일의 Phase B 체크리스트에서 `I-1`(quota service sentinel 상수 export + unit 테스트)와 `I-2`(guard null-IP → 공유 버킷 라우팅 + guard.spec 테스트) 가 `[ ]` (미완료) 상태로 커밋됐다. 실제 구현 코드는 모두 존재하므로 체크리스트 항목만 업데이트되지 않은 것이다. 코드가 틀린 것이 아니라 plan 체크리스트 추적 상태가 구현 완료를 반영하지 않은 채 제출됐다.
- 제안: `I-1`, `I-2` 를 `[x]` 로 업데이트해야 plan 라이프사이클 추적이 정확해진다. 코드 자체는 정상.

### [INFO] spec fidelity — 4-security.md §4·R6 와 구현 일치

- 위치: `spec/7-channel-web-chat/4-security.md` line 128, 234–258; `spec/5-system/12-webhook.md` line 69, 330, 383
- 상세: spec 이 이미 Phase A 를 통해 갱신됐으며 구현 내용과 line-level 로 일치한다.
  - spec §4 line 128: "클라이언트 IP 식별 가능 시 per-IP 버킷, 헤더 부재로 미식별 시 단일 공유 버킷에 묶어 동일 fixed-window 한도" → 구현 `?? UNIDENTIFIED_IP_BUCKET` + `consumeStart` 동일 한도 적용과 일치.
  - spec R6: `UNIDENTIFIED_IP_BUCKET` sentinel 이름, 값(`__no_client_ip__`), 동작(per-IP 와 동일 고정 윈도우 한도) 기술 → 구현과 일치.
  - `12-webhook.md §6` line 330: sentinel 버킷 동작, 에러코드 `PUBLIC_WEBHOOK_RATE_LIMIT`/`PUBLIC_WEBHOOK_HOURLY_LIMIT` → guard 구현 line 121–123 과 일치.
  - `WH-SC-05` (line 69): "IP 미식별 시 단일 공유 버킷으로 묶여 동일 한도 적용" → 구현과 일치.
- 제안: 없음. spec 과 구현이 정합한다.

---

## 요약

D-12 목표인 "공개 webhook IP 미식별 시 무제한 fail-open → 단일 공유 버킷 완화 한도" 전환이 완전히 구현됐다. `UNIDENTIFIED_IP_BUCKET` sentinel 상수 export, guard 의 nullish coalescing 폴백, `consumeStart` 무변경 재사용이 모두 설계 의도대로 구현됐으며, spec(`4-security.md §4·R6`, `12-webhook.md §6·WH-SC-05`)과 line-level 로 일치한다. 핵심 기능 경로(sentinel 호출 + 429 반환)가 테스트로 커버된다. Critical 또는 Warning 수준의 요구사항 미충족 발견사항은 없다. 유일한 사소한 갭은 plan Phase B 의 `I-1`/`I-2` 체크리스트 항목이 구현 완료 후에도 `[ ]` 로 남아 있는 점이나, 이는 코드 결함이 아닌 추적 문서 미갱신이다.

---

## 위험도

NONE
