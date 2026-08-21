# 테스트(Testing) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (최종 라운드, 04_20_10)

## 검토 방법

실질 프로덕션 코드 변경(파일 1~14, 특히 `reject-masked-resubmission.ts`/`.spec.ts`,
`executions.service.ts`/`.spec.ts`, `workflows.controller.ts`/`.spec.ts`,
`masked-reject-callers-guard.ts`/`.spec.ts`, `sanitize-error-message.ts`/`.spec.ts`,
`tsconfig.build.json`)를 `Read` 로 직접 열어 대조했다(프롬프트가 크기 제한으로 diff 를
생략한 파일 4개 포함). 관련 6개 spec 스위트(`reject-masked-resubmission.spec.ts`,
`resolve-trigger-parameters.spec.ts`, `executions-rerun.service.spec.ts`,
`workflows.controller.spec.ts`, `masked-reject-callers.spec.ts`,
`sanitize-error-message.spec.ts`)를 `npx jest` 로 직접 재실행해 **169/169 통과**를
실측했다. 이 변경은 이미 8라운드(`00_03_57`~`03_14_16`) 리뷰를 거쳐 CRITICAL 1건(boolean
완전 우회)과 다수 WARNING 이 해소된 상태라, 이번 라운드는 **기존에 지적되지 않은 신규 갭**
위주로 훑었다.

나머지(plan/spec 문서, 과거 `review/code/**`·`review/consistency/**` 산출물)는 애플리케이션
코드가 아니라 이번 변경의 배경 기록이라 테스트 관점 검토 대상에서 제외했다.

## 발견사항

- **[WARNING]** `tsconfig.build.json` 의 신규 exclude(`src/repo-guards/**`)가 막는 실제
  운영 위험(devDependency `typescript` 가 `dist/repo-guards/**` 를 통해 프로덕션 번들로
  새는 문제)에 대해 **자동화된 회귀 테스트/CI 게이트가 없다**
  - 위치: `codebase/backend/tsconfig.build.json:16` (`"src/repo-guards/**"` 항목),
    관련 진술은 같은 파일 게이트 12~15줄 주석
  - 상세: 이 변경의 근거(주석·`review/code/2026/08/21/03_14_16/RESOLUTION.md` "파생 결함"
    절)는 "클린 빌드 후 `dist` 내 `require(\"typescript\")` **0건** 확인"이라고 적는다 —
    그러나 그 확인은 **개발 중 1회 수동 실행**이었고, 저장소 어디에도 이를 지키는 테스트나
    CI 스텝이 없다(`.github/workflows/backend-checks.yml`, `package.json` 스크립트,
    `src/**/*.spec.ts` 전수 grep 으로 확인 — `tsconfig.build`/`repo-guards`/dist 산출물을
    검사하는 테스트 0건). CI 의 `nest build` 단계는 devDependency 가 설치된 환경에서
    돌아가므로, 설령 이 exclude 항목이 나중에 실수로 좁혀지거나 삭제돼도 **CI 는 그대로
    통과한다** — 프로덕션 설치(devDependency 없음)에서 해당 dist 파일이 실제로 `require`
    될 때만 크래시로 드러난다. 값·타입 로직이 아니라 "빌드 산출물의 구조적 보장"이라는
    점에서 이 리포지토리의 다른 테스트 패턴(값 검증)과 결이 다르지만, 이 PR 이 스스로
    "지뢰"라고 명명한 위험이므로 그 보장을 기계에 맡기지 않은 점이 갭이다.
  - 제안: CI 또는 jest 테스트에서 `nest build` 산출물(`dist/repo-guards/`)이 존재하지
    않음을 단언하는 값싼 회귀 테스트를 추가한다(예:
    `expect(fs.existsSync(path.join(distDir, 'repo-guards'))).toBe(false)` 형태, 또는
    `dist/**/*.js` 전수에서 `require("typescript")` 리터럴이 없음을 grep). 빌드를 매 테스트
    런마다 돌리는 비용이 부담되면 최소한 CI 워크플로에 "빌드 후 dist/repo-guards 부재 확인"
    한 줄을 추가해 결정 근거(주석의 "지뢰" 서술)를 실행 가능한 게이트로 승격한다.

