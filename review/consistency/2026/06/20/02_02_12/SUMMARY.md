# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**CRITICAL** — `spec/4-nodes/3-ai/1-ai-agent.md` 의 `*ModelConfigId` 필드 정의가 `spec/5-system/17-agent-memory.md` 의 기존 `embeddingModel`/`extractionModel` bare-string 정의와 필드명·타입·provider 아키텍처 세 차원 모두에서 충돌함. 구현자가 어느 스키마를 따라야 할지 결정 불가 상태.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | 임베딩·추출·요약 모델 선택 아키텍처 충돌 — 필드명·타입·provider 분리 방식 모두 불일치 | `spec/4-nodes/3-ai/1-ai-agent.md` §1 (`embeddingModelConfigId` / `summaryModelConfigId` / `extractionModelConfigId`) | `spec/5-system/17-agent-memory.md` §1·§3·AGM-04 (`embeddingModel` bare-string, `llmConfigId` provider 공유) | `17-agent-memory.md` §1·§3·§4·AGM-04 를 target 의 `*ModelConfigId` UUID 방식(독립 provider/credential)으로 일괄 업데이트. `embeddingModel`→`embeddingModelConfigId`, `extractionModel`→`extractionModelConfigId`, `summaryModelConfigId` 신규 추가, `embedding-model-selector`→`embedding-config-selector` 정정, AGM-04 fallback 재기술 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `summaryModelConfigId` 동작이 `17-agent-memory.md` 에 완전 누락 | `spec/4-nodes/3-ai/1-ai-agent.md` §1·§6.1 | `spec/5-system/17-agent-memory.md` §3 (항목 없음) | `17-agent-memory.md` §Overview 또는 §3 에 `summaryModelConfigId` 참조 또는 SoT 링크 추가 |
| 2 | Cross-Spec | 임베딩 fallback 3단계 기술 불일치 (`text-embedding-3-small` 하드코딩 최후 폴백 미언급) | `spec/4-nodes/3-ai/1-ai-agent.md` §1 | `spec/5-system/17-agent-memory.md` §3 폴백 체인 3단계 | target §1 `embeddingModelConfigId` 설명에 3단계 폴백 추가하거나, `17-agent-memory.md` §3 을 `ModelConfigService.resolveEmbedding` 단일 링크 참조로 통일 |
| 3 | Rationale | `3-information-extractor.md §9` 에 IE 전용 `embeddingModelConfigId`/`extractionModelConfigId` 채택 근거 누락 | `spec/4-nodes/3-ai/3-information-extractor.md §9 Rationale` | `spec/4-nodes/3-ai/1-ai-agent.md §12.12` 재번복 결정 | `§9.4 embeddingModelConfigId/extractionModelConfigId ModelConfig 선택 방식 채택` 항 추가 (IE 적용 근거, IE 는 `summaryModelConfigId` 미보유 이유, 구 필드 graceful degrade 기술) |
| 4 | Convention | `meta.memory.strategy` echo 의 Principle 2 / 1.1 예외 근거 미명시 | `spec/4-nodes/3-ai/1-ai-agent.md` §7.1 `meta.memory` 표 `strategy` 행 | `spec/conventions/node-output.md` Principle 2·1.1 | `meta.contextInjection` 비고와 동일하게 "적용된 결과 (config echo 아님, Principle 2 정합)" 주석 추가 또는 `strategy` 필드 제거 |
| 5 | Convention | 신규 `*ModelConfigId` 필드의 config echo 생략 조건 미명시 — Principle 7 | `spec/4-nodes/3-ai/1-ai-agent.md` §7 Config echo 비고 | `spec/conventions/node-output.md` Principle 7 | §7 비고에 "UUID 참조로 자격증명 아님, 미설정 시 `undefined` echo 회피 목적으로 생략 — Principle 7 optional 허용 패턴" 근거 설명 추가 |
| 6 | Naming | `chat-config-selector` 와 `llm-config-selector` 구분 근거 spec 미노출 (plan 메모에만 기술) | `spec/3-workflow-editor/1-node-common.md` `chat-config-selector` 행 | `spec/3-workflow-editor/1-node-common.md` `llm-config-selector` 정의 | `chat-config-selector` 설명에 "AI Assistant pendingUserConfig 비대상; `llm-config-selector` 와 kind=chat 동일하나 자체 라벨 렌더 없이 FieldGroup 위임" 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | AGM-04 구 필드명 `extractionModel` 잔류 (CRITICAL 해소 시 자동 해소) | `spec/5-system/17-agent-memory.md` §3 AGM-04 | CRITICAL 수정 시 `extractionModelConfigId` 로 함께 정정 |
| 2 | Rationale | `§12.12 "현 결정"` 단락의 폐기 fallback 체인에 ⚠️ 보존 주석 미표시 | `spec/4-nodes/3-ai/1-ai-agent.md §12.12` "현 결정(번복)" 단락 | "⚠️ 이 단락의 fallback 체인·저장 형태 기술(모델명 문자열)은 아래 재번복 결정에서 대체됐다. 의사결정 이력으로만 보존한다" 추가 |
| 3 | Convention | `0-common.md` `## Overview` 섹션 헤더 누락 | `spec/4-nodes/3-ai/0-common.md` 최상단 | 인라인 설명을 `## Overview` 헤더 아래로 이동 |
| 4 | Convention | 출력 케이스 헤더 `### Case:` 패턴 미준수 (섹션 번호 포함 형식 사용 중) | `spec/4-nodes/3-ai/1-ai-agent.md` §7.1~§7.9 | 케이스 헤더 점진 정규화 또는 규약에 확장 표제 허용 주석 추가 |
| 5 | Convention | `0-common.md §5` 제목 내 `(Principle 11)` 인라인 참조 — 번호 변경 시 coupling | `spec/4-nodes/3-ai/0-common.md §5` | 제목을 "응답 형식 규약" 으로 변경하고 본문에 앵커 링크 삽입 |
| 6 | Plan | `agent-memory-model-select.md` SUPERSEDED 배너 정상 기재 — 미완료 체크박스 별도 이행 불필요 | `plan/in-progress/agent-memory-model-select.md` | 현 상태 정합 |
| 7 | Plan | `ai-context-memory-followup-v2.md` 미완료 백로그 2건이 동일 spec 영역 교차 (무효화 없음) | `plan/in-progress/ai-context-memory-followup-v2.md` | 향후 별도 이행 예정 확인으로 충분 |
| 8 | Plan | `agent-memory-model-config.md` `/ai-review + impl-done` 체크박스 미완료 — 본 검토가 해당 게이트 | `plan/in-progress/agent-memory-model-config.md` | 본 consistency-check 완료 후 `/ai-review → impl-done` 순서로 진행 |
| 9 | Naming | `embeddingModelConfigId` — KB 도메인 동명 필드와 의미 충돌 없음 (의도적 명명 일관성) | `spec/4-nodes/3-ai/1-ai-agent.md` §1 | `data-flow/6-knowledge-base.md` probe 파라미터 설명에 "(KB 전용, agent-memory 필드와 별개)" 주석 권장 |
| 10 | Naming | §12.12 이력 단락 내 구 필드명(`summaryModel`/`extractionModel`) 잔존 — ⚠️ 주석 보강 권장 | `spec/4-nodes/3-ai/1-ai-agent.md §12.12` "현 결정(번복)" 단락 | "⚠️ 이 단락은 v2(모델명 문자열) 결정 이력 — 현행 필드명은 `summaryModelConfigId`/`extractionModelConfigId`" 주석 추가 |
| 11 | Naming | `embedding-model-selector`/`chat-model-selector` — main 브랜치 잔존 참조 (본 PR 머지 시 자동 해소) | `spec/3-workflow-editor/1-node-common.md` (main 브랜치), `spec/5-system/17-agent-memory.md` (main 브랜치) | PR 머지 후 자동 해소 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | CRITICAL | `1-ai-agent.md`의 `*ModelConfigId` UUID 독립-provider 방식과 `17-agent-memory.md`의 bare-string `llmConfigId` 재사용 방식 충돌 — 스키마 결정 불가 |
| Rationale Continuity | LOW | `ai_agent §12.12` 4단계 이력 완비. IE 전용 채택 근거 누락(WARNING) 및 "현 결정" 단락 폐기 표시 부재(INFO) |
| Convention Compliance | LOW | 핵심 Principle 전반 준수. `meta.memory.strategy` Principle 2 예외 미명시(WARNING), `*ModelConfigId` echo 생략 조건 미명시(WARNING), 구조·형식 권장 3건(INFO) |
| Plan Coherence | NONE | CRITICAL/WARNING 발견 없음. SUPERSEDED 배너 정상, tool-connection 미결 결정과 직교 확인 |
| Naming Collision | LOW | CRITICAL 충돌 없음. `chat-config-selector` vs `llm-config-selector` 구분 근거 spec 미노출(WARNING) |

