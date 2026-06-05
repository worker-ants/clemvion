# 신규 식별자 충돌 검토 결과

검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`

검토 대상 변경 파일:
- `spec/5-system/4-execution-engine.md`
- `spec/5-system/_product-overview.md`
- `spec/5-system/17-agent-memory.md`
- `spec/4-nodes/3-ai/1-ai-agent.md`
- `spec/4-nodes/3-ai/3-information-extractor.md`
- `spec/2-navigation/_product-overview.md`
- `spec/2-navigation/16-agent-memory.md` (삭제)
- `spec/conventions/conversation-thread.md`

---

## 발견사항

### 1. INFO — `CHECKPOINT_ELIGIBLE_NODE_TYPES` / `DEFAULT_IE_MAX_COLLECTION_RETRIES` 상수 이름

- **target 신규 식별자**: `CHECKPOINT_ELIGIBLE_NODE_TYPES`(Set), `DEFAULT_IE_MAX_COLLECTION_RETRIES = 3`, `isCheckpointEligibleNodeType()` (module-private)
- **기존 사용처**: 세 식별자 모두 `origin/main` 의 `execution-engine.service.ts` 에 부재. 기존 코드는 `if (node.type === 'ai_agent')` 리터럴 가드 3곳을 직접 사용.
- **상세**: 동일 이름의 다른 의미로 쓰인 사례 없음. `DEFAULT_IE_MAX_COLLECTION_RETRIES = 3` 은 `information-extractor.handler.ts` 의 `?? 3` 하드코딩 두 곳(L350, L1407)과 의미상 동일 값을 재선언한다. 선언 위치가 다른 모듈이라 런타임 충돌은 없으나 동기화 해제 위험이 있다.
- **제안**: 향후 IE handler 기본값을 변경할 때 두 위치(`information-extractor.handler.ts` 의 `?? 3` 2곳과 `DEFAULT_IE_MAX_COLLECTION_RETRIES`)를 함께 갱신해야 함을 주석 또는 상수 참조로 명시. 현재는 INFO 수준(충돌 아님, 동기화 주의).

---

### 2. INFO — `partialResult` / `collectionRetryCount` 의 이중 의미 (checkpoint 내 runtime state vs. node output 필드)

- **target 신규 식별자**: `_resumeCheckpoint.partialResult`, `_resumeCheckpoint.collectionRetryCount` — checkpoint JSONB 내 IE runtime state 키로 도입
- **기존 사용처**:
  - `buildConversationConfigFromOutput()` 반환 타입 (L466, L481, origin/main): `collectionRetryCount?: number` — `output.partial.collectionRetryCount` 를 읽어 WS 진행률 응답에 포함하는 **응답 DTO 필드**
  - `information-extractor.handler.ts` (L93, L99): `_resumeState` 의 `partialResult: Record<string, unknown>` / `collectionRetryCount: number` — IE handler 내부 런타임 상태
  - `information-extractor.schema.ts` (L188): `collectionRetryCount: z.number().optional()` — 출력 스키마 검증용
- **상세**: 세 곳 모두 IE 의 동일 개념(진행 중인 수집 상태)을 다른 레이어에서 표현한 것이므로 의미 충돌이 아니다. 단, `_resumeCheckpoint.partialResult` 는 IE handler `_resumeState.partialResult` 를 checkpoint 에 복사하는 것이고, `output.partial.collectionRetryCount` 는 최종 노드 출력 경로(`buildConversationConfigFromOutput`)에서 읽는 것이다. 동일 필드명이 세 문맥에서 등장하므로 코드 추적 시 혼동 가능.
- **제안**: 현재 구조는 의도적이며 spec §1.3 에 명시됨. 충돌 없음. INFO만 기록.

---

### 3. INFO — 삭제된 요구사항 ID `AGM-12` / `AGM-13` 과 `NAV-AM-01`~`NAV-AM-06`

- **target 신규 식별자**: 없음 (삭제 방향)
- **기존 사용처**: `spec/5-system/_product-overview.md` 에 `AGM-12` / `AGM-13` 정의, `spec/2-navigation/_product-overview.md` 에 `NAV-AM-01`~`NAV-AM-06` 정의, `spec/2-navigation/16-agent-memory.md` 에 `NAV-AM-*` ID 참조
- **상세**: 이 PR 에서 `AGM-12`/`AGM-13` 행, `NAV-AM-*` 섹션, `16-agent-memory.md` 전체가 삭제되었다. 삭제 후 spec 전체(`spec/`)와 codebase(`codebase/`)를 검색한 결과 잔존 참조가 없어 dangling reference 없음. `agent-memory-admin-ui.md` plan 파일도 `spec/5-system/17-agent-memory.md` frontmatter 에서 제거되었으며, 해당 plan 파일은 `plan/in-progress/` 에 존재하지 않는다(origin/main 에도 없을 가능성 높음 — 삭제는 이미 외부에서 처리된 것으로 판단).
- **제안**: 충돌 없음. INFO만 기록. 단, `agent-memory-admin-ui.md` plan 이 다른 plan 에서 cross-link 되어 있을 경우 별도 확인 필요 — 이번 검색 범위에서는 발견되지 않음.

---

### 4. INFO — `spec/conventions/conversation-thread.md §9` 상위 헤더 삭제

- **target 신규 식별자**: 없음 (삭제 방향)
- **기존 사용처**: 삭제된 내용은 `## 9. 미리보기 UI 렌더 규칙` 섹션 헤더(H2)와 도입 단락. 하위 `### 9.1`~`### 9.9` 섹션은 그대로 유지됨.
- **상세**: H2 부모가 사라지고 H3 자식(`### 9.1 source 별 시각 매핑 (강제)` 등)이 직전 섹션(`## 8.`)의 말미(`sequenceDiagram` 코드블록) 바로 다음에 위치하게 된다. Markdown 렌더 구조상 `### 9.x` 는 고아(orphan) 상태가 아니라 문서 최상위 `# Spec` 의 하위로 편입되어 표면 문제는 없지만, 앵커(`#9-미리보기-ui-렌더-규칙`)가 사라져 외부 링크가 있다면 끊어진다.
- **기존 앵커 참조 검색**: `spec/` 및 `codebase/` 전체에서 `conversation-thread.*#9-` 패턴 참조를 검색한 결과 발견되지 않음. 안전.
- **제안**: 충돌·broken link 없음. INFO만 기록.

