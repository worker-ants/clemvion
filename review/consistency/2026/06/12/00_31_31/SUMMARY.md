# Consistency Check 통합 보고서

**BLOCK: YES** — Convention Compliance checker 에서 Critical 발견 1건 (appstore-orders.md 응답 wrapper 필드 설명 규약 위반)

## 전체 위험도
**MEDIUM** — errcode-wiring 구현 자체(codebase 변경 4파일)는 NONE 이나, Convention Compliance 가 검토한 `spec/conventions/cafe24-api-catalog/` 신규 field-level 레이어에서 CRITICAL 1건·WARNING 3건이 발견됨

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `appstore-orders.md` 의 `order` wrapper 필드 설명이 `(응답 객체)` 대신 sort 파라미터 설명(`"정렬 순서 asc : 순차정렬 · desc : 역순 정렬"`)로 채워짐 — §7.3 추측 주입 금지 원칙도 위배 | `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` 49행, 97행 (GET/POST 두 operation) | `spec/conventions/cafe24-api-catalog/_overview.md §7.2` — "property list 에 없는 wrapper 는 `(응답 객체)`/`(목록)`" | 두 operation 의 `\| \`order\` \| \| 정렬 순서 … \|` 행을 `\| \`order\` \| \| (응답 객체) \|` 로 수정 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | field-level 파일명·frontmatter `entity` 값이 규약 명시 `snake_case` 와 불일치 (실제 구현은 kebab-case 일관 적용) | `spec/conventions/cafe24-api-catalog/application/` 및 `category/` 하위 다수 파일 (`appstore-orders.md`, `webhooks-logs.md`, `categories__decorationimages.md` 등 18개 resource) | `spec/conventions/cafe24-api-catalog/_overview.md §7.1` — "`<entity_id>` 는 snake_case`" | 파일명 변경보다 규약 갱신 권장: `_overview.md §7.1` 의 `(snake_case)` 를 `(kebab-case, Cafe24 docs URL 앵커 기반. 복합 sub-resource path 의 `/` 는 `__` 로 대체)` 로 수정 |
| 2 | Convention Compliance | `application.md`, `category.md` — `## Rationale` 섹션 부재 (동일 디렉토리의 `store.md`, `mileage.md` 등은 Rationale 보유) | `spec/conventions/cafe24-api-catalog/application.md`, `spec/conventions/cafe24-api-catalog/category.md` | CLAUDE.md "결정의 배경·근거: 해당 spec 문서 끝의 `## Rationale`" | 각 파일 말미에 `## Rationale` 섹션 추가 후 기존 각주·⚠ 블록 이관. 또는 `_overview.md §6` 에 "설계 근거가 있는 경우에만 추가" 를 명시하여 비일관성 공식화 |
| 3 | Convention Compliance | `appstore-orders.md` 30행 operation heading 오타 (`Retreive`) 및 index `application.md` 와 heading 불일치 (`Retrieve` 정상 철자·대소문자 차이) | `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` 30행 | `spec/conventions/cafe24-api-catalog/_overview.md §7.3` — Cafe24 공식 docs 의 deterministic 파싱; 내부 일관성 | `appstore-orders.md` 30행 heading 을 `Retrieve a Cafe24 Store order` 로 수정. 외부 URL 앵커(`#retreive-…`)는 현행 유지 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | classifier `INTERNAL_CODES` 와 spec §3.1 매핑 표 간 pre-existing 갭 — `SUB_WORKFLOW_NOT_FOUND`, `SUB_WORKFLOW_TIMEOUT`, `SUB_WORKFLOW_QUEUE_FAILED`, `EMAIL_HOST_BLOCKED` 4개가 `INTERNAL_CODES` 미등재 → unknown fallback(warn 로그) 경로를 탐 | `execution-failure-classifier.ts` `INTERNAL_CODES` set; `spec/conventions/chat-channel-adapter.md §3.1` | 본 PR 범위 밖. 후속 PR 에서 4개 코드 `INTERNAL_CODES` 등재 + spec §3.1 매핑 표 명확화 권장 |
| 2 | Cross-Spec | `error-codes.ts` `HTTP_BLOCKED` JSDoc 주석이 `http-safety.ts` 를 SoT 로 칭함 — spec SoT (`spec/4-nodes/4-integration/1-http-request.md §4`) 와 상충 가능성 (동작 영향 없음) | `codebase/backend/src/nodes/core/error-codes.ts` 15-17행 | 주석을 spec 참조 형식으로 개정하거나 현행 유지 (영향 없음) |
| 3 | Rationale Continuity | `HTTP_BLOCKED` INTERNAL 분류 — spec 명시와 일치. 조치 불요 | `execution-failure-classifier.ts`; `spec/conventions/chat-channel-adapter.md §3.1` L388 | 없음 |
| 4 | Rationale Continuity | `CODE_MEMORY_LIMIT` INTERNAL 분류 — spec 명시와 일치. 조치 불요 | `execution-failure-classifier.ts`; `spec/conventions/chat-channel-adapter.md §3.1` L388 | 없음 |
| 5 | Rationale Continuity | `EMAIL_HOST_BLOCKED` 분류표 미등재 — Rationale 이 명시적으로 정당화 (send_email 실패 시 `ERROR_PORT_FALLBACK` 이 INTERNAL 군 처리) | `execution-failure-classifier.ts`; `spec/2-navigation/4-integration.md ## Rationale` | 없음 |
| 6 | Rationale Continuity | `LEGACY_TO_NORMALIZED` fallback `?? errorCode` → `?? ErrorCode.CODE_EXECUTION_FAILED` 변경 — "의미 기반 에러 코드는 클라이언트와의 장기 계약" Rationale 강화 | `codebase/backend/src/nodes/data/code/code.handler.ts` | 없음 |
| 7 | Plan Coherence | `chat-channel-adapter.md §3.2` 에 `CODE_MEMORY_LIMIT`·`HTTP_BLOCKED` 이미 등재 — W1 spec 갱신 불요 확인 | `spec/conventions/chat-channel-adapter.md` L388; `plan/in-progress/code-node-isolated-vm-followups.md` W1 | 완료 처리 시 "spec 갱신 불요(이미 등재)" 근거 노트로 충분 |
| 8 | Plan Coherence | `node-output-redesign/code.md` 에 `CODE_MEMORY_LIMIT /* 로드맵 */` 및 "현재 `node:vm` 한계로 미구현" 잔존 — isolated-vm PR 완료로 stale | `plan/in-progress/node-output-redesign/code.md` 82행, 132행 | 후속 작업 시 해당 라인 갱신 포함 |
| 9 | Convention Compliance | `_overview.md` — `## Rationale` 섹션 부재 (설계 근거가 본문에 산재) | `spec/conventions/cafe24-api-catalog/_overview.md` | 장기 개선으로 `## Rationale` 추가 권장 |
| 10 | Naming Collision | `classifyCodeNodeError` 개명 — cafe24/makeshop MCP private `classifyError` 와의 혼동 가능성을 JSDoc 명시로 해소 완료 | `codebase/backend/src/nodes/data/code/code.handler.ts` L243 | 추가 조치 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | errcode-wiring 변경은 spec §3.1 매핑 표와 완전 정렬. pre-existing 갭 2건(INFO)만 존재 |
| Rationale Continuity | NONE | HTTP_BLOCKED·CODE_MEMORY_LIMIT INTERNAL 등재, LEGACY_TO_NORMALIZED fallback 강화 모두 기존 Rationale 준수 또는 강화 |
| Convention Compliance | MEDIUM | CRITICAL 1건(appstore-orders.md wrapper 설명 오류) + WARNING 3건(entity 파일명 규약 텍스트 불일치·Rationale 부재·오타). 단, 이는 cafe24-api-catalog 신규 레이어에 대한 것이며 errcode-wiring 구현 자체와는 직교 |
| Plan Coherence | NONE | spec/conventions/ 변경 0건. 관련 plan 체크 항목 정렬 확인. 활성 worktree 2건 파일 경합 없음 |
| Naming Collision | NONE | HTTP_BLOCKED·CODE_MEMORY_LIMIT·LEGACY_TO_NORMALIZED·classifyCodeNodeError 모두 충돌 없음 |

