핵심 데이터를 확보했습니다. 기존 spec의 §6 상태 전이 다이어그램과 draft 변경 사항을 비교합니다.

---

### 발견사항

- **[WARNING] — `install timeout` 처리 방식 번복, Rationale 내 명시적 acknowledgment 부재**
  - target 위치: `DRAFT 2D` §6 상태 전이 표, `DRAFT 2I` "install_token TTL 24h" Rationale
  - 과거 결정 출처: `spec/2-navigation/4-integration.md:565` (현재 spec)
  - 상세: 현행 spec은 `└── install timeout / manual delete ──▶ (삭제)` 로 TTL 만료 시 **행 삭제**를 명시한다. Draft 2D는 이를 `pending_install → expired (statusReason='install_timeout')` 으로 전환해 **보존**한다. Rationale(2I)는 "데이터 분석·감사 목적의 보존"이라는 이유를 적절히 제시하지만, "기존 spec은 install timeout 시 삭제를 명시했으며, 본 Rationale로 그 결정을 번복한다"는 문장이 없어 의도적 번복인지 누락인지 불분명하다.
  - 제안: Rationale "install_token TTL 24h" 항목 첫 단락에 "기존 spec(§6 다이어그램)은 `install timeout / manual delete → (삭제)` 를 단일 전이로 정의했다. 본 개정에서 TTL 만료를 `expired` 전이로 분리하고 행을 삭제하지 않도록 번복한다 — 이유: …" 한 문장을 추가할 것.

- **[WARNING] — `install_timeout` 으로 `expired` 된 행에서 reauthorize UI 상태 미명시**
  - target 위치: `DRAFT 2D` 전이 표 `pending_install → expired` 행, `DRAFT 2A` 더보기(⋮) 메뉴 정의
  - 과거 결정 출처: `spec/2-navigation/4-integration.md §6` 전이 표 — `expired/error → connected` 를 `reauthorize` 또는 `rotate` 성공으로 정의
  - 상세: Draft 2D는 전이 표에 "expired 행에서 reauthorize 흐름 (단 private 앱은 reauthorize 불가 → 권장: 삭제 후 재등록)"이라는 주석을 달았다. 그러나 `install_timeout` 으로 `expired` 된 Cafe24 Private 행은 사실상 `reauthorize` 액션이 불가(Private 앱 특성)함에도, §2.2 더보기(⋮) 메뉴 정의(2A)에서 `expired` 상태의 `reauthorize` 버튼 활성/비활성 규칙을 `install_timeout` case에 대해 명시하지 않는다. 기존 spec의 "expired → reauthorize → connected" 흐름과 충돌하는 예외 케이스다.
  - 제안: §2.2 더보기(⋮) 정의 또는 §6 노트에 "`status_reason='install_timeout'` 인 expired 행에서는 reauthorize 버튼을 비활성화한다 (Private 앱 재인증 진입점 없음)"를 명시할 것.

- **[INFO] — `credentials_unreadable` status_reason 도입 배경 부재**
  - target 위치: `DRAFT 1C` status_reason 표 `error` 행
  - 과거 결정 출처: `spec/data-flow/integration.md` status_reason 표 — `error` 후보로 `insufficient_scope / auth_failed / network / unknown` 4종만 존재
  - 상세: `credentials_unreadable` 가 신규 추가되지만 언제, 어떤 시나리오에서 발급되는지 설명이 없다. 에러 코드 목록(§9.4)에도 없어 구현자가 판단 불가.
  - 제안: 1C 또는 §9.4 에러 코드 목록에 `credentials_unreadable` 의 발급 조건(예: 암호화된 credentials 복호화 실패)을 한 줄 추가할 것.

- **[INFO] — `/oauth/install/cafe24` 구 경로 영구 폐기 plan 추적 수단 미명시**
  - target 위치: `DRAFT 2E` Deprecated 행 끝 "영구 폐기 시점은 별도 plan"
  - 상세: 폐기 시점을 뒤로 미루는 것 자체는 합리적이나, "별도 plan"의 파일명이나 위치가 명시되지 않아 후속 관리가 누락될 가능성이 있다.
  - 제안: "영구 폐기 시점은 `plan/in-progress/cafe24-pending-polish.md` 에 후속 항목으로 추가" 등으로 추적 경로를 명시할 것.

- **[INFO] — `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 고유성 조건의 DB 인덱스 반영 여부 불명확**
  - target 위치: `DRAFT 2F` 에러 코드, `DRAFT 3D` Postgres schema 매핑
  - 상세: `(workspaceId, mall_id, app_type='private')` 기준으로 `connected` Integration 중복을 막는 에러 코드를 추가했으나, 이 고유성을 DB 유니크 인덱스로 강제할지 애플리케이션 레벨 체크로만 유지할지 언급이 없다. 동시 요청 경쟁 조건(race condition)에서 앱 레벨 체크만으로는 중복이 슬며시 삽입될 수 있다.
  - 제안: `DRAFT 1D` 또는 `3D`에 "app-level check only, DB 유니크 인덱스는 미도입 (이유: 운영 부하 데이터 부재 — 1D와 동일 판단)" 또는 "DB 유니크 인덱스 V043 추가" 중 하나를 명시할 것.

---

### 요약

제공된 Rationale 발췌(데이터모델의 ExecutionNodeLog, 워크플로우 목록, 사용자 프로필, AI 어시스턴트)는 모두 Cafe24 통합 설치 흐름과 영역이 달라 **명시적으로 기각된 대안의 재도입은 발견되지 않았다.** draft가 자체 신설하는 `## Rationale`(DRAFT 2I)의 세 항목은 적절히 작성되어 있다. 다만 현행 `spec/2-navigation/4-integration.md:565` 에 명시된 `install timeout → 삭제` 결정을 `install timeout → expired` 로 뒤집으면서 Rationale 안에서 이 번복 사실을 직접 언급하지 않는 것이 가장 중요한 약점이다. `expired (install_timeout)` 에서 reauthorize UI의 비활성 처리 규칙 누락도 구현 단계에서 혼란을 줄 수 있다.

### 위험도

**LOW** (CRITICAL·CRITICAL이 없으며, WARNING 2건은 모두 Rationale 보완으로 해소 가능)