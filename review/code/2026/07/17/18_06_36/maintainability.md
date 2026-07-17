# 유지보수성(Maintainability) 리뷰

대상: `codebase/frontend/eslint.config.mjs`, `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts` (uncommitted working diff)

## 발견사항

- **[INFO]** `no-restricted-imports` 의 glob 패턴과 `no-restricted-syntax` 의 정규식이 여전히 별도 문법으로 같은 개념을 중복 표현
  - 위치: `codebase/frontend/eslint.config.mjs:38-44` (group 배열) vs `:7` (`COMPONENTS_PATH_RE`)
  - 상세: 이번 diff 는 두 `no-restricted-syntax` selector(`ImportExpression`, `CallExpression`) 사이에 있던 정규식 리터럴 중복을 `COMPONENTS_PATH_RE` 상수로 성공적으로 제거했다 (item 6 "중복 코드" 개선, drift 방지 주석도 명확함). 다만 `no-restricted-imports` 의 `group: ["@/components", "@/components/**", "**/../components", "**/../components/**"]` 은 minimatch glob 문법이라 이 정규식 상수를 공유할 수 없는 구조적 제약이 있다. 결과적으로 "bare 형태 + 하위 경로" 라는 동일한 매칭 의도가 (a) glob 4-엔트리, (b) 정규식 1-소스, 총 두 군데에 나뉘어 존재한다. 향후 매칭 대상(예: 새로운 alias, 새로운 우회 경로 형태)이 추가될 때 한쪽만 갱신되고 다른 쪽이 누락될 여지가 여전히 남는다.
  - 제안: 이번 diff 범위를 넘는 개선이므로 필수는 아니지만, 파일 상단 주석에 "이 파일에서 `@/components` 경로를 매칭하는 지점은 총 2곳(그룹 patterns, `COMPONENTS_PATH_RE`)이며 함께 갱신해야 한다"는 크로스 레퍼런스를 명시하면 향후 drift 위험을 낮출 수 있다. (테스트 쪽에 이미 이런 취지의 mutation-방지 주석이 있어 결이 비슷함.)

- **[INFO]** 정규식 소스를 esquery selector 문자열에 템플릿 리터럴로 삽입해 간접 계층이 한 단계 늘어남
  - 위치: `codebase/frontend/eslint.config.mjs:55, 61`
  - 상세: `` `ImportExpression[source.value=/${COMPONENTS_PATH_RE}/]` `` 형태는 selector 전체를 한눈에 읽으려면 `COMPONENTS_PATH_RE` 정의를 별도로 찾아 봐야 한다. DRY 목적상 타당한 트레이드오프이고, 상단에 "두 selector 가 공유한다"는 주석이 이미 이 간접성을 상쇄하고 있어 심각하지 않음.
  - 제안: 특별한 조치 불필요. 굳이 개선한다면 상수 선언 옆에 실제로 매칭/비매칭되는 예시 1~2개(`@/components`, `@/components/foo`, `../../components/foo` 등)를 추가하면 정규식을 재해석하는 비용을 더 줄일 수 있음.

- **[INFO]** 테스트의 fail-open 가드 에러 메시지가 새 로직(빈 rules 병합 검출)과 문구상 완전히 일치하지 않음
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:32-37`
  - 상세: 조건이 `!layeringBlock?.rules`(블록 자체를 못 찾음) 에서 `Object.keys(mergedRules).length === 0`(매칭 블록은 있으나 병합 결과가 비어있는 경우도 포함)으로 넓어졌는데, 에러 메시지는 여전히 "가드 블록을 찾지 못했습니다"로만 되어 있어 "블록은 찾았지만 규칙이 전부 비어있음"인 케이스의 원인 진단에는 약간 부정확하다.
  - 제안: 메시지를 "가드 블록을 찾지 못했거나 규칙이 비어 있습니다" 정도로 미세 조정하면 실패 시 디버깅이 조금 더 빨라짐. 우선순위 낮음.

## 긍정적으로 확인된 점 (참고)

- `COMPONENTS_PATH_RE` 네이밍(UPPER_SNAKE_CASE)은 동일 디렉터리의 `scripts/copy-widget.mjs` (`WIDGET_PACKAGE`, `CODEPLOY_DIR` 등) 컨벤션과 일치.
- 테스트 파일의 `layeringBlock`(단수, `.find`) → `layeringBlocks`(복수, `.filter`) + `mergedRules`(flat config "나중 블록 우선" 병합 재현) 변경은 실제로 존재하는 fail-open 위험(같은 `files` glob 을 매칭하는 뒤쪽 override 블록이 규칙을 조용히 무력화해도 첫 블록만 보면 테스트가 계속 초록)을 정확히 겨냥한 수정이며, 주석이 왜 이 변경이 필요한지 근거(이전 리뷰 WARNING #1·#2, `review/code/2026/07/17/16_33_59/SUMMARY.md`)까지 명시해 추적 가능성이 좋음. 소스 코드 주석에서 `review/code/<path>` 리포트를 근거로 인용하는 패턴은 `sanitize-loader-error.ts`, `loader-error-messages.ts`, `catalog-required-fields.spec.ts` 등에서 이미 쓰이는 기존 관례와 일치.
- 새로 추가된 bare-경로 4개 `it.each` 케이스는 "이 케이스가 없으면 어떤 mutation 이 통과해버리는지"를 명시한 주석과 함께 추가되어, 회귀 방지 의도가 코드만 봐도 파악됨. 기존 엔트리와 동일한 1-라인 배열 스타일을 유지해 일관성도 양호.
- 두 파일 모두 함수 길이·중첩 깊이·순환 복잡도 측면에서 우려되는 지점 없음 (선언적 config/테스트 데이터 위주).
- (조사 과정 메모) 리뷰 중 셸 세션에서 두 차례 `git diff`/`cat` 결과가 서로 다른 버전을 보여준 순간이 있었으나, 최종 안정화된 `git diff --stat` 및 `Read` 툴 결과는 `prompt_file` 에 기재된 diff와 정확히 일치함을 확인했다 (공유 워크트리 동시 편집으로 인한 일시적 아티팩트로 판단, 최종 리뷰는 안정화된 버전 기준).

## 요약

이번 diff 는 두 파일 모두 유지보수성을 개선하는 방향이다. `eslint.config.mjs` 는 두 `no-restricted-syntax` selector 간에 있던 정규식 리터럴 중복을 이름 있는 상수로 제거해 drift 위험을 낮췄고, 테스트 파일은 ESLint flat config 의 "나중 블록 우선" 병합 규칙을 실제로 재현하도록 고쳐 이전 리뷰에서 지적된 fail-open 허점을 근본적으로 막았다. 네이밍·주석·테스트 커버리지 모두 기존 코드베이스 관례와 일관되며, 남은 지적은 전부 INFO 수준(구조적으로 불가피한 glob/regex 이중 표현, 간접성 완화를 위한 예시 추가, 에러 메시지 미세 조정)으로 즉시 조치가 필요한 결함은 발견되지 않았다.

## 위험도

LOW
