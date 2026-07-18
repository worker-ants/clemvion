# 신규 식별자 충돌 검토 — spec-draft-ai-nodes-drift-disposition.md

## 검토 범위
target: `plan/in-progress/spec-draft-ai-nodes-drift-disposition.md` (spec draft, 순수 spec 정정 — 코드 변경 없음)
spec_impact 4-nodes/3-ai 5개 파일 + 4-nodes 루트 1개 파일 대상.

target 은 신규 요구사항 ID·엔티티·endpoint·이벤트·ENV var 를 **부여하지 않는다** — 기존 `ND-AG-24` 문구
정정(항목1), 기존 caveat 삽입(항목2·3), 기존 헤더의 parenthetical 제거(항목4) 뿐이다. 따라서 6개 관점 중
1~5(ID/엔티티/endpoint/이벤트/ENV)는 코퍼스 검증 결과 신규 발급이 없어 해당 없음(NONE)이며, 아래 2건은
6번 관점(파일/식별자 경로)에 인접한 실질적 갭이다.

## 발견사항

- **[WARNING]** 항목 1 disposition 이 기존 durable 추적 앵커 `spec-drift-ai-agent-outport-countmax.md` 의
  Critical-1 을 참조·종결하지 않음 (동일 요구사항이 두 문서에서 다른 상태로 존재)
  - target 신규 식별자: 항목 1 의 disposition 결정("§3.2 를 정본으로 확정, `_product-overview.md` 의
    ND-AG-24 '하위호환 out' 문구 삭제") — Edit 2a 로 `1-ai-agent.md` frontmatter `pending_plans` 에는
    `plan/in-progress/node-output-redesign/ai-agent.md` 만 추가됨.
  - 기존 사용처: `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` (`worktree: (unstarted)`,
    2026-07-16 생성, 아직 `plan/in-progress/`에 존재 — 최신 커밋 `f8c334947` 이후 미변경 확인)
    "## Critical 1 — Multi Turn `out` 포트 유무가 요구사항 vs 기술 spec 정반대" 섹션(라인 15-19)이
    체크박스 `- [ ]` (미해결)로 **정확히 동일한 항목**을 이미 추적 중: "`1-ai-agent.md:216` out 없음"
    vs "`_product-overview.md:84`/`4-nodes/_product-overview.md:215` ND-AG-24 하위호환 out" 모순, 처분
    옵션 "(a) 기술 spec 이 맞으면 두 `_product-overview.md` 의 하위호환 문구 삭제" — target 의 항목 1 이
    수행하는 바로 그 disposition.
  - 상세: target 문서가 이 기존 tracker 를 전혀 언급하지 않는다. 항목 1 이 적용되면 실질적으로
    `spec-drift-ai-agent-outport-countmax.md` 의 Critical-1 이 해결되지만, 그 파일의 체크박스는 여전히
    `[ ]`(미해결)로 남아 `plan/in-progress/`에 방치된다. 이 파일 자신의 preamble 이 이미 "원래
    `ai-agent-tool-payload-budget-followups.md` 의 backlog 로만 적혀 있었으나 그 plan 이 complete 로
    이동하면서 durable 텍스트가 소실되어 consistency `plan_coherence` 가 **4회 연속 WARNING** 을 낸
    전력"을 자인하고 있다 — 동일 클래스의 "해결됐지만 앵커가 안 닫힌" 문제가 이번에도 재발할 위험이 이미
    문서화된 전례와 정확히 같은 패턴이다.
  - 제안: target frontmatter 또는 항목 1 본문에 `plan/in-progress/spec-drift-ai-agent-outport-countmax.md`
    를 명시적으로 cross-link 하고, 항목 1 적용과 같은 커밋에서 그 파일의 Critical-1 체크박스를 `[x]` 로
    닫아야 한다(Critical-2 는 이미 `✅ 해소`로 양쪽 다 닫히면 해당 plan 전체를 `plan/complete/` 로 이동
    가능). 두 문서 중 하나로 통합하거나 최소한 상호 참조를 추가해 동일 요구사항(ND-AG-24 disposition)에
    대해 하나의 SoT 앵커만 남긴다.

- **[WARNING]** 앵커 rename(`#5-응답-형식-규약-principle-11` → `#5-응답-형식-규약`) 갱신 목록이 실제
  참조 전수(4개 파일 10개 링크)보다 2건 적다 — 갱신 후에도 구 anchor 문자열이 잔존
  - target 신규 식별자: 단축 앵커 `#5-응답-형식-규약` (Edit 4a~4m, `0-common.md` 헤더 rename 에서 파생).
    Edit 4d~4m 이 갱신 대상으로 열거한 위치: `0-common.md:144` · `2-text-classifier.md:132,385` ·
    `3-information-extractor.md:15,183,266,597,721` · `1-ai-agent.md:461,979` = 정확히 10건(4개 파일).
  - 기존 사용처: 코퍼스 전체 grep 결과 구 anchor `#5-응답-형식-규약-principle-11` 을 참조하는 위치가
    실제로는 **12건**이다 — target 이 셈한 10건 외에 `plan/in-progress/node-output-redesign/ai-agent.md:198`
    과 `plan/in-progress/node-output-redesign/information-extractor.md:190` 이 동일 anchor 를 참조한다
    (둘 다 "LLM common wrapper ... [common.md §5](...#5-응답-형식-규약-principle-11) 의 정의" 문구).
  - 상세: target Rationale 의 검증 기준 "적용 후 `grep -c '응답-형식-규약-principle-11'` == 0" 이 리포에
    스코프 제한 없이 실행되면 **2 를 반환**해 검증이 실패한다(스코프를 `spec/4-nodes/3-ai/` 로 한정해야
    통과). 또한 `codebase/frontend/.../spec-link-integrity.test.ts` 주석에 따르면 이 빌드 가드는
    `plan/**.md` 를 링크 **소스**로 스캔하지 않는다("what plan-coherence-checker owns is link hygiene
    *inside* `plan/**` docs — not spec→plan links") — 즉 이 2건의 잔존 구식 anchor 는 빌드에서 자동
    검출되지 않고 조용히 dangling 상태로 남는다(문서 표시 텍스트엔 영향 없으나, 클릭 시 헤더가 사라진
    구 슬러그를 가리키게 됨).
  - 제안: Edit 4 목록에 `plan/in-progress/node-output-redesign/ai-agent.md:198` 과
    `.../information-extractor.md:190` 의 동일 anchor 참조 갱신을 추가하거나(mechanical, 표시 텍스트
    무영향), 검증 grep 명령에 `spec/4-nodes/3-ai/` 로 스코프를 명시해 "0" 판정의 전제를 명확히 한다.

## 요약
target 문서는 신규 요구사항 ID·엔티티·DTO·API endpoint·이벤트명·환경변수를 전혀 새로 발급하지 않으며,
기존 코드 SoT 문구로 spec 텍스트를 정정하는 순수 편집이라 위 5개 관점에서는 충돌이 발견되지 않았다.
다만 6번 관점(식별자/경로 일관성)에 인접한 2건의 갭을 확인했다 — (1) 항목 1 의 disposition 이 이미
`plan/in-progress/`에 존재하는 durable 추적 앵커(`spec-drift-ai-agent-outport-countmax.md` Critical-1)를
참조·종결하지 않아 동일 요구사항이 "해결됨"(target)과 "미해결"(기존 tracker) 두 상태로 동시에 존재하게
되고, 이는 이 저장소가 이미 한 차례 겪은 "dangling durable tracker" 문제의 재발 패턴이다. (2) 항목 4 의
앵커 rename 갱신 목록이 실제 참조 전수보다 2건 적어 `plan/in-progress/node-output-redesign/*.md` 에 구
anchor 가 조용히 잔존하며, 이 gap 은 기존 spec-link-integrity 빌드 가드로도 자동 검출되지 않는다. 두
항목 모두 시스템 오동작으로 직결되지는 않지만(문서·추적 정합성 문제), 방치 시 향후 세션의 재작업·혼선
비용이 실제로 발생할 개연성이 높다(전례 있음).

## 위험도
MEDIUM
