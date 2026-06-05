# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 (`--impl-done`), scope=`spec/5-system/`, diff-base=`origin/main`

---

## 발견사항

### 발견사항 1

- **[WARNING]** `spec/5-system/17-agent-memory.md` — `extractionModel` 기각 처리, 새 Rationale 없음
  - **target 위치**: `spec/5-system/17-agent-memory.md §3 추출 파이프라인` (line ~62~67) 및 AGM-04 요구사항 노트 (line ~77)
  - **과거 결정 출처**: `spec/5-system/17-agent-memory.md §3` 본문 및 `spec/4-nodes/3-ai/1-ai-agent.md §12.12` (origin/main 기준). 해당 baseline 에는 `extractionModel` 필드가 "추출 모델 fallback 체인 `extractionModel → model → llmConfig.defaultModel`" 로 확정·문서화되어 있었고, 동일 내용이 `AGM-04` 요구사항 노트("추출 모델 = `extractionModel ?? 노드 model ?? llmConfig 기본`")에도 명시됨.
  - **상세**: target 브랜치 diff 에서 해당 라인이 "노드 `model`/`llmConfigId` 재사용 (별도 추출 모델 필드 신설 없음 — scope-freeze)" 한 줄로 대체됐다. 이는 사실상 `extractionModel` 필드의 철회인데, 철회의 근거(왜 scope-freeze 했는가, 어떤 trade-off 를 수용하는가)가 `## Rationale` 에 없다. `scope-freeze` 라는 약어만으로는 후속 독자가 "의도적 feature 철회" 와 "미구현 후속 작업" 을 구분할 수 없다. 또한 원 baseline 에서 `pending_plans` 에 있던 `plan/in-progress/agent-memory-summary-model.md` (extractionModel/summaryModel 관련 plan)도 함께 제거됐는데 관련 근거가 없다.
  - **제안**: `spec/5-system/17-agent-memory.md` 의 `## Rationale` 에 "extractionModel/summaryModel 필드 scope-freeze 결정 — 이 PR 의 범위(rerank followup)에서 해당 feature 를 포함하지 않기로 결정한 이유(예: 범위 과도 확장, 별도 plan으로 분리)" 를 한 항목으로 추가하거나, 또는 해당 라인 삭제 없이 `pending_plans` 항목을 유지하여 '미구현'으로 남겨두는 방식 중 하나를 선택한다. 후자가 더 안전(기존 spec 을 번복하지 않음).

---

### 발견사항 2

- **[WARNING]** `spec/5-system/17-agent-memory.md` — §6 메모리 관리 API 전체 제거 (AGM-12/AGM-13 번복), 새 Rationale 없음
  - **target 위치**: `spec/5-system/17-agent-memory.md §6` (line ~74~130), 로드맵 섹션 (line ~131)
  - **과거 결정 출처**: origin/main 의 `17-agent-memory.md §6 "메모리 관리 API (조회·삭제, admin surface)"` — `GET /agent-memories/scopes`, `GET /agent-memories`, `DELETE /agent-memories/:id`, `DELETE /agent-memories?scopeKey=` 4개 엔드포인트, viewer+/editor+ 권한, hard delete, workspace 격리, embedding 제외 정책이 확정 spec 으로 기술되어 있었고, `AGM-12`/`AGM-13` 요구사항 노트, `pending_plans` 의 `plan/in-progress/agent-memory-admin-ui.md`, 로드맵 섹션의 "✅ 메모리 가시화 UI 구현 완료" 마킹, 그리고 `spec/2-navigation/16-agent-memory.md` 레퍼런스까지 포함.
  - **상세**: target 에서 §6 전체가 삭제되어 섹션 번호가 §6 → "v2 로드맵"(이전 §7)으로 교체됐다. 로드맵의 "✅ 메모리 가시화 UI 구현 완료" 항목도 제거되고, 대신 "남은 로드맵" 으로 이동됐다. 이는 (a) 구현 완료로 표기됐던 기능을 미구현으로 격하하거나, 또는 (b) 본 브랜치 scope 에서 이미 구현된 §6 를 제거하는 것인데, 어느 경우든 Rationale 없이 과거 결정(AGM-12/AGM-13, 구현 완료 마킹)을 번복한다. `pending_plans` 에서 `agent-memory-admin-ui.md` 도 함께 제거됐다. 단, `spec/2-navigation/16-agent-memory.md` 레퍼런스가 여전히 존재하는지 확인 필요.
  - **제안**: `spec/5-system/17-agent-memory.md` 의 `## Rationale` 에 "§6 admin surface 를 본 PR scope 에서 제외한 이유" 를 명시한다. 또는 §6 를 삭제하지 않고 구현 상태 표기만 정정(`status: partial` 등)하는 방식이 Rationale 연속성 위반 위험을 낮춘다. `16-agent-memory.md` 와의 참조 정합도 확인한다.

---

### 발견사항 3

