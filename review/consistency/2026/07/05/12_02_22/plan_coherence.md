# Plan 정합성 검토 — spec-draft-ai-context-memory-close.md

## 검토 대상
- Target: `plan/in-progress/spec-draft-ai-context-memory-close.md` (spec draft, `ai-context-memory-followup-v2` 종결 + pending_plans 정리 + status 승격 + `webchat-widget-refactor` 이동)
- 대조: `plan/in-progress/**` 전체(특히 `ai-context-memory-followup-v2.md`, `webchat-widget-refactor.md`, `ai-agent-tool-connection-rewrite.md`, `exec-park-durable-resume.md`, `node-output-redesign/information-extractor.md`)

## 사실 검증 요약

target draft 가 근거로 드는 코드/spec 현재 상태를 직접 확인했다.

- `spec/conventions/node-output.md:90` — draft 주장대로 `meta.memory?` 가 이미 "ai_agent 전용" + IE echo 안 함 + `ai-agent §7.1` SoT 링크로 기술돼 있음. **일치**.
- `spec/4-nodes/3-ai/3-information-extractor.md:163, :694` — draft 주장대로 `memoryState.lastExtractionTurnSeq`(I12) + 구 평면 키 폴백 서술이 이미 반영돼 있음. **일치**.
- `spec/5-system/17-agent-memory.md §7` — "실현됨(v2)" 5건 + "남은 로드맵" 1건(사용자 식별자 연동, 조건부 미래 항목)으로 정확히 draft 서술과 일치.
- 4개 spec frontmatter(`0-common.md`/`1-ai-agent.md`/`17-agent-memory.md`/`conversation-thread.md`)의 현재 `pending_plans`/`status` 값도 draft 표와 일치.
- 선례로 인용한 `spec/3-workflow-editor/3-execution.md §6`(브레이크포인트 "향후 로드맵" + `implemented` 복귀, 2026-06-16 종결 노트)도 실재하며 draft 의 유추(활성 plan 없는 명시적 future-roadmap → `implemented` + 로드맵 표기)와 동형.
- `webchat-widget-refactor.md` — 전 항목 `[x]`, 후속 PR(B1/#744)도 완료 기록. draft 의 "완전 완료, spec_impact:[]" 서술과 일치.

## 발견사항

### INFO — `ai-agent-tool-connection-rewrite.md` / `exec-park-durable-resume.md` 는 `1-ai-agent.md`·`conversation-thread.md` pending_plans 잔존과 무관한 별도 사유로 존속 중 (정합)
- target 위치: draft "pending_plans 참조 현황" 표, `1-ai-agent.md`/`conversation-thread.md` 행("2개 잔존"/"1개 잔존", `partial` 유지)
- 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md`(§1 디자인 결정 미착수, TBD 5건), `plan/in-progress/exec-park-durable-resume.md`(Phase A/B 진행 중, durable resume state)
- 상세: 두 plan 모두 실제로 `1-ai-agent.md`(`ai-agent-tool-connection-rewrite`, `exec-park-durable-resume`)와 `conversation-thread.md`(`exec-park-durable-resume`)의 `pending_plans`에 남아 있고, target draft 는 이 두 항목을 "잔존"으로 정확히 카운트해 두 spec 의 `status: partial` 을 유지하기로 했다. 두 plan 의 미해결 결정(도구 연결 모델 TBD, durable resume Phase B)과 target draft 가 충돌하는 결정을 내리지 않는다 — target 은 오직 `ai-context-memory-followup-v2` 관련 pending_plans 항목만 제거한다.
- 제안: 조치 불요. 기록 목적의 INFO. target draft 의 "2개/1개 잔존" 카운트가 정확함을 재확인했다는 점만 남긴다.

### INFO — Batch 2 후속 2건(checkbox 완료 처리)이 `node-output-redesign/information-extractor.md` 의 별도 미해결 항목과 영역이 분리돼 충돌 없음
- target 위치: draft "변경 1" (`ai-context-memory-followup-v2.md` 잔여 2 checkbox `[x]` 처리 대상 — node-output.md meta.memory 정정, 3-information-extractor.md watermark 명칭)
- 관련 plan: `plan/in-progress/node-output-redesign/information-extractor.md` (§5 output envelope 구조 — waiting `config` echo 비대칭, `resumed` snapshot 미구현, `turnDebugHistory` cap 등 잔여 `[ ]` 다수)
- 상세: 두 문서 모두 `3-information-extractor.md`/`node-output.md` 를 다루지만, target 의 두 checkbox 는 §7(회수/추출 watermark 서술)·`node-output.md` Principle 2 표(meta.memory 소유권)에 국한되고, `node-output-redesign/information-extractor.md` 의 미해결 항목은 §5(output envelope 구조: waiting/종결 echo 비대칭, `status:'resumed'` 미구현, cap 부재)로 서로 다른 영역이다. target 이 완료 처리하려는 두 항목이 이 plan 의 잔여 `[ ]` 항목을 무효화하거나 전제로 삼지 않는다.
- 제안: 조치 불요. 두 plan 문서 간 참조 관계가 없음을 확인한 기록.

## 요약

target spec-draft 가 "이미 main 에 반영된 stale checkbox" 라고 주장하는 두 항목(`node-output.md` meta.memory 정정, `3-information-extractor.md` watermark 명칭)은 실제 spec 본문 대조 결과 정확히 일치했고, 4개 spec frontmatter 의 `pending_plans`/`status` 변경 계획도 각 spec 의 현재 상태·다른 in-progress plan(`ai-agent-tool-connection-rewrite`, `exec-park-durable-resume`)의 잔존 참조와 정합한다. `17-agent-memory.md`/`0-common.md` 의 `partial → implemented` 승격 논거로 인용한 `3-execution.md §6` 선례도 실재하며 draft 의 유추와 동형이다. `webchat-widget-refactor.md` 이동 근거도 실제 완료 상태와 일치한다. 미해결 결정과의 충돌, 선행 plan 미해소, 후속 항목 무효화 중 어느 것도 발견되지 않았다 — target 은 정확히 스코프를 좁혀 `ai-context-memory-followup-v2` 관련 참조만 제거하고 무관한 pending_plans 항목(도구 연결 재설계, durable resume)은 손대지 않는다.

## 위험도
NONE
