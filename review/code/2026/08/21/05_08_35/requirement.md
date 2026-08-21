# 요구사항(Requirement) 리뷰 — 마스킹 마커 재제출 서버측 거부 (EIA §R17)

## 검토 범위 및 방법

`reject-masked-resubmission.ts`(신규)와 그 소비처 2곳(`executions.service.ts` `reRun`,
`workflows.controller.ts` `execute`), 타입/매핑 확장(`trigger-parameter.types.ts`),
공유 마스킹 판정기 export 승격(`sanitize-error-message.ts`), 저장소 전역 가드 2건
(`masked-reject-callers-guard`, `production-build-devdep-guard`), 관련 spec 5문서
(`4-nodes/7-trigger/1-manual-trigger.md` §6, `5-system/3-error-handling.md`,
`5-system/12-webhook.md`, `1-data-model.md`, `5-system/14-external-interaction-api.md`
§R17), plan 문서(`spec-update-masked-reject-framing.md`,
`spec-sync-external-interaction-api-gaps.md`)를 대상으로 했다. 프롬프트가 잘라낸 파일은
`Read`로 원본을 직접 열어 확인했고, 관련 backend 테스트(`reject-masked-resubmission`,
`masked-reject-callers`, `production-build-devdep`, `sanitize-error-message`,
`executions-rerun.service`, `workflows.controller`, `resolve-trigger-parameters`)를 실행해
199개 테스트 전부 통과(GREEN)를 실측 확인했다.

이 브랜치는 이미 10라운드 리뷰를 거쳤고(`review/code/2026/08/21/00_03_57` ~ `04_46_40`),
직전 라운드(`04_46_40`)는 CRITICAL 0·WARNING 1(스코프 미고지)로 수렴했다. 이번 diff는
그 WARNING을 해소하는 `CHANGELOG.md` 항목 추가 커밋(`210398cc7`)을 포함한다. 아래는 그
수렴 상태를 그대로 받아쓰지 않고 요구사항 관점에서 독립적으로 재검증한 결과다.

## 발견사항

CRITICAL/WARNING 없음. 아래는 참고용 INFO다.

