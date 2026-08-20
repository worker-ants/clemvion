# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건. WARNING 2건은 모두 이번 라운드 이전에 이미 인지·근거 문서화된 트레이드오프(부산물 repo-wide 가드 번들, Manual 파라미터 마스킹 마커 리터럴 거부의 breaking 가능성)로, 병합을 막을 사유는 아니다. forced(router_safety) 화이트리스트 7종(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과가 확보되어 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Scope | 저장소 전역 빌드 위생 가드(`production-build-devdep-guard`)가 "마스킹 재제출 거부" 기능과 무관한 repo-wide 불변식(빌드 대상 전체의 devDependency 런타임 참조 금지)을 같은 PR에 신설. 즉시 필요한 범위(해당 신규 가드 파일 exclude)를 넘어 정책이 확장됨 | `codebase/backend/src/repo-guards/__tests__/production-build-devdep-guard.ts`(신규), `production-build-devdep.spec.ts`(신규), `tsconfig.build.json` | 기능적으로 무해하고 CHANGELOG에 "범위를 넘는다"고 투명히 자백돼 있어 병합 차단 사유 아님. 향후 유사 패턴(부산물로 저장소 전역 가드가 파생되는 경우)은 별도 PR로 분리 권장 |
| 2 | Side Effect / API Contract | Manual 실행 두 엔드포인트(`POST /workflows/:id/execute`, `POST /executions/:id/re-run`)가 파라미터 값이 마스크 마커(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)와 정확 일치하면 이제 400(`MASKED_VALUE_RESUBMITTED`)으로 거부한다 — UI를 거치지 않고 이 문자열을 실제 값으로 쓰던 기존 API 소비자가 있었다면 breaking 변경. 별도 API 버전닝·사전 공지 없이 즉시 적용됨 | `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`(`resolveTriggerParametersRejectingMasked`), 호출부 `executions.service.ts`(reRun), `workflows.controller.ts`(execute) | 의도된 트레이드오프이며 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`에 저장소 소유자의 "저장소 밖 소비자 없음, 프런트가 유일 소비자" 확인 근거가 남아 있어 실질 리스크는 낮음. 되돌릴 필요는 없으나 릴리스 노트에 breaking behavior로 명시하는 것을 고려 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement / Maintainability | 두 호출부(`reRun`, `execute`)의 catch 블록에서 판정-재던지기 응답 봉투 조립 형태가 반복된다 (핵심 판정 로직 자체는 `resolveTriggerParametersRejectingMasked`로 이미 캡슐화됨, 이전 라운드 WARNING은 이 헬퍼 도입으로 해소됨) | `executions.service.ts`, `workflows.controller.ts` | 조치 불요, 참고 기록만 |
| 2 | Requirement / Scope | 브랜치 히스토리 중 developer 턴 커밋이 `spec/5-system/14-external-interaction-api.md`를 직접 수정한 절차 위반 1건 — CLAUDE.md는 developer의 `spec/`을 read-only로 규정. 사후 planner 문서로 정규화되고 내용은 line-level로 정합 확인됨 | `plan/complete/spec-update-masked-reject-framing.md` | 조치 불요(이미 시인·정정됨). 향후 유사 상황에서 절차 준수만 유의 |
| 3 | Maintainability | `REASON_TO_DETAIL` 맵에서 신규 항목(`masked_value_resubmitted`)만 JSDoc 설명이 달려 있고 기존 형제 3항목은 무설명 — 문서화 밀도 비대칭 | `trigger-parameter.types.ts` (`REASON_TO_DETAIL`) | 강제 아님. 형제 항목에도 한 줄 근거를 보태거나, 신규 항목 설명을 함수 상단 docstring으로 옮기는 방법 고려 |
| 4 | Maintainability / Documentation | 신규 한국어 인라인 주석과 인접한 기존 영어 인라인 주석이 같은 try/catch 블록에 공존 (이월 — 이번 diff가 만든 문제 아님, 이전 RESOLUTION에서 이미 "조치 불요" triage됨) | `workflows.controller.ts` (execute) | 강제 아님. 다음 편집 기회에 함께 한국어로 통일 검토 |
| 5 | Maintainability | `ExecutionsService.reRun`이 여전히 100줄 넘는 단일 메서드로 6가지 책임을 순차 수행 (이월 — 이번 PR은 그 안에 분기 1개만 추가, 구조 자체는 PR 이전부터 존재, 이미 defer 확정) | `executions.service.ts` (reRun) | 이번 PR 스코프 아님. 다음에 `reRun`을 손댈 때 입력 해석 블록을 private 헬퍼로 추출 고려 |
| 6 | Documentation | base 함수 `resolveTriggerParameters`의 JSDoc에 신규 wrapper(`resolveTriggerParametersRejectingMasked`)로의 역참조가 없음 — 새 Manual 경로 작성자가 base 함수만 보면 wrapper 사용 규칙을 알 수 없음 (repo-guard가 CI 시점에 위반을 잡지만 이는 작성 시점 안내가 아니라 사후 발견) | `resolve-trigger-parameters.ts:100-109` (이번 diff 밖 기존 파일) | `{@link resolveTriggerParametersRejectingMasked}` 참조 한 줄 추가 권장(강제는 이미 가드가 함, 순수 문서 보강) |
| 7 | API Contract | 두 엔드포인트의 top-level `error.code`가 여전히 다름(`INVALID_INPUT` vs `INVALID_TRIGGER_PARAMETERS`) — 선존 drift, 이전 라운드에서 "통일하려면 기존 클라이언트가 보는 코드가 바뀌므로 별도 결정 필요"로 이미 검토·유예됨 | `executions.service.ts`, `workflows.controller.ts` catch 블록 | 재지적 아님, 기록만. 통일이 필요하면 별도 결정으로 진행 |
| 8 | API Contract | `ReRunRequestDto.inputOverride`의 swagger description이 여전히 "resolveTriggerParameters 검증"으로만 서술돼, 실제로는 마스킹 마커 3종이 예약어로 거부된다는 사실이 API 문서에 드러나지 않음 (이월, 이전 라운드에서 이미 non-blocking으로 유예) | `executions/dto/re-run.dto.ts:19-25` | 다음 DTO 편집 기회에 description에 예약어 제약 추가 |
| 9 | Testing | `findMaskedResubmissions` 직접 단위 테스트 부재, `throwIfAny`의 phase-경계 트레이드오프 미검증, `MASKED_MARKERS` 프런트/백엔드 크로스런타임(jest↔vitest) 동기화 테스트 부재 — 전부 이월이며 이전 라운드에서 의식적으로 미조치 확정됨 | `reject-masked-resubmission.ts`, `sanitize-error-message.ts` / frontend `masked-markers.ts` | 상위 함수(`resolveTriggerParametersRejectingMasked`) 간접 커버로 회귀 위험 낮다는 기존 판단 유효 — 조치 불요 상태 유지 |
| 10 | Security | `hasMaskedLeaf` 재귀는 깊이만 `MAX_REDACT_DEPTH`로 제한하고 폭은 미제한하나, 요청 본문 자체가 body-parser에서 크기 상한이 걸려 있어 별도 DoS 증폭 벡터가 아님 (기존 `deepRedactCore`와 동일 위험 프로파일) | `reject-masked-resubmission.ts` (`hasMaskedLeaf`) | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | CRITICAL/WARNING 없음. raw-우선 2단계 검사 순서로 이전 CRITICAL(boolean 완전 우회) 해소 확인, 에러 응답 정보노출 없음, `MASKED_MARKERS` 런타임 불변성 확보, repo-guard 2종은 CI 전용이라 공격표면 아님 |
| requirement | NONE | 핵심 기능(EIA §R17 마스킹 마커 재제출 서버측 거부) 완전 구현 확인. spec 5문서 line-level 일치, SPEC-DRIFT 없음. 199개 테스트 GREEN 실측 |
| scope | LOW | 핵심 변경은 요청 범위에 정확 부합. repo-wide 가드 2건이 부산물로 함께 커밋됨(WARNING 1건, `production-build-devdep-guard`) |
| side_effect | LOW | 순수 함수 조합, 전역 상태/네트워크 부작용 없음. Manual 엔드포인트의 마커 거부가 breaking 변경 가능성(WARNING 1건) |
| maintainability | LOW | 이전 WARNING(호출부 중복)은 헬퍼 캡슐화로 이미 해소. 남은 지적은 전부 INFO(문서화 밀도, 언어 혼재, reRun 다중 책임 — 대부분 이월) |
| testing | NONE | 이번 라운드 diff는 CHANGELOG·주석뿐, 테스트 동작 변화 없음. 관련 8개 스위트 199건 재실행 GREEN. 신규 CRITICAL/WARNING 없음 |
| documentation | LOW | 문서-코드 정합성 높음(spec 7곳, CHANGELOG, docstring 일치). base 함수 JSDoc 역참조 누락 1건 INFO |
| api_contract | LOW | 신규 에러코드 형제와 일관된 스키마, 정보 노출 없음. 입력 수용범위 축소(breaking 가능성, side_effect WARNING과 동일 사안) + 이월 INFO 2건(error.code drift, swagger 미갱신) |
| user_guide_sync | NONE | `codebase/frontend/**` 변경 0건. 매칭된 trigger(`backend-api-change`)도 기존 컨벤션·기존 user-guide 서술로 이미 충족 — 갱신 공백 0건 |

## 발견 없는 에이전트

없음 — 9개 에이전트 모두 최소 INFO 이상의 관찰사항을 보고했다. 다만 security/requirement/testing/user_guide_sync는 확인성(confirmatory) INFO 중심이며 실질 조치가 필요한 항목은 없다(위험도 NONE).

## 권장 조치사항

1. (선택) 릴리스 노트에 Manual 실행 파라미터의 마스킹 마커 3종(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`) 거부를 breaking behavior로 명시 — 외부 API 소비자 존재 시 대비 (WARNING #2)
2. (선택) 향후 기능 PR에서 저장소 전역 정책 가드가 부산물로 파생되는 경우, 기능 PR과 분리해 별도 PR로 제출하는 관행 고려 (WARNING #1)
3. (non-blocking) base 함수(`resolveTriggerParameters`) docstring에 wrapper 역참조 추가, `REASON_TO_DETAIL` 문서화 밀도 통일, 한국어/영어 인라인 주석 통일 — 다음 해당 파일 편집 기회에 함께 처리

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — 전원 결과 확보됨

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터가 이번 diff(순수 검증 로직 추가, 요청 본문 크기 상한 이미 기존 인프라)에 해당 도메인 관련성이 낮다고 판단 |
  | architecture | 신규 파일 1개(래퍼 함수) + 기존 아키텍처 경계(공유 프리미티브 미변경) 유지로 관련성 낮다고 판단 |
  | dependency | 신규 외부 의존성 추가 없음(devDependency `typescript` 사용은 repo-guard 내부 한정, 별도 side_effect/security에서 확인됨) |
  | database | 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 제어 로직 변경 없음(순수 함수 검증 로직) |