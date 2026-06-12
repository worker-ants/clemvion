# Code Review 통합 보고서

## 전체 위험도

**LOW** — 보안 강화(ReDoS 방어, Swagger 게이팅, WebSocket IDOR 차단, HTML sanitize 화이트리스트)를 목적으로 한 refactor-04-security 변경 세트. Critical 발견사항 없음. WARNING 4건은 CI flakiness 가능성, 코드 중복, forwardRef 누적, DOMPurify 부작용 등 중기 개선 대상이며 즉각 차단 이슈는 아님. SPEC-DRIFT 3건은 구현이 올바르고 spec 반영이 후행으로 남은 상태. security reviewer output_file 미생성 — 재시도 필요 1건.

---

## Critical 발견사항

_없음_

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 | `WebsocketModule` forwardRef 4개 누적 — Gateway 책임 과중, OCP 위반 조짐 | `websocket.module.ts`, `websocket.gateway.ts` | 중기적으로 `ChannelAuthorizationService` 분리; 현재는 허용 가능 |
| 2 | 유지보수성 | `isSwaggerEnabled(process.env)` 부팅 시 이중 호출 — 향후 로직 변경 시 한쪽 누락 위험 | `main.ts` L1216, L1250 | `const swaggerEnabled = isSwaggerEnabled(process.env)` 로 한 번만 평가해 두 곳 참조 |
| 3 | 테스트 | 타이밍 기반 어서션(`elapsed < 100ms`, `< 1000ms`) — CI 환경 부하에 따라 flaky 위험 | `condition-evaluator.util.spec.ts`, `transform.handler.spec.ts`, `filter.handler.spec.ts` | 타이밍 어서션 제거 또는 임계값 5000ms 이상으로 완화; 핵심 불변식은 `r.regex === null`로 이미 검증됨 |
| 4 | 부작용 | `safe-html.ts` DOMPurify 화이트리스트 전환으로 기존 HTML5 시맨틱 태그(`<details>`, `<summary>`, `<abbr>` 등) 및 `tel:` scheme 링크가 렌더에서 제거됨 | `channel-web-chat/src/lib/safe-html.ts` | 의도된 보안 강화이나, 실 채팅 메시지에 해당 태그/scheme 사용 여부 확인 권장; `tel:` 필요 시 `ALLOWED_URI_REGEXP`에 추가 |