## 권장 조치사항

1. **(BLOCK 해소 필수)** `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` 49행·97행의 `order` wrapper 설명을 `(응답 객체)` 로 수정. GET operation 과 POST operation 두 곳 모두 적용.
2. **(WARNING — 규약 수정 권장)** `spec/conventions/cafe24-api-catalog/_overview.md §7.1` 의 `snake_case` 기술을 실제 구현 컨벤션인 kebab-case 로 갱신.
3. **(WARNING — 문서 정합)** `appstore-orders.md` 30행 heading 오타 `Retreive` → `Retrieve` 수정. 외부 URL 앵커는 유지.
4. **(WARNING — 장기)** `application.md`·`category.md` 말미에 `## Rationale` 섹션 추가 또는 `_overview.md §6` 에 조건부 추가 규칙 명시.
5. **(INFO — 후속 PR)** `SUB_WORKFLOW_NOT_FOUND` / `SUB_WORKFLOW_TIMEOUT` / `SUB_WORKFLOW_QUEUE_FAILED` 를 `INTERNAL_CODES` 에 등재하고, spec §3.1 매핑 표를 명확화.
6. **(INFO — 후속 정리)** `plan/in-progress/node-output-redesign/code.md` 82행·132행의 stale `CODE_MEMORY_LIMIT /* 로드맵 */` 서술 갱신.