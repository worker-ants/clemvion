# 요구사항(Requirement) 리뷰 — spec-links.ts 중복 정리

## 검증 방법

- diff 를 라인 단위로 재구성해 리팩터 전/후 `findBrokenLinks`·`findBrokenSpecLinksInSources` 의 모든 분기(self-anchor, isExternal, targetFilter, DEAD/ANCHOR 판정)를 수동으로 대조.
- 실제로 `npx vitest run src/lib/docs/__tests__/spec-links.test.ts src/lib/docs/__tests__/spec-link-integrity.test.ts` 실행 → **17/17 green** (13 기존 + 4 신규, plan 의 "13 tests 동일 green + 4건 추가" 주장과 일치).
- `npx eslint src/lib/docs/__tests__/spec-links.ts src/lib/docs/__tests__/spec-links.test.ts` → clean.
- `npx tsc --noEmit` → 두 파일 관련 에러 없음.
- `grep` 으로 `findBrokenLinksInFiles`(비-export 내부 헬퍼) 외부 소비처가 없음을 확인 — public 시그니처(`findBrokenLinks(root)`, `findBrokenSpecLinksInSources(root)`) 무변경 주장이 사실과 일치.
- `spec/conventions/spec-impl-evidence.md §4.2` (본 가드의 SoT) 대조 — 가드가 검증해야 하는 행위(스펙/코드소스 링크 DEAD+ANCHOR 판정, 생성형 카탈로그·plan 링크 제외, `spec/**.md` 타깃만 소스 스캔)는 이번 리팩터로 전혀 바뀌지 않았고 표 내용과 구현이 여전히 일치.

## 발견사항

- **[INFO]** 공유 코어 `findBrokenLinksInFiles`(`codebase/frontend/src/lib/docs/__tests__/spec-links.ts:628-699`)에 무조건적 `violations.sort(...)` 가 추가되며, 예전에는 정렬을 하지 않던 `findBrokenLinks(spec/**)` 경로에도 정렬이 새로 적용됨(예전 `findBrokenSpecLinksInSources` 는 이미 정렬했음).
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:695-698` (신규 sort) vs. 리팩터 이전 `findBrokenLinks` 말미(`return violations;`, 정렬 없음 — diff 상 `@@ -235,6 +251,19 @@` 직전 컨텍스트로 확인).
  - 상세: 실질적으로는 안전한 no-op이다 — `collectSpecMarkdown`/`collectCodebaseSources` 가 파일을 `relPath` 로 미리 정렬하고, `extractLinks` 가 파일 내부에서 라인을 오름차순으로 순회하므로 두 함수 모두 원래도 이미 `(source, line)` 순으로 결과를 냈다(정렬 유무와 무관하게 동일 순서). 다만 새로 추가된 fixture 테스트(`spec-links.test.ts`)는 비교 시 자체 `fingerprint()` 헬퍼가 다시 `.sort()` 를 적용하므로, 이 정렬 동작 자체를 직접 검증하지는 않는다.
  - 제안: 조치 불요(동작 회귀 없음, 오히려 두 엔트리포인트의 정렬 계약을 명시적으로 통일하는 개선). 별도 fix 없이 참고만.

CRITICAL/WARNING 없음 — TODO/FIXME/HACK/XXX 주석 없음, 모든 분기(self-anchor 검증 on/off, targetFilter 유무, DEAD/ANCHOR 판정, 빈 pathPart/anchor 처리)가 리팩터 전후 동일 동작으로 보존됨을 직접 트레이스로 확인했고, 4개 신규 fixture 테스트 모두 실제로 검증 대상 분기가 깨지면 실패하도록 설계됨(예: "checkSelfAnchors: false" 테스트는 `!options.checkSelfAnchors` 가드를 제거하면 `ignored self` fixture 가 ANCHOR 위반을 만들어 내며 실패하는 non-vacuous 케이스). JSDoc(`findBrokenLinksInFiles`/`findBrokenLinks`/`findBrokenSpecLinksInSources`)도 실제 구현과 line-level 로 일치. `plan/in-progress/eia-context-schema-followups.md` 의 체크박스 전환("`spec-links.ts` 중복 정리" `[ ]` → `[x]`)에 담긴 완료 서술(공유 코어 추출, 시그니처·소비자 계약 무변경, 13+4 테스트 green, lint/unit/build 통과)도 전부 실측과 일치한다.

## 요약

`findBrokenLinks`/`findBrokenSpecLinksInSources` 의 ~40줄 중복 스캔 루프를 `findBrokenLinksInFiles(files, options)` 공유 코어로 추출한 순수 리팩터로, 두 public 함수는 파일 목록 + `checkSelfAnchors`/`targetFilter` 두 옵션만 다른 얇은 wrapper 로 축소됐다. 모든 분기(self-anchor 스킵/검증, external 링크 스킵, targetFilter, DEAD/ANCHOR 판정)를 수동 트레이스와 실제 테스트 실행(17/17 green)으로 검증한 결과 동작 회귀는 없다. 신규 `spec-links.test.ts` 4건은 real-repo positive-only 가드(`spec-link-integrity.test.ts`)가 놓치던 negative-path(DEAD/ANCHOR 실제 검출·`checkSelfAnchors:false` 스킵 분기·healthy no-op)를 non-vacuous 하게 고정하며, 리팩터 대상 함수의 두 옵션 knob 을 정확히 겨냥한다. 관련 spec(`spec/conventions/spec-impl-evidence.md §4.2`)이 정의하는 가드 행위와 구현도 여전히 일치하고, plan 문서의 완료 서술도 실측과 부합한다.

## 위험도

NONE