---

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] M-1 — `isSwaggerEnabled`/`ENABLE_SWAGGER_IN_PROD` 구현이 `spec/conventions/swagger.md` 및 `spec/5-system/2-api-convention.md`에 미반영 | `production-guards.ts`, `main.ts` | 코드 유지 + spec에 "Swagger UI non-production 전용 + opt-in" 규약 추가 (project-planner 위임) |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] M-3 — spec 4곳의 "길이 200 = ReDoS 방지" 서술이 `safe-regex` 도입 후 부정확하게 잔존 | `spec/4-nodes/5-data/1-transform.md` 외 3개 파일 | 코드 유지 + "길이 200자 초과 또는 safe-regex 검출 패턴은 컴파일 거부"로 정정 (project-planner 위임) |
| 3 | SPEC-DRIFT | [SPEC-DRIFT] M-6 — `workflow:`/`notifications:` authorizer 구현이 `spec/5-system/6-websocket-protocol.md §3.3` 채널 목록에 미반영 | `spec/5-system/6-websocket-protocol.md §3.3` | 코드 유지 + §3.3 검증 채널 목록에 2채널 추가 + notifications user 단위 명시 (project-planner 위임) |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항 | `notifications:` 채널 `workspaceId` 공가드 — 향후 workspaceId 없이 발급된 JWT 도입 시 정상 구독 차단 가능성 | `websocket.gateway.ts` handleSubscribe L284 | 현재 구현 유지; 향후 multi-workspace JWT 도입 시 채널 prefix별 조건화 검토 |
| 2 | 문서화 | `ENABLE_SWAGGER_IN_PROD` 신규 env가 `.env.example`에 누락 가능성 | `codebase/backend/.env.example` | `# ENABLE_SWAGGER_IN_PROD=true  # production에서 Swagger UI 강제 노출 (opt-in)` 주석 행 추가 |
| 3 | 문서화 | `MAX_REGEX_LENGTH` JSDoc이 `compileRegexCache`만 언급, `compileUserRegex` 단일 chokepoint 현실 불일치 | `condition-evaluator.util.ts` MAX_REGEX_LENGTH 상수 | JSDoc을 compileUserRegex, FilterHandler, TransformHandler 모두 언급하도록 갱신 |
| 4 | 문서화 | `channelAuthorizers` `authorize` ctx 파라미터 설명 없음 | `websocket.gateway.ts` authorize 타입 선언 | `ctx.workspaceId`/`ctx.userId` 의미 주석 1줄 추가 |
| 5 | 문서화 | `safe-html.ts` `ALLOWED_URI_REGEXP` 세 번째 대안 설명 부족 | `channel-web-chat/src/lib/safe-html.ts` ALLOWED_URI_REGEXP | relative URL/anchor 허용 의도 인라인 주석 추가 |
| 6 | 테스트 | `production-guards.spec.ts` `isSwaggerEnabled` describe 블록 중복 가능성 | `production-guards.spec.ts` | 전체 파일에서 동일 describe 블록이 1개만 남아 있는지 확인 |
| 7 | 테스트 | `notifications:` 채널 `userId` 미설정 소켓 케이스 테스트 없음 | `websocket.gateway.spec.ts` | userId 미설정 소켓 구독 시도 → `success: false` 케이스 추가 |
| 8 | 테스트 | `workflow:` 채널 DB 오류 fail-safe vs 소유권 불일치 의도 혼재 | `websocket.gateway.spec.ts` | 테스트 이름을 의도 명시 형태로 변경 또는 DB 오류 케이스 분리 |
| 9 | 테스트 | `compileUserRegex('')` 빈 문자열 패턴 동작 미검증 | `condition-evaluator.util.spec.ts` | `it('accepts empty pattern (matches everything)')` 케이스 추가 |
| 10 | 유지보수성 | `websocket.gateway.spec.ts` 타입 캐스팅 반복 `(socket as Socket & {...})` | `websocket.gateway.spec.ts` L1301, L1315 등 | `type EnrichedSocket` 파일 상단 선언으로 중복 제거 |
| 11 | 유지보수성 | `notifications:` authorizer `Promise.resolve` 래핑 의도 불명확 | `websocket.gateway.ts` L1471-1478 | 인터페이스 정의 근처 "동기 결과도 Promise.resolve로 감싸야 함" 주석 추가 |
| 12 | 요구사항 | `compileUserRegex` JSDoc에 safe-regex false positive 시 소비 계약 설명 누락 | `condition-evaluator.util.ts` compileUserRegex JSDoc | false positive 시 `{ regex: null, reason: 'unsafe' }` 반환, 사용처는 `meta.invalidRegexPatterns`로 가시화 설명 추가 |
| 13 | 아키텍처 | `ctx` 타입 인라인 대신 named interface(`WsAuthContext`)로 export 고려 | `websocket.gateway.ts` authorize 시그니처 | WsAuthContext interface export |
| 14 | 문서화 | plan `⏳` spec 갱신 항목들 별도 planner task 미이관 시 누락 위험 | `plan/in-progress/refactor/04-security.md` | M-1·M-3·M-6·m-1 spec 갱신 항목을 planner에게 명시적 위임 |
| 15 | 성능 | `compileUserRegex` 내 `safe-regex` 분석 동일 패턴 반복 실행 가능 | `condition-evaluator.util.ts` compileRegexCache | 현재 호출 빈도 수준에서 실질 영향 낮음; 필요 시 모듈 레벨 Map으로 메모이제이션 |
| 16 | 성능 | WebSocket `workflow:` authorizer subscribe마다 DB 조회 | `websocket.gateway.ts` workflow: authorizer | 기존 패턴과 동일; 비-UUID 사전 차단으로 불필요한 DB 진입 방어됨 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | 재시도 필요 | output_file 미생성 — 재실행 필요 |
| performance | NONE | 성능 구조적 결함 없음; INFO 5건(캐시 최적화 여지 등) |
| architecture | LOW | forwardRef 4개 누적(WARNING 1건); chokepoint 패턴·SRP 개선 양호 |
| requirement | LOW | SPEC-DRIFT 3건(M-1·M-3·M-6 spec 미반영); WARNING 1건(notifications workspaceId 가드) |
| scope | NONE | 모든 변경이 refactor-04 의도 범위 내 |
| side_effect | LOW | WARNING 2건(authorize 시그니처 영향 범위 확인됨, DOMPurify 태그 제거); 나머지 INFO |
| maintainability | LOW | WARNING 2건(isSwaggerEnabled 이중 호출, 타이밍 기반 테스트); 전반 구조 양호 |
| testing | LOW | INFO만 — describe 블록 중복 가능성, 타이밍 어서션 flakiness, 엣지 케이스 미검증 |
| documentation | LOW | INFO만 — env.example 누락 가능성, JSDoc 불일치, spec 갱신 tracking |
| dependency | NONE | safe-regex 추가 정당; MIT 라이선스, 취약점 없음, 크기 미미 |
| api_contract | NONE | 외부 REST API 계약 변경 없음; WS subscribe 응답 구조 유지 |

