# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done`
범위: `03-maintainability C-2 2차(최종)` — `ai-turn-executor.ts` god-method 분해 (behavior-preserving)
diff-base: `origin/main`

---

## 발견사항

### [WARNING] multi-turn condition deferral toolCallCount 합산 동작이 spec §7.1 `meta.toolCalls` 정의와 불일치

- **target 위치**: `ai-turn-executor.ts` — `recordMultiTurnNonProviderToolResults` 내 condition tool loop (`toolCallCount++` on condition deferral). JSDoc 및 코드 내 `[SPEC-DRIFT]` 주석.
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md` §7.1 (라인 524): `meta.toolCalls` 필드 정의 — `"KB·MCP·일반 도구 호출 횟수 합산 (조건 도구 제외)"`. 이 정의는 single/multi 모드 구분 없이 동일하게 적용되는 단일 진실이다. §7.2(single-turn 조건 매칭), §7.6(multi-turn 조건 매칭) 공통의 `meta.*` 는 §7.1 준용으로 명시되어 있다.
- **상세**: single-turn의 `recordSingleTurnNonProviderToolResults`는 condition deferral 시 `toolCallCount`를 합산하지 않아(spec 준수), multi-turn의 `recordMultiTurnNonProviderToolResults`는 `toolCallCount++`를 수행한다(spec 위반). 본 리팩터 이전부터 존재하던 동작을 behavior-preserving 분해로 보존했으므로 신규 도입된 위반은 아니다. 단, 동작이 두 helper 메서드로 명시적으로 분리·문서화됨으로써 spec과의 괴리가 가시화·고착화될 위험이 있다.
- **제안**: 본 리팩터는 behavior-preserving 분해이므로 현 단계에서 multi-turn 동작 변경은 범위 외다. 코드 내 `[SPEC-DRIFT]` 주석(플래너 위임 백로그)이 이미 마킹되어 있으므로 planner가 `spec/4-nodes/3-ai/1-ai-agent.md §7.1 / §7.6`의 `meta.toolCalls` 정의를 검토하여 (a) spec을 multi-turn도 "조건 도구 제외"로 통일하거나 (b) spec에 single/multi 비대칭을 명시적으로 허용하는 note를 추가해야 한다.

---

### [INFO] 코드 JSDoc의 §3.f-g 참조 표기가 spec 섹션 번호와 불일치

- **target 위치**: `ai-turn-executor.ts` — `recordSingleTurnNonProviderToolResults` JSDoc (`spec §3.f-g`). `recordMultiTurnNonProviderToolResults` JSDoc (`§3.f-g`).
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md` — `maxToolCalls` 합산 정책은 `§6.1 단계 3.g` (라인 385)에 기술됨. 스펙 문서에는 독립 섹션 `§3.f` / `§3.g`가 존재하지 않는다. `§3`은 config 파라미터 테이블 섹션이다.
- **상세**: `§3.f-g`는 spec 위치가 아니라 `§6.1 도구 루프 단계 3의 f/g 항목`의 비공식 축약 표기다. spec을 처음 읽는 사람이 섹션 번호를 찾지 못해 혼동할 수 있다.
- **제안**: JSDoc 참조를 `spec §6.1 도구 루프 단계 3.f/3.g` 또는 `spec §6.1 (3.g)`로 정정 권장. 빌드·동작에 영향 없음.

---

## 요약

이번 C-2 2차 리팩터는 `ai-turn-executor.ts`의 god-method를 6개 private helper + `TurnOutputAccumulators` 번들로 behavior-preserving 분해한 것으로, spec 신규 계약 변경이 없다. API 계약, 데이터 모델, 요구사항 ID, 권한·RBAC, 계층 책임 관점에서 다른 spec 영역과의 모순은 발견되지 않았다. 유일한 실질적 발견은 multi-turn condition deferral에서 `toolCallCount`를 합산하는 동작(`recordMultiTurnNonProviderToolResults`)이 spec §7.1의 `meta.toolCalls` "조건 도구 제외" 정의와 불일치하는 pre-existing SPEC-DRIFT가 코드 분리로 가시화된 것이며, 이는 이미 `[SPEC-DRIFT]` 주석으로 마킹되어 플래너 위임 백로그로 등록된 상태다.

## 위험도

LOW
