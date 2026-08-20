# 테스트(Testing) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (10라운드째, 04_46_40)

## 검토 방법

실질 프로덕션 코드(`reject-masked-resubmission.ts`/`.spec.ts`, `resolve-trigger-parameters.spec.ts`,
`executions.service.ts`, `executions-rerun.service.spec.ts`, `workflows.controller.ts`/`.spec.ts`,
`masked-reject-callers-guard.ts`/`.spec.ts`, `production-build-devdep-guard.ts`/`.spec.ts`,
`sanitize-error-message.ts`/`.spec.ts`, `tsconfig.build.json`)를 `Read` 로 직접 열어 대조했다
(프롬프트가 크기 제한으로 diff 를 생략한 8개 파일 포함). 관련 7개 spec 스위트를 `jest` 로 직접
재실행해 **189/189 통과**를 실측했다.

이 변경은 이미 9라운드(`00_03_57`~`04_20_10`) 리뷰를 거쳐 CRITICAL 1건(boolean 완전 우회)과
다수 WARNING 이 해소된 상태다 — `04_20_10` RESOLUTION 이 마지막 WARNING("빌드 산출물 devDep
누출 보장이 수동 1회 확인에만 의존")을 `production-build-devdep-guard.ts`/`.spec.ts` 로 처분한
직후가 이번 diff 다. 따라서 이번 라운드는 기존 발견 재탕이 아니라 **직접 뮤테이션 검증**으로
"GREEN 이 증거가 되는가"를 재확인하는 데 무게를 뒀다.

### 직접 수행한 뮤테이션 검증 (2건, 둘 다 RED 로 정확히 죽음 → 원복)

1. `reject-masked-resubmission.ts` 의 `hasMaskedLeaf` 에서 값 검사↔깊이 검사 순서를 뒤집음
   (off-by-one 재현) → `[경계] 상한 깊이의 마커는 잡는다` / `[경계] 배열 분기도 같은 보폭` 2건이
   정확히 RED. 문서가 주장하는 "값 검사가 깊이 검사보다 먼저" 라는 순서 불변식이 실제로
   테스트에 의해 강제됨을 확인.
2. `masked-reject-callers-guard.ts` 의 `findUnexpectedCallers` 필터를 `.filter(() => false)` 로
   무력화 → `[캐너리] 허용목록 밖 위반을 실제로 탐지한다 (합성 fixture)` 1건이 정확히 RED,
   나머지 14건은 GREEN 유지. 가드가 "탐지를 멈춰도 아무도 모른다"는 형태(이 시리즈가 반복
   겪은 결함 클래스)에 대한 자체 방어가 실효성 있음을 확인.

두 뮤테이션 모두 원본으로 원복 후 `git status --short` 로 클린 상태 재확인했다.

## 발견사항

없음 (CRITICAL/WARNING 신규 없음). 아래는 전부 **이미 이전 라운드에서 식별·의도적으로
보류(deferred)된 항목**의 상태 재확인이며, 이번 diff 로 상태 변화가 없다.

- **[INFO] (carry-over, `03_14_16`→`04_20_10` 재확인 동일)** `findMaskedResubmissions`
  (exported, `reject-masked-resubmission.ts`)는 여전히 직접 단위 테스트가 없고
  `resolveTriggerParametersRejectingMasked` 경유로만 간접 커버된다.
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`
    — `findMaskedResubmissions` 함수 선언부
  - 상세: `grep -rl findMaskedResubmissions --include=*.spec.ts` 결과 0건 재확인. 상위 함수가
    raw/resolve 두 phase·경계값·왕복 통합을 촘촘히 덮고 있어 실질 회귀 위험은 낮다는 이전
    판단은 유효하다. 재지적 아님 — 상태 불변 확인.

- **[INFO] (carry-over, `01_15_47` INFO-3 재확인)** 문서화된 phase 간 트레이드오프
  ("① 통과 후 무관한 필드의 진짜 `coerce_failed` 가 resolve 를 조기 중단시키면 ②의 JSON
  문자열 안 마커 검사는 실행되지 않는다")가 `reject-masked-resubmission.ts` 의 `throwIfAny`
  doc comment 에 명시돼 있으나, 그 특정 상호작용 자체를 고정하는 회귀 테스트는 없다.
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`
    — `throwIfAny` 함수 위 doc comment
  - 상세: 현재 테스트(`raw 에서 걸리면 coerce_failed 가 섞이지 않는다`)는 "같은 phase(raw)
    안에서 마스킹 필드 + 무관한 bad-type 필드가 공존할 때 마스킹 사유만 나온다"만 검증한다.
    문서가 서술하는 반대 케이스("raw phase 는 통과하지만 resolve 가 무관한 필드의 진짜
    타입 오류로 조기 예외를 던져 ②(JSON 문자열 안 마커) 검사가 아예 실행되지 않는다")는
    검증되지 않는다. 보안 우회가 아니라 UX 지연(사용자가 타입 오류를 먼저 고쳐야 마커
    안내를 본다)이라는 성격 판단은 타당해 보이고, 이미 의식적으로 미조치 확정된 항목이라
    이번에도 조치를 요구하지 않는다 — 다만 이 문서화된 동작이 "그대로 유지된다"는 보장은
    여전히 사람의 doc comment 뿐이라는 점만 재확인해 둔다.

- **[INFO] (신규 관찰, 낮은 우선순위)** 프런트(`masked-markers.ts`)와 백엔드
  (`sanitize-error-message.ts`)의 `MASKED_MARKERS` 리터럴은 각자 자기 스위트 안에서만
  리터럴-대-리터럴로 고정되고, 두 값이 서로 같다는 것을 강제하는 크로스-런타임(jest↔vitest)
  테스트는 없다.
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts` (`MASKED_MARKERS
    불변성` describe 블록) / `codebase/frontend/src/lib/utils/__tests__/masked-markers.test.ts`
    ("마커 집합이 이 리터럴 목록에서 이탈하지 않는다" 테스트)
  - 상세: 이건 내가 새로 발견한 게 아니라 **frontend 테스트 자신의 doc comment 가 이미
    명시적으로 자백하고 있다** — "못 지킨다: backend 가 바뀌는 것... 진짜 크로스체크가
    아니다... 공유 패키지 추출이 선행돼야 값싸다(트래커 '마커 미러 계약 테스트' 항목)".
    즉 이미 인지·트래킹된 한계이고, 스코프상 이번 PR 에서 처리할 항목이 아니다. 참고로만
    남긴다.
  - 제안: 없음 (이미 별도 트래커 항목으로 관리 중).

## 강점 (반증 아님, 정성적 확인 + 뮤테이션 실측)

- **뮤테이션 저항성 실측**: 위 두 뮤테이션 모두 정확한 캐너리 1~2건만 죽이고 나머지는
  GREEN 유지 — 캐너리가 서로 겹치지 않고 각자 고유한 불변식을 지킨다는 팀 자체 주장
  (`04_20_10` RESOLUTION 의 3-뮤턴트 재검증 표)과 일관된 결과를 독립적으로 재현했다.
- **실행 확인**: `reject-masked-resubmission.spec.ts` · `resolve-trigger-parameters.spec.ts` ·
  `executions-rerun.service.spec.ts` · `workflows.controller.spec.ts` ·
  `masked-reject-callers.spec.ts` · `production-build-devdep.spec.ts` ·
  `sanitize-error-message.spec.ts` 7개 스위트, 189건 전부 통과 실측.
- **Mock 적절성**: 두 호출부(`executions.service.ts`/`workflows.controller.ts`) 스펙 모두
  `resolveTriggerParametersRejectingMasked` 자체를 스텁하지 않고 실코드 경로를 그대로 태운다.
  정확성이 중요한 판정 로직을 mock 으로 대체하지 않은 선택이 타당하다.
- **테스트 격리**: `executions-rerun.service.spec.ts` 는 `beforeEach` 에서
  `getOneQueue`/`chainDepth`/모든 repo mock 을 매번 재생성해 신규 3개 테스트가 기존 테스트에
  상태를 흘리지 않는다. `masked-reject-callers.spec.ts`/`production-build-devdep.spec.ts` 의
  합성 fixture 는 `fs.mkdtempSync` + `try/finally` + `fs.rmSync(recursive:true)` 로 격리·정리된다.
- **회귀 테스트가 정확한 반대 부호를 겨눈다**: `errors` vs `details` 봉투 버그의 회귀 테스트가
  `body.errors` 가 `undefined` 임을 **함께** 단언해 재발을 놓치지 않는다. boolean 완전 우회
  캐너리도 실제로 뚫렸던 그 경로(`Boolean('***') → true`)를 정확히 재현한다.
- **경계 커버리지**: 정확 일치 vs 부분 포함, 깊이 상한 및 ±1, 동종/혼합 중첩, 스택 안전성
  (depth 5000), 실제 마스커 왕복 통합까지 촘촘하다. 가드 두 개는 각각 7종/4종+2종의 우회
  형태를 `it.each` 로 전수 고정하고, "가드가 실제로 탐지하는가"를 합성 fixture 로 별도
  검증해 "누출 없음 = GREEN" 이 무보증이 될 위험을 스스로 차단했다.

## 요약

CRITICAL/WARNING 신규 발견 없음. 9라운드에 걸쳐 수렴한 테스트 스위트를 직접 재실행(189/189
통과)하고, 핵심 순서 불변식(`hasMaskedLeaf` 값 검사 우선)과 가드 자체의 탐지 실효성
(`findUnexpectedCallers` 필터) 두 곳에 대해 독립적으로 뮤테이션을 주입해 캐너리가 정확히
반응함을 실측했다 — 팀이 스스로 수행·기록한 뮤테이션 검증 결과와 일치한다. 남은 항목은
전부 이전 라운드에서 이미 식별·의도적으로 보류된 INFO 이며 이번 diff 로 상태 변화가 없다
(`findMaskedResubmissions` 직접 단위 테스트 부재, phase 경계 트레이드오프의 미검증, 프런트·
백엔드 마커 리터럴의 크로스-런타임 미검증 — 마지막 것은 frontend 테스트 자신이 이미 자백·
트래킹 중). 런타임 방어 로직은 `01_15_47` 이후 아홉 라운드 연속 CRITICAL 0/WARNING 0 이고,
이번 라운드도 그 상태를 유지한다.

## 위험도

LOW
