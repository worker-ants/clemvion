# 테스트(Testing) 리뷰 — `src/lib → @/components` 레이어 가드 fail-open 방지

리뷰 범위: `git diff origin/main..HEAD` (4 커밋: `a1e2ec8af` severity 강등 mutation 보강 →
`e6e0fdc0d` 리뷰 산출물 → `161699c7a` 백틱 우회 차단 + 파서 배선 → `3159b921b` 리뷰 산출물).
실질 코드 diff는 `codebase/frontend/eslint.config.mjs` 와
`codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts` 두 파일. 나머지는
`review/code/2026/07/17/{18_06_36,18_43_17}/**` 신규 산출물(직전 세션 기록, 코드 아님) —
테스트 관점 리뷰 대상이 아니어서 별도 언급하지 않음.

## 검증 수행 내역 (읽기 전용, 워킹트리 미변경)

- `codebase/frontend/eslint.config.mjs`, `eslint-layering-guard.test.ts` 전문 정독.
- `npx vitest run src/lib/__tests__/eslint-layering-guard.test.ts` 재실행 → **34/34 통과**
  (main 이 보고한 결과와 일치, 재현 확인).
- `node --input-type=module` 로 `eslintConfig` 를 로드해 `languageOptions.parser` 를 가진
  블록을 실측 열거 → index 0 (`eslint-config-next/parser`, `**/*.{js,jsx,mjs,ts,tsx,mts,cts}`),
  index 1 (`typescript-eslint/parser`, `**/*.ts`/`**/*.tsx`), index 4 (`typescript-eslint/parser`,
  `files: undefined`, 전역 override) 3개. 테스트의 `tsParser` 선택 로직(`.includes("ts")` +
  `.at(-1)`)이 이 3개 중 마지막(index 4, `typescript-eslint/parser`)을 고르며, 이는 실제 ESLint
  가 `.ts` 파일에 최종 적용하는 파서와 일치함(같은 모듈 인스턴스, override 순서상 index 4 가
  마지막에 적용됨) — 우연이 아니라 flat config 의 "나중 블록 우선" 병합 순서와 부합.
- `git diff origin/main..HEAD -- codebase/` 로 프롬프트 payload 의 diff 내용과 실제 워킹트리
  상태가 바이트 단위로 일치함을 대조.
- mutation 재실행은 지시에 따라 생략(main 이 이미 실측: severity 강등 15 fail, 백틱 selector
  제거 5 fail, parser 미배선 fail-loud throw, `NEVERMATCH` 상수 8 fail, 앵커 완화 1 fail).

## 발견사항

