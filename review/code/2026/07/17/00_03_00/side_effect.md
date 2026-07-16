### 발견사항

- **[INFO] 실행 코드 변경 없음 — 순수 문서/plan 재배치**
  - 위치: 전체 29개 변경 파일
  - 상세: 이번 변경분은 `.claude/docs/`·`CLAUDE.md`·`plan/**`·`review/consistency/**`·`spec/**` 문서 전량이며, 유일한 `codebase/` 변경 파일(`codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts`)도 주석만 갱신했고 로직·검증 대상 필터는 불변이다(실측: `spec-links.ts`의 `findBrokenLinks()`에 `plan/**` 타깃 필터가 실제로 없어, 갱신된 주석이 기존 동작을 정확히 재서술한 것 — 코드 자체는 무변경). 전역 변수·함수 시그니처·공개 API·환경변수·네트워크 호출·이벤트/콜백 어느 축에서도 실질적 부작용 표면이 없다.
  - 제안: 없음(확인 완료로 기록).

- **[INFO] 대량 plan 파일 이동(git rename)이 참조 무결성을 깨지 않았음을 실측 확인**
  - 위치: `plan/in-progress/{rag-dynamic-cut,spec-sync-mcp-client-gaps,parallel-p2-followups,trigger-param-output-enricher,ai-agent-tool-payload-budget-guardrail}.md` → `plan/complete/`, `plan/in-progress/competitive-analysis-n8n-flowise.md` → `plan/research/`, `plan/in-progress/sqitch-poc.md` 삭제(내용은 `migration-tooling-evaluation.md` 부록 A로 흡수)
  - 상세: `git show --name-status HEAD`로 전부 `R0xx`(rename, 내용 일부 변경 포함) 정상 기록됨을 확인 — "git mv 후 미커밋 편집 잔류" 패턴(알려진 함정) 없음. `grep -rn`으로 저장소 전수 스캔한 결과, 이동/삭제된 5개 plan 파일을 가리키는 살아있는 markdown 링크(`spec/**`, `plan/**`)는 diff 밖 어디에도 남아있지 않다 — `review/**` 아카이브(과거 시점 기록, 정책상 갱신 대상 아님) 안의 인용만 존재. `spec/4-nodes/1-logic/10-parallel.md`·`spec/conventions/{execution-context,cross-node-warning-rules,node-cancellation}.md`의 `parallel-p2-followups.md` 링크 4곳 전부 `plan/complete/`로 정확히 갱신됨을 실측(grep)으로 재확인. `spec/5-system/9-rag-search.md`·`11-mcp-client.md`의 frontmatter `pending_plans` 도 이동/삭제된 경로를 더 이상 가리키지 않는다(각각 `rag-quality-improvement.md`로 재배선, 필드 제거). `spec-link-integrity.test.ts`(build 차단 가드)를 실제로 깨뜨릴 dangling reference는 발견되지 않았다.
  - 제안: 없음(확인 완료로 기록).

- **[WARNING] 신규 커밋된 `review/consistency/2026/07/16/23_36_57/_retry_state.json`이 같은 커밋에 포함된 실제 산출물과 내용상 모순 — 향후 자동화 재실행 로직을 오도할 파일시스템 부작용**
  - 위치: `review/consistency/2026/07/16/23_36_57/_retry_state.json` (신규) vs 같은 디렉토리의 `cross_spec.md`·`convention_compliance.md` (둘 다 신규, 내용 존재)
  - 상세: `_retry_state.json`은 `agents_pending: [cross_spec, rationale_continuity, convention_compliance, plan_coherence, naming_collision]`(5개 전부), `agents_success: []`(0개)로 기록돼 있어 "아무 checker도 완료되지 않은 상태"를 영구 기록한다. 반면 같은 커밋에 `cross_spec.md`·`convention_compliance.md`가 실제 분석 내용과 함께 신규 생성돼 있고, `SUMMARY.md`도 이 둘을 포함해 "5개 checker 중 3개(rationale_continuity/plan_coherence/naming_collision)만 disk 확보, 2개(cross_spec/convention_compliance)는 success로 보고됐으나 파일 없음 → 재시도 필요"라고 서술한다. 즉 `SUMMARY.md` 작성 시점에는 그 서술이 맞았지만, 이후 호출자가 그 2개를 직접 Agent 재실행해 `cross_spec.md`/`convention_compliance.md`를 확보·커밋하면서도 `_retry_state.json`은 갱신하지 않고 그대로 커밋했다. 이 상태 파일이 향후 "재시도 오케스트레이터가 `_retry_state.json`을 SoT로 읽어 미완료 항목을 재계산"하는 방식으로 재사용되면(`subagent-call-contract.md` 재시도 정책이 이런 상태 파일 패턴을 전제), 이미 완료·커밋된 2개 checker를 다시 "pending"으로 오판해 불필요한 재실행을 유발할 수 있다. 다만 본 디렉토리는 timestamp 로 고정된 point-in-time 아카이브라 실제로 재열람될 가능성은 낮다.
  - 제안: `_retry_state.json`의 `agents_pending`/`agents_success`를 최종 상태(5개 전부 success)로 갱신 후 재커밋하거나, 최소한 `SUMMARY.md`에 "`_retry_state.json`은 최초 재시도 시점 스냅샷이며 이후 수기 보강분(cross_spec/convention_compliance)은 미반영"이라는 주석을 남겨 상태 파일과 최종 산출물 간 불일치를 명시할 것.

