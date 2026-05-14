---

## 발견사항

### **[WARNING]** `resource_not_found` 의 `status_reason` 포함 여부 — DRAFT 내부 모순
- **target 위치**: DRAFT 1C (`spec/1-data-model.md §2.10`) vs. DRAFT 2D (§6 전이 표) vs. DRAFT 3B (`data-flow §3.2`) vs. DRAFT 2G (§10.4 에러 매핑)
- **과거 결정 출처**: 해당 없음 (DRAFT 내부 정합 문제)
- **상세**:
  - DRAFT 1C 는 `status_reason` 후보에서 `resource_not_found` 를 **명시 제외**: "row 자체가 사라진 케이스라 status_reason 갱신이 불가능 — §10.4 표에서 '변경 불가' 로만 다루고 본 컬럼 후보값에서는 제외"
  - DRAFT 2G(§10.4) 도 동일: "변경 불가 (row 가 사라진 케이스. integrationId 만 식별, row 가 없으니 갱신 대상 없음)"
  - 그러나 DRAFT 2D(§6 전이 표)는 `pending_install → pending_install` 전이의 `status_reason` 목록에 `resource_not_found` 를 **포함**: `oauth_token_exchange_failed` / `oauth_state_mismatch` / `oauth_state_expired` / `resource_not_found`
  - DRAFT 3B(data-flow §3.2) 도 동일하게 포함
  - 논리 충돌: row 가 사라진 케이스에서는 `status_reason` 컬럼 자체를 UPDATE 할 수 없으므로 DB 저장값 후보 목록에 넣는 것이 모순
- **제안**: DRAFT 2D 와 DRAFT 3B 에서 `resource_not_found` 를 제거하거나, 해당 케이스가 실제로 `status_reason` 갱신 가능한 경우(row 가 존재하는데 조회 실패)임을 명확히 구분해 1C/2G 와 일관된 정의로 통일

---

### **[WARNING]** Cafe24 Private 전체에 reauthorize 비활성 — `connected → expired (token_expired)` 복구 경로 미서술
- **target 위치**: DRAFT 2K (§4.2 Reauthorize 비활성 조건) + DRAFT 2I Rationale
- **과거 결정 출처**: 해당 없음 (기존 spec 의 `expired → connected` reauthorize 경로를 사실상 번복하는 구조)
- **상세**:
  - DRAFT 2K 는 `service_type='cafe24' AND credentials.app_type='private'` **전체** 케이스에서 reauthorize 버튼을 비활성화함
  - DRAFT 2I Rationale 는 이 결정의 근거("Private 앱은 우리 서버가 OAuth 를 시작할 수 없음")를 `pending_install` 케이스와 `install_timeout expired` 케이스에 대해서만 서술
  - Rationale 에 공백: `connected → expired (token_expired/refresh_failed)` 상태가 된 Cafe24 Private 통합의 사용자 복구 경로가 설명되지 않음. 기존 spec 의 `expired → connected` 전이(DRAFT 2D 전이 표 "(기존) expired/error → connected | reauthorize 또는 rotate 성공")는 일반 케이스로 유지되어 있으나, Cafe24 Private 는 이 경로가 차단됨
  - Cafe24 Private 의 `token_expired` expired 행은 삭제 후 재등록이 유일한 복구 경로로 보이는데, 이것이 의도된 결정인지 Rationale 에 없음
  - DRAFT 3A 의 상태 다이어그램도 `expired --> connected: refresh 성공 OR 수동 재인증` 을 일반 경로로 유지하면서 Cafe24 Private 예외를 표기하지 않아 다이어그램과 DRAFT 2K 간 불일치
- **제안**: DRAFT 2I Rationale 에 "Cafe24 Private `connected → expired (token_expired)` 케이스의 복구 경로는 삭제 후 재등록이며, 이는 Private 앱이 우리 서버에서 OAuth 를 시작할 수 없는 구조적 제약의 당연한 귀결" 임을 명시. DRAFT 3A 다이어그램에도 Private 앱 예외 노트를 추가하거나, DRAFT 2D 전이 표의 `expired → connected` 행에 "단, Cafe24 Private 제외" 를 병기

---

### **[INFO]** `expired → [*]` 다이어그램 어노테이션 과도한 한정
- **target 위치**: DRAFT 3A (`data-flow §3.1` stateDiagram-v2)
- **상세**: `expired --> [*]: manual delete (install_timeout 케이스)` 라고 어노테이션하면 "install_timeout 인 expired 행만 삭제 가능" 으로 읽힐 수 있으나, 실제로는 모든 expired 행이 삭제 가능. `connected --> [*]: 삭제` 와 병치하면 "expired 는 install_timeout 케이스만 삭제 가능" 이라는 오독이 생길 수 있음
- **제안**: 어노테이션을 `manual delete (Cafe24 Private install_timeout 전용 추가 명시)` 로 바꾸거나, 범용 `expired --> [*]: manual delete` 를 표기한 뒤 `install_timeout` 케이스는 "reauthorize 불가, manual delete 권장" 노트로 분리

---

### **[INFO]** 명시적 번복 — 모두 Rationale 동반 (문제 없음)

- `pending_install → (삭제)` → `→ expired (install_timeout)` 번복: DRAFT 2D acknowledgment + DRAFT 2I "install_token TTL 24h" 단락에서 완결 서술
- App URL path `/oauth/install/cafe24` → `/:installToken` 번복: DRAFT 2I "install_token 을 App URL path 식별 키로 승격" 단락에서 완결 서술
- `CAFE24_INSTALL_INVALID_HMAC` 합산 정책 → 코드 분리: DRAFT 2I "CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제" 단락에서 완결 서술
- `mode='reauthorize'` 초기 install 재사용: DRAFT 2I "OAuthState.mode='reauthorize' 를 초기 install 에도 재사용한 이유" 단락에서 완결 서술

---

## 요약

대부분의 결정 번복은 DRAFT 2I Rationale 에서 명확하게 근거와 함께 서술되어 의사결정 연속성이 잘 유지되어 있다. 단, 두 가지 문제가 spec 적용 전 해소가 필요하다. (1) `resource_not_found` 의 `status_reason` 포함 여부가 DRAFT 내에서 1C/2G(제외) 와 2D/3B(포함) 로 엇갈려 있어 data-model 수준에서 어느 쪽이 맞는지 결론을 내려야 한다. (2) Cafe24 Private 의 reauthorize 전면 비활성화(DRAFT 2K)는 `pending_install`/`install_timeout` 케이스만 Rationale 에 설명되어 있고, `connected → expired (token_expired)` 케이스의 복구 경로가 Rationale 에 빠져 있어 실제 운영 시나리오를 커버하지 못한다.

## 위험도

**MEDIUM** — 두 WARNING 이 구현 전 해소되어야 하나, 기존 spec 의 명시적 Rationale 를 위반한 결정은 없음