- **[INFO]** 규칙 메시지 상수(`DYNAMIC_IMPORT_MSG` / `REQUIRE_MSG`) swap 이 어떤 테스트로도 잡히지 않음
  - 위치: `codebase/frontend/eslint.config.mjs:19-22,74,79,84,89`,
    `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:156-163`
  - 상세: `layeringErrors()` 호출부는 `errors.length > 0` 과 `severity === 2` 만 검증하고
    `message` 내용은 어떤 테스트에서도 assert 하지 않는다. 만약 두 selector 블록에서
    `DYNAMIC_IMPORT_MSG` 와 `REQUIRE_MSG` 를 실수로 맞바꾸면(예: `require()` 위반에
    "동적 import() 로도..." 메시지가 뜸) 가드는 여전히 정상적으로 차단하므로(severity 불변,
    `errors.length` 불변) 34개 테스트 전부 그대로 통과한다. 차단 자체는 회귀가 아니지만
    개발자에게 잘못된 안내 메시지가 노출되는 것은 이 가드의 UX 목적(오해 방지, "components
    쪽에서 re-export" 안내)을 부분적으로 훼손한다.
  - 제안: 대표 케이스 1~2개에 한해 `expect(errors[0].message).toBe(...)` 또는
    `expect(errors[0].message).toContain("require()")` / `.toContain("import()")` 처럼 selector
    별 메시지 방향성만 최소 검증. 저비용, 이번 diff 범위 밖이라도 무방.

- **[INFO]** `require()` 의 2단계 상대경로 우회(`../../components/foo`)가 백틱·리터럴 양쪽 모두 미테스트
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:131-141` (2단계는
    정적 import·동적 `import()` 에만 존재, `require()` 는 1단계만)
  - 상세: `COMPONENTS_PATH_RE` 의 `(\.\.\/)+components` 는 `+` 양화사라 정규식 자체는
    임의 단계를 커버하지만, 회귀 방지 관점에서 "1단계는 되는데 2단계부터 깨지는" mutation
    (예: `(\.\.\/)+` → `\.\.\/`, 즉 `+` 제거)이 발생하면 정적 import·동적 import 케이스는
    잡아내지만 `require()` 전용 회귀(있다면)는 이 세 종류 중 어느 하나가 아니라 전부 동일
    상수를 공유하므로 실질적으로는 이미 다른 케이스가 잡아준다 — 실사용 위험은 낮음.
  - 제안: `it.each` 목록에 `require() 상대경로 우회(2단계)` 1건 추가해 대칭성을 맞추면 향후
    `require()` selector 만 별도 상수로 분리되는 리팩터가 생겨도 계속 안전.

- **[INFO]** `tsParser` 선택 휴리스틱(`c.files` 문자열에 `"ts"` 부분일치 + 배열의 마지막 원소)이
  향후 config 구조 변화에 취약할 수 있음
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:41-48`
  - 상세: 현재는 파서를 갖는 블록이 3개뿐이라 정확히 올바른 파서를 고르지만(실측 확인,
    위 "검증 수행 내역" 참고), 이는 "글롭 문자열에 `ts` 부분열이 포함되고 배열상 가장 늦게
    등장하는 파서가 곧 `.ts` 파일에 최종 적용되는 파서"라는 우연적 성립에 의존한다. 예를 들어
    향후 `**/*.test.ts` 전용 블록에 별도 파서(vitest 관련)가 추가되고 그 블록이 배열에서
    현재의 index 4 보다 뒤에 위치하면, `tsParser` 가 실제 `src/lib/**` 런타임 파서가 아닌
    테스트 전용 파서를 골라 fixture 파싱 결과가 조용히 달라질 수 있다(즉시 throw 되지 않는
    조용한 오탐지 경로 — 이 테스트 파일 자신의 fail-open 취약점).
  - 제안: 당장 조치 불요(현재 구조에서는 정확). 다만 주석에 "이 선택 로직은 파서 블록이
    3개 이하이고 `src/lib/**` 이후 마지막에 전역 override 되는 현재 구조를 전제로 한다"는
    가정을 명시해 두면 향후 config 구조 변경 시 리뷰어가 이 지점을 재점검하기 쉬워진다.

- **[INFO]** 메시지·문서화된 커버리지 한계 외 항목은 mutation testing 으로 충분히 폐쇄됨(긍정 평가)
  - 위치: 전체
  - 상세: 이번 두 파일 diff는 (1) config 자체를 fixture 삼아 실제 `Linter#verify` 로 검증하는
    통합 테스트 방식이라 mock/stub 이 전혀 없고 "테스트와 실제 동작의 괴리" 위험이 구조적으로
    낮다, (2) 백틱·`import type`·re-export·근접 오탐(`components-legacy`)·인터폴레이션 계산
    경로 등 이번 세션 전 발견된 사각지대를 fixture 로 고정했고, 실측 재실행(34/34)으로 회귀
    없음을 확인했다, (3) 각 rule-mutation(severity 강등·override off·상수 무력화·앵커 완화)에
    대해 fail 재현 후 원복하는 방식으로 "테스트가 실제로 가드 역할을 하는지"를 증명했다 —
    일반적인 유닛 테스트보다 훨씬 높은 신뢰 수준. 별도 조치 불요, 참고용 기록.

## 요약

`eslint.config.mjs` 의 정규식/selector 상수화와 `eslint-layering-guard.test.ts` 의 flat-config
병합 재현·TS 파서 배선·severity 실측 검증은 "가드가 fail-open 하지 않게"라는 브랜치 목표에
정확히 부합하며, mock 없이 실제 `Linter#verify` 를 구동하는 통합 테스트 설계 덕분에 테스트와
실제 동작의 괴리가 구조적으로 작다. 테스트 격리·가독성·회귀 안전성 모두 양호하고(모듈 레벨
상수만 공유하며 부작용 없음, 케이스별 한글 라벨과 근거 주석이 명확, 기존 assertion 은 전부
보존·강화만 됨), 직전 세션에서 지적된 백틱 우회와 파서 미배선은 커밋 `161699c7a` 로 실측
해소되었다(재실행 34/34 확인). 남은 갭은 메시지 내용 미검증·`require()` 2단계 상대경로
비대칭·`tsParser` 선택 휴리스틱의 향후 구조 변화 취약성 정도로, 모두 가드의 차단 여부 자체에는
영향을 주지 않는 저위험·저비용 개선 여지이며 이번 diff 를 막을 사유는 아니다.

## 위험도
LOW
