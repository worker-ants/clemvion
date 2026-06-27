# Plan 정합성 검토 결과

**검토 대상**: `spec/data-flow/0-overview.md`
**검토 일자**: 2026-06-28
**검토 범위**: `plan/in-progress/**` 진행 중 작업과의 충돌·미해소 선행 조건·후속 누락

---

## 발견사항

### 1. [INFO] `exec-park-durable-resume` Phase B 완료 서술이 target 과 이미 정합

- **target 위치**: `spec/data-flow/0-overview.md §5 다중 인스턴스·동시성 모델` (line 215)
- **관련 plan**: `plan/in-progress/exec-park-durable-resume.md` §B3 + Spec 변경 메모
- **상세**: target 은 "exec-park full B3 이후 park 가 항상 코루틴을 해제(release)하므로 깨울 in-memory resolver 가 없고, 옛 `pendingContinuations` fast-path 는 제거됐다" 라고 현재형으로 기술. plan 확인 시 B1·B2a·B2b(PR `2dbb31b6`) 모두 체크 완료 상태. 정합 이상 없음.
- **제안**: 조치 불필요. 추적 메모로 기록.

### 2. [INFO] `exec-intake-queue-impl` PR2b(동시성 cap) 미구현 항목이 target 에 노출되지 않음

- **target 위치**: `spec/data-flow/0-overview.md §5` — 동시성 cap 미언급
- **관련 plan**: `plan/in-progress/exec-intake-queue-impl.md` PR2b (미완료 체크박스)
- **상세**: PR2b(`maxConcurrentExecutions` cap, `queued_at` 컬럼, 우선순위 3-tier)는 아직 미구현. spec `5-system/4-execution-engine.md §8` 에 "Planned(PR2b)" 빈칸으로 남아 있으며 target `0-overview.md §5` 는 cap 에 대해 언급하지 않는다. 이는 **의도적 생략**이다 — §5 는 현재 구현된 상태만 기술하는 것이 관례이므로 충돌 아님.
- **제안**: 조치 불필요.

### 3. [INFO] `spec-sync-structural-followups §B` data-flow/9-observability 참조 존재

- **target 위치**: `spec/data-flow/0-overview.md §4 큐 카탈로그` (line 208 각주)
- **관련 plan**: `plan/in-progress/spec-sync-structural-followups.md §B` 항목 2 "data-flow/9-observability — System Status SoT 참조가 5-system/16 과 2-navigation/15 두 갈래"
- **상세**: plan §B 는 observability doc 의 cross-ref 정리를 `/consistency-check` 로 권고한 미해소 항목이다. target `0-overview.md §4` 각주는 `MONITORED_QUEUES` 를 SoT 로 지정하는데, observability 참조 두 갈래 문제는 별도 doc 에 있어 target 과 직접 충돌하지는 않는다.
- **제안**: 조치 불필요.

### 4. [WARNING] `spec-sync-structural-followups §B` console.warn 정정 잔여 — target 에는 해당 없으나 data-flow 폴더 관할

- **target 위치**: target(`0-overview.md`) 자체에는 해당 없음
- **관련 plan**: `plan/in-progress/spec-sync-structural-followups.md §B` console.warn stale 정정 (lines 63-66)
  - `spec/data-flow/1-audit.md` (line 66) 는 [x] 완료 표기
  - 잔여 3건(`1-ai-agent.md §6.2.c.fallback`, `0-common.md §6`, `14-external-interaction-api.md §1108`)은 [ ] 미완료
- **상세**: data-flow 폴더의 `1-audit.md` 는 완료됐으나, plan 에 여전히 미완 항목이 있다. target `0-overview.md` 자체에는 영향 없으나, data-flow 폴더 진입 문서로서 관련 미완 작업이 plan 에 열린 상태임을 추적.
- **제안**: plan 항목이 `1-audit.md` 완료(체크) 이후에 갱신됐음을 확인했으므로 data-flow/0-overview.md 에 직접 영향 없음. WARNING 수준은 '후속 항목 누락' 위험보다 추적 목적이 강함 — plan 원본에서 관리 중.

### 5. [INFO] `spec-code-cross-audit-2026-06-10` 잔여 위반(V-04·V-05·V-09~V-14·V-18) — target 비관련

- **target 위치**: 해당 없음
- **관련 plan**: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` line 34
- **상세**: 잔여 위반 8건은 폴더 깊이 검증·실행 상세 서브탭·초대 자동수락 등 다른 도메인 spec 에 속하며, `data-flow/0-overview.md` 와 직접 연관이 없다.
- **제안**: 조치 불필요.

### 6. [INFO] `ai-context-memory-followup-v2` Batch 2 후속 spec PR 미완 — target 비관련

- **target 위치**: 해당 없음
- **관련 plan**: `plan/in-progress/ai-context-memory-followup-v2.md` §Batch 2 후속 (lines 498-499)
  - `node-output.md` Principle 2 `ai_agent` 단독 정정 미완료
  - `3-information-extractor.md` watermark 참조 정합 미완료
- **상세**: 해당 항목들은 `spec/conventions/node-output.md` 와 `spec/4-nodes/3-ai/3-information-extractor.md` 를 대상으로 하며, `data-flow/0-overview.md` 에 영향 없다.
- **제안**: 조치 불필요.

### 7. [INFO] `spec-update-gap-callout-plan-links` — data-flow 폴더 내 다른 문서 대상, target 비관련

- **target 위치**: 해당 없음
- **관련 plan**: `plan/in-progress/spec-update-gap-callout-plan-links.md`
- **상세**: 갭 callout 링크 추가 대상이 `10-triggers.md`, `14-chat-channel.md`, `15-external-interaction.md`, `7-llm-usage.md`, `12-workspace.md` 이며 `0-overview.md` 는 포함되지 않는다.
- **제안**: 조치 불필요.

---

## 요약

`spec/data-flow/0-overview.md` 는 진행 중인 plan 들과 전반적으로 정합한 상태다. §4 BullMQ 큐 카탈로그에 `execution-run` 이 등재되고(`exec-intake-queue-impl` plan 체크 완료), §5 동시성 모델이 `exec-park-durable-resume` Phase B3 완료 후 상태를 반영하는 등 주요 설계 결정이 정확히 반영되어 있다. 동시성 cap(PR2b 미완)·관련 workspace spec 미해결 결정(전환 모델·클레임 명명 등)은 target 의 기술 범위 밖이거나 의도적으로 생략된 상태이므로 충돌이 아니다. `spec-sync-structural-followups §B` console.warn 잔여 3건이 같은 data-flow 폴더 내 다른 문서들을 대상으로 열려 있으나 target 자체에는 영향이 없다. 미해결 결정을 일방적으로 확정하거나 후속 plan 을 무효화하는 지점은 발견되지 않았다.

## 위험도

NONE
