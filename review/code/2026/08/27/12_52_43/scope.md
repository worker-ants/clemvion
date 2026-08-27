### 발견사항

- **[WARNING]** masking-egress 작업과 무관한 "doc-link 검사기" 전제 정정이 mirror-sweep 수정 커밋에 곁다리로 섞였다 (이미 알려진 항목, 팀이 소급 분리하지 않기로 결정)
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:771`~`793` (블록 `⚠️ **전제 정정 (2026-08-27 실측, C 작업 중)**`)
  - 상세: 커밋 `23e1c91a0`("fix(docs): 스윕을 닫았다는 커밋에서 스윕이 또 갈렸다 (`11_25_15` W1~W4)")는 title·본문 W1~W4·INFO 4·INFO 6 전부 `masking-expression-egress-split` 의 mirror-sweep 잔여(config echo 마스킹 정정 stale 인용 4곳)를 닫는 내용이다. 그런데 같은 커밋이 그 자신의 메시지 안에서 "## 곁다리 실측 — D 항목(doc-link)의 전제가 틀렸다" 라는 별도 섹션으로 스스로 인지하며 `check-doc-links.py` 미배선·`origin/main` 기존 exit 1·`spec-link-integrity.test.ts` 오탐 2건이라는 **완전히 다른 백로그 트랙**(doc-link 검사기 하네스)의 실측 결과를 plan 파일에 추가했다. 작성자 자신도 커밋 메시지에서 이것이 W1~W4 작업과 다른 갈래임을 명시하고 있다.
  - 이 발견은 이미 `review/code/2026/08/27/12_00_05/scope.md`(같은 diff 안에 포함된 이전 라운드 산출물)가 동일하게 지적했고, 그 라운드의 `RESOLUTION.md` W6 에서 "맞다. 내용은 정확하지만 커밋을 갈랐어야 했다 … 소급 분리는 하지 않고, 이번 커밋은 마스킹 범위로 한정했다" 로 처분됐다(이미 머지된 커밋의 소급 분리는 하지 않기로 한 팀 결정). 따라서 신규 발견이 아니라 **기지 항목의 재확인**이며, 팀이 이미 인지하고 비차단으로 처분한 사안이다.
  - 제안: 추가 조치 불요(이미 처분 완료). 다만 향후 유사 상황(같은 세션에서 곁가지로 발견한 별건 실측)에서는, 아직 커밋 전이라면 별도 커밋으로 분리해 이 PR 의 diff 가 "config echo 마스킹" 단일 목적에서 벗어나지 않게 하는 관행을 유지할 것.

- **[INFO]** 핵심 코드 변경(5개 파일)은 "config echo 마스킹을 어댑터→egress 로 이관"이라는 단일 목적에 정확히 귀속된다
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts`(`config: r.config ?? {}`), `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts`(`DEFAULT_SENSITIVE_KEYS` export), 그 두 spec 파일, `codebase/backend/src/modules/execution-engine/context/execution-context.service.{ts,spec.ts}`
  - 상세: `handler-output.adapter.ts` 의 `maskSensitiveFields(r.config ?? {})` 제거는 diff 의 유일한 기능 변경이며, 타입 단언 제거(`as Record<string, unknown>` 삭제)는 반환 타입이 이미 `Record<string, unknown>` 이 되어 lint 상 불필요해진 **직접 파생 결과**이지 별개 리팩토링이 아니다(`maintainability.md` 도 동일 판단). `execution-context.service.ts` 의 JSDoc 확장 + `execution-context.service.spec.ts` 의 신규 캐너리(참조 저장 vs shallow-copy 대조군)는 마스킹 제거로 사라진 "암묵적 deep-clone"의 부작용(aliasing)을 고정하는 직접 후속이다. `ai-turn-executor.ts` 의 변경은 코드 로직 변경 없이 stale 주석 2곳(`maskSensitiveFields boundary` 인용)만 정정한다 — 미러 스윕의 일부다.
  - 제안: 없음(양호).

