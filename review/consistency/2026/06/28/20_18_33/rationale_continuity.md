# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/webhook-public-ip-failopen-hardening.md`
검토 모드: spec draft 검토 (--spec)
검토일: 2026-06-28

---

## 발견사항

### [INFO] fail-open 철학과의 정합 — 명시적이나 교차 참조 강화 권장
- **target 위치**: plan 문서 `## 결정` 항목 3 — "fail-closed(거부)는 … §4 철학과 충돌하므로 기각"
- **과거 결정 출처**: `spec/7-channel-web-chat/4-security.md` Rationale R3 ("Redis 미가용 시 fail-open — 방어 인프라 장애가 정당한 webhook까지 깨는 것을 막기 위함") + `spec/5-system/12-webhook.md` Rationale "공개 webhook throttle Guard — 조회 실패 시 fail-open + error 로깅"
- **상세**: target 의 결정 3 이 fail-closed 를 기각하는 논리("비-인증 best-effort 레이어가 가용성을 희생하는 §4 철학과 충돌")는 두 Rationale 의 합의 원칙과 완전히 정합한다. 다만 target 이 참조하는 "§4 철학" 이 구체적으로 `4-security.md §4` (R3) 임을 plan 본문이 명시하지 않고 약칭으로만 써서, 후행 spec 작성 시 이 cross-ref 가 누락될 여지가 있다.
- **제안**: S-2(rationale SoT) 작성 시 `spec/7-channel-web-chat/4-security.md Rationale R3` 와 `spec/5-system/12-webhook.md Rationale "fail-open + error 로깅"` 을 명시적으로 참조하도록 한다. plan 텍스트 수정보다는 spec 작성 단계에서 반영하면 충분하다.

---

### [INFO] socket 폴백 기각 — Rationale 2.3.B 와 정합, 약어 명확화 권장
- **target 위치**: plan 문서 `## 결정` 항목 2 — "Rationale 2.3.B 가 `req.ip` 를 기각한 함정과 동일"
- **과거 결정 출처**: `spec/5-system/1-auth.md` Rationale 2.3.B ("클라이언트 IP 신뢰 m-3") — "webhook/rate-limit/ip_whitelist 경로는 헤더 기반(CF-gated → XFF 첫 IP)만 적용하며 req.ip/socket 폴백이 없다(extractClientIpFromHeaders 직접 호출) — CF Tunnel 에서 req.ip 가 실제 클라이언트가 아니어서 의도적으로 기각"
- **상세**: target 이 "`req.socket.remoteAddress` 를 폴백으로 쓰지 않는다(headers-only 유지)"고 결정한 것은 Rationale 2.3.B m-3 의 결정과 완전 일치한다. 기각 이유("trust proxy=1 뒤에서 socket 피어가 cloudflared/LB 주소라 전 트래픽이 단일 버킷으로 붕괴")도 2.3.B 의 논거("CF Tunnel 에서 req.ip 가 실제 클라이언트가 아님")와 동등하다. Rationale 연속성 위반 없음. 단, target 은 `req.socket.remoteAddress` 와 `req.ip` 를 구분하지 않고 함께 기각하고 있는데, 2.3.B 는 `req.ip`(trust proxy) 기각을 명시한다. socket 에 대한 별도 언급은 없지만 동일 논리로 포괄되므로 실질적 불일치는 없다.
- **제안**: S-4 Rationale 갱신(1-auth.md 2.3.B m-3) 시 `req.socket.remoteAddress` 와 `req.ip` 모두가 rate-limit null-IP 경로에서 기각되는 것임을 보강하면 향후 코드 리뷰에서 2.3.B 를 근거로 올바르게 인용할 수 있다.

---

### [INFO] 단일 공유 버킷 결정 — 신규 결정이나 Rationale 명시 경로 확보됨
- **target 위치**: plan 문서 `## 결정` 항목 3 전체 및 `## 설계` sentinel 상수 설명
- **과거 결정 출처**: `spec/7-channel-web-chat/4-security.md` §4 / Rationale R3; `spec/5-system/12-webhook.md` §6 / Rationale
- **상세**: 기존 Rationale 어디에도 "IP 미식별 요청을 단일 공유 버킷으로 묶는다"는 결정이 존재하지 않는다. 이는 새 결정이다. 그러나 target plan 이 결정 3 의 근거(fail-closed 기각 이유·graceful degradation 보존·§4 best-effort 철학)를 명시하고 있고, Phase A S-2 에서 spec Rationale(4-security R3)에 이 결정을 명문화하는 작업이 예정돼 있다. 즉, 새 Rationale 없이 조용히 번복하는 패턴이 아니라 Rationale 추가를 계획하고 있어, 검토 관점 3 ("결정의 무근거 번복")에 해당하지 않는다.
- **제안**: S-2 가 실제로 작성될 때 "fail-open(기존 `return true`)에서 완화 한도(공유 버킷)로의 전환" 이 왜 §4 best-effort 철학 안에서 허용되는지를 명시한다. fail-open 기각이 아닌 강화(무제한 → 유한 상한)임을 분명히 해야 R3 의 "fail-open 유지" 정신과 충돌하지 않음을 독자가 이해할 수 있다.

---

### [INFO] Guard 책임 경계 불변 선언 — 기존 Rationale 와 정합 확인
- **target 위치**: plan 문서 `## 설계` 마지막 줄 — "글로벌 throttler(100 req/min)·Guard 책임 경계는 변화 없음"
- **과거 결정 출처**: `spec/5-system/12-webhook.md` Rationale "공개 webhook throttle Guard" — "Guard 의 책임은 rate-limit(가용성 보호)이지 인증·인가가 아니다"
- **상세**: target 이 "Guard 는 여전히 공개 webhook 의 IP/공유 버킷 rate-limit 만 담당, 후행 글로벌 throttler 가 IP 무관 1차 방어 유지"를 명시한 것은 기존 SRP(단일 책임) 결정과 완전히 정합한다. 위반 없음.
- **제안**: 없음.

---

## 요약

target plan 문서(`webhook-public-ip-failopen-hardening.md`)는 기존 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 우회하는 설계를 포함하지 않는다. 핵심 두 결정 — socket/req.ip 폴백 기각(2.3.B m-3 연속)과 fail-closed 기각(4-security R3·12-webhook Rationale 연속) — 은 기존 Rationale 의 논리를 그대로 계승하며, 새로 추가되는 단일 공유 버킷 완화 한도 결정은 Phase A S-2 에서 새 Rationale 로 명문화할 계획이 수립돼 있다. 보완 권고는 모두 spec 작성 단계에서의 교차 참조 명확화 수준으로, 현재 plan 자체는 Rationale 연속성 관점에서 위반이 없다.

---

## 위험도

LOW
