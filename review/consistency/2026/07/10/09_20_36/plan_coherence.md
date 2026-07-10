# Plan 정합성 검토 — spec/5-system/4-execution-engine.md 외 2건 (docs-only)

검토 대상 diff (uncommitted, working tree): `spec/5-system/4-execution-engine.md` (§1.3 two-channel +
usage-log attribution invariant, §10.3/§10.4 renumber, §5.1/§5.3 convention 표기 정정, §2.1 fan-out
note, Rationale #501 addendum), `spec/4-nodes/3-ai/1-ai-agent.md` (§7.4 재유도 2채널 명문화, pending_plans
정리), `spec/4-nodes/3-ai/3-information-extractor.md` §5.4.

## 발견사항

- **[WARNING]** target 이 이미 코드로 반영된 `PR #879`(task_1543860b)를 문서화하면서, 그 작업 원본인
  `plan/in-progress/resume-llm-usage-attribution.md`(git 이력상 이미 `#879` 로 병합됨) 의 "잔여
  follow-up" 4번 항목을 실질적으로 완결시키는데 그 plan 파일 체크리스트는 갱신되지 않는다
  - target 위치: `spec/5-system/4-execution-engine.md:167` (§1.3 "credential / context-binding 필드는
    미동봉이며 ... 재개 시 **두 재유도 채널**로 재구성된다 — **조작 필드**...는 `node.config` 재평가로,
    **식별 필드**...는 **호출측 컨텍스트**...에서 재유도한다") 및
    `spec/4-nodes/3-ai/1-ai-agent.md:717,720` (§7.4 "context-binding 필드 재유도(조작 필드=`node.config`
    재평가 / 식별 필드 `workflowId`·`nodeExecutionId`·`workspaceId`=호출측 컨텍스트)")
  - 관련 plan: `plan/in-progress/resume-llm-usage-attribution.md:68-70` — "잔여 follow-up" 4번:
    `spec/5-system/4-execution-engine.md §7.4 재구성 설명 + spec/4-nodes/3-ai/1-ai-agent.md §7.4 —
    credential/context-binding 2분류 서술에 3번째 "턴 가변 식별자(nodeExecutionId, caller opts 전달,
    node.config 재유도 불가)" 문구 추가` — 체크박스 `[ ]` 미해결 상태로 남아 있음
  - 상세: `git log` 확인 결과 `79669505c`(`#879`, "fix(ai): resume 턴 llm_usage_log attribution 소비
    사이트 교정") 커밋이 이미 이 branch 의 조상 이력에 포함돼 있고, 그 커밋이
    `plan/in-progress/resume-llm-usage-attribution.md` 를 신설한 당사자다. 그 plan 문서의 "잔여
    follow-up" 절 4개 항목(§data-flow/6-knowledge-base.md 문구 정정·§7-statistics.md 캐비어트 재검토
    ·§1-data-model.md 서브섹션 신설·**§7.4 2분류→3분류 문구 추가**)은 모두 `[ ]` 미해결로 남겨져 있는데,
    이번 target diff 가 정확히 4번째 항목의 실체(조작 필드 vs 식별 필드 2채널 구분 문구)를 §1.3(엔진)과
    §7.4(ai-agent, 실제로는 line 633-724 구간이라 plan 이 지목한 §7.4 위치와 일치)에 이미 채워 넣었다.
    이 PR 은 plan 파일을 건드리지 않으므로(문서 확인: 코드/CHANGELOG/plan 파일이 change set 에 없음),
    병합 후에도 `resume-llm-usage-attribution.md` 는 해당 항목을 계속 "미해결"로 표시하게 되어, 향후
    이 plan 을 마무리하는 사람이 이미 끝난 항목을 다시 착수하거나 — 반대로 plan 을 그대로 `complete/`
    로 이동시키면서 나머지 3개 미해결 항목(knowledge-base/agent-memory 문구 정정, statistics/user-profile
    캐비어트, LlmUsageLog 서브섹션)까지 덩달아 묻힐 위험이 있다.
  - 제안: 이 target PR 이 plan 파일을 다루지 않기로 한 범위 결정(CONTEXT)을 유지한다면, 최소한 후속
    커밋/PR 로 `plan/in-progress/resume-llm-usage-attribution.md` 의 4번째 잔여 follow-up 항목을
    `[x]`로 체크하고 이번 PR(또는 task 식별자)을 근거로 남기는 정리가 필요하다. 이 plan 파일 자체가
    이미 `#879` 로 병합된 내용을 담고 있으면서도 `plan/in-progress/`에 남아 checklist 마지막 항목
    ("PR (push + gh pr create)")이 `[ ]` 인 상태이므로, 이번 기회에 plan lifecycle 정리(체크리스트
    갱신 또는 `plan/complete/` 이동 여부 판단)를 함께 고려할 것을 권장한다.

- **[INFO]** `plan/in-progress/resume-llm-usage-attribution.md` 자체의 plan-lifecycle 드리프트 (target
  변경과 직접 관련은 없으나, 위 WARNING 판단의 배경이므로 기록)
  - 위치: `plan/in-progress/resume-llm-usage-attribution.md` (frontmatter `worktree:
    elastic-shannon-e52824`, `branch: claude/ie-resume-llm-attribution-c82918`)
  - 상세: 이 plan 문서의 "변경 세트"·"테스트"·"워크플로 체크리스트" 항목은 대부분 `[x]`이고, 그 커밋이
    이미 이 브랜치 조상 이력의 `79669505c`(`#879`)로 병합되어 있음이 `git log`로 확인된다. 그런데
    "워크플로 체크리스트"의 마지막 항목 `PR (push + gh pr create)`은 여전히 `[ ]`이고 문서 자체가
    `plan/in-progress/`에 남아 있다 — 이미 병합된 작업의 plan 문서가 완료 이동되지 않은 상태.
  - 제안: 본 target PR 범위는 아니지만, plan lifecycle 정리(빠른 시일 내 `plan/complete/` 이동 또는
    체크리스트 최종화) 필요성을 기록으로 남긴다. `.claude/docs/plan-lifecycle.md` 절차 참고.

## 확인 완료 (문제 없음, 참고용)

- **pending_plans 정리 정합**: `spec/5-system/4-execution-engine.md`·`spec/4-nodes/3-ai/1-ai-agent.md`
  frontmatter 에서 제거된 `plan/in-progress/exec-park-durable-resume.md` 참조는 해당 plan 이 실제
  `plan/complete/exec-park-durable-resume.md` 로 이미 이동 완료된 상태와 일치한다. 잔존
  `execution-engine-residual-gaps.md`(G2 defer 확정, 사용자 결정 2026-07-03) · `exec-intake-followups.md`
  (완료 후속 잔여만 추적)는 이번 target 변경(§1.3/§2.1/§5.1/§5.3/§10.3-10.4)과 무관해 충돌 없음.
- **port `string | string[]` 표기 정정**은 새 결정이 아니라 이미 확정된
  `spec/conventions/node-output.md` Principle 5("port 활성화 모델: undefined / string / string[]")를
  `NodeHandlerOutput` 인터페이스 정의(§5.1)·Port Selector 패턴(§5.3)에 뒤늦게 반영한 것 — 미해결 결정
  우회가 아니다. `plan/in-progress/node-output-redesign/` 어떤 노드 문서도 이 원칙을 "결정 필요"로
  남겨두지 않았다.
- **§10.3/§10.4 헤딩 넘버링 재배치**는 `plan/complete/fix-resume-turn-usage-log-attribution.md`의 외부
  follow-up `task_0d2f2342`("§10.3/§10.4 헤딩 넘버링 드리프트(pre-existing)")를 그대로 해소한 것으로
  선행 plan 과 완전히 일치한다. 다른 in-progress plan/spec 은 `#103-호출-순서` / `#104-fallback-degraded`
  앵커를 참조하지 않아 링크 파손도 없다.
- **Rationale #501 addendum 이 인용하는 `PR #877`/`PR #879`**는 모두 이 브랜치의 커밋 조상 이력에 실존
  확인(`591cdee72`→`79669505c`→...→`01e68001c`). "코드는 이미 정합"이라는 target 의 주장은 사실과
  부합하며, 이는 완료된 `plan/complete/fix-resume-turn-usage-log-attribution.md`와도 정합한다(prompt
  CONTEXT 서술과 일치).
- `plan/in-progress/ai-agent-tool-connection-rewrite.md`(도구 연결 재설계, 5개 "결정 필요" 항목)는
  이번 target 변경과 겹치는 표면이 없다 — `_resumeState` 복잡도 증가 리스크를 언급하는 1줄(§리스크)만
  존재하고 이번 diff 의 재유도 채널 구분과 상충하지 않는다.
- `plan/in-progress/node-output-redesign/{ai-agent,parallel}.md` 등 "결정 필요" 오픈 항목(single-turn
  에러 컨트랙트, `branches[i]` allSettled envelope 등)은 이번 target 변경 범위 밖.

## 요약

이번 target 은 `plan/complete/fix-resume-turn-usage-log-attribution.md`의 외부 follow-up
(`task_0d2f2342`)을 그대로 이행하는 순수 문서 정합화이며, 인용하는 코드 fix PR(#877/#879)도 실제
커밋 이력과 일치해 미해결 결정을 우회하거나 선행 plan을 무시하는 부분은 없다. 다만 target 의 §1.3/§7.4
"두 재유도 채널" 문구는 아직 `plan/in-progress/resume-llm-usage-attribution.md`가 미해결(`[ ]`)로
추적 중인 잔여 follow-up 4번 항목의 실체를 완결시키는데도 그 plan 문서가 갱신되지 않아, 완료 여부에
대한 추적 정합성 갭이 하나 남는다(WARNING). 그 외에는 pending_plans 정리, 헤딩 재배치, port 타입 표기
모두 이미 결정되었거나 완료된 선행 작업과 정확히 일치해 구조적 위험은 낮다.

## 위험도

LOW
