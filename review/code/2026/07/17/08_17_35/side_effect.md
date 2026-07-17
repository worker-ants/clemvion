# Side Effect 리뷰 — review/code/2026/07/17/08_17_35 (side_effect)

## 검토 범위 정정 및 방법

`meta.json` 에 등재된 실제 대상 파일은 다음 18개 뿐이다 — 전부 `review/consistency/**` 산출물(md/json) 과
`spec/2-navigation/**`·`spec/data-flow/12-workspace.md` **문서(prose)** 이며, 실행 코드(.ts/.sh 등)는 하나도
포함되지 않는다.

- `review/consistency/2026/07/17/01_25_26/{cross_spec,naming_collision,plan_coherence,rationale_continuity}.md`, `meta.json`
- `review/consistency/2026/07/17/07_03_34/{SUMMARY,convention_compliance,cross_spec,naming_collision,plan_coherence,rationale_continuity}.md`, `meta.json`, `_retry_state.json`
- `spec/2-navigation/{10-auth-flow,11-error-empty-states,9-user-profile,_layout}.md`, `spec/data-flow/12-workspace.md`

한편 호출자(orchestrator)가 명시적으로 지시한 중점 확인 대상 — **커밋 `879393b27`(`.claude/test-stages.sh`
`cmd_e2e()`: `make e2e-test` → `make e2e-test-full`)** — 은 이 18개 파일 목록에는 없지만, 브랜치
전체(`git diff origin/main..HEAD`)에는 포함돼 있다. 지시에 따라 이 커밋과 `.claude/tools/run-test.sh`·
`Makefile`·`.github/workflows/e2e.yml`·`resolution-applier.md`·`developer/SKILL.md` 를 worktree 절대경로로
직접 열람해 별도로 분석했다(아래 "A. cmd_e2e 전환" 절). 이어서 실제 배정 파일 18개에 대한 side-effect
분석은 "B. 배정 파일(18개) 분석" 절에 담았다.

## 발견사항

### A. `cmd_e2e` 전환(`879393b27`) — 다른 워크플로/CI/hook 파급

- **[INFO]** 로컬 wrapper 의 e2e 소요시간이 전 개발자·전 turn 에 걸쳐 증가 — watchdog·CI 자체는 안전
  - 위치: `.claude/test-stages.sh:132-134` (`cmd_e2e`), `.claude/tools/run-test.sh:60` (`RUN_TEST_TIMEOUT` 기본 1800s)
  - 상세: `cmd_e2e` 는 `run-test.sh` 가 이름으로 호출하는 콜백(`declare -F cmd_e2e`)이라 시그니처(0-인자, exit code 반환)는 그대로다 — 호출측 계약 파괴 없음. 다만 **의미**가 "backend supertest only(~30–100s 대)"에서 "backend + playwright(`~4–5분`, PROJECT.md:28 / 오케스트레이터 실측 ~260s)"로 바뀌어 `run-test.sh e2e` 를 호출하는 **모든** 경로(개발자 TEST WORKFLOW, `resolution-applier`)의 실제 벽시계 비용이 커진다. 다행히 `RUN_TEST_TIMEOUT` 기본값(1800s)에 비해 실측 소요(~260s)는 여유가 커 워치독 오탐(false TIMEOUT) 위험은 없다. `on_timeout_e2e`(→`make e2e-down`)도 `e2e-test-full`(내부적으로 `backend-e2e-runner && playwright-runner; make e2e-down`, `Makefile:72-76`) 기준으로 동일 compose project 를 정리하므로 hang 시 orphan 정리 로직도 그대로 유효함을 실측 확인했다.
  - CI(`​.github/workflows/e2e.yml:67,92`)는 `e2e-backend`/`e2e-frontend` 두 잡이 `make e2e-test`/`make e2e-test-full` 을 **wrapper 를 거치지 않고 직접** 호출하므로 이번 변경과 독립적 — 이중 실행·시간 증가 없음을 확인했다(문제 아님, 확인 목적 기재).
  - 제안: 조치 불요. 다만 `resolution-applier` 처럼 반복 호출(최대 3회, 아래 항목) 하는 경로는 실측 여유를 주기적으로 재확인 권장.

