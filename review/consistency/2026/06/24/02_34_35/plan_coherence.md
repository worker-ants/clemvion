# Plan 정합성 검토 결과

## 발견사항

### [WARNING] 외형 서버 저장 결정 — spec-draft 의 "미저장" 정책과 `5-admin-console.md` R2 번복의 plan 내 추적 미흡
- **target 위치**: `spec/7-channel-web-chat/5-admin-console.md §R2` ("외형 per-instance 서버 저장 — 기존 '미저장' 결정의 부분 번복, 결정 2026-06-24"), `spec/7-channel-web-chat/_product-overview.md §2 비목표` 단서 문단
- **관련 plan**: `plan/in-progress/spec-draft-web-chat-console.md §1.2` ("외형은 boot 옵션으로만 — 비목표와의 정합")
- **상세**: `spec-draft-web-chat-console.md §1.2` 는 "백엔드는 외형을 저장하지 않는다"를 명시적 설계 결정으로 기록했다. 그러나 target(`5-admin-console.md R2`)는 이 결정을 같은 날(2026-06-24) **부분 번복**해 per-instance 서버 저장을 v1 범위로 포함했다. 번복 자체는 `web-chat-console.md` phase 기록에는 반영(Phase 2/3에 `sanitizeDraft` 언급, PATCH 트리거 구현 포함)되어 있지만, `spec-draft-web-chat-console.md` 의 "비목표 정합" 섹션이 번복 이전 상태 그대로 남아 있다. plan 이 spec draft 의 SoT 역할을 하는 구조이므로, 후속 개발자가 draft 를 읽으면 "서버 미저장" 방향으로 오해할 수 있다.
- **제안**: `plan/in-progress/spec-draft-web-chat-console.md §1.2` 에 "2026-06-24 번복 — per-instance 서버 저장이 v1 에 포함됨. 상세 5-admin-console R2" 한 줄을 추가하거나, spec-draft 를 최신 결정과 정합하도록 갱신한다. 또는 draft 를 "완료된 이전 단계 기록"으로 명시하여 혼동을 방지한다.

### [INFO] `web-chat-console.md` Phase 3 e2e 보류 → 이후 통과 — plan 체크리스트 상태 불일치
- **target 위치**: `spec/7-channel-web-chat/5-admin-console.md §6`, `spec/7-channel-web-chat/0-architecture.md`
- **관련 plan**: `plan/in-progress/web-chat-console.md` Phase 3 ("e2e 는 docker/풀스택 의존 — 환경 차단(DeadlineExceeded) 으로 보류"), Phase 4 ("e2e 통과 — 재시도 시 PASS, 214 tests")
- **상세**: plan Phase 3 의 unit 테스트 체크박스는 완료이지만 마지막 줄에 "e2e 는 docker/풀스택 의존이라 비검증"으로 보류를 명기했고, Phase 4 에서 PASS 로 최종 확인됐다. 이 이력이 Phase 3 체크박스에 갱신되지 않아 체크리스트만 보면 e2e 미검증 상태처럼 보인다. target spec 과의 직접 충돌은 아니나, plan 의 상태 추적 명확성 차원에서 Phase 3 보류 주석에 "→ Phase 4 에서 PASS 확인" 메모를 추가하면 좋다.
- **제안**: plan 에서만 정리 필요. target spec 변경 불요.

### [INFO] `channel-web-chat-followups.md` 가 spec/7 의 `pending_plans` 에 계속 등재 — 실질 활성 TODO 0건인데 in-progress 유지
- **target 위치**: `spec/7-channel-web-chat/0-architecture.md` frontmatter `pending_plans`, `spec/7-channel-web-chat/1-widget-app.md` frontmatter, `spec/7-channel-web-chat/3-auth-session.md` frontmatter, `spec/7-channel-web-chat/4-security.md` frontmatter
- **관련 plan**: `plan/in-progress/channel-web-chat-followups.md` ("잔여 항목은 전부 보류 — 활성 TODO 0건")
- **상세**: `channel-web-chat-followups.md` 자체가 "활성 TODO 0건, 신규 필요가 생기면 재개"라고 명시했으나, 해당 plan 은 `plan-lifecycle` 규칙상 미완 surface 가 있으면 `complete/` 이동 불가(spec pending_plans 참조 대상)라 in-progress 에 잔류 중이다. target spec 의 해당 pending_plans 참조는 따라서 구조적으로 정합한다. 다만, 미해결 결정(deferred backlog)이 있는 plan 이 spec `pending_plans` 에 남아 있음으로써 "아직 뭔가 결정이 필요하다"는 신호를 줄 수 있다. target 변경이 이 backlog 항목 중 어느 것과도 충돌하지 않으므로 CRITICAL/WARNING 수준은 아니다.
- **제안**: 현재 상태로 허용 가능. target spec 변경 불요.

## 요약

검토 대상(`spec/7-channel-web-chat/`)은 `plan/in-progress/web-chat-console.md` 의 모든 Phase 가 완료 표시된 상태에서의 최종 spec 형태다. 미해결 결정과의 충돌은 없으며, 선행 plan 에서 요구하는 선결 조건(EIA 배선, eager-start, embed-config soft 검증 등)도 target 이 모두 해소된 것으로 기술하고 있어 선행 미해소 문제는 없다. 유일한 실질적 gap 은 `spec-draft-web-chat-console.md §1.2` 에 기록된 "외형 백엔드 미저장" 설계 원칙과 `5-admin-console R2` 의 2026-06-24 번복 결정이 draft 에 역반영되지 않은 것으로, draft 를 참조할 개발자에게 혼선을 줄 수 있다. 이는 plan 측 갱신으로 해소되는 WARNING 수준이다. 나머지는 plan 이력 추적 명확성에 관한 INFO 수준이다.

## 위험도

LOW
