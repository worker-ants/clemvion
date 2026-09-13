# 문서화(Documentation) 리뷰 — guide-identifier-existence (3차 라운드, `15_03_06` 이후)

## 배경

이번 diff 는 origin/main 대비 전체 변경분(`--route=all`)이며, 앞선 두 `/ai-review` 라운드
(`14_41_14`, `15_03_06`)의 지적·수정 이력과 그 산출물 커밋을 포함한다. 이번 라운드는
(1) 실제 코드 3파일(`guide-identifier-scan.ts`/`guide-identifier-existence.test.ts`/
`guide-sanitized-message-parity.test.ts` 크로스레퍼런스)과 `CHANGELOG.md`·`PROJECT.md`·
`plan/in-progress/*.md` 를 직접 열어 문서 정확성을 재검증하고, (2) 저장소 트리에 리뷰
프로토콜 위반 흔적(뮤테이션 백업 잔존 등)이 있는지를 확인했다.

## 검증 결과 — 전 라운드 지적사항, 소스 직접 대조로 재확인

- **[해소 확인]** `guide-sanitized-message-parity.test.ts:16-17` 의 자매 파일 참조가
  `guide-identifier-existence.test.ts`(`#1330` 당시 이름 병기)로 갱신돼 있다. 저장소 전수
  `grep -rn "guide-error-code" codebase/ spec/ .claude/ PROJECT.md` 결과 남은 참조는
  `guide-identifier-scan.ts:9`(의도적 역사 서술) 뿐이고 댕글링 참조는 0건.
- **[해소 확인]** `guide-identifier-scan.ts:53-76` 의 "존재 검사 ≠ 방출 검사" 한계 절 +
  "이 주석을 지우지 말 것" 지시가 env 축까지 일반화되어 복원돼 있고, 삭제·재발견 경위까지
  자기참조로 기록돼 있다(76행 근방).
- **[해소 확인]** `guide-identifier-existence.test.ts:55-58` 의 `composeTexts` 필터가
  `/^docker-compose.*\.ya?ml$/` 로 좁혀져 있고, 종전 판이 `pnpm-lock.yaml`(784KB)까지 읽었다는
  실측·자기진단이 인접 주석에 남아 있다.
- **[해소 확인]** `CHANGELOG.md:69-81`·`PROJECT.md:300` 이 파일명(`guide-identifier-existence`)·
  허용목록(`GUIDE_EXTERNAL_VOCABULARY`)·"두 PR 에 걸쳐 두 번 바뀌었다"는 번복 경위까지 반영해
  일치한다.
- **[해소 확인]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 관련 트래커
  항목이 취소선+번복 근거로 닫혀 있고, `user-guide-evidence.md §2` 미등재 SoT 갭도 새 파일명
  기준으로 재등재돼 있다(§3247-3274, §3543-3568). §92개 MDX·기준집합 1,743/1,764종 등 문서에
  적힌 실측치도 직접 재현해 확인했다(`find … -name "*.mdx" | wc -l` → 92, 일치).

이번 라운드에서 diff 내용 자체에 새로운 CRITICAL/WARNING 급 문서화 결함은 발견되지 않았다.

## 발견사항

- **[WARNING]** 저장소 트리에 리뷰 프로토콜이 명시적으로 금지하는 뮤테이션 백업 파일이 방치돼 있다
  — 옛 정규식을 담은 채로
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts.bak`
    (이번 diff 에는 포함되지 않은 untracked 파일 — `git status --short` 에 `??` 로 표시,
    mtime 15:14로 이 리뷰 세션(15:24) 시작 전부터 존재)
  - 상세: `diff` 로 대조한 결과 `.bak` 은 `collectEnvDeclarations` 의 `envLine` 정규식이
    `^#?\s*(${UPPER_SNAKE})=` (주석 처리된 선언까지 받는 **현재** 형태)가 아니라
    `^(${UPPER_SNAKE})=` (주석 미대응 옛 형태)인 판본이다 — 라운드 2 리뷰어가
    `#?` 분기를 겨눈 뮤테이션 검증(`review/code/2026/09/13/15_03_06/RESOLUTION.md` WARNING)을
    실행하며 원본을 이 경로로 복사해 두고 **`cp` 로 되돌린 뒤 지우지 않은 것**으로 보인다.
    이 파일 자체는 `git check-ignore` 결과 gitignore 대상도 아니어서, 향후 `git add -A` 류
    커밋에 실수로 포함될 수 있고, 지금도 `__tests__/` 안에 실제 소스와 나란히 놓여 있어
    다음 사람(또는 동시 실행 중인 다른 reviewer)이 "이게 최신 구현인가, 다른 who 가 만든
    파일인가"를 다시 추적해야 한다. 리뷰 규약 자체가 "저장소 안에 `*.bak` 을 만드는 것도
    금지 — 다른 reviewer 가 그것을 결함으로 보고한다(실제로 그랬다)"고 명시한 바로 그 사례다.
  - 제안: 이 리뷰가 만든 파일이 아니므로 본 세션에서는 삭제하지 않고 보고만 한다. 다음
    커밋(또는 이 세션의 마무리 정리) 전에 `rm codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts.bak` 로
    제거할 것. 향후 뮤테이션 검증 시 백업은 저장소 밖 scratch 디렉터리(`mktemp -d`)에만 둘 것.

