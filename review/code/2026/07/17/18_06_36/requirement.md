# Requirement Review — codebase/frontend/eslint.config.mjs + eslint-layering-guard.test.ts

## 배경

선행 리뷰(`review/code/2026/07/17/17_29_21/SUMMARY.md`) WARNING #1/#2/#3 에 대한 후속 fix. 대상은 uncommitted working diff 2개 파일(`git diff` 로 확인, HEAD 대비 아직 커밋 안 됨).

- W#1: 회귀 테스트가 flat config "나중 블록 우선" 병합 의미론 미반영 — 첫 블록만 `.find()` 로 검증
- W#2: bare 형태(`@/components`, `../components`) 위반 케이스 부재
- W#3: 동적 `import()`/`require()` selector 정규식 문자 그대로 중복

## 검증 방법

1. `npx vitest run src/lib/__tests__/eslint-layering-guard.test.ts` 정상 실행(20/20 통과, 기존 16개 + 신규 bare 4개).
2. **W#1 mutation 재현**: `eslint.config.mjs` 배열 끝에 동일 `files: ["src/lib/**"]` 를 재매칭하며 두 규칙을 `"off"` 로 되돌리는 override 블록을 추가 → 테스트 14/20 실패(정확히 override 로 무력화된 케이스들). 병합 의미론이 실제로 재현됨을 확인.
3. **W#2 mutation 재현**: `COMPONENTS_PATH_RE` 를 서브패스 필수(`\/.+`)로 좁히고 `no-restricted-imports` 의 `group` bare 엔트리(`"@/components"`, `"**/../components"`)를 제거 → 정확히 신규 추가된 bare 4개 테스트만 실패, 나머지 16개는 그대로 통과. bare 방어선의 존재를 테스트가 실제로 검증함을 확인.
4. **W#3 등가성 검증**: `String.raw` 로 만든 `COMPONENTS_PATH_RE` 를 두 selector 에 보간한 결과 문자열이 리팩터 전 selector 리터럴과 byte-for-byte 동일함을 Node 로 직접 비교(`sel1 equal: true`, `sel2 equal: true`) — 순수 dedup, 동작 변화 없음.
5. 두 mutation 모두 원본으로 복구 후 `git diff --stat`/`git status` 로 리뷰 대상 diff 가 그대로임을 재확인, 재실행 20/20 통과.
6. `spec/conventions/` 에 이 레이어 경계 규약을 다루는 전용 문서 존재 여부 확인 — 없음(선행 리뷰 WARNING#4 로 이미 별도 트래킹 중, 이번 follow-up 범위 아님).

## 발견사항

- **[INFO]** W#1/W#2/W#3 모두 mutation testing 으로 실측 해소 확인. 코드가 의도한 기능(flat config 병합 의미론 반영, bare 위반 검출, selector 정규식 단일 소스화)을 완전히 구현.
  - 위치: `codebase/frontend/eslint.config.mjs:7,55,61`, `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:19-34,73-77`
  - 상세: 위 "검증 방법" 1~5 참고.
  - 제안: 조치 불필요.

- **[INFO]** `if (Object.keys(mergedRules).length === 0)` 가드가 기존 `if (!layeringBlock?.rules)` 의 의도(매칭 블록 부재 시 fail-fast)를 그대로 보존. `layeringBlocks` 가 빈 배열이면 `Object.assign({}, ...[])` → `{}` 이므로 `Object.keys(...).length === 0` 이 참이 되어 동일하게 throw 된다 — 엣지 케이스(매칭 블록 0개) 처리가 리팩터 전후 동치.
  - 위치: `eslint-layering-guard.test.ts:25-31`
  - 상세: 회귀 없음.
  - 제안: 조치 불필요.

- **[INFO]** `mergedRules` 병합에 `Object.assign({}, ...layeringBlocks.map((c) => c.rules ?? {}))` 사용 — 배열 순서(config 원본 배열의 등장 순서)를 그대로 보존하므로 "나중 블록이 앞 블록을 덮어쓴다"는 flat config 병합 규칙과 일치. 다만 이 구현은 최상위 rule-key 단위로만 override 를 재현하며, ESLint 실제 병합기(`FlatConfigArray`)가 수행하는 `files`/`ignores` 매처 정밀도(예: 특정 하위 glob 만 override)까지는 재현하지 않는다 — 그러나 현재 config 의 두 블록(가정: 향후 override 추가 시)이 모두 `files: ["src/lib/**"]` 로 동일하게 broad-match 하는 한 이 단순화로 충분하며, mutation 테스트로 실제 필요한 범위(rule-off override)는 검증됨.
  - 위치: `eslint-layering-guard.test.ts:26-30`
  - 상세: 회색지대 — 향후 `files` 가 서로 다른 override 블록이 추가되면(예: `src/lib/legacy/**` 만 예외 처리) 이 단순 병합이 실제 ESLint 동작과 어긋날 수 있음. 현재 diff 범위에서는 해당 시나리오가 없음.
  - 제안: 조치 불필요(지금 범위 내). 향후 `src/lib/**` 를 세분화하는 override 가 추가되면 이 테스트 헬퍼도 함께 재검토.

- **[INFO] (spec fidelity)** `src/lib → components` 레이어 역전 금지 규약을 다루는 전용 spec 문서(`spec/conventions/*.md`)가 여전히 존재하지 않음(선행 리뷰 WARNING#4 로 이미 식별·트래킹됨, `spec/conventions/frontend-layering.md` 신설 제안). 이번 diff 는 배경에 명시된 대로 W#1/#2/#3(테스트·중복 제거) 만을 범위로 하며 W#4(spec 문서화)는 별도 후속 작업으로 남아 있음 — 이번 변경 자체가 spec 본문과 충돌하지는 않음.
  - 위치: N/A (spec 문서 부재)
  - 상세: CLAUDE.md 원칙상 "정식 규약은 spec/conventions/ 가 단일 진실"인데, 이 규약은 코드 주석에만 존재. 이번 diff 는 그 갭을 넓히지도 좁히지도 않음(범위 밖).
  - 제안: 조치 불필요(이번 diff 범위 아님). 선행 리뷰 권장사항 4번(project-planner 위임)이 여전히 유효.

- TODO/FIXME/HACK/XXX 주석: 두 파일 전수 grep 결과 없음.

## 요약

이번 diff 는 선행 리뷰(17_29_21) 가 지적한 WARNING #1(flat config 병합 의미론 미반영)·#2(bare 위반 케이스 부재)·#3(정규식 중복)을 정확히 목표로 하며, 세 항목 모두 실제 mutation testing(override 무력화 재현, bare 엔트리 제거 재현, selector 문자열 byte-for-byte 비교)으로 완전히 해소됐음을 실측 확인했다. `layeringBlocks` 배열 전체 병합으로 "나중 블록 우선" 의미론을 재현해 향후 rule-off override 를 즉시 탐지하며(14/20 실패로 검증), 신규 bare 4개 테스트 케이스가 서브패스 없는 위반 형태의 사각지대를 정확히 커버하고(4/20 실패로 검증), `COMPONENTS_PATH_RE` 상수 추출은 동작 변화 없는 순수 dedup 임이 확인됐다. 엣지 케이스(매칭 블록 0개 시 fail-fast) 처리도 리팩터 전후 동치이며, TODO/FIXME 등 미완성 표시나 반환값 누락, 에러 시나리오 미정의는 발견되지 않았다. spec 관련해서는 이 레이어 규약을 다루는 전용 spec/conventions 문서가 아직 없으나 이는 선행 리뷰에서 이미 별도 항목(WARNING#4)으로 트래킹 중이며 이번 diff 의 명시적 범위(W#1~#3) 밖이므로 이번 변경의 결함으로 보지 않는다.

## 위험도

NONE
