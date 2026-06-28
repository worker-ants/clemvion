# Rationale 연속성 검토 결과

검토 대상: `spec/5-system/` (구현 착수 전 검토 — `--impl-prep`)
연관 spec: `spec/7-channel-web-chat/4-security.md`, `spec/5-system/12-webhook.md`, `spec/5-system/1-auth.md`
검토일: 2026-06-28

---

## 발견사항

### [INFO] Rationale 2.3.B m-3 보강 — 기존 기각 결정의 연장선, 번복 없음
- **target 위치**: `spec/5-system/1-auth.md` Rationale 2.3.B m-3 마지막 문장 ("대신 미식별 요청을 단일 공유 버킷 완화 한도로 처리한다(무제한 통과 아님, D-12; SoT 4-security R6)")
- **과거 결정 출처**: `spec/5-system/1-auth.md` Rationale 2.3.B m-3 기존 본문 — "`req.ip`(Express `trust proxy 1`) 를 우선/대체로 쓰자는 안은 기각한다 … 같은 이유로 공개 webhook rate-limit 의 IP 미식별(헤더 부재) 케이스도 `req.socket.remoteAddress` 폴백을 쓰지 않는다"
- **상세**: 기존 Rationale 은 `req.ip`/`req.socket.remoteAddress` 폴백을 명시 기각하면서도 "대신 어떻게 처리할지"를 기술하지 않았다 — 이로 인해 미식별 시 무제한 통과(`return true`)가 사실상 디폴트였다. 신규 추가 문장은 그 공백을 "단일 공유 버킷 완화 한도"로 채운다. 이는 기각된 대안의 재도입이 아니라 기존 기각 결정을 보존한 채 공백을 채운 보강이다. 기존 기각 이유와 신규 결정의 논리가 일관한다.
- **제안**: 없음. 번복이 아니므로 별도 조치 불필요.

---

### [INFO] R6 신규 추가 — R3 의 "fail-open" 원칙과 차원이 다름을 명문화함
- **target 위치**: `spec/7-channel-web-chat/4-security.md` Rationale R6 전체 ("공개 webhook IP 미식별 — 단일 공유 버킷 완화 한도")
- **과거 결정 출처**: `spec/7-channel-web-chat/4-security.md` Rationale R3 ("Redis 미가용 시 fail-open — 방어 인프라 장애가 정당한 webhook까지 깨는 것을 막기 위함") + `spec/5-system/12-webhook.md` Rationale "공개 webhook throttle Guard — 조회 실패 시 fail-open + error 로깅"
- **상세**: R3 는 "Redis/DB 인프라 장애 시 fail-open"을 명시한다. R6 는 IP 미식별이라는 별개 차원의 문제를 다루며, R3 와 R6 두 차원을 명확히 분리한다("본 항의 fail-open 은 인프라 장애(Redis/DB) 차원이며, 클라이언트 IP 미식별 시의 처리는 별도 차원으로 R6 가 다룬다"). 이 분리 선언은 `spec/7-channel-web-chat/4-security.md` §4 본문 blockquote 와도 정합한다. fail-closed 기각 이유("비-인증 best-effort 레이어가 가용성을 희생하는 것은 §4 graceful degradation 원칙과 충돌")도 R3 의 기존 논리와 동일 원칙을 계승한다. R3 가 암묵적으로 허용하던 "IP 미식별 → 무제한 통과"를 R6 가 "유한 상한"으로 좁히는 것은 R3 의 fail-open 원칙을 번복하는 것이 아니라 보완적 강화다.
- **제안**: 없음. R3 와 R6 의 차원 분리가 이미 명문화되어 있어 혼동 여지가 없다.

---

### [INFO] WH-SC-05 보강 — IP 미식별 시 공유 버킷·인증 webhook fail-closed 대비 명문화
- **target 위치**: `spec/5-system/12-webhook.md` §인증 및 보안 WH-SC-05 불릿, §6 Rate Limiting 불릿, Rationale "공개 webhook throttle Guard" 참조
- **과거 결정 출처**: `spec/5-system/12-webhook.md` 동일 섹션 — 기존에는 IP 미식별 케이스를 명시하지 않았음
- **상세**: WH-SC-05 에 "클라이언트 IP 미식별 시 미식별 요청은 단일 공유 버킷으로 묶여 동일 한도 적용(완화)"과 "인증 webhook ip_whitelist 는 IP 미식별 시 거부(fail-closed)" 대비가 명시됐다. 인증 webhook의 IP 미식별 → 거부(WH-SC-09)는 새로 추가되는 행동이 아니라 기존 `ip_whitelist` 의 미식별 처리 원칙을 명시화한 것이다. 인증 게이트(ip_whitelist)와 rate-limit(공유 버킷)의 성격 차이로 미식별 시 결과가 다른 것은 의도된 비대칭이며, `4-security.md` R6 마지막 blockquote 와 정합한다.
- **제안**: 없음.

---

## 요약

`spec/5-system/` 내 변경(주로 `1-auth.md` Rationale 2.3.B m-3 보강)은 기존 Rationale 에서 명시적으로 기각된 대안(`req.ip`/`req.socket.remoteAddress` 폴백)을 재도입하거나 합의된 invariant 를 우회하지 않는다. 신규 R6(`4-security.md`)는 기존 R3 의 "인프라 장애 fail-open" 원칙과 차원이 다름을 명문화하면서 공유 버킷 완화 한도를 도입해 무제한 우회를 유한 상한으로 좁혔다. 이는 R3 를 번복하는 것이 아니라 R3 가 다루지 않던 "IP 미식별" 차원을 R6 로 보완한 것이다. `1-auth.md` Rationale 2.3.B m-3 의 갱신도 기존 기각 결정을 유지한 채 공백이었던 "미식별 시 처리 방침"을 채우는 보강이다. 결정 번복·기각 대안 재도입·invariant 우회 패턴이 없으며 모든 새 결정에 Rationale 이 동반됐다.

---

## 위험도

NONE
