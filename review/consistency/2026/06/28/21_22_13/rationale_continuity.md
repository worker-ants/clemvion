# Rationale 연속성 검토 결과

검토 대상: `spec/5-system/` (구현 완료 후 검토 — `--impl-done`, diff-base=origin/main)
연관 spec: `spec/7-channel-web-chat/4-security.md`, `spec/5-system/12-webhook.md`, `spec/5-system/1-auth.md`
검토일: 2026-06-28

---

## 발견사항

### [INFO] Rationale 2.3.B m-3 보강 — 기각 결정 유지, 공백 채움
- **target 위치**: `spec/5-system/1-auth.md` Rationale 2.3.B m-3 마지막 추가 문장 ("같은 이유로 공개 webhook rate-limit 의 IP 미식별(헤더 부재) 케이스도 `req.socket.remoteAddress` 폴백을 쓰지 않는다 … 대신 미식별 요청을 단일 공유 버킷 완화 한도로 처리한다(무제한 통과 아님, D-12; SoT 4-security R6)")
- **과거 결정 출처**: `spec/5-system/1-auth.md` Rationale 2.3.B m-3 기존 본문 — "`req.ip`(Express `trust proxy 1`) 를 우선/대체로 쓰자는 안은 **기각**한다 … 공개 webhook rate-limit 의 IP 미식별(헤더 부재) 케이스도 `req.socket.remoteAddress` 폴백을 쓰지 않는다 … 정상 사용자 false 429"
- **상세**: 기존 Rationale 은 `req.ip`/`req.socket.remoteAddress` 폴백을 명시 기각했으나 "그 대신 어떻게 처리하는지"를 기술하지 않아 사실상 무제한 통과(`return true`)가 암묵적 디폴트였다. 신규 추가 문장은 해당 공백을 "단일 공유 버킷 완화 한도"로 채운다. 이는 기각된 대안의 재도입이 아니며, 기존 기각 이유(trust-proxy 뒤 socket 피어 주소가 프록시 주소라 전 트래픽이 단일 버킷으로 붕괴되는 함정)와 신규 결정의 논리가 일관한다. 구현(`public-webhook-throttle.guard.ts`)도 동일 원칙을 따라 `extractClientIpFromHeaders` 기반 헤더 추출 후 null/빈 문자열이면 `UNIDENTIFIED_IP_BUCKET` sentinel 로 폴백한다.
- **제안**: 없음. 번복이 아니므로 별도 조치 불필요.

---

### [INFO] R6 신규 추가 — R3 의 "인프라 fail-open" 원칙과 차원 분리를 명문화, 합의 원칙 유지
- **target 위치**: `spec/7-channel-web-chat/4-security.md` Rationale R6 전체 ("공개 webhook IP 미식별 — 단일 공유 버킷 완화 한도") 및 §4 본문 blockquote 신규 문단
- **과거 결정 출처**: `spec/7-channel-web-chat/4-security.md` Rationale R3 ("Redis 미가용 시 fail-open — 방어 인프라 장애가 정당한 webhook 까지 깨는 것을 막기 위함") 및 `spec/5-system/12-webhook.md` §6 ("Redis 미가용 시 fail-open")
- **상세**: R3 는 Redis/DB **인프라 장애** 시 fail-open 을 명시한다. R6 는 IP 미식별이라는 별개 차원(공격자의 헤더 제거)을 다루며, R3 와의 차원 분리를 "본 항의 fail-open 은 인프라 장애(Redis/DB) 차원이며, 클라이언트 IP 미식별 시의 처리는 별도 차원으로 R6 가 다룬다(무제한 통과 아님)"로 명시했다. fail-closed 기각 이유("비-인증 best-effort 레이어가 가용성을 희생하는 것은 본 rate-limit 의 성격 및 §4 graceful degradation 원칙과 충돌")도 R3 의 기존 논리와 동일 원칙을 계승한다. R6 는 R3 를 번복하는 것이 아니라 R3 가 다루지 않던 IP 미식별 차원을 신규 Rationale 로 명시적으로 보완한 것이다.
- **제안**: 없음. 신규 R6 에 충분한 Rationale(채택 이유, 기각된 대안 3건, 인증 webhook 의 fail-closed 와의 대비)이 동반됐다.

