# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원 성공, Critical 발견 0건.

## 전체 위험도
**LOW** — Critical 없음. WARNING 2건(둘 다 이번 PR 범위를 살짝 벗어난 잔여 정리 항목)만 존재하며, 채택을 막을 사유는 없다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | 신규 공용 헬퍼(`FORBIDDEN_NOT_A_MEMBER`/`forbiddenForRole`)를 거치지 않는 기존 403 설명 2곳이 남음 — `NOT_A_MEMBER`/`EDITOR_REQUIRED` 코드를 손으로 보간 | `codebase/backend/src/modules/auth/auth.controller.ts:431,446` (`switchWorkspace`), `codebase/backend/src/modules/executions/executions.controller.ts:284,313` (재실행 라우트) | `spec/conventions/swagger.md` §5-4 "문장은 공용 헬퍼로 만들고" + 같은 절 소급 Rationale | 후속 정리 PR에서 두 지점을 헬퍼 호출로 치환하거나, §5-4에 "가드가 셀 수 있는 코드가 이미 실린 자리는 헬퍼 치환이 강제가 아니다"라는 범위를 명시. `auth.controller.ts` 지점은 이미 `review/code/2026/09/26/12_20_03/SUMMARY.md` INFO #4가 독립 포착·유예했으나, `executions.controller.ts`는 이번에 처음 지적된 동일 결함군의 두 번째 사례라 함께 정리 대상에 포함 필요 |
| 2 | Plan Coherence | 본 PR 커밋(`dd01f8382`)이 다른 in-progress plan에 남긴 인라인 참조가 아직 일어나지 않은 `plan/complete/` 이동을 전제로 씀 — 실측상 파일은 여전히 `plan/in-progress/`에 있고 자신의 체크리스트(`--impl-done`·트래커 항목 닫기)도 미완 | `plan/in-progress/integration-personal-owner-followup.md` "Viewer 가 자기 personal 을 만들고 …" 항목에 추가된 문장 — `` `plan/complete/forbidden-desc-codes.md` `` 인용 | 실제 위치 `plan/in-progress/forbidden-desc-codes.md` (마크다운 링크가 아닌 인라인 코드라 `findBrokenPlanLinks` 류 가드 사각지대) | 이번 PR 종료 전 (a) 경로를 `plan/in-progress/forbidden-desc-codes.md`로 정정하거나 (b) 남은 체크리스트 2건을 마치고 실제로 `plan/complete/`로 옮기는 마무리 커밋에서 인용 경로 재확인 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | 소급 범위 근거가 `swagger.md` §1-4/§3("신규 변경 한정")과 §5-4 Rationale("광고=실제 정합 문제는 소급") 두 곳에 나뉘어 있어, §1-4/§3만 읽으면 오독 여지 | `spec/conventions/swagger.md` §1-4/§3 vs §5-4 | 다음 개정 때 §1-4/§3 원칙 문장 옆에 "예외: §2-4·§5-4는 광고-실제 정합 문제라 소급" 각주 추가(이번 PR 범위 밖) |
| 2 | Rationale Continuity | 헬퍼 문장·코드 조합, `lowestRequiredRole` 공유, reflection 가드 스코프(서비스 거부 제외)가 모두 `swagger.md` §5-4·`data-flow/12-workspace.md` "가드 거부의 오류 코드" Rationale과 1:1 대응 확인. 과거 기각된 "라우트별 opt-in 데코레이터" 패턴 재도입 없음 | `common/swagger/forbidden-descriptions.ts`, `repo-guards/__tests__/forbidden-response-codes-guard.ts`, `common/guards/roles.guard.ts` | 조치 불필요 — 현 상태 유지 |
| 3 | Convention Compliance | 서비스 판정을 덧붙이는 합성 문구의 구두점(`, 또는` vs `또는`)이 5곳에서 갈림 | `workspaces.controller.ts:67,392`, `integrations.controller.ts:95-97,241`, `workflow-test-datasets.controller.ts:39` | 조치 불필요(이미 `review/code/2026/09/26/12_20_03/SUMMARY.md` API Contract #15에서 트리아지·유예) |
| 4 | Convention Compliance | `swagger.md` §3 DTO 길이 표가 `@ApiForbiddenResponse` 등 응답 데코레이터 `description`을 분류하지 않아 "강제/지향" 판정 불가 — 이번 PR로 문장 길이 분포(40~120자대)가 더 넓어짐 | `spec/conventions/swagger.md` §3 | 조치 불필요 — 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`(2026-09-26 등재)에 planner 소관 항목으로 추적 중 |
| 5 | Convention Compliance | 신규 저장소 가드의 swagger 메타데이터 키 상수명이 형제 가드와 다름(`SWAGGER_API_RESPONSE` vs `SWAGGER_API_RESPONSE_METADATA`) | `repo-guards/__tests__/forbidden-response-codes-guard.ts:26` vs `http-status-advertised-guard.ts:37` | 급하지 않음 — 세 번째 가드 추가 시 공용 상수 추출 고려 |
| 6 | Naming Collision | 신규 식별자(`FORBIDDEN_NOT_A_MEMBER`·`forbiddenForRole`·`lowestRequiredRole`·신규 repo-guard 파일 쌍·모듈 로컬 상수) 전원 기존 사용처와 이름·의미 충돌 없음. 옛 동의어 상수(`FORBIDDEN_MEMBER` 등)는 완전 제거·잔존 참조 0건 | diff 전체(32파일) | 조치 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | spec 델타 0(코드 전용 PR), 구현이 이미 확정된 `swagger.md` §5-4·`data-flow/12-workspace.md` Rationale과 정확히 부합. API 계약·RBAC·오류 코드 카탈로그 전부 불변/일치 |
| Rationale Continuity | NONE | 기존 Rationale을 "실행에 옮기는" 성격. 기각된 대안 재도입·합의 원칙 위반·무근거 번복 없음 |
| Convention Compliance | LOW | 129곳 소급 적용은 매우 일관되나, 손대지 않은 기존 2개 라우트(auth/executions)가 헬퍼 미사용으로 남음(WARNING). 나머지는 이미 트리아지된 INFO |
| Plan Coherence | LOW | 미해결 결정(Viewer 강등) 우회 없음, 선행 plan 해소 확인, 트래커 갱신 반영. 다만 타 plan에 남긴 `plan/complete/` 인용이 시점상 앞섬(WARNING) |
| Naming Collision | NONE | 6개 관점(요구사항 ID/엔티티·타입명/API endpoint/이벤트명/환경변수/파일경로) 전수 실측 확인, 충돌 0건 |

## 권장 조치사항
1. (BLOCK 해소 불필요 — Critical 없음) 이번 PR은 현재 상태로 채택 가능.
2. 후속 정리 PR에서 `auth.controller.ts`(`switchWorkspace`)와 `executions.controller.ts`(재실행 2곳)의 손-보간 403 설명을 공용 헬퍼(`FORBIDDEN_NOT_A_MEMBER`/`forbiddenForRole`)로 치환하거나, `swagger.md` §5-4에 헬퍼 치환이 강제 아닌 예외 범위를 명시.
3. PR 종료 전 `integration-personal-owner-followup.md`에 남긴 `plan/complete/forbidden-desc-codes.md` 인용을 실제 위치(`plan/in-progress/`)와 대조해 정정하거나, 마무리 커밋에서 실제 이동과 동시에 확정.
4. (급하지 않음, 이미 추적됨) `spec/conventions/swagger.md` §3 길이 표에 응답 데코레이터 `description` 분류를 추가하는 것은 `spec-draft-nullable-notation-followups.md`의 planner 턴에서 처리.
