# 문서화(Documentation) 리뷰 — guide-identifier-existence (라운드 5, `15_42_54`/`6b4c03af6` 이후)

## 검증 방법

`git log --oneline -5` 로 현재 HEAD(`6b4c03af6` "라운드 4 — 리뷰어의 우려는 맞고 예시는
틀렸다")를 확인하고, `git show --stat 6b4c03af6` 로 그 커밋이 실제로 건드린 파일(코드
2개 + `review/code/2026/09/13/15_42_54/**` + `review/consistency/2026/09/13/15_43_24/**`)만
추리고, `git show 6b4c03af6 -- codebase/frontend/.../guide-identifier-*.ts` 로 실 코드
델타를 단독 확인했다. `guide-identifier-scan.ts`·`guide-identifier-existence.test.ts`·
`guide-sanitized-message-parity.test.ts`·`CHANGELOG.md`·`PROJECT.md`·
`plan/in-progress/guide-identifier-existence.md`를 `Read`로 직접 열어 이전 4개 라운드
(`14_41_14`·`15_03_06`·`15_24_12`·`15_42_54`)의 documentation 지적사항이 해소된 채
유지되는지, 그리고 라운드 4 완료 이후 plan 문서가 그 결과를 반영했는지를 재대조했다.
저장소는 뮤테이션하지 않았다(`git status --short` 확인).

## 발견사항

