# API 계약(API Contract) 리뷰 결과

## 발견사항

- **[INFO]** `WORKSPACE_REQUIRED` → `WORKSPACE_ID_REQUIRED` 에러 코드 정정 — 하위 호환성 확인 필요
  - 위치: `chat-channel.controller.ts` (삭제된 6줄), `triggers.en.mdx` line 302→302, `triggers.mdx` line 790→791
  - 상세: 컨트롤러에서 직접 던지던 `WORKSPACE_REQUIRED` 코드가 제거되고, 공용 `@WorkspaceId()` 데코레이터가 `WORKSPACE_ID_REQUIRED` 코드로 대체한다. 두 코드는 문자열이 다르므로 에러 코드를 하드코딩한 기존 클라이언트는 변경된 코드를 인식하지 못할 수 있다. 단, 문서(영·한 양 버전)가 같은 PR 에서 동기화되었고, 공용 데코레이터 `WORKSPACE_ID_REQUIRED` 가 더 표준적인 네이밍이므로 의도된 breaking fix 로 판단된다.
  - 제안: 클라이언트 측 에러 코드 처리 코드(프론트엔드, channel-web-chat 등)에서 `WORKSPACE_REQUIRED` 를 사용 중인 곳이 있는지 grep 확인 후 마이그레이션 가이드 또는 changelog 항목 추가 권장.

- **[INFO]** HTTP 상태 코드 변경: 401 → 400
  - 위치: `chat-channel.controller.ts` — `UnauthorizedException`(401) 제거 후 `@WorkspaceId()` 데코레이터가 `WORKSPACE_ID_REQUIRED` 400 반환
  - 상세: workspaceId 미전달 시 기존에는 `UnauthorizedException` (HTTP 401)을 반환했으나, 변경 후 공용 데코레이터가 400 Bad Request 를 반환한다. 401 과 400 은 의미가 다르다 — 401 은 인증 실패, 400 은 요청 형식 오류. workspaceId 헤더 누락은 인증(401)보다 요청 파라미터 누락(400)에 가까우므로 변경 방향이 의미적으로 더 정확하나, 기존에 401 을 기대하던 클라이언트 코드에는 breaking change 다.
  - 제안: 테스트 스펙 주석(파일 1)에 이미 "WORKSPACE_ID_REQUIRED 400" 명시되어 문서화는 되어 있다. 클라이언트 측 401 분기 처리가 있으면 400 분기로 업데이트 필요.

- **[INFO]** `@WorkspaceId()` 데코레이터의 우선순위 정책 — 문서와 API 계약 정합
  - 위치: `chat-channel.controller.ts` JSDoc 주석: "X-Workspace-Id 헤더 / JWT workspaceId 우선순위로 해석·검증"
  - 상세: 기존에는 `@Headers('x-workspace-id')` 로 헤더만 읽었으나, 공용 데코레이터가 JWT claim 도 지원한다. 이는 기존 클라이언트에게는 기능 확장이므로 breaking change 가 아니다.
  - 제안: 이상 없음.

## 요약

이번 변경의 핵심은 `X-Workspace-Id` 헤더 파싱 및 검증 로직을 컨트롤러 인라인 코드에서 공용 `@WorkspaceId()` 데코레이터로 이전한 것이다. API 계약 관점에서 두 가지 주목할 변화가 있다: (1) workspaceId 미전달 시 HTTP 상태 코드가 401 → 400 으로 변경되고 에러 코드가 `WORKSPACE_REQUIRED` → `WORKSPACE_ID_REQUIRED` 로 바뀐다. 두 가지 모두 breaking change 에 해당하나, 변경 방향이 의미적으로 더 올바르며 영·한 문서가 동일 PR 에서 동기화되어 있다. 나머지 API 계약 요소(URL 경로, 응답 형식, 요청 검증, 버전 관리, 페이지네이션, 인증/인가 적용)는 변경이 없거나 정상적으로 유지된다. 전체적으로 위험도는 낮으나 기존 클라이언트의 에러 코드 및 HTTP 상태 처리 분기를 점검할 것을 권장한다.

## 위험도

LOW
