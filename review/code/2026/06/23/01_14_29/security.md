# 보안(Security) 리뷰

## 발견사항

### [INFO] LLM 제공 문자열 인자 길이 상한 미적용 (pre-existing)
- 위치: `/codebase/backend/src/modules/workflow-assistant/tools/assistant-tool-router.service.ts` — `dispatchNodeSchema` 내 `typeArg`, `handleExploreCall` switch 내 `args.id`, `args.search` 등
- 상세: `asString(args.type, '')` 로 타입 안전 추출은 이루어지나 길이 상한 검증이 없다. LLM 이 비정상적으로 긴 문자열을 `args.type` 으로 전달해도 그대로 캐시 키 및 DB 쿼리 파라미터로 전달될 수 있다. 본 PR 이 새로 도입한 위험이 아니라 `ExploreToolsService` 진입 경로 전체의 pre-existing 기술 부채다. ORM 이 파라미터를 바인딩 처리하므로 SQL 인젝션 위험은 낮으나, 과도하게 긴 문자열이 캐시 맵 키로 적재되는 메모리 낭비 및 DB 컬럼 길이 초과 오류 가능성은 잔재한다.
- 제안: 리팩터링 범위 밖. 향후 `handleExploreCall` 진입 전 공통 길이 상한 검증(예: 256자) 레이어 추가 검토.

### [INFO] 내부 오류 메시지의 SSE 노출 가능성 (pre-existing)
- 위치: `/codebase/backend/src/modules/workflow-assistant/tools/assistant-tool-router.service.ts` — `handleExploreCall` 의 `get_current_workflow` safety-net 분기 (L596–L603 추정)
- 상세: safety-net 분기가 "stream loop", "shadow access" 등 내부 구현 세부 문자열을 포함한 `ok: false` 응답을 반환하면, 해당 응답이 LLM tool_result 를 통해 클라이언트 SSE 스트림으로 전달될 수 있다. 본 PR 은 이 코드를 verbatim 이동했을 뿐 새로 도입한 취약점이 아니다.
- 제안: 별건 처리. 클라이언트 노출 우려 시 상세 메시지를 서버 로그 전용으로 분리하고 클라이언트에는 `'INTERNAL_ERROR'` 코드만 반환하도록 개선 고려.

### [INFO] `typeArg` 를 캐시 키로 사용 시 특수 문자 처리 확인 불필요
- 위치: `assistant-tool-router.service.ts` — `dispatchNodeSchema` L134, L164
- 상세: `typeArg` 는 `Map` 의 키로만 사용되므로 HTML/SQL 인젝션 표면이 없다. `Map.get/set` 은 키를 문자 그대로 비교하므로 프로토타입 오염이나 경로 탐색 공격 가능성도 없다. 추가 조치 불필요.
- 제안: 해당 없음.

### [INFO] 하드코딩된 시크릿 없음
- 위치: 변경된 모든 파일
- 상세: API 키, 비밀번호, 토큰, 인증서 등 하드코딩된 시크릿이 존재하지 않는다. `SCHEMA_LOOKUP_HARD_STOP = 3` 은 비즈니스 로직 상수로 보안 민감 정보가 아니다.
- 제안: 해당 없음.

### [INFO] 인증/인가 변경 없음
- 위치: 변경된 모든 파일
- 상세: 이번 변경은 내부 dispatch 로직의 메서드 추출 리팩터링이다. 인증·인가 경계(NestJS Guard, 미들웨어 레이어)에 변경이 없으며 `dispatchNodeSchema` 는 이미 인증된 요청 컨텍스트 내에서만 호출된다.
- 제안: 해당 없음.

## 요약

이번 M-3 1단계 리팩터링(dispatchNodeSchema 추출 + 테스트 보강)은 동작 보존(behavior-preserving) 변경으로 신규 보안 취약점을 도입하지 않는다. 인젝션·하드코딩 시크릿·인증/인가·암호화·에러 처리 각 항목 모두 이전 리뷰(01_00_21)에서 확인된 pre-existing 사항(LLM 인자 길이 상한 미적용, safety-net 내부 메시지 SSE 노출 가능성)이 그대로 유지될 뿐 본 PR 이 표면을 넓히거나 새로운 위험을 추가하지 않는다. 의존성 변경도 없어 알려진 취약 라이브러리 도입 위험도 없다.

## 위험도

NONE
