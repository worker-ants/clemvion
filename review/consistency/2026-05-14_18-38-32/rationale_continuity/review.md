---

## 발견사항

이슈 없음.

Target 문서의 본문(§2~§14)과 ## Rationale 섹션을 전체 검토한 결과, 과거 결정과 충돌하거나 기각된 대안을 재도입한 부분이 발견되지 않았다.

검토한 주요 항목 및 결과:

| 검토 항목 | 과거 결정 (출처) | 문서 반영 여부 |
|---|---|---|
| callback 실패 시 `error(auth_failed)` 전이 **기각** → `pending_install` 유지 | Rationale §"Cafe24 Private 앱의 callback 실패" | §6 상태 전이표, §10.4 에러 매핑 표 — 정확히 반영 ✓ |
| `mode='cafe24_private_install'` 신설 **기각** → `mode='reauthorize'` 재사용 | Rationale §"OAuthState.mode='reauthorize' 재사용" | §10.2 step 4, callback 분기 — 반영 ✓ |
| install_token 없는 경로 (mall_id+HMAC O(N) 스캔) **폐기** → path 에 토큰 승격 | Rationale §"install_token 을 App URL path 식별 키로 승격" | §9.2 `/oauth/install/cafe24/:installToken` 기본 경로, `/oauth/install/cafe24` deprecated 410 — 반영 ✓ |
| TTL 만료 시 `→ (삭제)` **번복** → `→ expired(install_timeout)` 보존 | Rationale §"install_token TTL 24h" | §6 번복 acknowledgment 명시 + 전이표 — 반영 ✓ (번복에 근거도 함께 기술) |
| `pending_install` 필터 칩 미포함 결정 | Rationale §"`pending_install` 은 필터 칩에 추가하지 않는다" | §2.3 상태 칩 목록, §2.3 주석 — 반영 ✓ |
| Cafe24 Private reauthorize 불가 (삭제 후 재등록만) | Rationale §"connected → expired 복구 경로" | §4.2/§4.3 reauthorize 비활성 조건, §6 expired/error→connected 주석 — 반영 ✓ |
| `CAFE24_INSTALL_INVALID_TOKEN(404)` 분리 보안 전제 (32바이트 random) | Rationale §"CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제" | §9.4 에러코드 표, §9.2 HMAC 실패는 여전히 403 분리 유지 — 반영 ✓ |
| `status_reason` snake_case vs API UPPER_SNAKE_CASE 의도적 분리 | Rationale §"status_reason `oauth_token_exchange_failed`와 auth 도메인 구분" | §10.4 표 내 두 표기 일관 사용 — 반영 ✓ |

---

## 요약

target 문서는 2026-05-14에 기록된 Cafe24 Private 통합 관련 모든 설계 결정을 본문과 Rationale 양쪽에 정합하게 반영하고 있다. install_token TTL 만료 정책(자동 삭제 → expired 보존)이라는 명시적 번복도 §6에 "번복 acknowledgment"를 포함해 근거를 함께 서술하고 있어 결정 연속성이 확보된다. 기각된 대안(mode='cafe24_private_install', error 전이, 삭제, 필터칩 추가)은 모두 재도입되지 않았다.

---

## 위험도

**NONE**