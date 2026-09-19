# Plan 정합성 검토 — spec/2-navigation/ (--impl-prep, 대상 작업: connection-test-codes-and-gaps.md)

## 조사 방법
번들 프롬프트(`_prompts/plan_coherence.md`)는 `spec/2-navigation/1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md` 는 전문을 실었으나, 정작 이번 developer 작업(`plan/in-progress/connection-test-codes-and-gaps.md`, worktree `tester-codes-4b9e17`)이 건드리는 코드(`modules/integrations/**`)의 소유 spec 인 `4-integration.md`(원문 161,645자)는 "컨텍스트 예산 초과로 절단"됐다. 이 절단분은 `Read`/`grep` 으로 저장소에서 직접 열어 보정했다.

## 발견사항

- **[INFO] 이번 런이 harness-review-gate-followups.md 의 미해결 결함(tail-drop 절단)을 다시 재현했다**
  - target 위치: 번들 §"컨텍스트 예산 초과로 생략된 파일 15개" — `spec/2-navigation/4-integration.md` 가 첫 항목으로 생략됨
  - 관련 plan: `plan/in-progress/harness-review-gate-followups.md` §"승격은 됐는데 굶는다" 미해결 체크리스트 (`prioritize_bundle_files` 가 승격된 파일의 *생존* 을 보장하지 않는다 — "어느 쪽이든 `--spec`/`--impl-prep`/`--impl-done` 세 모드에 같이 걸어야 한다" 라고 명시적으로 아직 열려 있음)
  - 상세: 이번 `--impl-prep` 번들도 같은 기제(뒤에서부터 파일을 버리는 tail-drop)로 정작 이 developer 작업이 의존하는 유일한 target 파일(`4-integration.md`)을 통째로 떨궜다 — 대신 이번 작업과 무관한 `1-workflow-list.md`/`2-trigger-list.md`/`3-schedule.md` 만 완전히 실렸다. `harness-review-gate-followups.md` 가 이미 이 결함을 등재해 두었는데도 아직 처방(a/b/c/d 후보)이 적용되지 않아 이번 런에서 그대로 재발했다.
  - 제안: 이 리뷰는 직접 `Read`/`grep` 으로 보정했지만, 같은 배치에서 병행 실행되는 다른 checker(`cross_spec`·`rationale_continuity`·`spec_coherence` 등)가 같은 보정을 하지 않았다면 "4-integration.md 는 문제 없음" 이 거짓 음성일 수 있다. `harness-review-gate-followups.md` 의 해당 미해결 항목 우선순위를 올리는 것을 권고.

- **[INFO] `connection-test-codes-and-gaps.md` 는 대상 tracker 항목과 정합**
  - target 위치: `spec/2-navigation/4-integration.md` §5.5/§14.1 에러코드 vocabulary 표, Rationale "연결 테스트 — Database·HTTP 는 실제로 접속한다"
  - 관련 plan: `plan/in-progress/connection-test-codes-and-gaps.md` (닫으려는 대상: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "연결 테스트 결과 코드가 원시 문자열로 흩어져 있다"·"연결 테스트 spec 의 빈칸 셋" 두 항목)
  - 상세: `DB_HOST_BLOCKED`·`DB_AUTH_FAILED`·`DB_CONNECT_FAILED`·`HTTP_BLOCKED`·`HTTP_AUTH_FAILED`·`HTTP_SERVER_ERROR`·`HTTP_CONNECT_FAILED`·`EMAIL_HOST_BLOCKED`·`EMAIL_CONNECT_FAILED` 모두 spec §14.1 표·§5.5 서술과 plan 의 실측 표가 1:1 로 일치한다. plan 이 "spec 의 코드 표기 — 문서라 리터럴이 맞다" 로 spec 변경을 비대상 처리한 것도 타당하다(spec 은 이미 리터럴 문자열로 코드를 exhaustively 문서화하고 있어 TS 상수/literal union 도입이 spec 과 충돌하지 않음). tracker 원문의 두 항목 문구와 plan 의 "할 것"·"비대상" 절이 정확히 대응하며, 같은 tracker 의 인접 항목("연결 테스트 결과 코드가 지역화 사전에 없다")은 plan 이 명시적으로 별도 UI 턴으로 분리했는데 이는 tracker 원문의 분류("위 «확인 못 함 안내가...» 와 같은 UI 턴에서")와도 일치한다. 미해결 결정 우회·선행조건 미해소·후속 누락 어느 것도 발견되지 않았다.

- **[INFO] `2-trigger-list.md` frontmatter `code:` 의 기존 미해결 항목(무관계 확인)**
  - target 위치: `spec/2-navigation/2-trigger-list.md` frontmatter `code:` 목록
  - 관련 plan: `spec-draft-nullable-notation-followups.md` — "`2-trigger-list.md` `code:` 에 `trigger-resource-releaser.service.spec.ts` 를 등재한다" (미해결, planner, 낮음)
  - 상세: target 은 이 unit spec 파일을 아직 `code:` 에 올리지 않은 상태이고, plan 도 이를 미해결로 정확히 추적 중이라 양쪽이 정합하다(불일치 없음). `connection-test-codes-and-gaps.md` 스코프와도 무관. 참고용으로만 기록.

- **[INFO] `1-workflow-list.md` §2.7 마켓플레이스 CTA "Planned" — pending_plans 정합**
  - target 위치: `spec/2-navigation/1-workflow-list.md` §2.7
  - 관련 plan: `plan/in-progress/marketplace-and-plugin-sdk.md` Phase A 체크리스트 ("이관 2026-07-17" 항목이 정확히 이 CTA 를 Phase A 착수 시점으로 명시)
  - 상세: frontmatter `pending_plans: marketplace-and-plugin-sdk.md` 참조와 plan 본문의 상호 참조가 양방향으로 일치. 충돌 없음.

## 요약
이번 `--impl-prep` 검토의 실제 대상(developer 작업 `connection-test-codes-and-gaps.md`, 소유 spec `4-integration.md`)은 spec 문서·상위 tracker(`spec-draft-nullable-notation-followups.md`) 어느 쪽과도 충돌하거나 선행조건 미해소가 없으며, `spec_impact: none` 주장도 실측(spec 이 이미 코드를 exhaustively 리터럴로 문서화)과 부합한다. 다만 이번 번들 자체가 `harness-review-gate-followups.md` 에 이미 등재돼 있고 아직 미해결인 "tail-drop 이 승격/관련 파일의 생존을 보장 못 한다" 결함을 재현해, 정작 가장 관련성 높은 `4-integration.md` 를 통째로 누락시켰다 — 직접 열람으로 보정했으나 harness 신뢰성 관점에서는 별도 조치가 필요하다.

## 위험도
LOW
