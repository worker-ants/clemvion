# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `TERMINAL_STATUSES` 가 신규 export 로 모듈 경계를 넘는 공유 `Set` 이 됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:90-95`
  - 상세: 기존에는 `plan-frontmatter.test.ts` 안에 `const TERMINAL_STATUSES = new Set([...])` 로 그 파일에 갇혀 있던 상수였다. 이번 추출로 `plan-scan.ts` 의 `export const TERMINAL_STATUSES: ReadonlySet<string>` 가 되어 다른 모듈이 import 해 쓸 수 있는 공유 싱글턴이 됐다. `ReadonlySet` 은 TS 컴파일 타임 제약일 뿐 런타임에는 평범한 `Set` 인스턴스라 `Object.freeze` 등 런타임 방어가 없다 — 어떤 호출부가 타입을 우회해 `.add()`/`.delete()` 를 호출하면 같은 프로세스(vitest worker) 내 이후 모든 `findNonTerminalCompletedPlans` 호출에 영향을 준다. 현재 코드에서 실제 변형 호출은 없음(테스트도 spread 복사만 함).
  - 제안: 당장 조치 불필요. 다만 이 상수가 계속 다른 모듈로 퍼진다면 `Object.freeze(new Set([...]))` 로 런타임까지 잠그는 편이 안전.

- **[INFO]** `findNonTerminalCompletedPlans`(구 `plan-frontmatter.test.ts` 인라인 로직)의 스캔 범위가 리팩터로 조용히 좁아짐 — 의도된 것이며 fixture 로 검증됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:29-37`(`isLifecyclePlan`), `77-80`(`collectCompletePlanMarkdown`)
  - 상세: git 이력(`ebb6f9598`)을 대조한 결과, 리팩터 이전 `plan-frontmatter.test.ts` 의 `collectCompletedPlans` 는 `archive/` 만 제외하고 `plan/complete/**` 의 `.md` 전부(0-/_ 접두 포함)를 status 검사 대상으로 삼았다. 새 `collectCompletePlanMarkdown` → `isLifecyclePlan` 은 `0-`/`_` 접두 파일을 추가로 면제한다. 즉 완료된 `0-index.md`/`_scratch.md` 류가 종료 상태가 아닌 값을 선언해도 이제는 더 이상 걸리지 않는다. `plan-scan.ts` 상단 주석(29-34줄)은 이 면제가 "예전부터" 있던 규칙이라 서술하지만, 실제로 예전부터 그 면제가 있었던 것은 in-progress 쪽 frontmatter 검사(worktree/started/owner)뿐이고 완료 status 검사 쪽은 이번에 처음 면제가 생겼다 — 주석이 두 개의 서로 다른 기존 규칙을 하나로 뭉뚱그려 "항상 그랬다"처럼 읽히게 한다.
  - 근거: 이 축소는 `plan-scan.test.ts` 의 `"exempts \`0-\`/\`_\` index files, matching Gate C's scope"` 테스트(77-81줄)로 명시적으로 고정·의도된 동작이며, 현재 저장소에는 `plan/complete/**` 에 `0-`/`_` 접두이면서 종료 상태가 아닌 파일이 없어(직접 확인) 실질 회귀는 없다.
  - 제안: 기능 결함은 아니므로 조치 불요. 다만 `plan-scan.ts` 상단 주석을 "완료 status 검사는 이번에 새로 이 면제를 갖게 됐다"로 정정하면, 이 파일이 스스로 경고하는 "네 벌의 walker 가 조용히 어긋난다"는 패턴을 이 리팩터 자신이 (문서 수준에서) 반복하는 것을 피할 수 있다.

- **[INFO]** `collectLivePlanMarkdown` 반환 타입명이 `SpecMdFile` → `PlanMdFile` 로 바뀌었으나 구조적으로 동일해 호출부 영향 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:17, 289`(re-export), `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:24-27`(`PlanMdFile`)
  - 상세: `spec-links.ts` 는 기존에 자체 구현하던 `collectLivePlanMarkdown` 을 삭제하고 `plan-scan.ts` 에서 import 후 `export { collectLivePlanMarkdown };` 로 재노출한다. 두 타입(`SpecMdFile { absPath, relPath }` vs `PlanMdFile { absPath, relPath }`)은 필드가 완전히 동일한 구조적 타입이라 TS structural typing 상 기존 호출부(`plan-frontmatter.test.ts`, `spec-links.test.ts`)가 깨지지 않는다. 동작(top-level만, `0-`/`_` 제외, 정렬)도 옛 구현과 1:1 대조로 동일함을 확인했다(재귀 안 함 → `recurse:false`; 필터 동일).
  - 제안: 없음 — 하위 호환을 지키려는 의도가 코드·커밋 메시지에 명시돼 있고 실제로 그렇게 동작한다.

- **[INFO]** `plan-scan.test.ts` 의 `os.tmpdir()` 픽스처 쓰기/삭제 — 범위가 격리돼 있어 안전
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts:21-24`(`write` 헬퍼), `32-56`(`beforeAll`/`afterAll`), `136-144`(두 번째 임시 디렉터리)
  - 상세: 실제 저장소 파일이 아닌 `fs.mkdtempSync(os.tmpdir(), …)` 로 생성한 격리 디렉터리에만 쓰고, `afterAll`/`finally` 에서 `fs.rmSync(…, {recursive:true, force:true})` 로 정리한다. `plan-frontmatter.test.ts`(실저장소 `repoRoot()` 대상)는 `fs.readFileSync`/`matter()` 읽기 전용이라 쓰기 부작용이 없다.
  - 제안: 없음(참고용 확인).

## 요약

이번 변경은 plan 트리 스캔 로직을 `plan-scan.ts` 로 추출하는 리팩터로, 파일시스템 쓰기 부작용은 신규 테스트 fixture(임시 디렉터리, 정리 포함)에만 국한되고 프로덕션 경로에는 없다. 환경변수·네트워크 호출·이벤트/콜백 변경은 없다. 시그니처/인터페이스 관점에서는 `spec-links.ts` 가 `collectLivePlanMarkdown` 을 재노출해 기존 호출부 호환성을 명시적으로 지켰고 구조적으로도 동일함을 확인했다. 유일하게 실질적인 행위 변화는 완료 plan 의 status 검사(`findNonTerminalCompletedPlans`)가 `0-`/`_` 접두 파일을 새로 면제하게 된 것인데, 이는 fixture 로 의도적으로 고정·검증됐고 현재 저장소 상태에서 회귀를 일으키지 않는다 — 다만 이를 "예전부터 있던 규칙"으로 서술한 주석은 다소 부정확하다. `TERMINAL_STATUSES` 가 새 공유 export 가 된 점도 런타임 불변성이 타입에만 의존한다는 점에서 경미하게 짚어둘 만하다. 전반적으로 차단할 결함은 없다.

## 위험도

LOW
