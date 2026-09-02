# 변경 범위(Scope) 코드 리뷰

## 검토 방법

이번 changeset 은 `origin/main...HEAD` 누적 diff 92개 파일이다. 프롬프트에 diff 가 실린 것은 그중
일부(1~5, 6~14 대부분, 15/18/19/23/24/27/35, 38~44 일부, 92)이고 나머지는 "프롬프트 크기 제한으로
생략" 표시만 있어, 파일명·경로·과거 라운드 RESOLUTION 서술로 성격을 판단했다. 실제 코드(4개:
`plan_guard.py`/`test_plan_guard.py`/`spec-links.test.ts`/`stray-tool-tags.test.ts`)는 신규 파일
전문을 `Read` 로 직접 열어 확인했다.

## 발견사항

- **[INFO]** 단일 PR 이 두 개의 역할 스코프(developer 의 harness 위생 작업 + project-planner 의
  `error-codes.md` 두 surface 병기 spec 작업)를 함께 담는다 — 단, 이미 두 차례 검토·처분됨
  - 위치: 전체 changeset 구성. harness 축 = 파일 1~5(`plan-lifecycle.md`/`plan_guard.py`/
    `test_plan_guard.py`/`spec-links.test.ts`/`stray-tool-tags.test.ts`) + 파일 6~14(`plan/**`
    트래킹 문서). spec 축 = 파일 40/49/58/67/76/85(`_target/spec-draft-error-code-two-surfaces.md`
    6회 스냅샷) + 파일 41~46/50~55/59~64/68~73/77~82/86~91(6라운드 `--spec` consistency-checker
    산출물) + 파일 92(`spec/conventions/error-codes.md` 본문).
  - 상세: `CLAUDE.md` 는 `spec/` 변경은 project-planner, `codebase/`(및 harness) 변경은 developer
    로 역할을 가른다. 이번 diff 는 92개 파일 중 spec 축이 대략 60~70개(6라운드 × 6개 checker
    산출물 + `_target` 스냅샷)를 차지해, harness 축(14개)보다 압도적으로 크다. 다만 이 지적은
    새로운 발견이 아니다 — 같은 changeset 안에 이미 커밋된 `review/code/2026/09/01/22_25_37/
    RESOLUTION.md`(W1)와 `review/code/2026/09/01/22_44_29/RESOLUTION.md`(W1 재확인)가 정확히
    이 문제를 지적받았고, "사용자가 'A 를 모두 처리하고 PR' 로 묶어 지시했다" 는 근거로 **분리
    대신 PR 본문에 harness 축/spec 축을 갈라 적는 것으로 처분**했다. 즉 이 번들링은 우연한
    스코프 이탈이 아니라 사용자가 명시적으로 승인한 범위이고, 완화 조치(PR 본문 axis 분리 명시)도
    두 라운드에 걸쳐 재확인됐다. 이 diff 만으로는 실제 PR 본문에 그 분리 서술이 들어갔는지
    확인할 수 없다(PR 본문은 changeset 파일이 아니다).
  - 제안: PR 을 올릴 때 RESOLUTION.md 가 약속한 대로 본문에 "harness 축(14파일) / spec 축(78파일,
    책임: project-planner 산출물 그대로 병기)" 구분 서술이 실제로 들어갔는지 최종 확인. 새로운
    조치는 불필요 — 이미 처분된 항목의 재확인용 기록으로 남긴다.

## 확인했으나 문제 없음 (근거 기록)

