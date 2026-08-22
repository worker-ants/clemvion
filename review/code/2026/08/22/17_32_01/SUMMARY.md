# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — `POST /executions/:id/re-run` 최상위 `error.code` 를 `INVALID_INPUT` → `INVALID_TRIGGER_PARAMETERS` 로 dual-emit 없이 즉시 rename하는 breaking API 변경이 핵심(`api_contract` WARNING, `side_effect`/`documentation` 교차 확인). 위험은 이미 인지·문서화(§5 rename 이력, CHANGELOG 신설)되고 사용자 결정으로 인수됐으나, 공개(내부) REST 계약 breaking 변경이라는 사실 자체는 남아 등급을 낮추지 않음. forced reviewer(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | api_contract / side_effect / documentation | `POST /executions/:id/re-run` 실패 시 최상위 `error.code` 값이 `INVALID_INPUT` → `INVALID_TRIGGER_PARAMETERS` 로 dual-emit 없이 즉시 rename됨. 워크스페이스 JWT 만 있으면 UI 밖에서도 호출 가능한 REST 엔드포인트라 저장소 밖 제3자 클라이언트가 이 값으로 분기하면 조용히 깨질 수 있음(HTTP status·`error.details[]` 값은 불변). `error.code` 가 단일 스칼라 필드라 구조적으로 alias/dual-emit 자리가 없음을 확인. 사내 프런트(`rerun-modal.tsx`)는 `RERUN_*` 4종만 매핑해 신·구 값 모두 generic fallback으로 떨어져 영향 없음. | `codebase/backend/src/modules/executions/executions.service.ts:510`, Swagger `executions.controller.ts:274` | 이미 대부분 처리됨(재확인용): `spec/conventions/error-codes.md:145` §5 Rename 이력에 "리스크 등급 최고" 행으로 명시 등재, 사용자 결정(2026-08-22)으로 인수, `CHANGELOG.md` breaking 고지 신설로 직전 라운드 WARNING 해소. 추가 조치 불요하나 배포 시 외부 API consumer 채널 공지 여부는 이 리뷰 범위 밖이므로 별도 확인 권장 |
| 2 | documentation | `spec/conventions/error-codes.md` §5 Rename 이력 표 신규 행의 "PR" 컬럼이 여전히 placeholder `#TBD_PR` | `spec/conventions/error-codes.md:145` | 직전 라운드부터 알려진 지연(PR 생성 전이라 번호가 존재하지 않음, `RESOLUTION.md` W4 에 "PR 생성 직후 치환" 계획 명시). push/머지 직전 `gh pr create` 후 치환 커밋으로 `grep -rn TBD_PR spec` = 0 확인할 것 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | scope | 정본 tracker 항목 집행 + "같은 절의 spec 편집 3건" 이월분이 이 PR 에 함께 번들링됨 — 직전 라운드 WARNING이었으나 `RESOLUTION.md`(W1)에 "반영 안 함·사유"로 명시 처분 확인, 처음부터 plan 에 선언된 스코프 | `plan/in-progress/eia-error-code-unify.md`, `spec-sync-external-interaction-api-gaps.md:816,826,831` | 조치 불요(이미 처분). 향후 유사 상황은 별도 PR 분리 권장 |
| 2 | scope | 브랜치 선두 chore 커밋의 tracker 절 제목이 실제 세션명과 다른 이름(`backend-redact-depth-boundary`)을 자칭 — 직전 라운드 WARNING("오탈자 확인 요망")이었으나 `RESOLUTION.md`(W2)가 오탈자 아님을 확인, 다른 세션(#1192)에서 옮겨진 커밋 경위가 tracker 에 실제로 기록됨을 재확인 | `spec-sync-external-interaction-api-gaps.md:864-868` | 조치 불요 |
| 3 | scope | consistency `--impl-prep`(`15_35_56`)가 낸 항목 1건이 tracker 에 미체크(`[ ]`)로만 등재되고 이 PR 에서 미집행 | `spec-sync-external-interaction-api-gaps.md:841` | 조치 불요 — 정상적 tracker 위생, planner 턴에서 후속 처리 |
| 4 | maintainability | 최상위 에러 코드 문자열이 3곳(`executions.service.ts`, `workflows.controller.ts`, `workflows.service.ts`)에 컴파일타임 공유 SoT 없이 독립 리터럴로 중복 — 이번 PR 이 고친 drift 자체가 이 패턴의 재발이라 구조적 재발 여지 존재. 이 PR 범위 밖 기존 관례, 직전 라운드도 동일 판정 | `executions.service.ts:510`, `workflows.controller.ts:324`, `workflows.service.ts:931` | 당장 조치 불필요. 후속 별도 plan 으로 "HTTP 최상위 에러 코드 공유 상수화" 검토 여지 |
| 5 | maintainability | `error-codes.md §5` 신규 행 "비고" 셀이 다른 행보다 훨씬 김 | `spec/conventions/error-codes.md:145` | 강한 조치 불요, 근거 보존이 스캔성보다 값짐. 후속 편집 시 각주 분리 검토 |
| 6 | maintainability | `review/consistency/.../_retry_state.json` 이 "호출 전" 스냅샷 상태로 커밋(실제로는 전원 성공). harness 부산물, application 영향 없음 | `review/consistency/2026/08/22/16_34_50/_retry_state.json`, `review/code/2026/08/22/17_06_14/_retry_state.json` | application 조치 불요. harness 상태 파일 갱신 로직 재검토는 별도 트랙 |
| 7 | testing | 신규 테스트가 `details[]` 항목까지는 단언하지 않음(최상위 `code` 만 확인) — 다른 파일(`resolve-trigger-parameters.spec.ts`, `workflows.controller.spec.ts`)이 이미 커버해 실질 커버리지 갭 아님 | `executions-rerun.service.spec.ts:330-362` | 조치 불요(선택 시 `details` 단언 1줄 추가 가능) |
| 8 | testing / requirement | re-run 트리거 검증 실패 경로에 e2e 레벨 `error.code` 단언 없음 — 선존 갭, 이번 diff 가 만든 것 아님. unit 레벨이 서비스 계층에서 커버 | `codebase/backend/test/re-run.e2e-spec.ts` | 필수 아님. 여유 시 e2e 케이스 1개 추가 검토 |
| 9 | testing | 회귀 테스트 유효성 재확인 — 자매 3곳(`workflows.controller.spec.ts` ×2, `workflows.service.spec.ts`)이 이미 값을 직접 단언 중임을 grep 실측 확인, 회귀 위험 없음 | `workflows.controller.spec.ts:150,246`, `workflows.service.spec.ts:1176` | 조치 불요(검증 완료) |
| 10 | testing | (긍정) 독립 뮤테이션 검증 — 발행부 리터럴을 `INVALID_INPUT` 으로 되돌리면 2개 테스트가 실제 RED, 캐너리가 형식적이 아니라 실효적임을 재현 확인 | `executions-rerun.service.spec.ts:352-361` | 조치 불요 |
| 11 | requirement | `error-codes.md §5` 신규 행 "PR" 컬럼 `#TBD_PR` (WARNING #2 와 동일 사안, requirement 관점에서는 INFO로 재확인) | `spec/conventions/error-codes.md:145` | `gh pr create` 직후 치환 커밋 |
| 12 | side_effect | 리뷰/consistency 산출물 다수가 신규 파일로 커밋 — 프로젝트 규약이 지정한 경로의 기대된 문서 파일, 예상 밖 부작용 아님 | `review/code/2026/08/22/17_06_14/**`, `review/consistency/2026/08/22/16_34_50/**` | 조치 불요 |
| 13 | api_contract | 세 Manual 경로(`execute`/`save`/`re-run`) 응답 봉투가 완전히 동형화됨 — 계약 일관성 개선(긍정 관찰). 부수로 re-run 경로가 `errors` 키로 던져 `details[]` 가 응답에 실리지 않던 선존 버그도 이미 교정 확인 | `executions.service.ts:503-520`, `workflows.controller.ts:324`, `workflows.service.ts:931` | 조치 불요 |
| 14 | api_contract | API 버전 관리(URL 버저닝 없음) 정책과 이번 breaking rename 처리 방식(§5 rename 이력 문서화)이 기존 3건 선례와 일치 | `spec/5-system/2-api-convention.md:31` | 조치 불요 |
| 15 | documentation | CHANGELOG/주석/Swagger/테스트/유저가이드(KO/EN)/spec 6파일 전부 line-level 로 정합 확인, 직전 라운드 WARNING 6건 중 다수 해소 | 다수(문서 본문 참조) | 조치 불요 |
| 16 | user_guide_sync | doc-sync-matrix 21행 중 `backend-api-change`(swagger+user-guide, 선행 커밋에서 완결)와 `spec-major-change`(별도 consistency-checker 커버, 스코프 밖) 매칭. 누락된 동반 갱신 없음 | `.claude/config/doc-sync-matrix.json` 대조 | 조치 불요 |
| 17 | security | 애플리케이션 코드 변경은 3개 TS 파일 문자열 리터럴 rename 뿐. 인증·인가·입력검증·마스킹 거부 로직 변경 없음, 하드코딩 시크릿·인젝션 표면 신규 도입 없음 | `executions.service.ts`, `executions.controller.ts`, `executions-rerun.service.spec.ts` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인증/인가/검증 로직 무변경, rename 뿐 |
| requirement | NONE | 코드·spec·테스트 line-level 정합, 잔여 항목은 계획된 지연 |
| scope | LOW | tracker 이월 번들링·세션명 불일치 모두 처분 완료 확인(재확인용 INFO) |
| side_effect | LOW | breaking rename(WARNING) 외 전역상태/FS/네트워크 신규 부작용 0건 |
| maintainability | LOW | 실질 개선(drift 제거+테스트 정합 강화), 잔존 항목은 기존 인지 사안 |
| testing | NONE | vacuous 테스트 결함 해소를 독립 뮤테이션으로 검증, 회귀 없음 |
| documentation | LOW | 직전 WARNING 6건 중 다수 해소, `#TBD_PR` 만 잔존(계획된 지연) |
| api_contract | MEDIUM | breaking `error.code` rename(WARNING) — dual-emit 불가·위험 인수됨 |
| user_guide_sync | NONE | 매트릭스 매칭 항목 모두 커버, 누락 없음 |

## 발견 없는 에이전트

없음 — 전 reviewer 가 최소 INFO 이상 발견사항을 보고함(대부분 재확인성 긍정 관찰 포함).

## 권장 조치사항
1. `gh pr create` 직후 `spec/conventions/error-codes.md:145` 의 `#TBD_PR` 를 실제 PR 번호로 치환하는 커밋을 올리고, push 전 `grep -rn TBD_PR spec` = 0 확인 (WARNING #2).
2. breaking `error.code` rename(WARNING #1)은 코드 조치 불요 — 배포 시 외부 API consumer 채널에도 CHANGELOG 와 동일한 고지가 나가는지만 배포 담당자가 별도 확인.
3. (선택) 최상위 에러 코드 문자열의 3파일 중복을 별도 plan 으로 공유 상수화 검토(INFO #4) — 이번 PR 이 고친 drift 의 재발 방지.
4. (선택) `re-run.e2e-spec.ts` 에 트리거 검증 실패 → `error.code` 단언 e2e 케이스 1개 추가 검토(INFO #8).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — 전원 결과 확보 확인, 누락 없음.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — 본 diff(문자열 rename)와 무관 |
  | architecture | 라우터 판단 — 아키텍처 변경 없음 |
  | dependency | 라우터 판단 — 의존성 변경 없음 |
  | database | 라우터 판단 — DB 스키마/쿼리 변경 없음 |
  | concurrency | 라우터 판단 — 동시성 로직 변경 없음 |