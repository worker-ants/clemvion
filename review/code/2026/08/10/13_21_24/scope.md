# 변경 범위(Scope) Review

## 발견사항

- **[WARNING]** 이 브랜치(`claude/webchat-usewidget-extraction`, origin/main 대비 8 commits)가 서로 무관한
  두 워크스트림을 한 changeset 에 묶었다 — (A) `openStream`/`StreamClaim` 구조적 게이트 리팩터(이 티켓의
  본래 목적)와 (B) `spec/7-channel-web-chat/3-auth-session.md` 의 frontmatter `status` 정합성 결함
  수정(별개 `--spec` consistency-check 라운드에서 우연히 발견된 **기존** 결함). B 는 문서 스스로
  "그 PR 범위 밖" 이라고 적어 놓고도 같은 브랜치·같은 changeset 에 커밋됐다.
  - 위치: `plan/in-progress/webchat-reload-rest-error-branches.md:14`-`15`
    (`> 무관한 티켓(webchat-usewidget-extraction)의 --spec 라운드에 딸려 나온 기존 결함이라 그 PR
    범위 밖이고, 유실 방지를 위해 본 문서를 만든다.`) 와 같은 파일 `:75`-`79`
    (`## 본 PR 에서 한 것 (2026-08-10)` — frontmatter 정정을 "본 PR" 에서 수행했다고 명시).
  - 상세: `git log --oneline` 으로 이 브랜치의 8개 커밋을 확인했다 —
    `ce6c81838`(게이트를 openStream 안으로) · `84765cc96`(StreamClaim union) ·
    `edffa107e`(그 리뷰 라운드 산출물) · `bf8d71802`(fail-closed 통일 + **워크스트림 A 자신의**
    스펙 아키텍처 서술 동기화, 정당한 스펙-싱크) 까지가 워크스트림 A다. 반면
    `933eff66d`(frontmatter `implemented`→`partial`) · `43423f830`(§R4 미구현 고지) ·
    `16fd4fe6d`(신설 plan 의 "결정 필요" 프레이밍 자기모순 정정) · `02b4161e4`(그 2라운드
    consistency-check 산출물 11개 파일)는 워크스트림 B — `use-widget.ts` 의 이번 리팩터와
    코드 레벨로 아무 관련이 없는, 한 달 전(`6b25ccc3e`, 2026-07-05)부터 존재하던 spec
    문서화 결함의 정정이다. `plan/in-progress/webchat-reload-rest-error-branches.md`
    자신이 이 사실("무관한 티켓" · "그 PR 범위 밖")을 명시적으로 인정하면서도, 실제로는
    frontmatter 정정·§R4 caveat·plan 신설·consistency-check 2라운드(5+5 checker, 총 11개
    산출물 파일)를 전부 "본 PR" 안에서 완료해 같은 branch/PR 로 합류시켰다.
    CLAUDE.md §0 이 "모든 작업은 `.claude/worktrees/<task>-<slug>/` 안에서" 라고 규정하는
    task-per-worktree 경계와도 결이 어긋난다 — 이 worktree/branch 이름은
    `webchat-usewidget-extraction` 인데, 실제로는 그 이름이 가리키지 않는 별개 spec 결함
    수정까지 같은 이름 아래 완료됐다.
  - 완화 요인(그래서 CRITICAL 아님): (1) 실제 3개 REST 오류 분기의 **구현**은 신설 plan
    (`webchat-reload-rest-error-branches.md`, `owner: project-planner`, `worktree: (unstarted)`)으로
    올바르게 분리·이연됐다 — 워크스트림 B 에서 "본 PR" 에 들어간 것은 frontmatter
    한 줄 + Rationale 캐비엇 두 문단뿐이라 실질 footprint 는 작다. (2) 수정 내용 자체는
    "본문이 이미 미구현을 자인하는데 frontmatter 만 `implemented`" 라는 규약 위반을 규약이
    요구하는 형태로 맞추는 기계적 정정이라 위험도가 낮다. (3) 은폐가 아니라 plan 문서·커밋
    메시지 양쪽에 이유가 투명하게 기록돼 있다.
  - 제안: 엄격한 PR 단위 분리가 목표라면 워크스트림 B(4 커밋 + `spec/`·`plan/`·
    `review/consistency/12_56_30,13_12_16` 22개 파일)를 별도 브랜치/PR로 분리해 origin/main 에
    독립적으로 머지할 것을 고려한다. 지금처럼 "유실 방지" 를 이유로 같은 PR 에 묶는 것을
    유지한다면, PR 설명(또는 `webchat-usewidget-extraction.md` 상단)에 "이 PR 은 두 개의
    독립적인 결함 묶음을 포함한다" 를 한 줄로 명시해 리뷰어가 diff 를 두 단위로 나눠 읽을 수
    있게 하는 것이 최소 조치다.

