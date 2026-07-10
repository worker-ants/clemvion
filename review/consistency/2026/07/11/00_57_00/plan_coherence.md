# Plan 정합성 Check — EIA context schema (rebase 후 재검토, --impl-done)

검토 대상: `spec/5-system/14-external-interaction-api.md` (diff-base `origin/main`, rebase 후 실 diff 직접 검증)

## 검토 방법

payload 의 in-progress plan 덤프가 25000 토큰 cap 으로 잘려(1236줄에서 truncated) 목표 plan 4건을 포함하지 못했다. 대신 워킹트리에서 직접 `Read`/`git log`/`git show`/`grep` 으로 각 plan 파일과 관련 커밋을 절대경로로 재확인했다.

## 발견사항

이번 라운드에서 CRITICAL/WARNING 급 발견사항 없음. 사용자가 제시한 5개 검증 항목을 모두 직접 실증했다.

- **[INFO]** rebase 충돌 해소 지점 검증 완료 — `getStatus currentNode/context` 항목
  - target 위치: 없음 (plan 자체 검증)
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 17-18행
  - 상세: `git show 49c2185d1 -- plan/in-progress/spec-sync-external-interaction-api-gaps.md` 로 PR #903 의 변경을 확인 — `interaction.service.ts:247-296` 라인 인용을 `interaction.service.ts 의 getStatus() — WAITING_FOR_INPUT 분기 (라인 인용은 리팩터마다 stale 화돼 심볼로 고정)` 로 정정. `git show c44673cfd -- plan/in-progress/spec-sync-external-interaction-api-gaps.md` 로 본 브랜치가 같은 항목에 추가한 "축 분리 주의" 하위 불릿(런타임 실값 vs OpenAPI 스키마 표현 vs 부재 표현 컨벤션 — 별도 축이며 `spec-draft-eia-context-schema-absence-convention.md` 로 이관)을 확인. 현재 워킹트리(`Read` 로 직접 확인)에 두 변경 모두 존재하며 서로 다른 관심사(라인 인용 안정성 vs 축 분리 안내)라 중복도 모순도 없다. `grep -rl "<<<<<<<\|=======\|>>>>>>>" plan/` 로 plan/ 전체에 잔여 conflict marker 없음을 확인.
  - 제안: 없음 — 이미 정합.

- **[INFO]** driving plan (b) — `plan/complete/spec-draft-eia-context-schema-absence-convention.md` 무결성 확인
  - target 위치: 없음
  - 관련 plan: `plan/complete/spec-draft-eia-context-schema-absence-convention.md`
  - 상세: `plan/complete/` 에 정상 위치. frontmatter `spec_impact` 는 3-항목 YAML 리스트(`spec/conventions/swagger.md` · `spec/5-system/2-api-convention.md` · `spec/5-system/14-external-interaction-api.md`) — bare string 아님, Gate C 스키마 준수(memory `feedback_spec_impact_gate_c_list.md` 의 회귀 클래스 아님). 체크리스트 전 항목 `[x]` (consistency-check --spec/--impl-prep/--impl-done, 구현 6개 sub-item, 테스트, TEST WORKFLOW, ai-review + Warning fix, rebase). `git log --oneline -- <path>` 최신 커밋이 `cb9d14854 chore(plan): mark ... complete` 이며 이후 rebase 로 인한 추가 변경 없음 — rebase 가 이 파일을 건드리지 않았다. worktree/started/owner 필수 필드도 정상 (top-level in-progress 전용 강제이지만 complete 이동 후에도 유지 규칙 충족).
  - 제안: 없음.

- **[INFO]** follow-up plan (c) — `plan/in-progress/eia-context-schema-followups.md` 정합
  - target 위치: 없음
  - 관련 plan: `plan/in-progress/eia-context-schema-followups.md`
  - 상세: frontmatter worktree/started/owner 갖춤(top-level in-progress 필수 필드 충족). 4개 미해결 항목(DTO 위치 정규화, client 타입 2곳 정밀화, swagger.md §1-4 예외 명시, spec 상대링크 off-by-one) 모두 driving plan 의 "## 후속" 섹션이 명시적으로 위임한 것과 1:1 대응하며 근거(impl-prep W1, impl-done I1/I2, fresh ai-review INFO)가 구체적으로 인용돼 있다. 새 결정을 일방적으로 내리지 않고 각 항목이 "누가·왜 지금 안 했는지"를 기록한 상태 — 미해결 결정 충돌 없음.
  - 제안: 없음.

