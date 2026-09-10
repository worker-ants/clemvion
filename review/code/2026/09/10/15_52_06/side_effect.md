# 부작용(Side Effect) 리뷰 — `trigger-workflow-ref-canary` 2라운드

대상: `codebase/backend/src/shared/testing/trigger-workflow-ref.{ts,spec.ts}`,
`codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` (+ plan/review 문서 6건).
1라운드(`review/code/2026/09/10/14_34_18`)가 지적한 W1(narrowed docstring 정확성)·W2
(`secret_store` 고아 row)에 대한 저자의 대응이 이번 라운드의 diff(commit `f71aa584e`→`c696ace07`)다.
2라운드 초점대로 (a) 좁힌 서술이 정확한지, (b) 13건 수정이 새 부작용을 만들지 않았는지를 검증했다.

## 검증 방법 (읽기 전용, 저장소 미변경)

- `grep -rln "shared/testing" codebase/backend/src --include="*.ts"` — production import 존재 여부
- `codebase/backend/tsconfig.build.json` / `tsconfig.json` 실제 내용 대조
- `codebase/backend/src/repo-guards/__tests__/production-build-devdep-guard.ts` 소스 직독 —
  `resolveBuildFileNames()` 가 `ts.parseJsonConfigFileContent().fileNames` 만 쓰는지 확인
- `codebase/backend/src/modules/triggers/triggers.service.ts` 의 `setupChatChannel()` 소스 직독 —
  `secrets.rotate()` 와 `adapter.setupChannel()` 호출 순서 확인
- `git diff f71aa584e c696ace07 -- <3개 코드 파일>` 로 이번 라운드가 실제로 무엇을 바꿨는지 격리
- `codebase/backend/eslint.config.mjs` 에 `shared/testing` import 를 막는 별도 규칙이 있는지 확인
- 저장소 파일은 전혀 수정하지 않았다. 리뷰 도중 `git diff HEAD -- .../trigger-workflow-ref.ts` 로
  다른 병렬 reviewer 의 뮤테이션 테스트로 추정되는 일시적 미커밋 변경(`expect(typeof ref.id).toBe('string')`
  삭제)을 목격했으나, 이 리포트 작성 시점 재확인(`git status --short`, `git diff --stat`)에서는
  워킹트리가 `HEAD`(`c696ace07`)와 완전히 일치 — 그 reviewer 가 프로토콜대로 `cp` 원복을 마쳤다.
  아래 발견 4번째 항목에 상세 기록.

## 발견사항

