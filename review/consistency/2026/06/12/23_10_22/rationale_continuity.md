# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-audit-workspace-scope.md`
검토 모드: spec draft (--spec)

---

## 발견사항

### [INFO] 결정 2 — `req.ip` 기각 근거가 기존 2.3.B 와 실질 중복

- **target 위치**: target 문서 "결정 2" 절 — "CF Tunnel 배포에선 `trust proxy 1` 의 `req.ip` 가 cloudflared/CF edge IP(실 클라이언트 아님)라 `req.ip` 우선화는 ip_whitelist 를 오히려 깨뜨린다"
- **과거 결정 출처**: `spec/5-system/1-auth.md § Rationale 2.3.B` "클라이언트 IP 신뢰 (m-3)" 항: "Cloudflare(Tunnel 포함) 뒤에서는 `X-Forwarded-For` 첫 IP 도 동일한 실제 클라이언트 IP 이므로 off 폴백이 안전하다." 및 "본 신뢰 플래그는 IP 를 읽는 세 경로(세션·감사 IP, 공개 webhook rate-limit, `ip_whitelist` 검증)에 일관 적용한다."
- **상세**: 기존 2.3.B 는 이미 CF Tunnel 토폴로지 근거와 세 경로(ip_whitelist 포함) 일관 적용을 명문화했다. target 이 2.3.B 에 추가하려는 "ip_whitelist/rate-limit 의 헤더 기반 IP 추출은 의도된 결정이며 `req.ip` 우선화는 CF Tunnel 토폴로지에서 부정확" 는 기존 2.3.B 본문과 실질적으로 동일한 내용이다. 새 Rationale 항 신설이 아니라 기존 항 보강으로 처리해야 중복 서술을 막는다. 방향 자체는 기존 결정과 완전히 일치한다.
- **제안**: 2.3.B 의 "클라이언트 IP 신뢰 (m-3)" 마지막에 "코드 리뷰가 `extractClientIp` 의 `req.ip` 우선 부재를 반복 플래그하는 경우, 이는 의도된 by-design 이다 — CF Tunnel 배포에서 `trust proxy 1` 의 `req.ip` 는 cloudflared/edge IP 이므로 ip_whitelist 를 오히려 깨뜨린다" 를 한 문장 보강하는 것으로 충분하다. 별도 항 신설은 불필요.

---

### [INFO] 결정 1 — 4.1.B 신규 Rationale 항 신설, 기존 invariant 와 충돌 없음

- **target 위치**: target 문서 "결정 1" 절 전체, "반영 위치" — "새 Rationale `4.1.B`"
- **과거 결정 출처**: `spec/5-system/1-auth.md §4.1 L379` — "워크스페이스 컨텍스트가 없는 인증 이벤트(login, logout, login_failed 등)는 AuditLog 가 아닌 §4.3 LoginHistory 에 기록된다." 및 `Rationale 4.1.A` — `user.*` dot-prefix 통일 결정.
- **상세**: 결정 1 은 §4.1 L379 의 "워크스페이스 컨텍스트 분류" invariant 를 구체화한다. 기각된 대안 (b) nullable 허용과 (c) personal scope 신설을 명시하여 다시 채택하지 않음을 선언하는 구조이므로 기존 Rationale 와 충돌하지 않는다. 무인증 reset-password 경로를 audit_log 에서 제외하는 처리("login_history 에 기록 또는 미기록") 는 기존 spec 이 명시하지 않은 공백을 채우는 것으로 번복이 아니다. 4.1.B 신설 자체는 적절하다.
- **제안**: 4.1.B 항 작성 시 "reset-password 경로 제외 근거 — 세션/workspace 없음 → §4.1 L379 기존 분류 원칙 적용" 을 명확히 기술하면 충분하다. target 문서에 이미 이유가 서술되어 있어 spec 반영 시 그대로 이관하면 된다.

---

## 요약

target 문서의 두 결정 모두 `spec/5-system/1-auth.md § Rationale` 에서 명시적으로 기각된 대안을 재도입하거나 합의된 원칙을 위반하지 않는다. 결정 1 은 §4.1 L379 의 "워크스페이스 컨텍스트 분류" invariant 를 구체화하는 것으로 번복이 아니고, 기각된 대안((b) nullable, (c) personal scope)도 target 에서 명시적으로 재거부하고 있다. 결정 2 는 2.3.B 에 이미 확정된 CF Tunnel 기반 XFF IP 신뢰 정책의 재확인으로 방향이 일치하나, 추가 내용이 기존 2.3.B 와 실질 중복이므로 별도 항 신설보다 기존 항 보강이 더 간결하다. 두 결정 모두 새 Rationale 를 함께 작성하려는 의도가 명확히 서술되어 있어 "무근거 번복"에 해당하지 않는다.

## 위험도

NONE