- **[INFO]** (d) `plan/complete/eia-getstatus-column-projection.md` (PR #903) — 축 분리 확인
  - target 위치: 없음
  - 관련 plan: `plan/complete/eia-getstatus-column-projection.md`
  - 상세: 이 plan 은 `getStatus()` 의 **DB 컬럼 projection 최적화**(base projection + waiting 시에만 `conversation_thread` 2단계 조회)만 다룬다. `spec_impact: none` — wire/DTO/에러코드 무변경을 스스로 명시. driving plan (b) 은 `context` 필드의 **OpenAPI 스키마 표현**(oneOf variant DTO) 과 **부재 표현 컨벤션**(null vs 키 생략)을 다룬다 — 서로 다른 축(런타임 조회 성능 vs 응답 스키마 형태)이며 둘 다 명시적으로 "wire 형식 무변경" 을 전제로 한다. 두 plan 이 동시에 `interaction.service.ts` 를 건드리지만(projection 단계 분리 vs `WaitingContextBaseDto` annotate), 현재 워킹트리 diff(payload 상단 diff 484-529행)에서 두 변경이 이미 병합된 형태로 공존함을 확인했다 — `base: WaitingContextBaseDto` 타입 annotate 가 2단계 조회 흐름(`if (interactionType) { const base: WaitingContextBaseDto = {...} }`) 안에 자연스럽게 위치. 충돌 없음.
  - 제안: 없음.

- **[INFO]** (e) 그 외 in-progress plan 스캔 — 무효화된 항목 없음
  - target 위치: 없음
  - 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md`, `plan/in-progress/self-hosting-deployment.md`, `plan/in-progress/merge-p2-async-fanin.md`, `plan/in-progress/node-output-redesign/README.md`, `plan/in-progress/spec-draft-pr874-deferred-docs.md`
  - 상세: `grep -rl "external-interaction\|EIA §5.3\|EIA-IN\|EIA-NX\|R17\b" plan/in-progress/` 로 EIA 를 cross-ref 하는 전체 in-progress plan 을 스캔. 매칭된 항목은 각각 SSRF allowlist 가이드(§8.1), monotonic seq PoC(§R7), `execution.failed` error shape 매핑(§6.3), `tool_call_started/completed` payload namespace(§5.2) — 전부 `getStatus.context`(§5.3) 스키마 형태와 무관한 다른 섹션/축이라 이번 변경으로 무효화되지 않는다. `spec-draft-pr874-deferred-docs.md` 는 widget-app §R7·conversation-thread §9 서술 보강이며 이미 체크리스트 대부분 완료(doc-guard·commit/PR 만 잔여) — 이번 변경과 파일 단위로 겹치지 않는다. spec 자신의 frontmatter `pending_plans:` 는 `spec-sync-external-interaction-api-gaps.md` 하나만 정확히 등록돼 있어 dangling reference 없음.
  - 제안: 없음.

## 요약

Rebase 로 발생한 유일한 plan 충돌(`spec-sync-external-interaction-api-gaps.md` 의 getStatus 항목)은 PR #903 의 심볼 인용 정정과 본 브랜치의 축 분리 하위 불릿이 서로 다른 관심사로 정합하게 병존한다 — 중복·모순·conflict marker 없음. driving plan(`spec-draft-eia-context-schema-absence-convention.md`)은 `complete/` 에 정상 위치하며 전 체크박스 `[x]`·`spec_impact` YAML 리스트 모두 정상이고 rebase 가 이 파일을 건드리지 않았다. 후속 plan(`eia-context-schema-followups.md`)은 driving plan 의 명시적 위임과 1:1 대응해 미해결 결정을 우회하지 않는다. PR #903 의 `eia-getstatus-column-projection.md`(DB 조회 성능)는 본 작업(응답 스키마 형태)과 직교하는 축이며 코드 레벨에서도 이미 정합하게 병합된 상태를 diff 로 확인했다. 그 외 EIA 를 cross-ref 하는 in-progress plan 전량 스캔 결과 이번 변경으로 무효화되거나 후속 항목이 새로 필요해진 것은 없다.

## 위험도
NONE

STATUS: SUCCESS
