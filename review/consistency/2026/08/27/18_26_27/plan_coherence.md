# Plan 정합성 Check — `spec/conventions/` (impl-done, doclink-guard-scope)

## 발견사항

- **[WARNING]** 새 governance 스코프가 `spec-link-integrity` 의 알려진 미해결 사각지대(멀티라인 링크)를 그대로 상속한다
  - target 위치: `spec/conventions/spec-impl-evidence.md:132` (§4.2 표 `spec-link-integrity.test.ts` 행 — 이번 PR 이 "**및 (3) 거버넌스 문서**(2026-08-27 추가)" 를 붙인 바로 그 셀). 구현: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 신규 `collectGovernanceMarkdown`/`findBrokenGovernanceLinks`(291~328행 부근) — `findBrokenLinksInFiles` → `extractLinks()` 를 그대로 재사용하며, `extractLinks()` 는 여전히 `text.split(/\r?\n/)` 로 줄 단위 스캔한다(105~111행).
  - 관련 plan: `plan/in-progress/harness-review-gate-followups.md` §미해결 항목 첫 번째 (44~62행, 2026-08-11 실측, 체크박스 `[ ]` 미해결) — `spec-link-integrity` 가 링크 텍스트가 `\n` 으로 갈라진 멀티라인 마크다운 링크를 **통째로 건너뛰며 침묵으로 통과**시킨다는 사실을 `spec/**.md` 134개 중 6개 파일에서 CommonMark 파서 대조 + 뮤테이션으로 이미 확정한 상태다("근본 해법은 `extractLinks()` 가 멀티라인 링크를 보게 하는 것"이라고 명시, 아직 미착수).
  - 상세: 이 PR 은 같은 `extractLinks()`/`findBrokenLinksInFiles` 코어를 재사용해 스캔 대상 코퍼스를 `spec/**.md` 에서 루트 `*.md` + `.claude/**.md` 로 넓혔다. 그런데 이 확장이 상속하는 결함을 실제로 확인했다 — `.claude/skills/code-review-agents/SKILL.md:121~122`, `.claude/skills/consistency-checker/SKILL.md:106~107` 에 정확히 그 패턴(링크 텍스트가 줄바꿈으로 쪼개진 후 `](...)` 로 닫히는 멀티라인 링크: `` [`report_paths.py`\nhas_report()`](../../_shared/report_paths.py) ``)이 실존한다. 이번엔 대상 경로가 존재해 우연히 무해하지만, `extractLinks()` 가 이 두 파일 모두 링크 존재/앵커 검증을 **건너뛴다**는 사실 자체는 변하지 않는다. 즉 PR 의 plan 체크리스트(`spec-sync-external-interaction-api-gaps.md`)가 적은 "실측: 58개 파일 / BROKEN 4건" 은 spec/**.md 에서 이미 한 번 증명된 것과 같은 이유로 **과소집계일 수 있다** — `harness-review-gate-followups.md` 의 미해결 항목이 정확히 이 위험을 예견했는데도, 이번 PR 은 그 항목을 참조하거나 업데이트하지 않고 코퍼스만 넓혔다. 신규 fixture(`spec-link-integrity.test.ts:149~154`)도 전부 단일 줄 링크만 검증해 이 사각지대를 재현하지 않는다.
  - 제안: (a) `plan/in-progress/harness-review-gate-followups.md` 의 해당 미해결 항목에 "governance 스코프(CLAUDE.md·PROJECT.md·.claude/**.md)도 동일 사각지대에 노출됨(2026-08-27 doclink-guard-scope 가 상속, 실증: code-review-agents/SKILL.md·consistency-checker/SKILL.md)" 을 추가해 대상 목록을 갱신하거나, (b) `spec-impl-evidence.md §4.2` 표의 scope(3) 서술에 "멀티라인 링크는 현재 미검증(추적: harness-review-gate-followups.md)" 캐비엇을 짧게 남긴다. 근본 수정(`extractLinks()` 멀티라인 지원)은 이 PR 범위 밖이라는 판단 자체는 타당할 수 있으나, 그 판단과 알려진 리스크를 문서에 남기지 않은 채 스코프만 넓힌 것이 갭이다.

- **[WARNING]** 이번 PR 이 두 번 편집한 바로 그 표 셀에 이미 지적된 오기(誤記)가 그대로 남았다
  - target 위치: `spec/conventions/spec-impl-evidence.md:132` — "plan-coherence-checker 가 담당하는 것은 `plan/**` **문서 내부**의 링크 위생이지 spec→plan 링크가 아니다 (2026-07-16 정정 ...)" 문장.
  - 관련 plan: `plan/in-progress/harness-review-gate-followups.md` §미해결 항목 두 번째 (64~76행, 2026-08-10 실측, 체크박스 `[ ]` 미해결) — "`spec-impl-evidence.md §4.2` 가 링크 위생 책임을 없는 곳에 돌리고 있다"는 제목으로, `plan_coherence` checker 의 실제 체크리스트(①미해결 결정 충돌 ②선행 plan 미해소 ③후속 항목 누락)엔 링크 검증이 전혀 없다고 지적하고 planner 턴으로 이 문장 수정을 요구한 상태다. 본 세션에서 `.claude/skills/code-review-agents/lib/role_instructions.py:249-256` 의 `plan_coherence` 정의를 직접 확인해 그 주장이 여전히 정확함을 재확인했다(링크 검증 항목 없음).
  - 상세: 이번 diff 는 정확히 이 문장이 속한 표 셀을 두 차례(원문 "**및 (2)**" → "**(2)**" 로 손질, 그다음 "**및 (3) 거버넌스 문서**" 추가) 편집했다. 리뷰 라운드 `17_52_44`(documentation W1)도 이 셀을 지적했지만 "scope 3 미반영" 만 잡았고, `harness-review-gate-followups.md` 가 2026-08-10 부터 추적해 온 "plan-coherence-checker 오귀속" 항목은 이번에도 반영되지 않았다. 같은 셀을 두 번 편집한 마당에 이 정정을 놓친 것은 후속 항목 누락에 해당한다 — 다음에 이 셀을 읽는 사람은 "plan-coherence-checker 가 plan/** 문서 내부 링크를 본다"는 틀린 문장을 여전히 신뢰하게 된다.
  - 제안: `spec/conventions/spec-impl-evidence.md:132` 의 해당 문장을 "plan/** 문서 내부 링크 위생은 현재 어떤 checker/가드도 전담하지 않는다"는 취지로 정정(또는 문장을 통째로 삭제)하는 planner 턴을 이 PR 에 얹거나, 최소한 `harness-review-gate-followups.md` 미해결 항목에 "doclink-guard-scope PR(#해당 커밋)이 같은 셀을 재편집했으나 이 정정은 미반영 — 재확인 필요" 라는 갱신 메모를 남긴다.

## 요약

이번 PR(`doclink-guard-scope`)이 건드린 `spec/conventions/` 유일한 변경 파일은 `spec-impl-evidence.md §4.2` 의 `spec-link-integrity.test.ts` 행 하나다. 그 행이 신설한 governance 스코프(3)는 코드 리뷰 두 라운드(`17_52_44`/`18_16_05`)에서 CRITICAL/WARNING 0으로 이미 수렴했지만, 두 라운드 모두 `plan/in-progress/**` 와의 교차 검증은 범위 밖이었다. 교차 검증 결과 같은 셀에 얽힌 두 개의 **선행 plan 미해소** 항목(`harness-review-gate-followups.md` 의 멀티라인 링크 사각지대·plan-coherence-checker 오귀속, 둘 다 2026-08-10/11 실측·아직 `[ ]`)이 발견됐다 — 특히 멀티라인 사각지대는 이 PR 이 신설한 governance 코퍼스(`code-review-agents/SKILL.md`·`consistency-checker/SKILL.md`)에 실제로 그 패턴이 존재함을 직접 확인해 이론이 아닌 실증 리스크로 격상된다. 두 건 모두 병합을 원천 차단할 결정 충돌은 아니지만(build 가드 자체는 정상 동작하고 이번에 드러난 4건 BROKEN 은 정정됨), PR 이 정확히 그 문제 지점을 두 번 편집하면서도 기존 추적 항목을 갱신하지 않았다는 점에서 plan 위생 관점의 WARNING 두 건으로 판단한다.

## 위험도

LOW