---

## 발견 없는 에이전트

- **scope**: 범위 이탈 없음 (INFO만)
- **dependency**: 우려사항 없음 (INFO만)
- **api_contract**: breaking change 없음 (INFO만)
- **performance**: 성능 위험 없음 (INFO만)

---

## 권장 조치사항

1. **[WARNING #3 — CI 안정성 즉시]** 타이밍 기반 어서션(`elapsed < 100ms` 등) 제거 또는 임계값 5000ms 이상 완화 — `condition-evaluator.util.spec.ts`, `transform.handler.spec.ts`, `filter.handler.spec.ts`.
2. **[WARNING #4 — 부작용 검증]** 실 채팅 메시지에서 DOMPurify 화이트리스트 제외 태그 및 `tel:` scheme 사용 여부 확인; 필요 시 `ALLOWED_TAGS`/`ALLOWED_URI_REGEXP` 보완.
3. **[WARNING #2 — 코드 중복]** `main.ts` `isSwaggerEnabled(process.env)` 두 번 호출을 `const swaggerEnabled` 변수로 통합.
4. **[WARNING #1 — 아키텍처]** 중기 리팩터링 plan에 `ChannelAuthorizationService` 분리 태스크 등록.
5. **[SPEC-DRIFT 3건]** M-1·M-3·M-6 spec 갱신 항목을 project-planner에 명시 위임; `plan/in-progress/refactor/04-security.md` `⏳` 항목을 별도 planner task로 이관.
6. **[INFO — 문서화]** `codebase/backend/.env.example`에 `ENABLE_SWAGGER_IN_PROD` 주석 플레이스홀더 추가.
7. **[INFO — 테스트]** `production-guards.spec.ts` describe 블록 중복 여부 확인 및 제거.
8. **[INFO — 테스트]** `notifications:` 채널 `userId` 미설정 소켓 테스트 케이스 추가.
9. **[security reviewer 재시도 필요]** `security.md` output_file 미생성 — security 전문 리뷰 재실행 권장.

---

## 라우터 결정

- **routing_status**: done (라우터가 선별)
- **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, api_contract (11명)
- **강제 포함(router_safety)**: dependency, documentation, maintainability, requirement, scope, security, side_effect, testing (8명)
- **제외**: database, concurrency, user_guide_sync (3명)

| 제외된 reviewer | 이유 |
|-----------------|------|
| database | 라우터 제외 (DB 스키마/쿼리 변경 없음으로 판단) |
| concurrency | 라우터 제외 (동시성 관련 변경 없음으로 판단) |
| user_guide_sync | 라우터 제외 (사용자 가이드 동기화 불필요로 판단) |