# 정식 규약 준수 검토 — convention_compliance

검토 모드: --impl-done (scope=spec/conventions, diff-base=origin/main)
Target: `spec/conventions`(실질 diff = `spec/conventions/spec-impl-evidence.md` frontmatter `code:` 2줄 추가)

## 확인한 diff

```diff
--- a/spec/conventions/spec-impl-evidence.md
+++ b/spec/conventions/spec-impl-evidence.md
@@ -14,6 +14,8 @@ code:
   - codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts
   - codebase/frontend/src/lib/docs/__tests__/plan-scan.ts
   - codebase/frontend/src/lib/docs/__tests__/spec-links.ts
+  - codebase/frontend/src/lib/docs/__tests__/tree-walk.ts
+  - codebase/frontend/src/lib/docs/__tests__/tree-walk.test.ts
 ---
```

## 발견사항

- **[WARNING]** 새 공유 헬퍼(`tree-walk.ts`)가 두 컨벤션 문서의 코드에 동시에 의존하게 됐는데 `code:` 는 한쪽에만 갱신됨
  - target 위치: `spec/conventions/spec-impl-evidence.md` frontmatter `code:` (신규 2줄)
  - 위반 규약: `spec/conventions/user-guide-evidence.md` frontmatter `code:` (기존 목록에 `impl-anchor-parse.ts` 가 이미 등재돼 있음) — 및 §2.1 `code:` 정의("본 spec 이 약속한 surface 의 구현 경로")를 두 문서가 공유 헬퍼에 대해 동일하게 적용해온 기존 관행
  - 상세: HEAD 워킹트리를 절대경로로 확인한 결과, 이번 diff 는 `impl-anchor-parse.ts`(user-guide-evidence.md 의 `code:` 에 이미 등재된 파일)를 고쳐 자체 DFS 를 지우고 `tree-walk.ts` 의 `walkTree` 를 가져다 쓰도록 바꿨다(`import { walkTree } from "./tree-walk";`). 즉 이 diff 하나로 `tree-walk.ts` 는 `spec-impl-evidence.md` 가 이미 나열한 세 헬퍼(`plan-scan.ts`/`spec-links.ts`/`spec-frontmatter-parse.ts`) 뿐 아니라 `user-guide-evidence.md` 가 나열한 `impl-anchor-parse.ts` 의 의존성도 됐다. 그런데 이 컨벤션 준수 검토 대상 diff 는 `spec-impl-evidence.md` 한 곳의 `code:` 만 갱신했고 `user-guide-evidence.md` 의 `code:` 는 그대로다. 두 문서 모두 "가드가 의존하는 헬퍼 구현 파일을 `code:` 에 올린다"는 동일한 관행을 이미 갖고 있으므로(전자는 `plan-scan.ts`/`spec-links.ts`, 후자는 `impl-anchor-parse.ts`), 그 관행을 그대로 적용하면 `tree-walk.ts`(및 `tree-walk.test.ts`)는 `user-guide-evidence.md` 쪽에도 등재돼야 대칭이다.
  - 영향: `spec-code-paths.test.ts` 가드는 "code: 배열 중 **최소 1개**가 실제 파일에 매치"만 요구하므로(§4 표, 코드 확인 완료) `user-guide-evidence.md` 는 이미 매치되는 다른 항목(`impl-anchor.tsx` 등)이 있어 build 는 깨지지 않는다 — 즉 CRITICAL 은 아니다. 다만 "이 컨벤션이 의존하는 구현 파일 목록"이라는 `code:` 의 문서적 완전성 관점에서 한쪽만 갱신된 것은 앞으로 `tree-walk.ts` 를 고칠 때 "두 컨벤션 모두 영향받는다"는 사실이 frontmatter 만 봐서는 드러나지 않게 만든다.
  - 제안: `spec/conventions/user-guide-evidence.md` 의 `code:` 에도 `codebase/frontend/src/lib/docs/__tests__/tree-walk.ts`(및 필요시 `tree-walk.test.ts`)를 추가해 대칭을 맞추거나, 만약 "여러 컨벤션이 공유하는 cross-cutting 헬퍼는 최초 도입 문서에만 등재한다"는 규칙을 의도한 것이라면 그 규칙을 `spec-impl-evidence.md` §2.1 또는 R-6 인근에 명문화할 것을 제안. 현재는 둘 중 어느 쪽도 문서화돼 있지 않다.

