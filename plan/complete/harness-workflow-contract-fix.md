---
title: 하네스 Workflow 계약 충돌·게이트 무력화 fix (P0·P1·P2)
worktree: harness-workflow-contract-e7bac4
started: 2026-07-17
owner: developer
status: in-progress
---

## 배경

PR #958(사용자 가이드 라우팅 fix) 진행 중 하네스 결함 5건이 드러났다. 공통점은
**안전 게이트가 조용히 약해지는데 아무도 모른다**는 것.

근거: `review/code/2026/07/17/{01_07_43,01_27_10,08_17_35}/`,
`review/consistency/2026/07/17/{00_21_55,00_32_57,01_25_26,07_03_34}/`,
workflow journal 실측(`subagents/workflows/wf_*/agent-*.jsonl`).

## P0 — Workflow sub-agent 계약 충돌 → BLOCK 거짓 음성

### 결함 사슬 (journal 실측)

1. **하네스가 sub-agent 의 report file Write 를 차단**한다:
   `"Subagents should return findings as text, not write report files. Include this
   content in your final response instead."` (tool_use_error). Workflow sub-agent 는
   "최종 텍스트가 반환값" 이라는 system prompt 도 받는다.
2. 그래서 checker 가 **Write 를 호출조차 안 하고**(실측 `Write호출=0`) 보고서를 텍스트로
   반환한다 — 프로젝트 `prompt_file`("output_file 에 Write, STATUS 만 반환")과 정면 충돌.
   모델이 매 호출 다르게 해소해 "비결정적 FS flakiness" 로 오진돼 왔다.
3. `.claude/workflows/{consistency-check,ai-review}.js` 의 `parseStatus` 가
   **`return m ? m[1] : 'success'`** — STATUS 줄이 없으면 success 로 간주 → 가짜 5/5.
4. 스크립트가 `{name,status}` 만 남기고 **반환된 findings 본문을 버린다** → 데이터 유실.
5. summary agent 는 각 checker 의 `output_file` 을 **Read** 해 통합한다 → 파일이 없으면
   그 checker 의 `[CRITICAL]` 을 **BLOCK 계산에서 누락**한다.

### 실질 피해

- **BLOCK 거짓 음성**: 2026-07-10 실측 — SUMMARY 는 `BLOCK: NO` 인데 journal 엔 해당
  checker 의 `[CRITICAL]` 이 있는 사례가 한 작업에서 3회. impl-done 은 SPEC-CONSISTENCY
  게이트라 전수 커버가 안전의 전제인데 그게 조용히 깨진다.
- **낭비**: 2026-07-17 세션이 이미 반환된 findings 를 모른 채 checker 10여 개 재실행.

### 방향 (사용자 결정: 최소 수정 — 스크립트만)

`.claude/workflows/*.js` 만 고친다. Python·agent 정의·prompt_file 은 불변.

- [x] `parseStatus` 기본값 `'success'` → `'no_status'`
- [x] checker/reviewer 프롬프트에 **summary 와 동일한 출력 규약** 적용 —
      Write 는 best-effort, **STATUS + delimiter + 전문**을 항상 반환
- [x] summary agent 에 각 checker 전문을 **인라인 전달** → 디스크 의존 제거
      (파일이 없어도 BLOCK 계산이 전수 근거 위에서 이뤄진다 = 거짓 음성 제거)
- [x] 파일 영속화 주체 결정 — **실험 `probe-write-block`(wf_61290a15-aec) 으로 확정**:

      | 시도 | 결과 |
      |---|---|
      | **비-terminal** agent → `SUMMARY.md` | **차단** |
      | **terminal** agent → `cross_spec.md` | **성공** |

      → **H(a) 확정: 차단은 파일명 기반이며 terminal 위치와 무관**하다. H(b) 반증.
      즉 (1) **어떤 agent 든 checker 파일은 쓸 수 있다**(terminal 인 summary agent 포함),
      (2) **어떤 agent 도 `SUMMARY.md` 는 못 쓴다** → main 의 멱등 Write 는 설계상 필수이며
      현행 SKILL §3 이 이미 옳다.
      **설계**: summary agent(terminal)가 인라인 전문을 받아 **누락된 checker 파일을 직접
      영속화**하고 SUMMARY 는 반환만 한다 → 별도 persist 단계 불요, main ctx 불변.
- [x] 76행 주석의 **정반대로 틀린** 전제 정정 — "terminal summary write is refused / parallel
      checkers (non-terminal) write fine" 은 메커니즘을 거꾸로 서술한다. 실제는 파일명 기반.
      이 오해가 "checker 는 잘 쓴다" 는 전제를 낳아 `parseStatus` 기본값 `success` 를 정당화했다.

