# 요구사항(Requirement) 리뷰

## 스코프 판정 (선행 확인)

프롬프트의 "리뷰 대상 파일" 40개는 프롬프트 크기 제한으로 잘린 목록이었다(대부분
`⚠️ 프롬프트 크기 제한으로 이 파일의 내용이 전혀 실리지 않았습니다`). 실제 diff는
`git diff origin/main...HEAD -- codebase/backend`로 직접 확인했다 (75 files changed,
+272/-375, 이 중 backend 소스 58개 + plan 문서 2개).

diff 전체를 읽은 결과, 이 브랜치는 **`plan/in-progress/backend-lint-gate-broken-on-main.md`**
가 정의하는 lint 게이트 복구 작업이다 — prettier union 타입 포맷(선행 `|` 제거) +
`@typescript-eslint/no-unnecessary-type-assertion` 지목 caret 제거 + 그 과정에서 발생한
고아 import 6건/로드베어링 assertion 정리. **신규 비즈니스 로직·신규 기능·spec 변경은
없다** (`spec_impact: none`, 실측 확인 — `git diff --stat`에 `spec/` 경로 0건).

이 성격상 "기능 완전성/엣지 케이스/비즈니스 로직/spec fidelity" 등 요구사항 리뷰 관점
대부분이 **적용 대상이 아니다** (신규 요구사항이 없으므로). 본 리뷰는 대신 이 클래스의
변경에서 실제로 회귀가 발생할 수 있는 유일한 지점 — **"불필요"로 지목된 type assertion
제거가 실은 로드베어링이어서 컴파일이 깨지거나(타입 회귀), 런타임 의미가 바뀌는가** —
를 직접 검증했다.

## 검증 절차

1. `git diff origin/main...HEAD` 전체를 읽어 58개 backend 파일의 모든 hunk 확인.
2. **TypeScript 언어 시맨틱 상 `as X` / `as unknown as X` / `as never` assertion 은
   컴파일 타임에만 존재하고 런타임에 완전히 소거된다** — 즉 assertion 제거 자체는
   원리적으로 런타임 동작을 바꿀 수 없다. 유일한 위험은 "제거 후 컴파일이 깨지는가"
   (타입 회귀)뿐이다. 이를 직접 검증하기 위해 `npx tsc --noEmit -p tsconfig.json`
   전체 프로그램 타입체크를 브랜치 워크트리에서 실행.
3. eslint 설정(`eslint.config.mjs`)에서 `no-console` 규칙의 `**/*.e2e-spec.ts` 면제
   여부 확인 (diff가 인라인 `eslint-disable-next-line no-console` 주석 2건을 삭제한
   케이스가 있어 별도 검증).
4. 삭제된 orphan import(`LanguageLocale` ×4, `Cafe24Method`, `MakeshopMethod`)가 파일
   내 다른 곳에서 실제로 미사용인지 grep 재확인.

## 발견사항

- **[INFO]** production 코드(비-`*.spec.ts`)는 `tsc --noEmit` 전체 프로그램 타입체크에서
  **0 에러** — 이 브랜치가 제거한 모든 `as X`/`as never`/`as unknown as X` assertion 이
  실제로 "불필요"했음을 직접 재현 확인했다 (`auth-configs.service.ts`의
  `client.addr.isInSubnet(range.addr as never)` → `range.addr` 제거, `retry-turn.service.ts`의
  `inputData: seededInput as Record<string, unknown>` → `seededInput` 제거 등 포함).
  - 위치: 해당 없음 (검증 결과, 결함 아님)
  - 상세: 커밋 메시지가 주장하는 "auto-fix 후 타입 회귀 6건 되돌림 + 신규 error 8건
    정리(`nest build`로 반증)"를 독립적으로 재현 검증했다. `RetryTurnService`
    (`codebase/backend/src/modules/execution-engine/retry-turn.service.ts:149` 부근)와
    `ExecutionContextService.setEngineResolvedConfig`
    (`codebase/backend/src/modules/execution-engine/context/execution-context.service.ts:166`
    부근)는 실제로 로드베어링이라 이번 브랜치가 이미 assertion 을 복원 + 근거 주석 +
    `eslint-disable-next-line` 으로 처리했고, 이 상태에서 tsc 가 clean 하다.
  - 제안: 없음 (검증 통과).

