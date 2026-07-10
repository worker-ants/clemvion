# Cross-Spec 일관성 재검증 — spec/data-flow/7-llm-usage.md (§1.3/§4/Rationale 정정)

검토 모드: --impl-done 재검증, diff-base=origin/main, 코드/spec SoT=현재 워킹트리
(`/Volumes/project/private/clemvion/.claude/worktrees/ai-usage-attribution-hardening-358929`,
HEAD=`6303a2190`)

## 배경

직전 회차(`review/consistency/2026/07/10/22_22_19/cross_spec.md`)는 target §1.3(L107 표 행·L113
콜아웃)·§4(Agent Memory 행)·Rationale (b) 4곳이 AI Agent 자동 메모리 롤링 요약 압축 chat 의
`llm_usage_log` attribution 배선을 "미배선/전부 NULL/잔여 갭"으로 서술해 실제 코드(이번 PR 로 배선
완료)와 어긋나는 self-drift 를 WARNING 으로 보고했다. 이번 회차는 그 4곳을 정정한 diff
(`git diff origin/main -- spec/data-flow/7-llm-usage.md`)가 (a) target 문서 내부에서 일관되는지,
(b) 인접 spec 영역과 새로운 모순을 만들지 않는지 확인한다.

## 검증 절차

1. `git show HEAD:spec/data-flow/7-llm-usage.md` 로 정정된 §1.3 표 L107·콜아웃 L113·§4 Agent Memory
   행(L162)·Rationale (b)(L199-208) 를 읽고 상호 대조.
2. 인접 spec 문서 검색: `spec/data-flow/13-agent-memory.md`, `spec/data-flow/6-knowledge-base.md`
   ("모든 LLM 호출 적재" cross-ref 행), `spec/2-navigation/7-statistics.md`,
   `spec/2-navigation/9-user-profile.md §6.3`(알림 규칙 API), `spec/5-system/4-execution-engine.md`
   (L171 §7.4 불변식, L713, L1382-1384), `spec/5-system/17-agent-memory.md`,
   `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/5-system/7-llm-client.md`, `spec/data-flow/9-observability.md`
   에서 "메모리 롤링 요약 압축" / `usage_log` / `attribution` / `LlmCallContext` / `context NULL` 관련
   서술을 전수 grep.
3. target 문서 전체에서 잔존 stale 문구("미배선"/"잔여 갭"/"아직 배선") 재검색.

## 발견사항

이번 재검증에서 CRITICAL/WARNING 급 발견사항은 없다.

- **[INFO]** self-drift 해소 확인 — target 문서 내부 4곳이 서로 정합
  - target 위치:
    - §1.3 표 L107: AI Agent 자동 메모리 롤링 요약 압축 행 — "**채움**. 단발/첫 턴은 `context.*`,
      resume 턴은 재구성 `state.*` (AI Agent 메인 chat 과 동일 패턴)"
    - §1.3 콜아웃 L113: "AI Agent 자동 메모리 롤링 요약 압축 chat 도 노드 발 실행이므로 동일하게
      채운다 ... **잔여 NULL** 은 워크플로우 밖·non-node caller(`GraphExtractionService`·
      `RerankService` listwise·AgentMemory 추출 processor)뿐이다"
    - §4 L162 Agent Memory 행: "추출 processor chat(워크플로우 밖 — context NULL) + 롤링 요약 압축
      chat(노드 발 — context 채움: 단발 `context.*`/resume `state.*`)"
    - Rationale (b) L199-208: "(a) 워크플로우 밖 ... caller(`GraphExtractionService`·AgentMemory
      추출 processor)와 (b) `LlmCallContext` 가 아직 배선되지 않은 caller(`RerankService` listwise
      grading)뿐이다"
  - 상세: 4곳 모두 "AI Agent 메모리 롤링 요약 압축 = 채움(단발 `context.*`/resume `state.*`)" ·
    "잔여 NULL = `GraphExtractionService` + `RerankService` listwise + AgentMemory 추출 processor
    (3개, 워크플로우 밖 2개 + 미배선 1개)" 로 정확히 일치한다. Rationale (b) 목록에서 "AI Agent
    자동 메모리 롤링 요약 압축"이 제거되고 `RerankService` listwise grading 만 남은 것도 콜아웃의
    3-caller 잔여 NULL 목록과 정합(a-그룹 2 + b-그룹 1 = 3). 문서 전체 재검색(`미배선`/`잔여 갭`/
    `아직 배선`) 결과 잔존 stale 문구는 L207 "아직 배선되지 않은" 한 곳뿐이며 이는 이제 정확히
    `RerankService` listwise grading 만 가리켜 사실과 부합한다. 직전 회차 WARNING 은 해소됨.
  - 제안: 없음 (조치 불필요, 기록용).