- **[INFO]** 자동 review-fix 루프(`resolution-applier`)의 e2e 재시도 예산이 실질 5배 가까이 늘어남
  - 위치: `.claude/agents/resolution-applier.md:120-135` ("최대 3회" e2e 실패 재시도 후 `ESCALATE=e2e-fail-3x`)
  - 상세: 이 sub-agent 는 코드 fix 커밋 후 `.claude/tools/run-test.sh e2e` 를 호출하고 실패 시 최대 3회 재시도한다. 종전(`make e2e-test`) 기준 3회 재시도 총 비용은 대략 ~2–5분이었으나, 이번 전환으로 1회당 ~4–5분(실측 ~260s)이 되어 최악의 경우(3회 전부 실패) 총 e2e 대기가 ~12–15분까지 늘어난다. CLAUDE.md 는 구현 완료 후 `/ai-review` + critical/warning fix 를 "상시 승인된 강제 의무"로 규정하므로, 이 경로는 사용자 개입 없이 자동 반복되는 경로다. 기능 결함은 아니나 자동 흐름의 세션당 소요·비용이 유의미하게 늘어나는 부작용이다.
  - 제안: 문서화(예: `resolution-applier.md` 에 "e2e 1회 ~4–5분, 3회 재시도 시 최대 ~15분" 주석) 고려. 차단 사유는 아님.

