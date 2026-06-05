# 신규 식별자 충돌 검토 결과

검토 모드: 구현 완료 후 검토 (`--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`)

실제 변경 범위: 4개 spec 파일 (`spec/1-data-model.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/5-system/4-execution-engine.md`, `spec/conventions/conversation-thread.md`) + 구현 코드 (`codebase/backend/`).

---

## 발견사항

### [INFO] `Execution.conversation_thread` 컬럼 신규 도입 — 기존 "신규 DB 컬럼 없음" 정책 문구와의 표면 충돌 (이미 spec 내 해소됨)
- **target 신규 식별자**: `conversation_thread` (JSONB, nullable) — `spec/1-data-model.md §2.13 Execution` 테이블 신규 컬럼 행, migration `V084__execution_conversation_thread.sql`
- **기존 사용처**: `spec/conventions/conversation-thread.md §4` (main 브랜치) 의 옛 문구 "v1 은 ConversationThread 본문에 신규 DB 컬럼 도입 없음. 향후 … `Execution.conversation_thread jsonb NULL` 컬럼 마이그레이션 검토." — 즉 동일 식별자 이름이 "미래 검토 대상"으로 이미 예고됨.
- **상세**: 이름 충돌이 아니라 예고 → 채택의 동일 식별자 진화. target 브랜치에서 `conversation-thread.md §4` 문구가 "채택 완료"로 갱신되고 §8.4 Rationale 이 추가됐으며, 같은 이름을 다른 의미로 사용하는 충돌은 없음.
- **제안**: 충돌 없음. 단, `spec/4-nodes/3-ai/1-ai-agent.md §12.10` v1 경계 설명에서 "신규 DB 컬럼 없음" 문구가 "Execution.conversation_thread durable park 스냅샷" 추가로 갱신됐는지 확인 — 이미 이번 diff 에서 동기 갱신 완료 확인됨.

### [INFO] migration 번호 `V084` — main 기준 V083 다음으로 적절히 배정
- **target 신규 식별자**: `V084__execution_conversation_thread.sql`
- **기존 사용처**: main 브랜치에 `V083__execution_active_running_ms.sql` 존재 (PR2a, #469). V084 는 그 다음 번호.
- **상세**: 번호 선점 없음. plan 문서에서 "V083→V084 rebase-renumber" 경위가 명시됨(#469 PR2a 가 V083 선점). 충돌 없음.
- **제안**: 없음.

### [INFO] `rehydrateConversationThread` 함수명 — 기존 `rehydrateContext` 와의 혼동 가능성
- **target 신규 식별자**: `rehydrateConversationThread` (`codebase/backend/src/shared/conversation-thread/conversation-thread.types.ts` 신규 export 함수)
- **기존 사용처**: `rehydrateContext` (execution-engine.service.ts 내 기존 함수). main 브랜치 `conversation-thread.types.ts` 에는 존재하지 않음.
- **상세**: 두 함수가 이름 충돌하지 않으며, 역할도 명확히 다름 — `rehydrateConversationThread` 는 JSONB 스냅샷 → `MutableConversationThread` 복원 변환 함수, `rehydrateContext` 는 ExecutionContext 전체 재구성 함수. 단 두 이름 모두 "rehydrate" 접두사를 공유해 미래 개발자가 혼동할 수 있음.
- **제안**: 현 상태로 수용 가능. 필요 시 `deserializeConversationThread` 또는 `restoreConversationThread` 로 변환 의미를 강조할 수 있으나, 기존 코드베이스에서 `rehydrate*` 접두사가 "DB/스냅샷에서 복원" 의미로 일관되게 쓰이므로 현 명명도 일관성 있음.

### [INFO] `§8.4` 섹션 신설 — 기존 `§9` 이상 섹션 참조 영향 없음
- **target 신규 식별자**: `conversation-thread.md §8.4` (`Execution.conversation_thread 컬럼 채택 — durable park resume`)
- **기존 사용처**: main 브랜치 `conversation-thread.md` 에 `§8.1`~`§8.3` 까지만 존재 (`§9. 미리보기 UI 렌더 규칙` 이 `§8` Rationale 다음 별도 섹션). `§8.4` 는 빈 번호였음.
- **상세**: 기존 `§9` 의 번호가 밀리지 않으며 (`§8` Rationale 하위 `§8.4` 추가이므로), 외부에서 `§9.*` 를 하드링크로 참조하는 곳들에 영향 없음. 충돌 없음.
- **제안**: 없음.

### [INFO] plan 내 `D1`~`D5` 결정 레이블 — spec 내 다른 `D1`/`D2` 레이블과 네임스페이스 분리 확인 필요
- **target 신규 식별자**: `D1`~`D5` (plan/in-progress/exec-park-durable-resume.md 내 미해결/확정 결정 레이블)
- **기존 사용처**: `spec/5-system/13-replay-rerun.md` 에 `D1` ("multi-turn 노드 처리 — 사용자 새 입력"), `D2` ("multi-turn 입력 재사용") 레이블이 이미 존재. `spec/conventions/conversation-thread.md §9.3` 에 `D4` ("emit messages 를 conversation Preview 에서 격리") 레이블이 존재.
- **상세**: plan 의 결정 레이블(`D1`~`D5`)은 plan 문서 내부 추적용 로컬 식별자이고, 해당 레이블들이 spec 본문으로 승격(인용)된 흔적이 없으므로 현재 충돌 없음. 다만 `spec/5-system/13-replay-rerun.md §D1`/§D2 와 `exec-park plan D1`(conversationThread 영속 매체 결정)/`D2`(user variables 범위 결정) 는 다른 의미를 공유하는 비공개 레이블로, 장기적으로 plan 이력이 spec 으로 merge 될 경우 혼동 가능.
- **제안**: plan 결정 레이블을 spec 본문에 인용할 때는 plan 고유 prefix (`exec-park:D1` 등) 를 사용하거나, spec 본문에는 레이블 대신 의미 있는 anchor 링크로 대체 권장. 현재 단계에서는 plan 전용으로 충돌 없음.

---

## 요약

이번 브랜치(`exec-park-durable-resume`)가 도입하는 신규 식별자는 다음 4가지로 한정된다: (1) `Execution.conversation_thread` JSONB 컬럼, (2) 마이그레이션 `V084__execution_conversation_thread`, (3) `rehydrateConversationThread` 함수, (4) `conversation-thread.md §8.4` 섹션. 각각 기존 spec·코드에서 다른 의미로 이미 사용 중인 동일 식별자가 없으며 CRITICAL 또는 WARNING 충돌은 발견되지 않는다. `Execution.conversation_thread` 는 main 브랜치 spec 이 이미 "검토 예정"으로 예고했던 식별자를 채택한 것이어서 이름 충돌 소지가 원천 제거된 상태이고, V084 번호는 V083(main 선점) 직후로 올바르게 배정됐다. INFO 수준으로는 plan 내 `D1`~`D5` 결정 레이블이 다른 spec 문서에 존재하는 동일 레이블과 의미가 다르지만, 이는 plan 로컬 레이블이므로 현 단계에서 spec 충돌이 아니다.

---

## 위험도

NONE