- **핵심 harness 코드 4건은 각각 서술된 의도에 정확히 대응한다.** `plan_guard.py`(파일 2)의
  diff 는 `_CHECKBOX` 정규식 1줄 확장 + 그 앞 근거 주석 + `_all_checkboxes_done` 내부 비대칭
  카운팅 분기 추가뿐이고, 무관한 라인 재포맷이나 다른 정규식(`_BRANCH_ANNOT`,
  `_PLACEHOLDER_WORKTREE`) 손질은 없다. `test_plan_guard.py`(파일 3)도 신규 테스트 5개 순수
  추가이며 기존 테스트 수정이 없다. `stray-tool-tags.test.ts`(파일 5) 전문을 직접 읽었다 —
  `review/**` 를 스캔 범위에서 뺀 것도 주석에 근거(봉인된 세션 산출물이라 편집 안 됨)가 있고,
  기능이 "harness hygiene" 태스크 범위(도구 아티팩트 태그 재발 감지)를 벗어나지 않는다.
  `spec-links.test.ts`(파일 4)의 멀티라인 ANCHOR 케이스 추가도 인용된 과거 리뷰 ID
  (`15_01_34` INFO #17, `15_55_00` INFO #8)의 후속 항목이라 이번 작업과 무관한 확장이 아니다.
- **`plan/complete/*.md` + `plan/in-progress/webchat-usewidget-extraction.md` 5파일의 편집은
  전부 `</content>`/`</invoke>` 잔재 삭제 1줄씩뿐이다** — 새 가드(`stray-tool-tags.test.ts`)가
  검출한 위반을 그 가드가 검증하는 changeset 안에서 바로 정리한 것이라 원인-결과가 같은 PR
  안에 있다. 본문 내용·구조 변경은 없다.
- **`spec/conventions/error-codes.md`(파일 92)의 diff 는 §Overview 한 문단(3문장 추가 + 기존
  문장 소폭 수정)에 국한된다.** `plan/complete/spec-draft-error-code-two-surfaces.md`(파일 9,
  `_target` 스냅샷은 파일 40/49/58/67/76/85)의 draft "변경 제안" 절과 diff 를 대조해도 범위가
  일치하고, §3/§4 정규화 파이프라인 등 인접 서술은 건드리지 않았다고 draft 스스로 명시한다.
- **`plan/in-progress/harness-review-gate-followups.md`(파일 12)에 추가된 두 backlog 항목**
  (SoT 미등재 defer, `plan-stale-audit.sh` 정규식 drift)은 이번 changeset 이 만든 두 가지
  유예 결정을 기록하는 것으로, 무관한 새 작업이 아니라 이번 diff 자체가 낳은 후속 결정의
  문서화다.
- **`plan/in-progress/expression-engine-error-shape-spec-broken-on-main.md`(파일 11)** 의
  체크박스/서술 정정은 `plan-lifecycle.md`(파일 1)에 추가한 "이동 문서의 outgoing 링크" 절과
  직접 연결된 항목(같은 진단을 다루던 기존 backlog 항목의 처분 갱신)이라 무관한 파일 손질이
  아니다.
- **설정 파일 변경 없음** — `package.json`/`tsconfig`/CI 워크플로 등 어떤 설정 파일도 diff 에
  없다.
- **포맷팅/주석/임포트의 별도 결함은 발견되지 않았다** — `plan_guard.py` 의 12줄 근거 주석은
  실질 근거를 담고 있어(파일 내 다른 리뷰어도 INFO 로만 처리) 스코프 문제가 아니며, 4개
  코드 파일 어디에도 미사용 임포트나 의미 없는 공백 변경이 섞여 있지 않다.

## 요약

실질 코드 변경(4개 파일: `plan_guard.py`/`test_plan_guard.py`/`spec-links.test.ts`/
`stray-tool-tags.test.ts`)과 그로 인한 부수 정리(9개 `plan/**` 문서)는 각각 서술된 의도에
정확히 대응하며 무관한 리팩토링·포맷팅·기능 확장이 섞여 있지 않다. 이 changeset 의 유일하게
큰 스코프 이슈는 developer 축(harness hygiene, 14파일)과 project-planner 축(`error-codes.md`
두 surface 병기 + 6라운드 consistency-check 산출물, ~78파일)이 한 PR 에 번들된 것인데, 이는
사용자가 명시적으로 지시한 범위이고 이미 같은 changeset 안의 두 차례 리뷰(`22_25_37`,
`22_44_29` RESOLUTION.md W1)에서 검토·처분(분리 대신 PR 본문에 axis 명시)까지 끝난 상태다.
새로운 미처분 스코프 이탈은 발견되지 않았다.

## 위험도

LOW
