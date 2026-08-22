# Code Review 통합 보고서

## 전체 위험도
**LOW** — 프로덕션 코드 변경 없음(순수 테스트 1건 추가 + plan 문서 갱신 + consistency-check 산출물). Critical 0건. 유일한 WARNING 은 `plan/in-progress/masked-marker-test-gaps.md` 의 트래커 줄 번호 인용 2건이 이 PR 자신의 편집으로 줄이 밀린 뒤 시점 기준 stale 하다는 문서 정합성 지적이며, 코드 동작·보안·범위·테스트 품질에는 실질 결함이 없다. forced reviewer 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | `plan/in-progress/masked-marker-test-gaps.md` 의 "트래커 L868" 인용이 base 커밋 기준으로는 맞았으나, 이 PR 자신이 `spec-sync-external-interaction-api-gaps.md` 도 함께 편집해 줄이 밀리면서 병합된 최종 파일에서는 무관한 다른 항목을 가리킨다. 실제 `throwIfAny` phase 경계 항목은 최종 파일 L888. | `plan/in-progress/masked-marker-test-gaps.md:73` (인용 대상: `spec-sync-external-interaction-api-gaps.md`) | `L868` → `L888` 로 정정하거나, 줄 번호 대신 앵커 문구(`` `throwIfAny` 의 phase 경계 트레이드오프 미검증 ``)로 인용 방식을 바꾼다. |
| 2 | documentation | 같은 파일의 두 번째 인용 "트래커 L826-827"도 동일 원인(같은 PR 이 직전 항목에 줄을 삽입)으로 밀렸다. 병합된 최종 파일에서 L826-827 은 ③(`ExecutionsService.reRun` 실측 갱신) 노트이고, ② "유예 근거 교체" 본문은 실제로 L831-832. | `plan/in-progress/masked-marker-test-gaps.md:75` (인용 대상: `spec-sync-external-interaction-api-gaps.md`) | `L826-827` → `L831-832` 로 정정. 같은 파일을 여러 항목에 걸쳐 동시 편집할 때는 base 파일 기준 줄 번호를 그대로 옮기지 말고, 커밋 직전 최종 파일에서 `grep -n`/`sed -n` 재확인 후 인용할 것. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security / requirement / testing | 신규 캐너리 테스트가 고정하는 "무관한 필드의 `coerce_failed` 가 phase② JSON-문자열-내부 마커 검사를 선점한다"는 트레이드오프는 실제 구현(`resolveTriggerParameters` 가 전체 에러를 모아 반환 전에 던지는 구조)과 직접 대조·`jest`/`tsc` 재실행으로 정확히 일치함을 확인했다. 대조군(`count:1`)이 포함돼 vacuous 아님. 이 트레이드오프는 spec(`spec/4-nodes/7-trigger/1-manual-trigger.md` §6 Rationale)에도 이미 명문화된 의도된 설계라 spec fidelity 위반이 아니며, 영구적 우회도 아니다(재제출 시 결국 마커 안내를 받음). | `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts:327-352` | 조치 불요(정보성 기록). 향후 두 phase 를 통합하려는 시도가 있다면 `coerce_failed` 로 요청 전체가 reject 되어 마스킹된 원문이 영속화되지 않는지 함께 검증 권장. |
| 2 | maintainability / testing | "reasons 전체 추출" try/catch 패턴이 파일 내 2곳(기존 1 + 신규 1)에 중복된다. 파일에는 이미 `rejectedFields` 헬퍼(필드만 추출)가 있으나 전체 reason 추출용 헬퍼는 없어 인라인 반복이 발생. | `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts:340-352` (신규), `:294-311` (기존 동형) | 여유가 있을 때 `allReasons(schema, raw): string[]` 같은 헬퍼를 `rejectedFields` 옆에 추가해 두 테스트가 공유하도록 하면 향후 3번째 복붙을 방지. 지금 블로킹 사안 아님. |
| 3 | requirement | plan 문서(`masked-marker-test-gaps.md`, `spec-sync-external-interaction-api-gaps.md`)의 정량 주장(줄 번호·`141줄` 등)을 base 커밋 대조 및 실측(`ExecutionsService.reRun` 560-420+1=141)으로 검증한 결과 모두 정확함(단, WARNING #1/#2 는 이후 자기 편집으로 밀린 별개 사안). | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` | 조치 불요. |
| 4 | testing | `findMaskedResubmissions` 자체의 직접 단위 테스트는 여전히 부재하나, plan 문서가 6개 분기를 표로 대조해 상위 함수 경유로 전부 커버됨을 근거와 함께 명시하며 유예를 재확정했다. 표 내용이 실제 함수 로직과 일치함을 확인. | `plan/in-progress/masked-marker-test-gaps.md` §②, `reject-masked-resubmission.ts:115-129` | 조치 불요. 재개 조건("상위 경유로 못 덮는 분기 발생 시")이 명확해 향후 회귀 트리거로 유효. |
| 5 | scope / side_effect | changeset 은 테스트 파일 1개(순수 추가 43줄) + plan 문서 2개 + consistency-check 자동 산출물 8개로 정확히 구성되며, 프로덕션/구현 코드·설정·전역 상태·네트워크·파일시스템 부작용이 전혀 없다. plan 이 "이 PR 밖"으로 명시한 `ExecutionsService.reRun` 리팩터도 실제로 손대지 않았다. | 전체 changeset (`ad3157a71`, `3f1e30c3f`) | 조치 불요. |
| 6 | maintainability | 신규 테스트 docstring(14줄)이 길지만 파일 내 다른 캐너리/경계 테스트들과 동일한 확립된 하우스 스타일(결정을 근거와 함께 코드 옆에 고정)을 그대로 따름. | `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts:313-326` | 조치 불요. |
| 7 | documentation | 신규 JSDoc 의 `{@link}` 참조 및 트레이드오프 설명이 실제 소스(`throwIfAny` JSDoc)와 정확히 일치. `spec_impact: none` 순수 테스트 변경이라 README/API 문서/CHANGELOG 갱신 불요 판단도 타당. | `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts:313-326` | 조치 불요. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 프로덕션 코드 무변경. 신규 캐너리 테스트가 알려진 phase-경계 트레이드오프를 회귀 고정 — 새 취약점 없음 |
| requirement | NONE | spec fidelity 확인(spec §6 Rationale 과 일치), plan 정량 주장 전부 실측 일치, consistency-check 산출물 정합 |
| scope | NONE | changeset 이 plan 이 선언한 항목에만 정확히 대응, 무관한 수정·리팩터·설정 변경 없음 |
| side_effect | NONE | 전역 상태·I/O·네트워크·공개 API 영향 전혀 없음, 순수 로컬 테스트 |
| maintainability | NONE | 파일 컨벤션(헬퍼 재사용, 네이밍, docstring 스타일) 준수. reasons 추출 중복 2곳은 INFO |
| testing | NONE | 신규 테스트 vacuous 아님(대조군 포함, 실제 구현과 대조 확인). `findMaskedResubmissions` 직접 단위 테스트 부재는 근거 있는 유예 |
| documentation | LOW | plan 트래커 줄 번호 인용 2건이 자기 PR 편집으로 stale — WARNING 2건 |

## 발견 없는 에이전트

security, requirement, scope, side_effect, maintainability, testing — 위 표 참고(전부 NONE, 세부 INFO 는 위 표에 통합).

## 권장 조치사항
1. `plan/in-progress/masked-marker-test-gaps.md:73,75` 의 트래커 줄 번호 인용(`L868`, `L826-827`)을 최종 병합 파일 기준 정확한 줄 번호(`L888`, `L831-832`)로 정정하거나 앵커 문구 인용 방식으로 교체한다. (WARNING #1, #2)
2. (선택) `allReasons(schema, raw): string[]` 헬퍼를 `rejectedFields` 옆에 추가해 reasons 추출 try/catch 중복을 해소한다. (INFO #2, 블로킹 아님)

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **제외**: 아래 표 (7명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — 전원 forced 이며 결과 전원 확보됨 (누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(테스트+문서)와 관련성 낮음 |
  | architecture | 구조 변경 없음 |
  | dependency | 의존성 변경 없음 |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 로직 변경 없음 |
  | api_contract | 공개 API 계약 변경 없음 |
  | user_guide_sync | 사용자 가이드 영향 없음 |