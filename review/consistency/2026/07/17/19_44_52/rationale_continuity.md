# Rationale 연속성 Check — `plan/in-progress/spec-draft-frontend-layering.md`

## 조사 방법

- target draft(`plan/in-progress/spec-draft-frontend-layering.md`)를 실제 워크트리에서 재확인 (prompt_file 인라인 사본과 동일함을 대조).
- `spec/` 전역에서 `src/lib`·`src/components`·`src/types`·레이어·layering 관련 기존 `## Rationale` 서술을 검색 — 프론트엔드 모듈 계층(레이어 순서) 을 다루는 기존 spec Rationale은 존재하지 않음을 확인 (신설 영역). prompt_file 에 첨부된 방대한 Rationale 발췌(`spec/0-overview.md`·`spec/1-data-model.md`·`spec/2-navigation/*.md` 등)는 전부 백엔드/제품 도메인 결정이며 프론트엔드 디렉터리 레이어링과 무관 — 직접 충돌 후보 없음.
- 실질적인 "과거 결정"은 spec Rationale이 아니라 (a) PR #967 커밋(`e370d1d02`)의 ESLint 가드 도입 배경, (b) PR #969(`099f63cc`)의 fail-open 경로 차단, (c) `review/code/2026/07/17/17_29_21/{architecture,RESOLUTION}.md`의 WARNING #4·#5 처분(defer)임 — 이 셋을 기준으로 대조.
- `git show e370d1d02`로 현재 `codebase/frontend/eslint.config.mjs` 가드 규칙 실물 확인, `find`/`grep`으로 draft의 실측 표(파일 수·import 방향)를 재현 검증.

## 발견사항