## 권장 조치사항

1. **(BLOCK 해소 필수)** `spec/5-system/17-agent-memory.md` §1·§3·§4·AGM-04 를 `*ModelConfigId` UUID 방식으로 일괄 업데이트 — `embeddingModel`→`embeddingModelConfigId`, `extractionModel`→`extractionModelConfigId`, `summaryModelConfigId` 신규 추가, `embedding-model-selector`→`embedding-config-selector`, AGM-04 fallback 재기술, enqueue payload 경로 정정.
2. **(BLOCK 해소 후속)** `17-agent-memory.md` §Overview 또는 §3 에 `summaryModelConfigId` SoT 링크 또는 항목 추가 (WARNING #1 해소).
3. `spec/4-nodes/3-ai/1-ai-agent.md` §1 `embeddingModelConfigId` 설명에 3단계 폴백(`→ text-embedding-3-small`) 추가 또는 `17-agent-memory.md` §3 을 `ModelConfigService.resolveEmbedding` 단일 참조로 통일 (WARNING #2 해소).
4. `spec/4-nodes/3-ai/3-information-extractor.md §9` 에 `§9.4` 항 추가 — IE의 `embeddingModelConfigId`/`extractionModelConfigId` 채택 근거 및 `summaryModelConfigId` 미보유 이유 기술 (WARNING #3 해소).
5. `1-ai-agent.md §7.1 meta.memory` 표 `strategy` 행에 Principle 2 정합 주석 추가 (WARNING #4 해소).
6. `1-ai-agent.md §7` config echo 비고에 `*ModelConfigId` 생략 조건 근거 추가 (WARNING #5 해소).
7. `spec/3-workflow-editor/1-node-common.md` `chat-config-selector` 행에 `llm-config-selector` 와의 구분 근거 추가 (WARNING #6 해소).
8. (선택) `§12.12 "현 결정"` 단락에 ⚠️ 이력 보존 주석 추가, `0-common.md §5` 제목 coupling 해소, `## Overview` 헤더 추가 (INFO 개선).

---

*검토 세션: `review/consistency/2026/06/20/02_02_12/` | 모드: `--impl-done` | 대상: `spec/4-nodes/3-ai`*