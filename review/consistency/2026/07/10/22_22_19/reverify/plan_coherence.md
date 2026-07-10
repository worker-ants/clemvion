# Plan 정합성 재검증 (reverify) — `spec/data-flow/7-llm-usage.md` (--impl-done)

## 조사 메모

`git diff origin/main...HEAD --stat` 로 이번 라운드(직전 회차 이후) diff 범위를 재확인: 직전 회차(`review/consistency/2026/07/10/22_22_19/plan_coherence.md`)가 지적한 INFO 이후 추가된 커밋은
`6303a2190`("fix(ai): 최종 리뷰 반영 — resume attribution 회귀 테스트 + §1.3 spec drift 정정") 1건뿐.
이 커밋은 (1) `ai-agent.memory.spec.ts`/`ai-memory-manager.spec.ts` 에 resume-path·forwarding 회귀
테스트 추가, (2) **`spec/data-flow/7-llm-usage.md` §1.3 4개 위치(L107/L113/L162/Rationale) 실제
정정**, (3) 두 plan 문서(`ai-usage-attribution-hardening.md` 신규 87행, `resume-llm-usage-attribution.md`
+15/-4행) 갱신을 포함한다. target(`spec/data-flow/7-llm-usage.md`) 자체가 이번엔 diff 에 포함돼
있어(이전 회차와 다름) target 원문을 절대경로로 Read 해 plan 의 서술과 1:1 대조했다.

## 임무별 확인 결과

**1. `ai-usage-attribution-hardening.md` SPEC-DRIFT 절 갱신** — 확인됨.
- 절 제목이 "SPEC-DRIFT (본 PR 에서 해소 — 최종 consistency CRITICAL 반영)" 로 갱신, §1.3 4개 위치가
  전부 `[x]` 체크. `spec/data-flow/7-llm-usage.md` 를 Read 해 L107(표 행)·L113(콜아웃)·L162(§4 표)·
  Rationale "(b)" 항이 실제로 "미배선/전부 NULL" → "채움(단발 `context.*`/resume `state.*`)" 으로
  정정돼 있음을 확인 — plan 서술과 정확히 일치.
- §변경 세트의 SPEC 항목·§테스트 항목(`ai-agent.memory.spec`/`ai-memory-manager.spec` 신규 테스트)을
  `git diff origin/main...HEAD -- codebase/backend/src/nodes/ai/ai-agent/{ai-agent.memory.spec.ts,ai-memory-manager.spec.ts}`
  로 직접 대조 — 서술된 테스트 내용(코멘트 문구·assertion 대상 3필드)이 실제 diff 와 일치.
- §워크플로의 `/ai-review (최종)` MEDIUM/Critical 0, `/consistency-check --impl-done (최종)` 최초
  BLOCK:YES→재검증 BLOCK:NO 서술도 `review/code/2026/07/10/22_22_19/SUMMARY.md`,
  `review/consistency/2026/07/10/22_22_19/SUMMARY.md` 내용과 일치.

**2. `resume-llm-usage-attribution.md` 구 A5 항목 이관 서술** — 확인됨, 상호 일관.
- §"잔여 follow-up" 5번째 불릿이 `[x]` 로 "PR `ai-usage-attribution-hardening` = B1+C1 배선 후
  필수 → 그 PR 에서 완료" 로 기록. `ai-usage-attribution-hardening.md` 는 "§1.3 memory-row 정정(구
  A5)이 **본 PR 로 이동**" 이라 서술 — 두 문서 모두 "PR-1(`ai-usage-attribution-hardening`)에서
  해소"라는 동일 사실을 가리켜 **모순 없음**(한쪽은 "PR-2 필수", 다른 쪽은 "본 PR 해소" 로 갈리는
  이전 우려 해소).

**3. 진행 중 다른 plan 과의 충돌·후속 누락** — CRITICAL/WARNING 급 없음. 다음 저위험 항목만 확인:
- `plan/in-progress/node-output-redesign/ai-agent.md` 는 `ai-turn-executor.ts` 의 약 23개 `:라인번호`
  인용(`:1209`~`:2940`, 2026-06-25 재확정분)을 갖고 있는데, 이번 diff 가 그 파일의 1159행 부근에
  +6행, 2293행 부근에 +7행(누적 +13), 2596행 부근에 +2행(누적 +15) 을 삽입해 해당 인용들이 모두
  6~15행씩 밀렸다. 내용 자체의 모순(결정 우회)은 아니고, 이 plan 문서는 스스로 "6차 갱신" 같은
  주기적 전수 재검증 관행을 갖고 있어 다음 재검증 때 자연 정정될 사안이다 — 차단 사유 아님(§발견사항
  INFO#1 참고). `resume-llm-usage-attribution.md`/`ai-usage-attribution-hardening.md` 가 건드리지
  않는 `information-extractor.handler.ts` 를 인용하는 `node-output-redesign/information-extractor.md`
  는 영향 없음.
- `rag-dynamic-cut.md`/`rag-quality-improvement.md`/`spec-sync-mcp-client-gaps.md` 는 agent-memory·
  `llm_usage_log` 를 언급하지만 이번 PR 이 배선한 요약 압축 attribution 영역과 겹치는 미해결 결정은
  없음(충돌 없음).

**4. 직전 INFO(A1~A4 라벨) 해소 여부** — 해소 확인. `ai-usage-attribution-hardening.md` 가 이제
"PR-2(A-track)에는 §1.3 memory-row 정정(구 A5)이 **본 PR 로 이동**했으므로 나머지 A1~A4(인접 문서
6-knowledge-base.md·13-agent-memory.md·7-statistics.md·9-user-profile.md·1-data-model.md·
4-execution-engine.md §7.4 등)만 남는다" 로 명시 — `resume-llm-usage-attribution.md` §"잔여
follow-up" 의 실제 4개 미해결 불릿(A1~A4)과 파일 단위로 정확히 대응한다. 직전 회차가 지적한
"A1~A4 라벨이 5번째 항목을 반영하지 않는다"는 INFO 는 완전히 해소됐다.

