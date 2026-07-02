# Plan 정합성 검토 — spec/5-system/4-execution-engine.md (M-7 스키마 enrich)

## 검토 범위

- Target: `spec/5-system/4-execution-engine.md` (impl-done, diff-base `origin/main`)
- 실 코드 변경: `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts`,
  `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts`
  (커밋 `875c81782` "refactor(engine): M-7 스키마 enrich — resume-state 필드 z.custom<T> 로 domain 캐스트 제거")
- 대조 대상 plan: `plan/in-progress/refactor/03-maintainability.md` §Major M-7
  (worktree `/Volumes/project/private/clemvion/.claude/worktrees/m7-schema-enrich-eb04a0` 기준 확인,
  `git -C <worktree> log --oneline -5 -- plan/in-progress/refactor/03-maintainability.md` /
  `git -C <worktree> show --stat HEAD` 로 실측)

## 발견사항

- **[WARNING] M-7 plan 문서가 "후속 클러스터(defer)"로 남겨둔 항목을 본 PR 이 이미 구현했는데 plan 이 갱신되지 않음**
  - target 위치: `spec/5-system/4-execution-engine.md` §7.4/§7.5 `_resumeState` 관련 서술 자체는 무변경(코드측 `resume-state.schema.ts`/`ai-turn-executor.ts` 만 변경, spec 갱신 불요 판단과 일치) — 단, 관련 추적 plan 쪽 정합 문제.
  - 관련 plan: `plan/in-progress/refactor/03-maintainability.md` M-7 "ai-turn-executor 클러스터" 서술 (라인 226) —
    > "`model`·`rawConfig`·`ragLastDiagnostics`·`allPresentations` 는 스키마상 `unknown` 이라 domain 캐스트 유지(**스키마 필드타입 enrich 는 별건 defer**)."
    그리고 바로 다음 "후속 클러스터" 서술 (라인 227) —
    > "...unknown→domain 캐스트(**messages/allPresentations/model — #783 스키마 필드타입 enrich 필요**)..."
  - 상세: 본 PR(커밋 `875c81782`, 브랜치 최신 HEAD)이 정확히 이 "후속 클러스터"에서 defer 로 남겨뒀던 `messages`/`allPresentations`/`turnDebugHistory` 3개 필드의 스키마 enrich(`z.array(z.unknown())` / `z.unknown()` → `z.custom<T>()`)를 완료하고, `ai-turn-executor.ts` 9곳의 domain 캐스트(`as ChatMessage[]`, `as PresentationPayload[] | undefined` 등)를 제거했다. 그러나 `git show --stat HEAD` 확인 결과 이 커밋은 코드 파일 2개만 변경했고 `plan/in-progress/refactor/03-maintainability.md` 는 건드리지 않았다 (`git log -- plan/.../03-maintainability.md` 최신 항목이 이 커밋보다 이전인 `b000a444f`). 따라서 현재 plan 문서는 여전히 "스키마 필드타입 enrich 는 별건 defer" / "후속 클러스터 (미착수)" 로 서술하고 있어 **실제 구현 상태와 어긋난다** — 다음에 M-7 를 이어받는 개발자·planner 가 plan만 보고 이 작업이 아직 안 된 것으로 오인해 중복 착수하거나, "후속 클러스터"의 남은 항목(STORE-PRESERVE `rawConfig` 타입화, LOAD-BEARING 개별 검토 등)과의 경계가 불명확해진다.
  - 참고: `model`/`rawConfig`/`ragLastDiagnostics`/`conversationThreadRef`/`memoryState` 는 본 PR에서도 의도적으로 `unknown` 유지(코드 주석·커밋 메시지에 근거 명시)로 남아, plan 의 "후속 클러스터" 잔여 범위(STORE-PRESERVE `rawConfig` 등)와는 정합적으로 구분되고 있다. 즉 **범위 자체의 충돌은 없고, 순수하게 plan 문서 갱신 누락**이다.
  - 제안: `plan/in-progress/refactor/03-maintainability.md` M-7 절에 새 완료 클러스터 항목("스키마 필드타입 enrich 클러스터 — messages/turnDebugHistory/allPresentations, 커밋 875c81782")을 추가하고, "후속 클러스터" 서술에서 이미 완료된 3개 필드를 제거해 잔여 범위(`rawConfig` 타입화·`model` 등 진짜 dynamic 필드·LOAD-BEARING 개별 검토·`ai-turn-orchestrator.service.ts` error-extraction 잔여 등)만 남기도록 정정. developer SKILL 관례상 구현 완료 후 plan 문서 갱신이 동일 PR/턴에서 이뤄지는 편이므로, 이 diff 가 최종 push 전 상태라면 plan 갱신 커밋을 함께 묶는 것을 권장.

- **[INFO] spec 본문 §Rationale 의 별개 "M-7" 라벨과의 표기 혼동 가능성 (실질적 충돌 아님)**
  - target 위치: `spec/5-system/4-execution-engine.md` 라인 1244 부근 Rationale — "`nextSeq` 의 Redis INCR 실패 시 옛 `Math.random` seq fallback 을 제거..." 항목이 "**M-7**" 로 표기됨.
  - 관련 plan: `plan/in-progress/refactor/03-maintainability.md` 의 "M-7 [Major] execution-engine 내 inline 타입 단언 50+ 곳" (다른 주제).
  - 상세: 두 "M-7" 은 서로 다른 문서·다른 넘버링 체계(spec Rationale 항목 번호 vs refactor plan 항목 ID)에서 우연히 같은 라벨을 사용해 혼동 소지가 있으나, 내용상 충돌·중복은 없다 (spec 쪽은 기존에 이미 존재하던 서술로 본 diff 의 변경 대상도 아님).
  - 제안: 실질 위험 없음 — 추적 메모 수준. 필요 시 향후 spec Rationale 항목 번호 체계를 별도 접두사(예: `R-M-7`)로 구분하면 혼동을 예방할 수 있음(선택 사항, 시급성 없음).

## 요약

본 PR(M-7 스키마 enrich 클러스터, 커밋 `875c81782`)은 `plan/in-progress/refactor/03-maintainability.md` M-7 이 명시적으로 예정해둔 다음 단계("스키마 필드타입 enrich" — `messages`/`allPresentations`/`turnDebugHistory`)를 정확히, 그리고 §7.5 graceful-reset 의 "런타임 미검증" 계약을 보존하는 방식으로 구현했다. `model`/`rawConfig` 등 plan 이 여전히 후속으로 남겨둔 필드는 이번에도 손대지 않아 범위 충돌은 없다. 다만 이 완료를 반영하는 plan 문서 갱신이 아직 이뤄지지 않아, "후속 클러스터" 서술이 이미 끝난 작업을 미착수로 잘못 기술하는 상태다. 이는 결정 우회나 선행조건 미해소가 아니라 순수한 추적 갱신 누락이므로 WARNING 등급이 적절하며, 다음 커밋/PR 마무리 시 plan 문서 정정으로 충분히 해소 가능하다.

## 위험도

LOW
