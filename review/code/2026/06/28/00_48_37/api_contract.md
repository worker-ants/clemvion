# API 계약(API Contract) 리뷰

## 발견사항

### [INFO] CORS exposedHeaders 수정 — 올바른 수정, 하위 호환성 유지
- 위치: `codebase/backend/src/common/cors/web-chat-cors.ts` L69, `codebase/backend/src/main.ts` L125
- 상세: `CorsOptionsLike` 인터페이스에 `exposedHeaders?: string[]` 옵션 필드를 추가하고, `main.ts` `defaultOptions`에 `exposedHeaders: ['X-Deleted-Count']`를 설정한 것은 순수 가산(additive) 변경이다. 기존 동작(`X-Deleted-Count` 헤더를 응답에 포함)은 이전 PR에서 이미 구현됐으며, 이번 변경은 cross-origin 브라우저가 해당 헤더를 JavaScript에서 실제로 읽을 수 있도록 CORS 정책을 보완한 수정이다. 기존 클라이언트는 이 헤더를 무시해도 동작하므로 breaking change 없음.

### [INFO] 프론트엔드 API 클라이언트 테스트 — 계약 형태 확인
- 위치: `codebase/frontend/src/lib/api/__tests__/agent-memories.test.ts` L563~625
- 상세: 신규 테스트가 `listScopes`(`GET /agent-memories/scopes`)와 `listMemories`(`GET /agent-memories`) 엔드포인트의 요청 파라미터 직렬화 방식(쿼리 파라미터 `{ limit, offset, q?, kind? }`)과 응답 정규화 형태(`{ items: [...], totalItems: n }`)를 명시적으로 검증한다. 특히 `q` 파라미터가 미지정 시 params 객체에 키 자체가 포함되지 않는 동작(불필요한 `q=undefined` 전송 방지)을 확인한다. 계약 형태가 기존 페이지네이션 표준(`pagination.totalItems`)과 일치하여 이상 없음.

## 요약

이번 변경에 포함된 API 계약 관련 변경은 두 가지다. 첫째, `CorsOptionsLike` 인터페이스에 `exposedHeaders?` 옵션을 추가하고 실제 값을 주입한 CORS 수정 — 이전 리뷰(23_02_30)에서 WARNING(W1)으로 식별된 "X-Deleted-Count CORS 노출 누락" 버그의 정식 수정이다. 가산 변경이므로 breaking change 없고 기존 동일-오리진 클라이언트는 영향 없다. 둘째, `listScopes`/`listMemories` API 클라이언트 테스트 — 기존 API 계약을 변경하지 않고 기존 계약의 동작을 검증하는 테스트 추가다. 인증·인가(롤 기반, @WorkspaceId 격리), 페이지네이션 응답 형식(PaginatedResponseDto 표준), HTTP 상태 코드, URL 구조 등은 변경이 없다. 이전 리뷰에서 INFO로 분류된 `@ApiHeader schema.type: 'integer'` 불일치(실제 string 전송)는 이번 diff에 해당 코드가 포함되지 않으므로 재검토 대상 아님.

## 위험도
NONE
