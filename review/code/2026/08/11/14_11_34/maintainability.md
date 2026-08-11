# 유지보수성(Maintainability) Review

전 라운드(`13_51_44`)에서 낸 WARNING 3건(dead branch / deprecated 별칭 근거 오류 / `_` 접두
설명 4곳 중복) 처분 확인 라운드. 커밋 `bafa7c007` 을 diff 와 디스크 원본(`Read`) 양쪽으로
대조했다.

### 발견사항

- **[INFO]** 처분 1(`path.isAbsolute` 죽은 분기 제거) — 해소 확인. 잔존 주석은 유용하나 리뷰
  프로세스 메타 정보를 섞고 있다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/tree-walk.ts:78-81`
  - 상세: `const dir = path.isAbsolute(base) ? base : path.join(root, base);` 가 사라지고
    `const dir = path.join(root, base);` 로 단순화됐다(디스크 원본 78-82줄 확인). 남긴 주석
    4줄은 (a) 계약("`bases` 는 항상 `root` 기준 상대") (b) 왜 안 되는지(절대경로 base 는
    `relPath` 에 `../` 를 만들어 함수 자신의 계약을 깬다) (c) 재도입 조건(호출부+fixture 동반)
    을 담아 실질 정보 밀도는 있다. 다만 "리뷰어 셋이 독립 지적" 이라는 문구는 이 PR 의 리뷰
    이력이지 코드의 계약이 아니다 — 이런 문구는 시간이 지나면 맥락 없는 잡음이 되고, 이미
    `plan/complete/docs-guard-walker-dedup.md` "뮤테이션(전부 RED)" 절과 커밋 이력에 같은
    사실이 남는다. 전 라운드에 지적한 "주석 비대화 경향" 을 소규모로(1곳·4줄) 재생산한 것으로
    본다 — WARNING 정도는 아니고 4곳 중복이었던 이전 사례보다 스케일이 훨씬 작다.
  - 제안: 급하지 않음. 다음에 이 함수를 손댈 일이 생기면 "리뷰어 셋이 독립 지적" 구절만
    빼고 계약+이유 2줄로 더 줄일 수 있다.

- **[INFO]** 처분 2(`SpecMdFile` 삭제)가 `findBrokenLinksInFiles` 시그니처까지 일관되게
  갔다 — 자기모순 완전 해소.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:18`(`import { walkTree, type MdFileRef }`), `:144-149`(삭제 사유 주석), `:159`(`collectSpecMarkdown(root): MdFileRef[]`), `:196`(`findBrokenLinksInFiles(files: MdFileRef[], ...)`), `:331`(`collectCodebaseSources(root): MdFileRef[]`)
  - 상세: 디스크 원본을 `grep -n "SpecMdFile\|MdFileRef" spec-links.ts` 로 재확인 — `SpecMdFile`
    은 삭제 사유를 설명하는 주석(144-145줄)에만 텍스트로 남고, import·반환 타입·
    `findBrokenLinksInFiles` 파라미터 전부 `MdFileRef` 로 통일됐다. 전 라운드에서 지적한
    "`@deprecated` 별칭을 선언하면서도 내부 함수는 여전히 옛 이름을 쓰는" 자기모순이 완전히
    사라졌다.

- **[INFO]** 처분 3(`_` 접두 설명 4곳 → `tree-walk.ts` 헤더 SoT + 포인터) — 코드 3곳은
  일관되게 처리됐고, 정보 손실 없음. plan 문서 1곳만 포인터가 아니라 자체 요약을 유지한다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/tree-walk.ts:9-12`(SoT, 유지) /
    `codebase/frontend/src/lib/docs/__tests__/impl-anchor-parse.ts:107-110`(포인터로 축약) /
    `codebase/frontend/src/lib/docs/__tests__/tree-walk.test.ts:180-181`(포인터로 축약) /
    `plan/complete/docs-guard-walker-dedup.md:29-31`(축약됐지만 포인터는 아님)
  - 상세: `impl-anchor-parse.ts`(`collectMdxFiles` JSDoc)는 "`_` 접두는 디렉터리에 건다"
    라는 **이 호출부에서 필요한 행동 사실**은 그대로 남기고, "왜 두 함수가 다른가"의 서술만
    `tree-walk.ts` 헤더로 위임했다 — 정보가 사라진 게 아니라 SoT 로 옮겨간 것이다(디스크
    원본으로 재확인). `tree-walk.test.ts` 도 같은 패턴("이 비대칭이 요점이다 — 근거는
    `tree-walk.ts` 헤더(SoT)")으로 축약됐다. 둘 다 원 지적대로 "포인터"로 전환됐다.
    다만 네 번째 자리였던 `plan/in-progress/docs-guard-walker-dedup.md:167-176` 은 그
    plan 이 `git mv` 로 `plan/complete/` 로 이동·재작성되면서(발견 시점 서사가 "3벌 → 실측
    6벌" 로 확장됨) 해당 설명이 2줄로 크게 줄긴 했으나, 여전히 `plan-scan.ts`/
    `impl-anchor-parse.ts` 의 비대칭을 자체 문장으로 재서술하고 `tree-walk.ts` 를 SoT 로
    가리키지는 않는다(`plan/complete/docs-guard-walker-dedup.md:29-31`, 디스크 확인).
    이것은 유지보수성 결함이라기보다는 성격 차이로 본다 — plan 문서는 "발견 당시의 서사"를
    기록하는 결정 저널이라 그 시점에 고정되는 게 자연스럽고, 코드 주석처럼 앞으로 계속
    참조되며 갈릴 위험은 낮다(plan 은 `complete/` 로 봉인됐다). 그래도 엄밀히 "4곳 전부
    포인터화" 는 아니라는 점은 사실 확인 차원에서 기록한다.
  - 제안: 조치 불필요. 다음에 유사 패턴(구현 세부 규칙의 "왜"를 여러 문서에 흩뿌리는 것)이
    또 생기면 plan 문서도 "근거는 `tree-walk.ts` 헤더" 식으로 통일할 수 있으나 지금 우선순위는
    낮다.

새 CRITICAL 은 없다.

### 요약

세 처분 모두 지적한 문제를 실제로 해소했다 — 죽은 분기는 제거되고 남은 주석이 재도입을
막는 계약을 설명하며, `SpecMdFile` 삭제는 `findBrokenLinksInFiles` 시그니처까지 포함해
완전히 일관되고(자기모순 소멸), `_` 접두 중복 설명은 코드상 3곳 중 SoT 를 제외한 2곳이
실제로 포인터로 축약돼 정보 손실 없이 중복만 제거됐다. 유일하게 완전하지 않은 지점은 plan
문서 쪽 4번째 자리인데, 이는 plan 이동·재작성 과정에서 자연 축약된 결정 저널 서술이라
코드 주석과 같은 "SoT 미준수" 위험 등급으로 보지 않는다. 남은 한 곳(`tree-walk.ts` 잔존
주석의 리뷰-프로세스 메타 문구)은 이 PR 이 스스로 경계해 온 "주석 비대화" 경향의 아주 작은
재발이지만 스케일이 미미해 INFO 로 남긴다. 전체적으로 처분은 견고하고 회귀 없음.

### 위험도

LOW

STATUS: OK