- **[INFO]** spec 6개 파일 수정은 developer 권한 밖 CRITICAL(보안 Rationale 무효화)을 별도 "planner 턴" 커밋으로 분리 처리해 절차를 지켰다
  - 위치: `spec/2-navigation/14-execution-history.md`, `spec/3-workflow-editor/4-ai-assistant.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/5-system/4-execution-engine.md`, `spec/conventions/egress-masking.md`, `spec/conventions/node-output.md`
  - 상세: `review/consistency/2026/08/24/19_26_06/` 의 `--impl-prep` 게이트가 CRITICAL(R-5 의 "boundary masking parity" 근거가 이 코드 변경으로 무효화됨)을 BLOCK:YES 로 지적했고, 이를 커밋 `57fb83592`("docs(spec): 마스킹 시점을 storage→egress 로")로 별도 분리해 집행했다 — CLAUDE.md 의 developer/planner 권한 경계(구현 중 spec 변경 필요 시 planner 턴)를 따른 정상 절차다. spec_impact 도 원래 1건(`egress-masking.md`)에서 6건으로 정확히 넓혀졌다.
  - 제안: 없음(양호).

- **[INFO]** `review/code/**`·`review/consistency/**` 산출물 커밋은 저장소 컨벤션에 따른 표준 절차이지 스코프 이탈이 아니다
  - 위치: `review/code/2026/08/27/{10_53_52,11_25_15,12_00_05,12_28_26}/**`, `review/consistency/2026/08/24/19_26_06/**`
  - 상세: CLAUDE.md 의 정보 저장 위치 표에 "코드 리뷰 산출물 → `review/code/<...>`", "일관성 검토 산출물 → `review/consistency/<...>`" 로 명시돼 있고 gitignore 대상이 아니다. 이번 diff 가 `origin/main` 대비 담고 있는 것은 이 worktree 에서 진행된 4라운드 코드 리뷰(안전장치 미파생 CRITICAL → 미러 스윕 WARNING들 → vacuous 캐너리 WARNING → aliasing JSDoc WARNING, 수렴)의 산출물 + 1회 consistency-check 산출물이며, 각 라운드가 지적한 문제는 다음 코드/spec/test 파일에 실제로 반영됐음을 이전 라운드들(특히 `12_28_26`)이 직접 재현으로 확인했다.
  - 제안: 없음(양호).

- **[INFO]** plan 트래커에 등재된 신규 백로그 항목(자격증명 참조 간접화 검토, `chatChannel` 정규식 비대칭)은 이 작업이 만든 트레이드오프의 정상적 후속 등재이지 기능 확장이 아니다
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:515`~`533`
  - 상세: 두 항목 모두 "미판정으로 남긴다"·"별건 등재" 로 명시돼 코드 변경이 수반되지 않았고, 이 PR 이 egress-only 전환으로 실제로 만든 두 트레이드오프(크로스-노드 릴레이, safe-by-convention)를 자매 트래커에 동기화하는 것뿐이다. 근본 처방(참조 간접화)을 이번 PR 에서 직접 구현하지 않고 defer 한 것은 over-engineering 을 피한 올바른 판단이다.
  - 제안: 없음(양호).

### 요약

이번 diff(`origin/main` 대비 70개 파일)는 "노드 `config` echo 마스킹을 어댑터 boundary 에서 egress 전용으로 옮긴다"는 단일 목적의 핵심 코드 변경(5개 파일) + 그로 인해 무효화된 보안 Rationale 을 정정하는 spec 6개(별도 planner 턴 커밋으로 권한 경계 준수) + 4라운드에 걸친 코드/일관성 리뷰 산출물 커밋(저장소 컨벤션에 따른 표준 절차) + plan 트래커 동기화로 구성되며, 불필요한 리팩토링·기능 확장·무관한 파일 수정·포맷팅 잡음은 발견되지 않았다. 유일한 실질적 스코프 혼입은 mirror-sweep 을 닫는 커밋(`23e1c91a0`)에 "doc-link 검사기 전제 정정"이라는 무관한 곁다리 실측이 섞인 것인데, 이는 이미 같은 diff 안에 포함된 이전 라운드(`12_00_05/scope.md`)가 지적했고 팀이 "소급 분리 불요, 향후엔 커밋을 가른다"로 명시적으로 처분한 기지 사안이다. 신규 스코프 위반은 발견되지 않았다.

### 위험도
LOW