- **[INFO]** `codebase/backend/test/execution-seq-allocator-load.e2e-spec.ts` 에서
  `// eslint-disable-next-line no-console` 주석 2건이 삭제됐지만(diff 마지막 hunk),
  `eslint.config.mjs` 의 `files: ['**/*.spec.ts', '**/*.e2e-spec.ts', 'test/**/*.ts']`
  override 가 `no-console: 'off'` 를 이미 지정하므로 해당 파일 경로(`**/*.e2e-spec.ts`)에
  대해 애초에 불필요한(redundant) disable 주석이었다 — 삭제 후에도 lint 는 통과한다.
  - 위치: `codebase/backend/test/execution-seq-allocator-load.e2e-spec.ts` (console.log 2곳,
    삭제된 disable 주석 인접 라인)
  - 상세: 결함 아님, 확인 완료.
  - 제안: 없음.

- **[INFO]** 삭제된 orphan type import 6건(`LanguageLocale` — discord/slack/telegram
  renderer + `hooks.service.ts` 4곳, `Cafe24Method` — `cafe24.handler.ts`,
  `MakeshopMethod` — `makeshop.handler.ts`)을 grep 으로 재확인 — 삭제 후 해당 파일
  어디에도 잔여 참조가 없다. 이는 대응하는 `as LanguageLocale | undefined` /
  `as Cafe24Method` / `as MakeshopMethod` cast 제거와 짝을 이루며, 제거 후에도 tsc 가
  clean 하므로 `config.languageLocale` / `operation.method` 의 실제 타입이 이미 캐스트
  없이도 해당 리터럴 유니온과 호환됨을 의미한다 — 즉 원래도 불필요한 caret 이었다.
  - 위치: 위 6개 파일 (import 구문)
  - 상세: 결함 아님, 확인 완료.
  - 제안: 없음.

- **[INFO]** (이 브랜치와 무관한 관찰) 브랜치 워크트리에서 `tsc --noEmit -p tsconfig.json`
  (제외 목록 없는 base tsconfig, `tsconfig.build.json` 이 적용하는
  `exclude: ["test", "**/*spec.ts"]` 미적용 상태)을 돌리면 `*.spec.ts`/`*.e2e-spec.ts`
  파일에서 **319줄, 수십 건**의 타입 에러가 나온다(예:
  `execution-engine.service.spec.ts`, `integration-oauth.service.cafe24.spec.ts`,
  `workflows.service.spec.ts` 등). 이 에러들은 **이 diff 가 건드린 줄과 전혀 겹치지
  않는 위치**이며, `tsconfig.build.json` 이 `**/*spec.ts`+`test/`를 명시적으로 제외하고
  Jest 는 `isolatedModules`(ts-jest, 파일 단위 transpile-only) 로 동작하므로 CI 의
  `nest build`/`jest` 어느 경로에서도 검출되지 않는다. plan 문서가 이미 기록한 "잔여
  warning 47건 처분 방침(비차단)"과는 다른 축(=에러, 단 non-build 경로)이며 이번
  브랜치가 만든 것이 아니라 `origin/main` 선재 상태로 판단된다(터치되지 않은 파일 위치).
  - 위치: 해당 없음 (이 diff 밖)
  - 상세: 이 브랜치의 요구사항 충족 여부와는 무관하지만, 향후 `tsc --noEmit` 을 CI 게이트에
    추가하거나 `tsconfig.build.json` 제외 범위를 좁힐 계획이 있다면 사전에 알아둘
    잠재 부채로 기록해 둔다.
  - 제안: 이번 PR 범위에서 처리할 필요 없음. 별도 plan 항목으로 필요 시 등재.

## 요약

`backend-lint-gate` 브랜치는 신규 기능·비즈니스 로직·spec 변경이 없는 순수 lint/포맷
복구 작업(prettier union 타입 포맷 122건 + `no-unnecessary-type-assertion` 관련 정리)이다.
TypeScript 의 `as` assertion 제거는 언어 시맨틱상 런타임에 영향을 줄 수 없어 유일한
회귀 가능 지점은 "제거가 컴파일을 깨는가"였는데, 브랜치 워크트리에서 `tsc --noEmit`
전체 프로그램 타입체크를 독립 재현한 결과 production 코드는 0 에러로 clean 했다. 로드베어링으로
판명된 assertion(예: `RetryTurnService`, `ExecutionContextService.setEngineResolvedConfig`)은
이미 복원 + 근거 주석 + `eslint-disable-next-line` 으로 적절히 처리돼 있다. 삭제된 orphan
import 6건도 잔여 참조 없음을 grep 으로 재확인했다. `spec/` 변경이 없고
(`spec_impact: none`), plan 문서가 TEST WORKFLOW(lint/unit/build/e2e) 전체 PASS 를 이미
기록하고 있어 요구사항(=게이트 복구) 충족 관점에서 결함을 발견하지 못했다. 유일한 기록
가치가 있는 관찰은 이 diff 와 무관한 `*.spec.ts` 전체-프로그램 tsc 에러(선재, 비차단
경로)이며 이는 INFO 로만 남긴다.

## 위험도

NONE