- **[INFO]** 마스킹 거부 판정(`find→length 체크→throw`)이 두 호출부에 동일하게 중복된다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` (`reRun`, 마스킹
    검사 블록), `codebase/backend/src/modules/workflows/workflows.controller.ts` (`execute`,
    동일 블록) — 둘 다 `resolveTriggerParametersRejectingMasked` 호출 자체는 캡슐화됐지만
    `catch` 블록의 판정-재던지기 형태가 반복된다.
  - 상세: 기능적으로는 문제없다 — 두 곳 모두 같은 wrapper 함수를 호출하므로 판정 로직 자체
    (raw 우선 검사 → resolve → 재검사, 정확 일치, 깊이 상한)는 단일 소스에서 나온다. 응답
    봉투 조립(`code: 'INVALID_INPUT'` vs `'INVALID_TRIGGER_PARAMETERS'`)만 호출부마다 다르게
    남아 있다. 이 항목은 이전 라운드(`00_03_57` WARNING #4)에서도 지적됐고 개선하지 않기로
    한 것은 아니나, 요구사항 충족 여부에는 영향이 없다(maintainability 도메인).
  - 제안: 조치 불요(요구사항 관점). maintainability 리뷰가 이미 별도로 추적.

- **[INFO]** spec 파일 직접 편집 절차 위반이 있었으나 사후에 정규 경로로 흡수·시인됨
  - 위치: `plan/complete/spec-update-masked-reject-framing.md` "⚠️ 절차 위반을 먼저 적는다
    (W3)" 절
  - 상세: 커밋 `50f799efd`(developer 턴)가 `spec/5-system/14-external-interaction-api.md`
    표 행을 직접 수정했다 — CLAUDE.md는 `developer`의 `spec/`을 read-only로 규정하고 spec
    변경은 `project-planner` 위임을 요구한다. 다만 내용 자체는 planner가 이미 확정한
    캐비엇("Manual 실행 경로 전체다")과 일치했고, 이 plan 문서가 사후에 그 변경을 명시적
    승인 범위로 편입했다. 실제로 spec 본문(§6 시점 서술, 3곳의 "재제출 경로" 프레이밍)은
    현재 구현과 line-level로 정확히 일치함을 아래에서 직접 확인했다 — 내용 결함은 없다.
  - 제안: 조치 불요(이미 자체 시인·정정됨). 향후 유사 상황에서 절차 준수만 유의.

## 관점별 확인 결과

1. **기능 완전성**: `resolveTriggerParametersRejectingMasked`는 ①raw 우선 검사(coerce 전,
   문자열이 살아있는 시점) → ②`resolveTriggerParameters` 호출 → ③resolve 결과 재검사(object/
   array가 JSON 문자열로 온 경우 파싱 후 leaf 노출)의 2단계 구조를 정확히 구현한다. 이는
   직전 CRITICAL(`00_03_57`)이 지적한 "resolve 결과만 검사" 결함(`boolean` 완전 우회,
   `number`는 `coerce_failed` 선점, `defaultValue` 과잉 차단)을 근본적으로 해소하는 구조이고,
   `reject-masked-resubmission.spec.ts`의 `[캐너리]` 태그 테스트들이 이 세 갈래를 전부
   회귀로 고정한다(boolean/number/JSON-string 케이스 실측 GREEN).

2. **엣지 케이스**: 스키마 없음/빈 배열(pass-through), raw가 null/비객체("null·비객체 raw를
   안전하게 지나간다" 테스트), 깊이 상한 경계(`MAX_REDACT_DEPTH`·`+1`), object/array 혼합
   중첩, 매우 깊은 입력(5,000단 재귀에서 스택 안전), `defaultValue`가 마커와 우연히 일치하는
   경우(과잉 차단 방지 — raw에 실제로 있는 키만 대상) 모두 명시적 테스트로 커버된다. 코드
   레벨에서도 `hasOwnProperty` 필터로 `defaultValue`만 채워진 필드를 배제하고, `isRecord`
   가드로 배열/원시값 raw를 안전하게 무시한다.

3. **TODO/FIXME**: 이번 diff의 `codebase/` 변경분에 TODO/FIXME/HACK/XXX 주석 없음(전수
   grep 확인).

4. **의도와 구현 간 괴리**: 함수명(`resolveTriggerParametersRejectingMasked`,
   `findMaskedResubmissions`, `hasMaskedLeaf`)과 docstring이 서술하는 동작(§R17 서버측 2층,
   Manual 실행 경로 한정, raw 우선+resolve 후 재검사)이 실제 구현과 정확히 일치한다.
   `masked-reject-callers-guard.ts`의 허용목록(`ALLOWED_DIRECT_CALLERS`)도 실제 소비처
   (`hooks.service.ts`, `schedule-runner.service.ts`가 base 함수를, `executions.service.ts`/
   `workflows.controller.ts`가 wrapper를 사용)와 정확히 일치함을 직접 grep으로 재확인했다.

5. **에러 시나리오**: `TriggerParameterValidationException` → `BadRequestException({ code,
   message, details })` 변환이 두 호출부 모두에서 `details`(아닌 `errors`)로 배선됨을
   확인했고, `GlobalExceptionFilter`(`http-exception.filter.ts:73`)가 실제로 `resp.details`
   만 읽는다는 것을 소스에서 직접 검증했다 — 선존 버그("errors 키가 조용히 버려짐") 수정
   주장이 사실과 일치한다. 회귀 테스트(`executions-rerun.service.spec.ts` "[회귀] 거부
   응답이 details[]로 필드별 코드를 싣는다")가 `body.errors`가 `undefined`임을 명시적으로
   단언해 재발을 막는다.

6. **데이터 유효성**: 대상 키 집합을 항상 raw 기준으로 잡아(② 단계에서도 `rawSource`를
   재사용) 사용자가 손대지 않은 필드를 검증 대상에서 제외한다. 정확 일치만 검사해(`a***b`
   같은 부분 포함 값은 통과) 과잉 차단을 방지하는 것도 코드·테스트 양쪽에서 확인된다.

7. **비즈니스 로직**: "판정 기준은 출처가 아니라 페이로드의 저작 주체"라는 범위 규칙이
   `masked-reject-callers-guard.ts`의 허용목록(webhook·schedule은 base 함수 직접 사용
   허용)과 실제 라우팅(두 Manual 엔드포인트만 wrapper 사용)에 정확히 반영된다. re-run은
   `useOriginalInput`(기본 `true`)일 때 `original.inputData`(원본 DB 값, egress 마스킹
   미적용)를 그대로 재사용하는 경로라 마커 거부를 거치지 않는데, 이는 사용자가 값을 다시
   저작하지 않는 경로이므로 §R17의 "저작 주체" 기준에 정확히 부합한다(의도된 설계).

8. **반환값**: `resolveTriggerParametersRejectingMasked`는 두 검사 단계 모두 통과 시
   `resolveTriggerParameters`의 resolve 결과를 그대로 반환하고, 위반 시 예외를 던진다 —
   모든 경로에서 정의된 동작을 갖는다. `findMaskedResubmissions`는 스키마 없음/raw
   비객체일 때 빈 배열을 반환해 호출부가 `undefined` 분기를 따로 처리할 필요가 없다.

9. **spec fidelity**: 관련 spec 5문서를 grep+직접 대조했다.
   - `spec/4-nodes/7-trigger/1-manual-trigger.md:170` — reason/시점 서술이 "`adapter
     resolveTriggerParameters` **전후 2단계** — raw(coerce 전) 우선 검사 → resolve → resolve
     후 재검사"로, 구현(① raw 검사 → throwIfAny → ② resolve → resolve 후 재검사)과 정확히
     일치.
   - `spec/5-system/3-error-handling.md:193` — "Manual 실행 경로 한정...재제출뿐 아니라
     사용자가 직접 입력한 마커도 대상"으로, 구현의 raw 기준 검사(재제출 여부와 무관하게
     raw에 마커가 있으면 거부)와 일치.
   - `spec/5-system/12-webhook.md:312` — webhook 경로가 대상 아님을 "페이로드의 저작 주체"
     기준으로 서술, `hooks.service.ts`가 base 함수(`resolveTriggerParameters`)만 사용하는
     실제 구현과 일치.
   - `spec/1-data-model.md:471` — `input_data` 필드 설명이 "서버도 2층으로 거부...Manual
     실행 경로(저작 주체 기준, 재제출뿐 아니라 직접 입력도 포함)"로 갱신돼 구현과 일치.
   - `spec/5-system/14-external-interaction-api.md:1573` — EIA §R17 표 행이 "서버 (Manual
     실행 경로)"로 라벨링되고 "Manual 실행 경로 두 곳...재제출만이 아니라 fresh 입력도
     대상"으로 서술 — 직전 라운드(`00_03_57` WARNING #7)가 지적한 표 행/캐비엇 불일치가
     해소된 상태를 확인했다.
   - `spec/5-system/13-replay-rerun.md:246,377-378` — `400 INVALID_INPUT` +
     `details[].code = MASKED_VALUE_RESUBMITTED`로 정확히 일치.

   SPEC-DRIFT 없음 — line-level 불일치를 발견하지 못했다. `plan/complete/
   spec-update-masked-reject-framing.md`가 서술한 3건의 정정(§6 시점, 3곳의 "재제출 경로"
   프레이밍)이 실제로 spec 본문에 반영돼 있음을 확인했다(위 절차 위반 INFO 항목 참고).

## 요약

핵심 기능(마스킹 마커 재제출 서버측 거부, EIA §R17)은 의도한 대로 완전히 구현돼 있다.
raw 우선 검사 → resolve → resolve 후 재검사의 2단계 구조가 이전 라운드의 CRITICAL(boolean
완전 우회·number 오분류·defaultValue 과잉 차단)을 근본적으로 해소하며, 이는 코드 구조뿐
아니라 대응 테스트(캐너리 태그로 의도 명시)로 실측 고정돼 있다. 에러 응답 봉투 배선
(`errors`→`details`) 수정은 `GlobalExceptionFilter`의 실제 동작과 대조해 정당함을 확인했고,
관련 spec 5문서는 구현과 line-level로 정확히 일치하며 SPEC-DRIFT가 발견되지 않았다. 저장소
전역 CI 가드 2건(호출부 허용목록·devDependency 누출 방지)도 목적에 부합하게 동작하며 실제
소비처 실측과 일치한다. 관련 테스트(199개, requirement 재검증 범위)는 모두 GREEN이다. 남은
항목은 요구사항 충족과 무관한 유지보수성 관찰(중복 3줄)과 이미 자체 시인·정정된 절차 메모
뿐이다.

## 위험도

NONE
