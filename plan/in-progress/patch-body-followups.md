---
title: "PATCH 부분 본문 후속 — nullable 요청 필드 선언 · null 캐너리 · 헬퍼 JSDoc · 응답에 새는 관계 전수"
status: in-progress
owner: developer
worktree: patch-body-followups
spec_impact: none
started: 2026-09-27
---

# PATCH 부분 본문 후속

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 «PATCH 부분 본문 후속 — 요청 DTO `description` 의 nullable
선언 · 응답 직렬화 계층 부재 · 캐너리 둘»(`plan/complete/patch-omit-undefined.md` 2R 이 수렴 예외로 등재)을 처리한다.

## 실측 (2026-09-27, origin/main `6acc4dbc5`)

### 프로브 — 고치기 전 코드에서 PATCH 에 `null` 을 보냈다 (`_test_logs/e2e-20260927-151214.log`)

커밋하지 않는 임시 e2e(`zz-null-probe`)로 상태 코드와 응답 · 저장값을 쟀다.

| 라우트 | 필드(컬럼) | 결과 |
|---|---|---|
| `PATCH /workflows/:id` | `description`(nullable) | **200 · 응답 null · GET null** — 값을 지운다 |
| `PATCH /nodes/:id` | `description`(nullable) | **200 · 응답 null** |
| `PATCH /auth-configs/:id` | `ipWhitelist`(nullable) | **200 · 응답 null** |
| `PATCH /folders/:id` | `name`(NOT NULL) | **500 `INTERNAL_ERROR`** |
| `PATCH /workflows/:id` | `name` · `tags` · `isActive`(NOT NULL) | **500** 셋 다 |
| `PATCH /nodes/:id` | `config`(NOT NULL) | **500** |
| `PATCH /nodes/:id` | `label`(NOT NULL) | **409 `DUPLICATE_NODE_LABEL`** — «label "null" already exists»(라벨 중복 검사가 `label: null` 로 다른 노드를 찾았다) |
| `PATCH /auth-configs/:id` | `name` · `isActive`(NOT NULL) | **500** 둘 다 |

- 위 셋(nullable)은 W2 의 전제를 실측으로 확인한다 — 런타임은 null 을 받아 **지운다**. 그런데 요청 DTO 는 셋 다 nullable 을
  선언하지 않는다(`description?: string` · `description?: string` · `ipWhitelist?: string[]`). OpenAPI 가 실제 지원하는 입력을 덜 광고한다.
- 아래(NOT NULL)는 **새 결함 클래스**다 — `@IsOptional()` 은 null 도 «값 없음» 으로 보고 다른 검증기를 건너뛴다. null 이 엔티티에
  병합되고 저장 때 Postgres NOT NULL 위반(23502)이 나는데, 전역 예외 필터가 23505(unique)만 409 로 매핑하고 나머지는 500 으로
  떨어뜨린다. 클라이언트 입력이 500 을 만든다. **이 PR 의 축이 아니다** — PATCH 21개 라우트 전반에 걸칠 수 있고 처방(검증 데코레이터 vs
  필터의 23502 매핑)이 결정 사항이라 트래커에 새 항목으로 등재한다(아래 §방향 6).

### 응답에 새는 관계 — 전수 (트래커 항목 W1)

`relations: [...]` · `leftJoinAndSelect` · `innerJoinAndSelect` 가 서비스에 나오는 **39줄 전부**를 «그 엔티티가 HTTP 응답까지 가는가 ·
관계가 응답 DTO 에 선언돼 있는가 · 민감 컬럼이 실리는가» 로 분류했다(읽기 전용 조사 에이전트, 행 수 = grep 줄 수 39).

- **결함 후보 2건 — 둘 다 `executions.service.ts` `findById`**: 부모 `workflow`(Workflow 전 컬럼)와 `nodeExecutions[].node`(Node 전
  컬럼, `config` 원문)가 `ExecutionDetailDto` 에 선언 없이 실린다. 표면 셋 — `GET /executions/:id` · `POST /executions/:id/re-run` ·
  WS `execution_snapshot`. 원인: `toResponseExecution` 이 `trigger` · `executor` 만 떼고 `workflow` 는 두며, `nodeExecutions` map 이
  `node` 를 그대로 둔다.
- **민감 컬럼 0건** — User 비밀 · `*SecretV2` · `*TokenV2` 는 없다. 실리는 값은 같은 워크스페이스 멤버가 `GET /workflows/:id` ·
  노드 목록으로 이미 원문으로 보는 것이다. 권한 상승이 아니라 계약 위반 + 과다 조회다.
