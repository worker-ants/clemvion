# 테스트(Testing) 리뷰

## 스코프 확인

이 변경셋은 3개 파일뿐이다: `codebase/frontend/package.json`(devDependencies 4개 추가),
`pnpm-lock.yaml`(대응 lockfile 갱신 + 부수 churn), `plan/in-progress/harness-review-gate-ci-backstop.md`
(조사 기록 부록 추가). 애플리케이션 로직 변경은 없다 — `spec-links.ts` 자체는 이번 diff에
없고, 이미 존재하던 코드가 쓰던 `mdast-util-from-markdown`·`mdast-util-to-string`·
`github-slugger`·`@types/mdast` 를 매니페스트에 뒤늦게 선언하는 것이 전부다.

## 검증 (직접 실행)

- `pnpm exec vitest run src/lib/docs/__tests__/spec-links.test.ts src/lib/docs/__tests__/spec-link-integrity.test.ts`
  → 2 files / 17 tests 통과.
- `codebase/frontend/node_modules/mdast-util-from-markdown` 심볼릭 링크가 이 워크트리
  자신의 루트 `node_modules/.pnpm/...` 를 가리킴 (부모 체크아웃으로 새는 것이 아님) →
  이번에 추가된 선언이 `pnpm install` 로 정상 해소됨을 실측으로 확인.
- lockfile 안에 backend·`codebase/packages/*` 전 importer 의 jest/ts-jest peer 해석 문자열이
  함께 바뀌어 있어(esbuild peer 추가 등) 부수 영향 우려로 `codebase/backend` 에서
  `npx jest src/instrumentation.spec.ts` 실행 → 7 tests 통과. 이 lockfile 전역 재해석이
  다른 워크스페이스의 jest 실행을 깨지 않음을 확인.

## 발견사항

- **[INFO]** 이 결함 클래스("import는 있는데 매니페스트엔 없음")를 막는 자동 가드가 아직 없다
  - 위치: `codebase/frontend/package.json`(devDependencies 블록) / plan 부록의 "#6" 서술부
    (`plan/in-progress/harness-review-gate-ci-backstop.md:487-489`, 게이트 번호 기준)
  - 상세: 이번 수정은 증상(미선언 의존 4개)만 봉합한다. plan 문서 자신도 "같은 클래스가
    다른 파일에도 있는지는 미확인이다(전수 조사 미수행)" 라고 적어 뒀고, `deps-security-checks`
    나 lint 단계의 import-vs-manifest 대조는 후속 과제로 미룬 상태다. 회귀 테스트(이 정확한
    버그가 재발하지 않음을 보장하는 자동 체크)는 이번 PR에 포함돼 있지 않다.
  - 제안: 이번 PR 범위로 요구하진 않되(작성자가 이미 defer로 명시), 후속 작업으로 등재된
    것을 확인만 하면 된다. 새 항목은 아니다.

- **[INFO]** 로컬 테스트 통과가 이 정확한 버그에 대해서는 약한 증거다 (테스트 격리 관점)
  - 위치: 없음 — 환경 특성(워크트리 중첩 → `node-linker=isolated` 무력화)에 대한 관측, 특정
    코드 줄 아님. plan 부록 "`spec-links.ts` 가 ... import 하는데 어느 매니페스트에도 선언이
    없었다. 그런데 로컬에서는 13 tests 가 통과한다" 서술부 참조.
  - 상세: `spec-links.test.ts`/`spec-link-integrity.test.ts` 자체는 정상적이고 잘 짜인 테스트지만,
    이 특정 결함(미선언 의존)은 로컬 워크트리 구조상 부모 `node_modules` 로 해소가 새어나가
    "테스트 통과"가 곧 "매니페스트가 맞다"를 보증하지 않는 특수 상황이었다(실제로 이번
    수정 전에도 로컬은 그린이었다). 즉 이 케이스에서는 "회귀 테스트가 여전히 유효한가"라는
    일반 원칙이 로컬 실행 환경에서는 성립하지 않고, CI(평평한 체크아웃)에서만 실제로 검증된다.
  - 제안: 이 PR이 실제로 문제를 고쳤는지의 최종 확인은 이 워크트리의 로컬 vitest 재실행이
    아니라 `spec-link-checks.yml` CI 워크플로가 그린으로 도는 것으로 확정해야 한다(로컬 실행은
    이미 위양성 이력이 있는 채널). plan 문서의 "#6 | 본 PR" 상태 갱신 시 CI 그린 확인 여부를
    함께 기록하면 향후 같은 클래스 재발 시 "로컬에서 됐었는데" 식 재조사 비용을 줄일 수 있다.

- **[INFO]** devDependencies 선언 자체는 정확하다
  - 위치: `codebase/frontend/package.json:78-93`(게이트 기준)
  - 상세: 4개 패키지(`@types/mdast`, `github-slugger`, `mdast-util-from-markdown`,
    `mdast-util-to-string`) 모두 `codebase/frontend/src/lib/docs/__tests__/` 안에서만
    쓰이고(grep으로 실측: production 소스 경로에 사용처 없음) 런타임 번들에 들어가지 않으므로
    `devDependencies` 배치가 맞다. alphabetical 정렬도 유지됐다. 별도 조치 불필요.

## 요약

애플리케이션 코드 변경이 없는 순수 매니페스트/lockfile 정정 PR이다. 새 로직이 없으므로
신규 단위 테스트를 요구할 대상 자체가 없고, 이 정정이 봉합하는 결함(CI에서만 재현되는
미선언 의존)은 기존 테스트(`spec-links.test.ts` 17개)로 이미 충분히 커버되며 이번에 직접
재실행해 통과를 확인했다. 부수적으로 lockfile 전역에 걸친 jest/ts-jest peer 해석 문자열
churn이 있어 backend 쪽 회귀 가능성을 별도로 실측했고 영향 없음을 확인했다. 남은 갭(같은
결함 클래스를 잡는 자동 가드 부재, 로컬 검증의 신뢰도 한계)은 모두 작성자가 plan 문서에
이미 스스로 기록하고 후속 과제로 명시한 것이라 이 PR을 막을 사유는 아니다.

## 위험도

LOW
