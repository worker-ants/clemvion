# 요구사항(Requirement) 리뷰 — interaction-type AST 가드

## 리뷰 대상
- `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts`
- `codebase/frontend/src/lib/conversation/interaction-type-registry.ts`

## 검증 방법
- 전체 파일 컨텍스트 정독 + `git diff origin/main`(fork-point `463aee139`)로 실제 변경분 분리.
- `npx vitest run src/lib/__tests__/interaction-type-exhaustiveness.test.ts` 실행 — 8/8 통과.
- 자체 mutation 실측: `parseGuardSource` 내부 `scriptKindForFile(fileName)` 를 `ts.ScriptKind.TS` 로 하드코딩(리버트 시뮬레이션) → `.tsx` self-test 1건이 즉시 red 로 전환됨을 확인 후 원복(diff 없음 재확인). JSDoc 이 주장하는 "단일 chokepoint 관통" 속성이 실측으로 성립.
- tsconfig.json 의 `exclude` 목록에 `src/**/__tests__/**` 존재 확인 — `interaction-type-registry.ts` 상단 JSDoc 의 "테스트 파일은 tsc 가 안 읽는다" 주장과 일치.
- `MULTI_TURN_INTERACTION_TYPES` 실사용처(`output-shape.ts`) 확인 — export 된 값이 실제로 소비됨.

## 발견사항

- **[INFO]** `[SPEC-DRIFT]` spec/conventions/interaction-type-registry.md 가 이 worktree 안에서 "grep 가드/grep 결과/grep 한 사본" 이라는 옛 용어를 §1.2 rule 3, §2.1 `system_error`/`rag` 행, §4 AST 가드 행, §5 Rationale 3곳에 여전히 담고 있다. 코드(리뷰 대상 두 파일)는 이미 전부 TS AST 파서 기반이며 주석도 "AST 가드" 로 정정됐으므로 코드가 옳다. 다만 이 wording 오류는 **본 changeset 이 만든 것이 아니다** — `git log`로 추적한 결과 이 worktree 의 fork-point(`463aee139`) 이후 origin/main 에 `22cc48ef3 docs(spec): interaction-type-registry — grep 서술을 AST 스캔 용어로 정정 (#972 후속) (#977)` 커밋이 이미 별도로 랜딩해 이 문제를 해소했고, 이 worktree 는 그 커밋을 아직 받지 않은 상태다. 리뷰 대상 두 파일의 diff 자체는 spec 파일을 건드리지 않는다.
  - 위치: `spec/conventions/interaction-type-registry.md` §1.2 rule 3(56행), §2.1 `system_error`/`rag` 행(77-78행), §4 AST 가드 표 행(124행), §5 Rationale(143행·154행)
  - 상세: 코드가 맞고 spec 용어가 낡은 전형적 SPEC-DRIFT 패턴이나, 이미 origin/main 에 fix 가 존재하므로 이 PR 이 별도로 반영할 필요는 없다 — main 과 합류(rebase/merge)하면 자동 해소된다. 다만 현재 worktree 상태만 보면 "spec 이 grep 이라 하는데 코드는 AST" 로 line-level 불일치가 관측된다.
  - 제안: 코드 변경 불필요. Merge/rebase 시 `22cc48ef3` 가 자동으로 따라오는지만 확인. 별도 조치 불요.

- **[INFO]** 회색지대: `INTERACTION_TYPE_VALUES`/`CONVERSATION_SOURCE_VALUES` 의 `satisfies`+`Exclude` 양방향 컴파일 타임 단언은 spec §5 Rationale 이 명시적으로 요구하는 해법과 정확히 일치(목록을 tsc 가 읽는 소스 모듈로 이전 + 양방향 잠금)한다. Line-level 로 spec 서술과 구현이 정합.

## 기능 완전성 / 엣지 케이스 / 에러 시나리오 평가

- `scriptKindForFile`/`parseGuardSource`/`collectStringLiteralsFrom`/`collectCodeStringLiterals`/`treeContainsJsx` 로의 분리는 문서화된 대로 "단일 파스 chokepoint" 속성을 실제로 만족한다(위 mutation 실측). PR #972 review WARNING #2(구 self-test 가 `scriptKindForFile` 을 직접 호출해 실제 호출 경로를 우회하던 false-negative)가 실제로 해소됐음을 확인했다.
- `.tsx` 정방향(JSX 오파싱 방지) + `.ts` 역방향(`<Config>{...}` 캐스트가 TSX 로 오파싱되며 리터럴 유실되는 경우) 양쪽 다 self-test 로 고정돼 있다 — ai-review W1 후속 반영 확인.
- 정규식 리터럴(`/…/g`) 오수집 방지 테스트는 `.has()` 가 아닌 `.some(s => s.includes(token))` 로 검증해, "정규식 노드를 String Literal 로도 잘못 수집하는" 회귀까지 잡는 구조 — 의도한 엣지케이스 커버리지가 실제로 촘촘하다.
- 반환값: `collectCodeStringLiterals`/`treeContainsJsx` 등 모든 헬퍼가 모든 코드 경로에서 값을 반환(재귀 walk 종료 시 `Set`/`boolean` 확정). 예외 경로 없음 — `ts.createSourceFile` 이 문법 오류에도 error-recovery 로 트리를 생성하므로 throw 하지 않는다는 전제가 JSDoc 에 명시돼 있고 실측과 일치.
- `REGISTRY_SITES`/`SOURCE_REGISTRY_SITES` 를 순회하는 실제 exhaustiveness 테스트 2건은 이번 diff 로 변경되지 않았고 회귀 없이 그대로 8/8 통과.
- TODO/FIXME/HACK/XXX 주석 없음.
- 함수명·JSDoc 과 구현 간 괴리 없음 — 모든 JSDoc 주장(단일 chokepoint, 정규식 미수집, comment 제외, `.tsx`/`.ts` 양방향)을 개별적으로 실측 검증했고 전부 일치.

## 요약
두 파일 모두 함수 시그니처·동작·JSDoc 주장이 실제 구현과 정확히 일치하며, PR #972/#968 계열 review WARNING(파스 chokepoint 우회, 역방향 캐스트 미고정)이 실제로 해소됐음을 mutation 실측으로 확인했다. 유일한 발견은 spec 문서의 "grep" 잔존 용어이나, 이는 이 changeset 이 만든 문제가 아니라 fork-point 이후 origin/main 에 별도 PR(#977)로 이미 해소된 상태이며 merge 시 자동 정합된다. 코드 자체의 기능 완전성·엣지케이스·반환값·spec fidelity 관점에서 CRITICAL/WARNING 급 결함 없음.

## 위험도
NONE