## 발견사항

- **[INFO] `node-output-redesign/ai-agent.md` 의 `ai-turn-executor.ts` 라인 인용이 이번 diff 로 밀림**
  - target 위치: (간접) `plan/in-progress/node-output-redesign/ai-agent.md` — `ai-turn-executor.ts:1209`
    ~`:2940` 범위의 약 23개 라인 인용(2026-06-25 재확정분)
  - 관련 plan: `plan/in-progress/ai-usage-attribution-hardening.md` C1 이 `ai-turn-executor.ts` 의
    1159행 부근(+6)·2293행 부근(+7, 누적 +13)·2596행 부근(+2, 누적 +15) 에 `llmContext` 배선 코드를
    삽입
  - 상세: 삽입 지점 이후를 인용하는 `node-output-redesign/ai-agent.md` 의 라인 번호(예:
    `executeSingleTurn` `:1209`/`:1439`, `buildMultiTurnFinalOutput` `:2606-2745`, `MAX_TURN_DEBUG_HISTORY`
    `:2412` 등)가 실제로는 6~15행씩 어긋난다. 서술 내용 자체(예: single-turn try/catch 미적용,
    memory 필드 config echo 누락)는 이번 diff 와 무관해 여전히 유효하지만, 라인 좌표만 stale.
  - 제안: 차단 사유 아님. `node-output-redesign/ai-agent.md` 는 자체적으로 "N차 갱신(코드 재검증)"
    주기적 갱신 관행을 갖고 있으므로 다음 재검증 pass 에서 자연 정정 가능. 급하면 이번 PR 의
    developer 가 해당 plan 파일의 `ai-turn-executor.ts` 관련 라인 번호만 일괄 보정해도 저비용.

- **[INFO] §워크플로의 "RESOLUTION.md 작성" 이 현재 커밋 시점엔 아직 파일로 존재하지 않음**
  - target 위치: `plan/in-progress/ai-usage-attribution-hardening.md` §워크플로 마지막 두 항목
    ("`/ai-review (최종...)` ... RESOLUTION.md 작성.", "`/consistency-check --impl-done (최종...)`
    ... RESOLUTION.md 작성.")
  - 관련 plan: 없음(같은 plan 파일 내부 자기서술 vs 실제 파일시스템 상태)
  - 상세: `review/code/2026/07/10/22_22_19/` 와 `review/consistency/2026/07/10/22_22_19/` 두 디렉터리
    모두 현재 `RESOLUTION.md` 가 없다(둘 다 `git status` 상 untracked — 프로젝트 관행상 `review/**`
    는 최종 커밋 단계에서 한 번에 커밋됨). `[x]` 체크와 "작성" 완료 서술이 실제 산출물보다 살짝
    앞서 있다. 이번 reverify(본 checker 포함)가 BLOCK:NO 로 마무리되면 뒤이어 RESOLUTION.md 가
    생성되고 review/** 전용 커밋으로 종결될 것으로 예상되는 정상 워크플로 순서상의 일시적 상태다.
  - 제안: 차단 사유 아님. RESOLUTION.md 생성 + review/** 커밋을 이번 라운드 종결 전에 실제로
    수행해 plan 의 "작성 완료" 서술을 사실과 맞추면 된다(통상 진행되는 절차이므로 별도 조치 불필요
    할 가능성 높음 — 확인 차 기록).

## 요약

이번 reverify diff(`6303a2190` 1개 커밋)는 직전 회차(22_22_19)가 낸 유일한 INFO("SPEC-DRIFT 절의
A1~A4 라벨이 신규 5번째 항목을 반영하지 않음")를 정확히 해소했다 — `ai-usage-attribution-hardening.md`
가 "구 A5 가 본 PR 로 이동, 나머지 A1~A4만 남는다"고 명시했고, `resume-llm-usage-attribution.md`
의 해당 불릿이 `[x]`로 "그 PR 에서 완료" 로 기록돼 두 plan 간 이관 서술이 완전히 상호 일관하다.
target `spec/data-flow/7-llm-usage.md` §1.3 4개 위치(L107/L113/L162/Rationale)도 plan 이 주장하는
대로 실제 정정돼 있음을 원문 대조로 확인했다. 미해결 사용자 결정을 우회하거나 선행 plan 을 무시하는
CRITICAL/WARNING 급 문제는 없다. 저비용 polish 성격의 INFO 두 건만 남는다 — (1) 이번 diff 가
`ai-turn-executor.ts` 에 삽입한 코드로 `node-output-redesign/ai-agent.md` 의 기존 라인 인용
23개가량이 6~15행 밀렸으나 내용 자체는 무효화되지 않았고 그 plan 은 주기적 라인 재확정 관행을
갖고 있어 자연 해소 가능, (2) §워크플로가 "RESOLUTION.md 작성"을 완료로 서술하지만 review/**
디렉터리엔 아직 파일이 없다(관행상 최종 review/**-only 커밋에서 생성 예정인 정상 순서).

## 위험도

LOW
