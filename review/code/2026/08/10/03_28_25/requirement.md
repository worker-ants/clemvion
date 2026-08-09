# 요구사항(Requirement) 리뷰

## 대상
- `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts`
- `codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts`
- `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts`
- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts`

관련 spec: `.claude/docs/plan-lifecycle.md §1~§5` (frontmatter 스키마·이동 규칙·`status` 종료값·상대링크 무결성의 SoT). `PROJECT.md:277`, `spec/conventions/spec-impl-evidence.md:132`가 이 가드의 판정 로직 소재를 미러링.

## 검증 방법
- `.claude/docs/plan-lifecycle.md` 본문 대 `plan-scan.ts`/`spec-links.ts` line-level 대조.
- `node`로 직접 실행해 주석이 주장하는 동작(js-yaml 날짜 롤오버, YAML 1.1 boolean 제거, gray-matter 캐시 버그)을 재현·검증.
- `npx vitest run plan-scan.test.ts plan-frontmatter.test.ts spec-links.test.ts spec-plan-completion.test.ts` → 4 files / 978 tests 전량 PASS.
- `spec-plan-completion.test.ts`의 독립 `collectCompletePlans`가 `plan-scan.ts`의 `0-`/`_` 면제 규칙과 실제로 일치하는지 grep 대조.
- `PROJECT.md`/`spec-impl-evidence.md`의 "판정 로직 소재" 서술이 실제 구현(수집·frontmatter·status는 `plan-scan.ts`, 링크는 `spec-links.ts`)과 일치하는지 확인.

## 발견사항

- **[WARNING]** `findNonTerminalCompletedPlans`가 같은 파일에서 상세히 문서화한 gray-matter 캐시 방어 패턴을 스스로 어긴다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:124`
  - 상세: 같은 파일의 `checkPlanFrontmatter` (203-226행 주석)는 `matter(raw, {})`처럼 옵션 객체를 명시해야 하는 이유를 실측까지 곁들여 설명한다 — 옵션 없이 호출하면 gray-matter가 raw 문자열을 캐시 키로 써서, 같은 내용을 파싱 실패(throw) 후 재파싱하면 두 번째 호출은 throw 없이 조용히 `data={}`를 반환한다(`node -e`로 재현 확인: 1회차 THROW → 2회차 NOTHROW). 그런데 바로 위 `findNonTerminalCompletedPlans` (119-135행)은 `matter(fs.readFileSync(f.absPath, "utf8")).data ?? {}` — 옵션 없이 호출한다. 현재는 이 함수가 throw든 `data={}`든 둘 다 "continue"(skip)로 흡수하므로 관측 가능한 버그는 없다(직접 검증: `broken.md` fixture가 어느 케이스든 위반으로 잡히지 않음, 두 케이스 모두 동일 결과). 다만 이 비일관성은 이 PR의 핵심 주제(gray-matter 캐시 함정 회피)를 정확히 옆 함수에서만 지키고 형제 함수에서는 놓친 것이라, 이후 이 함수의 로직이 바뀌면(예: 파싱 실패와 "status 없음"을 다르게 취급) 조용히 되살아날 수 있는 잠재 결함이다.
  - 제안: `matter(fs.readFileSync(f.absPath, "utf8"), {})`로 통일해 캐시를 우회할 것. (참고: `spec-plan-completion.test.ts:93`도 같은 옵션-없음 패턴을 쓰는 기존 관례라 이 PR만의 신규 결함은 아니지만, 이 PR이 그 함정을 명시적으로 다루는 파일이므로 동일 파일 내 일관성 문제로 지적한다.)

