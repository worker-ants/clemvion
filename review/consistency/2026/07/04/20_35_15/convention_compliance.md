# 정식 규약 준수 검토 — convention_compliance

## 검토 메타

- 모드: `--impl-done` (구현 완료 후 검토)
- payload 상 target: `spec/5-system/` (실제로는 `1-auth.md` 전체 + graph-rag 관련 문서가 통째로 번들된 **mis-scoped payload**로 확인됨 — payload 안내문 자체가 "known to be mis-scoped" 라고 명시)
- **실제 diff 기준**(`git diff origin/main...HEAD`, 이 검토의 근거로 채택):

```
codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts | +124 (unit spec 추가만)
codebase/backend/test/execution-concurrency-cap.e2e-spec.ts                    | +81/-13 (e2e spec 수정+추가)
```

그 외 diff 항목은 이전 세션(`20_09_53`)의 review 산출물(`review/consistency/2026/07/04/20_09_53/**`)뿐이며 이는 산출물 커밋이지 구현 코드가 아니다.

- 소스 코드(`.service.ts`, DTO, controller, spec 문서 등) 변경분은 **0줄**. `spec/5-system/1-auth.md` 등 spec 문서는 이번 diff 에 전혀 포함되지 않았다 — payload 의 "target 문서" 섹션은 이번 변경과 무관한 이전 컨텍스트가 잘못 실린 것으로 판단, 무시하고 실제 diff 만을 검토 대상으로 삼는다.

## 점검 결과

### 1. 명명 규약
변경분은 두 `*.spec.ts` / `*.e2e-spec.ts` 파일 내부의 헬퍼 함수(`createCapWorkflow`, `execute`, `getStatus`, `poll`, `admitStub`)와 테스트 케이스(`it(...)`) 추가뿐이다. 기존 파일의 명명 스타일(카멜케이스 함수명, 한국어 `it()` 설명)을 그대로 따르고 있어 이질적 명명 패턴 도입 없음. 신규 파라미터 `wsId`, `workflowCap` 도 기존 규약과 정합.

### 2. 출력 포맷 규약
API 응답 포맷·이벤트 payload·에러 코드 신설이 없다. e2e 테스트에서 사용하는 응답 필드(`res.body.data.id`, `res.body.data.status` 등)는 기존 코드가 이미 전제하던 `{ data: ... }` wrapper 를 그대로 재사용(`TransformInterceptor` 규약, [`spec/5-system/2-api-convention.md`](../../../../spec/5-system/2-api-convention.md) 참고)하며 신규 코드 추가 없음. 위반 없음.

### 3. 문서 구조 규약
이번 diff 에 `spec/**` 문서 변경이 전혀 없다(0줄). `_product-overview.md`/`0-` prefix/Overview·본문·Rationale 3섹션 규약이 적용될 대상 자체가 없음.

### 4. API 문서 규약 (OpenAPI/Swagger)
신규·변경 컨트롤러/DTO 가 없으므로 `@ApiProperty`/`@ApiOperation` 등 데코레이터 명명 패턴 검토 대상 없음.

### 5. 금지 항목
- unit spec 신규 케이스는 `mockExecutionRepo.manager.transaction` 을 stub 하여 admission UPDATE 의 파라미터 순서(`[executionId, workspaceId, wsCap, workflowId, wfCap]`)를 고정하는 회귀 테스트다. 원문 SQL 자체(운영 코드의 조건부 UPDATE 문)는 이번 diff 에 포함되지 않고 기존 구현을 검증만 한다 — `error-codes.md`/`node-output.md` 등에서 금지하는 패턴(예: 인라인 문자열 에러 코드 신설, snake_case 신규 채택 등)에 해당하는 대목이 없다.
- e2e spec 은 워크스페이스 단위 admission cap 시나리오를 위해 `db.query(...)` 로 `workflow.settings`/`workspace.settings` JSONB 를 직접 조작한다. 이는 기존 동일 파일의 기존 테스트(변경 전 `UPDATE workflow SET settings = '{"maxConcurrentExecutions":1}'::jsonb ...`)가 이미 채택한 패턴을 함수화(파라미터화)한 것뿐이며, 새로운 DB 접근 패턴이나 마이그레이션(`migrations.md`) 규약 위반 소지 없음.
- 새 테스트가 참조하는 식별자(`EXECUTION_QUEUE_WAIT_TIMEOUT`, `exec-cap:<workspaceId>` advisory-lock 키, `TERMINAL_STATUSES`)는 모두 기존 구현 코드에서 이미 쓰이던 것을 재사용한 것으로 보이며(이번 diff 는 테스트 파일에서만 참조), 신규 명명 채택이 아니다.

## 발견사항

없음 (검토 대상 실제 diff — 2개 테스트 파일 — 범위 내에서 conventions 위반 사항 미발견).

## 요약

payload 는 `1-auth.md` 등 이번 변경과 무관한 대용량 문서를 잘못 번들했으나(known mis-scope), 실제 `git diff origin/main...HEAD` 는 PR2b/PR4 §8 admission gate 회귀 방지를 위한 **테스트 코드 전용 변경**(unit spec +124줄, e2e spec +81/-13줄)이다. 소스 코드·spec 문서·API 표면·DTO·에러 코드 신설이 전혀 없어 명명·출력 포맷·문서 구조·API 문서·금지 패턴의 5개 관점 모두에서 검토 대상 자체가 실질적으로 없거나, 존재하는 범위(테스트 헬퍼 함수 명명, DB 직접 조작 패턴)는 기존 파일의 기존 관례를 그대로 확장한 것이라 정식 규약과 충돌하지 않는다.

## 위험도

NONE

BLOCK: NO
STATUS: SUCCESS
