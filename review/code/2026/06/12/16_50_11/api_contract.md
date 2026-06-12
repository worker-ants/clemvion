# API 계약(API Contract) 리뷰 결과

## 발견사항

### [INFO] `workspace.decorator.spec.ts` — `WORKSPACE_ID_REQUIRED` 에러 코드 단언 강화
- 위치: `codebase/backend/src/common/decorators/workspace.decorator.spec.ts` 라인 125–138
- 상세: 기존 테스트에서 `BadRequestException` 타입만 확인하던 것을 `{ code: 'WORKSPACE_ID_REQUIRED' }` 필드까지 단언하도록 보강했다. 이는 API 계약 관점에서 에러 응답의 `code` 필드가 `WORKSPACE_ID_REQUIRED` 임을 테스트 레벨에서 고정하는 긍정적인 변화다. 빈 문자열 헤더(falsy) 케이스 추가도 `X-Workspace-Id: ""` 를 유효하지 않은 식별자로 취급하는 계약을 명시해 일관성 향상.
- 제안: 현재 패턴에서 `expect(() => factory(...)).toThrow(...)` 와 `try/catch` 블록이 동일 호출에 대해 두 번 실행되는 중복 구조다. `expect.assertions(N)` + 단일 `try/catch` 로 정리하면 가독성이 개선되지만 API 계약 자체에는 영향 없음.

### [INFO] `backend-labels.ts` — `WORKSPACE_ID_REQUIRED` 에러 코드 i18n 등록
- 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` `ERROR_KO` 레코드
- 상세: 공용 `@WorkspaceId()` 데코레이터의 에러 코드 `WORKSPACE_ID_REQUIRED` 에 한국어 메시지를 등록한 순수 i18n 작업이다. API 응답의 `code` 필드가 변경되거나 새로 추가된 것은 아니며, 기존에 이미 백엔드에서 사용 중인 코드에 대한 프론트엔드 번역 매핑 추가다. 에러 응답 계약 자체에는 영향 없음.
- 제안: 해당 없음.

### [INFO] `spec/5-system/1-auth.md` — `POST /api/auth/resend-verification` 토큰 유효기간 명세 동기화
- 위치: `spec/5-system/1-auth.md` §1.1 테이블, 라인 1088
- 상세: `POST /api/auth/resend-verification` 의 설명에 "발급되는 인증 토큰은 24h 유효 (§5 동일)" 문구를 추가해 §5 엔드포인트 목록의 "(24h 유효)" 기술과 동기화했다. API 엔드포인트 스펙의 기존 계약(`24h`) 을 다른 섹션에도 일관되게 명시한 것으로, 계약 변경이 아닌 문서 정합 강화다.
- 제안: 해당 없음.

### [INFO] `spec/5-system/11-mcp-client.md` — `makeshop` Internal Bridge 행 추가
- 위치: `spec/5-system/11-mcp-client.md` §3.1 표, 라인 1740
- 상세: Internal Bridge 표에 `makeshop` / `MakeshopMcpToolProvider` 행을 추가한 spec 문서 동기화다. §2.3 본문이 이미 `makeshop` 을 언급하고 있어 표와 본문 사이의 불일치를 해소하는 작업이다. API 계약 자체 변경 없음.
- 제안: 해당 없음.

### [INFO] `plan/in-progress/spec-sync-chat-channel-gaps.md` — §5.4 rotate-bot-token 응답 계약 변경 시 동시 갱신 의무 명시
- 위치: `plan/in-progress/spec-sync-chat-channel-gaps.md` 비고 섹션
- 상세: 미구현 항목인 §5.4 `rotate-bot-token` 의 성공 응답에 `triggerId`/`chatChannelHealth`/`botIdentity` 3필드를 추가할 때 `15-chat-channel.md` 와 `chat-channel-adapter.md` 를 함께 갱신해야 한다는 의무를 비고에 명시했다. 이는 향후 응답 계약 변경 시 두 spec 의 정합성을 강제하는 관리 지침으로, 현재 API 계약에는 영향 없다. 실제로 §5.4 rotate-bot-token 응답이 현재 `{ rotatedAt }` 만 반환하는 상태에서 3필드를 추가하는 것은 **additive change** 이지만, 기존 클라이언트가 응답을 strict parse 하는 경우 고려 필요.
- 제안: §5.4 rotate-bot-token 구현 시 응답 필드 추가는 기존 `{ rotatedAt }` 계약에 additive 이므로 클라이언트가 unknown 필드를 허용하는지 확인 후 진행 권장.

## 요약

이번 변경은 API 계약 관점에서 실질적인 breaking change 나 신규 엔드포인트 추가가 없다. `WORKSPACE_ID_REQUIRED` 에러 코드는 기존에 백엔드에서 이미 사용 중이던 코드이며, 이번 변경에서는 테스트 단언 강화(decorator spec)와 프론트엔드 i18n 등록(backend-labels)이 이루어졌다. spec 문서 두 건(1-auth.md, 11-mcp-client.md)은 기존 구현과 spec 사이의 문서 불일치를 해소한 동기화 작업이고, plan 문서의 비고 추가는 향후 rotate-bot-token 응답 확장 시의 관리 지침이다. 전반적으로 API 계약 일관성을 높이는 방향의 변경이며, 기존 클라이언트에 영향을 주는 계약 변경은 없다.

## 위험도

NONE
