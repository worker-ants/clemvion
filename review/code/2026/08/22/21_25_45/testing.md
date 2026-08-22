# 테스트(Testing) 리뷰 — masked-marker-test-gaps (`21_25_45`)

## 리뷰 범위 및 검증 방법

이번 changeset 의 실질 프로덕션/테스트 코드 변경은 이전 라운드(`21_15_53`)와 **동일하다** —
`codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts` 에
신규 캐너리 테스트 1건(`[캐너리] 무관한 필드의 coerce 실패가 ② 마커 검사를 선점한다`,
`:327-354`) 추가가 전부다. 이번 라운드 diff 에 새로 실린 것은 (a) plan 트래커의 줄 번호 인용을
숫자 → 앵커 문구로 바꾼 수정, (b) 이전 리뷰 라운드(`21_15_53`)의 산출물(SUMMARY/RESOLUTION/개별
reviewer 리포트/consistency-check 산출물) 커밋 — 둘 다 실행 코드가 아니다.

독립 재검증(이전 라운드의 주장을 그대로 신뢰하지 않고 직접 재실행):

- `npx jest reject-masked-resubmission.spec.ts` 직접 실행 → **22/22 통과** 확인(재현됨).
- `reject-masked-resubmission.ts`(`throwIfAny`, `findMaskedResubmissions`) 및
  `resolve-trigger-parameters.ts`(에러 수집 후 일괄 throw 구조, `:132-159`)를 직접 읽어 신규
  테스트가 주장하는 phase 경계 트레이드오프(① raw 통과 → ②(JSON 문자열 내부 마커) 도달 전
  무관 필드의 `coerce_failed` 가 예외를 선점)가 실제 구현과 일치함을 확인.
- plan 문서(`masked-marker-test-gaps.md`)의 트래커 앵커 인용(`throwIfAny` 의 phase 경계
  트레이드오프 미검증`, `findMaskedResubmissions` 직접 단위 테스트 부재`)이 `grep -n` 으로
  `spec-sync-external-interaction-api-gaps.md` 에서 유일하게 매치됨을 확인 — 앵커 방식 전환이
  실제로 유효하다.
- plan 이 서술한 뮤테이션 3종(M1 hoist / M2 phase 병합 / M3 ② 제거) 예측을 소스 코드 추적만으로
  독립 재검산: M2(`throwIfAny(rawHits)` 제거)는 신규 테스트의 실험군(`payload` 는 object 타입이라
  raw 단계에서 안 걸리고 오직 phase②(resolve 후)에서만 걸리는 구조)에는 영향이 없어 신규
  테스트가 GREEN 으로 남는다는 결론이 논리적으로 맞는다(공유 worktree 뮤테이션 재실행은 병렬
  리뷰어 오염 방지를 위해 수행하지 않음 — 코드 추적으로 대체).

## 발견사항

