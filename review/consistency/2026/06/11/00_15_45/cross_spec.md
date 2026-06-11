## 발견사항

### [CRITICAL] spec/data-flow/8-notifications.md 의 `integration_expired` 발사 조건이 target 과 직접 모순

- **target 위치**: `spec/2-navigation/4-integration.md` §11 (connected-expiry 잡 설명), §11.2, 의사코드 블록
- **충돌 대상**: `spec/data-flow/8-notifications.md` §1.1 Type 별 source · 트리거 — `integration_expired` 행
- **상세**:
  - target(갱신 후): refresh-capable provider(`isRefreshCapable` = `service_type ∈ {cafe24, makeshop}` AND `credentials.refresh_token` 존재)는 `expired` 격하 및 passive `integration_expired` 알림 대상에서 **제외**. `remain ≤ 3d` / `≤ 7d` 알림도 refresh_token 없는 provider 만 발사.
  - `spec/data-flow/8-notifications.md` (미갱신): "후보 필터는 `status NOT IN (expired, error, pending_install) AND token_expires_at <= now+7d` 로 provider 의 refresh_token 유무를 가리지 않는다 — refresh_token 보유 provider (cafe24 등) 도 발사 대상이며, 0d 임계의 cafe24 분기는 `cafe24-token-refresh` 큐 enqueue 후에도 알림을 그대로 발사한다 (사용자 가시성 유지)"
  - 두 문서가 같은 스캐너(`IntegrationExpiryScanner`)의 동작을 정반대로 기술하고 있다. target 에서는 refresh-capable provider 가 7d/3d/0d 임계 알림을 모두 받지 않는다고 하고, notifications spec 에서는 모두 받는다고 한다. 두 영역 중 하나가 거짓이다.
- **제안**: `spec/data-flow/8-notifications.md` §1.1 의 `integration_expired` 행을 target 정의에 맞춰 갱신. "후보 필터에서 `isRefreshCapable` 행을 제외 (7d/3d/0d 임계 알림 모두 미발사)" 로 수정하고, "refresh_token 없는 provider 만 발사 대상" 임을 명시.

---

### [WARNING] spec/data-flow/5-integration.md `makeshop-token-refresh` 큐 항목에 해소된 구현 갭 주석 잔존

- **target 위치**: 직접 target 파일 변경 범위 밖이나 diff 의 대응 변경 대상
- **충돌 대상**: `spec/data-flow/5-integration.md` §2.2 큐 카탈로그 — `makeshop-token-refresh` 행, 괄호 주석 `단 §1.4 의 알려진 구현 갭 참조 — 스캐너 0d 격하 제외 분기도 아직 없음`
- **상세**:
  - 동일 파일 §1.4 (Rationale) 에 "2026-06-10 V-01·V-07 fix 로 해소" 라고 명시돼 있고, §1.4 표 자체도 `isRefreshCapable` 로 일반화됐다고 기술한다. 그러나 큐 카탈로그 항목의 괄호 주석은 아직 "갭 아직 없음" 상태로 남아 있어 §1.4 Rationale 및 target spec 과 모순된다.
  - 이 주석을 그대로 두면 해당 섹션을 처음 읽는 개발자가 makeshop 0d 분기가 미구현이라고 오해하고 중복 구현을 시도할 수 있다.
- **제안**: `spec/data-flow/5-integration.md` §2.2 `makeshop-token-refresh` 행의 "(단 §1.4 의 알려진 구현 갭 참조 — 스캐너 0d 격하 제외 분기도 아직 없음)" 주석을 삭제 또는 "해소됨 — §1.4 Rationale 참조" 로 교체.

---

### [WARNING] spec/4-nodes/4-integration/4-cafe24.md §8.6 buildTools expired 경로 설명이 target 변경과 미정합