- **[INFO]** 모든 worktree 의 기본 e2e 경로에 `playwright-runner` 이미지 빌드/실행이 편입 — docker 리소스 사용 빈도 증가
  - 위치: `docker-compose.e2e.yml:232-239` (`playwright-runner`, `image: clemvion-e2e/playwright-deps:latest`, 사전 빌드/워크트리 간 공유)
  - 상세: 종전에는 `make e2e-test`(backend only)만 로컬 wrapper 기본 경로였으나, 이제 매 worktree 의 첫 e2e 실행마다 `playwright-runner` 이미지 빌드/pull 이 추가로 발생한다. 이미지 자체는 워크트리 간 공유(PROJECT.md:42)되고 사전 빌드(PR #952, 매 실행 pnpm/browser install 반복 제거)라 반복 비용은 완화돼 있으나, 신규 worktree·CI 캐시 미스 시 최초 빌드 비용·디스크 점유가 늘어난다. 프로젝트 이력상 "docker disk full"(build cache 누적) 이 반복 이슈였던 점을 감안하면, 이 변경으로 이미지 빌드 발생 **빈도**(worktree 수만큼) 가 늘어나는 것은 완만하지만 실재하는 부작용이다.
  - 제안: 기능 차단 아님. 기존 `docker image prune -f` 운용 정책 유지로 충분해 보이나, 참고용으로 기재.

- **[INFO]** 코드 주석의 비용 추정("+~50s")이 같은 커밋의 `PROJECT.md` 표(~4–5분)·실측(~260s)과 괴리
  - 위치: `.claude/test-stages.sh:130-131` "비용은 playwright 컨테이너 +~50s" vs `PROJECT.md:28` "~4–5분" vs 오케스트레이터 실측 ~260s
  - 상세: "+~50s" 가 playwright 자체의 한계(marginal) 실행 시간만을 뜻한다면(커밋 메시지의 "51 passed" 로그와 정합) 틀린 말은 아니나, backend 부분 소요(과거 plan 기록상 ~90–150s 대인 사례 다수, 예: `plan/complete/refactor-m5-node-di-layer1.md` "205 tests 91s")까지 합산한 **총 소요**로 오독하면 실제(~4–5분)보다 크게 낮게 추정하게 된다. `resolution-applier` 처럼 반복 호출 비용을 가늠해야 하는 자동화 소비자 입장에서 오해 소지가 있다.
  - 제안: "+~50s(playwright 자체 실행분, backend 별도 소요 포함 시 총 ~4–5분)" 처럼 명시하면 향후 혼동 방지. 비차단.

- **[INFO — 정보성, 문제 아님]** `.claude/docs/test-wrapper.md:22` 의 일반 예시 스니펫이 `cmd_e2e() { make e2e-test; }` 로 남아 있어 이번 프로젝트 실제 계약(`test-stages.sh`)과 표면상 어긋나 보임
  - 상세: 이 파일은 이번 diff 로 변경되지 않은 **범용 harness 문서**(`test-stages.sh.example` 과 동급, 프로젝트 특정 값이 아니라 최소 예시)라 이번 PR 이 만든 신규 drift 는 아니다. 다만 "각 stage 의 실제 명령은 `.claude/test-stages.sh` 에 정의" 문구가 바로 위에 있어 오독 위험은 낮음. 조치 불요.

- **[확인 — 문제 없음]** rebase 로 결합된 main 의 신규 내용(#957, `f8c334947`) 과의 상호작용
  - 상세: `f8c334947` 은 `plan/**`·`spec/**` grooming 커밋으로 `test-stages.sh`/`run-test.sh`/`Makefile`/CI 워크플로 어느 것도 건드리지 않는다(`git show --stat` 확인). rebase 자체가 텍스트 충돌 없이 완료됐고, 두 변경 집합 사이에 의미적 충돌(예: e2e 관련 plan 서술이 새 정의와 모순)도 발견되지 않았다.

### B. 배정 파일(18개) 분석

- **[WARNING]** `review/consistency/2026/07/17/07_03_34/_retry_state.json` 이 stale 스냅샷인 채로 커밋됨 — `_retry_state.json` 은 재시도/재개 판단의 SoT
  - 위치: `review/consistency/2026/07/17/07_03_34/_retry_state.json` (`agents_pending: [cross_spec, rationale_continuity, convention_compliance, plan_coherence, naming_collision]`, `agents_success: []`)
  - 상세: 같은 세션의 `SUMMARY.md`(파일 6)는 "커버리지 5/5 확보... `convention_compliance`·`naming_collision` 2개의 output_file 이 미생성(FS-write flakiness) → `ls` 대조 후 **직접 Agent 재호출**로 확보"라고 명시하고, 실제로 5개 checker `.md` 전부(파일 8·9·11·12·13)가 유의미한 본문과 함께 커밋돼 있다 — 즉 5개 전원 최종적으로 성공했다. 그런데 `_retry_state.json` 은 `agents_success: []`/`agents_pending: 전체` 인 **1차 workflow 시작 시점** 상태 그대로 남아 있다. `.claude/docs/subagent-call-contract.md:58` 는 "재시도 결정은 호출자(main)가 `_retry_state.json` 으로 추적"한다고 명시하므로, 이 파일은 단순 로그가 아니라 **향후 재개/재시도 로직이 읽는 상태 SoT** 다. 이 상태로 두면 이 세션 디렉터리를 다시 참조하는 어떤 자동화(예: idempotent 재개, 감사 스크립트)든 "5개 checker 가 전혀 실행되지 않았다"고 오판해 불필요한 재호출을 유발하거나, 이미 완료된 검토를 다시 덮어쓸 위험이 있다.
  - 이는 신규 버그가 아니라 **회귀** 성격이다 — 동일 클래스 결함(committed `_retry_state.json` 이 pending=전체/success=0 인 채로 실제 산출물과 모순)이 rebase 로 들어온 `f8c334947`(#957) 의 W2 항목에서 세션 `00_03_00` 에 대해 이미 지적·수정된 바 있다. 그러나 그 수정은 해당 세션 1건만 갱신했을 뿐, "직접 Agent 재호출로 FS-write 갭을 메울 때 `_retry_state.json` 도 함께 갱신" 하는 절차화는 이뤄지지 않아 이번 브랜치의 **또 다른** 세션(`07_03_34`)에서 동일 패턴이 재발했다.
  - 제안: (1) 본 세션 `_retry_state.json` 을 실제 최종 상태(`agents_pending: []`, `agents_success: [전체 5]`)로 갱신 — `f8c334947` 이 `00_03_00`에 적용한 것과 동일 패치. (2) 근본 대책으로 "FS-write flakiness 로 직접 Agent 재호출한 경우 `_retry_state.json` 도 함께 최종화" 를 `subagent-call-contract.md` 또는 checker 오케스트레이터 스크립트에 절차/가드로 반영해 재발 방지 — 현재는 사람이 매번 기억해서 고쳐야 하는 수작업 의존 상태.

- **[정보성 확인 — 문제 없음]** 나머지 배정 파일은 전부 review 산출물(md/json, 재실행 기록) 또는 spec 문서(prose 추가)로, 코드 실행 경로·전역 상태·환경변수·네트워크 호출·이벤트 콜백에 해당하는 side-effect 표면이 없다.
  - `spec/2-navigation/{10-auth-flow,11-error-empty-states,9-user-profile,_layout}.md`, `spec/data-flow/12-workspace.md` — 이번 diff 는 `code:` frontmatter 참조 추가, `## Rationale` R-3 신설, terminal 계약 각주 추가 등 순수 문서 갱신이며 값·API·설정 키 변경이 없다. 다른 spec 소비자(가드 `spec-frontmatter`/`spec-code-paths`/`spec-link-integrity`)에 대한 영향은 `run-test.sh unit` PASS 로 세션 내에서 이미 검증됨(SUMMARY.md:695,761 인용).
  - `review/consistency/**/meta.json`·`*.md` (검토 보고서 본문) — 산출물 자체이므로 side effect 관점의 위험은 "이 문서가 잘못된 사실을 근거로 이후 조치를 유도하는가" 인데, 두 세션(01_25_26 impl-done, 07_03_34 --spec draft 사전검토) 모두 CRITICAL/WARNING 없음(위 A/B 항목의 `_retry_state.json` 제외)으로 자체 정합적이다.

## 요약

배정된 18개 파일은 전부 review 산출물과 spec 문서라 코드 수준 side effect(전역 상태·시그니처·인터페이스·ENV·네트워크·이벤트)는 원천적으로 발생하지 않는다. 유일한 실질 발견은 `review/consistency/2026/07/17/07_03_34/_retry_state.json` 이 실제 완료 상태(5/5 성공, SUMMARY.md 로 확인)와 모순되는 stale 스냅샷(pending=전체/success=0)으로 커밋된 것 — 이 파일은 재시도/재개 판단의 SoT 이므로 향후 자동화가 오판할 부작용 소지가 있고, 같은 클래스 결함이 rebase 로 들어온 #957 의 W2 수정 대상(다른 세션)과 동형이라 재발 방지 절차화가 필요하다(WARNING). 한편 호출자가 별도로 지시한 `.claude/test-stages.sh` `cmd_e2e` 전환(`879393b27`, `make e2e-test` → `make e2e-test-full`)은 이번 배정 파일 목록엔 없지만 지시에 따라 전체 브랜치 diff 로 확인했다 — 함수 시그니처·호출 계약 파괴는 없고, CI 는 wrapper 와 독립적으로 이미 두 타겟을 각각 실행하므로 영향 없음을 확인했다. 다만 이 변경은 (a) `run-test.sh` 전 호출 경로(개발자 TEST WORKFLOW·`resolution-applier`)의 벽시계 비용을 ~4–5배(약 30–100s → 약 260s) 늘리고, (b) `resolution-applier` 의 최대 3회 e2e 재시도 예산을 최악 시 ~12–15분까지 늘리며, (c) 모든 worktree 의 기본 e2e 경로에 playwright 이미지 빌드/실행을 편입시켜 docker 리소스 사용 빈도를 늘린다 — 셋 다 `RUN_TEST_TIMEOUT`(기본 1800s) 여유 안에서 안전하고 기능적으로는 의도된 트레이드오프이므로 INFO 로 기록했다. rebase 로 결합된 main 의 #957(plan/spec grooming) 은 test-stages.sh/run-test.sh/CI 와 파일 수준 겹침이 없어 병합 충돌·의미 충돌은 발견되지 않았다.

## 위험도

LOW