### [INFO] 신규 캐너리는 vacuous 하지 않음 — 대조군 포함, 독립 재현으로 확인
- 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts:327-354`
- 상세: 대조군(`count: 1`, line 336-338)이 실제로 `['payload']` 를 잡는 것을 먼저 단언하고, 실험군(`count: 'not-a-number'`, line 341-352)이 `coerce_failed` 만 보고하고 `masked_value_resubmitted` 는 없음을 단언한다. 대조군이 없었다면 "애초에 phase② 도 못 잡는 값" 으로도 통과했을 것 — 이 우려가 plan 문서에 명시돼 있고 실제로 대조군이 그 리스크를 닫는다. `jest` 재실행으로 GREEN 확인.
- 제안: 조치 불요.

### [INFO] `findMaskedResubmissions` 직접 단위 테스트 부재 유예 — 근거가 실측에 부합
- 위치: `plan/in-progress/masked-marker-test-gaps.md:36-57` (§②), `reject-masked-resubmission.ts:115-129`
- 상세: 유예 근거로 제시된 분기-대응 표(빈 스키마/비객체 raw/rawSource 키 필터/정확 일치 경계/깊이 상한/다중 필드 수집)를 `findMaskedResubmissions` 실제 로직과 대조한 결과 표에 나열된 6개 분기가 함수 본문(필터 체인 2개 + `hasMaskedLeaf` 재귀)과 정확히 대응한다. "N개 소비처가 되면" 이라는 원래 유예 조건 대신 "실제 커버리지" 로 근거를 교체한 것은 계량 불가능한 조건을 검증 가능한 주장으로 바꾼 개선이다.
- 제안: 조치 불요. plan 이 적은 재개 신호("상위 경유로 못 덮는 분기가 생기면")를 향후 회귀 트리거로 유지할 것.

### [INFO] reasons 추출 try/catch 보일러플레이트가 파일 내 2곳(기존 1 + 신규 1)으로 중복
- 위치: `reject-masked-resubmission.spec.ts:341-351`(신규), 기존 동형 블록 `:295-307`
- 상세: `rejectedFields` 헬퍼(`:28-41`)는 `masked_value_resubmitted` 사유만 필터링하므로, `coerce_failed` 를 포함한 전체 reason 이 필요한 두 테스트는 매번 인라인 try/catch 를 반복한다. 기능 결함은 아니고 기존 관행을 그대로 따른 것이라 이번 diff 만의 신규 문제는 아니다. maintainability 리뷰(이전 라운드)와 견해 일치.
- 제안: 지금 당장 블로킹 아님(인스턴스 2개, rule of three 미달). 3번째 유사 테스트가 생기면 `allReasons(schema, raw): string[]` 헬퍼로 추출 권장.

### [INFO] 테스트 격리 — 회귀 없음
- 위치: `reject-masked-resubmission.spec.ts` 전체
- 상세: 신규 테스트는 지역 변수만 쓰고 `beforeEach`/공유 mutable 상태가 없다. `resolveTriggerParametersRejectingMasked`/`findMaskedResubmissions` 를 mock 없이 실제로 호출하는 방식이라 mock-실제 동작 괴리 우려도 없다. 22개 테스트 단독 실행으로 GREEN 재확인 — 순서 의존성 없음.
- 제안: 조치 불요.

### [INFO] 리뷰 산출물 파일(SUMMARY/RESOLUTION/개별 reviewer .md/consistency-check json) 은 테스트 관점 분석 대상 아님
- 위치: `review/code/2026/08/22/21_15_53/**`, `review/consistency/2026/08/22/20_57_25/**`
- 상세: 이번 diff 에 새로 포함된 대부분의 파일이 이전 리뷰 라운드의 산출물이다. 프로젝트 컨벤션상 `review/**` 산출물은 커밋 대상이며 실행 코드/테스트 코드가 아니라 테스트 관점 리뷰의 범위 밖이다.
- 제안: 조치 불요.

## 요약

이번 diff 의 유일한 실질 코드 변경(`reject-masked-resubmission.spec.ts` 캐너리 테스트 1건)은 이전 라운드에서 이미 검증됐고, 이번 라운드에서 `jest` 재실행(22/22 GREEN)과 구현 소스(`throwIfAny`, `findMaskedResubmissions`, `resolveTriggerParameters` 에러 수집 구조) 직접 추적으로 독립 재검증해도 동일한 결론이다 — 대조군을 포함해 vacuous 하지 않고, mock 없이 실제 함수를 호출하며, 격리·가독성 문제가 없다. `findMaskedResubmissions` 직접 단위 테스트 부재는 plan 문서가 분기 대응표로 실측 근거를 남기며 유예를 재확정했고 그 표가 실제 함수 로직과 일치함을 확인했다. 이번 라운드에 새로 실린 변경(plan 트래커 줄 번호 → 앵커 문구 전환, 이전 리뷰 산출물 커밋)은 테스트 코드가 아니며 테스트 관점 결함을 유발하지 않는다. Critical/Warning 급 결함 없음.

## 위험도
NONE