- **[WARNING]** `spec/5-system/4-execution-engine.md` — `schemaVersion` checkpoint 검증 로직 제거, Rationale 없음
  - **target 위치**: `spec/5-system/4-execution-engine.md §1.3 _resumeCheckpoint` 소비 항목 (line ~156~161)
  - **과거 결정 출처**: origin/main 의 `4-execution-engine.md §1.3` — "`schemaVersion` 검증: 버전 부재/현재 이하면 backward-compatible 재구성, 현재 초과면 `RESUME_INCOMPATIBLE_STATE`" 로 명시된 결정. 또한 `spec/5-system/3-error-handling.md §1.4` 의 `RESUME_INCOMPATIBLE_STATE` 정의에서도 "미래 버전(`schemaVersion` 이 현재 코드 지원 버전 초과)" 케이스가 명시돼 있었음.
  - **상세**: target 에서 `_resumeCheckpoint` 의 `schemaVersion` 동봉 및 버전 검사 로직 전체가 소비 항목에서 제거됐다. "버전 부재 또는 손상 시 graceful reset" 만 남고 "미래 버전 초과 시" 케이스가 삭제됐다. 이는 rolling deployment 중 구 인스턴스가 신 포맷 checkpoint 를 읽는 위협을 방어하는 명시적 결정을 번복하는 것이며, `3-error-handling.md §1.4` 의 `RESUME_INCOMPATIBLE_STATE` 설명도 함께 축소됐다(`미래 버전` 케이스 제거). 두 spec 문서가 동시에 변경됐으나 폐기 근거가 없다.
  - **제안**: `4-execution-engine.md` 의 `## Rationale` 에 "schemaVersion 검증 제거 — 왜 rolling-deploy 중 미래 버전 checkpoint pickup 위협을 허용 가능한 수준으로 판단했는가" 를 추가한다. 또는 `schemaVersion` 로직이 실제 코드에서 구현되어 있다면 spec 에서만 삭제된 것이므로 spec 을 복원한다.

---

### 발견사항 4

- **[WARNING]** `spec/5-system/4-execution-engine.md` — `Execution.conversation_thread` / `Execution.user_variables` durable commit 스펙 제거, Rationale 없음
  - **target 위치**: `spec/5-system/4-execution-engine.md §6.2 상태 저장` 테이블 (line ~195~199) 및 `§7.5 rehydration` 흐름 주석 (line ~177~179)
  - **과거 결정 출처**: origin/main 의 `4-execution-engine.md §6.2` — "waiting_for_input 진입 시" 행에 `Execution.conversation_thread jsonb`(V084) 와 `Execution.user_variables jsonb`(V085) 컬럼에 durable commit 하는 결정이 명시됐으며, `§4.3` 주석에서 "conversationThread 의 durable park-resume" 은 Phase A1 구현 완료로 선언됐음. `conversation-thread spec §4/§8.4` 도 cross-reference 됨.
  - **상세**: target 에서 "waiting_for_input 진입 시" 저장 대상이 `PostgreSQL (NodeExecution.outputData)` 만 남고 `Execution.conversation_thread` / `Execution.user_variables` 컬럼이 제거됐다. §4.3 의 "Phase A1 구현 완료" 주석도 삭제됐다. `variables.*` 테이블 행의 durable commit 설명도 단순화됐다. 이는 이미 구현 완료로 표기된 기능을 번복하는 것이며, 이 변경이 "실제 코드 현실을 spec 에 맞춘 것" 인지 "spec 을 구현보다 후퇴시킨 것" 인지 명확하지 않다. 관련 Rationale 항목 없음.
  - **제안**: `4-execution-engine.md` 의 `## Rationale` 에 "V084/V085 컬럼 durable commit 기능을 spec 에서 제거한 이유" 를 추가한다. 만약 이 기능이 본 브랜치의 실제 구현 범위에 없어 revert 한 것이라면, "Phase A1 미구현" 로 표기 변경이 적절하다. `conversation-thread spec §4/§8.4` 와의 정합도 확인 필요.

---

### 발견사항 5

- **[INFO]** `spec/5-system/4-execution-engine.md` — `information_extractor` checkpoint 지원 번복, 설명은 있으나 Rationale 에 없음
  - **target 위치**: `spec/5-system/4-execution-engine.md §1.3 _resumeCheckpoint 적용 범위` (line ~154~155) 및 `## Rationale` 의 해당 항목 삭제
  - **과거 결정 출처**: origin/main 의 `4-execution-engine.md §1.3` — "`ai_agent` 와 `information_extractor` 의 multi-turn, checkpoint allow-list 는 두 핸들러 runtime state 의 합집합"으로 확정. `## Rationale` 에도 "`ai_agent` + `information_extractor` 지원" 확장 근거가 명시됨.
  - **상세**: target 에서 `information_extractor` 지원이 다시 "후속 작업"으로 격하됐다. 본문에 간략한 설명("회귀 없음")은 있으나, `## Rationale` 의 "`ai_agent` + `information_extractor` 지원" 항목이 짧은 한 줄로 대체됐다. 이는 과거 Rationale 에서 확립한 결정을 번복하는 것이지만, 본문에서 최소한의 설명("본 기능 도입 이전과 동일한 동작이므로 회귀 없음")이 있어 CRITICAL 수준은 아니다. Rationale 에 번복 근거 보강 권장.
  - **제안**: `4-execution-engine.md ## Rationale` 에 "information_extractor checkpoint 지원을 이 PR 에서 다시 보류한 이유(예: 범위 과도, 별도 PR 추적)" 를 명시한다.