- **[WARNING]** plan 체크리스트가 라운드 4 완료를 반영하지 않아 다시 stale 상태다 —
  이 PR 자신이 만든 규칙("두 PR 연속 같은 거짓 체크")이 한 라운드 뒤 다른 방향으로 재발
  - 위치: `plan/in-progress/guide-identifier-existence.md:163`, `:173` (라운드-표 4행),
    `:162`
  - 상세: 커밋 `2253d27a4`("라운드를 «처리»한 것과 «수렴»한 것을 갈라 적는다 — 두 PR
    연속 같은 거짓 체크")이 명시적으로 세운 규칙은 *"완료 기준을 항목 본문에 적고 그
    기준이 관측될 때만 체크한다"* 이고, 표의 각 라운드 행은 `/ai-review` 결과 ·
    `--impl-done` 결과 · 그 라운드 후 `codebase/` 수정 여부 세 칸을 채우는 형식이다.
    라운드 1~3 행(170~172)은 전부 채워져 있는데, **라운드 4 행(173)은 여전히
    `` `15_42_54` — 진행 중 `` / `` `15_43_24` — 진행 중 `` / `—` 플레이스홀더 그대로다.**
    그런데 라운드 4 는 이미 완결됐다 — 커밋 `6b4c03af6`(현재 HEAD)의 커밋 메시지가
    직접 `` `/ai-review` (`review/code/2026/09/13/15_42_54` · Critical 0 · W2 · LOW) `` +
    `` `--impl-done` (`review/consistency/2026/09/13/15_43_24` · **BLOCK: NO** · Critical 0 · W2) ``
    라고 결과를 적고 있다. 게다가 이 커밋은 `guide-identifier-scan.ts`/
    `guide-identifier-existence.test.ts` 를 **실제로 수정**했다 — 즉 라운드 표 자신이
    세운 완료 기준("마지막 라운드가 `codebase/**` 수정 0 으로 끝날 것")에 따르면
    라운드 4 도 **수렴이 아니고 "있음 → R5 필요"** 로 채워졌어야 할 행인데, 지금 이
    파일(`16_04_15` 라운드가 리뷰 대상으로 삼고 있는 바로 그 버전)에는 그 사실이
    반영돼 있지 않다. `git show --stat 6b4c03af6` 로 확인한 결과 이 커밋은
    `plan/in-progress/guide-identifier-existence.md` 를 전혀 건드리지 않았다 — 코드를
    고치면서 그 코드가 속한 표를 갱신하지 않은 것이다. 같은 이유로 line 162
    (`` `.claude/tools/run-test-all.sh` — 3회 실행 전부 ALL PASS ``)도 라운드 4
    RESOLUTION(`review/code/2026/09/13/15_42_54/RESOLUTION.md` "검증" 절 —
    `run-test-all.sh ALL PASS (e2e 307)`)이 기록한 **4번째 실행**을 반영하지 못해
    "3회"가 이제 실측과 어긋난다. 다음 사람이 이 표만 보고 "라운드 4 가 아직 진행
    중"이라고 믿으면, 이미 커밋된 `6b4c03af6` 의 결과를 다시 조사하게 된다 — 이 표를
    만든 목적(라운드를 재추적하지 않고 한눈에 판별) 자체가 무효화된다.
  - 제안: 173행을 라운드 1~3 과 같은 형식으로 채운다 — 예:
    `` | 4 | `15_42_54` · C0 W2 LOW | `15_43_24` · BLOCK:NO · C0 W2 | **있음** → R5 필요 | ``,
    그리고 새 5행을 이번 라운드(`16_04_15`) 자리로 추가한다. 163행 캡션은
    "라운드 5 진행 중"으로, 162행은 "4회 실행"으로 갱신한다. 이 항목은 developer 권한
    안(`plan/**`)이라 이번 PR 범위에서 바로 고칠 수 있다.

- **[INFO]** SPEC-DRIFT — `spec/conventions/user-guide-evidence.md §2` 가 여전히
  "Build-time 가드 (3건)"으로 표기 — 신규 아님, 통산 8회째 확인
  - 위치: `spec/conventions/user-guide-evidence.md:68`
  - 상세: `grep -n "## 2. Build-time 가드"` 로 직접 확인한 결과 아직 "3건"이다. 리네임된
    `guide-identifier-existence` + 별도로 존재하는 `guide-sanitized-message-parity` 를
    반영하려면 갱신이 필요하지만, `developer` 는 `spec/` 쓰기 권한이 없고 자기-반증형
    소정정 예외(그 예외는 *developer 자신이 쓴 예고 문장*에만 열린다 — 이 가드 카탈로그
    문장은 `#1330` 이전부터 있던 것)에도 해당하지 않는다.
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 파일명·표·
    frontmatter `code:` 목록까지 실은 완결된 형태로 이미 등재돼 있고, 라운드 1~4 의
    documentation/consistency 리뷰가 매 라운드 동일 결론(조치 불요, developer 권한 밖,
    이미 등재)으로 재확인해 왔다. 이번 라운드도 같은 결론이며 새로 만들어진 갭이 아니다.
  - 제안: 조치 불요(developer 권한 밖, 이미 등재). 반복 등장은 결함이 아니라 기록의
    일관성이다.

- **[INFO]** 라운드 4 의 실 코드 변경(`CODE_FIELD` 왼쪽 경계 추가)에 동반된 주석·테스트
  주석은 문서화 품질이 높다 — 새 결함 아님, 양성 관찰
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:104-118`,
    `guide-identifier-existence.test.ts:283-295`
  - 상세: 주석이 리뷰어의 **틀린 예시**(`"statusCode"`)와 **실제로 위험한 형태**
    (소문자로 끝나는 `mycode`)를 명시적으로 구분해 적어 두었다 — 다음 사람이 리뷰어의
    예시만 보고 "재현 안 됨"으로 오탐 처리하는 것을 막는 설명이다. 코드 주석
    (`guide-identifier-scan.ts:112-113`)이 리뷰 라운드 경로를 전체 경로로 정확히
    인용(`review/code/2026/09/13/15_42_54` testing WARNING#2)해 이전 라운드에서 지적된
    "bare `hh_mm_ss` 인용" 형태로 재발하지 않았다.
  - 제안: 없음.

## 요약

라운드 4 이후 유일한 실 코드 변경(`CODE_FIELD` 왼쪽 경계 추가, 커밋 `6b4c03af6`)은 주석·
테스트 설명 모두 정확하고, 리뷰어의 틀린 예시와 실제 결함을 구분해 다음 사람의 오탐-기각을
막는 문서화까지 갖췄다. 이전 네 라운드가 지적·처분한 문서화 결함(자매 파일 죽은 참조, 한계
주석 소실, `composeTexts` 스코프 drift, CHANGELOG/PROJECT.md drift, `UPPER_SNAKE` 밑줄
요구 미검증)은 전부 소스를 직접 열어 재확인한 결과 해소된 채 유지되고 있다. 다만 라운드 4
가 완결됐음에도(그 자체가 `codebase/` 를 수정했으므로 이 PR 이 스스로 세운 완료 기준상
"수렴 아님, R5 필요"로 표시됐어야 함) `plan/in-progress/guide-identifier-existence.md` 의
라운드-표·체크리스트가 그 결과를 반영하지 않은 채 "라운드 4 진행 중"으로 멈춰 있다 — 이
PR 자신이 "두 PR 연속 같은 거짓 체크"를 막으려고 도입한 바로 그 장치가, 코드는 고치고
표는 갱신하지 않는 형태로 한 라운드 뒤 다시 어긋났다. `spec/conventions/user-guide-evidence.md
§2` 가드 카탈로그 미갱신은 developer 권한 밖의 선재 갭으로 이미 등재돼 있어 조치 불요다.

## 위험도

LOW — 신규 CRITICAL/WARNING 급 사용자-대면 문서화 결함은 없다. 유일한 WARNING 은
`plan/**`(developer 쓰기 권한 내) 트래킹 문서의 라운드-표 갱신 누락으로, 코드 동작에는
영향이 없지만 이 PR 이 직접 도입한 재발-방지 장치의 실효성을 이번 라운드에서 무너뜨린다.
