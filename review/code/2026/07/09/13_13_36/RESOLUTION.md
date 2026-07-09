# RESOLUTION — re-review (post-rebase, final diff origin/main..HEAD)

ai-review 재실행(리베이스 후 최종 diff 대상): 위험도 HIGH, Critical 1 / Warning 6.
(requirement/scope/api_contract 3개는 FS-write flakiness 로 파일 미생성 — 데이터 갭.)

## 조치 항목

| # | 카테고리 | 발견 | 조치 |
|---|---|---|---|
| CRIT-1 | testing | 핵심 재진입 fix(durable input)를 **결정적으로** 검증하는 회귀 테스트 부재. 기존 e2e 는 정상 1-shot 경로만, 기존 crash-redrive/stalled e2e 는 트리거 완료 후 크래시만 합성 | **결정적 e2e 추가**: `manual-trigger-default-param.e2e-spec.ts` 에 "트리거 실행 전 크래시" 를 합성(트리거 node_execution 삭제 + status=running)하고 `_test/simulate-execution-run-redelivery` 훅으로 재구동해, 재실행된 트리거의 `output.parameters` 가 보존되는지 단언(fix 없으면 `{}`). 타이밍 비의존 |
| W1 | side_effect/maint/doc | `driveResumeFrame` 신규 주석이 `resumeGraphAfterRetry`(정반대 동작)를 근거로 잘못 인용 | **helper 추출로 해소**: 3개 사이트를 `private reentryWorkflowInput(savedExecution)` 로 통일, 규칙·spec 근거·"의도적 예외"를 helper docstring 한 곳에 문서화 → 잘못된 산문 인용 제거 |
| W3 | maintainability | 재진입 input 로직이 3(+1)개 사이트에 산문 중복, 영어/한국어 혼재 | 위 helper 추출로 단일 진실 지점화, 3개 사이트는 짧은 한국어 참조 주석만. retry-turn 은 helper 의 "의도적 예외" 를 교차 참조 |
| W4 | maint/arch | `saveCanvas(..., true)` boolean trap | `/* skipParamSchemaValidation */ true` 인라인 주석 + 인자 줄바꿈 |
| W6 | user_guide_sync | 유저 가이드 `triggers.mdx`/`.en.mdx` Callout 이 "실행 시점에만 거부" 로 stale | `spec-update-manual-trigger-save-time-error-code.md` follow-up 체크리스트에 두 파일 추가(project-planner/user-guide) |
| W2 | architecture | `validateManualTrigger` 가 `NodeHandler.validate()`(+`evaluateMetadataBlockingErrors`) 우회 | **수용**(선행 라운드 동일 결론): `details[]` 봉투 보존 위해 `validateTriggerParameterSchema` 직접 호출. manual_trigger 는 blocking rule 없어 현재 동등. blocking rule 추가 시 재수렴 — 후속 |
| W5 | architecture | `PARAM_NAME_RE` 프론트/백 이중 정의 | **후속(백로그)**: 공유 패키지 추출. 저위험 |

data gap 3종은 아래 재실행으로 확보(요약 갱신).

## TEST 결과

- lint: 통과 (retry-turn 의 필요 타입 단언은 `no-unnecessary-type-assertion` warning 이나 error 아님 — HEAD 부터 동일)
- unit: 통과
- build: 통과 (helper 반환 타입 `Record<string,unknown>` 로 tsc 정합; 직접 `eslint --fix` 가 오제거한 retry-turn 타입 단언은 원복)
- e2e: 통과 (신규 결정적 재진입 테스트 포함) — fix 후 재수행

## 보류·후속 항목

- W2 `NodeHandler.validate()` 단일 진입점 수렴 (blocking rule 추가 시)
- W5 식별자 정규식 공유 패키지 추출
- W6 유저 가이드 2파일 → spec-update follow-up
