# 부작용(Side Effect) 리뷰

## 스코프 확인

본 리뷰 대상 40개 파일은 프롬프트상 `변경 유형: Review`(전체 파일 컨텍스트만 제공, unified diff 미첨부)로 표시되어 있었다. 실제 변경분을 정확히 판정하기 위해 `git diff origin/main...HEAD -- <40개 파일>` 로 실제 diff 를 직접 추출해 검토했다 (커밋 로그 확인 결과 이 브랜치는 `backend-lint-gate` 활성화 작업 — prettier 3.9 재포맷 + `@typescript-eslint/no-unnecessary-type-assertion` 자동수정 + 자동수정이 만든 회귀 8건 되돌림 시리즈).

## 발견사항

검토 결과, 40개 파일에 걸친 diff(약 1,116 라인)는 예외 없이 다음 세 범주 중 하나에 속한다:

1. **prettier 재포맷** — multi-line union type(`| 'a'\n| 'b'`)을 single-line(`'a' | 'b'`)으로 압축. 값·로직 변경 없음.
2. **불필요한 타입 단언(`as X`) 제거** — TypeScript 의 `as` 단언은 컴파일 타임에만 존재하고 JS 로 emit 되지 않는다. 단언 제거는 런타임 값·분기·부작용에 어떤 영향도 주지 않는다 (예: `mcp.config.ts`/`oauth.config.ts` 의 `registerAs` 포맷팅, `slack-client.ts` 의 `params as unknown as Record<string, unknown>` → `params`, `execution-engine.service.ts` 전역의 `Record<string, unknown> | undefined` 캐스팅 라인 재포맷 등).
3. **의도적으로 필요한 단언 3건 보존 + `eslint-disable-next-line` 주석 추가** (자동수정이 만든 회귀를 되돌린 부분):
   - `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-client.ts` — `describeFetchError` 의 `String(cause as string | number | ...)` (함수 `describeFetchError`, `no-base-to-string` 회피 목적 — 실제로 필요함을 주석에 명시).
   - `codebase/backend/src/modules/execution-engine/context/execution-context.service.ts` — `setEngineResolvedConfig` 의 `MutableExecutionContext` 캐스팅 (Readonly 해제용 — 제거 시 `TS2542` 컴파일 에러 발생함을 주석에 명시).
   - `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` — `errorObj` 추출 캐스팅 (제거 시 `TS2339` 3건 발생함을 주석에 명시).
   이 3건은 코드(런타임 로직) 변경 없이 **주석만 추가**된 것이며, 기존 동작을 그대로 보존한다.

이 외에 `auth-configs.service.ts` 의 `client.addr.isInSubnet(range.addr as never)` → `client.addr.isInSubnet(range.addr)` (IP whitelist 매칭, 보안에 민감한 경로)도 동일하게 순수 타입 단언 제거이며 런타임에 전달되는 `range.addr` 참조값은 동일하다 — 매칭 결과에 영향 없음.

`InteractDto`/`NotificationConfigDto` 의 `@IsIn(X as unknown as string[])` → `@IsIn(X)` 도 데코레이터에 전달되는 배열 참조가 동일해 `class-validator` 런타임 검증(`array.includes(value)`) 결과에 차이가 없다.

### 점검 관점별 결론

1. **의도치 않은 상태 변경**: 없음 — 모든 변경이 타입 레벨이며 실행 경로·조건 분기가 그대로 보존된다.
2. **전역 변수**: 신규 전역 변수 도입·수정 없음.
3. **파일시스템 부작용**: 없음 — 이 40개 파일 diff 에는 파일 I/O 관련 코드 변경이 없다.
4. **시그니처 변경**: 없음 — 모든 함수/메서드의 파라미터·반환 타입이 관측 가능한 수준에서 동일(단언 제거는 선언부가 아닌 사용부에서만 발생).
5. **인터페이스 변경**: 없음 — export 되는 타입/클래스의 공개 shape 변경 없음(union 타입 재포맷은 값 집합 동일).
6. **환경 변수**: `mcp.config.ts`/`oauth.config.ts` 는 기존과 동일한 `process.env.*` 키를 동일한 방식으로 읽는다 — 신규 읽기·쓰기 없음.
7. **네트워크 호출**: 없음 — `slack-client.ts`/`telegram-client.ts` 의 `fetch` 호출부는 변경되지 않았다(호출 인자 타입 캐스팅만 정리).
8. **이벤트/콜백**: 없음 — `chat-channel.dispatcher.ts` 의 이벤트 페이로드 구성 로직(값)은 동일, 반환 객체의 타입 단언만 정리됨.

## 요약

40개 파일 전체가 `backend-lint-gate` 활성화를 위한 기계적 lint/format 수정(prettier 재포맷 + 불필요한 TS 타입 단언 제거, 및 자동수정이 깨뜨린 3건에 대한 `eslint-disable` 주석 복원)이며, 실제 diff 를 라인 단위로 전수 대조한 결과 런타임 로직·상태·I/O·네트워크·인터페이스에 영향을 주는 변경은 발견되지 않았다. TypeScript `as` 단언은 컴파일 타임에만 존재하므로 그 추가/제거 자체가 부작용을 유발할 수 없다는 점이 이 결론의 근거다. IP whitelist 매칭(`auth-configs.service.ts`)처럼 보안에 민감한 경로도 함수에 전달되는 실제 참조값이 동일함을 확인했다.

## 위험도

NONE