> **main ctx 제약**: 스크립트가 checker 전문을 main 에 반환하면 ctx 가 폭증한다
> (5×7KB~14×7KB). 파일 영속화는 sub-agent 단계에서 끝내고 main 에는 summary_markdown 만
> 넘기는 현행 설계를 유지한다.

## P1a — `--impl-prep/--impl-done SCOPE` 무검증 → 가짜 BLOCK

`consistency_orchestrator.py:305` 이 인자를 검증 없이 프롬프트의 "Target 문서 `경로:`" 에
넣는다. scope 자리에 설명문을 주면 5개 checker 전원이 payload 손상을 CRITICAL 로 올려
**실제 충돌 0건인데 BLOCK: YES** 가 난다(2026-07-17 실측).

- [x] scope 가 실존 경로인지 검증 → 아니면 exit + 사용법. `--spec`/`--plan` 도 동일

## P1b — `agents_forced` 미강제 → 자가 판단으로 우회 가능

강제 화이트리스트인데 **강제하는 코드가 없다**. workflow 는 로그만 남기고
(`ai-review.js:157`), `--apply-routing` 은 router 결정 소비 시에만 반영한다. 직접 fan-out
경로엔 방어가 없어, 2026-07-17 세션의 security 누락이 **상태 동기화 중 우연히** 발각됐다
(그 diff 가 수정한 `buildWorkspaceHref` 는 open-redirect 방어 경계였다).

- [x] `--verify-coverage <session_dir>` 신설 — forced 중 산출물 없는 것 있으면 exit 1
- [x] workflow 반환에 `forced_missing[]` 추가 + log 로 노출
- [x] SKILL 에 SUMMARY 작성 전 호출 의무화

## P2 — 직접 fan-out 시 상태 기록 책임이 조용히 넘어옴

SKILL 이 fallback fan-out 을 허용하면서 `_retry_state.json` 갱신 책임이 main 으로
옮겨간다는 걸 말하지 않는다 → 7개 세션이 stale 로 커밋됐다. 이 파일은 `/loop --resume`
검증·`--summary-state` 분기의 SoT 다.

- [x] `--sync-from-disk <session_dir>` 신설 — 실제 산출물 기준으로 상태 일괄 동기화
- [x] SKILL(consistency-checker·code-review-agents)·`subagent-call-contract.md` 에 명시

## 검토에서 제외한 것 — review_guard 재무장 (의도된 동작)

리뷰 후 코드가 바뀌면 Stop 가드가 재무장하는 것은 **결함이 아니다**. 실제로 그 fix-cover
재리뷰가 진짜 문제 2건(CI job 명 오기·상태 파일 stale)을 잡았다. 약화 제안하지 않는다.

## 작업 체크리스트

- [x] 0. worktree (`EnterWorktree` 격리, base=origin/main 12ceee587)
- [x] 1. 근거 수집 — journal 실측으로 P0 근본원인 확정 (종전 "FS flakiness" 진단 반증)
- [x] 2. 차단 규칙 확정 실험 2건 → P0 설계 확정 (basename 기반·terminal 무관)
- [x] 3. `/consistency-check --impl-prep` — **해당 없음**. 본 변경은 `.claude/**`(하네스) 전용이고
      `spec/**` 를 건드리지 않으며 어떤 spec 의 `code:` glob 에도 매칭되지 않는다. consistency
      checker 는 spec/plan 정합을 보는 도구라 대상이 없다(SPEC-CONSISTENCY 게이트도 `codebase/**`
      기준이라 무발화). 대신 하네스 자체 테스트(`.claude/tests/`)가 이 계층의 안전망이다.
- [x] 4. DOCUMENTATION — `subagent-call-contract.md §7`(하네스 제약 실측표) 신설 +
      두 SKILL 의 "terminal write 가드" 틀린 서술 정정 + fallback 경로 책임 명시
- [x] 5-7. 구현 + 테스트 (신규 14건: sync-from-disk 4 · verify-coverage 4 · target 검증 6)
      - mutation 검증: 가드 무력화 시 5건 red → 복원 시 green (테스트가 진짜 가드임을 확인)
- [x] 8. TEST WORKFLOW — 하네스 215 OK · 프로덕트 unit PASS
      (e2e 면제: 변경 set 이 `.claude/**` + `plan/**` 뿐이라 `codebase/**` 무변경 →
       PROJECT.md §e2e 면제 화이트리스트 부분집합. docker 스택이 실행할 제품 코드가 없다.)