- **[INFO]** 리뷰 대상 diff 의 28개 파일 중 22개(`review/code/2026/08/10/12_39_25/**` 11개 +
  `review/consistency/2026/08/10/{12_56_30,13_12_16}/**` 11개)가 harness 리뷰/검토 산출물이다.
  - 위치: 위 22개 파일 전체
  - 상세: CLAUDE.md 의 "코드 리뷰 산출물 → `review/code/**`", "일관성 검토 산출물 →
    `review/consistency/**`" 저장 규약과 "구현 완료 후 자동 review/fix 는 상시 승인된 강제
    의무" 조항에 정확히 부합하고, 프로젝트 memory 도 "review/ 는 gitignored 아님" 을 명시한다 —
    이 자체는 범위 위반이 아니라 규약이 요구하는 정상적인 audit trail이다. 다만 이 산출물
    묶음이 정확히 위 WARNING 의 두 워크스트림 경계(12_39_25=A, 12_56_30·13_12_16=B)를
    그대로 반영하고 있어, 그 finding 의 보강 증거로만 기록해 둔다.
  - 제안: 조치 불필요.

- **[없음]** 워크스트림 A(`use-widget.ts` StreamClaim 리팩터·테스트 주석 갱신·
  `webchat-usewidget-extraction.md` 체크리스트) 자체는 이전 라운드(`review/code/2026/08/10/12_39_25/scope.md`)가
  이미 "범위 위반 없음(NONE)" 으로 판정했고, 이번 diff 에 추가된 워크스트림 A 쪽 변경분
  (`plan/in-progress/webchat-usewidget-extraction.md:162`-`167` 의 상호 참조 각주)도 두 plan 이
  같은 함수(`seedWaitingFromStatus`)를 건드리게 된 이번 브랜치의 결과를 정확히 반영하는
  필요한 housekeeping이지, 별도의 무관한 수정이 아니다. import·설정·순수 포맷팅 변경은
  발견되지 않았다.

## 요약

이 changeset 은 형식상 하나의 branch/PR(`claude/webchat-usewidget-extraction`, 8 commits)이지만
실질적으로는 서로 독립된 두 결함 묶음 — (A) `openStream` 스트림 소유권 게이트의 구조적 강제
리팩터(이 티켓 고유 목적)와 (B) `spec/7-channel-web-chat/3-auth-session.md` frontmatter
`status` 정합성 결함 수정(별개 `--spec` consistency-check 에서 우연히 발견된, 한 달 전부터 존재하던
기존 결함) — 을 담고 있다. B 는 담당 plan 문서 스스로 "그 PR 범위 밖" 이라고 명시하면서도 같은
PR 에 커밋됐다는 점에서 자기 진술과 실제 행동이 어긋나는 명확한 scope-mixing 사례다. 다만 B 의
실제 구현(REST 오류 3분기)은 신설 plan 으로 올바르게 이연됐고, 이번 PR 에 실제로 들어간 것은
소규모·저위험·투명하게 문서화된 정정(frontmatter 한 줄 + Rationale 캐비엇)뿐이라 CRITICAL 로
올릴 사안은 아니다. 워크스트림 A 자체의 코드 변경 범위는 정확하고 깨끗하다.

## 위험도

MEDIUM