- **[INFO]** (carried-over) `findMaskedResubmissions`(exported, `reject-masked-resubmission.ts`)는
  여전히 직접 단위 테스트가 없고 `resolveTriggerParametersRejectingMasked` 경유로만
  간접 커버된다
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`
    `findMaskedResubmissions` 함수 선언부(약 115행)
  - 상세: 직전 라운드(`03_14_16` testing)가 이미 같은 갭을 INFO 로 지적했고, 그 라운드의
    RESOLUTION 은 "직전 라운드에 정한 멈춤 규칙(INFO 는 이 PR 에서 더 손대지 않고 트래커로)"
    을 적용해 의도적으로 미조치했다. 이번 라운드 확인 결과 상태는 변함없다 — `grep` 으로
    `findMaskedResubmissions` 를 import 하는 `.spec.ts` 가 0건임을 재확인했다. 새로운
    문제는 아니고, 상위 함수(`resolveTriggerParametersRejectingMasked`) 경유 간접 커버가
    이미 raw/resolve 두 phase·경계값·왕복 통합을 촘촘히 덮고 있어 실질 회귀 위험은 낮다.
    재지적 목적이 아니라 "이번 diff 로 상태가 바뀌지 않았다"는 확인으로 남긴다.

## 강점 (반증 아님, 정성적 확인)

- **실행 확인**: 관련 6개 spec 스위트를 직접 재실행해 169/169 통과를 실측했다(캐시·stale
  빌드 우려 없음).
- **Mock 적절성**: `executions-rerun.service.spec.ts`/`workflows.controller.spec.ts` 모두
  `resolveTriggerParametersRejectingMasked` 자체를 mock 하지 않고 실코드 경로를 그대로
  태운다 — 판정 로직처럼 정확성이 중요한 부분을 스텁으로 대체하지 않았다.
  `executions-rerun.service.spec.ts` 의 신규 세 테스트는 기존 스위트의 `getOneQueue`/
  `nodeRepo.findOne` mock 패턴을 그대로 따라 스타일이 일관된다.
  `masked-reject-callers.spec.ts` 의 mutation 내성 테스트(필터 무력화 시나리오, 우회 형태
  7종 `it.each`)는 가드 자신의 맹점을 합성 fixture 로 직접 재현해, "GREEN 이 곧 증거"라는
  함정을 스스로 피했다.
- **테스트 격리**: `masked-reject-callers.spec.ts` 의 합성 fixture 테스트는
  `fs.mkdtempSync`/`try...finally` + `fs.rmSync(recursive:true)` 로 임시 디렉터리를 만들고
  반드시 정리한다.
- **회귀 테스트가 정확한 반대 부호를 겨눈다**: `[캐너리] boolean 필드의 마커도 거부한다`는
  초판이 실제로 뚫렸던 `Boolean('***') → true` 완전 우회를 정확히 재현하고,
  `[회귀] 거부 응답이 details[] 로 필드별 코드를 싣는다`는 `body.errors` 가 `undefined`
  임을 함께 단언해 `errors`→`details` 선존 버그의 재발을 놓치지 않는다.
- **경계 커버리지**: 정확 일치 vs 부분 포함(`a***b`), 깊이 상한 `MAX_REDACT_DEPTH`/`+1`,
  동종·혼합 중첩, 스택 안전성(depth 5000)까지 촘촘하다. `sanitize-error-message.spec.ts` 의
  신규 "MASKED_MARKERS 불변성" 캐너리는 `Object.freeze(Set)` 플라시보를 실측(`.add()` 성공)
  으로 반증한 뒤 `readonly string[] + Object.freeze` 로 교체한 실제 불변성을 기계에 고정한다
  — "문서한 보장이 구현보다 넓다"는 이 시리즈의 반복 패턴을 스스로 잡아낸 드문 사례다.
- **가독성**: `[캐너리]`/`[경계]`/`[회귀]`/`[통합]` 태그와 다수 doc comment 가 "왜 이 케이스가
  필요한가"를 이전 리뷰 라운드 식별자와 함께 남겨, 다음 사람이 케이스를 지울 때 근거를 다시
  찾지 않아도 된다.

## 요약

이번 diff 는 이미 8라운드의 촘촘한 리뷰를 거쳐 수렴한 상태이며, 이번 라운드에서 직접 재실행한
6개 spec 스위트(169건)는 전부 통과했다. 핵심 판정 로직(`reject-masked-resubmission.ts`)과
두 호출부, 신규 repo-guard(`masked-reject-callers*`)는 경계값·왕복 통합·mutation 내성까지
갖춘 두터운 테스트로 뒷받침된다. 이번 라운드에서 새로 발견한 것은 하나다 — `tsconfig.build.json`
의 `src/repo-guards/**` exclude 가 막는 실제 운영 위험("devDependency 가 dist 로 새는 지뢰")
에 대해 자동화된 회귀 테스트나 CI 게이트가 없고, 근거는 개발 중 1회 수동 클린빌드 확인뿐이다.
값 검증이 아니라 빌드 산출물 구조에 대한 보장이라는 점에서 값싸게 기계로 옮길 수 있는 갭이다.
그 외에는 새로운 CRITICAL/WARNING 이 없고, 남은 INFO(`findMaskedResubmissions` 직접 단위
테스트 부재)는 직전 라운드에서 이미 의도적으로 미조치 확정된 항목으로 상태 변화가 없다.

## 위험도

LOW
