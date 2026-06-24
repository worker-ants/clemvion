# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**MEDIUM** — WARNING 4건(Cross-Spec call-site 불일치 1, Convention draft frontmatter 2, Plan Coherence plan 미반영 1), INFO 8건. Critical 없음.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING) — 처리

| # | Checker | 위배 | 처리 |
|---|---------|------|------|
| W-1 | Cross-Spec | `data-flow/13-agent-memory.md` L39·L103-104 가 구 `ai-agent.handler.ts` 메모리 경로 — 1-D/1-E/1-F 채택 시 불일치 | **본 PR 포함**: `13-agent-memory.md` 의 ai-agent 메모리 항목을 `AiMemoryManager` 위임으로 동반 갱신(information-extractor 동형 경로는 별 구현이라 무변경) |
| W-2 | Convention | draft frontmatter `started`·`owner` 누락 | **moot**: draft 는 적용 후 삭제(transient working note, 미커밋) |
| W-3 | Convention | draft `worktree` full-path | **moot**: 동일(draft 삭제) |
| W-4 | Plan Coherence | plan L131 의 `interaction-type-registry` SoT 갱신 항목이 조사 결과 "변경 불요"인데 plan 미반영 | **본 PR 포함**: plan M-1 후속 note 에 "interaction-type-registry 변경 불요 확인" + 본 잔여 sync 완료 마킹 |

## 참고 (INFO) — 처리

| # | 항목 | 처리 |
|---|------|------|
| I-1 | `processMultiTurnMessage` 위치 정보가 `0-common.md`(presentation) L367·`conversation-thread.md` L575 에 구 핸들러 기술 | **defer** — facade 위임이라 진입 경계 유효(직접 충돌 아님). 별 doc-sync 이월(plan note). |
| I-2/I-3 | 1-G WS §4.4 정합·1-A `emitAiWaitingForInput` 일관 | 변경 불요 ✅ |
| I-4 | 1-G WS 링크 anchor 정밀화 | **반영** — WS §4.4 기준 anchor 유지(간결). |
| I-5 | M-1 god-handler 분할 Rationale(§12.15) 부재 | **defer** — pre-existing 공백(target 도입 아님), 새 Rationale 섹션은 본 doc-sync 범위 초과. plan note 이월. |
| I-6/I-7 | draft frontmatter enum·헤더 경로 표기 | **moot** — draft 삭제. |
| I-8 | `ai-context-memory-followup-v2.md` L22 완료 이력 | 무관(완료 이력). |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM→처리 | `13-agent-memory.md` call-site 동기화(W-1, 본 PR 포함) |
| Rationale Continuity | NONE | WS Rationale 정합. §12 공백은 pre-existing |
| Convention Compliance | MEDIUM→moot | draft frontmatter(W-2/W-3) — draft 삭제로 해소 |
| Plan Coherence | LOW→처리 | interaction-type-registry 폐기 결론 plan 반영(W-4) |
| Naming Collision | NONE | 도입 식별자 16개 충돌 없음 |

## 권장 조치사항 (처리 반영)

1. (W-2·W-3) draft 삭제 — transient working note.
2. (W-1) `data-flow/13-agent-memory.md` ai-agent 메모리 항목 `AiMemoryManager` 위임 동반 갱신 — 본 PR.
3. (W-4) plan L131 "interaction-type-registry 변경 불요 확인" + 잔여 sync 완료 마킹 — 본 PR.
4. (I-1·I-5 defer) `0-common.md`/`conversation-thread.md` processMultiTurnMessage 위치·§12.15 M-1 Rationale → plan note 이월(별 doc-sync).
