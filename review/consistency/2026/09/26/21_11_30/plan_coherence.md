# Plan 정합성 검토 — `plan/in-progress/integration-test-contract.md` (impl-done, scope=`spec/2-navigation/`)

## 발견사항

- **[WARNING] 이 브랜치가 트래커에 새 항목을 등재하며 자기 `spec_impact:` frontmatter 갱신을 빠뜨렸다 — 같은 파일이 이미 3번 자백한 실패 모드의 4번째 재발**
  - target 위치: `spec/2-navigation/4-integration.md` §9.4(공통 에러 목록의 `INTEGRATION_TEST_FAILED (422)` 서술), 그리고 스코프 인접 `spec/5-system/11-mcp-client.md` §9(rotate 경로 400 서술)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` — 본문 라인 3610-3619 신규 항목 「`INTEGRATION_TEST_FAILED` 의 상태 코드와 발생 경로를 spec 두 문서가 다르게 적는다」, frontmatter `spec_impact:` (라인 8-63)
  - 상세: 이 브랜치의 커밋 `7138f02b7`(`git diff origin/main...HEAD -- plan/in-progress/spec-draft-nullable-notation-followups.md` 로 실측)이 `spec-draft-nullable-notation-followups.md` 에 11줄짜리 신규 planner 항목을 추가했다 — `4-integration.md §9.4` 는 422, `11-mcp-client.md §9` 는 400 이라고 서로 다르게 적은 상태를 실측으로 지목하며 "§9.4 를 400·rotate 한정으로, MCP client §9 의 경로를 `:id/rotate` 로 고친다" 는 처분까지 적었다. 그런데 이 두 파일 어느 쪽도 트래커 자신의 `spec_impact:` 목록(라인 9-63)에 없다 — `4-integration.md` 는 목록에 없고(라인 46-49 의 코멘트는 **다른** 조건부 항목(`consecutiveNetworkFailures` 노출 중단 검토)을 의도적으로 뺀 것이지 이번 신규 항목과 무관), `11-mcp-client.md` 는 언급조차 없다. 같은 트래커 파일이 자신의 frontmatter 코멘트(라인 35-40, 50-53, 56-61)에서 정확히 이 실패 모드 — "항목을 추가하며 그 항목이 겨냥하는 spec 파일을 `spec_impact:` 에 반영하지 않는다" — 가 이미 3번 재발했고 "항목을 등재할 때 그 항목의 «대상 파일 전수» 를 이 목록과 대조하는 것이 절차여야 한다" 고 스스로 처방했음을 적어 두었는데도, 이번 등재가 같은 실수를 4번째로 반복했다. `4-integration.md`·`11-mcp-client.md` 프론트매터의 `pending_plans`(전자는 `integration-personal-owner-followup.md` 만, 후자는 아예 `pending_plans` 필드 없음)도 이 트래커를 역참조하지 않는다 — `2-trigger-list.md`/`3-schedule.md` 등 같은 트래커의 다른 항목이 겨냥하는 파일들은 이미 `pending_plans` 로 역참조를 걸어 둔 선례가 있다(라인 15-16 코멘트). 방치하면 향후 이 트래커를 스코프로 하는 `--spec`/`--impl-done` 번들이 이 두 파일을 조용히 누락한다.
  - 제안: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 `spec_impact:` 에 `spec/2-navigation/4-integration.md` · `spec/5-system/11-mcp-client.md` 를 추가하고(짧은 코멘트로 "왜 이번에 추가됐는지" 남기면 트래커 자신의 관례와 정합), 필요하면 두 spec 파일의 frontmatter `pending_plans` 에도 이 트래커를 역참조로 건다. developer 는 `spec/` 을 쓸 수 없으므로 이 갱신은 planner 턴에서 처리.

- **[INFO] 이번 PR 이 닫으려는 트래커 두 항목은 developer 소유·미결 "결정 필요" 표식 없음 — 정합성 문제 아님**
  - target 위치: `plan/in-progress/integration-test-contract.md` 체크리스트 마지막 두 줄(`- [ ] --impl-done`, `- [ ] 트래커 두 항목 닫기`)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 라인 3434(「MCP 전용 응답 필드 3종 미선언」), 라인 3603(「HTTP 와이어-레벨 계약 검증 부재」) — 둘 다 `(developer, 2026-09-13 등재)` 로 planner 결정 대기 표식이 없다
  - 상세: 실제 diff(`git diff --stat origin/main...HEAD -- codebase/` → DTO·controller·service spec·wire spec 4파일)는 두 항목의 원문 서술·"함께 할 일" 지시와 정확히 대응한다(`capabilities`/`serverInfo`/`preview` 선언을 형제 `PreviewTestResultDto` 와 동형으로, `assertMatchesContract` 배선, 신규 wire spec). 두 트래커 항목은 여전히 `[ ]` 로 남아 있지만, target plan 자신의 체크리스트가 "`--impl-done` 통과 후 트래커 두 항목을 닫는다" 를 남은 절차로 명시하고 있어 미해소가 아니라 예정된 다음 단계다.
  - 제안: 조치 불요 — `--impl-done` 통과 뒤 두 체크박스와 트래커 항목(3434, 3603)을 같은 커밋에서 함께 닫을 것.

- **[INFO] 이번 PR 이 out-of-scope 로 판단해 새로 planner 항목화한 결정은 역할 경계·처분 모두 적절**
  - target 위치: `plan/in-progress/integration-test-contract.md` §"`--impl-prep` 처분" WARNING 1
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 라인 3610-3619(위 WARNING 항목과 동일 대상)
  - 상세: `INTEGRATION_TEST_FAILED` 상태 코드·경로 불일치는 spec 정정 사안(§9.4 400·`:id/rotate` 한정)이라 developer 가 직접 `spec/` 을 고치지 않고 트래커에 planner 항목으로 등재한 처리는 역할 경계(`spec/` 쓰기는 planner)를 지켰다. 이번 PR 의 DTO·테스트 변경과는 실제로 무관함을 코드로 확인했다(`rotate()` 의 `BadRequestException` 자리는 이번 diff 밖).
  - 제안: 조치 불요 — 위 WARNING 의 `spec_impact:` 보완과 함께 처리하면 됨.

## 요약

이번 diff(`integration-response.dto.ts`·`integrations.controller.ts`·서비스/와이어 spec, 4파일)는 `spec-draft-nullable-notation-followups.md` 트래커의 두 developer 소유 미결 항목을 원문 그대로 집행하는 것으로, 미해결 planner 결정을 우회하지 않았고 spec(`4-integration.md §5.6`, `11-mcp-client.md §9`)이 이미 문서화한 필드를 DTO 가 뒤늦게 따라잡는 구조라 `spec_impact: none` 도 실측과 일치한다. 다만 이 브랜치의 첫 커밋이 같은 트래커에 새 planner 항목(`INTEGRATION_TEST_FAILED` 상태 코드/경로 불일치)을 등재하면서 그 항목이 겨냥하는 두 spec 파일을 트래커 자신의 `spec_impact:` frontmatter 에 반영하지 않았다 — 이는 그 트래커 파일이 자기 이력에서 이미 세 차례 자백한 정확히 같은 실패 모드의 네 번째 재발이며, 방치 시 향후 이 트래커 기반 스펙 검토가 두 파일을 조용히 놓친다. 코드 변경 자체를 막을 사유는 없으나, 이 frontmatter 보완은 별도 planner 턴에서 처리해야 한다.

## 위험도
LOW
