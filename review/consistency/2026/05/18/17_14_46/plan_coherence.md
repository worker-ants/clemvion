### 발견사항

- **[INFO]** `cafe24-backlog-residual.md` F-2 — §6 mermaid `install_token` 보존 정책 명시 미완료
  - target 위치: `spec/2-navigation/4-integration.md §6` 상태 전이 다이어그램
  - 관련 plan: `plan/in-progress/cafe24-backlog-residual.md` §F-2 (`[ ]` 미체크)
  - 상세: target 문서의 §6 상태 전이 다이어그램에는 `install_token` 보존 정책(callback 성공 시 NULL 처리 안 함 — post-install navigation 식별 키로 계속 사용)이 텍스트 본문(§6 표 비고)에는 서술되어 있으나, 시각적 mermaid 다이어그램 자체에는 보존 정책이 명기되어 있지 않다. F-2 는 이 갭을 별도 처리로 예약해 두었다. target 문서는 F-2 가 요구하는 변경을 일방적으로 해결하지 않아 충돌은 없으나, 미완 항목임을 추적할 필요가 있다. 추가로 F-2 에는 "cafe24-restricted-scopes-a1b2c3 PR 머지 후 착수 권장" 조건이 붙어 있다 — 해당 PR 의 머지 상태 확인이 선행 필요.
  - 제안: target 문서에는 수정 불필요. `cafe24-backlog-residual.md` F-2 의 선행 조건(restricted-scopes PR 머지 여부) 을 확인 후 별도 worktree 에서 §6 다이어그램 보강 진행.

- **[INFO]** `spec-draft-notification-dismiss.md` — §11.2 dismiss 관계 한 줄 수정 예정
  - target 위치: `spec/2-navigation/4-integration.md §11.2` 중복 방지(`hasRecentByResource`) 설명
  - 관련 plan: `plan/in-progress/spec-draft-notification-dismiss.md` "변경 대상 spec" §4 (`[ ]` 미체크)
  - 상세: `spec-draft-notification-dismiss.md` 는 `spec/2-navigation/4-integration.md §11.2` 에 "중복 방지 ↔ dismiss 관계 명시" 한 줄을 추가할 계획이다. target 문서 §11.2 의 "중복 방지" 항목 끝에 이미 알림 dismiss(`dismissed_at`) 와 dedup 키 리셋의 관계를 설명하는 인라인 주석이 작성되어 있다. 두 변경 의도가 동일 지점을 건드릴 가능성이 있으나, notification-dismiss 계획의 변경 범위가 "한 줄"로 좁혀진 데다 내용 충돌 가능성은 낮다. 다만 target 문서가 §11.2 에 이미 dismiss 관계 내용을 포함하고 있다면 spec-draft-notification-dismiss plan 의 해당 항목이 자동 해소될 수 있어 체크 필요.
  - 제안: target 문서에 수정 불필요. `spec-draft-notification-dismiss.md` 진입 시 §11.2 의 현행 텍스트(`dismissed_at` 관련 주석 유무)를 확인해 해당 체크박스를 already-resolved 로 처리하거나 남겨 둘지 판단할 것.

- **[INFO]** `spec-overview-ui-patterns-followup-2026-05-16.md` — §4.4 inline alert 패턴 참조 미완
  - target 위치: `spec/2-navigation/4-integration.md §4.4 Scope & Permissions 탭`
  - 관련 plan: `plan/in-progress/spec-overview-ui-patterns-followup-2026-05-16.md` (`[ ]` 미체크)
  - 상세: 해당 plan 은 `spec/0-overview.md §3.4` 또는 `spec/2-navigation/_layout.md` 에 "Inline Alert" 패턴을 정의하고, target 문서 §4.4 가 이를 참조하도록 갱신할 예정이다. 현재 target 문서 §4.4 는 inline alert 패턴을 자체적으로 상세 서술하고 있어(amber 톤, 영구 표시, toast 와 역할 분리 등), 패턴 정의 위치가 결정되면 해당 서술을 참조 방식으로 축약하는 편집이 필요할 수 있다. 이는 미래 편집 예고이며 현시점 충돌은 없다.
  - 제안: target 문서에 현시점 수정 불필요. `spec-overview-ui-patterns-followup-2026-05-16.md` 진입 시 §4.4 서술과 패턴 정의 내용이 일치하는지 확인 후 참조 방식으로 리팩터링.

