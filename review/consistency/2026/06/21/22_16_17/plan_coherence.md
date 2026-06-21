# Plan 정합성 검토 결과

검토 모드: `--impl-done` (구현 완료 후)
Target: `spec/4-nodes/3-ai` (`0-common.md` / `1-ai-agent.md`)
검토 기준: M-1 2단계 `AiMemoryManager` 추출 (`commit 3369fcef`, branch `claude/refactor-m1-memory-manager`)

---

## 발견사항

- **[INFO]** planner 후속 SPEC-DRIFT — frontmatter `code:` 미등재 및 구현 참조 미갱신
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 및 §6.1 step 3a / §6.1 단계 1.3·1.5·2.7 본문
  - 관련 plan: `plan/in-progress/refactor/02-architecture.md` M-1 "planner 후속(비차단 SPEC-DRIFT)" 항목
  - 상세: M-1 2단계 완료 후 `ai-memory-manager.ts` 가 `1-ai-agent.md` frontmatter `code:` 에 미등재. §6.1 단계 1.3/1.5/2.7 의 구현 참조 위치가 여전히 `ai-agent.handler.ts` 를 가리키는 상태. M-1 1단계의 `ai-condition-evaluator.ts` 도 동일하게 미등재. `impl-done review/consistency/2026/06/21/22_00_44/` 에서 이미 WARNING 으로 기록된 사항 — plan 내에서 planner backlog 로 명시됨.
  - 제안: plan 의 "planner 후속" 항목으로 이미 추적 중. M-1 전체 완료(3단계) 후 일괄 갱신 예정이므로 별도 조치 불요. 추적 메모 수준.

- **[INFO]** `ai-context-memory-followup-v2.md` 잔여 backlog 의 spec 반영 대기
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §6.2 d.5 (auto-memory multi-turn 실행 경로 부연) / `spec/4-nodes/3-ai/0-common.md` §10
  - 관련 plan: `plan/in-progress/ai-context-memory-followup-v2.md` "v2 코드 리뷰 도출 백로그" 미체크 항목 (`§6.2 d.5 본문에 auto-memory multi-turn 실행 경로 부연(SPEC-DRIFT I-2)`, `meta.memory.compactedMessages ND-AG-30 열거`)
  - 상세: M-1 2단계는 behavior-preserving refactor 로 이 backlog 항목들을 신설·해소·충돌하지 않는다. 단 spec 본문의 미갱신 항목이 이 plan 에 잔류 중임을 확인.
  - 제안: 충돌 없음. `ai-context-memory-followup-v2.md` 내 미체크 항목 자체의 진행 책임은 해당 plan 에 있음. M-1 2단계와 직교하므로 현 검토에서 조치 불요.

- **[INFO]** `node-output-redesign/ai-agent.md` 의 spec↔impl gap 항목은 M-1 2단계와 무관하게 잔존
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §7 출력 구조 전반
  - 관련 plan: `plan/in-progress/node-output-redesign/ai-agent.md` (잔여 권고 — `output.error` envelope 미구현, `status:'resumed'` 미발행, `config` echo 필드 불일치)
  - 상세: M-1 2단계는 메모리 관리 로직만 추출하며 §7 출력 구조에 변화를 주지 않음. 이 plan 의 gap 항목은 M-1 2단계로 해소되지 않으나, M-1 2단계가 이를 악화시키거나 차단하지도 않는다.
  - 제안: 충돌·차단 없음. 추적 메모 수준.

---

## 요약

`spec/4-nodes/3-ai` target 과 `plan/in-progress/**` 진행 중 plan 간 CRITICAL 또는 WARNING 등급의 정합성 충돌은 발견되지 않았다. M-1 2단계 `AiMemoryManager` 추출은 behavior-preserving refactor 로, `ai-agent-tool-connection-rewrite.md` 의 미결정 사항(도구 등록 모델·시그니처 위치 등), `ai-context-memory-followup-v2.md` 의 잔여 backlog, `exec-park-durable-resume.md` 의 durable resume 선행 phase 어느 것과도 충돌하지 않는다. spec frontmatter `code:` 미등재와 구현 참조 미갱신은 plan 내 planner 후속으로 이미 추적 중이며 M-1 전체 완료 후 일괄 처리 예정이다.

---

## 위험도

NONE
