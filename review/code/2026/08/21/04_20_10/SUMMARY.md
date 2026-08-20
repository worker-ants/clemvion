# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건. WARNING 1건(빌드 산출물 구조 보장에 대한 CI 게이트 부재, `testing`). 10개 reviewer(강제 7종 전원 결과 확보 포함) 모두 실코드·spec·테스트를 직접 재검증했고, 이 브랜치는 이미 8라운드 리뷰-수정 사이클을 거친 최종 상태다. forced 화이트리스트 미이행 없음 — `documentation/maintainability/requirement/scope/security/side_effect/testing` 전원 전문 확보됨(그중 `requirement.md` 는 디스크에 누락돼 있어 이번 라운드에서 인라인 전문을 재기록함).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `tsconfig.build.json` 의 신규 exclude(`src/repo-guards/**`)가 막는 실제 운영 위험("devDependency `typescript` 가 `dist/repo-guards/**` 로 새어 프로덕션 설치에서 `require` 크래시")에 대해 자동화된 회귀 테스트/CI 게이트가 없다. 근거는 개발 중 1회 수동 클린빌드 확인뿐이며, 이 exclude 항목이 나중에 실수로 좁혀지거나 삭제돼도 CI 는 그대로 통과한다 | `codebase/backend/tsconfig.build.json:16` | `dist/repo-guards/` 부재를 단언하는 값싼 jest 테스트(예: `fs.existsSync` 단언) 또는 `dist/**/*.js` 에 `require("typescript")` 리터럴이 없음을 확인하는 CI 스텝 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture | 마스킹 마커 판정 primitive(`MASKED_MARKERS`/`isMaskedMarker`)가 "egress 전용"을 표방하는 파일(`sanitize-error-message.ts`)에서 export 돼 ingress 재제출 거부까지 겸하게 됨 — 파일명과 실제 책임 범위 불일치 | `codebase/backend/src/shared/utils/sanitize-error-message.ts:150,164` | 세 번째 소비처가 생기면 `shared/utils/masked-marker.ts` 류 중립 모듈로 재추출 검토(강제 아님) |
| 2 | security, requirement, api_contract | re-run 400 응답의 `errors`→`details` 봉투 교정은 `GlobalExceptionFilter` 가 `errors` 키를 읽지 않던 선존 버그의 정정이며, 회귀 테스트로 고정됨 — 신규 위험 아님(확인용 기록) | `codebase/backend/src/modules/executions/executions.service.ts:506-512` | 없음(이미 회귀 테스트로 고정) |
| 3 | requirement | 검사 시점(raw 우선→resolve→재검사)의 알려진 트레이드오프 — raw phase 통과 후 무관 필드의 `coerce_failed` 가 먼저 던져지면 JSON 인코딩된 object/array 내부 마커는 그 요청에서 검사되지 않음(보안 우회 아님, 요청 전체가 거부되므로 UX 지연일 뿐) | `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` `throwIfAny` docstring | 조치 불요 — 이미 트레이드오프로 수용·문서화됨 |
| 4 | requirement | `spec/5-system/13-replay-rerun.md` §8.1 `INVALID_INPUT` 표의 `INVALID_SCHEMA` 카탈로그 항목이 런타임에는 실제로 발생하지 않음(스키마 구조 오류는 내부적으로 삼켜짐) — 이번 diff 이전부터 있던 기존 서술 관행 | `spec/5-system/13-replay-rerun.md:246` | 조치 불요 — 이번 diff 범위 밖 |
| 5 | scope | repo-guard 서브시스템(AST 가드+spec+`tsconfig.build.json` 배제)은 핵심 요구사항을 넘는 defense-in-depth 확장 — 다만 이 PR 자신의 mandatory 리뷰 사이클(WARNING fix)로 도입돼 절차상 스코프 이탈은 아님. 5라운드에 걸쳐 가드 자신의 우회 형태가 반복 노출되며 diff 볼륨을 상당히 키움 | `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` 등 | 조치 불요(이미 CRITICAL/WARNING 0 로 수렴). 향후 유사 패턴에서 정적 스캔 가드 자체가 검증 대상이 될 수 있음을 설계 초기에 고려 |
| 6 | scope | developer 턴 커밋(`50f799efd`)이 spec/ read-only 원칙을 위반했으나, 같은 diff 안에서 이미 자체 발견·planner 턴 문서로 정규화 완료됨(재확인) | `plan/complete/spec-update-masked-reject-framing.md` | 조치 불요 — 이미 정규화 완료 |
| 7 | scope | 무관 트래커 항목(W5, `Execution.inputData` 응답 의미 반전 외부 소비자 확인)이 같은 커밋에서 함께 종결됨 — 이전 라운드에서 이미 "실질 리스크 낮음"으로 처분된 항목의 재확인 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:353` | 조치 불요 |
| 8 | side_effect, api_contract | Manual 실행 두 엔드포인트(`re-run`, `execute`)의 입력 수용 범위가 좁아져, 마스킹 마커 세 리터럴 문자열이 예약어가 되어 400 을 반환하는 하위 호환성 narrowing — CHANGELOG·spec·저장소 소유자 확인으로 이미 문서화·완화됨 | `codebase/backend/src/modules/executions/executions.service.ts:499`, `codebase/backend/src/modules/workflows/workflows.controller.ts:317` | 조치 불요. 외부용 릴리스 노트가 있다면 한 줄 언급 권장 |
| 9 | api_contract | 동일 실패사유(`MASKED_VALUE_RESUBMITTED`)가 두 자매 엔드포인트에서 서로 다른 최상위 `code`(`INVALID_INPUT` vs `INVALID_TRIGGER_PARAMETERS`)로 노출 — 기존 컨벤션의 연장이며 spec 에 명시된 의도된 설계 | `executions.service.ts:506` vs `workflows.controller.ts:318` | 조치 불요 — `details[].code` 를 보면 됨 |
| 10 | maintainability | `findMaskedResubmissions` 가 동일 타입(`unknown`)의 위치 인자 `rawSource`/`values` 를 순서로만 구분 — 인자를 바꿔도 타입 에러 없이 컴파일됨(실사용 반경 작고 테스트로 뒷받침됨) | `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts:115-119` | 필수 아님. 여지가 있다면 `{ rawSource, values }` named 옵션 객체로 전환 검토 |
| 11 | maintainability | `ExecutionsService.reRun` 이 137줄로 이미 길고, 이번 변경이 "입력 해석" 책임을 조금 더 무겁게 만듦(신규 결함 아님, 선존 구조) | `codebase/backend/src/modules/executions/executions.service.ts` `reRun`(§420-556) | 이번 PR 스코프 강제 아님. 다음에 손댈 때 입력 해석 블록을 private 헬퍼로 추출 검토 |
| 12 | maintainability, documentation | `workflows.controller.ts` 의 신규 한국어 인라인 주석과 인접한 기존 영어 인라인 주석이 같은 블록에 공존(4~5라운드째 이월, 스타일 불일치일 뿐 오류 아님) | `codebase/backend/src/modules/workflows/workflows.controller.ts:314-322` | 조치 불요. 다음 편집 기회에 한국어로 통일 검토 |
| 13 | testing | `findMaskedResubmissions`(exported) 가 여전히 직접 단위 테스트 없이 `resolveTriggerParametersRejectingMasked` 경유로만 간접 커버됨(이월, 의도적 미조치 확정) | `reject-masked-resubmission.ts` `findMaskedResubmissions`(약 115행) | 조치 불요(간접 커버로 충분 판단됨) |
| 14 | documentation | `ReRunRequestDto.inputOverride` Swagger `description` 이 마스킹 마커 예약어 제약을 언급하지 않고, 언급하는 검증 함수명도 `resolveTriggerParametersRejectingMasked` 로 바뀐 상태를 반영 못함(5라운드째 이월) | `codebase/backend/src/modules/executions/dto/re-run.dto.ts` `inputOverride` | 이번 PR 스코프 강제 아님. 다음 DTO 편집 기회에 description 갱신 |
| 15 | user_guide_sync | `MASKED_VALUE_RESUBMITTED` 가 `backend-labels.ts` 의 `ERROR_KO`/`WARNING_KO` 어느 쪽에도 매핑되지 않으나, frontend 가 `details[].code` 자체를 소비하지 않아(top-level `error.code` 만 읽음) 영문 노출 위험 없음(형제 3종도 동일 상태, 신규 회귀 아님) | `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` `REASON_TO_DETAIL` | 조치 불요. 향후 `TriggerParameterErrorDetail.code` 전용 `ERROR_KO` 서브맵 신설 시 4종 한 번에 등재 검토 |
| 16 | security | `hasMaskedLeaf` 재귀는 깊이만 제한(`MAX_REDACT_DEPTH`=10)하고 폭은 제한하지 않으나, 방문 노드 수가 파싱된 JSON 트리 크기를 넘지 않는 순수 O(n)이라 별도 증폭 벡터 없음(기존 `deepRedactCore` 와 동일 위험 프로파일) | `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` `hasMaskedLeaf` | 조치 불요 |
| 17 | security | 인가 체크(RR-PL-06 워크스페이스 owner/admin, execute 의 `findById(id, workspaceId)`)가 신규 마스킹 거부 로직보다 항상 선행하며 이번 변경으로 순서·조건이 바뀌지 않음(확인용 기록) | `executions.service.ts`, `workflows.controller.ts` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | CRITICAL 1건(boolean 완전 우회)·WARNING 다수(freeze 플라시보, AST 가드 우회 4형태)가 실제로 해소됐음을 코드 직접 대조로 확인. 신규 발견 없음 |
| architecture | NONE | wrapper+AST fitness function 설계 견고. 마커 primitive 의 파일명-책임 불일치만 INFO |
| requirement | NONE | spec 6개 문서 line-level 대조 완료, SPEC-DRIFT 없음. 검사시점 트레이드오프는 기존 수용 사안 |
| scope | LOW | 실질 코드 변경 13개 파일로 좁게 유지. repo-guard 서브시스템이 요구사항을 다소 넘는 defense-in-depth (절차상 정당) |
| side_effect | LOW | Manual 두 엔드포인트 입력 수용범위 narrowing(문서화된 트레이드오프), errors→details 응답 shape 변경 |
| maintainability | LOW | 전작 지적 2건(호출부 중복, isPlainRecord 재구현) 해소 확인. 위치인자 순서 혼동 여지 1건만 신규 INFO |
| testing | LOW | 169/169 테스트 통과 실측. tsconfig.build.json exclude 에 대한 CI 게이트 부재가 유일한 WARNING |
| documentation | NONE | AST 전환·tsconfig 주석 문서화 정합 확인. 이월 INFO 2건(Swagger description, 언어 혼재)만 잔존 |
| api_contract | LOW | 마커 리터럴 입력 거부는 의도된 breaking narrowing(이미 완화·문서화). errors→details 응답 개선 확인 |
| user_guide_sync | NONE | frontend 변경 0개. `MASKED_VALUE_RESUBMITTED` 미매핑도 frontend 미소비라 위험 없음 |

## 발견 없는 에이전트

없음 — 전원 최소 1건 이상의 INFO(또는 WARNING)를 보고했으나, 실질 결함(CRITICAL/WARNING)은 `testing` 1건 외에는 없음.

## 권장 조치사항

1. **(WARNING, 선택)** `tsconfig.build.json` 의 `src/repo-guards/**` build exclude 가 지키는 보장("devDependency `typescript` 가 `dist/` 로 새지 않음")을 CI 또는 jest 회귀 테스트로 승격 — 예: 클린빌드 후 `dist/repo-guards/` 부재를 단언하거나 `dist/**/*.js` 에 `require("typescript")` 리터럴 부재를 확인하는 스텝 추가. 값싸게 추가 가능하며, 현재는 수동 1회 확인에만 의존.
2. **(INFO, 선택)** 다음에 `re-run.dto.ts` 또는 `workflows.controller.ts` 를 편집할 기회가 있으면: Swagger `description` 갱신(마스킹 마커 예약어 제약 반영), 한국어/영어 인라인 주석 통일을 함께 처리.
3. 그 외 INFO 항목들은 모두 이번 diff 의 스코프를 벗어나거나 이미 수용된 트레이드오프로, 즉각 조치 불필요.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (10명)
  - **제외**: 아래 표 (4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — 이번 diff 는 순수 검증 로직(O(n) 재귀) 추가로 성능 영향 표면이 낮다고 판단(구체적 사유 텍스트는 prompt 에 미첨부) |
  | dependency | 라우터 판단 — `typescript`(기존 devDependency) 외 신규 외부 패키지 의존성 추가 없음 |
  | database | 라우터 판단 — DB 스키마/쿼리 변경 없음 |
  | concurrency | 라우터 판단 — 신규 동시성 제어 로직(락, 트랜잭션 등) 없음 |