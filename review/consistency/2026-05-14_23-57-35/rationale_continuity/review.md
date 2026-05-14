### 발견사항

검토 결과 CRITICAL 또는 WARNING 급 충돌은 발견되지 않았습니다. 주요 점검 항목별 상태:

---

**[INFO] `install_token` 평문 저장 근거가 data-flow 문서에 미기재**
- target 위치: §2.1 Schema 매핑, `install_token (Cafe24 private 전용)` 항목
- 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "install_token 을 App URL path 식별 키로 승격"
- 상세: Rationale 는 "`install_token` 은 App URL path 에 공개 포함되는 식별자로 평문 저장 — credentials/last_error 암호화 정책 대상 아님" 으로 명시하나, data-flow §2.1 의 컬럼 목록에는 암호화 여부가 표기되지 않음. 독자가 `credentials (encrypted JSONB)` 패턴을 보고 `install_token` 도 암호화된다고 오독할 여지가 있음.
- 제안: §2.1 컬럼 항목에 `install_token (평문, V042)` 등으로 명시 보완.

---

**적합성 확인 항목 (이상 없음)**

| 확인 항목 | Rationale 결정 | data-flow 반영 |
|---|---|---|
| TTL 만료 행 → 삭제 금지, `expired(install_timeout)` 전이 | `spec/2-navigation/4-integration.md` Rationale "install_token TTL 24h" | §1.4 다이어그램 line 165, §3.1 상태 전이 `pending_install → expired` ✓ |
| callback 실패 시 `pending_install` status 보존 | Rationale "callback 실패는 status 보존" | §1.2.1 diagram else 분기 (line 92), §3.1 `pending_install → pending_install` ✓ |
| `status_reason` 저장값 snake_case | Rationale "DB 컬럼 컨벤션 전체 snake_case" | §3.2 `oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired` ✓ |
| HMAC 실패(403) vs. token 미존재(404) 분리 | Rationale "CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제" | §1.2.1 diagram line 95/97 ✓ |
| `mode=reauthorize` install 흐름 재사용 | Rationale "OAuthState.mode='reauthorize' 를 초기 install 에도 재사용" | §1.2.1 diagram line 84 ✓ |
| `pending_install` 삭제는 manual delete 만 | Rationale "자동 삭제는 더 이상 일어나지 않으며, manual delete 만 삭제 경로" | §3.1 `pending_install → [*]: manual delete` ✓ |
| BullMQ 3-way 분리 + 옛 단일 스케줄러 제거 | 구조적 변경 (Rationale 신규) | §1.4 격리 정책 + 마이그레이션 기술 ✓ |

---

### 요약

`spec/data-flow/integration.md` 는 기존 Rationale 의 모든 핵심 결정(TTL 만료 보존 정책, callback 실패 시 status 보존, snake_case status_reason, 분리된 HTTP 에러 코드, manual-only 삭제 경로)을 정확히 반영하고 있다. 기각된 대안의 재도입이나 합의된 invariant 위반은 발견되지 않았다. 유일한 보완 포인트는 `install_token` 평문 저장 사실을 §2.1 에 명시해 독자가 암호화 여부를 오독하지 않도록 하는 것이며, 이는 필수가 아닌 가독성 보완이다.

### 위험도

**LOW**