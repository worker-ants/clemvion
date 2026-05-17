# Rationale 연속성 검토 결과

## 발견사항

- **[INFO]** `autoRefresh` 플래그 도입이 `pending_install 은 필터 칩에 추가하지 않는다` Rationale 과 동일 원칙 계보에 있음을 명시적으로 연결하고 있음 — 적절한 연속성 확보
  - target 위치: `plan/in-progress/spec-draft-integration-autorefresh.md` §4.10 Rationale 추가 항목 ("과거 결정과의 호환" 단락)
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "pending_install 은 필터 칩에 추가하지 않는다 (2026-05-14)"
  - 상세: target 의 Rationale 신규 항목은 "과거 결정과의 호환" 단락에서 이 Rationale 을 명시적으로 인용하며 같은 원칙의 연장선으로 정의하고 있다. 이는 연속성 유지를 올바르게 수행한 사례다.
  - 제안: 현행 기술이 충분하나, `pending_install 은 필터 칩에 추가하지 않는다` 의 핵심 문구("사용자 액션 불필요한 정상 운영 상태를 attention 에서 빼는 것")를 직접 인용하는 형태로 한 줄 더 명문화하면 미래 검토 시 맥락을 더 빠르게 추적할 수 있다.

- **[INFO]** `Attention 가상 필터값` Rationale 의 "DB Enum 비확장" 원칙과 target 의 `autoRefresh` derived 필드 설계 간 연관이 명시됨 — 적절
  - target 위치: §4.10 Rationale 추가 항목 ("과거 결정과의 호환" 단락) + §5 의사결정 표 ("`autoRefresh` 를 derived 필드로 노출 vs DB 컬럼 추가" 행)
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "Attention 가상 필터값 — Expired ∪ Expiring ∪ Error 를 단일 칩으로 노출 (2026-05-16)" — "DB 엔티티 비확장: 가상값을 위해 Enum 을 늘리지 않는다 — 영속 상태와 화면 술어를 섞으면 state machine(§6) 이 비대해진다"
  - 상세: target 의 `autoRefresh` 는 DB 컬럼이 아닌 derived 필드로 설계되었고, §4.10 Rationale 이 "DB 컬럼이 아니며 영속화하지 않고 코드 한 곳에서 결정"이라는 근거를 명시하고 있다. 과거 "DB 엔티티 비확장" 원칙과 직접적으로 호환된다.
  - 제안: §4.10 의 "과거 결정과의 호환" 단락이 "DB Enum 비확장" 원칙만 언급하고 있는데, 과거 Rationale 의 핵심 표현("영속 상태와 화면 술어를 섞으면 state machine 이 비대해진다") 을 직접 참조 링크 또는 인용으로 보강하면 연속성 추적이 더욱 명확해진다.

- **[INFO]** `autoRefresh=true` 통합의 `Reauthorize` 버튼 처리 방식이 §4.3 Security 탭 비활성 조건 (기존 결정)과 부분적으로 다른 접근을 취하고 있으나 신규 Rationale 에서 명시적으로 차별화하고 있음
  - target 위치: `plan/in-progress/spec-draft-integration-autorefresh.md` §4.5 패치 (§4.2 Overview Quick actions 행) 및 §4.10 Rationale 참조 주석
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` §4.2 Quick actions — `Reauthorize` 비활성 조건 (기존 표: `pending_install` 또는 cafe24 private 에서 비활성)
  - 상세: target 은 `autoRefresh=true && status='connected'` 인 경우 `Reauthorize` 버튼을 비활성이 아닌 "활성 상태 + hover 안내" 로 처리하도록 제안한다 (§4.5 After 텍스트: "버튼은 활성 상태로 두되 hover 시 'Auto-renewing — manual reauthorization unnecessary' 안내"). 기존 spec 에서 비활성 조건이 `pending_install` 또는 cafe24 private 인 것과 결이 다르나, target 은 이 차이를 명시적으로 기술하고 있다 (§4.5 마지막 note: "autoRefresh=true 라도 사용자가 명시적으로 재인증을 시도할 권한 자체는 유지 — 예: scope 정리 후 재발급"). 이것은 번복이 아닌 의도된 구분이며 근거도 inline 으로 제시되어 있다.
  - 제안: §4.10 Rationale 신규 항목에 이 결정을 한 줄 더 명시화하면 좋다 — "Reauthorize 버튼 비활성 불필요: `autoRefresh=true` 통합도 scope 변경 등 사용자 명시 의도의 재인증 가치가 있어 버튼 비활성보다 hover 안내로 처리 (기존 `pending_install`/`cafe24 private` 비활성 원칙 — 재인증 진입점 자체가 없는 경우 — 과 다른 사유)." 라는 한 줄 근거를 추가하는 것을 권장한다.

- **[INFO]** `cafe24-background-refresh` 10일 임계 및 BullMQ dedup Rationale 과의 연관성 — target 이 "자동 갱신 통합의 실패 신호 보전" 단락에서 `error(auth_failed)` / `error(network)` 전이를 언급하나, 이 전이들이 정확히 어느 Rationale 에서 결정된 것인지 참조가 약함
  - target 위치: §4.10 Rationale 추가 항목 ("자동 갱신 통합의 실패 신호 보전" 단락)
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "refresh 실패 시 status_reason 통일 (2026-05-16)" 및 Rationale "BullMQ `cafe24-token-refresh` 큐 — 멀티 인스턴스 race 해소 (2026-05-16)"
  - 상세: target §4.10 의 "자동 갱신 통합의 실패 신호 보전" 단락은 `error(auth_failed)` / `error(network)` 전이 및 `§11.2 integration_action_required 알림` 을 언급하나, 이 결정들이 정확히 어느 Rationale 항에서 정의되었는지 참조 링크가 없다. 내용 자체는 기존 결정과 일관되나 추적성이 약하다.
  - 제안: "자동 갱신 통합의 실패 신호 보전" 단락 끝에 `(Rationale "refresh 실패 시 status_reason 통일 (2026-05-16)" 및 §10.5 참고)` 형태의 참조를 추가하면 미래 검토자가 결정 근거를 빠르게 추적할 수 있다.

### 요약

target 문서(`plan/in-progress/spec-draft-integration-autorefresh.md`) 는 기존 `spec/2-navigation/4-integration.md` 의 Rationale 에서 확립된 설계 원칙들 — "DB Enum 비확장", "영속 상태와 화면 술어 분리", "사용자 액션 불필요한 정상 운영 상태를 attention 에서 제외", "가상 필터값 이름 분리" — 을 명시적으로 인용하고 그 연장선상에서 `autoRefresh` 파생 식별자를 도입하고 있다. 기각된 대안(DB 컬럼 추가, `service_type` 직접 SQL 비교)에 대해서도 §5 의사결정 표에서 폐기 사유를 명문화하고 있다. 기존 Rationale 에서 명시적으로 기각된 어떤 대안도 이유 없이 재도입되지 않았으며, 합의된 invariant(`pending_install` 필터 제외, DB Enum 비확장, `error(auth_failed)` 전이 신호 보전)가 모두 존중되고 있다. Reauthorize 버튼 처리 방식에서 기존 "비활성" 원칙과 약간 다른 접근(활성 + hover 안내)을 취하나 목적과 근거를 inline 으로 충분히 설명하고 있어 무근거 번복으로 보기 어렵다. 전반적으로 Rationale 연속성 측면에서 양호하며, INFO 등급 제안만 확인된다.

### 위험도

NONE
