# 문서화(Documentation) Review

대상: `chore(plan): in-progress grooming — 완료 3건 complete 이동 + research/ 신설 + sqitch-poc 흡수 (①~⑤)` (commit `ceaaf2d69`). 코드 변경은 없고 전량 `plan/**`·`spec/**`·`.claude/docs/**`·`CLAUDE.md`·`review/consistency/**` 및 테스트 파일 1개(주석만)로 구성된 문서화 전용 PR.

### 발견사항

- **[WARNING]** `spec/5-system/9-rag-search.md` 가 `status: partial` 을 유지하기로 한 이번 결정의 근거를 자기 문서의 `## Rationale` 에 남기지 않음 — 본 PR 이 스스로 생성한 consistency-check 가 이미 지적했으나 미반영
  - 위치: `spec/5-system/9-rag-search.md` frontmatter (`pending_plans: plan/in-progress/rag-dynamic-cut.md` → `rag-quality-improvement.md`), `## Rationale` 절 (L387-406)
  - 상세: 본 PR 이 함께 커밋한 `review/consistency/2026/07/16/23_36_57/convention_compliance.md` 는 정확히 이 지점을 WARNING 으로 지목했다 — "D1 의 `status: partial` 유지 판단이 `9-rag-search.md` 자신의 `## Rationale` 절에는 기록되지 않음… CLAUDE.md '정보 저장 위치' 표 — 결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`" 위반. 실측 결과(`grep -n "status: partial\|왜.*partial" spec/5-system/9-rag-search.md`) 현재도 해당 bullet 이 없다. 같은 커밋에서 처리한 동형 결정 2건(`10-parallel.md` 의 waitAll 마이그레이션 미시행 결정, `11-mcp-client.md` 의 §3.3 won't-do 결정)은 각각 본문 인접 절과 `### R-wontdo-cached-capabilities` Rationale 전용 절을 새로 만들어 근거를 정확히 기록했다 — 같은 PR 안에서 세 가지 유사 결정 중 하나만 SoT 원칙을 놓친 불균형이다. `9-rag-search.md` 는 이미 "- **왜 X 인가**: …" 형식의 Rationale bullet 15개를 촘촘히 쓰는 문서라, 형식만 따르면 되는 낮은 비용의 누락이다.
  - 제안: `9-rag-search.md ## Rationale` 에 "- **왜 `rag-dynamic-cut` 종결 후에도 `status: partial` 을 유지했나 (2026-07-16)**: …" bullet 1개를 추가 — 멀티-KB 리랭크·재임베딩 트리거 등 잔존 미구현 표면 때문에 `pending_plans` 를 비우면 `spec-status-lifecycle.test.ts (c)` 가 거짓 `implemented` 승격을 강제한다는 근거를 명시. (동일 사유가 `plan/in-progress/rag-quality-improvement.md §7` 헤더 노트에는 있으나 spec 문서 자체에는 없다.)

- **[INFO]** `review/consistency/2026/07/16/23_36_57/SUMMARY.md` 가 자신과 같은 커밋에 존재하는 재시도 결과를 반영하지 않은 채 "재시도 필요"로 커밋됨
  - 위치: `review/consistency/2026/07/16/23_36_57/SUMMARY.md` (checker별 위험도 표 — `cross_spec`/`convention_compliance` 행 "재시도 필요"), 같은 디렉토리의 `convention_compliance.md`/`cross_spec.md`
  - 상세: SUMMARY.md 는 "cross_spec / convention_compliance 2개 checker 는 status=success 로 보고됐으나 output_file 이 실제로 디스크에 존재하지 않아 재시도 필요"라고 기록하고 "권장 조치사항 #1"로 "직접 Agent 로 재실행하고 … 본 요약에 재통합할 것"을 지시한다. 그런데 같은 커밋에 `convention_compliance.md`·`cross_spec.md` 두 파일이 실제로 존재한다(재실행이 이미 수행됨). 즉 재시도는 이루어졌지만 그 결과(예: convention_compliance 의 WARNING 2건 — won't-do 표기 관례, 위 첫 항목과 동일한 9-rag-search Rationale 누락)가 SUMMARY.md 의 통합 표에는 재통합되지 않았다. `review/**` 는 프로젝트 컨벤션상 시점 기록 문서(옛 경로 유지 등)라 사후 갱신 의무가 강하지 않지만, SUMMARY 만 읽는 향후 감사자는 "WARNING 2건(D3, plan_coherence)만 있다"고 오인하고 convention_compliance 가 찾은 2건(특히 위 9-rag-search Rationale 누락)을 놓치게 된다.
  - 제안: 조치 불필요(시점 기록 문서 컨벤션 범위 내)이나, 향후 유사 패턴에서는 재시도 결과 확보 즉시 SUMMARY 표를 재생성하는 편이 안전 — 본 건은 이미 실제로 위 WARNING 항목의 누락으로 이어진 사례이므로 참고 기록.

- **[확인 — 양호]** `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` 헤더 주석 수정과 `spec/conventions/spec-impl-evidence.md §4.2` 표 정정은 실제 구현과 정확히 일치
  - 위치: `spec-link-integrity.test.ts:23-26`, `spec/conventions/spec-impl-evidence.md §4.2` 표
  - 상세: 종전 주석/표는 "plan/ 링크는 이 가드 예외(plan-coherence 담당)"라고 서술했으나, 실제 `spec-links.ts` 의 `findBrokenLinks()`(scope 1, spec 본문 스캔)에는 `targetFilter` 가 전혀 적용되지 않고 `findBrokenSpecLinksInSources()`(scope 2, 코드 소스 스캔)에만 `SPEC_MD_TARGET_RE` 필터가 적용됨을 소스 직접 대조로 확인했다(`spec-links.ts:222,262,323-326`). 본 PR 의 정정 문구("Scope (1) applies no target filter … Only scope (2) filters to spec/**.md targets")는 이 실제 동작과 정확히 일치한다 — 오래된 주석을 코드에 맞게 바로잡은 좋은 사례이며 별도 조치 불필요.

- **[확인 — 양호]** `.claude/docs/plan-lifecycle.md` 신규 §2.1 (`plan/research/` 규약)의 가드 면제 주장 3건을 코드로 실측 검증 — 정확함
  - 상세: (1) `plan-frontmatter.test.ts` 는 `path.join(root, "plan", "in-progress")` 만 스캔(§26-37), (2) `spec-plan-completion.test.ts` 는 `path.join(root, "plan", "complete")` 만 스캔(§60-67), (3) `plan-stale-audit.sh` 는 `IN_PROGRESS_DIR="plan/in-progress"` 만 순회(§60-74) — 세 가드 모두 `plan/research/` 를 건드리지 않아 문서의 "가드 대상 아님" 서술이 실제 구현과 일치한다. `CLAUDE.md`(정보 저장 위치 표)와 `plan-lifecycle.md`(§1/§2/§2.1) 간 신규 `research/` 서술도 상호 일관되며, `plan/in-progress/migration-tooling-evaluation.md` 신규 부록 A 의 내부 anchor 링크(`#부록-a--sqitch-poc-계획-조건부-미발동`)도 실제 `github-slugger` slug 계산 결과와 정확히 일치함을 직접 실행으로 확인했다.

### 요약
본 PR 은 순수 문서화(plan grooming + spec 정합화) 변경으로, 전반적으로 매우 높은 문서화 품질을 보인다 — 다수의 Rationale 절 신설·cross-reference 정정·오래된 주석 교정이 모두 실제 코드/구현과 대조 검증돼 정확했고, 특히 spec-link-integrity 가드의 실제 동작과 오래된 SoT 서술 간 drift 를 코드 실행으로 찾아내 바로잡은 점, 그리고 3개의 유사한 "결정 유지/전환" 케이스 중 2개(`10-parallel.md`, `11-mcp-client.md`)를 정확히 `## Rationale` 절에 근거를 남긴 점은 모범적이다. 다만 나머지 1개(`9-rag-search.md` 의 `status: partial` 유지)는 본 PR 이 자체 생성한 consistency-check 가 명시적으로 지적했음에도 최종 반영에서 누락됐다 — 낮은 비용으로 바로 고칠 수 있는 구체적 gap 이다. 부수적으로 `review/consistency/.../SUMMARY.md` 가 같은 커밋에 존재하는 재시도 결과를 통합 표에 재반영하지 않아 그 상위 문서만 보면 이 gap 이 드러나지 않는 점도 함께 기록해 둔다.

### 위험도
LOW