- **[WARNING]** D2 "Why"가 주장하는 순환 방지 범위(`types ↛ lib` 포함)와 "구현 위임"이 실제로 강제하는 범위(`types ↛ components`만)가 어긋남
  - target 위치: `plan/in-progress/spec-draft-frontend-layering.md` D2 절 (Why 세 번째 불릿, "`src/types` 는 `components` 와 `lib` 양쪽이 소비하는 leaf라 레이어 순서상 가장 아래다 — 여기서 위를 참조하면 순환이 된다") vs `## 구현 위임` 절
  - 과거 결정 출처: 같은 draft의 D1("`types < lib < components < app` — 아래 레이어는 위 레이어를 import 하지 않는다")과 D2 자신의 Why 서술. 실체적 선행 결정은 `codebase/frontend/eslint.config.mjs`의 기존 가드(PR #967, `e370d1d02`) — `files: ["src/lib/**"]`에 걸린 `no-restricted-imports`/`no-restricted-syntax` 규칙이 처음부터 **`@/components` 계열만** 차단 대상으로 삼고 있고 `@/lib` 계열은 대상이 아님.
  - 상세: D2의 Why는 "`src/types`가 `lib`과 `components` 양쪽 아래에 있으므로 위(둘 다)를 참조하면 순환이 된다"고 명시해, `types → lib` 방향도 막아야 한다는 취지를 스스로 서술한다. 그러나 `## 구현 위임`에 적힌 실제 변경 지시는 "`files: ["src/lib/**"]` 를 `["src/lib/**", "src/types/**"]` 로 넓히는 것"뿐이다. 이는 기존 규칙(오직 `@/components`·`@/components/**`·상대경로 우회형만 차단, `@/lib` 패턴은 애초에 group에 없음)의 `files` 스코프만 확장하는 것이라, 결과적으로 `src/types/**`가 `@/components`를 import하는 것만 막히고 `@/lib`를 import하는 것은 여전히 무가드로 남는다. 즉 D1이 spec 규약으로 명문화하는 "아래 레이어는 위 레이어를 import 하지 않는다"는 전칭 invariant 중 `types ↛ lib` 페어는, D2가 스스로 든 근거(순환 방지)에도 불구하고 실제 강제 메커니즘에서 누락된다. `developer`가 이 draft를 그대로 구현하면 spec 문서에는 "타입은 어떤 상위 레이어도 참조하지 않는다"는 서술이 SoT로 남는데, ESLint는 그 절반(→components)만 강제하는 상태가 고정된다 — 향후 `src/types/foo.ts`가 `@/lib/...`를 import해도 CI가 통과한다.
  - 제안: 둘 중 하나로 정합을 맞춘다. (1) `## 구현 위임`에 `src/types/**` 전용 블록(또는 기존 블록의 `group`에 `@/lib`/`@/lib/**`/상대경로 우회형 추가)을 명시해 `types ↛ lib`도 실제로 강제하거나, (2) D2 Why의 "여기서 위를 참조하면 순환이 된다"는 문구를 "이번 확장은 `types → components` 방향만 막으며, `types → lib`는 현재 위반 0건이라 별도 후속 결정으로 남긴다" 식으로 명시적으로 스코프를 좁혀, Rationale이 약속하는 범위와 실제 구현 지시가 어긋나지 않게 한다.

- **[INFO]** `src/app/**` 제외(D3)와 top-level 미분류 파일이 레이어 표에서 조용히 빠져 있음
  - target 위치: `plan/in-progress/spec-draft-frontend-layering.md` D3 절, "실측 근거" 표
  - 과거 결정 출처: 없음(신설 결정) — D2 자신의 논리("현재 위반 0건이라도 향후 회귀 차단 가치가 있다")와의 내부 일관성 관점 참고용.
  - 상세: 실측 결과 `src/` 최상위에는 표에 없는 `mdx-components.tsx`, `proxy.ts`, `src/__tests__/`(2파일)가 추가로 존재한다(`types(1)+lib(295)+components(324)+app(133)+content(94)+test(3)=850` vs 실제 `find src -type f`=854, 차이 4). 이들은 Next.js 특수 파일(미들웨어 격인 `proxy.ts`, MDX 컴포넌트 레지스트리)이라 사실상 `app`과 동격으로 취급하는 것이 합리적이지만 draft 표에는 명시되지 않는다. 또한 D3는 "`app`이 `components`/`lib`을 import하는 것은 정방향이라 금지할 대상이 없다"는 논리로 `app`을 범위에서 제외하는데, 이는 "app에서 나가는 import"만 다루고 "`lib`/`components`가 `@/app`을 import하는" 역방향(레이어 역전과 정확히 같은 유형의 위험)에 대해서는 침묵한다. 실측상 `lib→app`·`components→app` import는 현재 0건(가드 불필요와 결론은 동일)이지만, D2가 "위반 0건도 회귀 차단 가치가 있다"고 명시적으로 주장한 논리를 D3에는 대칭 적용하지 않아 두 결정의 근거 서술 사이에 약간의 톤 불일치가 있다. Critical/합의 위반은 아님 — Next.js 관례상 `app/`은 재사용 대상이 아닌 라우트 엔트리라 실질 위험은 낮음.
  - 제안: 최종 `spec/conventions/frontend-layering.md`에 반영 시, (a) top-level 파일(`mdx-components.tsx`, `proxy.ts`, `__tests__/`)의 레이어 소속을 한 줄로 명시하고, (b) `app` 제외 사유에 "app/은 Next.js 라우트 엔트리라 재사용(import) 대상이 되지 않으므로 역방향 가드 실익이 낮다"는 문장을 추가해 D2 Why와의 논리적 대칭성을 보완하면 향후 참조자의 오독을 줄일 수 있다.

## 요약

target draft는 프론트엔드 모듈 레이어링을 다루는 **최초의** spec Rationale이라 "기존 spec Rationale에서 이미 기각·폐기된 결정을 재도입"하는 유형의 CRITICAL 충돌은 발견되지 않았다. 오히려 draft는 선행 코드 리뷰(`review/code/2026/07/17/17_29_21`)가 `spec/` read-only 제약으로 `project-planner`에 위임한 WARNING #4(문서화 부재)·#5(스코프 미결정)를 정확히 그 위임 취지대로 해소하고, `architecture.md`가 제안한 방향("spec/conventions 문서에서 `src/types/**` 확장 여부를 결정")을 그대로 따르며, `RESOLUTION.md`가 defer한 결정 지점을 명시적 Why/Why-not Rationale과 함께 재개한다는 점에서 continuity 관점의 모범 사례에 가깝다. 다만 D2가 스스로 내세운 "순환 방지"근거(`types`가 `lib`·`components` 양쪽을 참조하면 안 된다)와 실제 "구현 위임" 지시(`types → components`만 차단, `types → lib`는 무가드)사이에 범위 불일치가 있어, 이 draft가 그대로 spec화되면 문서가 약속하는 invariant보다 좁은 범위만 실제로 강제되는 상태가 고착될 위험이 있다. `src/app` 방향 배제(D3)의 근거 서술도 D2와 대칭적이지 않아 보완 여지가 있으나 실질 위험은 낮다.

## 위험도

LOW
