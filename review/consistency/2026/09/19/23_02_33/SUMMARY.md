# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전문 모두 확보, 재시도 필요 항목 없음)

## 전체 위험도
**LOW** — Critical 없음. WARNING 2건(§5.3 에러코드 vocabulary 누락, 신규 타입명 `ConnectionTestResultCode` 명명 혼동)은 모두 spec 정비/리네이밍 권고 수준이며 이번 plan(`connection-test-codes-and-gaps.md`)의 구현 정확성 자체를 위협하지 않음.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `4-integration.md` §5.3 HTTP 연결 테스트 "결과:" 목록이 공유 자격증명 해석 실패 코드 2개(`INTEGRATION_INCOMPLETE`/`INTEGRATION_AUTH_UNSUPPORTED`)를 누락 — §5.3 스스로 인용하는 `1-http-request.md §4`의 `resolveHttpCredentials`가 반환 가능한 코드인데도 목록·§14.1 vocabulary 표 어디에도 없음 | `spec/2-navigation/4-integration.md` §5.3, §14.1 | `spec/4-nodes/4-integration/1-http-request.md` §4/§9, `codebase/backend/src/nodes/integration/http-request/http-credentials.ts`(`resolveHttpCredentials`), `http-connection-tester.ts:91-93` | §5.3 "결과:" 목록 끝에 두 코드가 `resolveHttpCredentials` 공유 경로에서 먼저 반환될 수 있음을 한 줄 추가하고, §14.1 표에도 해당 두 코드 옆에 "HTTP 연결 테스트에서도 `result.code`로 반환됨" 주석 추가. developer 권한 밖(spec 본문 수정)이므로 별도 planner 턴 권고 — 이번 plan 은 이미 코드 실측으로 두 값을 정확히 찾아 반영 예정이라 구현 자체는 안전 |
| 2 | naming_collision | 신설 예정 `ConnectionTestResultCode`(`connection-test-codes.ts`)가 기존 "Integration/Connection + Test + Result(+Code/Dto)" 계열 4개 이름(`IntegrationTestResult`, `TestConnectionResult`, `TestConnectionResultDto`, `ModelTestConnectionResultDto`)과 낱말 순서만 다른 다섯 번째 이름이며, 정작 자신이 타이핑하는 필드의 소유 인터페이스(`IntegrationTestResult`)와도 접두어가 갈림 | 신설 예정 `codebase/backend/src/modules/integrations/connection-test-codes.ts` (`ConnectionTestResultCode`) | `integrations.service.ts:76`(`IntegrationTestResult`), `mcp-test-connection.service.ts:19`(`TestConnectionResult`), `integration-response.dto.ts:463`(`TestConnectionResultDto`), `model-config-response.dto.ts:49`(`ModelTestConnectionResultDto`) | 타입명을 `IntegrationTestResultCode`(또는 `IntegrationTestResult['code']`를 명시 참조하는 이름)로 변경해 낱말 순서만 다른 다섯 번째 이름 증식을 방지. 파일명(`connection-test-codes.ts`)은 형제 파일 명명 관례와 맞아 유지 가능 — 충돌은 export 타입명에만 있음 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | `ConnectionTestResultCode` union 신설은 spec(§14.1 vocabulary 표 + Rationale "연결 테스트" 절)이 이미 산문으로 선언한 "연결 테스트 코드 namespace ≠ 노드 런타임 `ErrorCode`" 원칙을 코드 레벨 가드로 승격하는 것 — 위반 아님 | `plan/in-progress/connection-test-codes-and-gaps.md` §할 것 1~2 ↔ `spec/2-navigation/4-integration.md` §14.1 | 조치 불필요. `--impl-done` 시점에 `spec_impact: none` 근거(§14.1이 이미 SoT)를 한 줄 인용해두면 재의심 라운드 방지 |
| 2 | convention_compliance | `ExportWorkflowDto.formatVersion` 필드가 선언만 되고 emit 되지 않는 spec-impl 갭 — 규약 위반은 아니며 target 이 "미구현(Planned)"으로 정직하게 표시 중 | `spec/2-navigation/1-workflow-list.md` §3.2 | 조치 불필요(정식 규약 준수 관점). 별도 spec-impl 갭 축(`/spec-coverage`) 관할 |
| 3 | plan_coherence | 이번 `--impl-prep` 번들이 `harness-review-gate-followups.md`에 이미 등재된 미해결 결함(tail-drop 절단이 승격 파일의 생존을 보장 못함)을 재현 — 정작 이번 developer 작업의 소유 spec `4-integration.md`가 예산 초과로 통째로 생략됨(4개 checker 모두 직접 Read/grep으로 개별 보정) | 번들 "컨텍스트 예산 초과로 생략된 파일 15개" 목록, `4-integration.md`가 1순위로 누락 | `harness-review-gate-followups.md`의 해당 미해결 항목("어느 쪽이든 `--spec`/`--impl-prep`/`--impl-done` 세 모드에 같이 걸어야 한다") 우선순위 상향 권고. harness 변경이므로 developer 권한 내(harness 코드·도구) — 별도 세션에서 처리 가능 |
| 4 | plan_coherence | `connection-test-codes-and-gaps.md`의 "할 것"·"비대상" 절이 상위 tracker(`spec-draft-nullable-notation-followups.md`)의 대상 두 항목과 1:1 대응, 인접 항목(지역화 사전 누락)은 별도 UI 턴으로 올바르게 분리됨 | `plan/in-progress/connection-test-codes-and-gaps.md` ↔ `spec-draft-nullable-notation-followups.md` | 조치 불필요 — 정합 확인 |
| 5 | naming_collision | 연결 테스트 코드가 노드 런타임 `ErrorCode`와 공유(호스트 차단 3종)/근접(나머지 5종)하는 관계, Cafe24·MakeShop 코드가 노드와 완전 동일 의미(판정 로직 자체 공유, `mapPingError`)인 것 모두 spec Rationale이 이미 문서화한 의도된 설계 — 재-flag 불필요 | `spec/2-navigation/4-integration.md` §14.1/Rationale "코드 이름", `spec/4-nodes/4-integration/{4-cafe24,5-makeshop}.md` | 조치 불필요(선택 권고): `connection-test-codes.ts` 작성 시 "노드와 의미 공유" vs "이름만 근접" 두 그룹을 주석으로 구분해 spec Rationale을 코드 SoT에도 미러링 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | §5.3 HTTP 결과 코드 목록 누락 2건(WARNING), 나머지 전 항목(webhook 예약·RBAC·provider enum·cascade 등) 대조 일치 |
| rationale_continuity | NONE | CRITICAL/WARNING 없음. 계획된 타입 리팩터는 기존 Rationale 원칙의 코드화(INFO) |
| convention_compliance | NONE | CRITICAL/WARNING 없음. 명명·출력포맷·문서구조·API문서·금지항목 5관점 전부 준수 확인, INFO 1건(spec-impl 갭) |
| plan_coherence | LOW | plan-tracker 정합 확인(문제 없음), 단 harness tail-drop 결함 재현을 INFO로 별도 보고 |
| naming_collision | LOW | `ConnectionTestResultCode` 명명 혼동 1건(WARNING), 노드 코드와의 근접/공유는 의도된 설계로 확인(INFO 2건) |

## 권장 조치사항
1. (BLOCK 아님, 권고) `connection-test-codes-and-gaps.md` 구현 시 신규 타입명을 `ConnectionTestResultCode` 대신 `IntegrationTestResultCode`(또는 `IntegrationTestResult['code']` 명시 참조)로 변경 — 기존 4개 근접 이름과의 혼동 방지.
2. (별도 planner 턴 권고) `spec/2-navigation/4-integration.md` §5.3 "결과:" 목록과 §14.1 vocabulary 표에 `INTEGRATION_INCOMPLETE`/`INTEGRATION_AUTH_UNSUPPORTED` 두 코드를 HTTP 연결 테스트 반환 가능 코드로 명시 추가.
3. (선택) `connection-test-codes.ts`에 "노드와 의미 공유" vs "이름만 근접" 두 그룹을 주석으로 구분.
4. (harness 후속) `harness-review-gate-followups.md`의 tail-drop 미해결 항목 우선순위 상향 — 이번 런에서 실제 재현됨.
