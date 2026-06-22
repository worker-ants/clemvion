# 보안(Security) 리뷰 결과

리뷰 대상: `refactor(workflow-assistant): M-3 1단계 — AssistantToolRouter 추출`
리뷰 일시: 2026-06-23

---

## 발견사항

### [INFO] LLM 제공 인자(args)의 문자열 길이 상한 미적용
- 위치: `codebase/backend/src/modules/workflow-assistant/tools/assistant-tool-router.service.ts` — `handleExploreCall` switch 내 `asString(args.type, '')`, `asString(args.id, '')` 등 모든 문자열 인자 처리
- 상세: `asString` 헬퍼는 타입 검사(string 여부)만 수행하고 길이 상한은 검사하지 않는다. `args.type`, `args.id`, `args.search`, `args.status` 등 LLM이 생성한 문자열이 그대로 `ExploreToolsService` 메서드에 전달된다. LLM 입력 자체는 신뢰 경계 안에 있으나, 비정상적으로 긴 문자열이 DB 쿼리 파라미터로 전달될 경우 성능 영향이 발생할 수 있다. SQL 인젝션 리스크는 `ExploreToolsService` 레이어(ORM/쿼리빌더)가 파라미터 바인딩으로 처리한다고 가정하면 낮다.
- 제안: `args.type`, `args.id`, `args.search` 등에 합리적 길이 상한(예: 256자)을 적용하거나, `ExploreToolsService` 진입 전 유효성 검증 레이어가 있는지 확인한다. 현 변경 범위(리팩토링)에서 기존 동작을 보존하는 것이 목적이므로 즉각 수정 필수는 아니며, INFO 수준.

---

### [INFO] `get_node_schema` 캐시 키가 LLM 제공 `args.type` 값 그대로 사용됨
- 위치: `assistant-tool-router.service.ts` 라인 506–537 — `const typeArg = typeof args.type === 'string' ? args.type : ''; const cached = typeArg ? ctx.schemaCache.get(typeArg) : undefined;`
- 상세: `schemaCache` 맵의 키로 LLM이 전달한 `args.type` 문자열을 그대로 사용한다. 캐시 자체는 turn-scoped(요청 단위 생성)이며 싱글턴 상태가 아니라 `streamMessage`가 소유·전달하는 로컬 `Map`이므로, 캐시 포이즈닝(한 세션이 다른 세션 캐시를 오염)은 구조적으로 불가능하다. 다만 `typeArg`가 빈 문자열(`''`)일 때 `ctx.schemaCache.get('')` 대신 `undefined`로 단락되므로 빈 문자열로 캐시 항목이 축적되지 않는 점은 올바르다.
- 제안: 특이한 보안 위험 없음. 현 구현 적절.

---

### [INFO] `verify_workflow` 결과의 `missingNodeIds`/`missingEdgeIds`가 LLM 응답에 포함되어 클라이언트로 SSE 전달될 수 있음
- 위치: `assistant-tool-router.service.ts` `buildVerifyWorkflowResult` — `missingNodeIds`, `missingEdgeIds` 필드
- 상세: 이 배열은 shadow 스냅샷의 내부 노드/엣지 ID 목록이다. 해당 ID가 사용자에게 의미 없는 내부 식별자(UUID 계열)라면 직접적 민감 정보 노출은 아니다. 다만 이 tool_result가 SSE 스트림을 통해 클라이언트에 노출될 경우, 현재 워크플로우의 노드 수와 식별자 패턴이 드러난다. 워크플로우 ID나 설정값(config) 자체는 포함되지 않으며, 코드 주석에 "snapshot 자체를 응답에 포함하지 않는 이유" 설명이 있어 의도적 설계임이 명확하다.
- 제안: 현재 설계 의도에 부합하며 보안 위험 미미. 클라이언트 측 SSE 수신 권한 검증(인증된 세션만 스트림 접근)이 상위 레이어에서 이루어지고 있다면 추가 조치 불필요.

---

### [INFO] `get_current_workflow` safety-net 분기의 내부 오류 메시지 노출
- 위치: `assistant-tool-router.service.ts` 라인 596–603 — `error: 'INTERNAL', message: 'get_current_workflow must be handled by the stream loop with shadow access.'`
- 상세: 이 분기는 프로그래밍 오류(caller 가 shadow 선처리를 건너뜀)를 방어하는 safety-net이다. 메시지가 LLM의 tool_result로 반환되며, SSE를 통해 클라이언트 측으로도 전달될 수 있다. 메시지 내용은 내부 아키텍처("stream loop", "shadow access")를 노출하나, 이 정보가 실제 공격 벡터가 되기 어렵다. 운영 환경 로그에서는 문제없으나, 클라이언트에 도달하는 경우 내부 구조 힌트가 된다.
- 제안: 클라이언트 노출이 우려된다면 메시지를 `'INTERNAL_ERROR'` 코드만 반환하고 상세 설명은 서버 로그에만 기록하는 방식으로 변경을 고려할 수 있다. 현재 변경 범위에서는 기존 동작 보존이 목표이므로 즉각 조치 불필요.

---

### [INFO] `classifyKind` 미등록 도구명이 기본값 `'edit'`로 폴백
- 위치: `assistant-tool-router.service.ts` 라인 463–465 — `return TOOL_KIND_BY_NAME[toolName] ?? 'edit';`
- 상세: 알 수 없는 도구명이 `'edit'` kind로 분류된다. 주석에 "shadow.apply 가 UNKNOWN_TOOL 로 거른다"고 명시되어 있어 실제 실행 전에 후속 guard가 차단함을 의도하고 있다. 다만 이 폴백이 없는 도구가 edit 흐름으로 진입해 side-effect를 발생시킬 가능성에 대한 방어는 `streamMessage`의 edit 분기 안에서 이루어진다고 가정한다.
- 제안: 현재 설계 의도에 부합. `shadow.apply` UNKNOWN_TOOL 처리가 실제로 존재하는지 후속 리뷰에서 확인 권장.

---

## 요약

이번 변경은 기존 `streamMessage` 내 explore dispatch 로직을 `AssistantToolRouter`로 추출하는 순수 리팩토링이다. 신규 보안 취약점이 도입되지 않았으며, LLM tool argument는 타입 체크(`asString`, `typeof` 가드)를 통해 기본 검증이 이루어진다. 하드코딩된 시크릿, 인증 우회, SQL/커맨드 인젝션, 암호화 관련 변경은 없다. turn-scoped cache는 요청별 독립 `Map`으로 세션 간 오염이 구조적으로 불가능하다. `INTERNAL` 오류 메시지가 LLM tool_result로 클라이언트에 전달될 가능성이 있으나 아키텍처 힌트 수준이며 실질 공격 벡터가 아니다. LLM 제공 문자열 인자의 길이 상한이 이 레이어에 없다는 점은 upstream(`ExploreToolsService`, ORM 바인딩)에서 처리된다는 전제 하에 INFO 수준으로 판단한다.

---

## 위험도

NONE

---

STATUS: SUCCESS