---

### 5. INFO — `spec/2-navigation/_product-overview.md` 화면 spec 맵에서 `Agent Memory` 링크 제거

- **target 신규 식별자**: 없음 (링크 제거)
- **기존 사용처**: `[Agent Memory](./16-agent-memory.md)` 링크가 내비게이션 화면 spec 맵에 포함되어 있었음. 이 PR 에서 `16-agent-memory.md` 자체가 삭제됨과 동시에 링크도 제거됨.
- **상세**: 파일 삭제와 링크 제거가 원자적으로 동일 diff 에 포함됨 — broken link 발생 없음.
- **제안**: 충돌 없음.

---

## 요약

이번 diff(`exec-park-durable-resume` — Phase A2b)가 도입하는 신규 식별자(`CHECKPOINT_ELIGIBLE_NODE_TYPES`, `DEFAULT_IE_MAX_COLLECTION_RETRIES`, `isCheckpointEligibleNodeType`)는 기존 코드베이스에 동일 이름으로 다른 의미가 존재하지 않아 충돌이 없다. `_resumeCheckpoint` 내 `partialResult`/`collectionRetryCount` 키는 기존 IE handler 동명 필드와 동일 개념을 다른 레이어(checkpoint vs. runtime state vs. output DTO)에서 표현한 것으로 의미 충돌이 아니다. 삭제된 요구사항 ID(`AGM-12`/`AGM-13`, `NAV-AM-01~06`)의 dangling reference 는 spec·codebase 전체에서 발견되지 않는다. `DEFAULT_IE_MAX_COLLECTION_RETRIES = 3` 과 `information-extractor.handler.ts` 의 `?? 3` 중복 선언은 향후 동기화 위험이 있으나 현시점 충돌은 아니다. 전반적으로 신규 식별자 충돌 관점의 심각한 문제는 없다.

## 위험도

NONE

STATUS: OK
