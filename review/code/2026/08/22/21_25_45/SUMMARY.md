# Code Review 통합 보고서

## 전체 위험도
**NONE** — 프로덕션 코드 변경 없는 test-only(캐너리 테스트 1건) + plan 문서 갱신 + 선행 리뷰/consistency-check 산출물 커밋. 7개 forced reviewer 전원이 정상 결과를 반환했고(누락 없음), Critical/Warning 급 발견사항이 전혀 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | 신규 캐너리 테스트가 고정하는 phase 경계 트레이드오프(무관 필드의 `coerce_failed` 가 JSON-문자열-내부 마커 검사를 선점)는 spec Rationale·docstring에 이미 문서화된 의도된 설계이며 보안 우회가 아니라 UX 지연. 대조군(`count:1`) 포함으로 vacuous 하지 않음을 확인 | `reject-masked-resubmission.spec.ts:327-354` | 조치 불요. 향후 두 phase 를 합치는 리팩터 시 마스킹 원문 미영속화 재검증 권장 |
| 2 | security | 테스트 fixture 의 `apiKey` 값은 `VALUE_MASK_MARKER` 상수(마스킹 마커)이지 실제 시크릿 아님 | `reject-masked-resubmission.spec.ts` 신규 블록 | 조치 불요 |
| 3 | requirement | 신규 캐너리 테스트가 `resolveTriggerParameters` 의 "errors 전부 수집 후 일괄 throw" 구조·spec Rationale(`1-manual-trigger.md` §Rationale L228-229)과 line-level 로 정확히 일치함을 직접 트레이스+`jest` 실행(22/22 통과)으로 확인 | `reject-masked-resubmission.spec.ts:327-354`, `resolve-trigger-parameters.ts:132-167` | 조치 불요 |
| 4 | requirement | plan 문서(`masked-marker-test-gaps.md`)의 정량 주장(`ExecutionsService.reRun` 141줄, `findMaskedResubmissions` 분기 커버리지 표 6행)이 실측과 정확히 일치 | `masked-marker-test-gaps.md:43-50,61-62` | 조치 불요 |
| 5 | requirement/scope/documentation | 직전 라운드(`21_15_53`) WARNING 2건(트래커 줄 번호 인용 stale: `L868`→`L888`, `L826-827`→`L831-832`)이 숫자 정정이 아니라 앵커 문구 인용으로 실제 교체됐고, `grep` 재검증 결과 각 앵커가 대상 파일 내 유일 매치로 정확히 대응함을 3개 reviewer 가 독립적으로 확인 | `masked-marker-test-gaps.md:73-74,76`, `spec-sync-external-interaction-api-gaps.md:829,888` | 조치 불요. 문서 컨벤션에 "동일 PR 내 자기 편집으로 밀리는 줄 번호 대신 앵커 문구 인용" 규칙 편입 검토(블로킹 아님) |
| 6 | requirement | 조건부 종결 항목("PR #1194 머지 시 흡수")의 근거 커밋(`bdcfdc514`, `923b5892e`)과 `egress-masking.md §3`/"알려진 stale 트리거" 문구 실존을 `git log`+직접 열람으로 검증 | `spec-sync-external-interaction-api-gaps.md:874-878`, `spec/conventions/egress-masking.md:79,83` | 조치 불요 |
| 7 | scope | changeset 은 정확히 3커밋(테스트/plan+consistency산출물/리뷰fix)·22파일로 프로덕션 코드 미포함. fix 커밋(`23840323c`)은 리뷰가 지적한 정확히 그 결함만 고치고 비차단 INFO 제안(헬퍼 추출)·범위 밖 리팩터는 손대지 않음 | 전체 changeset | 조치 불요 |
| 8 | side_effect | 신규 테스트는 순수 함수만 호출(mock/spy/전역상태/env/네트워크/이벤트 콜백 0건), 함수 시그니처 변경 없음 | `reject-masked-resubmission.spec.ts:327-354` | 조치 불요 |
| 9 | maintainability/testing | "reasons 전체 추출" try/catch 보일러플레이트가 파일 내 2곳(기존 1 + 신규 1)으로 반복. `rejectedFields` 헬퍼는 필터링된 값만 다뤄 이 용도엔 미적용. rule-of-three 미달로 즉시 조치 불요 | `reject-masked-resubmission.spec.ts:341-351` (기존 `:295-307`) | 3번째 유사 요구 발생 시 `allReasons(schema, raw): string[]` 헬퍼 추출 검토 |
| 10 | maintainability | 신규 테스트 JSDoc(14줄)·`err_` 네이밍·catch 패턴이 파일 기존 컨벤션과 정확히 일치. 대조군을 실험군보다 먼저 단언하는 구조는 가독성상 좋은 패턴 | `reject-masked-resubmission.spec.ts:313-338` | 조치 불요 |
| 11 | testing | `findMaskedResubmissions` 직접 단위 테스트 부재 유예는 plan 의 분기-대응표(6개 분기)가 실제 함수 로직(필터 체인 2개+`hasMaskedLeaf` 재귀)과 정확히 대응함을 확인 — 계량 불가 조건("N개 소비처")을 검증 가능한 주장으로 교체한 개선 | `masked-marker-test-gaps.md:36-57`, `reject-masked-resubmission.ts:115-129` | 조치 불요. plan 의 재개 신호("상위 경유로 못 덮는 분기 발생 시") 유지 |
| 12 | testing | `jest reject-masked-resubmission.spec.ts` 독립 재실행 22/22 통과. 뮤테이션 3종(M1/M2/M3) 예측을 소스 추적으로 재검산해 신규 테스트가 M2 에 영향받지 않고 GREEN 유지됨을 확인 | `reject-masked-resubmission.spec.ts` 전체 | 조치 불요 |
| 13 | documentation | `spec-sync-external-interaction-api-gaps.md` 에 남은 다른 줄 번호 인용(`swagger.md L256/257`, `masked-marker-shared-package.md L192`)은 외부 파일 대상이라 이번 PR 결함 클래스(자기 편집으로 밀리는 줄) 밖 — pre-existing, 향후 해당 파일 편집 시 stale 화 가능성만 참고 | `spec-sync-external-interaction-api-gaps.md:858-859,970` | 조치 불요(참고) |
| 14 | 전체 | `review/**` 하위 자동 생성 산출물(`_retry_state.json`, `meta.json`, 이전 라운드 reviewer `.md`)은 harness 감사 로그로 각 리뷰 관점(보안/유지보수성/테스트/문서화)의 심사 대상이 아님 — 프로젝트 컨벤션상 커밋 대상 | `review/code/2026/08/22/21_15_53/**`, `review/consistency/2026/08/22/20_57_25/**` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 프로덕션 코드 변경 없음. 신규 캐너리가 고정하는 트레이드오프는 spec 이미 승인한 설계, 우회 아님 |
| requirement | NONE | 신규 테스트가 구현·spec Rationale 과 line-level 일치. plan 정량 주장 전부 실측 일치. WARNING 2건 fix 유효성 재확인 |
| scope | NONE | plan 이 선언한 항목만 정확히 집행. 무관 변경·불필요 리팩토링·포맷/import/설정 변경 없음 |
| side_effect | NONE | 순수 함수 호출만, mock/전역상태/env/네트워크/이벤트 콜백 0건 |
| maintainability | NONE | 기존 컨벤션(네이밍·JSDoc·catch 패턴) 일관 준수. 경미한 보일러플레이트 중복(rule-of-three 미달) INFO 1건 |
| testing | NONE | jest 22/22 독립 재실행 통과, 뮤테이션 예측 소스 추적 재검산 일치, vacuous 아님(대조군 포함) |
| documentation | NONE | WARNING 2건 fix 를 grep 으로 직접 재검증, 앵커 문구 유일 매치 확인. JSDoc-소스 대조 정확 |

## 발견 없는 에이전트

없음 (전원 INFO 수준 발견사항을 하나 이상 보고했으나 Critical/Warning 은 0건).

## 권장 조치사항

1. (선택, 블로킹 아님) "reasons 전체 추출" try/catch 보일러플레이트가 3번째 인스턴스가 생기면 `allReasons(schema, raw): string[]` 헬퍼로 추출.
2. (선택, 블로킹 아님) plan 작성 컨벤션에 "동일 PR 내 자기 편집으로 밀리는 줄 번호 인용 대신 앵커 문구 인용" 규칙을 편입해 향후 유사 stale 인용 재발 방지.
3. 즉시 조치 필요한 항목 없음 — 이번 changeset 은 병합 가능 상태.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 표 (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명 전원, 결과 전부 정상 확보됨 — 강제 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 changeset(test-only + 문서)에 비적용 |
  | architecture | router 판단상 이번 changeset(test-only + 문서)에 비적용 |
  | dependency | 신규/변경 의존성 없음 |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 관련 코드 변경 없음 |
  | api_contract | API 계약 변경 없음 |
  | user_guide_sync | 사용자 가이드 영향 없음 |