- **target 위치**: `spec/2-navigation/4-integration.md` §11 의사코드 — refresh-capable 분기 구조 변경
- **충돌 대상**: `spec/4-nodes/4-integration/4-cafe24.md` §8.6 근거 단락
- **상세**:
  - cafe24 §8.6 에서 "§11.1 `connected-expiry` scanner 의 cafe24 분기 (refresh enqueue) 가 정상 동작하면 cafe24 가 `expired` 로 격하되는 경로는 사실상 `install_timeout` 한 가지만 남는다" 고 한다.
  - target spec 변경 후 이 설명은 여전히 맞지만, 같은 근거 단락이 "§11.1" 만 참조하고 있어 `isRefreshCapable` 개념(§11.1 의 `connected-expiry` 잡 표가 갱신됨)을 명확히 반영하지 않는다. 직접 모순은 아니지만 cross-reference 동기화가 필요하다.
  - 또한 cafe24 §9.2 `connected-expiry 일일 잡의 0d 분기` 설명이 "이전 `expired` 격하 분기 폐기" 라고 쓰여 있는데, target 의 갱신으로 이 문구는 여전히 유효하다. 충돌 없음.
- **제안**: cafe24 §8.6 근거 단락에서 "§11.1 cafe24 분기" 참조를 "§11.1 `isRefreshCapable` 분기"로 언급 업데이트를 권장 (INFO 급이나 `WARNING` 으로 두는 것은 §8.6 링크 텍스트가 "§11.1 connected-expiry scanner 의 cafe24 분기" 라는 구체 경로를 지칭해 혼란 여지가 있기 때문).

---

### [INFO] spec/data-flow/5-integration.md §3.4 상태 전이 — `expired` 경로 설명에서 refresh-capable 제외 조건이 cafe24 한정으로 기술됨

- **target 위치**: `spec/2-navigation/4-integration.md` §11 — `isRefreshCapable` = cafe24·makeshop 포함
- **충돌 대상**: `spec/data-flow/5-integration.md` §3.4 상태 전이 설명 — "`expired` 는 (a) 만료 스캐너 0d 격하 (refresh-capable cafe24 제외 — §1.4)"
- **상세**: "(refresh-capable cafe24 제외)" 로 표기돼 있어 makeshop 이 제외 대상임을 누락. target 과 §1.4 Rationale 은 모두 `isRefreshCapable` = cafe24·makeshop 이라고 명시한다. 기술적으로는 §1.4 cross-ref 가 있어 독자가 추적 가능하지만 해당 단락만 읽으면 오해할 수 있다.
- **제안**: `spec/data-flow/5-integration.md` §3.4 상태 전이 설명에서 "(refresh-capable cafe24 제외 — §1.4)" 를 "(refresh-capable provider 제외 — cafe24·makeshop, §1.4)" 로 수정.

---

## 요약

이번 diff 는 `spec/2-navigation/4-integration.md` §11 (`connected-expiry` 스캐너 잡) 의 refresh-capable provider 판별 범위를 cafe24 단일에서 `isRefreshCapable` (cafe24 + makeshop) 로 확장하고, 이에 따라 passive `integration_expired` 알림을 refresh_token 없는 provider 에만 발사하도록 정책을 변경했다. 핵심 문제는 `spec/data-flow/8-notifications.md §1.1` 의 `integration_expired` 발사 조건 설명이 갱신되지 않아 "refresh_token 보유 provider 도 발사 대상이며 cafe24 0d 분기도 알림을 발사한다" 는 구(舊) 정책을 여전히 기술하고 있다는 점이다. 이 두 문서는 같은 스캐너 로직에 대해 정반대 정의를 가지게 됐으며, 이는 CRITICAL 급 직접 모순이다. 추가로 `spec/data-flow/5-integration.md` 의 큐 카탈로그 주석 및 상태 전이 설명에 해소된 갭 주석과 cafe24-단일 제한 표기가 소규모로 잔존한다.

## 위험도

CRITICAL

STATUS: SUCCESS
