# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec, rationale_continuity, convention_compliance, plan_coherence, naming_collision) 전원이 전문을 확보했고(모두 disk 파일 기존 존재, 인라인과 대조 일치), Critical 위배는 발견되지 않았다.

## 전체 위험도
**LOW** — Critical 없음. WARNING 2건(문서 전용 에러코드 표기 drift 1건, plan 절차 명시성 미흡 1건)이 있으나 착수를 막을 사유는 아니다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `13-replay-rerun.md` §8.1/§8.2 의 401 코드가 `UNAUTHORIZED`로 표기됨(표준은 `AUTH_REQUIRED`). §8.1 행은 "표준 [Spec 에러 처리] 규약"이라 자칭하지만 실제로는 비표준 이름. 코드베이스 실측(`http-exception.filter.ts:144-145`)은 이미 `AUTH_REQUIRED`를 내고 있어 런타임은 정상, 문서만 drift | `spec/5-system/13-replay-rerun.md` §8.1(line 240)·§8.2(line 269) | `spec/conventions/error-codes.md` §1 / `spec/5-system/2-api-convention.md` §5.3 / `spec/5-system/3-error-handling.md` §1.2 (모두 401=`AUTH_REQUIRED`로 규정) | 두 행의 `code` 열을 `UNAUTHORIZED` → `AUTH_REQUIRED`로 정정(문서 전용, 이번 plan의 `spec_impact: none`과 별도로 처리 가능) |
| 2 | plan_coherence | `masked-marker-test-gaps.md`를 `complete/`로 이동하기 전, 그 문서 자신의 잔여 체크박스 2개(`TEST WORKFLOW 4단계+타입체크 ratchet`, `/ai-review`)를 `[x]`로 갱신하는 단계가 새 plan의 작업 목록에 명시돼 있지 않음. 새 plan은 이 두 항목이 실제로는 완료됐는데 표기만 누락됐다고 정확히 진단하지만, 체크리스트 자체에 그 갱신 하위 단계가 없음 | `plan/in-progress/rerun-input-resolution-extract.md` `## 작업` 체크리스트 (이동 항목) | `plan/in-progress/masked-marker-test-gaps.md` 잔여 체크박스 2개 / `.claude/docs/plan-lifecycle.md` §3 이동 조건("모든 체크박스 `[x]`") | 이동 직전 하위 항목으로 "`masked-marker-test-gaps.md`의 마지막 두 체크박스를 `[x]`로 갱신"을 명시하거나, 이동 커밋 diff에서 그 두 줄이 함께 바뀌는지 확인 단계를 적을 것 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | 마스킹 재제출 "소비처" 수를 서로 다른 두 함수(`toTriggerParameterErrorDetails` 3곳 vs `resolveTriggerParametersRejectingMasked` 2곳) 기준으로 각각 "N소비처"로 서술하는 인접 문단이 있어 향후 검토자 혼동 소지(실제 모순 아님, 확인 완료) | `spec/5-system/3-error-handling.md` §1.7 / `spec/5-system/14-external-interaction-api.md` §R17 | §1.7 note 옆에 어느 카운트가 어느 함수를 가리키는지 함수명 한 줄 더 명시 |
| 2 | rationale_continuity | §R17 "세 소비처가 각각 갖췄다" 문구 바로 아래 표에 4번째 행(서버 백스톱)이 나와 처음 읽을 때 오독 유발 가능(의미상 일관, 배치 문제) | `spec/5-system/14-external-interaction-api.md` §R17 | 표 앞에 "서버 행은 소비처가 아니라 그 소비처들의 재제출을 막는 백스톱" 구절 추가 |
| 3 | convention_compliance | `spec/5-system/` 6개 문서(`2-api-convention.md`·`6-websocket-protocol.md`·`16-system-status-api.md`·`5-expression-language.md`·`7-llm-client.md`·`11-mcp-client.md`)가 권장 3섹션 구성의 `## Overview` 헤딩을 갖추지 않음(부재 또는 `## 1. 개요`로 변형). 기계 강제 대상 아님, pre-existing 상태 | 위 6개 파일 | `project-planner`가 다음에 이 문서들을 손댈 때 `## Overview` 섹션 통일 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 데이터 모델·API 계약·RBAC·감사 로그가 관련 영역과 촘촘히 동기화, 충돌 없음. 이번 리팩터는 spec 텍스트 변경 없는 순수 코드 변경 |
| rationale_continuity | NONE | 기각된 대안 무근거 재도입·합의 위반·무근거 번복 없음. INFO 2건(문구 명확화 제안)만 |
| convention_compliance | LOW | WARNING 1건(401 코드 문서 drift, 런타임은 정상) + INFO 1건(Overview 헤딩 6개 문서 미비, 기존 상태) |
| plan_coherence | LOW | WARNING 1건(체크박스 갱신 단계 미명시). 나머지 5개 확인 항목 전부 문제 없음으로 판정 |
| naming_collision | NONE | 신규 식별자는 private 헬퍼 `resolveManualOverrideInput` 1개뿐이며 코드베이스 전역에서 유일, 충돌 없음 |

## 권장 조치사항
1. `plan/in-progress/rerun-input-resolution-extract.md`의 `## 작업` 체크리스트에 "`masked-marker-test-gaps.md`의 마지막 두 체크박스를 `[x]`로 갱신" 항목을 이동 단계 직전에 추가한다(WARNING #2 해소, `complete/` 이동 전 필수).
2. `spec/5-system/13-replay-rerun.md` §8.1·§8.2의 401 코드 표기를 `UNAUTHORIZED` → `AUTH_REQUIRED`로 정정한다(WARNING #1, 문서 전용, developer/project-planner 턴에서 1줄로 흡수 가능).
3. (선택) `error-handling.md` §1.7과 `external-interaction-api.md` §R17의 "N소비처" 서술에 함수명을 명시해 향후 혼동을 줄인다(INFO #1, #2).
4. (선택, 비필수) `spec/5-system/`의 6개 문서에 `## Overview` 섹션을 추가/통일한다(INFO #3, 다음 해당 문서 작업 시).