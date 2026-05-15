## Cross-Spec 일관성 검토 결과

---

## 발견사항

### [CRITICAL] `resource_not_found` status_reason 값 — DRAFT 1C·3B·2D·2G 간 직접 모순

- **target 위치**: DRAFT 1C (`spec/1-data-model.md §2.10 status_reason` 정의), DRAFT 3B (`spec/data-flow/integration.md §3.2`), DRAFT 2D (§6 전이 표), DRAFT 2G (§10.4 에러 매핑)
- **충돌 대상**: 동일 draft 내 네 곳이 서로 모순
- **상세**:
  - DRAFT 1C: `resource_not_found`를 status_reason 후보값에서 **명시적 제외** — "row 자체가 사라진 케이스라 status_reason 갱신이 불가능 — §10.4 표에서 '변경 불가'로만 다루고 본 컬럼 후보값에서는 제외"
  - DRAFT 3B (`data-flow §3.2`): `pending_install` status_reason 목록에 `resource_not_found` **포함** — `oauth_token_exchange_failed, oauth_state_mismatch, oauth_state_expired, resource_not_found (모두 snake_case)`
  - DRAFT 2D (§6 전이 표): `pending_install → pending_install` 전이에서 `status_reason` 갱신 후보 코드로 `resource_not_found` 나열
  - DRAFT 2G (§10.4 대체 표): "변경 불가 (row 가 사라진 케이스. integrationId 만 식별, row 가 없으니 갱신 대상 없음)"

  DRAFT 1C·2G("row가 없으니 UPDATE 불가")와 DRAFT 3B·2D("실제 저장 가능한 값")가 공존 불가능하다.

- **제안**: DRAFT 1C·2G의 입장("변경 불가")이 의미론적으로 옳다. DRAFT 3B의 `pending_install` 목록에서 `resource_not_found` 제거, DRAFT 2D §6 전이 표 설명에서도 동일 제거. `resource_not_found` 케이스는 §10.4 표의 "변경 불가" 행만으로 문서화.

---

### [CRITICAL] `connected` 재인증 실패 시 status — DRAFT 2G §10.2 step 6 vs §10.4 표 직접 모순

- **target 위치**: DRAFT 2G 내 `spec/2-navigation/4-integration.md` §10.2 step 6 (신규 추가) / §10.4 에러 매핑 표 (대체)
- **충돌 대상**: 동일 draft 내, 동일 spec 파일의 두 섹션
- **상세**:
  - DRAFT 2G **§10.4 표**: `코드 교환 실패 (mode=reauthorize, status=connected)` → **`error(auth_failed)` + `last_error` 기록** (status가 `connected`→`error`로 전이)
  - DRAFT 2G **§10.2 step 6 (신규)**: "status 자체는 보존되어 (**connected 의 reauthorize 실패는 connected 유지**) 사용자 재시도 흐름을 깨지 않는다"

  동일 파일, 동일 시나리오에서 status 처리가 정반대로 기술된다. 구현자가 두 섹션을 모두 읽으면 어느 것을 따를지 결정할 수 없다.

- **제안**: §10.4 표("error(auth_failed)")가 기존 OAuth 실패 처리 패턴과 일치하므로 이쪽이 정의로 유효하다. Step 6의 해당 구문을 다음으로 교정: "`pending_install` 은 `pending_install` 유지 — `connected` 재인증 실패는 §10.4 표 기준으로 `error(auth_failed)` 로 전이". 혹은 step 6이 "토큰 교환 이전 단계 실패(state mismatch 계열)"만을 가리킨다면 해당 조건 범위를 명시적으로 한정.

---

### [WARNING] BullMQ 큐 메시지 포맷 변경 — 하위 호환성 미명시

- **target 위치**: DRAFT 3C-bis (`spec/data-flow/integration.md §1.4 OAuth 만료 스캐너`) 본문 보강
- **충돌 대상**: 기존 `integration-expiry` BullMQ 큐의 job payload 스키마 (`{ integrationId }`)
- **상세**: DRAFT 3C-bis는 큐 메시지를 `{ integrationId, reason: 'token_expiring' | 'pending_install_timeout' }` 으로 확장한다. 기존 소비자(worker)가 `reason` 필드 없이 처리 중이라면 `undefined` 분기로 빠져 `token_expiring` 로직이 실행되지 않을 수 있다. spec은 기존 소비자의 기본값 처리를 명시하지 않는다.
- **제안**: spec §1.4 본문에 "기존 소비자는 `reason` 미포함 메시지를 `token_expiring` 으로 간주 — 하위 호환 보장" 한 줄 추가. 또는 worker 구현에서 `reason ?? 'token_expiring'` 기본값 처리를 DEVELOPER 스펙으로 명시.

---

### [WARNING] §2.3 상태 필터 칩 미갱신 — `pending_install` 의도적 제외 미문서화

