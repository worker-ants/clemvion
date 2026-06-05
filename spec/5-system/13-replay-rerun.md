---
id: replay-rerun
status: implemented
code:
  - codebase/backend/src/modules/executions/executions.controller.ts
  - codebase/backend/src/modules/executions/executions.service.ts
  - codebase/backend/src/modules/executions/dto/re-run.dto.ts
  - codebase/backend/migrations/V067__execution_re_run_chain.sql
  - codebase/backend/migrations/V068__execution_dry_run.sql
  - codebase/backend/src/nodes/core/dry-run.util.ts
---

# Spec: 워크플로 Re-run (재실행)

> 관련 문서: [Spec 실행 엔진 §6.3](./4-execution-engine.md#63-재실행조회-정책-replay-policy) · [Spec 실행 내역 §3.7](../2-navigation/14-execution-history.md#37-re-run-액션) · [Spec 워크플로 실행/디버깅 §10.14](../3-workflow-editor/3-execution.md#1014-re-run-진입점) · [Spec AI Assistant §4.1.2](../3-workflow-editor/4-ai-assistant.md#412-re-run-비트리거-정책) · [Spec 데이터 모델 §2.13](../1-data-model.md#213-execution) · [Spec 노드 카테고리](../4-nodes/0-overview.md#2-노드-전체-목록)

---

## Overview (제품 정의)

### 1. 배경

`spec/5-system/4-execution-engine.md §6.3` Replay 정책 표는 View / Re-run / Multi-turn resume 세 모드를 분리 정의한다. 사용자는 실행 상세 페이지에서 "이 실행을 같은 입력으로 다시 돌려서 결과를 비교하고 싶다", "타임 의존 결과(`$now` / `random()`) 를 다시 계산하고 싶다", "디버그용으로 외부 호출 없이 흐름만 재현하고 싶다" 같은 요구를 가지지만, 본 기능 부재로 우회 (워크플로를 수동 트리거 패널에서 다시 시작) 해야 했다.

본 spec 은 Re-run 의 사용자 가치, 정책 결정(A~G), API/UI/데이터 모델 명세, 외부 부수효과 안전장치, AI Assistant 와의 경계, 기존 정책과의 관계를 한 곳에 정의한다.

### 2. 사용자 가치

| 시나리오 | Re-run 으로 얻는 것 |
| --- | --- |
| **디버그·재현** | 실패한 실행을 같은 입력으로 다시 돌려 root cause 추적. 외부 호출까지 다시 일어나는지 끄고(dry-run) 흐름만 보고 싶을 때 가드 제공 |
| **재시도** | 일시적 실패(외부 API 5xx, 네트워크 끊김)를 빠르게 한 번 더 시도. 입력 수정 없이 한 클릭 |
| **테스트** | 입력 일부만 살짝 바꿔 재실행해 결과 차이를 비교 (예: 다른 사용자 ID 로 같은 흐름 재현) |
| **타임 재계산** | `$now` / `random()` / 외부 응답에 의존하는 결과를 새 실행 시점으로 재고정 |

### 3. 본 spec 이 다루는 범위

- Re-run 의 **API 계약** (`POST /api/executions/:executionId/re-run`)
- 외부 부수효과 안전장치 — **확인 모달 + dry-run 토글** (A5 결정)
- 입력 데이터 모달 UX — 원본 미리보기 + 사용자 편집 (B2)
- 데이터 모델 — `re_run_of` self-FK + `chain_id` UUID + chain 깊이 32 제한 (E3)
- 권한 — 원본 실행 시작자 + 워크스페이스 Editor+ (F)
- AI Assistant 의 Re-run 비트리거 정책 (G1)
- multi-turn / Form / Buttons 노드의 Re-run UX — 사용자 새 입력 (D1)
- 진입점 — 실행 상세 페이지 + Run Results 드로어

### 4. 본 spec 이 다루지 않는 범위 (향후 확장)

- 부분 Re-run (resume-from-failure, single-node debug) — C2/C3
- 표현식 재평가만 모드 (외부 호출 skip 안 하면서 expression 만 다시) — B3
- multi-turn 입력 재사용 (자동 진행) — D2
- AI Assistant Re-run 도구 (별도 Trust 단계) — G2
- 노드별 멱등성 키 자동 부여 — A3
- 노드별 Re-run 정책 메타 (`reRunPolicy: call/skip/confirm`) — A4

위 항목들은 §10 향후 확장 에 reference 만 둔다.

### 5. 결정 사항 (사용자 확정)

| 항목 | 결정 | 정책 ID |
| --- | --- | --- |
| A. 외부 부수효과 안전장치 | **A5** — 확인 모달 + dry-run 토글 (기본 dry-run 미활성). 외부 부수효과 노드는 카테고리 메타로 분류 | `RR-PL-01` |
| B. 입력 데이터 모드 | **B2** — 원본 미리보기 + 사용자 편집 모달이 기본. "그대로 실행" 토글로 B1 도 가능 | `RR-PL-02` |
| C. 부분 Re-run | **C1** — v1 은 전체 워크플로만 | `RR-PL-03` |
| D. Multi-turn 노드 처리 | **D1** — 사용자 새 입력 (새 multi-turn 세션) | `RR-PL-04` |
| E. Chain 추적 모델 | **E3** — `re_run_of` self-FK + `chain_id` UUID 둘 다. chain 깊이 32 제한 | `RR-PL-05` |
| F. 권한 | 원본 실행 시작자 + 워크스페이스 Editor+. dry-run 도 동일 권한 | `RR-PL-06` |
| G. AI Assistant | **G1** — Re-run 트리거 불가 (read-only 정책 유지) | `RR-PL-07` |

각 정책의 근거는 §Rationale 참조.

---

## 6. 정책 (Policy IDs)

### RR-PL-01 — 외부 부수효과 안전장치 (A5)

Re-run 은 두 단계 가드를 거친다.

1. **확인 모달** — 사용자가 "Re-run" 버튼을 누르면 모달이 열린다. 모달은 항상 다음을 보여준다:
   - 원본 실행의 기본 정보 (실행 ID, 시작 시각, 상태)
   - 본 워크플로가 포함하는 외부 부수효과 노드 수 (예: "이 워크플로는 외부 호출 노드 3개 — Send Email × 1, HTTP Request × 2 — 를 포함합니다")
   - 입력 데이터 폼 (RR-PL-02 참조)
   - "dry-run 모드" 토글 (기본 OFF)
   - "재실행" / "취소" 버튼
2. **dry-run 토글** — ON 일 때, **외부 부수효과 노드** (§7 분류 기준) 는 handler 가 외부 호출을 skip 하고 mock 출력을 반환한다. 사용자가 "외부 호출 없이 흐름만 검증" 하고 싶을 때 사용.

dry-run 이 OFF 인 일반 Re-run 은 외부 호출이 그대로 재트리거되며, 그로 인한 부수효과(이메일 재발송, HTTP 재호출 등) 는 의도된 동작이다.

### RR-PL-02 — 입력 데이터 모드 (B2)

모달의 기본 동작:
- 원본 실행의 입력 데이터를 폼으로 미리 채워 표시 (Manual Trigger 의 `parameters` 스키마 기반 폼 — 기존 [Spec 실행 엔진 §6.1.1](./4-execution-engine.md#611-트리거-입력-파라미터-seeding) `resolveTriggerParameters` 패턴 재사용)
- 사용자가 필드를 편집해 다른 입력으로 재실행 가능
- 모달 상단의 **"원본 입력 그대로 사용"** 토글 (기본 OFF — 편집 가능 상태) 을 ON 으로 두면 폼이 read-only 가 되고 "재실행" 버튼이 한 클릭 경로로 단축됨

### RR-PL-03 — 부분 Re-run 미지원 (C1)

v1 은 전체 워크플로만 Re-run 한다. 실패 노드부터 이어 실행 (resume-from-failure) 이나 단일 노드 단독 재실행 (single-node debug) 은 §10 향후 확장 으로 분리.

### RR-PL-04 — Multi-turn 노드 UX (D1)

원본 실행이 multi-turn 흐름 (AI Agent Multi Turn / Information Extractor Multi Turn / Form / Buttons) 을 거쳤어도, Re-run 은 **새로운 multi-turn 세션** 으로 시작한다. 즉:
- AI Agent Multi Turn 은 첫 turn 부터 다시 — 사용자가 새 메시지를 입력
- Form / Buttons 는 새로 입력 대기
- 원본 세션의 사용자 응답을 자동 재사용하지 않는다

이유는 §Rationale 참조 — multi-turn 입력 재사용 (D2) 은 별도 plan 으로 분리.

### RR-PL-05 — Chain 추적 모델 (E3)

각 Execution row 는 다음 두 컬럼을 추가로 갖는다 (§9 데이터 모델 참조):
- `re_run_of UUID NULL REFERENCES execution(id)` — 직계 부모 (NULL 이면 원본)
- `chain_id UUID NULL` — chain root id. v1 은 re-run 행에만 세팅(일반 실행 NULL). 상세·근거는 §9.1.

Re-run 시 새 실행은 `re_run_of = <원본 ID>`, `chain_id = <원본 chain root id>` 로 채워진다. 즉 같은 chain 안에서 깊이가 한 단계씩 증가.

**Chain 깊이 32 제한** — `re_run_of` 를 따라 거슬러 올라가 32 단계를 초과하는 Re-run 시도는 `RERUN_CHAIN_DEPTH_EXCEEDED` 로 거부. 사용자가 새 chain 을 시작하려면 워크플로를 새로 실행하거나 원본을 직접 Re-run.

### RR-PL-06 — 권한 (F)

다음을 **모두** 만족해야 Re-run 가능:
- 호출자가 같은 워크스페이스의 멤버이고 Editor 이상 (Owner / Admin / Editor)
- 호출자가 원본 실행 (`execution.executed_by`) 의 작성자이거나, 워크스페이스의 Owner / Admin

> **`executed_by = NULL` (트리거/스케줄/웹훅 자동 실행) 정책 (v1, 2026-05-31)**: 시작자가 없는 자동 실행은 "타인의 실행" 이 아니므로 **워크스페이스 Editor+ 면 누구나 re-run/chain 조회 허용** (워크스페이스 자원으로 취급). 더 보수적으로 owner/admin 한정이 필요하면 후속 정책 결정 — 현재 구현(`executions.service.ts` reRun/getChain)은 본 v1 정책(Editor+ 허용)을 따른다.

위 조건은 dry-run 모드에도 동일하게 적용된다 (안전한 모드라 해도 다른 사용자의 실행 흐름을 자동으로 재현하는 것은 정보 노출 위험).

권한 부족 시 모달은 disabled + tooltip 으로 안내. 백엔드도 동일 가드를 enforce 하고 미허가 호출은 `RERUN_PERMISSION_DENIED` 반환.

### RR-PL-07 — AI Assistant 비트리거 (G1)

Workflow AI Assistant ([Spec §4.1](../3-workflow-editor/4-ai-assistant.md#41-탐색-도구-clarify-read-only)) 의 read-only 도구 (`get_workflow_executions`, `get_execution_details`) 는 Re-run 을 트리거하지 않는다. 새 도구 (`re_run_execution` 등) 는 본 spec 에 정의되지 않으며 향후 확장 (G2) 의 Trust 단계 도입 후 별도 plan 에서 다룬다.

사용자가 Assistant 에게 "이 실행을 다시 돌려줘" 같은 요청을 하면 Assistant 는 "Re-run 은 사용자가 실행 상세 페이지에서 직접 트리거해야 합니다 (정책 RR-PL-07)" 안내 메시지로 응답한다.

---

## 7. dry-run 모드 정의

### 7.1 외부 부수효과 노드 분류

다음을 **외부 부수효과 노드** 로 분류한다 (dry-run 시 skip 대상):

| 카테고리 | 해당 노드 | `supportsDryRun` |
| --- | --- | --- |
| Integration (`4-integration/*`) | HTTP Request, Send Email, Database (write — INSERT/UPDATE/DELETE/UPSERT) | true |
| Trigger 외부 발신 | (현재 v1 트리거는 모두 수신측이므로 해당 없음) | — |

다음은 **내부 부수효과 없음** 으로 분류해 dry-run 에서도 그대로 실행한다:
- Logic, Flow, Data, AI (LLM 호출은 외부이지만 워크플로 결과 재현에 필수 — §7.3 참고), Presentation (UI 렌더링), Trigger (이미 발화된 후의 Re-run 이라 트리거 자체는 다시 발화하지 않음)
- Database (read — SELECT) 는 외부 호출이지만 부수효과가 아니므로 dry-run 에서도 그대로 호출

분류 기준은 노드 레벨 메타 `category` (`spec/4-nodes/0-overview.md §2`) 와 노드별 boolean 메타 `supportsDryRun` 를 결합. 모든 외부 부수효과 노드는 v1 에서 `supportsDryRun: true` 를 기본 제공한다 (각 핸들러가 mock 출력을 반환할 수 있어야 함).

### 7.2 dry-run 동작 명세

엔진은 `createContext` 시점에 ExecutionContext 의 런타임 변수로 `variables.__dryRun: boolean` 을 주입한다 (기존 `__workspaceId` 등과 동일한 `__`-prefix 런타임 변수 컨벤션). 값의 출처는 Execution row 의 `dry_run` 컬럼(§9.2)이며, `waiting_for_input` 후 rehydration 에서도 동일하게 복원된다 — 핸들러는 `context.variables.__dryRun === true` 로 분기한다. 공통 헬퍼 `nodes/core/dry-run.util.ts` 의 `isDryRun(context)` / `buildDryRunMock(kind, wouldHaveCalled)` 를 사용한다.

- handler 가 `isDryRun(context)` 이고 자기 노드가 외부 부수효과 카테고리이면:
  - 외부 호출을 **수행하지 않는다**
  - output 으로 mock 객체를 반환:
    ```json
    {
      "_dryRun": true,
      "skippedReason": "dry-run mode",
      "wouldHaveCalled": {
        "kind": "http_request",
        "method": "POST",
        "url": "https://api.example.com/users",
        "bodyPreview": "..."
      }
    }
    ```
  - status 는 `completed` (skip 아님 — 흐름은 정상 진행). NodeExecution row 의 `outputData` 에 위 mock 객체 그대로 저장
- 외부 부수효과(Integration 카테고리) 노드인데 `supportsDryRun !== true` 인 노드가 워크플로에 하나라도 있으면, re-run 서비스가 진입 전 pre-flight (`assertDryRunSupported`) 에서 `RERUN_DRY_RUN_NOT_APPLICABLE` (400) 로 전체 Re-run 을 거부한다 (모달 단계에서 미리 검출해 dry-run 토글을 disabled + tooltip 으로 안내하는 것이 권장 UX). v1 의 4개 외부 부수효과 노드(HTTP Request / Send Email / Database write / cafe24 write)는 모두 `supportsDryRun: true` 라 정상 워크플로는 통과한다.

### 7.3 dry-run 의 LLM 호출 정책

AI 노드 (AI Agent / Text Classifier / Information Extractor) 의 LLM 호출은 외부 호출이지만 dry-run 에서도 **그대로 수행한다** — 이유:
- LLM 응답이 다운스트림 분기 결정에 직접 쓰임 (예: AI Agent 의 tool selection, Text Classifier 의 카테고리)
- LLM 호출은 일반적으로 부수효과가 아니다 (응답을 받을 뿐, 외부 시스템 상태를 변경하지 않음)

단, AI Agent 가 호출하는 **provider tool** 중 외부 부수효과 카테고리에 속하는 도구 (예: HTTP Request 도구, Send Email 도구) 는 dry-run 시 mock 응답을 반환한다 — LLM 에는 mock 결과가 전달되고, LLM 은 이를 바탕으로 다음 turn 을 진행한다.

### 7.4 dry-run 결과 표시

Run Results 드로어와 실행 상세 페이지는 dry-run 모드로 실행된 NodeExecution 을 시각적으로 구분한다:
- 노드 카드에 `🧪 dry-run` 배지
- 출력 JSON 에 `_dryRun: true` 가 있으면 자동 강조
- chain badge 에도 "dry-run" 표기 (`#3-th re-run · dry-run`)

---

## 8. API

### 8.1 POST /api/executions/:executionId/re-run

원본 실행을 기반으로 새 Execution 을 시작한다.

**Path 파라미터**:
- `executionId` (UUID, required) — 재실행할 원본 Execution ID. 같은 chain 의 임의 실행이어도 됨 (직계 부모로 잡힘)

**Request body**:
```typescript
{
  // 원본 입력을 그대로 사용할지 (true) 또는 inputOverride 를 사용할지 (false)
  // 기본 true
  useOriginalInput?: boolean;

  // useOriginalInput=false 일 때 실제 사용할 입력. Manual Trigger 의 parameters
  // 스키마와 호환. resolveTriggerParameters 와 동일한 검증을 거침
  inputOverride?: Record<string, unknown>;

  // dry-run 모드로 실행할지. 기본 false
  dryRun?: boolean;
}
```

**Response 201 Created** — 새로 생성된 Execution 이 [Spec 실행 내역 §3 상세 API 응답](../2-navigation/14-execution-history.md#3-실행-상세-페이지) 의 shape 그대로 반환되며, 다음 두 필드가 추가된다:
```typescript
{
  ...Execution,           // 기존 shape 그대로
  reRunOf: string;        // 직계 부모 Execution ID
  chainId: string;        // chain UUID
  dryRun: boolean;        // 본 실행이 dry-run 인지
}
```

**에러 코드**:

| HTTP | code | 의미 |
| --- | --- | --- |
| 401 | `UNAUTHORIZED` | 인증 토큰 없음/만료. 표준 [Spec 에러 처리](./3-error-handling.md) 규약 |
| 403 | `RERUN_PERMISSION_DENIED` | RR-PL-06 권한 미충족 (워크스페이스 멤버 아님 / Viewer / 다른 사용자의 실행이고 Owner/Admin 아님) |
| 404 | `RERUN_EXECUTION_NOT_FOUND` | `executionId` 가 존재하지 않거나 다른 워크스페이스 |
| 404 | `RERUN_WORKFLOW_DELETED` | 원본 실행의 워크플로가 삭제됨 (Re-run 의 전제 — 현재 시점 워크플로 정의 — 가 충족 불가) |
| 409 | `RERUN_CHAIN_DEPTH_EXCEEDED` | RR-PL-05 chain 깊이 32 초과 |
| 400 | `RERUN_DRY_RUN_NOT_APPLICABLE` | dry-run 요청이지만 워크플로에 `supportsDryRun: false` 노드가 포함됨 |
| 400 | `INVALID_INPUT` | `inputOverride` 가 Manual Trigger parameters 스키마와 충돌 (`resolveTriggerParameters` 가 던지는 동일 에러) |

본 엔드포인트는 [Spec API 규칙 §5](./2-api-convention.md) 의 표준 응답 envelope 와 [Spec 에러 처리](./3-error-handling.md) 의 에러 shape 를 그대로 따른다.

### 8.2 GET /api/executions/:executionId/chain

같은 chain 의 모든 실행을 시간 순으로 반환 (실행 상세 페이지의 chain badge 가 사용).

**Response**: `Execution[]` — 본 chain 의 모든 row 를 `started_at ASC` 정렬. 각 항목은 위 §8.1 응답과 동일 shape (단 `nodeExecutions` 는 생략).

권한은 §RR-PL-06 과 동일.

**에러 코드**:

| HTTP | code | 의미 |
| --- | --- | --- |
| 401 | `UNAUTHORIZED` | 인증 토큰 없음/만료 |
| 403 | `RERUN_PERMISSION_DENIED` | RR-PL-06 미충족 (타인 실행이고 owner/admin 아님) |
| 404 | `RERUN_EXECUTION_NOT_FOUND` | `executionId` 미존재 또는 다른 워크스페이스 |

---

## 9. 데이터 모델

### 9.1 executions 테이블 컬럼 추가

[Spec 데이터 모델 §2.13 Execution](../1-data-model.md#213-execution) 에 다음 두 컬럼을 추가한다:

| 컬럼 | 타입 | NULL | 설명 |
| --- | --- | --- | --- |
| `re_run_of` | `UUID` | NULL | 직계 부모 Execution. NULL 이면 본 실행이 chain 의 시작 (원본). `REFERENCES execution(id) ON DELETE SET NULL` |
| `chain_id` | `UUID` | NULL | chain root Execution id. **v1 은 re-run 으로 생성된 행에만 세팅**하고 일반 실행(원본·sub-workflow·background)은 NULL. chain root id = chain 최상위(원본) 실행의 id. |

**인덱스**:
- `(re_run_of)` — 단순 부모 조회용 (chain badge 의 직계 부모 표시)
- `(chain_id, started_at)` — chain 전체 조회용 (`/chain` 엔드포인트가 자주 사용)

**불변식**:
- chain root = `re_run_of = NULL` 인 최상위 원본 실행. chain 전체 조회는 `id = rootId OR chain_id = rootId` (rootId = `exec.chain_id ?? exec.id`).
- re-run 행의 `chain_id` 는 같은 chain root 를 가리킨다 (cross-chain re-run 불가 — 애플리케이션 레벨).
- chain 깊이 32 제한은 **애플리케이션 레벨** 에서 enforce (`computeChainDepth`, `re_run_of` walk).

> **v1 설계 — NULLABLE 채택 (2026-05-31, decision F2)**: 초기 spec 은 `chain_id NOT NULL` + 원본 자기참조(`chain_id = id`) 였으나, Execution row 는 sub-workflow / background / retry 등 **복수 경로**에서 INSERT 되어 모든 경로에 `chain_id` 강제 세팅을 요구하면 core 실행 경로 회귀 위험이 크다. 따라서 v1 은 `chain_id` 를 **NULLABLE** 로 두고 re-run 행만 세팅한다(일반 실행 NULL, chain root = 원본 id). 별도 백필 불요. NOT NULL/self-chain 으로의 강화는 모든 생성 경로 정리 후 v2 에서 검토.

마이그레이션 (`codebase/backend/migrations/V067__execution_re_run_chain.sql`) 이 위 컬럼·인덱스를 구현한다.

### 9.2 dry-run 표기 — NodeExecution `_dryRun` + Execution `dry_run` 컬럼

dry-run 모드로 실행된 **NodeExecution** 은 `outputData._dryRun === true` 로 식별한다. UI 가 그 키로 분기해 배지를 표시한다 (§7.4).

**부모 Execution row** 에는 `dry_run: boolean` 컬럼을 둔다 (V068, `NOT NULL DEFAULT false`). v1 의 dry-run 완전 구현에서 이 컬럼이 필요한 이유:

- 엔진은 **첫 노드 실행 전** `createContext` 시점에 `variables.__dryRun` 을 주입해야 한다 (§7.2). 이 값은 NodeExecution 이 아직 하나도 없는 시점에 결정돼야 하므로 NodeExecution `_dryRun` 으로는 도출 불가 — Execution 단위 플래그가 선행 필요.
- `waiting_for_input` 후 **rehydration** 경로에서도 동일 dry-run 모드를 복원해야 하므로 in-memory 플래그가 아닌 **영속 컬럼**이어야 한다.

즉 NodeExecution `_dryRun` 은 결과 표시용(UI 식별), Execution `dry_run` 은 실행 제어용(엔진 주입·복원)으로 역할이 분리된다. (초안 단계에서는 column 을 v2+ 로 연기했으나, dry-run 을 게이트가 아닌 완전 구현으로 채택하면서 위 두 제약 때문에 v1 컬럼으로 확정.)

---

## 10. UI 명세

### 10.1 진입점

| 화면 | 위치 | 권한 미충족 시 |
| --- | --- | --- |
| 실행 상세 페이지 ([14-execution-history.md §3.7](../2-navigation/14-execution-history.md#37-re-run-액션)) | 실행 요약 카드 우측 헤더 | 버튼 disabled + tooltip "Re-run 권한이 없습니다 (정책 RR-PL-06)" |
| Run Results 드로어 ([3-execution.md §10.14](../3-workflow-editor/3-execution.md#1014-re-run-진입점)) | 드로어 헤더 우측 | 버튼 hidden (드로어는 워크플로 작성 중 컨텍스트라 노이즈 줄임) |

두 진입점 모두 동일한 모달을 띄운다.

### 10.2 Re-run 모달

```
┌─ Re-run Execution ────────────────────────────────────────────┐
│  원본 실행: #1234 · 2026-05-12 14:02:30 · ✅ Completed         │
│                                                                │
│  이 워크플로는 외부 호출 노드 3개 — Send Email × 1, HTTP × 2 │
│  — 를 포함합니다.                                              │
│                                                                │
│  ┌─ 입력 데이터 ─────────────────────────────────────────┐   │
│  │ ☐ 원본 입력 그대로 사용 (RR-PL-02)                     │   │
│  │                                                         │   │
│  │ name        [Alice                            ]        │   │
│  │ count       [3                                ]        │   │
│  │ extra.flag  [☑ true                           ]        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                │
│  ☐ dry-run 모드 (RR-PL-01) — 외부 호출 skip + mock 출력       │
│                                                                │
│                                          [취소]  [재실행]      │
└────────────────────────────────────────────────────────────────┘
```

**필드 동작**:

| 요소 | 기본값 | 동작 |
| --- | --- | --- |
| 원본 실행 헤더 | — | 원본 ID, 시작 시각, 최종 상태 표시. ID 클릭 시 새 탭으로 원본 상세 페이지 |
| 외부 호출 노드 안내 | — | 본 워크플로의 `supportsDryRun: true` 노드 수를 카테고리별 집계 (`grouped by node.type`) |
| 입력 데이터 폼 | 원본의 `inputData.parameters` | Manual Trigger parameters 스키마 기반 동적 폼. 필드 라벨/타입은 워크플로의 manual_trigger 노드 config 에서 도출 ([Spec 실행 엔진 §6.1.1](./4-execution-engine.md#611-트리거-입력-파라미터-seeding)) |
| "원본 입력 그대로 사용" 토글 | OFF (편집 가능) | ON 으로 두면 폼 read-only + "재실행" 버튼이 한 클릭 경로. 프론트엔드는 토글 상태로부터 `useOriginalInput` 을 **항상 명시 전송**하므로, §8.1 의 API 기본값 `true` 는 필드를 생략한 직접 API 호출자용 안전 폴백일 뿐 UI 기본값(OFF=false)과 모순되지 않는다 |
| "dry-run 모드" 토글 | OFF | 워크플로에 `supportsDryRun: false` 노드가 있으면 disabled + tooltip "이 워크플로는 dry-run 미지원 노드를 포함합니다 (RR-PL-01)" |
| "재실행" 버튼 | — | 클릭 시 권한 가드 통과 → `POST /api/executions/:id/re-run` → 응답의 새 Execution ID 로 라우팅 (`/workflows/:workflowId/executions/:newId`) |
| "취소" 버튼 | — | 모달 닫기. 변경 입력 폐기 |

### 10.3 Chain 표시

실행 상세 페이지 헤더에 chain 정보:

```
┌──────────────────────────────────────────────────────────────────┐
│ ← Executions                                  [← Prev] [Next →]  │
│ ──────────────────────────────────────────────────────────────── │
│  ✅ Completed                                                     │
│  Started: 2026-05-13 09:14:02   Duration: 3.2s                   │
│  Nodes: 10/10 completed                                          │
│  ─                                                                │
│  📎 #3-th re-run · dry-run · 원본: #1234   [View chain (4) ▼]   │
└──────────────────────────────────────────────────────────────────┘
```

| 요소 | 표시 조건 | 내용 |
| --- | --- | --- |
| Chain badge | `re_run_of != null` | "#N-th re-run" (chain 의 N번째 재실행) + 원본 실행 ID 링크. dry-run 이면 "· dry-run" 부착 |
| "View chain" 드롭다운 | chain 의 실행이 2개 이상 | 클릭 시 같은 chain 의 모든 실행을 펼침 — 각 항목은 ID, 시작 시각, 최종 상태, dry-run 여부 |

### 10.4 i18n 키

| 키 | 한국어 | 영어 |
| --- | --- | --- |
| `history.actions.rerun` | 재실행 | Re-run |
| `history.rerun.modal.title` | 실행 다시 시작 | Re-run Execution |
| `history.rerun.modal.originalLabel` | 원본 실행 | Original Execution |
| `history.rerun.modal.sideEffectWarning` | 이 워크플로는 외부 호출 노드 {{count}}개를 포함합니다 | This workflow includes {{count}} external-call node(s) |
| `history.rerun.useOriginalInput` | 원본 입력 그대로 사용 | Use original input |
| `history.rerun.dryRunToggle` | dry-run 모드 (외부 호출 skip) | Dry-run mode (skip external calls) |
| `history.rerun.dryRunDisabledTooltip` | 이 워크플로는 dry-run 미지원 노드를 포함합니다 | This workflow contains nodes that don't support dry-run |
| `history.rerun.confirmButton` | 재실행 | Re-run |
| `history.rerun.cancelButton` | 취소 | Cancel |
| `history.rerun.chainBadge` | #{{n}}-th re-run | #{{n}}-th re-run |
| `history.rerun.chainBadgeDryRun` | dry-run | dry-run |
| `history.rerun.chainOrigin` | 원본 | original |
| `history.rerun.viewChain` | chain 보기 ({{count}}) | View chain ({{count}}) |
| `history.rerun.permissionDenied` | Re-run 권한이 없습니다 (정책 RR-PL-06) | You don't have permission to re-run (RR-PL-06) |
| `history.rerun.chainDepthExceeded` | 같은 체인의 재실행이 한도(32)에 도달했습니다 | This chain has reached the re-run depth limit (32) |
| `history.rerun.workflowDeleted` | 원본 실행의 워크플로가 삭제되어 재실행할 수 없습니다 | The workflow of the original execution has been deleted |
| `history.rerun.dryRunNotApplicable` | 이 워크플로는 dry-run 모드로 재실행할 수 없습니다 | This workflow cannot be re-run in dry-run mode |
| `history.rerun.assistantBlocked` | Re-run 은 사용자가 실행 상세 페이지에서 직접 트리거해야 합니다 (RR-PL-07) | Re-run must be triggered manually on the execution detail page (RR-PL-07) |

---

## 11. 감사 로그

`audit_log` 테이블에 신규 이벤트 `re_run_initiated` 를 기록한다. `audit_log.action` 은 enum 제약 없는 `varchar(100)` 이므로 별도 마이그레이션 없이 새 action 문자열만 추가하면 된다.

아래는 **논리 필드 → 실제 `audit_log` 컬럼** 매핑이다 (entity: `AuditLogsService.record`).

| 논리 필드 | 실제 컬럼 | 값 |
| --- | --- | --- |
| `event_type` | `action` | `re_run_initiated` |
| `actor_user_id` | `user_id` | 호출자 사용자 ID |
| `target_type` | `resource_type` | `execution` |
| `target_id` | `resource_id` | **새로 생성된** Execution ID |
| `metadata` | `details` (jsonb) | `{ "originalExecutionId": "<UUID>", "chainId": "<UUID>", "dryRun": boolean, "inputModified": boolean }` |
| (워크스페이스 격리) | `workspace_id` | re-run 요청의 워크스페이스 ID |

`inputModified` 는 `useOriginalInput === false` 이고 resolved 입력이 원본 `inputData.parameters` 와 다를 때 `true`. 대용량 입력은 details 에 저장하지 않는다 — 변경 여부만 boolean. 감사 로그 기록 실패는 `AuditLogsService.record` 내부에서 swallow 되어 re-run 주 동작을 깨지 않는다.

감사 로그 표준 schema 는 [Spec 데이터 흐름 — audit](../data-flow/1-audit.md) 참조.

---

## 12. Rate limit

사용자당 분당 10회. 초과 시 표준 `429 TOO_MANY_REQUESTS` (Spec [API 규칙 §3 Rate Limiting](./2-api-convention.md) 의 공통 정책 적용).

본 spec 은 정책만 명시. 구현은 BullMQ 기반 토큰 버킷 또는 Redis INCR + EXPIRE 패턴 중 선택 (개발자 재량).

---

## 13. AI Assistant 와의 관계 (RR-PL-07 상세)

[Spec AI Assistant §4.1 탐색 도구](../3-workflow-editor/4-ai-assistant.md#41-탐색-도구-clarify-read-only) 의 read-only 도구 (`get_workflow_executions`, `get_execution_details`) 는 Re-run 을 트리거하지 않는다. 본 spec 은 새 Re-run 도구를 정의하지 않는다.

사용자가 Assistant 에게 "이 실행을 다시 돌려줘" 같은 요청을 하면 Assistant 는 다음 패턴으로 응답한다:
- 원본 실행 정보를 `get_execution_details` 로 조회해 사용자에게 요약 제시
- "Re-run 은 보안·부수효과 정책에 따라 사용자가 직접 실행 상세 페이지에서 트리거해야 합니다 (정책 RR-PL-07)" 안내
- 실행 상세 페이지로의 deep link 제공

향후 Trust 단계 (사용자가 명시적으로 "AI 에게 Re-run 권한 부여" 토글) 도입 후 G2 옵션을 별도 plan 으로 검토. 본 spec 범위 밖.

---

## 14. 기존 정책과의 관계

### 14.1 워크플로 정의 — "현재 시점" (Spec 4-execution-engine §6.3)

Re-run 은 [Spec 실행 엔진 §6.3](./4-execution-engine.md#63-재실행조회-정책-replay-policy) 의 결정 그대로 **원본 실행 시점의 snapshot 이 아닌 현재 시점의 워크플로 정의** 를 사용한다. 사용자는 모달 헤더의 워크플로 변경 안내를 통해 이를 인지할 수 있다 (원본 실행 이후 워크플로가 갱신됐다면 "원본 이후 워크플로가 N회 수정되었습니다 — 결과가 다를 수 있습니다" 표기 — v2+ 에서 검토, v1 은 일반 안내만).

### 14.2 raw config echo 정책 — Re-run 의 핵심 전제

Re-run 이 "현재 시점의 워크플로 정의의 raw config 를 다시 평가" 하려면 [Spec 실행 엔진 §6.1 컨텍스트 구조](./4-execution-engine.md#61-컨텍스트-구조) 의 `rawConfig` echo 가 노드 핸들러 전체에서 일관되게 동작해야 한다. 본 spec 은 raw config 노출이 노드 핸들러 전체에 적용된 것을 전제로 한다.

### 14.3 Multi-turn snapshot 과의 직교성

Multi-turn resume 은 진행 중 실행의 다음 turn 을 같은 Execution row 안에서 진행한다 (`state.rawConfig` frozen snapshot 사용). Re-run 은 새 Execution row 를 생성하므로 두 모드는 직교한다 — 같은 워크플로의 multi-turn 노드도 RR-PL-04 에 따라 새 세션으로 시작. frozen snapshot 의 적용 범위는 **한 turn** 으로 한정된다 — park→재개 시 [Spec 실행 엔진 §6.1 rawConfig snapshot 정책](./4-execution-engine.md#61-컨텍스트-구조) 의 D3(fresh-config-per-turn)에 따라 `node.config` 를 fresh 재유도하므로, park 중 워크플로를 편집하면 다음 turn 부터 새 정의가 적용된다 (Re-run 의 "현재 시점 정의" 정책과 같은 방향).

노드 단위 재시도 (`execution.retry_last_turn`, [Spec WebSocket §4.2](./6-websocket-protocol.md#42-실행-제어-명령-client--server) + [Spec AI Agent §7.9](../4-nodes/3-ai/1-ai-agent.md#79-multi-turn-모드--오류-error-포트)) 도 본 Re-run 모드와 직교한다. retry 는 동일 Execution 안에서 같은 노드의 마지막 LLM 호출만 새 NodeExecution row 로 재진입하며, 성공 시 그 노드의 downstream 은 일반 노드 `COMPLETED` 와 동일하게 진행된다. Re-run 은 새 Execution row 와 chain 깊이 증가를 만드는 반면 retry 는 동일 chain·동일 Execution 안의 in-place 재시도라는 점이 다르다 — retry 는 새 Execution row 를 생성하지 않으므로 §9 의 `re_run_of` / `chain_id` 에 관여하지 않으며, chain badge (§10.3) 도 부여되지 않는다.

### 14.4 트리거 실행과의 관계

Re-run 은 **트리거를 다시 발화하지 않는다** — 원본 실행이 webhook 으로 시작됐어도 Re-run 은 webhook 발화 없이 manual 경로로 진행한다. 결과 Execution row 의 `executed_by = <Re-run 호출자>`, `trigger_id = NULL` 로 채워진다 ([Spec 실행 엔진 §6.1.1](./4-execution-engine.md#611-트리거-입력-파라미터-seeding) 의 Manual 경로와 동일).

`triggerSource` 분류 ([Spec 실행 내역 §2.4](../2-navigation/14-execution-history.md#24-테이블)) 는 본 실행을 `manual` 로 표기하고, chain badge 가 함께 노출되어 출처가 Re-run 임을 별도 표기한다.

---

## 15. 향후 확장 (Phase 2 후속)

본 spec 의 범위 밖. 별도 plan 으로 추적 예정.

| 옵션 | 설명 | 차단 사유 |
| --- | --- | --- |
| **C2** resume-from-failure | 실패 노드부터 이어 실행 | 표현식 컨텍스트 복원, branch 합류 처리, blocking 노드 재진입 — 엔진 안전성 검증이 별도 plan 분량 |
| **C3** single-node debug | 단일 노드만 재실행 | 입력 데이터 격리, downstream 미진행, 표현식 컨텍스트 mock — 디버그 도구 plan 으로 분리 |
| **B3** 표현식 재평가만 | 외부 호출은 그대로 + 모든 expression 만 재평가 | A2 dry-run 과 의미가 헷갈리므로 UX 별도 검토 |
| **D2** multi-turn 입력 재사용 | 원본의 사용자 응답을 자동 재사용 | 테스트 자동화 도구 plan (별도) — Re-run 이 "테스트" 가 아닌 "재실행" 인 v1 의도와 결이 다름 |
| **G2** AI Assistant Re-run 도구 | Assistant 가 Re-run 트리거 가능 | Trust 단계 (사용자 명시적 권한 부여 토글) 도입 선결 |
| **A3** 멱등성 키 자동 부여 | Re-run 시 외부 호출에 idempotency key 자동 첨부 | 외부 시스템 호환성 (Email/DB write 다수가 idempotency 미지원) — 노드별 옵트인 메타로 v2+ |
| **A4** 노드별 Re-run 정책 메타 | 노드마다 "재호출/skip/require-confirm" 표기 | 모든 노드 schema 확장 + 마이그레이션 + UI 변경 — 비용 큼 |

---

## 16. 비기능 요구

| 항목 | 정책 |
| --- | --- |
| 권한 | RR-PL-06 — 원본 시작자 + 워크스페이스 Editor+ |
| 감사 로그 | §11 — `re_run_initiated` 이벤트 |
| Rate limit | §12 — 사용자당 분당 10회 |
| 관측성 | NodeExecution 의 dry-run 표기 (§7.4) + chain badge 로 Re-run 트래픽을 일반 manual 실행과 구분 가능 |
| 회귀 잠금 | 단위·통합·e2e 테스트가 다음을 회귀 가드:<br>- 입력 동일/수정/dry-run 케이스<br>- 권한 거부 (`RERUN_PERMISSION_DENIED`)<br>- 삭제된 워크플로 (`RERUN_WORKFLOW_DELETED`)<br>- chain 깊이 32 초과 (`RERUN_CHAIN_DEPTH_EXCEEDED`)<br>- multi-turn 노드 새 세션 (RR-PL-04)<br>- AI Assistant 비트리거 (RR-PL-07) |

---

## Rationale

### 왜 A5 (확인 모달 + dry-run 토글) 인가

A1 (확인 모달만) 은 결제 노드처럼 운영 사고 가능성이 큰 경우의 안전판이 약하다 — 사용자가 모달을 무심코 통과하면 그대로 결제가 재트리거된다.

A4 (노드별 Re-run 정책 메타) 는 가장 정밀하지만 모든 노드 schema 확장 + 마이그레이션 + 워크플로 작성자에게 새 메타 필드 노출이 필요해 v1 비용이 크다. v2+ 에 둘 만한 진화 경로.

A5 (혼합) 는 카테고리 메타만으로 외부 부수효과 노드를 분류하고 (이미 [Spec 노드 §2](../4-nodes/0-overview.md) 에 카테고리 존재), dry-run 모드를 토글로 제공해 사용자가 디버그 의도와 운영 의도를 명시적으로 분리할 수 있게 한다. 카테고리 메타 활용으로 추가 schema 비용은 노드 핸들러의 `supportsDryRun: boolean` + handler 의 `meta.dryRun` 분기뿐 — 작은 면적.

### 왜 B2 (원본 미리보기 + 편집) 가 기본인가

가장 흔한 use-case 는 디버그·재현이고, 디버그·재현은 입력 미세 조정으로 결과 차이를 비교하는 흐름이 많다. B1 (항상 원본 그대로) 는 한 클릭 경로의 매력이 있지만 모달의 토글로 동등하게 제공 가능. B3 (표현식만 재평가) 는 A2 dry-run 과 의미가 겹쳐 UX 가 혼란스러워 v1 미포함.

### 왜 C1 (전체 워크플로만) 인가

resume-from-failure (C2) 는 표현식 컨텍스트 복원, branch 합류 처리 (특히 Parallel·Merge), blocking 노드 재진입 (Form/Buttons/AI Multi Turn) 의 엔진 안전성 검증이 별도 plan 분량이다. v1 에서는 전체 워크플로 Re-run 만으로도 디버그·재시도·테스트 use-case 의 80% 를 커버.

### 왜 D1 (multi-turn 새 입력) 인가

multi-turn 노드의 사용자 응답을 자동 재사용 (D2) 하면 외부 부수효과 (사용자 응답에 의존하는 분기 — 예: AI Agent 가 user message 에 따라 결제 도구를 호출) 가 통제 안 되며, 이는 RR-PL-01 의 안전 원칙과 충돌. D1 은 "Re-run 은 사용자가 의도적으로 다시 흐름을 진행하는 것" 이라는 v1 의도에 맞다. D2 는 테스트 자동화 도구 plan 으로 분리 권장.

### 왜 E3 (`re_run_of` + `chain_id` 둘 다) 인가

E1 (`re_run_of` 만) 은 직계 부모는 빠르지만 chain 전체 조회는 recursive CTE 가 필요해 SELECT 가 느려진다 (chain 깊이 32 까지 가능). E2 (`chain_id` 만) 는 chain 전체 조회는 빠르지만 직계 부모를 알려면 같은 chain 안의 모든 행을 정렬해야 한다.

E3 은 컬럼 1개 (`chain_id`) + 인덱스 1개 (`(chain_id, started_at)`) 추가 비용으로 두 조회 패턴을 모두 효율화. chain badge 가 직계 부모와 chain 위치를 동시에 표시하는 본 spec 의 UX 에 잘 맞는다.

### chain 깊이 32 의 근거

운영 use-case 분석 결과 — 디버그 시 같은 입력으로 5~10번 반복하는 경우는 흔하지만 32회를 넘기는 경우는 거의 없다 (보통 사용자가 입력을 바꾸거나 워크플로 정의를 수정하러 떠난다). 32 는 "안전한 방어 한도" 로, 그 이상은 무한 루프나 잘못된 자동화 스크립트 가능성이 높아 거부하는 것이 사용자 보호. 운영 후 한도 조정 가능.

### 왜 G1 (AI Assistant 비트리거) 인가

AI Assistant 의 read-only 정책 ([Spec AI Assistant §4.1](../3-workflow-editor/4-ai-assistant.md#41-탐색-도구-clarify-read-only)) 은 사용자가 의도하지 않은 부수효과를 Assistant 가 일으키지 않도록 하는 안전판이다. Re-run 은 외부 호출 재트리거 가능성 (RR-PL-01) 이 본질이므로 이 안전판 안쪽에 둔다. G2 (Assistant Trust 단계) 는 별도 plan 에서 검토 — Trust 단계 자체가 본 spec 의 범위를 넘어선다.

### 본 spec 이 단일 파일인 이유

`spec/5-system/` 의 다른 영역들 (12-webhook, 10-graph-rag) 도 단일 spec 파일에 Overview + 본문 + Rationale 을 함께 담는 패턴을 쓴다. Re-run 은 영역 단위가 아닌 단일 기능이라 같은 패턴이 적합. 본 spec 이 14-execution-history.md / 4-ai-assistant.md / 3-execution.md 등에 cross-link 되더라도, 정책의 single source of truth 는 본 파일.

### `execution.retry_last_turn` 과의 경계 (§14.3 보강)

노드 단위 재시도 (`execution.retry_last_turn`, [Spec AI Agent §7.9](../4-nodes/3-ai/1-ai-agent.md#79-multi-turn-모드--오류-error-포트) + [§12.8](../4-nodes/3-ai/1-ai-agent.md#128-retry_last_turn-성공-후-downstream-graph-진행)) 는 동일 Execution 안에서 같은 노드의 마지막 LLM 호출만 새 NodeExecution row 로 재진입하는 in-place 재시도이며, 성공 시 downstream graph 는 일반 노드 `COMPLETED` 와 동일하게 진행된다. 본 Re-run spec 의 단위 (전체 워크플로, RR-PL-03) 와 chain 추적 모델 (RR-PL-05) 은 retry 에 적용되지 않으며, 둘은 동일 사용자 가치 ("실패한 흐름 다시" — §2) 의 다른 입자 (granularity) 다. retry 가 노드 단위로 좁고 빠른 회복 (시간 단위 60분 TTL) 을 다루고, Re-run 이 워크플로 단위로 무한 깊이 (chain 32) 의 재실행을 다룬다.