- **[INFO]** `plan/in-progress/guide-identifier-existence.md` 체크리스트 마지막 두 항목이
  실제 진행 상황보다 뒤처져 있다
  - 위치: `plan/in-progress/guide-identifier-existence.md` §체크리스트 마지막 두 줄
    (`- [ ] .claude/tools/run-test-all.sh`, `- [ ] /ai-review + --impl-done`)
  - 상세: 이 plan 파일은 커밋 `d03141e6e` 이후 한 번도 갱신되지 않았다(`git log --follow -p`
    로 확인 — 두 항목 모두 최초 커밋부터 미체크). 그런데 같은 diff 안에 커밋된
    `review/code/2026/09/13/14_41_14/RESOLUTION.md`·`15_03_06/RESOLUTION.md` 는 `/ai-review`
    가 이미 두 라운드 돌았고 두 라운드 모두 검증 절에 `run-test-all.sh ALL PASS`/
    `run-test-all.sh 재실행`을 명시한다. `--impl-done`도 `review/consistency/2026/09/13/
    14_41_43`·`15_03_36` 두 라운드가 이미 실행됐다(후자는 CRITICAL 1건 발견 후 커밋
    `938060138`으로 해소). 즉 체크박스만 보면 "테스트도 안 돌리고 리뷰도 안 받은" 상태로
    읽히는데 실제로는 그 반대다. 이 저장소 관례상 체크박스 갱신은 보통 마무리 커밋에서
    이뤄지므로(작업 자체가 아직 진행 중이라 회귀 결함은 아님) CRITICAL/WARNING 으로 올리지
    않지만, 이 plan 이 `complete/` 로 이동되기 전에는 반드시 실제 상태로 갱신돼야 한다.
  - 제안: 마무리 커밋에서 두 항목을 체크하고(이미 수행됨을 반영), 필요하면 `--impl-done`
    최종 BLOCK:NO 확인 라운드를 한 번 더 링크한다.

## 요약

핵심 코드(`guide-identifier-scan.ts`/`guide-identifier-existence.test.ts`)와 문서
(`CHANGELOG.md`/`PROJECT.md`/`plan/in-progress/*.md`)는 이전 두 라운드가 지적한 문서화
결함(자매 파일 죽은 참조, 한계 주석 소실, compose 필터 범위 drift, CHANGELOG drift, 명명
회귀 단언 소실) 전부가 실측 재확인 결과 정확히 해소돼 있고, 실측치(92 MDX, 소스 토큰 수
등)도 직접 재현되어 문서와 일치한다. 이번 라운드의 새 발견은 diff 자체의 결함이 아니라
저장소 트리에 남은 리뷰 부산물 하나(`guide-identifier-scan.ts.bak`, 뮤테이션 백업 잔존 —
리뷰 프로토콜이 명시적으로 금지한 형태)와 plan 체크리스트가 실제 진행 상황보다 한 박자
뒤처져 있는 점(관례상 마무리 커밋에서 정정되는 항목)뿐이다. 둘 다 병합을 막을 사유는
아니지만 전자는 다음 병렬 세션의 판정을 오염시킬 수 있어 정리가 필요하다.

## 위험도

LOW — diff 자체의 문서화 상태는 건실하다. 저장소에 방치된 `.bak` 파일 정리와 plan
체크리스트 최종 동기화만 남았다.
