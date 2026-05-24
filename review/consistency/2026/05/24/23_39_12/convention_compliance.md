# 정식 규약 준수 검토 결과

**검토 대상**: `plan/in-progress/spec-draft-workflow-resumable-execution.md`
**검토 모드**: spec draft (--spec)
**검토 일시**: 2026-05-24

---

## 발견사항

### [INFO] Plan 문서의 frontmatter 필드가 규약 최소 집합과 일치함 (통과 확인)
- target 위치: 문서 상단 frontmatter (`worktree`, `started`, `owner`)
- 위반 규약: `.claude/docs/plan-lifecycle.md §4` Frontmatter 스키마
- 상세: 세 필드 모두 규약에 정의된 필드명·타입과 일치한다. 위반 없음.
- 제안: 해당 없음.

---

### [INFO] 변경 1.6 §7.5 rehydration 실패 에러 코드가 `UPPER_SNAKE_CASE` 준수 (통과 확인)
- target 위치: 변경 1.6 "Rehydration 실패 케이스" 표, 변경 2.2 에러 코드 표
- 위반 규약: `spec/conventions/node-output.md` Principle 3.2 — `code` 는 `UPPER_SNAKE_CASE`
- 상세: `RESUME_CHECKPOINT_MISSING`, `RESUME_FAILED`, `RESUME_INCOMPATIBLE_STATE`, `SERVER_INTERRUPTED` 모두 UPPER_SNAKE_CASE 준수. 위반 없음.
- 제안: 해당 없음.

---

### [WARNING] 변경 1.9 §11 503 에러 응답 shape 표기가 `spec/2-api-convention.md` 참조로만 처리됨 — 내용 위치 불일치 가능성
- target 위치: 변경 1.9 §11 Graceful Shutdown, 503 응답 본문 설명
  ```
  { error: { code: 'SERVER_SHUTTING_DOWN', message: '...' } }
  ```
  인라인 shape 표기 뒤에 `[Spec API 규약](./2-api-convention.md)` 로 cross-link함.
- 위반 규약: `spec/conventions/node-output.md` Principle 3.2 (에러 응답 표준 shape) + `spec/2-api-convention.md` (API 에러 응답 공통 shape SoT)
- 상세: 인라인으로 표기된 `{ error: { code, message } }` shape 이 API 규약의 실제 envelope 구조와 일치하는지 본 draft 만으로 검증 불가. `spec/2-api-convention.md` 가 `{ data: ... }` / `{ error: ... }` 중 어떤 envelope 를 쓰는지와의 정합은 spec 적용 단계에서 반드시 확인 필요. 또한 `Retry-After` 헤더 동봉 정책이 API 규약에 이미 정의됐을 경우 중복 또는 상충 가능.
- 제안: spec 적용 시 `spec/2-api-convention.md` 의 에러 envelope 실제 shape 을 `spec/5-system/4-execution-engine.md §11` 에 명시하거나, 또는 "shape 은 [Spec API 규약 §X](./2-api-convention.md#x) 그대로" 처럼 구체 절까지 링크해 중복 정의를 피울 것.

---

### [WARNING] 변경 2.1 WS ack `queued: boolean` 신규 필드 — `spec/conventions/interaction-type-registry.md` 매트릭스에 미등록
- target 위치: 변경 2.1 §4.2 `queued: false` 필드 추가 설명
- 위반 규약: `spec/conventions/interaction-type-registry.md` §1.2 처리 분기 매트릭스 — "신규 enum 값은 본 문서 매트릭스에 반드시 등록"
- 상세: `queued` 는 enum 값 추가가 아니라 ack payload 의 boolean 필드 추가이므로 `WaitingInteractionType` enum 자체의 변경은 아니다. 따라서 exhaustiveness guard (`interaction-type-exhaustiveness.test.ts`) 의 직접 대상이 아님. 그러나 WS ack payload 필드가 프론트엔드 consumption 에 영향을 줄 경우, `interaction-type-registry.md §1.2` 의 "Frontend 처리 분기 (필수 N)" 열에 `queued` 처리 위치가 명시되어 있지 않다. 본 draft 는 "디버깅·관측 용도이며 클라이언트 routing 결정에 사용하지 않는다" 고 명시하나, 프론트엔드가 이를 무시(discard)해야 함을 매트릭스에 명시하지 않으면 향후 구현자가 혼동할 수 있다.
- 제안: spec 적용 시 `interaction-type-registry.md §1.2` 비고 또는 별도 절에 "WS ack `queued: boolean` — 클라이언트 routing 결정에 사용 안 함, 수신 후 discard" 를 한 줄로 등록할 것. 규약 갱신이 필요하면 planner 가 해당 convention 문서를 동시 편집.

---

### [WARNING] `spec/4-nodes/6-presentation/0-common.md` 변경(변경 6)이 별도 spec 파일인데 plan draft 본문 내 갱신 지시만 있고 해당 파일의 frontmatter `pending_plans:` 등록 언급 없음
- target 위치: 변경 6 전체, 문서 하단 "다음 단계" §3
- 위반 규약: `spec/conventions/spec-impl-evidence.md` §2 / §3 — `status: partial` 또는 변경 예정 spec 에 `pending_plans:` 등록 의무; `spec/conventions/spec-impl-evidence.md §4` build-time 가드 `spec-pending-plan-existence.test.ts`
- 상세: 본 draft 는 6개 spec 파일을 변경한다고 선언한다. 이 중 `spec/4-nodes/6-presentation/0-common.md`, `spec/5-system/4-execution-engine.md`, `spec/5-system/6-websocket-protocol.md`, `spec/1-data-model.md`, `spec/data-flow/3-execution.md`, `spec/0-overview.md` 각각의 frontmatter 에 `pending_plans:` 를 등록해야 한다 (해당 spec 들이 `spec-impl-evidence.md §1` 적용 대상일 경우). "다음 단계 §3" 에서 plan 생성을 후속으로 미루고 있어, spec 파일 갱신 시점에 frontmatter 연결이 누락될 수 있다.
- 제안: spec 적용 phase (다음 단계 §2) 에서 각 대상 spec 파일의 frontmatter 를 `status: partial` + `pending_plans: [plan/in-progress/workflow-resumable-execution.md]` 로 갱신하는 단계를 "다음 단계 §3" 의 plan 본문에 명시적으로 phase 로 포함할 것. `spec/0-overview.md`, `spec/1-data-model.md` 는 `spec-impl-evidence.md §1` 제외 대상이므로 해당 없음.

