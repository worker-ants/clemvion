### 발견사항

- **[INFO]** WebSocket emit 표기 정정 — 기각 대안 재도입 위험 없음, 단 과거 표기 채택 근거 부재
  - target 위치: `spec/data-flow/8-notifications.md` § Rationale "WebSocket emit 표기 정정 — `notification.new` + `notifications:<userId>`"
  - 과거 결정 출처: 동일 문서 §4.6 (follow-up 단계의 `notification.read` / `notification.dismissed` 점 표기 명시) + `spec/5-system/6-websocket-protocol.md §4.4` (권위 표기)
  - 상세: 본 개정은 이전에 콜론 표기(`notification:new`, `user:<userId>`)가 사용된 **이유를 설명하지 않는다**. 잘못 기재된 오기였는지, 아니면 당시 의도적 결정이었다가 번복된 것인지가 Rationale에 서술되어 있지 않다. 단, 개정 자체는 프로토콜 권위 문서(`spec/5-system/6-websocket-protocol.md`)와 gateway 코드 정합을 근거로 삼고 있어 방향은 명확하다. 기각된 대안(콜론 표기 유지)이 명시적으로 폐기되지는 않았으나, 개정 사유가 "오기 정정"으로 서술되므로 새 Rationale이 추가될 필요는 낮다.
  - 제안: Rationale 항에 "이전 콜론 표기는 오기로서 의도적 설계 결정이 아니었다" 는 단 한 문장을 추가해 훗날 동일 표기가 재도입되는 것을 차단. 현재 서술만으로는 미래 검토자가 "이전 표기도 한때 채택된 결정"으로 오독할 여지가 있다.

- **[INFO]** dismiss 상태를 `active` 대신 `visible` 어휘로 표기 — 타 spec 문서와의 용어 정합 확인 필요
  - target 위치: §4.1 및 Rationale "어휘 선택 — `visible` / `dismissed`"
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale 전반 (`active`, `connected` 어휘가 integration 상태 기계에서 광범위하게 사용); `spec/0-overview.md §3.4 Inline Alert` (횡단 UI 패턴 SoT)
  - 상세: target 문서는 `active` 를 알림 dismiss 차원에 쓰지 않기로 결정하고 `visible` 을 채택했으며 그 근거(다른 엔티티의 `is_active` 컬럼과 혼동)를 Rationale에 명시했다. 이는 합리적이다. 다만 보조 코퍼스 내 통합·워크플로우 영역 spec에서 동일 어휘 충돌 가능성을 검토했는지는 본 문서만으로 확인 불가 — 타 spec이 알림 `visible` 상태를 직접 참조할 경우 의미 혼선이 생길 수 있다.
  - 제안: `spec/0-overview.md §3.4` 또는 알림 spec Rationale에 `visible` 어휘의 적용 범위를 "알림 dismiss 차원에 한정"임을 한 줄 명시.

- **[INFO]** `hasRecentByResource` 헬퍼의 dismissed row 포함 결정 — `integration_action_required` 타입 신설 언급과의 선후 관계 불명
  - target 위치: §4.4 + Rationale "중복 방지에 dismissed row 포함"
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` § "install_timeout 알림 미발사" / "refresh 실패 시 status_reason 통일" — `integration_action_required` 신설을 "향후 검토 대상"으로 남김
  - 상세: target 문서는 `integration_action_required` 타입을 향후 신설할 수 있다고 언급하면서, `hasRecentByResource` 가 dismissed row 도 카운트한다고 명시했다. 이 두 결정은 정합적이나, `integration_action_required` 가 실제로 신설될 때 24h 중복 방지 정책이 dismissed row 포함 여부를 재검토 없이 그대로 상속하게 된다. 현재 Rationale에 "신설 시에도 동일 정책 적용" 이라는 선제 명시가 없다.
  - 제안: "향후 별도 옵션으로 분리하지 않는다" 문장 다음에 "신규 알림 타입(`integration_action_required` 등)도 같은 헬퍼를 공유하며 dismissed row 포함 정책을 그대로 적용한다" 를 추가해 미래 오해 방지.

### 요약

`spec/data-flow/8-notifications.md` 의 이번 개정 (WebSocket emit 표기 정정 + dismiss 흐름 전체 + 중복 방지 정책)은 기존 Rationale에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant를 위반하는 패턴이 발견되지 않는다. Hard delete 기각·`is_deleted` BOOLEAN 기각·별도 `notification_dismissals` 테이블 기각·`DELETE` HTTP 동사 기각 등 주요 폐기 결정은 모두 target 문서의 Rationale에 명시되어 있고, 보조 코퍼스(특히 `spec/2-navigation/4-integration.md`)의 설계 원칙(DB Enum 비확장, 영속 상태와 화면 술어 분리, soft delete 보존)과도 방향이 일치한다. 발견된 세 항목은 모두 INFO 등급으로, Rationale 서술의 완성도를 높이는 보완 제안이다.

### 위험도

NONE
