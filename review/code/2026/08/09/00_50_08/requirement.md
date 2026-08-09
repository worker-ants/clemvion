# 요구사항(Requirement) 리뷰 — backend lint 게이트 복구 (34개 파일)

## 스코프 요약

이 변경은 신규 기능이 아니라 **backend lint 게이트 복구**(`plan/in-progress/backend-lint-gate-broken-on-main.md`)
목적의 기계적 정리다: (1) prettier 재포맷(122건 error), (2) `@typescript-eslint/no-unnecessary-type-assertion`
경고 54건 중 이 파일 세트에 해당하는 `as X` 캐스트 제거, (3) 캐스트 제거로 고아가 된 타입 import 제거
(`Cafe24Method`, `MakeshopMethod`), (4) 미사용 `eslint-disable-next-line no-console` 주석 제거.
전 파일이 순수 포맷팅/캐스트 제거이며, 로직(분기·기본값·검증 규칙)을 바꾸는 hunk 는 없다.

"의도한 기능"은 곧 "동작을 바꾸지 않고 lint 게이트를 통과시키는 것"이므로, 이 관점에서 각 캐스트
제거가 실제로 타입-안전하게 불필요했는지(=런타임/컴파일 회귀가 없는지)를 중점 검증했다.

## 검증 방법 (재현)

- `git diff origin/main...HEAD -- <34개 파일>` 전수 확인 — 모든 hunk 가 (a) 멀티라인 유니온
  타입 선언을 prettier 가 한 줄로 합친 것, 또는 (b) `as T` 캐스트 제거 중 하나임을 확인.
- `npx tsc --noEmit -p tsconfig.build.json` (실제 `nest build` 가 쓰는 설정) → **0 errors**.
  (참고: `tsconfig.json` 그대로 돌리면 `*.spec.ts` 다수에서 무관한 pre-existing 오류가 나오는데,
  이는 `tsconfig.build.json` 이 `**/*spec.ts`/`test`를 exclude 하기 때문에 실제 빌드에는
  영향이 없다 — plan 문서의 "build PASS(155s)" 주장과 일치.)
- `npx eslint <34개 파일 중 .ts 30개>` → **0 errors**, warning 7건(`ai-agent.schema.ts` 1 +
  `render-tool-provider.ts` 6, 모두 기존 `no-unsafe-*`/`no-unsafe-assignment` 미해결분이며
  plan 문서 "잔여 warning 47건" 표에 이미 잡혀 있는 항목과 일치).
- 캐스트 제거가 실제로 타입-안전한지 개별 확인: `Cafe24Credentials`/`MakeshopCredentials` 는
  전 필드 optional 인 "weak type" 이라 `Record<string, unknown>` 대입이 캐스트 없이도
  구조적으로 허용됨(별도 미니멀 스니펫으로 재확인: optional-only 인터페이스는 캐스트 불필요,
  required 필드가 하나라도 있으면 즉시 TS2741 발생 — 이 저장소의 캐스트 제거 패턴과 정합).
- `Cafe24Method`/`MakeshopMethod` import 제거 후 해당 식별자의 잔존 참조 0건 확인 (`grep`).

## 발견사항

- **[INFO]** 관련 spec 문서 없음(항목 9 spec fidelity 해당 없음)
  - 위치: 전체 변경 범위
  - 상세: 이 변경은 `spec/` 이 다루는 제품 요구사항이 아니라 엔지니어링 lint 정책(SoT 는
    `codebase/backend/eslint.config.mjs` 자체 주석)에 관한 것이다. `spec/conventions/`
    아래에도 backend eslint 규칙을 다루는 문서가 없다(grep 확인, `frontend-layering.md` 만
    `eslint` 를 언급하며 무관). CLAUDE.md 정보 저장 표상 "정식 규약"에 해당하지 않는
    엔지니어링 hygiene 이므로 이는 spec 누락이 아니라 정상적인 회색지대다.
  - 제안: 조치 불요.

- **[INFO]** `execution-seq-allocator-load.e2e-spec.ts` 의 `// eslint-disable-next-line no-console`
  제거는 의도한 대로 안전
  - 위치: `codebase/backend/test/execution-seq-allocator-load.e2e-spec.ts` (두 곳, `console.log`
    직전 — 게이트 diff 상 두 `-` 라인)
  - 상세: `eslint.config.mjs:104-116` 이 `**/*.e2e-spec.ts` / `test/**/*.ts` 패턴에 대해
    `no-console: 'off'` 를 이미 지정하므로 해당 disable 주석은 원래도 불필요했다(plan 문서
    표의 "unused disable 2건"과 일치). 제거 후 `npx eslint` 재실행 결과 0 errors/0 warnings —
    회귀 없음.
  - 제안: 조치 불요.

- **[INFO]** `plan/in-progress/backend-lint-gate-broken-on-main.md` 체크리스트가 실제 코드
  상태와 일치
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md` (체크리스트 섹션)
  - 상세: 문서가 주장하는 "prettier 122건 정리로 error 0", "no-unnecessary-type-assertion
    54건 적용 후 회귀 7건 발견·처분", "lint/unit/build/e2e 전부 PASS" 를 이 리뷰의 34개
    파일 스코프에서 독립적으로(tsc/eslint 재실행) 검증했고 모두 일치했다. 남은 미체크
    항목(`push + PR`, `/ai-review`)도 현재 브랜치가 `origin/main` 대비 5커밋 ahead·미push
    상태와 정합한다.
  - 제안: 조치 불요.

CRITICAL/WARNING 급 발견사항 없음. 캐스트 제거 34곳 전부 tsc(`tsconfig.build.json`, 실제 빌드
설정) 기준 컴파일 클린이며, 별도로 파악한 "weak type(optional-only interface)" 구조적 할당
규칙으로 왜 캐스트가 불필요했는지도 설명된다. 로직 분기·기본값·에러코드·필드명 등 비즈니스
동작을 바꾸는 hunk 는 이 34개 파일 안에 하나도 없다.

## 요약

`backend-lint-gate-b72fdd` 브랜치의 이 34개 파일 변경분은 기능 추가/변경이 아니라 lint 게이트
복구를 위한 순수 포맷팅 + 불필요 타입 단언 제거 + 그로 인한 고아 import 정리다. 모든 hunk 를
개별 확인한 결과 런타임 분기·검증 규칙·기본값·에러 코드·반환값을 바꾸는 변경은 없었고, 실제
`nest build` 가 쓰는 `tsconfig.build.json` 기준 컴파일이 깨끗하며 34개 파일 전체 eslint 도
0 errors 다(잔존 warning 은 plan 문서가 이미 "이번 PR 범위 밖"으로 명시한 backlog 와 일치).
관련 `spec/` 문서는 존재하지 않으며 이는 정상(엔지니어링 hygiene 변경이라 spec 대상이 아님).
plan 문서의 진행 상황 서술도 실측과 어긋나지 않는다. 요구사항 충족 관점에서 결함 없음.

## 위험도

NONE