- **[WARNING]** `findBrokenPlanLinks`의 JSDoc이 같은 PR이 스스로 금지한 "회고 서사 누적"을 코드 주석에 남긴다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:280-294` (JSDoc 블록 전체는 273-305)
  - 상세: `plan-frontmatter.test.ts:37-39`는 "이 가드가 잡는 실패의 이력은 커밋 메시지와 `plan/complete/` 산출물을 볼 것 — 코드 주석은 **현재 규칙**만 담는다(ai-review 가 회고 서사 누적을 지적)"라고 명시적으로 원칙을 선언한다. 그런데 바로 인접 파일의 `findBrokenPlanLinks` JSDoc은 "Measured 2026-08-09/10", "This guard sees 8: seven of the move case ... plus one stale #anchor", "A 9th was fixed by hand and this guard cannot see it" 같은 특정 날짜·특정 건수의 1회성 측정 서사를 함수 계약 설명에 그대로 담고 있다. 이 숫자들(8/seven/9th)은 함수의 현재 동작 규칙이 아니라 과거 한 시점의 관측 결과이며, 시간이 지나면 오도할 수 있다(코드가 변경돼도 갱신될 유인이 없다). 같은 PR 내에서 스스로 지적한 안티패턴이 다른 파일에서 재현된 형태.
  - 제안: 측정 서사(“Measured 2026-08-09/10…”, “seven/9th…”)는 커밋 메시지 또는 `plan/` 산출물로 옮기고, JSDoc에는 "현재 규칙"만 남긴다 — 예: scope가 top-level in-progress만인 이유, `checkSelfAnchors: false`인 이유, `plan/complete/**`를 왜 보지 않는지(§3 참조)만 유지.

## 관점별 요약

1. **기능 완전성**: `.claude/docs/plan-lifecycle.md §4`가 요구하는 세 불변식(frontmatter 3필드 필수, `complete/`의 `status` 종료값 강제, in-progress 상대링크 무결성)을 `plan-scan.ts`/`spec-links.ts`가 각각 정확히 구현. `TERMINAL_PLAN_STATUSES = {complete, implemented, applied, superseded}`가 spec 본문(80-81행)의 어휘·순서와 완전히 일치.
2. **엣지 케이스**: `isIsoDate`의 라운드트립 비교(월/일 롤오버 `2026-02-30`→`2026-03-02`, `2026-13-32`→NaN 등)를 `node`로 직접 재현해 주석 주장과 실제 동작이 일치함을 확인. `status`가 문자열이 아닌 형태(null/number/array)·`archive/` 제외·`0-`/`_` 인덱스 면제·빈 tree 등 경계 케이스가 fixture로 전부 양성 검증됨.
3. **TODO/FIXME**: 4개 파일 전체에 TODO/FIXME/HACK/XXX 없음.
4. **의도와 구현 간 괴리**: 위 WARNING 2건 외에는 함수명·주석과 구현이 정확히 일치. `export { collectLivePlanMarkdown }`의 "하위호환 re-export" 주석은 실제로 `spec-links.test.ts:6`가 그 경로로 여전히 import하고 있어 사실과 부합.
5. **에러 시나리오**: frontmatter 파싱 실패(`unparseable`)와 블록 부재(`missing-block`)를 구분해 처리, `findNonTerminalCompletedPlans`는 파싱 실패를 조용히 skip(가드의 관심사 아님을 명시) — 의도된 설계이며 테스트로 증명됨.
6. **데이터 유효성**: `worktree`/`owner`는 빈 문자열·비문자열을 모두 거부, `started`는 자리수 검사를 넘어 실재 날짜인지 라운드트립으로 검증 — 종전 검사(자리수만 확인)보다 엄격해진 것이 spec §4와 일치.
7. **비즈니스 로직**: `in-progress`가 `TERMINAL_PLAN_STATUSES`에서 의도적으로 제외된 이유(디렉터리와 모순)가 spec 서술(§4, `#1108`·`#1117` 재발 방지)과 정확히 대응.
8. **반환값**: 모든 함수가 모든 경로에서 적절한 타입(빈 배열 포함)을 반환. 예외 경로 없음.
9. **spec fidelity**: `.claude/docs/plan-lifecycle.md §4`와 `plan-scan.ts`/`spec-links.ts` 간 line-level 불일치 없음. `PROJECT.md:277`, `spec-impl-evidence.md:132`의 "판정 로직 소재" 서술도 이번 커밋에서 함께 정정되어 실제 구현과 일치(직접 grep 대조 확인).

## 요약

`.claude/docs/plan-lifecycle.md §4`가 정의한 plan 라이프사이클 3대 불변식(frontmatter 필수 3필드, `complete/`의 종료 `status`, in-progress 상대링크 무결성)이 `plan-scan.ts`/`spec-links.ts`에 line-level로 정확히 구현되어 있고, 이전 라운드가 지적한 "위반 분기 무관측" 문제도 `plan-scan.test.ts`/`plan-frontmatter.test.ts`의 negative-path fixture로 실제 해소되었다(직접 vitest 실행 978 tests PASS, 핵심 정규식/날짜 롤오버/YAML boolean 동작을 node로 재현 검증). CRITICAL은 없다. WARNING 2건은 모두 이 PR이 스스로 세운 원칙(gray-matter 캐시 방어, "코드 주석은 현재 규칙만") 이 형제 코드에 일관되게 적용되지 않은 사례로, 현재는 관측 가능한 버그를 일으키지 않지만 유지보수성 관점에서 정정을 권한다.

## 위험도

LOW