- **[INFO]** `code:` 목록의 "헬퍼 + 헬퍼 자신의 `.test.ts` 동반 등재" 여부에 대한 선택 규칙이 문서에 없고, 기존 항목 자체가 이미 비일관적
  - target 위치: `spec/conventions/spec-impl-evidence.md` frontmatter `code:` 전체 목록
  - 위반 규약: 없음(명시적 규약 부재) — §2.1 은 `code:` 를 "레포 루트 기준 상대경로" 로만 정의하고, 정렬·등재 대상 선정 기준은 규정하지 않는다.
  - 상세: 목록을 보면 `spec-frontmatter-parse.ts` 는 자신의 `.test.ts`(`spec-frontmatter-parse.test.ts`)와 함께 등재돼 있지만, 같은 축의 지원 파일인 `plan-scan.ts`/`spec-links.ts` 는 각각의 `.test.ts`(`plan-scan.test.ts`/`spec-links.test.ts`, 실존 확인함)가 목록에 없다. 이번 diff 는 `tree-walk.ts` 와 `tree-walk.test.ts` 를 **둘 다** 추가해 전자(포함) 패턴을 따랐는데, 후자(제외) 선례도 동등하게 존재해 어느 쪽이 "맞는" 패턴인지 문서만으로는 판별 불가능하다.
  - 제안: 규약 갱신 여지 — §2.1 또는 §4.2 서두에 "헬퍼 파일과 그 자신의 단위테스트를 모두 올릴지, 헬퍼만 올릴지"에 대한 한 줄 규칙을 추가하면 향후 등재 편차를 줄일 수 있다. 이번 diff 자체를 막을 근거는 없음(INFO).

- **[없음]** 그 외 CRITICAL 없음
  - 확인: (1) 경로 형식 — `codebase/frontend/src/lib/docs/__tests__/tree-walk.ts`, `tree-walk.test.ts` 모두 레포 루트 기준 상대경로로 §2.1 형식과 일치. (2) 축 일치 — 두 신규 항목은 `plan-scan.ts`/`spec-links.ts` 와 같은 축("가드가 의존하는 지원 구현 파일")이다. HEAD 워킹트리 diff 확인 결과 `tree-walk.ts` 는 이미 등재된 `plan-scan.ts`(`import { walkTree } from "./tree-walk"`)·`spec-links.ts`(`import { walkTree, type MdFileRef } from "./tree-walk"`)·`spec-frontmatter-parse.ts`(`import { walkTree } from "./tree-walk"`) 세 파일 모두의 실제 의존성이 됐다 — "테스트 파일만 등재하는 목록"이 아니라 "가드 구현 파일(비-테스트 포함) 목록"이 맞다는 판단이 재확인된다. (3) 가드 통과 — `spec-code-paths.test.ts`(`codebase/frontend/src/lib/docs/__tests__/spec-code-paths.test.ts`) 를 직접 읽어 확인: `status ∈ {partial, implemented}` 인 spec 의 `code:` 가 (a) 비어있지 않고 (b) `globMatchesAny` 로 ≥1 개 실파일에 매치해야 통과. `spec-impl-evidence.md` 는 `status: implemented`. 신규 두 경로는 와일드카드가 없는 리터럴 경로라 `globMatchesAny` 내부에서 `fs.existsSync(path.join(root, pattern))` 로 판정되며, HEAD 워킹트리에 두 파일이 실재함을 `find` 로 직접 확인했다(`codebase/frontend/src/lib/docs/__tests__/tree-walk.ts`, `tree-walk.test.ts`). 기존 항목 중에도 이미 매치되는 파일이 다수라 가드는 신규 항목 유무와 무관하게 통과하지만, 신규 항목 자체도 유효한 실파일이라 거짓 항목을 추가한 것도 아니다.

## 요약

target diff 는 `spec/conventions/spec-impl-evidence.md` frontmatter `code:` 에 신규 공유 헬퍼 `tree-walk.ts`/`tree-walk.test.ts` 2줄을 추가하는 최소 변경이다. 경로 형식은 §2.1 규약과 일치하고, 등재 축(가드가 의존하는 지원 구현 파일)도 기존 `plan-scan.ts`/`spec-links.ts` 선례와 같으며, `spec-code-paths.test.ts` 가드도 통과한다(코드 직접 확인). 다만 이번 diff 로 `tree-walk.ts` 가 `user-guide-evidence.md` 가 이미 나열한 `impl-anchor-parse.ts` 의 의존성도 됐는데 그 문서의 `code:` 는 갱신되지 않아 두 컨벤션 문서 사이에 비대칭이 생겼고(WARNING, build 비차단), `code:` 목록 자체에 "헬퍼 + 그 test.ts 동반 등재 여부"에 대한 명시 규칙이 없어 기존 항목들도 이미 일관되지 않은 상태다(INFO). CRITICAL 은 없다.

## 위험도

LOW
