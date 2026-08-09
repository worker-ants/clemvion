# 정식 규약 준수 검토 — convention_compliance

검토 모드: `--impl-done` (diff-base `origin/main`, scope `spec/conventions/`)
번들 결함: prompt 에 diff 섹션 미포함 확인 → `git diff origin/main...HEAD` 를 직접 실행해 보완.
확인 대상 델타: `538e4b92f`·`4e1995cb8`·`6aacded22`·`829b46890` (+ 이 라운드가 참조하는 선행 커밋
`6e4e62367`·`dd7da2d1b`·`5311d6b01`·`88555a52b` 도 미러 정합 판정에 필요해 함께 대조).

## 발견사항

### [INFO] Gate C 판정 서술 정정 — 세 미러 전부 정합 확인됨 (드리프트 없음)

- target 위치: `.claude/docs/plan-lifecycle.md` §Gate C (라인 131-132, 커밋 `6aacded22`)
- 대조 규약: `PROJECT.md:278`(자동 가드 표의 `spec-plan-completion.test.ts` 행) ·
  `spec/conventions/spec-impl-evidence.md §4.2`(Gate C 행)
- 상세:
  - `6aacded22` 는 `.claude/docs/plan-lifecycle.md` 의 Gate C 판정 서술을 `ok = (string &&
    비어있지 않음) || (배열 && length>0)` (실제 구버전 동작, 느슨함) 에서 `hasValidSpecImpact`
    로 정정 — "문자열이면 `none`/`없음`/`n/a`/`na` 어휘만, 배열이면 비어있지 않고 모든 원소가
    `spec/` 하위의 실존 파일" 로 조였다.
  - 실제 구현(`codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts`
    `hasValidSpecImpact`/`makeSpecExists`, 라인 68-82·112-132)을 절대경로로 직접 열어 대조한
    결과 새 서술이 코드와 정확히 일치한다 (`NONE_VALUES = {none, 없음, n/a, na}`, 배열은
    `specExists` 로 `path.resolve` 정규화 후 `spec/` 하위 + `isFile()` 실존 검사).
  - `spec/conventions/spec-impl-evidence.md §4.2` 의 Gate C 행(`spec-plan-completion.test.ts`)
    은 "spec path 목록 실존, 또는 no-op sentinel `none`/`없음`/`n/a`/`na`" 라고 **이번 PR
    diff 밖에서 이미(2d4775e28, #457)** 정확히 서술하고 있었다 — `git diff
    origin/main...HEAD -- spec/conventions/spec-impl-evidence.md` 로 확인해도 이 행은
    변경분(+/-)에 없다. 즉 두 문서가 서로 다른 시점에 각자 옳아졌을 뿐, 지금 시점에는 완전히
    일치한다. `PROJECT.md:278` 은 판정 로직을 재서술하지 않고 "spec_impact 선언 강제 (Gate C,
    date-cutoff grandfather). SoT: spec-impl-evidence.md §4.2" 로 SoT 위임만 하므로 애초에
    갱신 대상이 아니다(위임 패턴은 인접 행들과 동일).
  - **인용 라인 번호 정정 참고**: 프롬프트가 지목한 `PROJECT.md:277` 은 실제로는
    `plan-frontmatter.test.ts` 행(별개 가드)이고, `spec-plan-completion.test.ts`(Gate C) 행은
    한 줄 아래인 `:278` 이다 — `origin/main` 시점부터 동일 위치였다(이 PR 이 줄을 밀지
    않음). 다만 `:277` 행도 대조해보면 `spec-impl-evidence.md §4.2` 의 plan-frontmatter
    행(3-검사 서술)과 내용이 일치하므로, 어느 쪽으로 읽어도 실질적 드리프트는 없다.
  - 참고로 "이 PR 에서 미러 drift 를 네 번 냈다" 는 사실 자체는 커밋 이력으로 확인된다 —
    `dd7da2d1b`(spec-impl-evidence 의 plan-frontmatter 서술·`code:` 누락 정정),
    `6e4e62367`(worktree-policy.md §3 의 폐기된 `plan_coherence` 서술 정정 — 자매 문서
    `plan-lifecycle.md` 라인 99 의 동일 각주와 지금 대조해도 일치), `5311d6b01`/`88555a52b`
    (PROJECT.md 행 갱신). 이번 라운드가 그 패턴을 다시 반복했는지가 우려였는데, 이번엔
    갱신이 필요한 두 번째 미러가 애초에 이미 정확했기 때문에 "정정 누락" 이 발생할 표면 자체가
    없었다.
- 제안: 없음 (조치 불필요). 다만 향후 PROJECT.md 인용 시 정확한 행 번호(:278)를 쓰는 편이
  다음 라운드의 혼동을 줄인다.

### [INFO] `title:`/`worktree:` 콜론 값 인용 정정 (2건) — plan frontmatter 규약 준수

- target 위치: `plan/complete/harness-line-anchors-review-classified-commit.md` 라인 2,
  `plan/complete/web-chat-quality-backlog.md` 라인 2 (커밋 `538e4b92f`)
- 대조 규약: `.claude/docs/plan-lifecycle.md` §4 Frontmatter 스키마 (라인 63-99)
- 상세:
  - 두 diff 는 `title:`/`worktree:` 스칼라 값의 **의미·내용을 전혀 바꾸지 않고** YAML
    작은따옴표만 추가했다 (`원 제목: "Review 분류"` / `그룹별 분리: D #732 …` 처럼 콜론+공백을
    포함한 값을 인용하지 않으면 YAML 파서가 중첩 매핑으로 오해해 `parseFrontmatterSafe` 가
    `null` 을 반환 — 실측: 수정 전 `findUnparseablePlans()` 가 이 두 파일을 실제로 반환했다).
  - `plan-lifecycle.md` §4 는 `worktree`/`started`/`owner` 3필드 스키마 + `priority`/
    `status`/`title` 등 "추가 필드는 허용" 이라고만 규정하며, YAML 스칼라의 인용 스타일을
    규제하는 조항은 없다 — 즉 이 정정은 기존 규약이 금지·규정하는 어떤 것도 건드리지 않는
    순수 구문 수정이다.
  - 필드 값 자체(연결된 worktree 히스토리 서술)는 이 두 완료 plan 이 원래 갖고 있던 자유
    서술이며 이번 정정으로 신설되지 않았다 — `worktree: <task_name>-<slug>` 형식 규정과의
    이견(예: `web-chat-quality-backlog.md` 의 `worktree:` 가 다중 그룹 서술이라는 점)은 이번
    diff 가 만든 것이 아니라 선재 상태이므로 이 라운드의 검토 범위(diff 위반 여부) 밖이다.
  - 실측 검증: `pnpm vitest run` 으로 `spec-plan-completion.test.ts`/`plan-frontmatter.test.ts`/
    `plan-scan.test.ts`/`spec-links.test.ts` 4개 스위트(998 tests) 를 현재 워킹트리에서
    돌려 전부 PASS 확인 — 저장소에 남은 파싱 실패·Gate C 미선언 사례가 없다.
