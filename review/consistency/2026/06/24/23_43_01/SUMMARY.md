# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능.

## 전체 위험도
**LOW** — 행위 보존 리팩토링으로 cross-spec·식별자 충돌 없음. systemPrompt ordering invariant 및 accumulator 생명주기에 대한 설계 주의사항(INFO) 3건 존재.

---

## Critical 위배 (BLOCK 사유)

_없음_

---

## 경고 (WARNING)

_없음_

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Rationale Continuity | §11.4 systemPrompt ordering SoT — 추출 메서드 경계 정렬 필요 | 계획된 setup 단계 추출 메서드 시그니처 | `[3][4] suffix` 포함 후 `[5]` 주입 메서드가 호출되는 의존관계를 파라미터명·JSDoc 에 명기 (`// §6.1 단계 0.5 · [1]~[4]` / `// §6.1 단계 1.3·1.5·[5] (§11.4 ordering — [3][4] suffix 포함 후 호출)`) |
| 2 | Rationale Continuity | 공유 accumulator 미분리 원칙 — `presentationViolationCounters` caller scope 유지 | 계획된 setup/tool-loop 추출 경계 | `ragAcc`, `mcpDiagnosticsAcc`, `presentationViolationCounters` 등은 caller scope 에서 생성해 tool-loop 로 전달. doc 에 소유 scope 명기 |
| 3 | Rationale Continuity | `ai_user` turn push ordering invariant — 추출 시 회귀 방지 | 계획된 "메시지 빌드" 추출 단계 (코드 라인 1017-1023) | 메서드 분리 후 `ai_user` push 가 §6.1 단계 1.7(LLM 호출 전), `ai_assistant` push 가 단계 2.5(응답 직후) 임을 diff 리뷰 체크리스트로 검증 |
| 4 | Cross-Spec | §6.1 / §6.2 단계 번호 혼용 방지 (사전 주의) | 추출 private 메서드 JSDoc | JSDoc 에 `// spec: §6.1 단계 N` 형식 사용; §6.2 단계는 2차 PR 에서만 추가 |
| 5 | Naming Collision | 기존 `build*` 네임스페이스와 신규 추출 메서드명 — 시각적 구분 고려 | `AiTurnExecutor` 클래스 내부 private 메서드 | 선택사항: `buildSingleTurnSystemPrompt` / `buildSingleTurnMessages` 또는 `prepareSystemPrompt` 접두사로 기존 멀티턴·공통 `build*` 메서드와 구분 가능. 실질 충돌 없음 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 6개 관점(데이터 모델·API·요구사항 ID·상태 전이·RBAC·계층 책임) 모두 충돌 없음 |
| Rationale Continuity | LOW | §11.4 ordering / accumulator scope / ai_user push timing — 구현 시 주의 필요한 INFO 3건 |
| Convention Compliance | N/A (출력 파일 미생성) | 재시도 필요 — 결과 파일 없음 |
| Plan Coherence | N/A (출력 파일 미생성) | 재시도 필요 — 결과 파일 없음 |
| Naming Collision | NONE | 신규 외부 노출 식별자 없음; 클래스 내부 `build*` 접두사 군과 의미 충돌 없음 |

> **주의**: Convention Compliance 및 Plan Coherence 두 checker 의 출력 파일이 존재하지 않아 해당 영역은 검토 미완료 상태입니다. 위험도 판정은 나머지 3개 checker(Cross-Spec / Rationale Continuity / Naming Collision) 결과에만 근거합니다.

---

## 권장 조치사항

1. **INFO-1 대응 (구현 착수 전 설계)**: setup 단계 추출 메서드 시그니처 설계 시 `§11.4` ordering invariant([1]~[4] suffix 포함 → [5] 주입 순서)를 파라미터명과 JSDoc 에 명시적으로 드러낼 것.
2. **INFO-2 대응 (구현 착수 전 설계)**: `presentationViolationCounters`, `ragAcc`, `mcpDiagnosticsAcc` 등 tool-loop span accumulator 는 caller(`executeSingleTurn`) scope 에 두고 추출 메서드에 흡수하지 않을 것.
3. **INFO-3 대응 (구현 후 diff 리뷰)**: `ai_user` turn push 위치(§6.1 단계 1.7, LLM 호출 전)와 `ai_assistant` turn push 위치(단계 2.5, 응답 직후)가 보존되었는지 PR diff 에서 명시적 체크.
4. **Convention Compliance / Plan Coherence 재시도**: 두 checker 출력 파일이 누락되었으므로 필요 시 해당 checker 단독 재실행 권장 (본 BLOCK 판정에는 영향 없음 — 나머지 checker 에서 Critical 미검출).