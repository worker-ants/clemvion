# Cross-Spec 일관성 검토 — target: `spec/conventions` (spec-impl-evidence.md frontmatter 등재)

## 검토 범위 확인

- target diff 는 `spec/conventions/spec-impl-evidence.md` frontmatter `code:` 에 2줄 추가뿐 (`tree-walk.ts`, `tree-walk.test.ts`) — 본문 무변경. `git diff origin/main...HEAD -- spec/conventions/spec-impl-evidence.md` 로 확인.
- `PROJECT.md` 는 이번 diff 에서 변경 없음 (`git diff origin/main...HEAD --stat -- PROJECT.md` 결과 공백).
- `.claude/docs/plan-lifecycle.md` 는 같은 브랜치에서 3줄 변경(§Gate C 의 `hasValidSpecImpact` 판정 함수가 `spec-plan-completion.test.ts` → `plan-scan.ts` 로 이동했다는 각주 추가)됐으나, 이는 target(`spec/conventions`) 범위 밖이며 tree-walk 등재와 무관한 별개 리팩터.
- `codebase/frontend/src/lib/docs/__tests__/` 실제 diff 대조: `impl-anchor-parse.ts` · `plan-scan.ts` · `spec-frontmatter-parse.ts` · `spec-links.ts` · `spec-plan-completion.test.ts` · `tree-walk.ts`(신규) · `tree-walk.test.ts`(신규) — 여섯 개의 손수 짠 DFS 순회를 `tree-walk.ts` 하나로 통합하는 순수 리팩터. 동작 변경 없음(`tree-walk.test.ts` 가 6개 수집기 산출을 원소 단위로 고정).

## 발견사항

- **[WARNING]** `tree-walk.ts`/`tree-walk.test.ts` 가 `user-guide-evidence.md` 소관 코드(`impl-anchor-parse.ts`)에도 실질적으로 걸치는데 그쪽 `code:` 에는 미등재
  - target 위치: `spec/conventions/spec-impl-evidence.md` frontmatter `code:` (신규 2줄)
  - 충돌 대상: `spec/conventions/user-guide-evidence.md` frontmatter `code:` (L4-9, `impl-anchor-parse.ts` 포함하나 `tree-walk.ts`/`tree-walk.test.ts` 미포함)
  - 상세: 리팩터 diff 확인 결과 `impl-anchor-parse.ts`(→ `user-guide-evidence.md` 소관, `code:` L9 에 등재됨) 는 이제 `import { walkTree } from "./tree-walk"` 로 로컬 DFS 를 `tree-walk.ts` 로 교체했다. 게다가 `tree-walk.test.ts` 는 `collectMdxFiles`(`impl-anchor-parse.ts` export, `user-guide-evidence.md` 도메인)를 **직접 import** 해 6개 수집기 중 하나로 같이 검증한다(파일 헤더: "여섯 수집기의 산출을 원소 단위로 고정"). 즉 `tree-walk.ts`/`tree-walk.test.ts` 는 두 컨벤션(`spec-impl-evidence` · `user-guide-evidence`) 모두의 구현/회귀-보호에 걸치는 공유 인프라인데, `code:` 등재는 `spec-impl-evidence.md` 한쪽에만 됐다. 두 컨벤션은 §4.1 에서 "검증 도메인이 직교" 하도록 설계돼 있고, 지금까지는 실제로 구현도 서로 격리(각자 자기 DFS)돼 있었다. 이번 리팩터가 처음으로 그 격리를 깨고 구현 레벨 공유 의존을 만들었는데, 두 spec 문서 중 어느 쪽도 그 사실을 반영하지 않는다.
  - 제안: 빌드 가드는 깨지지 않는다(`spec-code-paths.test.ts` 는 glob 매치 존재만 확인하므로 `impl-anchor-parse.ts` 가 여전히 실존해 통과) — CRITICAL 은 아니다. 다만 추적성을 위해 (a) `user-guide-evidence.md` 의 `code:` 에도 `tree-walk.ts`/`tree-walk.test.ts` 를 추가로 등재하거나, (b) 두 파일이 "공유 인프라"임을 `spec-impl-evidence.md` §2.1 또는 R-9 부근에 한 줄 명시(예: "`tree-walk.ts` 는 `impl-anchor-parse.ts`(user-guide-evidence 도메인)도 소비한다")해 향후 리뷰어가 한쪽 문서만 보고 놓치지 않게 하는 것을 권장.

- 그 외 CRITICAL 급 발견 없음. `PROJECT.md` §변경 유형 갱신 매핑(L153, L212)· §가드 목록(L265-278) 은 `spec-frontmatter`/`spec-code-paths`/`spec-pending-plan-existence`/`impl-anchor-existence`/`integrations-coverage`/`triggers-coverage`/`spec-link-integrity`/`spec-area-index`/`plan-frontmatter`/`spec-plan-completion` 등 **guard(test `describe`) 단위**로만 열거하며, `plan-scan.ts`/`spec-links.ts` 같은 내부 헬퍼 모듈은 이미 이전부터 PROJECT.md 목록에 별도 항목으로 나타나지 않는다(스펙 문서의 `code:` 인벤토리에만 등재되는 게 기존 패턴). `tree-walk.ts`/`tree-walk.test.ts` 도 같은 클래스(헬퍼 모듈)로 등재됐으므로 이 패턴과 충돌하지 않는다 — PROJECT.md/plan-lifecycle.md 를 함께 갱신할 의무는 없다.
- `.claude/docs/plan-lifecycle.md` 의 `hasValidSpecImpact` 이동(같은 브랜치, 별개 diff)도 `spec-impl-evidence.md` §4.2 Gate C 서술("판정 로직 SoT" 미언급, `spec-plan-completion.test.ts` 게이트 자체만 언급)과 직접 모순되지 않는다 — plan-lifecycle.md 쪽에 "게이트(`describe`)와 SoT 표가 가리키는 대상은 그대로 `spec-plan-completion.test.ts`" 라는 정정 각주가 이미 붙어 있어 두 문서가 서로 어긋나지 않는다. (참고용 관찰이며 target 범위 밖이라 발견 항목으로 세지 않음.)

## 요약

target 변경은 `spec/conventions/spec-impl-evidence.md` frontmatter `code:` 에 신규 공유 헬퍼 `tree-walk.ts`/`tree-walk.test.ts` 2줄을 추가하는 것뿐이며 본문·다른 spec 문서는 건드리지 않는다. `PROJECT.md`·`.claude/docs/plan-lifecycle.md` 의 가드 클러스터 서술은 이번 diff 로 변경되지 않았고, 두 문서 모두 헬퍼 모듈(`plan-scan.ts`/`spec-links.ts` 류)을 개별 나열하지 않는 기존 패턴을 유지하고 있어 `tree-walk.ts` 미등재로 인한 직접적 모순은 없다. 다만 실제 코드 diff 를 대조해보면 `tree-walk.ts`/`tree-walk.test.ts` 는 `spec-impl-evidence.md` 뿐 아니라 `user-guide-evidence.md` 소관 파일(`impl-anchor-parse.ts`)의 구현·회귀 검증에도 실질적으로 걸치는 공유 인프라인데 `user-guide-evidence.md` 쪽 `code:` 에는 반영되지 않은 추적성 갭이 하나 있다(WARNING, 빌드 비차단).

## 위험도
LOW

STATUS: OK