---

### 발견사항 6

- **[INFO]** `spec/5-system/4-execution-engine.md` — `EXECUTION_TIME_LIMIT_EXCEEDED` / `EXECUTION_MAX_ACTIVE_RUNNING_MS` 구현 상태 후퇴
  - **target 위치**: `spec/5-system/4-execution-engine.md §8 동시 실행 제한` (line ~378~) 및 `## Rationale`
  - **과거 결정 출처**: origin/main 의 `4-execution-engine.md §8` — "PR2a 구현 완료", "1단계 env 상수 구현 완료" 로 선언. `§4.2` PR1 메모에도 "active-running 직렬화 불변식 (PR2a)" 주석 포함.
  - **상세**: target 에서 §8 제목에 "(미구현 — Planned)" 가 붙었고, "PR2a 구현 완료" 표기가 모두 제거됐다. `EXECUTION_MAX_ACTIVE_RUNNING_MS` 환경 변수 설명, graceful shutdown under-count 허용 Rationale, 한도 판정 `>=` 보수적 선택 Rationale 도 모두 삭제됐다. 이 변경이 "실제로 PR2a 를 이 브랜치에서 revert 했다" 는 의미인지, 아니면 "main 에 이미 있는 구현이 별도 PR 로 들어가 있는데 이 비교 diff 에서 충돌을 정리했다" 는 의미인지 불명확하다. 어느 쪽이든 구현 완료로 표기됐던 사항을 미구현으로 격하하는 변경이므로 Rationale 표기가 있어야 한다. 단, 이 변경이 이 브랜치의 scope(rag-rerank-followup)와 직접 관련이 없어 다른 브랜치 충돌 정리의 side-effect 일 가능성이 높다.
  - **제안**: 해당 변경이 충돌 정리 side-effect 라면 origin/main 의 해당 섹션 표현을 복원하거나, `## Rationale` 에 "구현 상태 표기를 Planned 로 되돌린 이유" 를 한 문장 추가한다.

---

### 발견사항 7

- **[INFO]** `spec/5-system/1-auth.md` — historical-artifact 주석 삭제, Rationale 영향 없음
  - **target 위치**: `spec/5-system/1-auth.md §1.5.4 에러 응답` 표 아래 주석 (line ~229~)
  - **과거 결정 출처**: origin/main 의 `1-auth.md §1.5.4` — `lower_snake_case` invitation error 코드의 historical-artifact 예외 근거 주석.
  - **상세**: historical-artifact 설명 주석이 삭제됐다. 이 정보는 `spec/conventions/error-codes.md §3 historical-artifact 레지스트리` 에 별도로 등재돼 있다고 기술됐으므로, SoT 가 그쪽으로 이동한 경우 중복 제거 목적일 수 있다. 직접적인 Rationale 번복은 아니나 참조 관계가 끊긴 경우를 대비해 `error-codes.md §3` 에 해당 항목이 실제로 존재하는지 확인 권장.
  - **제안**: `spec/conventions/error-codes.md §3` 에 invitation error codes 항목이 등재되어 있으면 삭제 정당. 없다면 주석을 복원한다.

---

## 요약

이번 검토 대상(spec/5-system/ diff, rag-rerank-followup 브랜치)에서 Rationale 연속성 관점의 주요 위험은 rerank 기능 자체보다 **인접 스코프 변경**에서 집중적으로 발견됐다. `9-rag-search.md` 의 rerank 관련 변경(cross_encoder_llm 구현 반영, v1 단일 KB 제약 명시, Planned 주석 제거)은 Rationale 에서 이미 확립된 원칙(off 기본, KB 단위, wide 회수)을 일관되게 따르며 번복이 없다. 문제는 (1) `17-agent-memory.md` 에서 extractionModel 필드와 §6 admin surface 가 새 Rationale 없이 제거됐고, (2) `4-execution-engine.md` 에서 schemaVersion checkpoint 검증, information_extractor 지원, conversation_thread/user_variables durable commit, EXECUTION_TIME_LIMIT_EXCEEDED PR2a 구현 완료 표기 등 이미 확립·구현 완료 표기된 다수 결정이 Rationale 설명 없이 후퇴·제거됐다는 점이다. 이는 주로 "이 브랜치 scope 가 아닌 변경의 정리" 로 추정되나, spec 의 결정 연속성을 독자가 추적할 수 없게 만드는 WARNING 수준 문제다.

---

## 위험도

**MEDIUM**

(rerank spec 자체는 Rationale 정합. 인접 spec 섹션의 다수 결정이 근거 없이 번복·제거돼 중간 위험.)