- 제안: 없음 (조치 불필요). 참고용 제안 하나만 남긴다 — `plan-lifecycle.md` §4 는 `spec_impact`
  의 "흔한 실패형" 을 이미 각주로 문서화하는 패턴이 있으니(§Gate C), 같은 자리에 "스칼라 값에
  `: `(콜론+공백)가 들어가면 반드시 따옴표로 인용" 한 줄을 추가하면 이번 클래스의 재발을
  더 일찍 막을 수 있다(선택 사항 — 이미 `findUnparseablePlans` 캐너리가 build-time 으로
  방어하므로 문서화는 발견을 앞당기는 부가 가치일 뿐 필수는 아니다).

### [INFO] §3 "흡수 시 삭제" 좁은 예외 — 문서 내 다른 절과 충돌 없음

- target 위치: `.claude/docs/plan-lifecycle.md` §3 라인 45-46 (커밋 `6e4e62367` 신설, 이번
  네 커밋 자체가 건드리진 않았으나 프롬프트가 재검증을 요청한 조항)
- 대조 규약: 같은 문서 §1(폴더 구조) · §2(완료 조건) · §3 PR 전 push gate · §5(이동 commit
  자가 점검) · §6.1(stale audit)
- 상세:
  - **§1/§2 "전부 끝나면 complete/" 와의 관계**: §2 는 "미체크 항목이 0 이면 complete/" 를
    기본 경로로 규정하지만, §3 신설 예외는 조건 (a) "미착수(`worktree: (unstarted)`)" 를
    선행조건으로 못박아 이 둘을 구조적으로 분리한다 — "이 plan 자신이 실행돼 끝난 경우"(→
    complete/) 와 "이 plan 이 실행되지 않은 채 다른 곳에 흡수돼 무의미해진 경우"(→ 삭제
    가능) 는 서로 겹치지 않는 트리거라 모순이 아니다.
  - **push gate(§3 하위 "PR 전 plan 갱신·이동 강제")와의 관계**: 이 gate 는
    `.claude/hooks/_lib/plan_guard.py` 가 구현하며, `_linked_plans()` 가 **현재 시점**
    `plan/in-progress/` 디렉터리 목록을 스캔해 연결 plan 을 고른다. 예외 조건 (a) 가 요구하는
    `worktree: (unstarted)` 는 `_PLACEHOLDER_WORKTREE` 집합에 포함돼 애초에 어떤 worktree
    와도 매칭되지 않으므로, 이 예외가 적용되는 plan 은 삭제 전부터 이미 이 gate 를 무장시키지
    않는다 — 따라서 §3 "만족 조건" 항목이 삭제를 별도로 열거하지 않아도 실제 구현과
    충돌하지 않는다(삭제된 파일은 애초에 `_linked_plans()` 후보에도 없다). 코드 레벨까지
    내려가 확인했다.
  - **§5 "이동 commit 자가 점검"(Gate C 체크리스트 포함)과의 관계**: §5 제목 자체가 "이동
    commit" 으로 스코프가 좁혀져 있어, "이동" 이 아닌 "삭제" 경로(§3 예외)에는 애초에 적용
    대상이 아니다 — Gate C(`spec_impact`) 우회를 정당화하는 문구로 남용될 위험은 §3 각주가
    이미 "조건 (b)(d) 가 그 경계다 — 흡수처를 지목 못 하면 삭제가 아니라 이동" 으로 명시
    방어하고 있다.
  - **조건 (c) "인입 참조 0건" 의 실효성**: 별개 build guard `spec-link-integrity.test.ts`
    (spec 본문의 `plan/**` 링크 실존 검사, §4.2) 와 `spec-pending-plan-existence.test.ts`
    (spec `pending_plans:` 실존 검사) 가 이미 존재해, 조건 (c) 를 어기고 삭제하면(=아직도
    다른 spec 이 그 경로를 참조 중이면) 별도 build 가 즉시 깨진다 — 문서상 선언과 기계적
    강제가 중복 방어를 이뤄 모순이 아니라 보강 관계다.
  - **선례 인용 정확성(부수 확인)**: 각주가 드는 두 선례 `1493b5ae9`·`bc10e215e` 모두 실제로
    미착수 in-progress plan 을 삭제한 커밋임을 `git diff-tree` 로 확인했다. 다만
    `1493b5ae9` 가 지운 `harness-consistency-impl-done-bundle-sort.md` 는 삭제 직전 시점에
    `worktree:` 필드 자체가 **없었다**(리터럴 `(unstarted)` 가 아니라 필드 부재) — §3 조건
    (a) 의 정확한 문구("`worktree: (unstarted)`")와 완전히 축자 일치하진 않는다. 실질(어떤
    worktree 에도 결속되지 않음)은 동일해 선례로서 결함은 아니지만, 각주가 조건 문구를
    그대로 "예" 라고 읽는 독자에게는 사소한 오차로 보일 수 있다.