- [x] 9. REVIEW WORKFLOW — `/ai-review` (**수정한 workflow 로 자기 자신을 리뷰** = 실전 검증 겸함).
      결과 **HIGH · Critical 3 · Warning 10**. 전건 조치 (§리뷰 대응).
      부수 검증: `routing=done: 8 reviewers run, 6 skipped` (router 정상) · `8/8 usable` ·
      `forced_missing=[]` · `recovered=[]` — 새 집계가 실제로 동작함을 라이브로 확인.

## 리뷰 대응 (review/code/2026/07/17/11_50_37)

| # | 지적 | 판정 | 조치 |
|---|---|---|---|
| C1 | `merge-coordinate.js` 에 동일 P0 결함 잔존 — 통합 게이트라 동급 이상 안전-critical | **타당** | 3번째 파이프라인에도 동일 적용(shared block·인라인 전달·`has_report`/`recovered`). "스크립트만" 범위 안이고, 같은 거짓 음성을 merge 게이트에만 남길 이유가 없다 |
| C2 | `orchestrator-workflow-migration.md` 의 정반대 "CORRECTED diagnosis"(bgIsolation·filename 무관)와 §7 이 조정 없이 공존 — 5월에 기각된 가설의 재탕 아닌가 | **부분 타당 — 조사 결과 둘 다 옳다** | **가드가 둘**이다: ① bgIsolation(부모 미격리 bg 세션 → 전 write 차단, 파일명 무관) ② report-file(basename). 5월 probe 는 ①이 활성인 세션이라 **파일명 규칙을 관측할 수 없었다** — "filename is irrelevant" 는 교란된 결론. 본 실측은 `EnterWorktree` 격리 세션이라 ②가 드러난다(같은 세션에서 `notes.md` 성공 / `SUMMARY.md` 차단). **양 문서에 상호 참조 + 실측 조건(격리 여부) 명기**로 조정. 5월이 옳게 지적한 context-cost 는 유효 → 전문은 main 이 아니라 **summary sub-agent 에만** 인라인 전달(main 반환엔 `{name,status,has_report}` 뿐) |
| C3 | 핵심 파싱 로직에 자동 테스트 0건 + CI paths 에 `.claude/workflows/**` 없음 + 두 파일 바이트 중복 | **타당** | 리뷰어의 처방(모듈 추출→import)은 **이 샌드박스에서 구현 불가**임을 실측: 정적 `import`→SyntaxError, 동적 `import()`→"not available in workflow scripts". 그래서 **canonical `_lib/agent-return.mjs`(테스트 대상) + 3 워크플로가 마커 블록을 verbatim 미러 + drift guard 테스트** 로 해결. `node --test` 유닛 11건 + CI paths·step 추가 |
| W3 | plan 세부 체크박스가 미체크로 커밋 — 완료 여부의 단일 진실을 흐림 | **타당** | P0~P2 세부 항목을 실제 상태로 정정 |
| W1 | 신규 CLI 가 `code_review_orchestrator.py` 에만 있는데 consistency SKILL 이 이웃 스크립트를 호출하게 안내 — 스키마 호환이 우연 | **수용(현행 유지)** | 두 orchestrator 의 `_retry_state.json` 스키마는 동일 계보이고 `--sync-from-disk` 는 `subagent_invocations` 만 읽는다. 공용 `_lib` 승격은 두 스킬의 기존 "완전 복제" 컨벤션을 바꾸는 별개 결정 → 후속. 지금은 동작이 실측 확인됨 |
| W2 | 신규 안전장치가 hook 미연결 — 산문 의무는 압력 앞에 무너진다(이 PR 을 촉발한 사고와 동형) | **부분 조치 · 후속** | Workflow 경로는 `forced_missing[]` 을 **구조적으로 계산**해 반환(산문 아님). fallback 경로의 hook 강제는 `review_guard` 를 건드려야 해 blast radius 가 크다(기존 세션 전부 재평가) → 별도 판단 필요 |

### 발견한 부수 결함 — `node --check` 는 이 파일들의 유효한 게이트가 아니다

워크플로 스크립트는 `export const meta`(ESM 전용)와 top-level `return`(CJS 전용)을 **동시에**
가져 어느 모듈 종류로도 유효하지 않다. 그래서 `node --check` 가 **중복 `const` 조차 exit 0** 으로
통과시킨다(일반 파일에선 정상 검출됨을 대조 확인). 실제로 이번 블록 주입 때 `usable` 이 두 번
선언됐는데 `node --check` 는 OK 를 줬다 — 이 PR 이 고치는 **false green 과 같은 클래스**다.
→ 하네스 VM 의 async 래핑을 재현해 파싱하는 검사를 `test_workflow_scripts.py` 에 고정하고,
그 검사가 vacuous 하지 않음을 자체 sabotage 테스트로 증명한다.
