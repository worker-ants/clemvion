# 테스트(Testing) 리뷰 — interaction-type exhaustiveness AST 가드

대상:
- `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts`
- `codebase/frontend/src/lib/conversation/interaction-type-registry.ts` (주석 문구만 변경, 기능 변경 없음)

## 발견사항

- **[WARNING]** 실제 프로덕션 엔트리포인트 `collectCodeStringLiterals` 가 `.tsx` 파일명으로는 테스트 스위트 어디에서도 호출되지 않음 — mutation testing 으로 실측 확인
  - 위치: `collectCodeStringLiterals` 정의(파일 137행 부근)와 이를 호출하는 모든 `it()` — `describe("collectCodeStringLiterals", ...)` 블록의 `.tsx` JSX 자가테스트(286행 부근)·`.ts` 캐스트 자가테스트(320행 부근), 그리고 `describe("WaitingInteractionType exhaustiveness ...")`/`describe("ConversationTurnSource exhaustiveness ...")` 의 실제 가드 실행부
  - 상세: `grep -n "collectCodeStringLiterals("` 로 전수 확인한 결과, 이 함수는 `"fixture.ts"` 4회, `.ts` 레지스트리 사이트 경로들(현재 전부 `.ts`)로만 호출된다. `.tsx` JSX 자가테스트는 `parseGuardSource` + `treeContainsJsx` 를 직접 호출하고, `collectCodeStringLiterals` 를 거치지 않는다. `.ts` 캐스트 자가테스트는 `collectCodeStringLiterals(tsCast, "fixture.ts")` 를 호출하지만 파일명이 `.ts` 라 `ScriptKind.TS` 가 정답이므로, `parseGuardSource` 경유 여부와 무관하게 항상 같은 결과가 나온다.
    실측으로 확인: `collectCodeStringLiterals` 내부를 `parseGuardSource(source, fileName)` 호출 대신 `ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS)` 하드코드(= PR #972 이전의 실제 버그, `parseGuardSource` 배선을 완전히 우회)로 mutate 한 뒤 `vitest run` 을 실행하면 **8개 테스트가 모두 그대로 통과**한다(반례 재현 후 원복 완료, 저장소에 잔존 변경 없음). 이번 커밋의 제목 자체가 "self-test 가 실제 파스 경로 관통하도록 배선"이고, JSDoc 도 "`collectCodeStringLiterals` 와 `.tsx` self-test 가 모두 이 함수를 통해 파싱한다"고 명시적으로 주장하는데, 그 주장이 `scriptKindForFile`/`parseGuardSource` 자체의 로직 회귀에는 맞지만(그 회귀는 JSX 자가테스트가 정확히 잡음), `collectCodeStringLiterals` 가 `parseGuardSource` 호출 자체를 우회하는 (더 좁지만 실제로 과거 있었던) 회귀 클래스는 어떤 테스트도 잡지 못한다.
    다만 실제 런타임 위험은 낮다: (1) 오늘 등록된 모든 레지스트리 사이트가 `.ts` 이므로 현재 프로덕션 정확성엔 영향 없음, (2) 별도 프로브로 JSX 속성에만 등장하는(비-JSX 중복 없는) 리터럴을 TS 로 오파싱해봐도 TS 파서의 error recovery 가 리터럴을 살려내는 것을 확인함(JSDoc 의 "error recovery keeps literals alive either way" 주장과 일치) — 그래서 이 갭이 즉시 실패를 유발할 가능성은 낮지만, "증명되지 않은 가정"에 의존하는 구조라는 점은 이 파일 자신의 매우 엄격한 자기검증 철학과 어긋난다.
  - 제안: `.tsx` JSX 자가테스트 옆에 실제 엔트리포인트를 관통하는 어서션을 추가한다. 예: `expect(collectCodeStringLiterals(tsxSite, "result-view.tsx").has("ai_form_render")).toBe(true)` (가능하면 비-JSX 위치에 중복이 없는, JSX 속성/표현식에만 등장하는 리터럴로 구성해 실제 threat model 을 더 정확히 겨냥). 이렇게 하면 `collectCodeStringLiterals` 가 `parseGuardSource` 호출을 우회하는 회귀도 이 파일 하나로 잡힌다.

- **[INFO]** 일부 자가테스트가 TypeScript 파서의 error-recovery 동작(비공개 구현 세부사항)에 의존
  - 위치: 320행 부근 `"parses a .ts angle-bracket cast as a cast, keeping its literal (not TSX)"` — `expect(collectStringLiteralsFrom(asTsx).has("cast_kept_literal")).toBe(false)`
  - 상세: 이 부정 어서션은 "`<Config>{...}` 캐스트를 TSX 로 파싱하면 객체 리터럴 전체가 유실된다"는, 문서화된 계약이 아닌 `typescript` 패키지의 error-recovery 구현 세부사항에 의존한다. 오늘 실측(현재 `typescript` 버전)으로는 참이지만, 향후 `typescript` 메이저 업그레이드가 error-recovery 휴리스틱을 바꾸면 가드 로직 자체의 회귀 없이 이 자가테스트만 flip 되어 거짓 CI 실패를 낼 수 있다.
  - 제안: 즉각 조치 불요(테스트된 구문 형태 — 레거시 앵글브래킷 캐스트·기본 JSX — 는 안정적이라 위험 낮음). `typescript` 업그레이드 PR 에서 이 파일이 실패하면 "가드 로직 회귀"가 아니라 "파서 error-recovery 변경"일 가능성을 먼저 배제하라는 주석을 남겨두면 향후 트리아지 비용을 줄일 수 있다.

- **[INFO, 긍정]** 테스트 용이성 개선
  - 위치: `scriptKindForFile` / `parseGuardSource` / `collectStringLiteralsFrom` / `treeContainsJsx` 로의 함수 분리(기존 단일 `collectCodeStringLiterals` 모놀리스에서 추출)
  - 상세: 각 헬퍼가 단일 책임의 독립 함수로 분리되어 `describe("scriptKindForFile", ...)` 같은 순수 단위 테스트가 가능해졌고, `.tsx`/`.ts` 자가테스트도 프로덕션 파스 체크포인트(`parseGuardSource`)를 공유하도록 배선되어 PR #972 WARNING #2 급의 "자가테스트가 실제 코드 경로와 분리되어 되돌림을 못 잡는" 회귀 클래스를 상당 부분 막는다. 회귀 테스트·가독성·격리 측면에서 모두 양호(각 `it` 이 로컬 fixture 만 사용, 상호 의존 없음, 방대하지만 명확한 rationale 주석 동반).

## 요약

이번 diff 는 `interaction-type-exhaustiveness.test.ts` 의 AST 가드 자체를 mutation-testing 스타일로 더 촘촘히 만드는 순수 테스트 강화 커밋이며(`interaction-type-registry.ts` 쪽은 주석 문구만 변경), 새 자가테스트들은 기존 회귀(PR #968 주석 오탐, PR #972 WARNING #1·#2 의 ScriptKind 오분기)를 정확히 겨냥해 잘 설계되어 있다. 다만 실제로 mutation 을 넣어 검증한 결과, 이 커밋의 핵심 목표("self-test 가 실제 파스 경로 관통")가 완전히 달성되지는 않았다 — 프로덕션이 실제로 호출하는 `collectCodeStringLiterals` 함수 자체는 `.tsx` 파일명으로 한 번도 exercise 되지 않아서, 그 함수가 `parseGuardSource` 호출을 완전히 우회하도록 되돌려도(하드코드 `ScriptKind.TS`) 8개 테스트가 전부 green 을 유지한다(직접 재현·원복 완료). 오늘은 모든 레지스트리 사이트가 `.ts` 라 프로덕션 정확성에 즉각적 위험은 없지만, 이 파일이 스스로 방어하겠다고 선언한 정확히 그 위협 모델(미래 `.tsx` 사이트)에 대해 증명되지 않은 가정에 기대고 있다는 점에서 WARNING 으로 표기한다. 그 외 mock 은 해당 없음(순수 함수 + 실제 레포 파일 읽기가 적절), 테스트 격리·가독성·회귀 유효성은 모두 양호하고 리팩터가 테스트 용이성도 개선했다.

## 위험도

MEDIUM
