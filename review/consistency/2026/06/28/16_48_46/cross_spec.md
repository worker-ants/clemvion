# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep`
구현 범위: autoRefresh attention 술어 제외 구현 (frontend `needsAttention` 가드 + backend `findAll` expiring/attention 쿼리에 `supportsTokenAutoRefresh` service_type 제외) + subLabel `'next in'` 문구 spec §4.1 정합
대상 spec: `spec/2-navigation/4-integration.md` §2.3 / §2.4 / §4.1 / §9.1 / §11.4

---

## 발견사항

### **[WARNING]** `supportsTokenAutoRefresh`(UI) 와 `isRefreshCapable`(스캐너) 의 google 포함 여부 비대칭

- **target 위치**: `spec/2-navigation/4-integration.md` §9.1 (autoRefresh DTO 정의), §11.4 (`NOT integration.autoRefresh` 술어)
- **충돌 대상**:
  - `spec/2-navigation/4-integration.md` §11.1 (`connected-expiry` 잡 `isRefreshCapable` 정의)
  - `spec/data-flow/8-notifications.md` §2.1 (`isRefreshCapable` = `service_type ∈ {cafe24, makeshop}` AND `credentials.refresh_token`)
  - `spec/data-flow/5-integration.md` §1.4 (`connected-expiry` 스캐너 흐름)
- **상세**:
  - `autoRefresh=true` (= `supportsTokenAutoRefresh`) 집합: `cafe24`, `google`, `makeshop` (§9.1, §1-data-model.md §2.10)
  - `isRefreshCapable` 집합: `service_type ∈ {cafe24, makeshop}` AND `credentials.refresh_token` (§11.1, data-flow §8 §2.1) — **google 미포함**
  - 결과: google 통합이 token 만료 임박 시 —
    - **UI 측 (이번 구현 대상)**: `autoRefresh=true` 이므로 `needsAttention` 가드가 expiring 분기에서 제외 → 배너·사이드바 카운트·Expiring 칩에 미표시
    - **스캐너 측**: `isRefreshCapable=false` 이므로 `connected-expiry` 잡이 7d/3d/0d 임계에서 passive `integration_expired` 알림 발사 + 0d 에서 `status=expired` 격하
  - 즉 google 통합이 만료 임박하면 UI 는 "autoRefresh 정상" 으로 무음 처리하지만 백엔드 스캐너는 알림 발사 + `expired` 격하를 수행한다. 두 시그널이 모순된 행동을 낳는다.
  - §10.3 provider 표에는 Google: Refresh ✓ 로 명시, §10.5 에도 "현재 `cafe24`, `google`" 이라 refresh 기능 자체는 명확하나, `isRefreshCapable` 정의에서 google 이 빠진 이유가 spec 어디에도 명문화되어 있지 않다.
- **제안**: 구현 착수 전 아래 두 방향 중 하나로 정책을 명확히 결정 후 spec 동기화 필요:
  - (A) google 도 `isRefreshCapable` 에 포함 → 스캐너가 google 만료 시 passive 알림 발사 중단·`expired` 격하 중단. `supportsTokenAutoRefresh`/`autoRefresh`/`isRefreshCapable` 집합 통일.
  - (B) google 은 `supportsTokenAutoRefresh=false` 로 격하 → UI attention 술어에서 google 제외 안 함. `isRefreshCapable` 현행 유지. (google 의 access_token 수명이 1시간이라 거짓 양성 위험 동일 존재 — 사실 확인 필요)
  - 현재 구현이 방향 (A) 로 진행하면 스캐너 쪽 `isRefreshCapable` 도 google 포함으로 동반 수정해야 하며, 그 변경은 backend scanner 구현 범위 밖이므로 별도 추적 필요.

---

### **[INFO]** Rationale 섹션의 `supportsTokenAutoRefresh` 열거에서 makeshop 미언급 (stale)

- **target 위치**: `spec/2-navigation/4-integration.md` Rationale "자동 갱신 통합을 attention 술어에서 제외" §1194 마지막 문장
- **충돌 대상**: 동일 문서 §9.1 (autoRefresh DTO 정의), `spec/1-data-model.md` §2.10 (autoRefresh 설명)
- **상세**: Rationale 문단이 "현재 `cafe24`/`google` 만 true" 라고 기술하나, spec 본문 §9.1 과 data-model §2.10 은 `cafe24`, `google`, `makeshop` 세 provider 를 true 로 명시하고 있다. makeshop 도입(C-6)으로 갱신된 본문과 Rationale 사이에 stale gap 이 존재.
- **제안**: Rationale 본 문장을 "현재 `cafe24` / `google` / `makeshop` 가 `true`" 로 갱신 (단순 동기화, 결정 변경 아님).

---

### **[INFO]** §4.1 subLabel 문구 `Auto-renews · next in <duration>` — 타 영역 참조 없음, 충돌 없음

- **target 위치**: `spec/2-navigation/4-integration.md` §4.1
- **상세**: `Auto-renews · next in <duration>` 표현은 본 spec 내에서만 정의되며 다른 spec 영역에서 이 문구를 상충되게 정의한 사례 없음. `<duration>` = `token_expires_at - NOW()` 의 사람 친화 표기 방침도 단일 spec SoT. 구현 측에서 duration 포맷(`1h 24m` 예시)만 일치시키면 된다.

---

## 요약

이번 구현 범위(`needsAttention` frontend 가드 + backend `findAll` expiring/attention 쿼리 제외 + subLabel `'next in'` 문구)의 spec 은 `spec/2-navigation/4-integration.md` §2.3/§2.4/§4.1/§9.1/§11.4 에 이미 결정·명문화되어 있어 구현 착수에 대부분 적합하다. 단 한 가지 잠재 충돌이 주의를 요구한다: `autoRefresh=true` 대상인 google 이 `isRefreshCapable`(스캐너/알림 레이어) 집합에는 포함되지 않아, UI attention 무음 처리와 백엔드 만료 알림·격하가 동시에 발생하는 비대칭 동작이 spec 레벨에서 미해소 상태다. 구현이 UI 측만 수정하면 이 비대칭은 오히려 사용자에게 더 가시화될 수 있다. 이 지점에 대한 정책 결정(google을 `isRefreshCapable`에 포함할지 여부) 을 먼저 확인한 뒤 착수하는 것이 안전하다. subLabel 및 나머지 attention 술어 제외 구현은 cross-spec 충돌 없이 진행 가능하다.

## 위험도

MEDIUM
