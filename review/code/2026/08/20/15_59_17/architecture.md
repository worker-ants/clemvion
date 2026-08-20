STATUS=success ISSUES=1

===REPORT_MARKDOWN_BELOW===
# 아키텍처(Architecture) 코드 리뷰 — eia-inputdata-marker-guard (15_59_17)

## 컨텍스트

이 changeset(`origin/main...HEAD`)은 `Execution.inputData` egress 마스킹 카브아웃 폐지 + 재제출
소비처 3곳(폼 프리필 · Re-run 모달 · 에디터 히스토리 로드) 마커 가드 신설을 다룬다. 같은 diff
에 대해 이미 네 라운드(`14_08_45` → `14_44_08` → `15_10_25` → `15_32_34`)의 아키텍처 리뷰가
CRITICAL 0 / LOW 로 수렴한 상태다. 프롬프트에 실린 diff 의 대부분(파일 25개 이상)은 그 네
라운드가 남긴 `review/**` 리포트·RESOLUTION 산출물이며 애플리케이션 코드가 아니라 이번 관점의
대상이 아니다. 실제 `codebase/**` 델타는 직전 라운드(`15_32_34`) 이후 커밋 `38b4669bd` 1개뿐이고,
`git diff 29d00021d..38b4669bd -- codebase/` 로 실측한 범위는 (1) `rerun-modal.tsx` 에 세 번째
차단 조건(`isStructuredField`) 추가, (2) 대응 테스트, (3) `executions.service.ts` JSDoc 문구
정정(이미 별도 라운드에서 처리된 것 재확인)으로 한정된다. 이번 라운드는 그 델타를 중심으로
재검토했다.

## 발견사항