- **[INFO] `spec/5-system/11-mcp-client.md`의 `status: partial → implemented` 승격 + `pending_plans` 필드 제거가 spec-status-lifecycle 가드 의미를 변경하지만, 근거 plan(`spec-sync-mcp-client-gaps.md`) 종결과 정합**
  - 위치: `spec/5-system/11-mcp-client.md` frontmatter, `spec/5-system/9-rag-search.md` frontmatter(`pending_plans` 재배선)
  - 상세: 이 frontmatter 필드는 `spec-status-lifecycle.test.ts`(build 가드)와 `spec-pending-plan-existence.test.ts`가 소비하는 사실상의 "공개 인터페이스"다. `status`를 `implemented`로 올리면 해당 가드가 "미구현 표면 없음"을 전제로 향후 회귀(예: 새 Planned 문구 추가 시 가드가 더 엄격하게 반응)하게 되므로 side-effect 표면으로 볼 여지가 있다. 다만 실측 결과 `11-mcp-client.md` 전수 grep(`미구현|Planned|잔여`)에 §3.3(이번에 won't-do로 전환) 외 잔존 표면이 없고, 유일한 `pending_plans` 대상이었던 `spec-sync-mcp-client-gaps.md`도 같은 커밋에서 `plan/complete/`로 종결됐으므로 상태 전이는 정합하다. `9-rag-search.md`의 `pending_plans` 재배선(`rag-dynamic-cut.md` → `rag-quality-improvement.md`) 역시 대상 파일이 실존(`plan/in-progress/rag-quality-improvement.md`)함을 확인했다.
  - 제안: 없음 — 부작용은 있으나(가드 판정 조건 변경) 의도된 것이고 근거가 일치함을 확인.

### 요약
이번 변경분은 실행 코드를 사실상 건드리지 않는 plan/spec 문서 정리(grooming) 커밋이다 — 유일한 codebase 파일 변경은 주석뿐이며 로직·시그니처·전역 상태·환경변수·네트워크 호출은 전혀 관여하지 않는다. 가장 주의 깊게 봐야 할 부작용 후보는 5개 plan 파일의 대량 이동/삭제인데, 저장소 전수 grep으로 대조한 결과 이동에 따른 dead link 는 diff 가 스스로 열거한 위치(4곳) 외에 남아있지 않았고, `git rename` 기록도 온전해 "rename 후 편집 유실" 함정도 없었다. 다만 커밋에 포함된 `review/consistency/.../_retry_state.json`이 같은 커밋의 다른 산출물(`cross_spec.md`/`convention_compliance.md` 실존)과 모순된 "전원 pending" 상태를 영구 기록하고 있어, 이 상태 파일을 SoT 로 삼는 향후 재시도 자동화가 이미 끝난 작업을 잘못 재실행시킬 여지가 있다 — 실제 코드 부작용은 아니지만 저장소에 커밋되는 파일시스템 산출물의 자기모순이라 WARNING으로 남긴다. `spec/5-system/11-mcp-client.md`의 status 승격은 빌드 가드의 판정 조건을 바꾸는 실질적 "인터페이스 변경"이지만 근거 plan 종결과 정합함을 확인했다.

### 위험도
LOW
