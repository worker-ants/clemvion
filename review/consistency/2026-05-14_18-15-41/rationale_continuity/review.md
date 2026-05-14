이제 충분한 정보를 수집했습니다. 분석을 완료하겠습니다.

---

## 발견사항

### [INFO] §9.8 "식별 전략" invariant 번복 — install_token 기반으로 교체
- **target 위치**: DRAFT 2J-2 (§9.8 식별 전략 단락 diff)
- **과거 결정 출처**: `spec/4-nodes/4-integration/4-cafe24.md:433` — "HMAC 이 `client_secret` 에 묶여 있어, 같은 `mall_id` 에 복수의 `pending_install` Integration 이 있어도 HMAC 검증을 통과한 것이 정확한 타깃이다." (2026-05-14 CHANGELOG 기록 포함)
- **상세**: 해당 문장은 mall_id 스캔 + trial HMAC 방식이 올바르다는 명시적 invariant였다. Draft는 이를 "폐기"로 처리하고 install_token 단일 조회로 대체한다.
- **평가**: DRAFT 2J-2가 명시적으로 "폐기" 표기 + DRAFT 2I "install_token을 App URL path 식별 키로 승격 (2026-05-14)" 에 W3 시나리오 + O(N) 비용 근거가 있음. DRAFT 2J-bis에 cross-reference 추가. 번복 acknowledgment 충분.

---

### [INFO] §9.2 `CAFE24_INSTALL_INVALID_HMAC(403)` — "정보 노출 방지" 보안 원칙 부분 번복
- **target 위치**: DRAFT 2E, 2F
- **과거 결정 출처**: `spec/2-navigation/4-integration.md:653` — "에러: `CAFE24_INSTALL_INVALID_HMAC`(403, pending 미발견 포함 — 정보 노출 방지)"
- **상세**: 기존 spec은 HMAC 불일치와 pending row 미발견 두 케이스를 동일 403으로 합산하는 이유를 명시적으로 "정보 노출 방지"로 기록했다. Draft는 이를 `CAFE24_INSTALL_INVALID_TOKEN(404)` / `CAFE24_INSTALL_INVALID_HMAC(403)` 으로 분리한다.
- **평가**: DRAFT 2I "CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제" 섹션에서 (a) 기존 합산 목적, (b) install_token의 추측 불가능성 근거, (c) **이 전제가 깨질 경우(토큰 길이 단축·PRNG 변경·노출 사고) 다시 403 통합** 조건을 명시. 보안 전제가 코드에 묶여있어 향후 install_token 생성 로직 변경 시 반드시 이 Rationale를 참조해야 한다는 점은 인식됨.

---

### [INFO] §6 상태 전이 — `pending_install → (삭제)` 자동 삭제 경로 번복
- **target 위치**: DRAFT 2D 및 다이어그램
- **과거 결정 출처**: `spec/2-navigation/4-integration.md §6` — 기존 상태 전이 다이어그램에 install timeout 자동 삭제 화살표 존재
- **상세**: 기존 설계는 install TTL 만료 시 pending_install 행을 자동 삭제했다. Draft는 이를 `→ expired (status_reason='install_timeout')`으로 변경하며 삭제는 manual delete만 허용.
- **평가**: Draft 내에 "> **번복 acknowledgment**: 기존 spec §6 의 `pending_install → (삭제)` ... 본 개정에서 제거"가 명시적으로 기록되고, DRAFT 2I "install_token TTL 24h" 첫 단락에 데이터 보존·감사 목적의 Rationale가 있음.

---

### [INFO] `OAuthState.mode='reauthorize'` — 초기 install에 재사용 결정
- **target 위치**: DRAFT 내 §1.2.1 시퀀스 다이어그램, §10.2 step 4 보강
- **과거 결정 출처**: 기존 spec에는 `pending_install` 행에 대한 callback 처리 mode가 명시되지 않았음 (기존 §9.4 step 5만 기술)
- **상세**: Draft가 `mode='reauthorize'`를 Cafe24 Private 초기 install에도 재사용하는 신규 결정을 내리고 있다.
- **평가**: DRAFT 2I "OAuthState.mode='reauthorize' 를 초기 install 에도 재사용한 이유 (2026-05-14)" 에서 (a) `mode='new'`와 차이점, (b) `mode='cafe24_private_install'` 대안 명시 기각 + 이유, (c) 향후 분리 조건을 모두 기록함.

---

### [INFO] `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 가드 — `pending_install` 중복 허용 정책 미명시
- **target 위치**: DRAFT 2F-bis
- **과거 결정 출처**: 기존 spec에 begin 단계 중복 가드 없음 (신규 결정)
- **상세**: 이 가드는 `connected` 케이스만 차단한다. 같은 `(workspaceId, mall_id, app_type='private')`의 `pending_install`이 이미 존재할 때 새 `begin`을 허용하는 정책은 "의도적 설계"이지만 spec 본문에 명시되지 않는다. DRAFT 2I Rationale는 connected race condition만 다루고 pending_install 중복 허용에 대한 근거 기록이 없다.
- **제안**: DRAFT 2F-bis 또는 DRAFT 2I Rationale의 해당 항목에 "pending_install 중복은 허용한다 — 각 행이 고유한 install_token을 가지므로 독립 추적되며, 오래된 pending 행은 TTL 24h로 자동 만료된다"는 한 줄을 추가.

---

## 요약

Draft가 도입하는 주요 3대 번복(mall_id 스캔 → install_token 식별, pending_install 자동 삭제 → expired 전이, HMAC 에러 코드 합산 → 분리)은 모두 draft 내에 명시적 acknowledgment 마커와 신규 `## Rationale` 항목이 동반된다. 기존 spec에 박혀있는 "정보 노출 방지" 보안 원칙과 "HMAC 식별 invariant"가 번복되지만 각각의 새 Rationale에서 전제 조건과 번복 근거가 충분히 서술되어 있다. 단 하나의 미명시 갭으로, `pending_install` 중복 허용 정책이 Rationale에 기록되지 않아 향후 유지보수자가 "의도된 설계인지" 판단하기 어려울 수 있다.

## 위험도

**LOW**