---

### [INFO] 변경 1.4 §7.4 BullMQ 큐 이름이 kebab-case 로 일관됨 (통과 확인)
- target 위치: 변경 1.4 표 "BullMQ 큐 이름" 행 — `execution-continuation`
- 위반 규약: 특정 큐 명명 규약이 `spec/conventions/` 에 별도 정의됐는지 확인 불가 (관련 convention 파일 없음)
- 상세: `background-execution`, `task-queue`, `execution-continuation` 모두 kebab-case 일관 적용. Redis 키 패턴(`{service}:{workspaceId}:{resource}:{id}:{sub}`) 과 BullMQ 큐 이름은 §9.3 에서 명시적으로 분리됨. 위반 없음.
- 제안: 해당 없음.

---

### [INFO] 변경 1.11 Rationale — 3섹션 구조 내 위치 규약 준수 (통과 확인)
- target 위치: "변경 1.11 Rationale 섹션 — 새 결정 기록"
- 위반 규약: CLAUDE.md "결정의 배경·근거 — 해당 spec 문서 끝의 `## Rationale`"
- 상세: draft 가 Rationale 를 spec 문서 끝의 `## Rationale` 절에 추가하도록 지시. 3섹션 구조(Overview / 본문 / Rationale) 관례 준수.
- 제안: 해당 없음.

---

### [INFO] "다음 단계 §3" 에서 `plan/in-progress/0-unimplemented-overview.md` 를 인덱스로 참조 — 파일명 `0-` prefix 관례와 정합
- target 위치: 다음 단계 §3 첫 번째 불릿
- 위반 규약: CLAUDE.md 정보 저장 위치 표 — `spec/<영역>/_product-overview.md` 또는 `spec/0-overview.md` 패턴의 `0-` prefix / `_` prefix 관례
- 상세: `plan/in-progress/0-unimplemented-overview.md` 는 plan 폴더의 인덱스성 파일에 `0-` prefix 를 붙인 것이다. CLAUDE.md 의 `0-` prefix 규칙은 `spec/` 루트 레벨 cross-cutting 진입 문서에 적용되는 규칙이나, plan 폴더의 인덱스 파일에 유사 패턴 적용은 명시적 금지가 없고 기존 파일명이므로 INFO 수준.
- 제안: 해당 없음 (기존 파일명 참조이므로 신규 규약 위반 아님).

---

### [INFO] `spec/conventions/migrations.md` 준수 확인 — DB migration 없음 명시 (통과)
- target 위치: 변경 3 끝 "본 변경으로 DB migration 불필요 (free-form JSONB)", 영향받지 않는 영역 표 `spec/conventions/migrations.md` 행
- 위반 규약: `spec/conventions/migrations.md` 전체
- 상세: draft 가 DB migration 없음을 명시적으로 선언하고, 영향 분석 표에도 "영향 없음" 으로 기재. migration 규약의 명명·V번호·append-only 정책에 대한 위반 없음.
- 제안: 해당 없음.

---

### [INFO] `spec/conventions/swagger.md` 관련 — draft 는 spec 변경이므로 DTO/Controller 데코레이터 규약 직접 적용 대상 아님
- target 위치: 전체 문서
- 위반 규약: `spec/conventions/swagger.md`
- 상세: 본 문서는 spec draft 이며 구현 코드 변경을 직접 다루지 않는다. Swagger 규약은 구현 단계(developer) 에서 검증 대상. spec 수준에서 에러 코드·WS 이벤트 payload 형식은 node-output / websocket-protocol 규약 기준으로 검토 완료.
- 제안: 해당 없음.

---

## 요약

`plan/in-progress/spec-draft-workflow-resumable-execution.md` 는 전반적으로 정식 규약을 잘 준수하고 있다. 에러 코드 명명(UPPER_SNAKE_CASE), Rationale 섹션 배치(spec 문서 끝), 마이그레이션 영향 명시, BullMQ 큐 명명 일관성, plan frontmatter 스키마 등 핵심 규약 항목에서 위반이 발견되지 않았다. 다만 두 건의 WARNING 이 있다: (1) 503 에러 응답 shape 의 API 규약(`spec/2-api-convention.md`) 과의 정합을 spec 적용 단계에서 명시적으로 확인해야 하며, (2) spec 적용 시 6개 변경 대상 spec 파일 중 `spec-impl-evidence.md` 적용 대상 파일들의 frontmatter 에 `pending_plans:` 등록이 누락될 위험이 있어 plan 본문에 해당 단계를 명시적으로 포함해야 한다. WS ack `queued: boolean` 필드에 대해서도 프론트엔드 처리 방침을 `interaction-type-registry.md` 에 한 줄 등록하는 것이 권장된다.

---

## 위험도

LOW
