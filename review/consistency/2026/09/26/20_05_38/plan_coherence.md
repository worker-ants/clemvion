# Plan 정합성 검토 — request-body-guard (swagger.md §5-4 요청 본문 스키마 가드)

## 발견사항

- **[INFO]** 트래커 항목의 판정 축 표기(«AST»)가 이미 알려진 대로 아직 미정정
  - target 위치: 해당 없음 (target 문서 `spec/conventions/swagger.md` 자체는 frontmatter `code:` 주석과 §Rationale 본문 모두 "reflection" 으로 정확히 기술함 — 예: `# §5-4 의 요청 본문 스키마 — ... (reflection, 대조군은 spec 안의 클래스)`, `### §5-4 요청 본문 스키마 — 왜 클래스로 받게 강제하지 않고, 왜 reflection 으로 세는가`)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:5150` 트래커 항목 2 — "가드(developer): **AST** — `@Body()` 파라미터 타입이 클래스 참조가 아니면 같은 메서드에 `@ApiBody` 가 있어야 한다"
  - 상세: 실제 구현·target spec 문서는 AST 가 아니라 reflection(`design:paramtypes`)으로 판정한다(이유: `interface`/타입 별칭 참조가 런타임에 `Object` 로 지워져 AST 로는 클래스 참조와 구별 불가). 이 괴리는 이미 `--impl-prep`(`review/consistency/2026/09/26/19_09_17`)에서 INFO 로 지적됐고, `plan/in-progress/request-body-guard.md` 체크리스트 마지막 미완료 항목("트래커 항목 좁히기(남는 §1-7 · 리네임) · 닫힌 부분 기록")이 이 정정을 명시적으로 예정하고 있다. 즉 target 문서 자체는 이미 정확하고, 뒤처진 쪽은 **plan 트래커 서술**이며 그 정정은 같은 작업 계열 안에서 스스로 인지·예약돼 있다.
  - 제안: 새로운 조치 불요 — `request-body-guard.md` 체크리스트의 예정된 마지막 단계(트래커 항목 2의 "AST"→"reflection" 정정, 항목 1·2 를 닫고 §1-7 명명 + 3(어순 리네임)만 남기는 좁히기)를 이번 PR 마무리 커밋에서 수행하면 해소됨. 이 STATUS 는 그 단계가 **아직 실행되지 않은 시점**의 스냅샷임을 기록해 둔다.

- **[INFO]** §1-7 요청 DTO 명명 결정은 target 에서 의도적으로 보류 — 충돌 아님, 확인 사살
  - target 위치: `spec/conventions/swagger.md` §5-4 신규 체크리스트 항목(“문서 전용 DTO”라고만 하고 명명 패턴은 규정하지 않음)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:5147-5149`(트래커 항목 1 — "§1-7 표에 문서 전용(비검증) top-level 요청 DTO 의 `<Domain><Action>RequestDto` 행... 선례 `ExecuteWorkflowDto` 는 접미가 없다 — 규칙이 둘 중 하나로 정한다")와 `plan/in-progress/spec-draft-swagger-request-body.md`(“3 의 DTO 어순 리네임과 1 의 §1-7 명명 행은 남긴다”)
  - 상세: 트래커가 "결정 필요"로 남겨둔 명명 규칙(접미 유무)을 target 문서가 이번 변경에서 **내리지 않았다** — `spec-draft-swagger-request-body.md` Rationale 이 "두 결정을 섞지 않는다"고 명시적으로 범위를 좁혔고, 실제 target 본문도 그 경계를 지킨다. 미해결 결정을 일방적으로 확정하지도, 암묵적으로 선점하지도 않았다.
  - 제안: 조치 불요. 향후 §1-7 명명 결정 시 `ExecuteWorkflowDto`(접미 없음) 선례와 `ContinueExecutionRequestDto`(접미 있음, 어순 반대) 선례가 공존한다는 점만 그 결정 턴에서 다시 확인.

## 요약

`plan/in-progress/request-body-guard.md`(구현) + `plan/in-progress/spec-draft-swagger-request-body.md`(규칙)가 목표한 target 변경(`spec/conventions/swagger.md` §5-4 체크리스트 한 줄, frontmatter `code:` 등재, §Rationale 한 절)은 상위 트래커 `spec-draft-nullable-notation-followups.md:5141-5155` 의 항목 1·2 를 정확히 구현하며, 이미 확정된 인접 결정(`spec-sync-external-interaction-api-gaps.md:1937-1959` 의 `execute-body-dto` — 클래스 승격 대신 문서 전용 DTO + `@ApiBody` 유지)과 완전히 정합한다. `swagger.md` 를 참조하는 다른 in-progress plan(`eia-context-schema-followups.md`, `harness-review-gate-followups.md`, `spec-sync-user-profile-gaps.md`, `webchat-spec-rationale-followup.md`)은 §1-4/§1-1/§3/링크-포맷 등 무관한 절을 다뤄 이번 변경으로 무효화되거나 새 후속이 필요해지지 않는다. 유일한 잔여 항목은 이미 `request-body-guard.md` 자신의 체크리스트에 "트래커 항목 좁히기(§1-7·리네임만 남기고 AST→reflection 정정)"로 예약돼 있어, 이 검토 시점 이후 그 단계를 실행하면 트래커·target 간 표기 차이도 해소된다. 미해결 결정 우회·선행 plan 미해소·후속 누락 어느 것도 발견되지 않았다.

## 위험도
NONE
