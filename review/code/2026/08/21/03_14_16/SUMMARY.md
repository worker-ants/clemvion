# Code Review 통합 보고서

## 전체 위험도
**LOW** — 8라운드째 반복 검토를 거친 EIA §R17 마스킹 마커 재제출 서버측 거부 기능. 핵심 런타임 방어(raw 우선 → resolve → 재검사)는 재검증 결과 견고하며 CRITICAL/신규 WARNING 없음. 유일한 실질 WARNING 은 2차 CI 안전망(repo-guard)의 정규식 우회 형태 3종 잔존과, 이미 same-PR 내에서 자체 회수된 절차 위반 1건. forced reviewer 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `masked-reject-callers-guard.ts` 의 `importsBaseFn` 이 3라운드 연속 같은 결함 클래스 — 이번엔 동적 `import()` 구조분해, bracket 멤버 접근(`base['resolveTriggerParameters']`), `require()` + 콜론 리네임 세 형태가 무수정 프로브로 실측 미탐지됨. 오늘 코드의 실제 악용 경로는 없음(두 실 호출부는 정상 형태) — 노출되는 것은 향후 세 번째 Manual 경로가 이 형태로 base 를 호출할 경우 CI 가 못 잡는 커버리지 갭 | `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` 함수 `importsBaseFn` (86~107행) | 세 형태를 `it.each` 캐너리로 고정하거나, 근본적으로 `ts.createSourceFile` 기반 AST 스캔으로 전환(정규식 우회가 매 라운드 재발하는 패턴 자체를 해소) |
| 2 | 스코프 | developer 턴 커밋(`50f799efd`)이 `spec/5-system/14-external-interaction-api.md` 표 행을 직접 편집 — CLAUDE.md 의 `spec/` read-only 권한 경계(spec 변경은 `project-planner` 위임) 위반. 내용 자체는 틀리지 않았으나 절차 경로 위반 | 커밋 `50f799efd`; 회수는 `plan/complete/spec-update-masked-reject-framing.md` + planner 커밋 `871d3fcb0` | 조치 불요 — 같은 PR 안에서 작업자 스스로 `git log -S` 로 발견해 planner 턴으로 절차대로 회수·정규화 완료. 재작업 대상 아님, 습관 교정용으로만 기록 |
| 3 | 부작용 | `POST /workflows/:id/execute` 의 거부 범위가 "재제출" 에서 "Manual 실행 전체" 로 넓어져, re-run/에디터 UI 를 우회해 이 엔드포인트를 직접 호출하며 `'***'`/`'[REDACTED]'`/`'[REDACTED_DEPTH]'` 를 정상 값으로 쓰던 제3자 클라이언트가 있다면 이번 배포로 깨짐 — 의도된 변경이나 버전 플래그 없이 공개 API 계약이 좁아짐 | `codebase/backend/src/modules/workflows/workflows.controller.ts` `execute` 메서드 | 조치 불요(CHANGELOG·spec 정정 문서·테스트로 이미 결정·근거 기록됨). 릴리스 노트에 breaking 표면 재확인 권장 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/요구사항 | 핵심 런타임 방어(`resolveTriggerParametersRejectingMasked`) 재검증 — raw 우선 검사, 정확 일치, 깊이 상한 처리, 에러 값 비노출 모두 실코드와 spec 정합 확인 | `reject-masked-resubmission.ts` | 조치 불요 |
| 2 | 요구사항 | `errors`→`details` 응답 봉투 교정이 `GlobalExceptionFilter`(details 만 읽음) 실코드와 일치, 선존 버그 교정임을 확인 | `executions.service.ts`, `http-exception.filter.ts:73` | 조치 불요 |
| 3 | 요구사항 | 프런트 마커 미러(`masked-markers.ts`)와 서버 판정(`reject-masked-resubmission.ts`)의 3경계(마커 리터럴·정확 일치·깊이 상한 10)가 문자 그대로 대칭 | `masked-markers.ts` vs `reject-masked-resubmission.ts` | 조치 불요(자동 동기화 가드는 없음이나 기존 인지된 트레이드오프) |
| 4 | 유지보수성 | `findMaskedResubmissions` 가 export 돼 있으나 실제 외부 소비처 없음 — 다음 사람이 오인해 새 소비처를 만들 여지 | `reject-masked-resubmission.ts` | module-private 로 좁히거나, 직접 겨냥 단위 테스트 추가 |
| 5 | 유지보수성 | 모듈명(`reject-masked-resubmission`)과 가드명(`masked-reject-callers`) 어순 불일치 | 두 파일명 | 강제 아님, 다음 편집 기회에 통일 고려 |
| 6 | 유지보수성/문서화 | `workflows.controller.ts` 같은 try/catch 블록에 신규 한국어 주석과 기존 영어 주석 공존(3~4라운드째 이월) | `workflows.controller.ts` `execute` | 필수 아님, 다음 편집 기회에 한국어 통일 |
| 7 | 테스트 | `schema=null` 분기가 명시적으로 테스트되지 않음(`undefined`/`[]` 만 검증) | `reject-masked-resubmission.spec.ts:142-149` | `it.each([undefined, null, []])` 로 매개변수화 권장 |
| 8 | 테스트 | `findMaskedResubmissions`/`stripCommentsAndStrings` 두 exported 헬퍼가 직접 단위 테스트 없이 상위 함수 경유로만 간접 커버 | `reject-masked-resubmission.ts`, `masked-reject-callers-guard.ts` | 낮은 위험, 세 번째 소비처 생기면 그때 직접 테스트 추가 |
| 9 | 문서화 | `ReRunRequestDto.inputOverride` Swagger description 이 마스킹 마커 예약어 제약을 언급 안 함(4라운드째 이월) | `re-run.dto.ts` | 다음 DTO 편집 기회에 한 줄 추가 |
| 10 | API 계약 | 두 엔드포인트의 최상위 `error.code` 가 여전히 다름(`INVALID_INPUT` vs `INVALID_TRIGGER_PARAMETERS`, 이 PR 이전부터 존재) | `executions.service.ts`, `workflows.controller.ts` | 스코프 밖, 향후 봉투 통합 기회에 처리 |
| 11 | API 계약 | OpenAPI 문서가 신규 검증 규칙(`MASKED_VALUE_RESUBMITTED` 등 필드 코드 카탈로그)을 노출하지 않음 | DTO/controller `@ApiBadRequestResponse` | 필수 아님(외부 소비자 부재 확인됨), 다음 기회에 example 추가 |
| 12 | 유저 가이드 동기화 | `MASKED_VALUE_RESUBMITTED` 는 frontend 가 `details[].code` 를 전혀 소비하지 않아(top-level `INVALID_INPUT`→genericError 폴백) 영문 노출 위험 없음 | `rerun-modal.tsx`, `editor-toolbar.tsx` | 조치 불요 |
| 13 | 유저 가이드 동기화 | `run-debug-flow-change` 후보였으나 이번 PR 은 클라이언트 가드를 이미 통과한 뒤 non-UI 클라이언트만 겨냥한 서버측 2차 방어라 사용자 관찰 가능 UI 흐름 변경 없음 | `run-results.mdx`(기존 서술 유지) | 조치 불요 |
| 14 | 스코프 | 공유 트래커에서 이번 작업과 무관한 별도 항목(W5)이 같은 planner 커밋에서 함께 종결 — 저장소의 기존 허용 패턴 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` | 조치 불요, 이월 기록 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | repo-guard 정규식 우회 형태 3종(3라운드 연속 재발) — 런타임 방어 자체는 견고 |
| requirement | NONE | 요구사항-코드-spec 3층 정합 재검증 완료, CRITICAL/WARNING 없음 |
| scope | LOW | developer 커밋의 spec/ 직접 편집(이미 자체 회수됨), 실질 코드 12파일로 좁게 유지 |
| side_effect | LOW | execute 엔드포인트 값 도메인 축소(의도된 breaking), 나머지는 drop-in 교체 확인 |
| maintainability | LOW | export 과다·파일명 어순·언어 혼재 주석 등 INFO 수준만 |
| testing | LOW | 172/172 테스트 통과 실측, null 분기·헬퍼 직접 테스트 갭은 INFO |
| documentation | NONE | 신규 변경(라운드7 가드 확장) 문서화 정합, 이월 INFO 2건만 |
| api_contract | LOW | 값 도메인 축소는 공지·검증 완료, error.code drift 는 기존부터 존재 |
| user_guide_sync | NONE | frontend 코드 변경 없음, 신규 코드가 사용자에게 노출되지 않음 확인 |

## 발견 없는 에이전트

없음 — 모든 reviewer 가 최소 1건 이상의 INFO/WARNING 을 기록했다(대부분 이월 확인 또는 조치 불요 판정).

## 권장 조치사항

1. (선택, 다음 라운드 또는 별도 후속) `masked-reject-callers-guard.ts` 를 AST 기반(`ts.createSourceFile`) 스캔으로 전환하거나, 최소한 이번에 발견된 3형태(동적 import 구조분해·bracket 멤버 접근·require 콜론 리네임)를 `it.each` 캐너리로 고정 — 3라운드 연속 같은 결함 클래스 재발 패턴을 근본적으로 끊는다.
2. (선택) `findMaskedResubmissions`/`stripCommentsAndStrings` 두 exported 헬퍼에 직접 단위 테스트 추가, `schema=null` 명시적 케이스 매개변수화.
3. (선택, 스코프 밖) 다음 DTO/controller 편집 기회에 Swagger description 에 마스킹 마커 예약어 제약 및 필드 코드 카탈로그 명시.
4. 나머지 WARNING/INFO 는 이미 조치 불요로 판정됐거나 이월 유예 상태 — 이번 PR 병합을 막을 사유 없음.

## 라우터 결정

- `routing_status`: `all` (라우터가 별도로 선별하지 않고 전체 실행)
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync (9명, 전원 success)
  - **제외**: 없음
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (forced 전원 결과 확보됨 — 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (해당 없음) | 전원 실행됨 |
