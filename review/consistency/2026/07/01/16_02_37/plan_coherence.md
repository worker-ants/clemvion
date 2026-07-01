# Plan 정합성 검토 결과

검토 대상: `spec/4-nodes/3-ai/1-ai-agent.md`
참조 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md`, `plan/in-progress/ai-context-memory-followup-v2.md`, `plan/in-progress/exec-park-durable-resume.md`

---

## 발견사항

### [INFO] `ai-context-memory-followup-v2.md` — 타 spec 파일 대상 미완료 항목 2건

- target 위치: 해당 없음 (target 문서 자체는 영향 없음)
- 관련 plan: `plan/in-progress/ai-context-memory-followup-v2.md` 하단 "Batch 2 후속 — 별건 spec PR" 섹션
- 상세:
  - `[ ] node-output.md` Principle 2 meta.memory 행: `ai_agent / information_extractor` → `ai_agent` 단독 정정 (IE 핸들러 미emit, Batch 1 #726 오기 정정 + SoT 링크 `ai-agent §7.1` 교정)
  - `[ ] 3-information-extractor.md` l.163·l.684: watermark 참조 `lastExtractionTurnSeq` → `memoryState.lastExtractionTurnSeq` (I12 정합)
  - 두 항목 모두 target 이 아닌 타 spec 파일 대상. target 의 §7.1 `meta.memory` 정의는 AI Agent 전용으로 정확히 기술돼 있어 충돌 없음.
- 제안: 두 항목은 해당 spec 파일(`node-output.md`, `3-information-extractor.md`) 변경으로 해소해야 하며 별도 spec PR 필요. 본 target 문서는 갱신 불요.

---

### [INFO] `exec-park-durable-resume.md` — 잔여 항목이 target 에 무영향이나 `pending_plans` 등록 유지 중

- target 위치: frontmatter `pending_plans: - plan/in-progress/exec-park-durable-resume.md`
- 관련 plan: `plan/in-progress/exec-park-durable-resume.md` 하단 "umbrella 잔여 (분리)" 항목
- 상세:
  - exec-park 계획의 AI Agent 관련 spec 변경(A1/A2a/A2b/A3·B1/B2a/B2b·doc polish·spec flip)은 모두 완료(commits 기록됨).
  - 잔여 미완료 항목(`[ ]` 1건)은 "PR3 rehydration 일반화(ai_agent → 일반 노드 + 멱등 재개)", "node-cancellation §2", "W4 cross-worktree rebase" 로, target `1-ai-agent.md` 에 영향이 없는 다른 노드 타입 일반화 및 별도 worktree 이슈다.
  - target 의 §6(구현 레이어 주석), §7.4(`_resumeState`/`_resumeCheckpoint` 생명주기 비교표), §7.5(rehydration) 모두 exec-park plan 의 spec flip 완료 결과와 정합.
- 제안: 잔여 작업이 target 에 무관하므로 `pending_plans` 에서 제거 가능하나 강제 사항 아님(plan 자체가 아직 in-progress이므로 현 상태 유지도 무해). 계획 종결 시 자동 해소.

---

### [INFO] `ai-agent-tool-connection-rewrite.md` — 미해결 결정과 target 의 defer 마커 정합 확인

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §1 경고 박스, §4 Tool Area 연동 섹션 전체, §6.1 step 3.a, §10 `TOOL_EXECUTION_FAILED`
- 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §1 "디자인 결정" (도구 등록 모델/시그니처 위치/실행 컨텍스트/결과 라우팅/ND-AG-21 우선순위 — 전부 TBD)
- 상세:
  - target 은 `toolNodeIds`/`toolOverrides` 필드와 캔버스 Tool Area UX 를 "재작성 예정 (현재 제거됨)"으로 정확히 마킹하고, 일반 도구(`tool_*`) 호출 시 가짜 성공 stub 회신을 "현재 fallback" 으로 명시하며 `tool_call_not_implemented` 는 "미구현 (Planned)" 표시.
  - plan 의 5가지 TBD 결정을 target 이 일방적으로 결정한 내용 없음. 모든 관련 절이 defer 상태를 올바르게 반영.
  - plan 노트에 "tool_* 모델 확정 시 §6.1 step 3a dispatcher 분류 순서 갱신 필요" 가 이미 명시돼 있어 향후 작업 범위도 추적됨.
- 제안: target 및 plan 모두 현 상태를 올바르게 반영. 갱신 불요.

---

## 요약

`spec/4-nodes/3-ai/1-ai-agent.md` 는 frontmatter 에 열거된 세 in-progress plan 모두와 정합한다. `ai-agent-tool-connection-rewrite.md` 의 미해결 5개 결정은 target 내 "재작성 예정 (현재 제거됨)" 마커로 올바르게 defer 처리돼 있으며, target 이 이들 결정을 일방적으로 내린 부분이 없다. `ai-context-memory-followup-v2.md` 의 미완료 2개 항목은 타 spec 파일(`node-output.md`, `3-information-extractor.md`) 대상이라 target 과 충돌 없다. `exec-park-durable-resume.md` 의 잔여 항목(PR3 generalization 등)은 target 에 영향이 없고, AI Agent 관련 spec flip 은 모두 완료 상태로 target 과 정합한다. CRITICAL·WARNING 발견사항 없음.

## 위험도

LOW
