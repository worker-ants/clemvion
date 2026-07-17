# 문서화(Documentation) Review

리뷰 대상: `git diff origin/main..HEAD` 중 코드 변경분
- `codebase/frontend/eslint.config.mjs`
- `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts`

(`review/code/2026/07/17/18_06_36/**` 산출물은 CLAUDE.md 정보 저장 위치 표에 따른 정상 산출물 저장 경로이므로 본 리뷰에서 문서화 결함으로 다루지 않음.)

## 검증 방법

- `COMPONENTS_PATH_RE` 정규식을 Node 에서 실제로 컴파일해 주석이 서술하는 매칭 범위(bare·하위경로·alias·상대경로)와 실측 대조.
- 테스트 파일 상단 JSDoc 이 인용하는 `review/code/2026/07/17/16_33_59/SUMMARY.md` 의 WARNING #1·#2 실존 여부와 문구 대응 확인.
- `codebase/frontend/package.json` 의 `lint` 스크립트(`"eslint"`, `--max-warnings` 없음)를 실측해 신규 테스트 설명 문구("CI lint 가 max-warnings 무제한으로 통과") 검증.
- 직전 커밋(`e370d1d02`, 레이어 가드 최초 도입)의 CHANGELOG 처리 관례를 대조해 이번 diff 의 CHANGELOG 생략이 일탈인지 확인.

## 발견사항

- **[INFO]** `ruleSeverity` 헬퍼 주석의 "정규화" 표현이 실제 동작보다 넓게 읽힐 수 있음
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:41-45`
  - 상세: 주석 "규칙 배열의 첫 원소(severity)를 문자열/숫자 어느 표기든 정규화해 꺼낸다"는 마치 severity 표기가 문자열(`"error"`)이든 숫자(`2`)든 동일한 값으로 변환해 반환하는 것처럼 읽힐 여지가 있다. 그러나 실제 구현은 `Array.isArray(rule) ? rule[0] : rule` 로 "배열 형태 vs bare 값 형태"만 통일할 뿐, `2` 를 `"error"` 로 변환하지는 않는다. 현재 config 의 두 규칙이 항상 문자열 `"error"` 표기를 쓰고 있어 지금 당장 문제는 없지만(`expect(ruleSeverity(...)).toBe("error")` 가 통과), 향후 누군가 규칙을 숫자 표기(`[2, {...}]`)로 바꾸면 기능적으로 동일한데도 이 assertion 이 실패해 "규칙이 진짜 약화됐다"는 착각을 줄 수 있다.
  - 제안: 주석을 "배열/비배열 형태를 통일해 꺼낸다(문자열-숫자 severity 값 자체를 상호 변환하지는 않음)"으로 좁히거나, 함수에 `rule[0] === 2 || rule[0] === "error" ? "error" : rule[0]` 같은 실제 정규화를 추가해 주석과 동작을 일치시킨다. 우선순위 낮음(현재 config 표기와 불일치 없음).

- **[INFO]** bare 케이스 주석이 두 종류의 서로 다른 mutation 근거를 하나로 뭉뚱그림
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:77-78`
  - 상세: "이 케이스가 없으면 config 의 bare 엔트리를 제거하는 mutation 이 테스트를 통과해버린다"는 설명은 `no-restricted-imports.patterns[0].group` 의 명시적 bare glob 엔트리(`"@/components"`, `"**/../components"`)에는 정확히 들어맞지만, 같은 블록에 추가된 "동적 import() alias bare"/"require() 상대경로 bare" 2건은 `COMPONENTS_PATH_RE` 의 `(\/.*)?` optional 그룹이 지키는 영역이라 서로 다른 mutation 클래스(예: optional 그룹을 필수로 바꾸는 정규식 약화)에 대응한다. `RESOLUTION.md` 의 mutation 로그(`no-restricted-imports` bare 엔트리 제거 2건 fail, `COMPONENTS_PATH_RE` 전체 무력화 8건 fail)를 보면 실제로는 별개 실험으로 검증됐음을 알 수 있어 주석과 실측 자체는 모순되지 않으나, 주석만 읽으면 4건 전부가 "config 의 bare glob 엔트리 제거"라는 단일 원인에서만 나온 것처럼 오인될 수 있다.
  - 제안: 정적 2건과 동적/require 2건을 분리해 "정적 bare — `no-restricted-imports` 의 bare glob 엔트리 방어, 동적/require bare — `COMPONENTS_PATH_RE` 의 optional 서브패스 그룹 방어"로 나눠 서술하면 더 정확하다. 우선순위 낮음.

