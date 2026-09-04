# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-done)

## 검토 대상

`git diff origin/main...HEAD` 상 코드 변경은 2개 파일(125줄)로 한정된다:

- `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts`
- `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.spec.ts`

내용: `ExecutionStatusDto` 의 `durationMs`/`currentNode`/`context`/`result`/`error` 5개 필드를
`@ApiPropertyOptional({nullable:true}) field?: T | null` → `@ApiProperty({nullable:true}) field: T | null`
로 바꾸고(OpenAPI `required:false→true`), 회귀 방지용 `NULL_PRESENT_FIELDS` 상수를 신설해
`nullable`·`required` 두 단언이 목록을 공유하게 했다. `spec/5-system/` 자체는 이 브랜치에서
델타 0(코드 전용 PR).

## 대조한 spec 영역

- `spec/5-system/2-api-convention.md` §5.4 (부재 표현 — `null` vs 키 생략, 응답 바디 한정)
- `spec/5-system/14-external-interaction-api.md` §5.3 (`GET /api/external/executions/:id` wire 예시 + R17)
- `spec/conventions/swagger.md` §1-4 (닫힌 union 정본 예제, `ExecutionStatusDto.context`)
- `spec/conventions/chat-channel-adapter.md` (WS 이벤트 `durationMs?: number | null` — 참고용, 비교 대상)
- `plan/in-progress/spec-draft-nullable-notation-followups.md` (같은 축의 선행 작업 이력)

## 발견사항

이번 diff 범위(5필드 · 2파일)에서는 **CRITICAL/WARNING 없음**.

- **[INFO]** WS wire(`chat-channel-adapter.md`)의 `durationMs?: number | null` 은 여전히 §5.4 신규
  문면(응답 바디 전용)과 별개 축으로 남아 있다
  - target 위치: 해당 없음(이번 diff 가 만든 것도 건드린 것도 아님)
  - 충돌 대상: `spec/conventions/chat-channel-adapter.md:149-151` (`execution.completed`/`failed`/`cancelled` 이벤트 타입)
  - 상세: §5.4 는 `#1280` 으로 "응답 바디 한정" 이 이미 명문화돼 있어 WS 이벤트 타입과 직접
    충돌하지는 않는다. 다만 서버가 내보내는 또 다른 표면이라 같은 축(키 생략 vs null)의 판단이
    아직 없다. 이는 pre-existing 이며, 이미 `spec-draft-nullable-notation-followups.md` §후속
    (`planner`, 선행 질문: "WS wire 에서 키 부재와 null 이 다른 의미인가")에 등재돼 있고 앞선
    `--impl-done` 리뷰(`15_16_28`, cross_spec INFO#3)에서도 같은 판정을 받았다.
  - 제안: 신규 조치 불필요 — 기존 추적 항목 그대로 유지. 재-flag 하지 말 것.

## 검증한 정합성 (참고용 — 발견사항 아님)

- `durationMs`/`currentNode`/`result`/`error`: EIA §5.3 wire 예시(JSONC, `14-external-interaction-api.md:474-503`)가
  이 네 필드를 `null` 로, 특히 `durationMs` 는 "종결 전에는 null (키는 present — API 규약 §5.4 부재 표현)" 이라고
  명문화 — 코드의 `@ApiProperty({nullable:true}) field: T | null` 형태와 정확히 일치.
- `context`: `swagger.md` §1-4 의 정본 예제가 이미 `@ApiProperty({oneOf, nullable:true}) context: ButtonsContextDto | NodeOutputContextDto | null;` 로 이 diff 와 동일한 형태를 시연하고 있다 — 예제와 구현이 어긋나지 않는다.
- `conversationThread` (context 내부, 이번 diff 대상 아님): §5.4 표·EIA §5.3 콜아웃이 "키 생략" 규칙으로 명시 — DTO 표기 변경 대상에서 올바르게 제외돼 있다(diff 가 건드리지 않음).
- 이번 5필드는 `spec-draft-nullable-notation-followups.md` §후속 "1단계"(2026-09-04, `[x]`)에 정확히 대응하며, 그 draft 는 노출 경로가 `getStatus()` 단일 경로로 tsc 검증이 성립하는 유일한 묶음이라고 근거를 남겨 뒀다 — 이번 diff 의 범위 축소(15→5, `ExecutionDto` 10곳 제외)와 그 근거가 시간순으로 일치한다.
- 데이터 모델(`spec/1-data-model.md` Execution 계열)·RBAC(`1-auth.md` §3)·상태 전이·계층 책임 축에는 이번 diff 가 관여하지 않는다 — OpenAPI 데코레이터(`required`/`nullable` 선언)만 바뀌었고 wire 값·엔티티 컬럼·인가 로직은 무변경.

## 요약

이번 diff 는 `ExecutionStatusDto` 5개 필드의 OpenAPI `required` 선언을 실제 wire 계약("항상
present, 값만 null")에 맞추는 좁은 정정이며, `spec/5-system/2-api-convention.md` §5.4·
`spec/5-system/14-external-interaction-api.md` §5.3·`spec/conventions/swagger.md` §1-4 세
문서의 현재 문면과 정확히 합치한다. 세 문서 모두 이미 이 형태를 정본으로 채택해 두고 있어
diff 가 spec 을 뒤따라간 것이지 새 모순을 만든 것이 아니다. 유일하게 남는 것은 WS 표면
(`chat-channel-adapter.md`)의 별개 축 미결 항목인데, 이는 이번 diff 이전부터 있었고 이미
`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 트랙으로 등재·추적
중이므로 재차 결함으로 기록하지 않는다.

## 위험도

NONE
