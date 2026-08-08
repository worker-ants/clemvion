# API 계약(API Contract) 리뷰

## 발견사항

없음.

## 요약

`git diff origin/main...HEAD` 로 실제 변경분을 직접 대조한 결과, 이 브랜치(`backend-lint-gate`)는 ESLint `no-unnecessary-type-assertion` 정리 + Prettier 3.9 재포맷팅으로 구성된 순수 lint/style 정리 커밋들이다 (`refactor(backend): no-unnecessary-type-assertion 54건`, `fix(backend): 2단계가 만든 신규 error 8건 정리`, `style(backend): prettier 122건`). 프롬프트에 포함된 파일 목록(DTO·Guard·config·서비스 등)을 개별 대조했으나, 변경 내용은 전부 (1) `registerAs(...)`/union 타입 등의 줄바꿈 포맷 변경, (2) `as unknown as string[]`, `as never`, 중복 union 타입 캐스트 등 불필요한 타입 단언 제거뿐이었다. `interact.dto.ts` 의 `@IsIn(INTERACT_COMMANDS)` (캐스트 제거), `notification-config.dto.ts` 의 `@IsIn(NOTIFICATION_EVENT_TYPES, {each:true})`, `interaction.guard.ts` 의 union 타입 재포맷, `background-run-response.dto.ts`/`knowledge-base-response.dto.ts` 의 enum 타입 재포맷, `chat-channel.dispatcher.ts` 의 `toChatChannelEvent` 반환값 캐스트 제거 등 API 응답/요청 스키마에 인접한 파일들도 모두 런타임 값·구조는 변경 없이 컴파일타임 타입 표현만 정리됐다. 요청 검증 데코레이터(`@IsIn`, `@IsUUID`, `@MaxLength` 등)의 인자·동작, HTTP 상태 코드, 에러 응답 형식, 페이지네이션(cursor 기반 `nextCursor`/`hasMore` 등), 인증/인가(`InteractionGuard`) 로직에 실질적 수정은 없다. 따라서 API 계약 관점에서 검토할 변경사항이 없다.

## 위험도

NONE