- **[INFO]** CHANGELOG.md 미갱신 — 관례상 문제 없음
  - 위치: 루트 `CHANGELOG.md` (이번 diff 에서 미변경)
  - 상세: 프로젝트 `CHANGELOG.md` 는 사용자/제품 가시 변경을 "Unreleased" 섹션에 적극 기록하는 관례를 보인다. 이번 diff(ESLint 정규식 상수 추출 + 테스트 mutation 커버리지 보강)는 내부 CI/개발 도구 성격이라 제품 동작에 영향이 없다. 직전 커밋(`e370d1d02`, 레이어 가드 최초 도입)도 CHANGELOG 를 갱신하지 않은 선례가 있어 이번 diff 의 생략은 프로젝트 관례와 일치한다. 조치 불요, 참고용 기록.

- **[INFO]** README/spec 문서화 갭은 신규가 아니라 기존 트래킹 항목
  - 위치: `codebase/frontend/README.md` (레이어 규약 관련 서술 없음), `spec/conventions/` (레이어 경계 전용 문서 없음)
  - 상세: `src/lib → components` 레이어 역전 금지 규약을 다루는 `spec/conventions/*.md` 가 여전히 부재하나, 이는 선행 리뷰(`review/code/2026/07/17/17_29_21/SUMMARY.md` WARNING#4, `18_06_36/SUMMARY.md` INFO#8)에서 이미 식별되어 `project-planner` 위임으로 트래킹 중이다. 이번 diff(`COMPONENTS_PATH_RE` 상수화 + severity mutation 테스트 보강)의 직접 범위는 아니므로 신규 발견으로 중복 제기하지 않는다.
  - 제안: 별도 조치 불요(이미 트래킹됨을 확인).

## 정확성 확인된 항목 (문제 없음)

- `eslint.config.mjs:5-6` `COMPONENTS_PATH_RE` 상단 주석 — "`@/components` · `../components`(bare 및 하위 경로)를 매칭"과 "동적 `import()` / `require()` selector 두 곳이 공유"는 정규식을 직접 컴파일해 대조(`@/components`→true, `@/components/foo`→true, `../components`→true, `../../components/foo`→true, `@/componentsFoo`→false 등) 및 실제 사용처(라인 55, 61 두 곳)로 검증 완료. 오래된 주석 없음.
- `eslint.config.mjs:27-30` 기존 "커버리지 한계" 주석(정적 import/export 만 검사, 리터럴 specifier 만 매칭)은 이번 diff 로 변경되지 않았고 실제 규칙 구성과 여전히 일치.
- 테스트 파일 상단 JSDoc(5-17행) — `review/code/2026/07/17/16_33_59/SUMMARY.md` 의 WARNING #1(동적 import/require 우회 미탐지)·#2(회귀 테스트 부재)를 인용하는데, 해당 디렉터리·문구 모두 실존 확인. `npx eslint src/lib` 가 위반 0건일 때 "0 errors" 로 통과한다는 서술도 사실과 부합.
- 신규 테스트 설명 문구(69-70행) "`\"warn\"` 으로 조용히 강등되면 CI lint 가 이 위반을 통과시켜버린다 (max-warnings 무제한)" — `codebase/frontend/package.json` 의 `lint` 스크립트가 `"eslint"` 단독(플래그 없음)임을 실측해 확인, 정확한 서술.
- `layeringBlocks`/`mergedRules` 관련 신규 주석(19-23, 28행) — "나중 블록 우선" flat config 병합 재현 근거는 `RESOLUTION.md` 의 mutation 재현 로그(override "off" 화 시 15건 fail)와 정합.
- `COMPONENTS_PATH_RE` 리팩터 자체는 selector 문자열 기준 순수 동등 치환(`String.raw` 이스케이프가 원본 이중 이스케이프 문자열과 바이트 단위로 동일) — 별도 문서화 오류 유발 없음.

## 요약

이번 diff 는 코드 리팩터(정규식 상수 추출)와 테스트 강화(flat config 병합 재현 + severity/bare 케이스 보강)이며, 신규·기존 주석 모두 실제 동작과 정확히 일치한다는 것을 정규식 실측·package.json 실측·과거 리뷰 문서 대조로 확인했다. 지적할 결함은 두 개의 저우선순위 주석 정밀도 nit(`ruleSeverity` 의 "정규화" 표현이 실제보다 넓게 읽힐 수 있음, bare 케이스 주석이 서로 다른 mutation 클래스를 뭉뚱그림) 뿐이며 둘 다 현재 동작과 모순되지 않는다. README/CHANGELOG/spec 갱신은 이번 변경의 성격(내부 CI 가드 리팩터)과 프로젝트 관례(직전 도입 커밋도 CHANGELOG 미기재) 상 불필요하고, 레이어 규약 전용 spec 문서 부재는 이미 별도 트래킹 중이라 중복 제기하지 않았다.

## 위험도
LOW

STATUS: documentation review complete — output written to /Volumes/project/private/clemvion/.claude/worktrees/heuristic-nightingale-9c8a0e/review/code/2026/07/17/18_43_17/documentation.md
