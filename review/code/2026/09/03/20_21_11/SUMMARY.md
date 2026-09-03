# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical/Warning 없음. 전 리뷰어(8/8, forced 전원)가 결과를 냈고 전부 INFO 급 관찰만 남겼다. `WorkspaceInvitationDto.invitedBy` 를 required/non-null → optional/nullable 로 정정한 이번 diff 는 이전 리뷰 라운드(`20_02_03`)의 WARNING 3건(테스트 인자 미검증·CHANGELOG 누락·plan 문서 자기모순)에 대한 fix 로 확인됐고, 다수 리뷰어가 독립적으로(뮤테이션 재현, 실측, 소스 대조) 그 조치가 유효함을 재확인했다.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | api_contract / maintainability / testing / documentation | `invitedBy?: string \| null` 의 optional-key(`?`) 표기가 실제 wire 동작(키 상시 존재, 값만 null)과 형태상 어긋난다. 같은 파일의 `invitedByName: string \| null`(non-optional)과도 표기가 다르다. 원인은 이번 diff 가 아니라 `spec/5-system/2-api-convention.md §5.4` 문면 자체의 내적 모순이며, `plan/in-progress/entity-nullable-column-type-mismatch.md` 에 planner 턴 후속 항목으로 이미 추적 중. | `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:105-110`(대조 `:155`) | 조치 불요(이번 PR 범위 밖). §5.4 표기 확정 시 관련 필드 일괄 통일. |
| 2 | api_contract / security / side_effect | DTO nullability 완화는 widening 방향(하위 호환) — breaking change 아님. wire 응답 바이트 자체는 변경 전과 동일(핸들러가 코어션 없이 그대로 통과), FE 는 이미 `string \| null` 로 소비 중. `CHANGELOG.md` 에 종전/지금 표 + 영향까지 정확히 기록됨. | `workspace-response.dto.ts:105-110`, `workspaces.controller.ts:396-404`, `frontend/src/lib/api/workspaces.ts:154`, `CHANGELOG.md` | 조치 불요. 레포 밖 OpenAPI codegen 소비자가 있다면 계약 widening 만 인지시킬 것. |
| 3 | requirement / testing / api_contract | 신규 `listInvitations` 캐너리 테스트가 결과값뿐 아니라 `toHaveBeenCalledWith('ws-1', user.sub)` 로 호출 인자까지 고정 — 직전 라운드 WARNING(W1, 인자 미검증)이 실제로 해소됐음을 독립 뮤테이션 재현(인자 순서 스왑 → `1 failed/13 passed`, 원복 확인)으로 재검증. | `workspaces.controller.spec.ts:84` | 조치 불요. |
| 4 | testing / documentation | 대조군(control) 테스트에는 `toHaveBeenCalledWith` 인자 검증이 없어 캐너리 테스트와 비대칭 — 블록 docstring 은 두 테스트를 아우르는 어조지만 실제 검증 강도는 다르다. 회귀 방어 자체는 캐너리 테스트가 이미 담당하므로 실질 위험은 낮음. | `workspaces.controller.spec.ts:88-103`(대조군), `:60-69`(블록 docstring) | 조치 불요. 향후 유사 패턴 추가 시 "짝 중 하나만 검증" 규칙을 컨벤션으로 명시하거나 양쪽 다 검증. |
| 5 | requirement / documentation / maintainability | plan 문서(`entity-nullable-column-type-mismatch.md`)의 舊 절("48건 미해결·가드 신설 필요")과 신 절의 자기모순(직전 라운드 W3)이 취소선 + 폐기 배너 + 인라인 반증 근거로 실제 해소됨을 line-level 로 확인. | `plan/in-progress/entity-nullable-column-type-mismatch.md:195-231, 353-364` | 조치 불요(이미 조치 확인). |
| 6 | security | `GET /api/workspaces/:id/invitations` 의 서버측 인가(`assertAdmin`, Admin+)가 서비스 레이어에서 실제로 강제됨을 직접 확인 — Swagger `@ApiForbiddenResponse` 주석뿐 아니라 실제 코드. 이번 diff 는 이 경로를 건드리지 않음. | `workspace-invitations.service.ts` `listPending()` | 조치 불요. |
| 7 | scope | plan 문서에 "버그 수정"(코드 diff)과 "배치 1~3 전체 정본 스키마 424컬럼 대조"(문서 전용, 부수)가 함께 실려 있다. 코드 변경 자체는 `invitedBy` 단일 필드에 정확히 국한됨 — 직전 라운드에서 이미 조치 불요로 판정된 항목이 이번 diff 에도 그대로 남아 있음. | `plan/in-progress/entity-nullable-column-type-mismatch.md:249-281` | 조치 불요(기존 판단 유지). 향후 세션에서는 버그 수정과 정본 재검증을 커밋 단위로 분리 권장. |
| 8 | scope / side_effect / requirement | 직전 리뷰 라운드(`20_02_03`)의 산출물 13개 파일(SUMMARY/RESOLUTION/9개 reviewer 리포트/meta.json/_retry_state.json)이 이번 fix 커밋에 함께 커밋됨 — `review/` 는 정식 저장 위치이고 "리뷰 산출물 + 그 지적에 대한 fix" 를 한 커밋에 묶는 것은 이 저장소의 기존 관례와 일치. 은폐성 없음. | `review/code/2026/09/03/20_02_03/*` | 조치 불요. |
| 9 | maintainability | 신규 `listInvitations` 테스트 블록의 설명 주석이 파일 내 다른 describe 블록보다 눈에 띄게 장문·산문체(JSDoc 스타일 5줄). 내용은 정확하나 파일 관례와 스타일이 갈림. | `workspaces.controller.spec.ts:61-69` | 조치 불요. 향후 유사 회귀 테스트 추가 시 팀 컨벤션으로 정리 권장. |
| 10 | documentation | CHANGELOG 의 "§5.4 를 따랐다" 서술이 §5.4 자체의 미해결 내부 모순(INFO#1)을 언급하지 않아, plan 을 보지 않은 외부 독자는 "형태가 확정·일관됐다"로 오해할 여지. 규약 문면 자체는 정확히 따름 — 이번 diff 의 결함 아님. | `CHANGELOG.md` 신규 항목 | 조치 불요(범위 밖). 굳이 개선한다면 CHANGELOG 에 "표기 일관성은 별도 planner 턴에서 다룸" 한 줄 추가. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인가(`assertAdmin`) 실제 강제 확인, 인젝션/시크릿/암호화 해당 없음 |
| requirement | NONE | 직전 라운드 WARNING 3건(W1/W2/W3) fix 전부 line-level 로 유효성 재확인(뮤테이션 재현 포함) |
| scope | NONE | 코드 변경은 `invitedBy` 단일 필드에 국한, drive-by 없음 |
| side_effect | LOW | OpenAPI 계약 widening 이 유일한 실질 side effect, wire 바이트 불변 |
| maintainability | NONE | optional-key 표기 불일치(추적 중)·테스트 주석 스타일 차이만 관찰 |
| testing | LOW | 인자 검증 추가로 W1 해소 확인, 남은 갭(대조군 비대칭 등) 전부 저위험/추적 중 |
| documentation | NONE | 모든 인용 소스 위치 실측 대조 일치, CHANGELOG/plan 갭 해소 확인 |
| api_contract | LOW | widening 정정, breaking change 아님, optional-key 표기 이슈는 추적 중 |

## 발견 없는 에이전트

없음 — 8개 리뷰어 전원이 최소 1건 이상의 INFO 를 냈으나 전부 결함이 아닌 관찰/확인 사항이다.

## 권장 조치사항

1. (선택) `invitedBy?: string | null` 등 optional-key 표기와 `§5.4` 문면 내적 모순은 이미 `plan/in-progress/entity-nullable-column-type-mismatch.md` 에 planner 턴 후속 항목으로 열려 있으므로, 다음 planner 세션에서 §5.4 표기를 확정하고 관련 필드(`invitedByName` 등)를 일괄 통일한다.
2. (선택) `listInvitations` 대조군 테스트에도 `toHaveBeenCalledWith` 를 추가해 캐너리 테스트와 대칭을 맞추거나, "짝 중 하나만 검증" 규칙을 팀 컨벤션 문서에 명시한다.
3. 그 외 즉시 조치가 필요한 항목 없음 — 이번 PR 은 머지 가능 상태로 판단된다.

## 라우터 결정

- `routing=all` (라우터가 아닌 강제 전원 실행 지시):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract (8명)
  - **제외**: 없음
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — 전원 결과 확보됨 (누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (없음) | — |