---

### [INFO] WH-SC-05·Rate Limiting 표 갱신 — 기존 정책 범위 내 명시화
- **target 위치**: `spec/5-system/12-webhook.md` WH-SC-05 불릿, §6 Rate Limiting 불릿, §8 보안 고려사항 Rate Limiting 행
- **과거 결정 출처**: 기존 WH-SC-05 는 IP 미식별 케이스를 명시하지 않았고, 인증 webhook `ip_whitelist`(WH-SC-09)의 IP 미식별 시 동작(fail-closed)도 대비가 없었다.
- **상세**: WH-SC-05 에 추가된 "IP 미식별 시 공유 버킷 완화 한도" 및 "인증 webhook ip_whitelist 는 IP 미식별 시 거부(fail-closed)" 대비는 기존 spec 이 암묵적으로 인정한 동작을 명시화한 것이다. 특히 `ip_whitelist` fail-closed 는 새로 추가된 행동이 아니라 인증 게이트로서의 기존 의미(헤더로 확인 불가 → 허용 미확인 → 거부)를 문서화한 것이다. 기존 rate-limit(best-effort) 대 인증 게이트(ip_whitelist)의 성격 차이로 미식별 시 결과가 다른 것은 의도된 비대칭이며, 과거 Rationale 이 이 분류를 내포하고 있었다.
- **제안**: 없음.

---

### [INFO] 구현 코드 내 Rationale 2.3.B m-3 기각 결정 준수 확인
- **target 위치**: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` 라인 112-115, `codebase/backend/src/modules/hooks/public-webhook-quota.service.ts` `UNIDENTIFIED_IP_BUCKET` 상수
- **과거 결정 출처**: `spec/5-system/1-auth.md` Rationale 2.3.B m-3 — "`req.ip`/`req.socket.remoteAddress` 폴백 기각" 및 "헤더 기반 추출(`extractClientIpFromHeaders`)을 유지"
- **상세**: 구현은 `extractClientIpFromHeaders` 를 호출한 뒤 null/빈 문자열이면 `UNIDENTIFIED_IP_BUCKET` sentinel 을 사용한다. `req.ip` 또는 `req.socket.remoteAddress` 를 어느 경로에서도 사용하지 않아 기각된 대안이 구현에 재도입되지 않았다. 코드 주석도 Rationale 2.3.B 참조와 기각 사유(trust-proxy 뒤 단일 프록시 버킷 붕괴)를 명시한다.
- **제안**: 없음.

---

## 요약

`spec/5-system/` 내 변경(주로 `1-auth.md` Rationale 2.3.B m-3 보강)은 기존 Rationale 에서 명시적으로 기각된 대안(`req.ip`/`req.socket.remoteAddress` 폴백)을 재도입하거나 합의된 invariant 를 우회하지 않는다. 신규 R6(`4-security.md`)는 기존 R3 의 "인프라 장애 fail-open" 원칙과 차원이 다름을 명문화하면서 공유 버킷 완화 한도를 도입해 무제한 우회를 유한 상한으로 좁혔으며, 이는 R3 를 번복하는 것이 아니라 R3 가 다루지 않던 IP 미식별 차원을 R6 로 보완한 것이다. 구현 코드도 기각된 폴백(`req.ip`/`req.socket.remoteAddress`)을 사용하지 않고 헤더 기반 추출과 sentinel 버킷 패턴을 유지해 Rationale 2.3.B m-3 와 정합한다. 결정 번복·기각 대안 재도입·invariant 우회 패턴이 없으며 모든 신규 결정에 Rationale(채택 이유, 기각된 대안 명시)이 동반됐다.

---

## 위험도

NONE
