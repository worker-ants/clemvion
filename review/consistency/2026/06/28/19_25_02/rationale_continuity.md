# Rationale 연속성 검토 결과

검토 범위: `spec/5-system/` (impl-done, diff-base=origin/main)
검토 대상 실제 변경 파일:
- `spec/5-system/1-auth.md`
- `spec/5-system/12-webhook.md`
- `spec/1-data-model.md`
- `spec/2-navigation/6-config.md`

---

## 발견사항

변경사항 요약:

본 PR 의 스펙 변경은 모두 **`extractClientIp` → `extractClientIpFromHeaders` 함수명 수정** 및 그에 따른 "req.ip/socket 폴백 없음" 제약 명시에 집중된다. 구체적으로:

- `spec/5-system/1-auth.md §2.3` 클라이언트 IP 행: 4단계 폴백(`req.ip`/`socket` 포함)은 세션·감사 IP 경로(`extractClientIp`)에 한정되고, webhook/rate-limit/ip_whitelist 경로는 헤더 기반(`extractClientIpFromHeaders`)만 사용하며 `req.ip`/`socket` 폴백이 없다는 것을 명시적으로 추가
- `spec/5-system/12-webhook.md §7 처리 흐름(8번/chat-channel 분기)`: `extractClientIp` → `extractClientIpFromHeaders`로 함수명 수정
- `spec/1-data-model.md §2.13 Execution.source_ip`: 동일 함수명 수정 + "헤더 기반·req.ip 폴백 없음" 상세 추가
- `spec/2-navigation/6-config.md §R-6 소스 IP 캡처 경로`: 동일 함수명 수정 + 근거 링크 추가

---

### [INFO] Rationale 2.3.B 의 기존 결정을 올바르게 구체화함
- target 위치: `spec/5-system/1-auth.md §2.3` 클라이언트 IP 행 (신규 강조 문구)
- 과거 결정 출처: `spec/5-system/1-auth.md ## Rationale` `### 2.3.B — Refresh 쿠키 SameSite·CSRF 와 클라이언트 IP 신뢰 (refactor 04 M-5·m-3)` 의 **클라이언트 IP 신뢰 (m-3)** 항
- 상세: Rationale 2.3.B 는 이미 "ip_whitelist/rate-limit 의 IP 추출이 헤더 기반(CF-gated → XFF 첫 IP)인 것은 의도된 결정이다 — req.ip 를 우선/대체로 쓰자는 안은 기각한다" 고 명시하고 있다. target 변경은 §2.3 표의 "클라이언트 IP" 셀에 이 Rationale 결정이 어느 함수 경로에 어떻게 적용되는지를 본문에 명시적으로 표면화한 것으로, 기각된 대안의 재도입이나 합의된 원칙 위반이 아니다. Rationale 자체와 완전히 정합한다.
- 제안: 현재 상태 유지. 오히려 §2.3 표 셀에 경로 분기(`extractClientIp` vs `extractClientIpFromHeaders`)를 명시함으로써 Rationale 2.3.B 의 의도가 spec 본문 level 에서도 visible 해졌다 — Rationale 정합성이 강화된 변경이다.

### [INFO] webhook spec 및 data-model spec 의 함수명 업데이트가 Rationale 없이 이루어졌으나 이는 서술적 갱신(descriptive update)
- target 위치: `spec/5-system/12-webhook.md §7` 처리 흐름 8번·chat-channel 분기; `spec/1-data-model.md §2.13 Execution.source_ip`; `spec/2-navigation/6-config.md R-6 소스 IP 캡처 경로`
- 과거 결정 출처: `spec/5-system/1-auth.md ## Rationale 2.3.B (m-3)`
- 상세: 세 spec 모두 `extractClientIp` (옛 함수명)를 `extractClientIpFromHeaders` (실제 구현 함수명)으로 교정하는 사실 기술 수정이다. 설계 방향(헤더 기반·폴백 없음)을 채택한 Rationale 결정은 이미 auth.md 2.3.B 에 존재하므로, 다른 spec 파일들은 함수명을 최신화한 것이지 별도 결정 번복이 아니다. 따라서 새 Rationale 작성이 없어도 연속성 위반이 아니다.
- 제안: 현재 상태 유지. 단, 독자 편의를 위해 webhook.md 처리 흐름의 `extractClientIpFromHeaders` 뒤에 `(Rationale 2.3.B m-3)` 를 인라인 주석으로 추가하는 것을 권장하나 필수는 아니다.

---

## 요약

본 PR 의 스펙 변경은 `extractClientIp` → `extractClientIpFromHeaders` 함수명 교정 및 "webhook/rate-limit/ip_whitelist 경로에서 req.ip/socket 폴백이 없다"는 사실 명시가 전부다. 이 설계 결정(헤더 기반 IP 추출 단일 경로, req.ip 폴백 기각)은 이미 `spec/5-system/1-auth.md ## Rationale 2.3.B (m-3)` 항에 명시적으로 확정되어 있다. target 문서들은 그 결정을 기각하거나 번복하지 않으며, 오히려 기존 Rationale 결정이 코드 실제와 어떻게 대응하는지를 spec 본문에 더 명확하게 표면화했다. 기각된 대안 재도입, 합의 원칙 위반, 근거 없는 번복, invariant 우회 어느 범주에도 해당하지 않는다.

## 위험도

NONE