- **`node` 는 그냥 뗄 수 없다** — 프런트엔드가 `ne.node?.label` · `ne.node?.type` 을 읽는다(실행 상세 페이지 · WS 스냅샷 적용).
  `nodeLabel` · `nodeType` 으로 좁혀 싣고 프런트를 함께 고치거나, 좁힌 `node` 참조 DTO 를 선언해야 한다.
- 나머지 37줄은 결함이 아니다 — 매퍼 · 좁히기 함수(triggers `sanitizeForResponse` · schedules `toResponse` · workspaces 명시 map ·
  auth-configs usage map · interaction 명시 DTO · 어시스턴트 도구 envelope) · DB 투영(audit-logs · 멤버 목록 · 버전 `creator`) ·
  구조분해(노드 `update()`, #1416) · 내부 전용(엔진 · 스케줄러 · 인증 · `remove`) · DTO 에 선언된 관계(그래프 relations) · 주석/오탐 5줄.
- 조사가 곁눈으로 본 것(확인 안 함 — «불확실»): `toResponseExecution` 의 `...rest` 가 엔티티를 통째로 펼쳐 `ExecutionDetailDto` 에 없는
  컬럼(`conversationThread` · `userVariables` · `resumeCallStack` 등)도 나가는 것으로 보인다.
- **처분**: W1 의 «전수부터 재고» 몫은 이 PR 이 닫는다. 수정은 프런트 동반 + `ExecutionDetailDto` 계약 대조가 선행이라 이 PR 의 크기가
  아니다 — 트래커 항목을 **executions `findById` 한 자리로 좁혀** 남기고, §5.4 drift 배치 2단계의 `ExecutionDto` 몫과 잇는다.

## 방향

1. **요청 DTO 셋** — `UpdateWorkflowDto.description` · `UpdateNodeDto.description` → `@ApiPropertyOptional({ …, nullable: true })` +
   `string | null`. `UpdateAuthConfigDto.ipWhitelist` → 같은 방식으로 `string[] | null`. 동작은 그대로다(런타임은 이미 null 을 받는다) —
   선언을 동작에 맞춘다. swagger 가드(`swagger-dto-contract.spec.ts` «OpenAPI 선언과 TS 타입») 가 요청 DTO 도 스캔하므로 데코레이터와
   타입을 함께 바꾼다.
2. **e2e** — `patch-partial-body.e2e-spec.ts` 에 «nullable 필드에 null 을 보내면 값을 지운다» 케이스: 세 필드의 응답 값 · 저장값.
   선언이 광고하는 동작을 고정한다.
3. **단위 캐너리**(INFO 1) — 노드 `description` · 인증 설정 `ipWhitelist` 에 «명시적 null 은 로드한 값을 지운다»(워크플로엔 이미 있다).
4. **헬퍼 JSDoc**(INFO 2) — «인자 자체가 런타임 null 이면 `Object.entries` 가 던진다 — 필드 전체가 null 일 수 있는 호출부(중첩 DTO)는
   먼저 `!= null` 로 가드하라».
5. **CHANGELOG** — 항목 1(OpenAPI): 세 필드가 null 을 받는다고 광고한다(동작 변화 없음).
6. **트래커** — 항목을 닫지 않고 좁힌다(W1 → executions `findById`). 새 항목: PATCH NOT NULL 필드의 null 이 500(위 실측 표).

## 뮤턴트 (예측 — 실측은 구현 뒤 채운다)

| # | 뮤턴트 | 예측 | 실측 · 죽인 테스트 |
|---|---|---|---|
| D1 | `UpdateWorkflowDto.description` 의 `nullable: true` 만 제거 | swagger 가드 RED(null 축) | |
| D2 | `UpdateNodeDto.description` 의 `| null` 만 제거 | swagger 가드 RED(반대 방향) | |
| D3 | `UpdateAuthConfigDto.ipWhitelist` 의 `nullable: true` 만 제거 | swagger 가드 RED | |

## 체크리스트

- [ ] `--impl-prep`
- [ ] DTO 셋 · e2e · 단위 캐너리 · 헬퍼 JSDoc · CHANGELOG · 트래커
- [ ] 뮤턴트 표 실측
- [ ] TEST WORKFLOW (lint · unit · build · e2e)
- [ ] `/ai-review`
- [ ] `--impl-done`