- **target 위치**: DRAFT 2I Rationale ("pending_install 은 필터 칩에 추가하지 않는다") / "영향받는 연관 문서" 목록
- **충돌 대상**: `spec/2-navigation/4-integration.md §2.3 상태 필터 칩` (현행: `Connected / Expiring / Expired / Error` 4종 + All, 변경 없음)
- **상세**: §2.2에 `⏳ pending_install` 아이콘이 추가되어 사용자에게 해당 상태가 노출되지만, §2.3 필터 칩은 갱신되지 않는다. 제외 결정이 Rationale에만 있고 §2.3 정규 본문에 반영되지 않아, 구현자가 §2.3만 읽으면 누락인지 의도적 제외인지 알 수 없다.
- **제안**: §2.3 상태 필터 칩 설명 끝에 "※ `pending_install` 은 외부 흐름(Cafe24 Developers) 진행 중 정상 전환 상태로 필터 칩에 포함하지 않는다" 한 줄 추가. "영향받는 연관 문서" 에 §2.3 추가.

---

### [INFO] Reauthorize 비활성 조건 중복 — DRAFT 2K §4.2

- **target 위치**: DRAFT 2K `spec/2-navigation/4-integration.md §4.2 Reauthorize 비활성 조건`
- **충돌 대상**: 없음 (기능적 충돌 없음, 표현 중복)
- **상세**: 열거된 세 조건 ① `status='pending_install'` ② `status='expired' AND status_reason='install_timeout'` ③ `service_type='cafe24' AND credentials.app_type='private'` 에서, ③이 ①·②를 완전히 포함한다. 조건 ③만으로 `connected` Cafe24 private까지 비활성화됨을 구현자가 파악하기 어려울 수 있다.
- **제안**: 조건을 "Cafe24 Private 앱 (`service_type='cafe24' AND credentials.app_type='private'`) 전체 — 상태 불문 비활성"으로 단순화하거나, 현 구조 유지 시 "① ②는 ③의 특수 케이스 — 각각 '왜 비활성인지' 사용자 메시지 분기용 예시" 임을 주석으로 명시.

---

### [INFO] `credentials_unreadable` — data-flow spec에 추가되나 data model §2.10 본문 반영 불명확

- **target 위치**: DRAFT 3B (`spec/data-flow/integration.md §3.2`) / DRAFT 1C (`spec/1-data-model.md §2.10 status_reason`)
- **충돌 대상**: `spec/1-data-model.md §2.10 status_reason` 현행 4개 값 목록
- **상세**: DRAFT 1C는 `credentials_unreadable` 을 "본 개정 범위 외이나 §10.4/data-flow §3.2에 동시 명시"로 처리한다. DRAFT 3B는 data-flow §3.2에 `error` status_reason으로 추가한다. 그러나 DRAFT 1C의 `spec/1-data-model.md §2.10 status_reason` 패치 본문이 실제로 `credentials_unreadable`을 명시적으로 포함하는지 draft 텍스트에서 확인되지 않는다 (해당 diff에서 `error` 라인 열거가 명시되지 않음).
- **제안**: DRAFT 1C 적용 후 `spec/1-data-model.md §2.10 status_reason` 컬럼 정의에서 `error` 케이스 목록에 `credentials_unreadable` 이 실제로 포함되는지 최종 결과 텍스트를 확인하고, 누락 시 명시적으로 추가.

---

### [INFO] `spec/0-overview.md` Cafe24 상태 설명 미갱신

- **target 위치**: "영향받는 연관 문서" 목록
- **충돌 대상**: `spec/0-overview.md §6.3 로드맵` — "spec 완료(2026-05-13)"
- **상세**: 본 draft 적용 후 Cafe24 spec이 2026-05-14에 재정비되므로 "spec 완료(2026-05-13)" 표기가 구식이 된다.
- **제안**: 적용 후 `spec/0-overview.md §6.3` Cafe24 행에 "(2026-05-14 추가 갱신 — pending_install 흐름 정비, install_token App URL 도입)" 병기.

---

## 요약

Draft 내 **CRITICAL 위배 2건**이 확인되었다. 첫째, `resource_not_found`가 status_reason 컬럼에 저장 가능한지에 대해 DRAFT 1C·2G("저장 불가")와 DRAFT 3B·2D("목록에 포함")가 직접 모순된다. 둘째, `connected` 재인증 실패 시 status 전이에 대해 §10.4 표(`error(auth_failed)`)와 §10.2 step 6("connected 유지")이 공존 불가능하다. 두 건 모두 해소하지 않으면 개발자가 서로 다른 동작을 구현하게 되어 spec-code divergence가 발생한다. WARNING 2건(BullMQ 하위 호환, §2.3 필터 칩 미갱신)은 구현 사고를 유발할 수 있어 보완을 권장한다. INFO 3건은 추적성·명확성 보완 사항이다.

## 위험도

**HIGH**

> CRITICAL 2건이 해소되기 전까지 spec write 및 구현 착수를 **차단**한다.