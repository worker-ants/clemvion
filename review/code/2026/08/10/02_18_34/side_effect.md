# 부작용(Side Effect) 리뷰 — plan-frontmatter.test.ts

## 발견사항

- **[INFO]** `collectTopLevelPlans` 내부 구현이 로컬 `fs.readdirSync` 직접 호출에서 `plan-scan.ts` 의
  `collectLivePlanMarkdown` 위임으로 변경됨 (동작 위임 변경, 부작용 아님)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:61` (`function collectTopLevelPlans`)
  - 상세: 기존에는 이 파일 안에서 `plan/in-progress/` 를 직접 순회(`0-`/`_` 접두 필터를 손으로 재구현)했으나,
    이제 `plan-scan.ts` 의 공유 구현(`walkPlanMarkdown` 기반)을 호출한다. `collectTopLevelPlans` 자체는
    export 되지 않는 파일-로컬 헬퍼이므로 이 변경으로 영향받는 외부 호출자는 없다(grep 확인:
    `codebase/frontend/src` 전체에서 이 식별자를 참조하는 곳은 이 파일 자신뿐). 필터 규칙(`.md` 확장자 +
    `0-`/`_` 접두 제외 + `isFile()`)과 정렬 기준(경로 문자열 정렬)도 `plan-scan.ts:45-79` 에서 동등하게
    유지되어 실질 동작 변화는 없다. 순수한 중복 제거이며 부작용 관점에서 안전.
  - 제안: 없음 (정보성 확인).

- **[INFO]** 신규 테스트 2건(`top-level in-progress plans have no broken relative links`,
  `no completed plan declares a non-terminal status`)이 실제 저장소의 `plan/**` 트리를 런타임에
  `fs.readFileSync`/`fs.readdirSync` 로 읽음 — 모두 읽기 전용, 쓰기 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:150-165`, `:172-192`
  - 상세: `findBrokenPlanLinks`(`spec-links.ts`)와 `findNonTerminalCompletedPlans`/`collectCompletePlanMarkdown`
    (`plan-scan.ts`)를 grep 확인한 결과 두 모듈 모두 `fs.writeFile*`/`process.env`/네트워크 호출/`global.`·
    `globalThis.` 대입이 전혀 없다. 파일시스템은 읽기 전용으로만 접근되고, 신규 전역 변수 도입이나 기존
    전역/공유 상태 변경도 없다.
  - 제안: 없음 (정보성 확인).

## 부작용 없음 확인 사항 (점검 관점별)

1. **의도치 않은 상태 변경**: 없음 — 모든 함수가 순수 조회(읽기)만 수행.
2. **전역 변수**: `ISO_DATE`/`WORKTREE_PLACEHOLDER`/`WORKTREE_SENTINEL` 은 모듈 스코프 `const` 로 기존과
   동일한 패턴이며 파일 외부에 노출되지 않음. 신규 전역 변수 도입 없음.
3. **파일시스템 부작용**: `fs.readFileSync`/`fs.readdirSync`/`fs.existsSync` 만 사용. 쓰기·삭제·생성 없음.
4. **시그니처 변경**: `collectTopLevelPlans` 는 파일-로컬 비-export 함수라 외부 호출자 영향 없음
   (`codebase/frontend/src` 전역 grep 으로 이 파일 자신 외 참조 없음 확인). `plan-scan.ts`/`spec-links.ts` 의
   export 시그니처는 이 diff 범위 밖(선행 커밋에서 이미 도입)이며 이 파일은 소비만 함.
5. **인터페이스 변경**: `spec-links.ts` 의 `collectLivePlanMarkdown` re-export(`export { collectLivePlanMarkdown }`,
   spec-links.ts:304)가 하위 호환을 유지하고 있어 기존 소비자(`spec-links.test.ts` 등)에 영향 없음.
6. **환경 변수**: 읽기/쓰기 모두 없음 (grep 확인).
7. **네트워크 호출**: 없음 (grep 확인, `LINK_RE.exec` 만 매치되어 정규식 오탐 배제).
8. **이벤트/콜백**: 없음 — vitest `describe`/`it` 프레임워크 콜백 등록 외 별도 이벤트 발생 없음, 기존 패턴과 동일.

## 요약

본 diff 는 테스트 전용 파일(`plan-frontmatter.test.ts`)의 헤더 주석 정정(정본 문서 참조를 `spec-links.ts` →
`plan-scan.ts` 로 수정), 내부 헬퍼 `collectTopLevelPlans` 를 공유 구현(`plan-scan.ts`)으로 위임, 그리고
읽기 전용 신규 테스트 2건(상대링크 무결성·완료 plan status 검증) 추가로 구성된다. 관련 의존 모듈
(`plan-scan.ts`, `spec-links.ts`)까지 확인했으나 파일시스템 쓰기, 전역 변수 도입/변경, 공개 API 시그니처
파괴적 변경, 환경 변수 접근, 네트워크 호출, 이벤트/콜백 변경 중 어느 것도 발견되지 않았다. 변경된
`collectTopLevelPlans` 는 비-export 로컬 헬퍼라 외부 호출자에 영향이 없고, 위임 대상 함수의 필터·정렬
로직도 동등함을 확인했다.

## 위험도

NONE