- **[INFO]** 인접 영역과 신규 모순 없음 — cross-ref 문구는 attribution 완결성을 주장하지 않음
  - target 위치: 해당 없음 (target 자체 아님, 인접 문서 확인 결과)
  - 충돌 대상 후보로 지목된 문서: `spec/data-flow/13-agent-memory.md:231`, `spec/data-flow/6-knowledge-base.md:348`
    ("LLM Usage | cross-ref | 모든 LLM 호출은 `llm_usage_log` 적재 — `llm-usage.md`"),
    `spec/5-system/17-agent-memory.md`, `spec/4-nodes/3-ai/1-ai-agent.md:720`,
    `spec/5-system/4-execution-engine.md:171,713,1382-1384`, `spec/2-navigation/7-statistics.md`,
    `spec/2-navigation/9-user-profile.md §6.3`(알림 규칙 API), `spec/5-system/7-llm-client.md:429,438`,
    `spec/data-flow/9-observability.md:109,157`
  - 상세: 위 문서들은 모두 (1) "LLM 호출이 `llm_usage_log` 에 적재된다"(로깅 여부)만 주장하거나,
    (2) `ai_agent`/`information_extractor` **메인 chat**(노드 핸들러 직접 호출, provider-tool 포함)의
    attribution 재구성 불변식만 다루며(`4-execution-engine.md` §7.4·L713·L1382-1384), AI Agent 자동
    메모리 롤링 요약 압축 chat 의 attribution 완결/미완결을 독립적으로 단언하는 문서는 없다. 즉
    "적재 여부"(사실 — usage 는 이번 정정 전후 항상 기록돼 왔다)와 "attribution 필드 채움 여부"(이번
    정정 대상)는 서로 다른 층위라 모순이 성립하지 않는다. `9-user-profile.md §6.3`(알림 규칙 CRUD
    API)·`2-navigation/7-statistics.md`·`data-flow/9-observability.md` 는 `llm_cost`/통계 집계의
    쿼리·스키마만 다루고 caller 별 attribution 채움표를 재기술하지 않아 target 정정과 무관하다.
    인접 문서에 이번 정정과 충돌하는 stale 문구는 발견되지 않았으므로 PR 범위 밖 후속(PR-2) 대상도
    없다.
  - 제안: 없음.

## 요약

정정 diff 는 target 문서(`spec/data-flow/7-llm-usage.md`) 내부 4개 위치(§1.3 표 L107·콜아웃 L113·
§4 Agent Memory 행 L162·Rationale (b) L199-208)에서 "AI Agent 자동 메모리 롤링 요약 압축 = attribution
채움(단발 `context.*`/resume `state.*`)" · "잔여 NULL = `GraphExtractionService` + `RerankService`
listwise + AgentMemory 추출 processor 3개뿐" 을 정확히 일관되게 서술해, 직전 회차에서 지적한
self-drift WARNING 이 완전히 해소됐다. 인접 spec 영역(`13-agent-memory.md`, `6-knowledge-base.md`,
`5-system/4-execution-engine.md` §7.4/L713/L1382-1384, `5-system/17-agent-memory.md`,
`4-nodes/3-ai/1-ai-agent.md`, `2-navigation/7-statistics.md`, `2-navigation/9-user-profile.md` §6.3,
`5-system/7-llm-client.md`, `data-flow/9-observability.md`)을 전수 확인한 결과 이번 정정과 상충하는
서술은 없다 — 해당 문서들은 "usage 가 로깅되는지"(범위가 다른 사실)만 다루거나 메인 chat 경로의
불변식만 다뤄 메모리 압축 chat 의 attribution 완결 여부를 독립적으로 주장하지 않기 때문이다. 새로운
데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 충돌은 발견되지 않았다.

## 위험도

NONE
