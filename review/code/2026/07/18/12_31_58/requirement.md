# 요구사항(Requirement) 리뷰 — interaction-type-guard-comment-false-negative 후속 (#972 후속 ②③)

## 검토 범위 확인

`git merge-base HEAD origin/main` = `22cc48ef3`(PR #977, spec 을 이미 "AST 가드"/"AST 스캔" 용어로 정정한 커밋). 이 브랜치의 실제 신규 커밋은 `465abf334` 1개뿐이며, payload 의 파일 1·2(코드)·3(plan)·4-11(consistency-check 산출물, 신규 파일)과 정확히 일치. (참고: `git diff origin/main` 을 그대로 쓰면 origin/main 이 fork-point 보다 앞서(HEAD=`d25f552b2`) info-extractor 관련 무관 파일이 reverse-diff 로 섞여 나온다 — 저장소에 기록된 기존 known harness 패턴이며 본 리뷰는 merge-base 기준으로 스코프를 바로잡아 진행했다.)

핵심 변경은 (1) `interaction-type-exhaustiveness.test.ts` 의 self-test fixture 보강(union 타입 선언·객체 프로퍼티 값 형태, 정규식 리터럴 비오염 케이스), (2) `interaction-type-registry.ts` JSDoc 의 "grep 가드"→"AST 가드" 문구 정정 — 가드 로직(`collectCodeStringLiterals` 구현) 자체는 무변경. 나머지는 plan 체크박스 갱신과 이 작업 착수 전 수행된 `/consistency-check --impl-prep` 산출물(신규 리뷰 아티팩트 파일)이다.

## 사실 검증 (직접 재현)

플랜/주석이 주장하는 기술적 사실을 TypeScript 컴파일러 API로 직접 재현해 검증했다:

- `const re = /ghost_regex/g;` → AST 노드는 `RegularExpressionLiteral`(not `StringLiteral`) — `ts.isStringLiteral()` false, 수집 안 됨. 주석/JSDoc 서술과 일치.
- `type Waiting = "real_union_a" | "real_union_b";` / `const obj = { waiting: "real_prop" };` → 세 값 모두 `StringLiteral` 노드로 수집됨. fixture 의 `real_union_a`/`real_union_b`/`real_prop` 기대값과 일치.
- JSX 리터럴(`<div className="x">{"y"}</div>`)을 `ts.ScriptKind.TS` 로 파싱해도 `ts.ScriptKind.TSX` 와 **동일하게** 문자열 리터럴을 수집함을 재현 — plan 이 `.tsx` `ScriptKind` 분기 테스트를 "vacuous 가드"로 판단해 미추가한 근거가 실측과 일치.
- `codebase/frontend/src/lib/conversation/conversation-utils.ts` 의 실제 `ConversationTurnSource` union(`ai_user`/`ai_assistant`/`ai_tool`/`presentation_user`/`system`/`system_error`/`rag`, 7값)이 `CONVERSATION_SOURCE_VALUES` 와 순서까지 정확히 일치.
- `spec/conventions/interaction-type-registry.md`(현재 HEAD, PR #977 이후)의 §1.2 rule 3 · §2.1 은 이미 "AST 가드"/"AST(코드 리터럴) 스캔" 용어를 쓰며, `REGISTRY_SITES`(`use-execution-events.ts`/`apply-execution-snapshot.ts`/`use-result-detail-waiting.ts`) · `SOURCE_REGISTRY_SITES`(`conversation-utils.ts`) 매트릭스 서술과 테스트 파일의 실제 배열이 파일 경로·개수까지 정확히 일치.
- `npx vitest run interaction-type-exhaustiveness.test.ts` → 3 tests pass. `npx tsc --noEmit`, `npx eslint` 모두 해당 두 파일에 대해 클린.
- `grep -n "TODO\|FIXME\|HACK\|XXX"` → 두 파일 모두 0건.

## 발견사항

- **[INFO]** pre-existing spec-impl-evidence 갭 (본 diff 가 유발한 것 아님, 참고 기록)
  - 위치: `spec/conventions/interaction-type-registry.md` frontmatter `code:` 목록
  - 상세: `codebase/frontend/src/lib/conversation/interaction-type-registry.ts` 자체가 spec frontmatter `code:` 글로브에 미등재(§5 본문에서는 이 파일을 SoT 모듈로 인용함에도). rationale_continuity checker(파일 11)가 이미 동일하게 발견하고 "diff 이전부터 존재, 이번 변경이 유발/악화한 것 아님, spec-coverage 게이트 소관"으로 판단해 자체 리뷰 범위에서 제외한 것과 동일한 판단이다. 본 reviewer 도 동의 — 이번 diff 의 요구사항 충족 여부에는 영향 없음.
  - 제안: 조치 불필요. 필요 시 별도 `/spec-coverage` 트랙에서 다룰 사안.

- **[INFO]** consistency-check 번들러의 target 전체 치환 (harness, 이미 plan 에 비차단 등재)
  - 위치: `review/consistency/2026/07/18/12_04_53/*` 세션 전체
  - 상세: `spec/conventions/` alphabetic 번들링이 `cafe24-api-catalog/**` 대용량 덤프에 밀려 실제 target(`interaction-type-registry.md`)을 100% 치환했다는 사실은 5개 checker 산출물이 스스로 명시하고, worktree 직접 조사로 우회해 BLOCK:NO 판정 자체는 유효함을 각 파일이 자체 검증했다. plan(`interaction-type-guard-comment-false-negative.md` 라인 130-136)에도 "심각도 격상" 으로 이미 기록돼 있어 본 diff 의 요구사항 결함이 아니라 harness 인프라 이슈다.
  - 제안: 신규 조치 불요 — 기존 추적 항목으로 충분.

CRITICAL/WARNING 급 발견 없음. 함수 시그니처·필드명·기본값·검증 규칙 변경이 없으므로 spec fidelity 위반도 없음(§1.2/§2.1/§5 매트릭스·사이트 목록·enum 값 목록 전부 실측 일치, 위 "사실 검증" 참고).

## 요구사항 충족 관점 항목별 평가

1. **기능 완전성**: self-test fixture 가 실제 registry 사이트가 쓰는 4가지 코드 형태(switch/`===`/union 타입 선언/객체 프로퍼티 값)와 주석·정규식 오염원을 모두 커버 — 목표(PR #968 false-negative 재발 방지)를 완전히 달성.
2. **엣지 케이스**: 정규식 리터럴(`/…/`)·백틱/홑따옴표/겹따옴표 주석 인용 6종 ghost 값, union·object 2종 real 값 — 경계 케이스 커버리지 충분. `.tsx` 확장자 케이스는 실측(vacuous)에 근거해 명시적으로 defer, 근거 문서화됨.
3. **TODO/FIXME**: 0건.
4. **의도-구현 괴리**: JSDoc "AST 가드" 정정이 실제 구현(`ts.createSourceFile` + AST 순회)과 정확히 일치하도록 만드는 방향 — 괴리 해소.
5. **에러 시나리오**: 해당 없음(가드/테스트 코드, 런타임 에러 경로 신규 없음). 실패 시 `Missing … branches` 에러 메시지는 무변경.
6. **데이터 유효성**: 해당 없음(사용자 입력 없음, enum 값은 컴파일 타임 `satisfies`로 검증).
7. **비즈니스 로직**: 없음(테스트/문서 정정).
8. **반환값**: `collectCodeStringLiterals` 반환 타입·경로 무변경, 신규 분기 없음.
9. **spec fidelity**: `spec/conventions/interaction-type-registry.md` §1.2/§2.1/§5 와 line-level 로 일치(사이트 목록·enum 값·용어 모두 실측 확인). SPEC-DRIFT 없음.

## 요약

`interaction-type-exhaustiveness.test.ts` 의 self-test fixture 보강과 `interaction-type-registry.ts` 의 JSDoc 용어 정정("grep 가드"→"AST 가드")은 plan 이 명시한 두 개의 선택적 후속 항목(#972 후속 ②③)을 정확히 구현한다. 가드 로직 자체는 무변경이며, 신규 추가된 fixture 케이스(union 타입 선언·객체 프로퍼티 값·정규식 리터럴 비오염)의 정확성을 TypeScript 컴파일러 API로 직접 재현해 전부 검증했다 — 모든 주장이 사실과 일치했다. `.tsx` `ScriptKind` 분기 테스트를 vacuous 가드로 판단해 명시적으로 defer 한 결정도 동일한 방식으로 재현해 근거가 타당함을 확인했다. spec(`interaction-type-registry.md`, PR #977 로 이미 "AST 가드" 용어로 정정됨)과 코드 구현이 사이트 목록·enum 값·용어 수준까지 정확히 일치하며 CRITICAL/WARNING 급 결함이 없다. 발견된 두 INFO 는 모두 이 diff 가 유발하지 않은 pre-existing/harness 이슈로, 이미 별도 트랙에서 추적 중이다.

## 위험도

NONE
