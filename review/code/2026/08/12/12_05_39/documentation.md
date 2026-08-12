# 문서화(Documentation) 리뷰 결과

델타 = 커밋 `17221ecb9` (backend lint `no-unsafe-*` warning 46→21, 3파일) + `package.json` 에
`--max-warnings 0` 추가 + `plan/in-progress/backend-lint-gate-broken-on-main.md` 정정/완결 +
전회(`11_06_12`) 리뷰 세션 산출물(RESOLUTION/SUMMARY/각 reviewer md·meta.json 등, 신규 파일)
커밋.

## 발견사항

- **[WARNING]** `package.json` 의 `lint` 스크립트에 `--max-warnings 0` 을 추가해 동작이
  바뀌었는데, 그 동작을 설명하는 `codebase/backend/README.md` 의 스크립트 표 문구가
  갱신되지 않아 **사실과 반대되는 문서**가 됐다.
  - 위치: `codebase/backend/README.md:19` (`| \`npm run lint\` | ESLint (report-only — 자동
    수정 안 함) |`). 변경 자체는 `codebase/backend/package.json:20`
    (`"lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --max-warnings 0"`).
  - 상세: 이 저장소에는 "report-only" 라는 표현이 **정확히 이 지점**(backend `lint` 스크립트)
    에 대해 과거 리뷰에서 의도적으로 선택된 이력이 있다 — `review/code/2026/06/20/15_02_56/`
    라운드가 "`lint` 는 report-only(= warning 만으로는 exit 0), `lint:fix` 는 명시적 opt-in"
    이라는 의미로 이 문구를 README 에 반영했고, 같은 라운드의 testing.md 는 "warn 위반이
    있어도 exit code 0으로 통과된다(eslint 기본 동작 — warn은 exit 0, error만 exit 1)" 라고
    명시적으로 그 의미를 기록해 두었다. 즉 "report-only" 는 단순히 "auto-fix 안 함" 이 아니라
    **"warning 만으로는 프로세스가 실패하지 않는다"** 는 의미로 이 코드베이스에 각인된
    용어다. 이번 델타는 정확히 그 성질을 뒤집는다 — `--max-warnings 0` 이 걸리면 warning
    1건만 있어도 `npm run lint`/`pnpm --filter backend lint` 는 **exit 1** 이다(이는
    `plan/in-progress/backend-lint-gate-broken-on-main.md` §후속 자신이 프로브로 실측·확인한
    사실이기도 하다 — "0 errors / 1 warning 에서 exit 1"). 그런데 README 문구는 그대로
    남아, "report-only" 라는 표현이 이제 "warning 이 있어도 안 막힌다" 라는 **거짓 인상**을
    준다. `plan/in-progress/backend-lint-gate-broken-on-main.md` 를 grep 한 결과 이 항목의
    방대한 검증 목록(양방향 프로브·CI 워크플로 대조 등) 어디에도 `README` 언급이 없어,
    이번 처분 작업에서 이 자리가 통째로 누락된 것으로 보인다.
  - 제안: README 스크립트 표의 `lint` 행 설명을 예컨대 "ESLint, warning 도 게이트
    실패(`--max-warnings 0`) — 자동 수정 안 함" 류로 갱신해 "report-only" 표현을 제거하거나
    재정의한다. `codebase/backend` 를 아는 개발자가 로컬에서 warning 1건을 만들고
    `npm run lint` 가 exit 0 일 거라 오판해 커밋 후 CI 에서 처음 알게 되는 상황(이 저장소가
    `#1104` 에서 이미 겪은 "로컬에서 안 돌려 CI 가 터진" 사고 패턴)을 문서 차원에서
    예방한다.

- **[INFO]** CHANGELOG.md 갱신은 불필요 — 판단 근거 확인됨.
  - 위치: `CHANGELOG.md` (관찰 대상, 미변경).
  - 상세: 루트 `CHANGELOG.md` 의 기존 항목들은 전부 사용자 가시적 동작 변경·보안 수정
    (예: cross-tenant 멤버십 검증, 감사 로깅, retry 가드 등)만 기록하는 패턴이다. 이번
    델타는 런타임 동작이 전혀 바뀌지 않는(emit 이 md5 까지 동일함을 전 라운드가 실증) 내부
    lint 게이트 강화·타입 보강이라 이 패턴에 해당하지 않는다. 항목 누락 아님.

- **[INFO]** 신규/변경 코드의 인라인 주석 품질이 이번 델타 전반에서 높다 — 확인된 발견
  아님, 근거만 기록.
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts:87-88`,
    `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` (`logFn` 단언 앞
    주석 4줄), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2909-2910`,
    `codebase/backend/src/modules/executions/executions.service.ts:194-196`,
    `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:24-33`
    (`HttpResponseLike` JSDoc), `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts:645`,
    `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts:376-377,458-459`.
  - 상세: 각 자리마다 "무엇을 왜" (어떤 TS/tsconfig 특성이 `any` 를 새게 하는지, 단언이
    소거된다는 사실, 대안을 택하지 않은 이유)를 개별로 설명한다. `strictBindCallApply: false`
    (`tsconfig.json:23`)·`strictBuiltinIteratorReturn` 미설정·`Array.isArray` 의 `unknown`→`any[]`
    좁힘 등 서술된 TS 특성을 직접 대조해 확인했고 전부 정확하다. `idempotency.interceptor.ts`
    의 `HttpResponseLike` 는 특히 "왜 진짜 `express.Response` 타입을 쓰지 않는가"(그러면
    기존 `typeof` 방어가 정적으로 항상 참이 되어 죽은 코드가 된다)까지 근거를 남겨 모범
    사례로 판단된다.

- **[INFO]** `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 이번 diff 는 정확성·
  추적성이 높다 — 확인된 발견 아님, 근거만 기록.
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md` (해당 diff hunk 전체).
  - 상세: "47건"(구값)과 "실측 46건"을 구분해 남기고 출처를 명시, 표의 성격 분류가
    틀렸던 자리(§전제 재검토)를 스스로 정정, 게이트를 CI 워크플로가 아니라 `package.json`
    에 넣은 이유(로컬·CI 동일 게이트)를 명시, 프로브 유효성 선검증 실패 사례까지 기록하는
    등 이 저장소의 과거 실패 패턴(측정 프록시 오류·미검증 프로브)을 의식적으로 피하고
    있다. 문서화 관점에서 지적할 결함이 없다.

## 요약

이번 델타는 로직을 바꾸지 않는 타입 보강 + lint 게이트 강화(`--max-warnings 0`) + 그 결정을
상세히 기록한 plan 문서 갱신으로 구성되며, 코드에 새로 붙은 주석들은 정확하고 유용하다.
다만 `--max-warnings 0` 도입은 backend `lint` 스크립트의 실행 결과 의미를 바꾸는 실질적
동작 변경인데, 정확히 이 스크립트에 대해 "report-only"(= warning 만으로는 exit 0)라는
문구를 과거 리뷰가 의도적으로 심어 둔 `codebase/backend/README.md:19` 는 갱신되지 않아
이제 실제 동작과 반대되는 설명이 됐다 — WARNING 1건. CHANGELOG 갱신은 이 저장소의
기존 기준(사용자 가시적 변경만 기록)에 비춰 불필요하다고 판단된다.

## 위험도

LOW