- 제안: 없음 (조치 불필요, 실질적 충돌 없음). 참고: 위 선례 정확성 각주는 문서를 다음에 손댈
  기회가 있을 때 "미착수(worktree 미기재 또는 `(unstarted)`)" 처럼 한 단어만 보강하면 완전히
  닫힌다 — 이번 라운드에서 별도 조치가 필요할 정도는 아니다.

## 요약

이번 라운드(티켓 종결 라운드, 델타 `538e4b92f`·`4e1995cb8`·`6aacded22`·`829b46890`)에서
`spec/conventions/**` 및 그 규약이 참조하는 `.claude/docs/plan-lifecycle.md`·`PROJECT.md`
사이에 CRITICAL·WARNING 급 정식 규약 위반은 발견되지 않았다. (1) Gate C 판정 서술 정정은
`plan-lifecycle.md`(수정) · `spec-impl-evidence.md §4.2`(원래부터 정확) · `PROJECT.md`(위임만,
갱신 불요) 세 곳 모두 실제 구현(`hasValidSpecImpact`/`makeSpecExists`)과 지금 일치하며,
이번 PR 이 반복해온 "미러 한쪽만 정정" 패턴이 이번 델타에서는 재발하지 않았다. (2) 두 완료
plan 의 `title:`/`worktree:` 콜론 값 인용은 의미 변경 없는 순수 YAML 구문 수정이라 frontmatter
규약(§4)의 어떤 조항과도 충돌하지 않으며, 관련 4개 build-guard 스위트(998 tests) 가 실측
PASS 다. (3) §3 신설 "흡수 시 삭제" 좁은 예외는 §1/§2 의 기본 완료-이동 경로, push gate 구현
(`plan_guard.py`), §5 이동 체크리스트, 두 개의 별도 build guard(spec-link-integrity·
spec-pending-plan-existence) 와 조건별로 대조했을 때 구조적으로 충돌하지 않으며, 오히려
서로 보강한다. INFO 3건은 전부 조치 불필요한 참고 사항(라인 번호 인용 정정, 문서화 제안,
선례 각주의 사소한 문구 오차)이다.

## 위험도

LOW
STATUS=success
