# 유지보수성(Maintainability) 리뷰

## 검토 범위 확인

`git log`/`git diff origin/main...HEAD --stat` 로 실제 소스를 대조했다. 이번 라운드(`20_25_08`)의
diff 는 68개 파일이지만 실행 코드(런타임 로직) 변경은 여전히 4개 TS 파일뿐이다:
`trigger-parameter.types.ts`(+9) · `resolve-trigger-parameters.ts`(+27/-2) ·
`re-run.dto.ts`(+4/-4, 최신 커밋 `a578366c7` 로 재개정) · `workflows.controller.ts`(+6/-3). 전부
JSDoc·인라인 주석·Swagger `description` 문자열 변경이며 조건문·반환값·시그니처·분기 변경은
0줄이다. 나머지 64개 파일은 `plan/**`·`review/code/**`·`review/consistency/**`·spec
frontmatter 로 코드 구조적 지표(함수 길이·중첩·매직 넘버·중복·순환 복잡도)와 무관한 프로세스
산출물이라 이 리뷰의 8개 관점을 적용할 대상이 아니다.

이 diff 는 이미 세 차례 AI 리뷰(`19_25_39`, `19_36_12`, `20_05_07`)를 거쳤고 매 라운드
RESOLUTION.md 로 처분됐다. 이번 라운드에서 새로 추가된 커밋은 `4a1c8bc48`(요약+SoT 링크화)과
`a578366c7`(길이 가이드 안으로 재축약, `20_05_07` 이후 신규)이며, 두 커밋 모두 `re-run.dto.ts` 의
Swagger description 만 건드렸다. 4개 코드 파일 전체를 `Read` 로 직접 열어 프롬프트의 게이트 번호와
대조했고, 실제 소스와 일치했다.

## 발견사항

- **[INFO]** (긍정 기록) `re-run.dto.ts` Swagger description 이 이번 라운드에 다시 축약되어 길이
  가이드 예외에 기대지 않는 형태로 개선됨
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts:20-22`
  - 상세: 직전 라운드(`20_05_07`)가 관측한 236자 버전("마커 리터럴 verbatim 나열 + 부분일치
    캐비엇")이 이번 diff 로 129자로 다시 줄었다(`swagger.md §3` 길이 가이드 상한 150자 이내).
    캐비엇의 핵심(마커 정확 일치 → `400 MASKED_VALUE_RESUBMITTED`)과 `SoT: EIA §R17` 링크는
    유지한 채, "응답 필드 전용" 길이-예외 조항에 기대는 대신 가이드 본문 안으로 들어갔다. 유지보수
    관점에서는 두 가지 이점이 있다: (1) 다음에 이 필드를 만질 사람이 "이 예외가 나를 덮는가"를
    매번 재해석할 필요가 없다, (2) 문자열이 더 짧아 스캔하기 쉽다. 예외 조항의 문면 범위 갭
    자체는 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`에 별도 항목으로
    등재되어 있어 은폐되지 않았다.
  - 제안: 없음(긍정 기록).

- **[INFO]** `REASON_TO_DETAIL` 신규 JSDoc 3건 중 하나만 단일행, 나머지 둘은 다중행 — 직전
  라운드부터 이월, 상태 변화 없음
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts:40`
    (`missing_required` — 단일행 `/** ... */`) vs `:45-48`(`coerce_failed` — 다중행), `:53-56`
    (`invalid_schema` — 다중행)
  - 상세: 같은 `Record` 리터럴 안 형제 항목이 동일 목적("사용자가 취할 행동" 서술)의 주석을 서로
    다른 물리적 블록 스타일로 달고 있다. 이 지적은 `19_36_12` 라운드가 이미 냈고 그 RESOLUTION 이
    "`missing_required`는 한 줄로 충분하고, 길이에 맞춰 포맷을 고르는 것이 파일 전체의 기존 관례"
    라는 이유로 의도적으로 보류(won't-fix)했다. 이번 라운드에도 동일 상태이며 새 회귀는 아니다.
  - 제안: 조치 불요(이미 트리아지됨).

- **[INFO]** `resolveTriggerParameters` 함수 JSDoc 블록(24줄)이 함수 본문(약 30줄)에 근접할 만큼
  길다 — 상태 변화 없음
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:100-123`
    (JSDoc) / `:124` 이하(함수 본문)
  - 상세: 블록은 전부 한국어로 통일되어 있다(`19_25_39` WARNING이 정확히 해소된 상태 재확인).
    `## ⚠️ Manual 실행 경로는 이 함수를 직접 부르지 않는다` 절이 wrapper 역참조·CI 가드 경로·spec
    §R17 인용까지 담아 길다. "또 다른 wrapper 가 추가되면 분리를 검토"라는 조건이 `19_36_12`부터
    달려 있고, 이번 라운드에도 wrapper 는 여전히 `resolveTriggerParametersRejectingMasked` 1개뿐이라
    조건 미충족.
  - 제안: 조치 불요. 두 번째 wrapper 등장 시 별도 모듈 문서로 분리 검토(이미 트래킹됨).

- **[INFO]** `workflows.controller.ts`의 `execute()` 메서드는 여전히 한/영 인라인 주석 혼재 —
  의도적으로 좁힌 스코프, 신규 회귀 아님
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` — 영문으로 남은 부분:
    `execute()` 메서드 초입의 `// Verify workflow belongs to workspace`,
    `// Resolve trigger parameters against...`, `// Stamp the trigger-source marker...`(전부
    이번 diff 게이트 밖, 변경 없음). 한국어화된 부분: 이번 diff 의 `:320-322`
    (``details` 가 아니라 ...`` 주석).
  - 상세: `plan/complete/masked-marker-cosmetic-followups.md`가 스코프를 "같은 try/catch 블록"으로
    명시적으로 좁혔고 diff 도 그 범위만 건드렸다. 세 차례 이전 라운드가 이미 같은 사실을 INFO로
    기록했고 이번 라운드에도 상태 변화가 없다.
  - 제안: 조치 불요(이미 트래킹됨). 다음에 이 메서드를 손댈 때 나머지 영문 주석도 함께 통일.

## 요약

이번 라운드에서도 실행 코드가 바뀐 파일은 4개뿐이며 전부 JSDoc·인라인 주석·Swagger
`description` 문자열 변경으로, 함수 길이·중첩 깊이·순환 복잡도·매직 넘버·중복 로직 등 구조적
지표는 이전 세 라운드와 마찬가지로 변화가 없다. 이전 라운드들이 낸 유일한 WARNING(base 함수
docblock 언어 혼재)은 이미 해소된 상태를 재확인했고, 이번 라운드의 신규 변경(`re-run.dto.ts`
description 을 129자로 재축약해 길이 가이드 예외에 기대지 않게 함)은 유지보수성을 오히려
개선하는 방향이다. 남은 세 건(REASON_TO_DETAIL JSDoc 단일행/다중행 불일치·base 함수 docblock
길이·controller 부분 언어 통일)은 전부 이전 라운드에서 이미 명시적으로 보류(triaged)된 사소한
스타일 편차이며, 이번 라운드에서 상태 변화나 새로운 퇴행은 없었다. 신규 Critical/Warning 없음.

## 위험도
LOW