- **[INFO]** `cafe24-oauth-invalid-scope-handler.md` — §10.4 invalid_scope 분기 backend 미구현 상태
  - target 위치: `spec/2-navigation/4-integration.md §10.4` Cafe24 `invalid_scope` 에러 매핑 행
  - 관련 plan: `plan/in-progress/cafe24-oauth-invalid-scope-handler.md` (작업 항목 `[ ]` 미체크)
  - 상세: target 문서 §10.4 에는 Cafe24 `invalid_scope` 에러 매핑 행이 이미 정의되어 있다 (`status_reason='oauth_invalid_scope'`, `last_error.details.requiresCafe24Approval`, frontend 분기 메시지 등). `cafe24-oauth-invalid-scope-handler.md` plan 은 이 spec 정의를 backend (`handleCallback` 의 `query.error` 분기 확장)로 구현할 예정이다. target 이 spec 을 이미 완성해 두었고 backend 구현이 뒤따를 예정이므로 SDD 순서상 정상. 충돌은 없으나 추적 목적으로 기록.
  - 제안: 현 상태 유지. `cafe24-oauth-invalid-scope-handler.md` 착수 시 target 문서의 §10.4 정의와 backend 구현이 정합한지 재확인.

- **[INFO]** `integration-token-ui-autorefresh.md` (complete) — autoRefresh 구현 PR 미완료 체크박스 잔존
  - target 위치: `spec/2-navigation/4-integration.md §9.1 autoRefresh: boolean` 파생 필드 정의, §2.3·§2.4·§4.1·§4.2·§11.4 의 autoRefresh 술어
  - 관련 plan: `plan/complete/integration-token-ui-autorefresh.md` (체크박스 `[ ]` 다수 미완료 상태로 `complete/` 에 위치)
  - 상세: `integration-token-ui-autorefresh.md` 는 `plan/complete/` 에 위치하지만 체크리스트 항목("DOCUMENTATION 영향 매핑 확인", "백엔드 service-registry 필드 + DTO + toPublic + 단위 테스트", "프론트엔드 status-badge 분기 + StatusBadge + 단위 테스트", "상세 페이지 InfoRow tooltip + 헤더 subLabel + Overview 표기", "i18n ko/en 키", "TEST WORKFLOW", "REVIEW WORKFLOW", "PR 생성 후 git mv") 이 `[ ]` 미체크 상태다. target 문서 §9.1 은 `autoRefresh: boolean` 파생 필드를 완전히 정의하고 있으며 `ServiceDefinition.supportsTokenAutoRefresh` 를 참조한다. 그런데 해당 plan 의 구현 체크리스트가 미완료라면 실제 service-registry 코드에 `supportsTokenAutoRefresh` 옵션이 추가되어 있는지, backend DTO 에 `autoRefresh` 필드가 실제로 있는지 확인이 필요하다. spec 이 구현보다 앞서 있는 SDD 드리프트 상태가 의도된 것인지, 아니면 plan 이동이 성급했는지 파악이 필요하다.
  - 제안: `plan/complete/integration-token-ui-autorefresh.md` 를 `plan/in-progress/` 로 되돌리거나, 체크리스트 실제 완료 여부를 검증해 미체크 항목을 닫을 것. CLAUDE.md 상 "미체크 체크박스가 하나라도 남아있으면 `in-progress/` 다" 규칙 적용 필요.

### 요약

target 문서 `spec/2-navigation/4-integration.md` 는 현재 세션(`cafe24-test-spec-guard-263221`)에서 §5.8 연결 테스트 엔드포인트 전환, §9.1 `pending_install` 가드 응답 형식, Rationale 두 항을 추가하는 spec 갱신 작업을 완료한 문서다. `plan/complete/spec-update-cafe24-test-connection.md` 에 2026-05-18 처리 완료가 기록되어 있으며, 본 consistency-check 는 해당 spec 갱신 이후 시점에 실행됐다. 진행 중인 plan 들과의 관계를 보면, `cafe24-backlog-residual.md` 의 F-2(§6 mermaid 보존 정책 명시), `spec-draft-notification-dismiss.md` 의 §11.2 한 줄 수정, `spec-overview-ui-patterns-followup-2026-05-16.md` 의 §4.4 inline alert 패턴 참조화, `cafe24-oauth-invalid-scope-handler.md` 의 §10.4 backend 구현 — 이 네 plan 이 향후 동일 파일을 건드릴 예정이나 각자 다른 절을 좁게 수정하는 비중첩 변경으로 현시점 CRITICAL 충돌은 없다. 다만 `plan/complete/integration-token-ui-autorefresh.md` 가 미완료 체크박스를 가진 채 `complete/` 에 위치하는 규약 위반이 발견됐으며, 해당 plan 의 구현(service-registry `supportsTokenAutoRefresh` 추가, DTO `autoRefresh` 필드, frontend status-badge 분기) 이 실제로 완료되었는지 확인이 필요하다. 전체적으로 CRITICAL 등급 plan 충돌은 없고, WARNING 도 없으며 INFO 4건이 발견됐다.

### 위험도

LOW