- **[WARNING]** 세 라운드에 걸쳐 우회가 반복 발견된 마스킹-차단 판정 로직이 여전히 컴포넌트
  내부 인라인 클로저로만 존재하고, 직접 단위 테스트가 불가능한 구조다 (Single Responsibility /
  테스트 용이성)
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx:359` (`isStructuredField`
    선언), `:364-371` (`blockedByMaskedInput` 계산)
  - 상세: 이 판정 로직은 지금까지 3라운드에 걸쳐 서로 다른 경로로 뚫린 이력이 있다 — (1) 값이
    비었는가만 보면 `coerceInput("boolean","")` 이 `false` 를 만들어 조용히 풀림(`14_08_45` W2),
    (2) 사용자가 건드렸는가만 보면 건드린 뒤 값을 다시 마커로 되돌려도 영구 해제(`14_44_08` W2),
    (3) 이번 라운드가 반영한 세 번째 조건 추가 이전에는 object/array 필드를 무효 JSON 으로
    깨뜨리면 `coerceInput` 이 raw 문자열로 폴백해 `hasMaskedMarkerLeaf` 의 정확 일치를
    피해가며 풀림(`15_32_34` W1, 리뷰어가 직접 재현). 세 번 모두 "논리를 고치는" 방식으로
    처방됐고, 세 번 모두 재현에는 스키마 비동기 로드·`fireEvent.change` 시퀀스·`waitFor` 체인을
    갖춘 전체 컴포넌트 렌더 테스트가 필요했다(`rerun-modal.tsx` 델타 diff 의 신규 canary
    `it("[캐너리] object 필드를 무효 JSON 으로 만들어도 계속 막는다", ...)` 참조 — 순수 로직
    하나를 검증하는 데 mock API·정의 스토어 시딩·비동기 대기가 전부 필요하다). 이 프로젝트는
    바로 이 실패 형태(판별 로직이 컴포넌트에 갇혀 있어 엣지 케이스가 반복 누락됨) 때문에
    `isMaskedMarker`/`hasMaskedMarkerLeaf` 를 `dynamic-form-ui.tsx` 밖으로 승격해
    `lib/utils/masked-markers.ts` 로 만들고 직접 단위 테스트(`masked-markers.test.ts`)를
    붙였다(CHANGELOG.md 상단 항목, 같은 PR). 그런데 `blockedByMaskedInput`/`isStructuredField`
    는 정확히 같은 성격의 판정 로직이면서도 그 처방을 받지 못하고 여전히 컴포넌트 클로저에
    남아 있다 — 3연속 회귀가 난 자리가 유일하게 "동일 교훈"이 적용되지 않은 자리다.
  - 제안: `blockedByMaskedInput` 계산(세 조건의 결합)을 `isStructuredField` 와 함께 순수 함수로
    추출(예: `computeBlockedByMaskedInput(maskedKeys, touchedMaskedKeys, paramValues, fields,
    useOriginalInput)` 형태로 `lib/utils/masked-markers.ts` 또는 인접 모듈에)해 컴포넌트 렌더
    없이 직접 단위 테스트할 수 있게 한다. 판정 조건이 네 번째로 늘어날 가능성(예: 배열 타입
    필드의 다른 폴백 형태)에 대비해 조건을 한곳에 모아 두면, 다음 엣지 케이스도 render 하네스
    없이 빠르게 캐너리로 고정할 수 있다. 이번 PR 을 막을 사안은 아니다.

## 확인했으나 재지적하지 않은 것 (이미 트래커 등재 / 이전 라운드 확인 완료)

- backend 마스킹 관문이 `executions.service.ts`(`toResponseExecution`/`toExecutionDto`/
  `findById` 의 `nodeExecutions[]` map) + `background-runs.service.ts` 4곳 이상으로 분산돼
  있는 것은 `15_32_34` 아키텍처 라운드가 이미 지적했고 `plan/in-progress/
  spec-sync-external-interaction-api-gaps.md`(2026-08-20 등재 #4)에 별건 리팩터로 트래킹
  중이다 — 이번 델타(`isStructuredField` 추가)는 이 fragmentation 을 늘리지 않았다.
- frontend `MASKED_MARKERS`(`codebase/frontend/src/lib/utils/masked-markers.ts:18-22`)가
  backend `sanitize-error-message.ts` 상수를 손으로 복제하고 계약 테스트가 없는 점도
  같은 라운드가 이미 지적·트래커 등재(`12_33_36`/`15_32_34`) 상태이며 이번 델타와 무관하다.
- `lib/utils/masked-markers.ts` 승격이 고친 의존 방향 개선(모달/툴바가 폼 컴포넌트를 더 이상
  import 하지 않음)은 이전 라운드가 이미 "긍정적 개선"으로 기록했고 이번 델타에서 변경되지
  않았다 — 재확인만 하고 반복 서술하지 않는다.

## 요약

이번 라운드가 검토한 실질 델타(`isStructuredField` 세 번째 차단 조건 추가)는 SOLID·순환
의존·레이어 경계·모듈 경계 어느 축에서도 새로운 구조적 결함을 만들지 않았고, 막으려던
우회(coerce 실패 시 raw 문자열 폴백)를 정확히 막는다. 다만 이 판정 로직이 3라운드 연속으로
서로 다른 경로로 뚫려 온 이력에도 불구하고 여전히 컴포넌트 내부 인라인 클로저로만 존재해
render 하네스 없이는 단위 테스트할 수 없다는 점은, 같은 PR 이 `isMaskedMarker`/
`hasMaskedMarkerLeaf` 에 대해 정확히 반대로(컴포넌트 밖 순수 함수 + 직접 단위 테스트) 처방한
것과 대비된다 — 다음 엣지 케이스가 또 나올 경우 같은 재현 비용을 반복하게 될 구조적 위험으로
WARNING 1건을 새로 남긴다. 그 외 이전 라운드가 지적한 기존 아키텍처 부채(backend 마스킹 관문
4곳 이상 분산, frontend/backend 마커 미러 수동 동기화)는 이미 트래커에 등재돼 있고 이번 델타가
그 규모를 늘리지 않아 재지적하지 않는다.

## 위험도

LOW
