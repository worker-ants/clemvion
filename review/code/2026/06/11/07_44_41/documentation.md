# Documentation Review

## 발견사항

### [INFO] `IntegrationCacheBus.onModuleInit` 에 JSDoc 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/db-pool-creds-pubsub/codebase/backend/src/common/redis/integration-cache-bus.service.ts` — `onModuleInit()` 메서드
- 상세: `register`, `publish` 메서드에는 JSDoc 이 있으나 `onModuleInit` 은 라이프사이클 중 가장 복잡한 동작(duplicate 연결 생성, subscribe, 'message' 핸들러 등록)을 수행하면서도 문서가 없다. `onModuleDestroy` 도 동일.
- 제안: 최소 1-2줄 주석으로 "전용 subscriber 연결 생성 + 채널 구독" 의도를 명시. `onModuleDestroy` 에도 "subscriber 연결 quit" 한 줄 추가.

### [INFO] `errMessage` 헬퍼 함수 문서 없음
- 위치: `integration-cache-bus.service.ts` 하단 `function errMessage(err: unknown)`
- 상세: 모듈-내부 유틸리티이나 export 되지 않아 공개 API는 아님. 기능이 자명하여 치명적이지 않다. 다만 동일 파일 내 공개 export 들과의 문서 수준 일관성이 떨어진다.
- 제안: `/** err → 로그용 문자열 (Error.message 우선, 그 외 String()) */` 1줄 JSDoc 추가로 충분.

### [INFO] `NodeHandlerDependenciesProvider` — `integrationCacheBus` 파라미터 주석 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/db-pool-creds-pubsub/codebase/backend/src/modules/execution-engine/handlers/node-handler-dependencies.provider.ts` — 생성자 파라미터 `integrationCacheBus`
- 상세: 기존 `@Optional()` 파라미터들(예: `cafe24ApiClient`, `conversationThreadService`)은 constructor 위 JSDoc 또는 인라인 주석 없이도 타입명으로 의도가 드러난다. 그러나 왜 Optional 인지(레거시 fixture 대응)는 `HandlerDependencies` 인터페이스 주석에만 기술되고 이 파일에는 없다. `build()` 반환 객체에 `integrationCacheBus` 가 추가됐을 때의 이유도 코드만으로는 파악이 늦다.
- 제안: 현재 클래스 JSDoc(C-6 strangle step 3 설명) 끝에 `integrationCacheBus` 추가에 대한 한 줄 언급 추가. 혹은 `@Optional()` 위에 `// refactor 04 m-4 — pub/sub 캐시 무효화 bus (Optional: 레거시 fixture)` 인라인 주석.

### [INFO] `spec/4-nodes/4-integration/2-database-query.md` — §4.2 하위 목록 번호 불일치 가능성
- 위치: `spec/4-nodes/4-integration/2-database-query.md` §4 실행 로직, 2번 항목 중 "멀티 인스턴스 무효화" 항목
- 상세: spec §4 항목 번호는 0~9 로 구성돼 있다. 새로 추가된 멀티 인스턴스 무효화 내용은 기존 2번 항목의 들여쓰기 sub-bullet 로 삽입됐으며, 이는 구조상 자연스럽다. 그러나 `spec/4-nodes/4-integration/2-database-query.md`의 frontmatter `code:` 목록에 새로 추가된 `integration-cache-bus.service.ts` 외에 `integrations.service.ts` 가 누락되어 있다 — `IntegrationsService.broadcastCredentialChange` 가 이 spec 절의 핵심 호출자임에도.
- 제안: frontmatter `code:` 에 `codebase/backend/src/modules/integrations/integrations.service.ts` 추가 검토.

### [INFO] `spec/5-system/4-execution-engine.md` pub/sub 채널 표 — 채널명 정의 위치 cross-link 부재
- 위치: `spec/5-system/4-execution-engine.md` §9.2(Redis 키/채널 목록) 신규 pub/sub 채널 표
- 상세: 표에 `integration:cache:invalidate` 채널이 추가됐고 DB Query spec 링크도 있다. 다만 소스 상수 `INTEGRATION_CACHE_INVALIDATE_CHANNEL` (코드상 단일 진실)의 코드 경로 참조가 없다. spec 문서가 코드 경로를 직접 참조할 필요는 없으나, 해당 상수가 어느 서비스 파일에 선언됐는지는 신규 기여자가 파악하기 어렵다.
- 제안: 표 비고 셀에 `(IntegrationCacheBus — integration-cache-bus.service.ts)` 정도의 코드 위치 힌트 추가.

### [INFO] `spec/data-flow/5-integration.md` — 멀티 인스턴스 캐시 무효화 설명이 `rotate`/`remove` 만 언급, spec §4 문서와 범위 일치 확인 필요
- 위치: `spec/data-flow/5-integration.md` 신규 blockquote
- 상세: 데이터-플로우 문서는 "`rotate`(자격증명 회전) 와 `remove`(삭제)"를 명시한다. `integrations.service.ts` 의 `broadcastCredentialChange` JSDoc 도 같은 두 지점만 적용한다고 설명한다. 그러나 `spec/4-nodes/4-integration/2-database-query.md` §4 의 멀티 인스턴스 무효화 설명에는 `update/reauthorize/OAuth 토큰 갱신` 도 포함한 더 넓은 목록이 기술돼 있다. 이 불일치가 의도된 것(spec 가 미래 확장 기술, 현재 구현은 rotate+remove 만)인지 불명확하다.
- 제안: spec §4 의 `update/reauthorize/OAuth 토큰 갱신` 언급이 현재 구현 범위인지 미래 범위인지 명시. 현재 구현만이면 `spec/4-nodes/4-integration/2-database-query.md` §4 해당 문장에 "(현재 구현: rotate·remove — update·reauthorize·OAuth 갱신은 향후 확장 후보)" 등으로 명시 보강.

### [INFO] e2e 테스트 파일 — `waitForBroadcast` 폴링 패턴에 주석 미흡
- 위치: `codebase/backend/test/integration-cache-invalidate.e2e-spec.ts` — `waitForBroadcast` 함수
- 상세: 함수 자체는 명료하나, 50ms 폴링 간격과 5000ms 기본 타임아웃의 근거가 없다. 다른 e2e 헬퍼와의 일관성 여부도 불명확.
- 제안: 함수 위에 간단한 JSDoc: `/** Redis pub/sub 메시지 도착 대기 — 50ms 간격 폴링, 기본 5초 타임아웃 */`

## 요약

이번 변경은 refactor 04 m-4 (멀티 인스턴스 credential 캐시 무효화 Redis pub/sub)로, 문서화 수준이 전반적으로 우수하다. `IntegrationCacheBus` 클래스 JSDoc, `HandlerDependencies` 인터페이스 필드 주석, `spec/4-nodes/4-integration/2-database-query.md` §4 및 `## Rationale` 신설, `spec/0-overview.md` Redis 항목 갱신, `spec/5-system/4-execution-engine.md` pub/sub 채널 표 추가, `spec/data-flow/5-integration.md` 주석 모두 적절히 작성됐다. 지적 사항은 모두 INFO 등급으로, `onModuleInit`/`onModuleDestroy` JSDoc 부재, spec frontmatter 코드 목록 누락 가능성, spec 문서 간 broadcast 적용 범위 불일치(rotate+remove vs. update·reauthorize·OAuth 갱신) 정도다. 마지막 항목이 실제 구현 범위와 spec 기술 범위 사이의 의도적 차이인지를 명시하는 것이 가장 유익한 개선이다.

## 위험도

LOW

STATUS: SUCCESS
