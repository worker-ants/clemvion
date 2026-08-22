# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 은 없다. 핵심 코드 diff(re-run 의 최상위 `error.code` 를 `INVALID_TRIGGER_PARAMETERS` 로 통일)는 좁고 정확하지만, (1) breaking API 변경임에도 `CHANGELOG.md` 항목이 없고, (2) spec 정본 표(`error-codes.md §5`)의 PR 컬럼이 `#TBD_PR` placeholder 로 남아 있으며, (3) 동일 tracker 절의 무관한 spec 문서 갭 3건이 이 rename PR 에 번들링돼 스코프가 확장됐다. forced reviewer 7명(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과가 확보돼 화이트리스트 미이행은 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SCOPE | 동일 tracker 절의 이월 항목 3건(마커 재제출 거부 기능의 문서 부채 — wrapper 함수명 노출, EIA §R17 볼드 통일, error-codes §4 표 분리)이 이 rename PR 에 함께 번들링됨. 세 항목은 이번 작업 없이도 독립적으로 닫을 수 있고 만든 diff 분량도 rename 본체보다 크다 | `plan/in-progress/eia-error-code-unify.md:18-21,127-146`, `spec/4-nodes/7-trigger/1-manual-trigger.md:190-201`, `spec/5-system/14-external-interaction-api.md:1576-1584`, `spec/conventions/error-codes.md:84-135` | 향후 유사 상황에서는 tracker 이월 항목을 별도 PR 로 분리. 이번 PR 설명에 번들링 사실을 명시 |
| 2 | SCOPE | 브랜치 선두에 이번 rename 과 거의 무관한 "정본 트래커 미체크 37건 재판정" chore 커밋(`3f7f72c3b`)이 포함돼 있고, 그 섹션이 실제 브랜치명(`eia-error-code-unify-a87cea`)과 다른 세션명(`backend-redact-depth-boundary`)을 자칭 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:864-895` | PR 설명에 선행 chore 커밋의 성격(37건 중 이 작업과 겹치는 것은 1건뿐)을 명시. 세션명 불일치는 오탈자인지 확인 후 정정 |
| 3 | DOCUMENTATION | 커밋(`c9a78d04f`)이 `feat(api)!:` + `BREAKING CHANGE` 를 명시한 breaking API 변경인데 `CHANGELOG.md` 에 항목이 없음. 직전 형제 PR(#1189, 같은 마커/re-run 영역)은 `## Unreleased` 섹션을 남긴 선례가 있음 | `CHANGELOG.md` (변경 부재) | `## Unreleased — ...` 섹션 추가, breaking 내용(재발행 코드 값·영향 엔드포인트·하위 호환 없음) 요약 |
| 4 | DOCUMENTATION / MAINTAINABILITY | `error-codes.md §5` Rename 이력 표 신규 행의 "PR" 컬럼이 실제 번호가 아닌 `#TBD_PR` placeholder 그대로 커밋됨(형제 행은 전부 실제 식별자) | `spec/conventions/error-codes.md:145` | PR 생성/머지 직전 실제 PR 번호로 치환. push 전 체크리스트 항목화 권장 |
| 5 | TESTING / MAINTAINABILITY | 제목이 `throws INVALID_TRIGGER_PARAMETERS when ...` 로 갱신됐지만 본문은 `rejects.toBeInstanceOf(BadRequestException)` 만 확인할 뿐 `body.code` 값을 단언하지 않음 — 코드값이 실수로 되돌아가도 이 테스트는 계속 GREEN. 같은 파일 394-432행 및 자매 파일(`workflows.controller.spec.ts:150,246`, `workflows.service.spec.ts:1176`)은 이미 `code` 값을 직접 단언하는 패턴을 갖고 있어 이 테스트만 뒤처짐 | `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts:330-354` | `expect((err as BadRequestException).getResponse()).toMatchObject({ code: 'INVALID_TRIGGER_PARAMETERS' })` 형태 단언 추가 |
| 6 | API-CONTRACT / SIDE-EFFECT | `POST /executions/:id/re-run` 최상위 `error.code` 가 dual-emit 없이 즉시 rename 됨 — 워크스페이스 JWT 만 있으면 UI 밖에서도 호출 가능한 내부 API 라 저장소 밖 서드파티 분기 가능성을 코드로 완전히 배제할 수 없음(plan 도 "관측 범위 미발견"이라 정직하게 서술, "부재 확인"은 아님) | `codebase/backend/src/modules/executions/executions.service.ts:510`, `codebase/backend/src/modules/executions/executions.controller.ts:274` | 이미 `spec/conventions/error-codes.md §5` 에 최고 리스크 등급 행으로 등재돼 사용자 결정으로 인수됨 — 배포 노트/CHANGELOG(위 #3) 에도 breaking notice 명시 권장 외 추가 조치 불요 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | REQUIREMENT | `review/consistency/2026/08/22/16_34_50/_retry_state.json` 이 미완료(호출 전) 스냅샷 상태로 커밋됨 — 실제로는 5개 checker 전원 성공했으나 `agents_success`/`agents_fatal` 이 빈 배열, `agents_pending` 에 5개 그대로 남음. application 코드와 무관한 harness 부산물 | `review/consistency/2026/08/22/16_34_50/_retry_state.json` | application 기능 조치 불요. harness 세션이라면 `subagent-call-contract.md` 상태 관리 재검토 가치 있음 |
| 2 | MAINTAINABILITY | 최상위 에러 코드 문자열 `'INVALID_TRIGGER_PARAMETERS'` 가 3개 파일에 컴파일 타임 공유 SoT 없이 독립 리터럴로 중복 — 이번 rename 이 고치는 drift 자체가 이 패턴에서 비롯된 것이라 구조적 재발 소지가 남음(코드베이스 전역 기존 관례, 이번 diff 가 새로 만든 것 아님) | `executions.service.ts:510`, `workflows.controller.ts:324`, `workflows.service.ts:931` | 이번 PR 범위 밖. 후속 별도 plan 으로 "HTTP 최상위 에러 코드 공유 상수화" 검토 |
| 3 | MAINTAINABILITY | `error-codes.md §5` 신규 행 "비고" 셀이 표의 다른 행보다도 훨씬 긴 장문 산문(약 700자) | `spec/conventions/error-codes.md:145` | 후속 편집 기회에 하위 불릿/각주로 분리해 표 스캔성 개선 |
| 4 | TESTING | e2e 레벨에서 re-run 트리거 스키마 검증 실패 경로의 `error.code` 를 단언하는 테스트가 없음(unit 레벨만 커버) — 선존 갭, 이번 diff 가 만든 것 아님 | `codebase/backend/test/re-run.e2e-spec.ts` | 필수 아님. 여유 시 트리거 검증 실패 → `400 + code + details[]` e2e 케이스 1개 추가 검토 |
| 5 | API-CONTRACT | 프런트 `rerun-modal.tsx` 의 `ERROR_CODE_TO_KEY` 는 `RERUN_*` 4종만 매핑하고 신·구 코드 모두 generic fallback 으로 떨어짐을 grep 으로 실측 확인 — breaking 영향 범위가 plan 서술대로 사내 프런트에는 없음(긍정 관찰) | `codebase/frontend/src/components/executions/rerun-modal.tsx:90-101,446` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 발견 없음 — 순수 문자열 리터럴 rename, 인증/인가/검증 로직 변경 없음 |
| requirement | NONE | 코드·spec·테스트 전 계층 line-level 일치 확인. INFO 2건(TBD_PR, retry_state 스냅샷)만 |
| scope | MEDIUM | WARNING 2건 — tracker 이월 항목 3건 번들링, 무관한 chore 커밋 + 세션명 불일치 |
| side_effect | LOW | WARNING 1건 — breaking API 변경(이미 인지·문서화·인수됨). 마이그레이션 완전성(잔존 `INVALID_INPUT` 0건) 확인 |
| maintainability | LOW | WARNING 2건(TBD_PR, 제목만 주장하는 테스트) + INFO 2건(리터럴 중복, 긴 비고 셀) |
| testing | LOW | WARNING 1건(제목-본문 불일치 테스트) + INFO 2건(e2e 갭, Swagger 테스트 불요) |
| documentation | MEDIUM | WARNING 2건 — CHANGELOG 누락, TBD_PR placeholder. 나머지 문서 정합성은 매우 높은 정확도 |
| api_contract | MEDIUM | WARNING 1건(dual-emit 없는 breaking rename) + INFO 4건(형식 동형화·프런트 미분기·버저닝 정책 일치 등 긍정 관찰) |
| user_guide_sync | NONE | 발견 없음 — swagger + KO/EN user-guide 동반 갱신 완결, i18n dict/backend-labels 무관 확인 |

## 발견 없는 에이전트

security, user_guide_sync

## 권장 조치사항

1. `CHANGELOG.md` 에 이번 breaking API 변경(`## Unreleased` 섹션) 추가 — 배포 추적선의 유일한 공백.
2. `spec/conventions/error-codes.md:145` 의 `#TBD_PR` 을 실제 PR 번호로 치환(머지 직전 필수).
3. `executions-rerun.service.spec.ts:330-354` 에 `body.code` 단언 추가 — 제목이 주장하는 회귀 방지력을 본문이 실제로 갖추도록.
4. PR 설명에 스코프 확장 2건(tracker 이월 항목 3건 번들링, 무관한 37건 재판정 chore 커밋 + 세션명 불일치)을 명시 — 은폐된 크립은 아니나 리뷰어가 인지하도록.
5. (선택) HTTP 최상위 에러 코드 공유 상수화 여부를 별도 plan 으로 검토 — 이번 drift 의 재발 방지.
6. (선택) `re-run.e2e-spec.ts` 에 트리거 검증 실패 경로의 e2e 케이스 추가.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract`, `user_guide_sync` (9명)
  - **제외**: 표 (reviewer · 이유, 5명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명) — 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — diff 가 문자열 리터럴 rename 뿐이라 성능 관련 표면 없음(상세 사유는 prompt 에 미제공) |
  | architecture | 라우터 판단 — 아키텍처 변경 없음(상세 사유는 prompt 에 미제공) |
  | dependency | 라우터 판단 — 의존성 변경 없음(상세 사유는 prompt 에 미제공) |
  | database | 라우터 판단 — 스키마/쿼리 변경 없음(상세 사유는 prompt 에 미제공) |
  | concurrency | 라우터 판단 — 동시성 관련 코드 변경 없음(상세 사유는 prompt 에 미제공) |