- **[INFO]** 좁힌 서술 세 가지가 모두 실측과 일치한다 — 더 넓지도 좁지도 않다
  - 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts:56-63`
  - 상세: 1라운드에서 저자가 되짚은 "`tsconfig.build.json` exclude 면 dist 유출 없다" 단정을
    "exclude 는 root 후보만 거르고, import 하면 emit 된다 / 현재 프로덕션 import 0건 / 감지 가드
    없음" 으로 좁혔다(62행). 세 갈래 모두 직접 재현했다:
    1) `grep -rln "shared/testing" codebase/backend/src --include="*.ts"` 결과는 `shared/testing/`
       자기 자신 3파일과 `*.spec.ts` 12파일뿐이었다 — production(non-spec, non-testing) import
       는 **0건**, 문서의 "0건" 주장과 일치.
    2) `production-build-devdep-guard.ts` 의 `resolveBuildFileNames()` 는
       `ts.parseJsonConfigFileContent(...).fileNames` 만 반환한다 — 이는 include/exclude 로
       걸러진 **root 파일 후보 목록**이지, import 로 편입되는 전체 프로그램(`program.getSourceFiles()`)
       이 아니다. 즉 "가드가 감지 못 한다" 는 문서의 자기평가가 소스 레벨에서도 참이다.
    3) `codebase/backend/tsconfig.json` 에 `"types"` 필드가 없어 `@types/jest` 의 ambient
       전역(`expect` 등)이 프로그램 전체에 노출된다 — "production 파일이 실수로 import 해도
       컴파일 에러가 안 난다" 는 주장과 일치. `eslint.config.mjs` 에도 `shared/testing` import 를
       막는 별도 boundary 규칙이 없어, 좁힌 서술이 실제보다 낙관적으로(risk 를 숨기는 방향으로)
       기운 것도 아니다.
  - 제안: 없음(확인 완료). 트래커에 이미 등재된 "가드를 존재 검사 → 도달 검사로" 항목
    (`plan/complete/trigger-workflow-ref-canary.md:294`, `plan/in-progress/spec-draft-nullable-notation-followups.md:1950`)
    은 재지적하지 않는다.

- **[INFO]** `secret_store` 고아 row 경계 주석도 코드 사실과 일치한다
  - 위치: `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts:145-158` (`afterAll` 헤더 주석)
  - 상세: "setupChatChannel 이 외부 호출 이전에 secrets.rotate() 로 secret_store 에 row 를 쓴다"
    (149행)는 주장을 `triggers.service.ts` 의 `setupChatChannel()` 소스로 직접 대조했다 —
    `await this.secrets.rotate(botTokenRef, ...)` 가 `await adapter.setupChannel(...)` **앞**에
    호출된다. 순서 주장이 정확하다. `afterAll` 은 여전히 `DELETE FROM trigger` 만 하고
    `secret_store` 는 건드리지 않으므로 고아 row 자체는 그대로 남지만, 이는 1라운드부터 존재하던
    관례(라운드 1 diff 시점에 이미 `chatChannel` 트리거를 `beforeAll` 에서 생성)이고
    트래커(`plan/complete/trigger-workflow-ref-canary.md:295`,
    `plan/in-progress/spec-draft-nullable-notation-followups.md:1966`)에 등재돼 있다 — 새 발견 아님.
  - 제안: 없음(확인 완료, 재지적 안 함).

- **[INFO]** 13건 수정 중 어느 것도 새로운 부작용 표면을 만들지 않았다
  - 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts:1` (`isUuidShaped` import),
    `:100` (`expectedWorkflowId?: string` 시그니처 추가),
    `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts:74` (`SETUP_TIMEOUT_MS` 파생)
  - 상세: `git diff f71aa584e c696ace07`로 라운드 1→2 변경분만 격리해 확인했다.
    - 시그니처 변경(`opts: { present: boolean }` → `opts: { present: boolean; expectedWorkflowId?: string }`)은
      **옵션 필드 추가**라 이전 호출부와 호환된다. 게다가 이 함수는 `origin/main` 에 아직 없는
      완전 신규 함수라(`git show origin/main:.../trigger-workflow-ref.ts` → "path ... not in
      'origin/main'") 외부 호출자 영향 자체가 성립하지 않는다. 저장소 전체에서 이 함수를 부르는
      곳은 `trigger-workflow-ref.e2e-spec.ts` 와 self-spec 뿐이며(`grep -rln
      expectTriggerWorkflowRef codebase/backend`), 세 필요 호출부(B·C·D·E)가 모두
      `expectedWorkflowId` 를 일관되게 넘긴다.
    - `isUuidShaped` import 는 순수 함수(`return UUID_SHAPE_PATTERN.test(value)`, 부작용 없음)를
      손으로 짠 정규식 대신 쓰도록 바꾼 것 — 새 의존 엣지가 생기지만 I/O·전역상태·네트워크 없음.
    - `SETUP_TIMEOUT_MS = CHAT_CHANNEL_TIMEOUT_MS * 2` 는 이전 리터럴 `120_000` 과 값이 동일
      (`60_000 * 2 = 120_000`) — 동작 변화 없이 파생 관계만 코드에 드러냈다.
    - `it()` 라벨 `1.~5.` → `A.~E.` 변경은 순수 표시 문자열이며, 저장소 어디에도
      `testNamePattern`/번호 기반 필터가 없음을 확인했다(`grep -rn testNamePattern` 매치 0건) —
      CI·스크립트 어느 쪽에도 라벨 형식에 의존하는 소비처가 없다.
    - 나머지는 전부 docstring/주석 추가(케이스 E 의 R-CC-10 경고, `expect(dto).not.toBeNull()`
      추가 등)이며 런타임 상태·전역·파일시스템·네트워크·환경변수에 영향을 주는 코드 변경이 아니다.
  - 제안: 없음(확인 완료).

- **[INFO]** 리뷰 도중 다른 reviewer 의 것으로 추정되는 일시적 미커밋 변경을 목격했다 — 이 리포트
  작성 시점엔 이미 정상 원복돼 있다
  - 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts` (`ref.id` 검증부, `HEAD`
    기준 122행 부근)
  - 상세: 분석 도중 한 시점에 `git diff HEAD -- .../trigger-workflow-ref.ts` 가
    `expect(typeof ref.id).toBe('string');` 한 줄이 삭제된 미커밋 diff(` M`, unstaged)를 보였다.
    이 세션(나)이 만든 변경이 아니다 — 이 리포트의 "검증 방법" 절에 적었듯 나는 저장소 파일에
    쓴 적이 없다. 병렬로 도는 다른 reviewer 가 "`id` 도 `name` 처럼 뮤테이션 사각지대인가" 를
    확인하려고 이 프롬프트의 뮤테이션 규약대로 고쳤다가 원복하는 과정 중간 상태였을 가능성이 크다.
    **뒤이어 재확인한 결과(`git status --short`, `git diff --stat`)**, 워킹트리는 `c696ace07`
    (`HEAD`)과 **완전히 일치** — 그 reviewer 가 원복을 끝냈다. 지금 상태는 이상 없음.
    참고로 그 삭제 자체도 내용상 위험하지 않았다 — `isUuidShaped(String(ref.id))` 는 JSON 응답이
    가질 수 있는 모든 타입(string/number/boolean/object/array/null)에 대해 문자열 강제변환 결과가
    정확히 UUID 36자 형식과 일치해야 `true` 이므로, `typeof ref.id !== 'string'` 인 입력은 이
    검사 하나로도 사실상 전부 걸러진다(자매 스펙 케이스 `{ id: 42, ... }` → `String(42)="42"` →
    매치 실패 → 정상 throw). `name` 축(라운드 1 W3 이 지적한 비대칭 — `String(x).length` 가
    타입을 안 가른다)과 달리 `id` 축은 `isUuidShaped` 가 `typeof` 단언을 포섭하므로, 만약 그
    한 줄이 실제로 제거된 채 머지됐어도 self-spec 을 vacuous 하게 만들지는 않았을 것이다.
    다만 이 사건은 `plan/in-progress/harness-review-gate-followups.md` §M(커밋 기준 diff 번들
    vs "워킹트리가 SoT" 라는 preamble 선언의 불일치)이 `--impl-done` 컨텍스트에서 등재한 것과
    **같은 성격의 위험**이 `/ai-review` fan-out 세션 중에도 실시간으로 발생할 수 있음을 보여준다
    — 이번엔 최종적으로 무해하게 끝났을 뿐이다.
  - 제안: 새 트래커 항목 불필요(§M 이 이미 이 패턴을 다룬다, 현재 워킹트리도 정상). 기록 목적으로만
    남긴다 — 이후 다른 reviewer 의 리포트에 이 파일에 대한 "지금 막 사라진 단언을 봤다" 류의
    관측이 있다면 이 항목과 같은 사건일 가능성이 높다는 참고로 남긴다.

## 요약

이번 라운드는 순수하게 **테스트 헬퍼 3파일 + 문서 파일들**의 수정이며, 프로덕션 코드 변경은
0건이다(저자의 커밋 메시지·RESOLUTION.md 서술과 일치). 1라운드가 반증했던 두 서술("exclude 라
dist 유출 없다", "assertMatchesContract 가 못 잡는다")을 이번 라운드가 좁힌 결과물을 소스·설정
파일 직독으로 3갈래 모두 재현 검증했고, 어느 것도 과장(너무 좁힘)이나 과소평가(너무 넓힘) 없이
정확했다. 새로 추가된 `expectedWorkflowId` 옵션 파라미터는 하위 호환(optional)이고 애초에
`origin/main` 에 없는 신규 함수라 외부 호출자 영향이 원천적으로 없으며, `isUuidShaped` import는
순수 함수 치환이라 부작용이 없다. `secret_store` 고아 row 관례와 `production-build-devdep-guard`
사각지대는 1라운드에서 이미 트래커에 등재된 사안이고 이번 라운드에서 재현·재확인만 했을 뿐 상태
변화가 없어 재지적하지 않았다. 코드 리뷰 대상 3파일에서 새로운 CRITICAL/WARNING 급 부작용은
발견하지 못했다. 리뷰 도중 다른 reviewer 로 추정되는 일시적 미커밋 변경(뮤테이션 테스트로 보임)을
목격했으나 작성 시점엔 이미 `HEAD` 와 완전히 일치하도록 원복돼 있었고, 그 변경 내용 자체도 안전한
것이었다 — 병렬 fan-out 워크트리 오염 위험이 이번엔 실질 피해 없이 종료됐다.

## 위험도

NONE
