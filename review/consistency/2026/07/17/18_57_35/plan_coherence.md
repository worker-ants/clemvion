# Plan 정합성 검토 — `spec/4-nodes/3-ai/` (impl-done)

> 검토 모드: `--impl-done`, diff-base=`origin/main`. target 코드/스펙의 SoT 는 HEAD 워킹트리
> (`/Volumes/project/private/clemvion/.claude/worktrees/is-conversation-output-restructure-08f20e`) —
> 모든 판단은 이 워킹트리를 절대경로/`git -C`로 직접 재확인했다.

## 검토 방법

1. `git diff origin/main -- spec/4-nodes/3-ai/` 로 target 의 실제 변경분을 확정: `1-ai-agent.md`(+2줄, §7)와
   `3-information-extractor.md`(+2줄, §5.6) 두 곳에 `endReason` 값 도메인의 SoT 를 `@workflow/ai-end-reason`
   패키지로 지목하는 backlink 한 줄씩 추가된 것이 전부다.
2. 이 diff 가 브랜치 자신의 작업인지(vs. `origin/main` 이 독립적으로 앞서나간 노이즈인지) 를 분리하기 위해
   `git merge-base HEAD origin/main` → `d891694608f` (#962) 확인 후 `git diff <merge-base>..HEAD` 로 대조 —
   target 경로는 `origin/main` 이 merge-base 이후 전혀 건드리지 않아(`git log <merge-base>..origin/main --
   spec/4-nodes/3-ai/` 0건) 오염 없이 신뢰 가능.
3. target 의 근거 plan `plan/complete/is-conversation-output-restructure.md`(E-7) 전문을 읽고 diff 와 대조.
4. `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `pending_plans:` 가 지목하는 두 열린 plan
   (`ai-agent-tool-connection-rewrite.md`, `spec-drift-ai-agent-outport-countmax.md`) 을 직접 읽고 충돌 여부 판정.
5. `plan/in-progress/node-output-redesign/{ai-agent,information-extractor}.md` 를 `endReason` 키워드로 대조.
6. 이번 diff 로 함께 변경된 `plan/in-progress/**` 파일들(겉보기 회귀)의 원인을 `merge-base..HEAD` vs
   `merge-base..origin/main` 분리 diff 로 검증.

## 발견사항

### [INFO] endReason SoT 각주와 미해결 out-포트 drift 의 축 구분 — disambiguation 각주 미채택 (강제 아님)

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md:463` (§7, 신규 backlink) vs `:217` (§3.2, "Multi Turn 모드에는
  `out` 포트가 존재하지 않는다")
- 관련 plan: `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` Critical 1 (미해결, checkbox `[ ]`) —
  `1-ai-agent.md` §3.2 "out 포트 없음" 대 `_product-overview.md`(ND-AG-24) "조건 0개 시 out+error 제공(하위호환)"
  이 spec 내부에서 정반대로 서술된 항목. 실측 재확인: `spec/4-nodes/3-ai/_product-overview.md:84`,
  `spec/4-nodes/_product-overview.md:215` 모두 현재도 "하위 호환" 문구 보유 — **여전히 미해결**.
- 상세: 두 사안 모두 같은 실행부(`ai-turn-executor.ts` 등)의 `'out'` 리터럴을 다루지만 서로 다른 축이다 —
  spec-drift plan 의 미해결 사안은 **멀티턴에 `out` 포트가 존재하는가**(포트 구조, §3.2)이고, 이번 diff 의
  `'out'` 은 **단일턴 종결 시의 `endReason` 값**(값 도메인, §7 — `AiAgentEndReason` 유니온에는애초 `'out'`이
  없음, `codebase/packages/ai-end-reason/src/index.ts:63-64` 주석 "단일턴 종결(`'out'`)은 포함하지 않는다")이다.
  이번 diff 는 §3.2 를 전혀 건드리지 않았고, target 의 근거 plan(`is-conversation-output-restructure.md:304`)도
  "§3.2 는 대상이 아니다"를 명시적으로 결정했다 — **의도적 스코프 제외**이지 누락이 아니다. 이 판정은 구현
  착수 전 plan-coherence 사전검토(`review/consistency/2026/07/17/15_06_14/plan_coherence.md` §"(a-부속)")에서
  이미 "충돌 아님, INFO"로 확인된 바 있고, 그 리뷰가 "강제 아님"으로 제안한 disambiguation 각주(§7 에 "이
  `'out'` 은 spec-drift-ai-agent-outport-countmax.md Critical 1 의 포트 논쟁과 무관한 별개 축" 한 줄)는 실제
  구현(§7 L463)에 반영되지 않았다.
- 제안: 충돌이 아니므로 조치 불필요. 다만 두 문서가 같은 파일·같은 리터럴(`'out'`)을 다른 의미로 다루는
  상태가 지속되므로, `spec-drift-ai-agent-outport-countmax.md` Critical 1 이 나중에 처리될 때 그 작업자가
  §7 의 새 backlink 를 "이미 답이 나와 있다"고 오인하지 않도록 §7 L463 각주에 한 줄 disambiguation 을
  추가하는 것을 추적 메모로 권장(non-blocking).

### [WARNING] 브랜치가 origin/main 대비 5커밋 stale — target 은 무영향이나 병합 전 rebase 필요

- target 위치: 해당 없음 — `spec/4-nodes/3-ai/`(target) 자체는 이 이슈의 영향을 받지 않는다(아래 상세의
  실측대로 `origin/main` 이 merge-base 이후 이 경로를 전혀 변경하지 않음). 브랜치 전체의 diff-base
  신뢰성에 대한 caveat이며, 본 체크가 plan/in-progress/** 를 전수 대조하는 과정에서 발견됨.
- 관련 plan: `plan/in-progress/eia-context-schema-followups.md`, `plan/in-progress/exec-intake-followups.md`,
  `plan/in-progress/forced-coverage-gate.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`,
  `plan/in-progress/harness-session-anchor-guards.md`(origin/main 신설, 본 브랜치엔 부재),
  `plan/complete/harness-report-contract-followups.md`(origin/main 신설)
- 상세: `git merge-base HEAD origin/main` = `d891694608f`(#962, 2026-07-17 14:31 KST). 그 이후 `origin/main`
  은 독립적으로 5커밋(#963~#967, 최신 `e370d1d02` 18:02 KST) 전진했으나 본 브랜치(HEAD `4374ff5ce`, 18:30
  KST)는 그 5커밋을 반영(rebase/merge)하지 않았다. 그 결과 `git diff origin/main`(본 리뷰의 diff-base)
  기준으로 다음이 관측된다 — 단, 모두 `merge-base..HEAD` 실측으로 "본 브랜치의 실제 작업이 아니라
  origin/main 이 독립적으로 앞서 병합한 내용을 아직 반영 못한 것"임을 확인했다:
  - `plan/in-progress/eia-context-schema-followups.md` — "EventSource stub 공용 헬퍼 추출" 항목이
    `[x]`(완료, 상세 구현 설명 포함) → `[ ]`(미완료)로 **되돌아간 것처럼** 보인다. 실측: 이 파일은
    `merge-base..HEAD` diff 에 전혀 등장하지 않는다(본 브랜치는 손대지 않음) — origin/main 이 이 항목을
    완료 처리한 커밋이 본 브랜치엔 없을 뿐이다.
  - `plan/in-progress/harness-session-anchor-guards.md` — diff 상 198줄 전체 삭제로 표시. 실측:
    merge-base 에도 HEAD 에도 이 파일은 존재하지 않는다(`git cat-file -e` 확인) — origin/main 이 merge-base
    이후 **신설**한 파일이며, 본 브랜치가 "삭제"한 것이 아니다.
  - 나머지 3개 plan 파일도 동일 패턴(본 브랜치 미접촉, origin/main 단독 변경).
  - `merge-base..HEAD` 로 한정한 본 브랜치의 실제 plan/ 변경은 `plan/complete/is-conversation-output-restructure.md`
    신설 1건뿐이며, target 경로(`spec/4-nodes/3-ai/`)에 대해서도 `origin/main` 이 merge-base 이후 손댄 파일이
    0건이라 target 자체의 plan 정합성 판정은 이 stale 상태의 영향을 받지 않는다.
  - 이 상태로(rebase 없이) 병합하면 이미 `origin/main` 에 반영된 5개 PR(#963~#967)의 산출물을 **silent
    revert** 할 위험이 있다 — 팀 운영 기록에 이미 있는 실패 패턴("ensure-worktree stale base": 방금
    머지된 PR 미반영 시 stale base 로 PR 하면 머지 PR 을 silent revert, plan-coherence 검토에서 "이미
    해결된 사항이 미해결로 보임"이 단서)과 정확히 일치한다.
- 제안: PR 생성/병합 전 `git fetch origin && git rebase origin/main`(또는 동등한 동기화)을 수행해 stale
  base 를 해소할 것. target(`spec/4-nodes/3-ai/`) 자체의 plan 정합성 판정에는 영향 없으므로 이 문서의
  CRITICAL 판정 사유는 아니지만, 병합 전 반드시 조치가 필요한 항목이라 WARNING 으로 기록한다.

## 검증 완료 (충돌 없음 — 참고용)

- **frontmatter `pending_plans` 정합** — `1-ai-agent.md` 는 `ai-agent-tool-connection-rewrite.md`·
  `spec-drift-ai-agent-outport-countmax.md` 두 열린 plan 을 정확히 선언 중이고, 이번 diff 는 그중 어느 것도
  "결정 필요"로 남겨둔 항목(도구 연결 모델 a/b/c, out-포트 존재 여부)에 대해 일방적 결정을 내리지 않았다.
- **`ai-agent-tool-connection-rewrite.md`** — §1 디자인 결정 전부 `TBD`(미착수, `worktree: (unstarted)`).
  이번 diff 는 `tool_*`/Tool Area 관련 내용을 전혀 건드리지 않아 무관.
- **`node-output-redesign/{ai-agent,information-extractor}.md`** — `endReason` 언급은 전부 "현재 값이 spec 과
  이미 일치"라는 확인 서술이며, 값 자체를 추가/제거/재정의하려는 미해결(`[ ]`) 항목 0건. 이번 diff 의
  유니온 구성(`AiAgentEndReason` 4값, `InformationExtractorEndReason` 6값)과 충돌 없음.
- **`spec/conventions/interaction-type-registry.md` §4 backlink 대상 존재 확인** — target 의 두 신규 링크가
  가리키는 `#4-ai-노드-endreason--패키지가-sot-가드-비대상` 섹션은 동일 diff 로 신설되어 dangling 아님
  (`git diff origin/main -- spec/conventions/interaction-type-registry.md` 로 확인).
- **`plan/complete/is-conversation-output-restructure.md` E-7 이행 여부** — plan 이 지정한 위치(§7/§5.6, §3.2
  제외)와 diff 의 실제 위치가 정확히 일치.

## 요약

target(`spec/4-nodes/3-ai/`)의 실제 변경분은 `1-ai-agent.md`·`3-information-extractor.md` 각 2줄, `endReason`
값 도메인의 SoT 를 신설 패키지 `@workflow/ai-end-reason` 으로 지목하는 backlink뿐이며, 이는 방금 `complete/`
로 이동한 자체 plan(`is-conversation-output-restructure.md` E-7)을 정확히 이행한 결과다. frontmatter
`pending_plans` 가 지목한 두 열린 plan(`ai-agent-tool-connection-rewrite.md`, `spec-drift-ai-agent-outport-
countmax.md`) 중 어느 것의 미해결 결정도 이번 diff 가 우회하거나 선점하지 않는다 — 특히 spec-drift plan 의
멀티턴 `out`-포트 존재 여부 self-contradiction(§3.2, 여전히 미해결)은 이번 diff 가 다루는 `endReason` 값
도메인(§7)과 표면상 인접하지만 실제로는 다른 축이며, plan 스스로 §3.2 를 의도적으로 스코프 밖에 두었음을
명시했고 이는 구현 착수 전 plan-coherence 사전검토에서도 이미 "충돌 없음"으로 확인된 사안이다. `node-output-
redesign/**` 등 다른 plan/in-progress 문서에도 이 변경과 충돌하는 미해결 항목은 없다. 별도로, 본 리뷰 과정에서
브랜치가 `origin/main` 대비 5커밋 stale 함을 발견했다 — target 경로 자체는 이 stale 의 영향권 밖이지만(원본
확인 완료), 브랜치 전체를 그대로 병합하면 이미 origin/main 에 반영된 여러 plan/in-progress 후속 조치를 silent
revert 할 위험이 있어 병합 전 rebase 가 필요하다(WARNING, target 콘텐츠 문제 아님).

## 위험도

LOW
