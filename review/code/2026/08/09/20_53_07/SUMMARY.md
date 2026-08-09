# Code Review 통합 보고서

## 전체 위험도
**LOW** — 순수 주석/JSDoc/plan 문서 정정 커밋(실행 코드·테스트 단언 변경 없음)이며, 4개 reviewer(documentation/requirement/maintainability/testing) 전원이 정정 내용의 사실관계(컨트롤러 데코레이터 부재, RolesGuard 단축 순서, `isUuidShaped` 단일 호출부, 두 단위 테스트가 진짜 캐너리라는 주장)를 소스에서 직접 재검증해 정확함을 확인했다. Critical 없음, WARNING 1건(자매 plan 체크리스트 stale), 나머지는 INFO 성격의 구조적 개선 여지. forced 화이트리스트(documentation·maintainability·requirement·testing) 4명 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화 | 이번 커밋이 정확히 해소한 정정 항목이 자매 plan(`spec-draft-auth-invariants-sync.md`, worktree: `pnpm-migration-followups-7fc7c2` 소유)의 "후속(이 PR 밖) → developer 범위" 체크리스트에는 여전히 미해소로 남아 stale 상태 | `plan/in-progress/spec-draft-auth-invariants-sync.md:385-390` | 이번 PR 범위 밖 파일이라 직접 체크 불가하면, 커밋 메시지나 plan "후속" 섹션에 "동일 항목이 `#1112` 계열 정정으로 해소됨 — 다음 planner 턴에서 체크 표시" 포인터를 남길 것 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성 / 테스트 | "진짜 회귀 캐너리는 uuid.spec.ts·workspace-context.util.spec.ts 이지 system-status e2e 가 아니다"라는 동일한 정정 문단이 codebase 3곳 + plan 1곳(총 4곳)에 산문 형태로 재복제됨. SoT 부재 + 자동 강제 장치 없음 — 향후 `system-status.controller.ts` 에 `@WorkspaceId()`/`@Roles()` 가 추가되면 3곳 주석이 다시 조용히 stale 해질 수 있고, 이를 잡는 자동화가 없음 | `codebase/backend/src/common/utils/uuid.ts:27-33`, `uuid.spec.ts:53-63`, `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts:53-59`, `plan/in-progress/auth-guard-reflection-hardening.md:92-98` | 상세 근거는 프로덕션 호출부에 가장 가까운 한 곳(`uuid.ts` 또는 `workspace-context.util.ts:74` 인근)에만 남기고 나머지는 1줄 포인터로 축약해 SoT 일원화. plan "후속"에 "컨트롤러가 워크스페이스 스코핑을 갖게 되면 재검증" 트리거 조건 추가 |
| 2 | 유지보수성 | 동일한 정정에 대해 `uuid.ts` 는 "> **앵커 정정 (날짜, 이슈 실측).**" 인용-각주 스타일로 이력을 영구 보존하는 반면, `uuid.spec.ts`·`workspace-id-fixtures.ts` 는 이력 인용 없이 조용히 재작성하는 방식을 택해 파일마다 스타일이 다름. 반복되면(이미 최소 두 번째 앵커 교체) JSDoc 이 "현재 사실 설명"이 아니라 "정정 변경 로그"로 누적될 우려 | `codebase/backend/src/common/utils/uuid.ts:27-33` vs `uuid.spec.ts:53-63`, `workspace-id-fixtures.ts:53-59` | 프로덕션 JSDoc 은 "현재 무엇이 맞는가"만 간결히 서술하고 이력 서사는 커밋 메시지에 위임하거나, 3개 파일에 인용-블록 스타일을 일관 적용 |
| 3 | 요구사항 | 본 worktree(`backend-hygiene-followups-02092f`)에 대응하는 `plan/in-progress/backend-hygiene-followups*.md` 가 보이지 않음 — 소규모 hygiene 정정 커밋이 plan 없이 쌓이는 패턴 | `plan/in-progress/` (해당 파일 부재) | 커밋 메시지에 근거가 충분해 추적성 손실은 작음. 반복되는 소규모 정정 커밋을 묶는 상위 plan 항목 존재 여부만 확인 |
| 4 | 테스트 | `uuid.spec.ts` 의 경계 테스트(65-74행)가 `isUuidShaped`/`isValidUuid` 를 nil/v7/oddVariant 값에 대해 함께 단언하므로, "진짜 캐너리는 이 테스트다" 라는 주석 정정 주장을 테스트 코드 자체가 이미 실질적으로 충족함 (참고 확인, 갭 없음) | `codebase/backend/src/common/utils/uuid.spec.ts:65-74` | 조치 불요 (확인용 기록) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| documentation | LOW | 자매 plan 체크리스트 stale(WARNING) + 정정 각주 누적 패턴(INFO). 사실관계·일관성은 정확 |
| requirement | NONE | 5개 반증 주장 전부 소스 대조로 정확함 확인. spec(`12-workspace.md`, #1112)과 line-level 합치. 본 worktree plan 부재만 INFO |
| maintainability | LOW | 로직 변경 없음. 정정 문단이 4곳에 재복제 + 스타일 불일치(둘 다 INFO) |
| testing | NONE | 테스트 단언 미변경, 회귀 위험 없음. 자동 강제 장치 부재만 INFO |

## 발견 없는 에이전트

없음 (전원 최소 INFO 이상 보고, Critical/차단급 발견은 전원 없음).

## 권장 조치사항
1. (선택, 낮은 우선순위) `plan/in-progress/spec-draft-auth-invariants-sync.md:385-390` 의 관련 체크박스에 이번 정정으로 해소됐음을 표시하거나 포인터 추가 — 다음 planner 턴이 중복 작업하지 않도록.
2. (선택) `isUuidShaped`/nil-UUID 회귀 캐너리에 대한 상세 근거를 한 곳(SoT)에 모으고 나머지 파일은 포인터로 축약해, 향후 근거 변경 시 4곳을 동시에 놓치는 재발을 줄인다.
3. 그 외 조치 불요 — Critical 없음, 사실관계 전부 검증됨.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용, 전체 reviewer(documentation·requirement·maintainability·testing) 강제 실행됨.
- **강제 포함(router_safety)**: `documentation, maintainability, requirement, testing` (4명) — 전원 결과 확보됨. 화이트리스트 미이행 없음.
- **실행**: 4명 전원 성공(success) — 제외된 reviewer 없음.