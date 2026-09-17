# Plan 정합성 검토 — spec/2-navigation/ (impl-done)

## 발견사항

- **[WARNING]** 트래커가 아직 존재하지 않는 `plan/complete/trigger-save-partial-patch.md` 를 이미 이동된 것처럼 두 번 인용
  - target 위치: 해당 없음 — 이 발견은 target spec 문서가 아니라 `plan/in-progress/**` 상호 참조 정합성에 관한 것
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` (uncommitted 편집) 항목 7 행, 그리고 바로 아래 신설 planner 후속 항목("창 1 실측 결과를 spec 에 반영한다")의 도입부
  - 상세:
    - 두 문구 모두 경로를 `plan/complete/trigger-save-partial-patch.md` 로 적는다 (`~~7~~ ✅ … **2026-09-17 해소** (`plan/complete/trigger-save-partial-patch.md`)` 및 `developer, 2026-09-17 등재, `plan/complete/trigger-save-partial-patch.md` «이 PR 이 안 하는 것»`).
    - 그러나 실제로는 `plan/complete/trigger-save-partial-patch.md` 파일이 **존재하지 않는다** (확인: `test -f` → MISSING). 해당 plan 은 여전히 `plan/in-progress/trigger-save-partial-patch.md` 에 있고 frontmatter 는 `status: in-progress` 다.
    - `trigger-save-partial-patch.md` 자신의 체크리스트도 같은 우선순위로 어긋난다 — `[x] 트래커 항목 7 해소 표시 + planner 후속(⚠️ 교체 · e2e `code:` 등재 · 404 사유) 등재 + plan → `complete/`` 한 줄이 **세 가지를 통째로 체크**했는데, 앞 두 가지(트래커 항목 7 표시·후속 등재)는 실측 확인되나 마지막(`plan → complete/` 실제 이동)은 아직 일어나지 않았다. 같은 파일 바로 다음 줄 `[ ] --impl-done spec/2-navigation/ — 진행 중` 이 아직 미완료임을 스스로 밝히고 있어, 이 checker 호출(현재 라운드) 자체가 그 gate 라는 점과도 모순된다.
    - 이는 프로젝트 관례("체크와 `complete/` 이동은 한 동작") 위반의 전형이다 — 두 plan 문서가 서로 앞서서 "이미 끝났다"고 기록하는 순환 참조를 만든다. 이 상태로 커밋되면 두 경로 모두 존재하지 않는 `plan/complete/trigger-save-partial-patch.md` 를 가리키는 broken link 로 남는다.
  - 제안: (a) `trigger-save-partial-patch.md` 를 실제로 `plan/complete/` 로 옮기는 커밋과 이 두 참조를 추가하는 커밋을 **같은 커밋**으로 묶거나, (b) 아직 이동 전이라면 두 참조를 `plan/in-progress/trigger-save-partial-patch.md` 로 고치고 체크리스트의 `plan → complete/` 항목은 실제 이동 시점까지 미체크로 되돌린다. 이번 라운드(`--impl-done spec/2-navigation/`)가 통과한 뒤 이동·참조 수정·커밋 순서를 지킬 것.

- **[INFO]** target §3 ⚠️ "실측되지 않은 잔여" 문구는 이제 사실과 어긋나지만, 이는 의도적으로 추적된 지연이다 (조치 불요)
  - target 위치: `spec/2-navigation/2-trigger-list.md §3` API, ⚠️ "실측되지 않은 잔여" 박스 (`… developer 항목 7`)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 신설 planner 후속 항목 1·2·3 (§3 ⚠️ 교체, `code:` 에 e2e 파일 등재, chat-channel §5.4 404 사유 한 줄)
  - 상세: 이번 diff(트리거 `TriggersService.update()` 부분 객체 `save` 수정)가 바로 그 ⚠️ 문구가 "미검증"이라 부르던 두 가지(① CASCADE 창 실패 방식, ② 락 밖 컬럼 경합)를 실측·수정했다. 그런데 target scope 델타는 0 — §3 문구는 그대로 남아 있다. 다만 `git log -S` 로 확인한 결과 그 ⚠️ 문구는 `217fadecb docs(spec): …` 커밋, 즉 planner 턴이 쓴 문장이라 CLAUDE.md 의 "자기-반증형 소정정" 예외(조건 1: 문장을 developer 자신이 썼어야 함)가 적용되지 않는다 — developer 가 직접 고치지 않고 별도 planner PR 로 분리한 것은 역할 경계상 올바른 처리다. 이 분리는 3라운드 코드 리뷰(`13_44_39` W1 · `14_11_48` INFO#12 · `14_34_56` INFO#1)와 `--impl-prep`(`13_04_39` W1) 모두에서 반복 지적됐고, 트래커에 구체적 항목(§3 교체 · `code:` 등재 · 404 사유)으로 **이미 등재되어** 있다.
  - 제안: 조치 불요 — 다음 planner 턴이 위 트래커 항목 1~3 을 그대로 집행하면 된다. 병합~해당 planner PR 사이 창에서 §3 문구가 낡아 있다는 사실만 인지해 두면 된다 (트래커 자체가 이미 이 창을 INFO#2 로 인지하고 있다).

## 요약

이번 diff 는 `spec/2-navigation/2-trigger-list.md` 를 직접 변경하지 않는 코드 전용 PR(scope 델타 0)이며, target 이 plan 의 "결정 필요" 항목을 우회하거나 미해소 선행 조건을 무시한 흔적은 없다 — 오히려 target §3 ⚠️ 문구가 이 PR 로 낡는 사실을 developer 가 스스로 인지해 역할 경계(자기-반증형 소정정 조건 1 미충족)를 지키며 planner 후속 3건으로 정확히 등재했고, 세 라운드 리뷰가 이를 반복 확인했다. 다만 그 등재를 담은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 자체가 아직 존재하지 않는 `plan/complete/trigger-save-partial-patch.md` 경로를 두 번 선참조하고, `trigger-save-partial-patch.md` 의 체크리스트도 "plan → complete/" 를 실제 이동 전에 체크해 두 plan 문서가 서로를 "이미 끝났다"고 가리키는 순환 상태다 — 커밋 전 실제 이동과 참조를 동기화해야 한다.

## 위험도

LOW
