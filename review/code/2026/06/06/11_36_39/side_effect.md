# 부작용(Side Effect) 리뷰

## 발견사항

### [WARNING] LLM_STUB_MODE: 프로세스 전역 환경 변수를 요청마다 hot-read
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/modules/llm/llm.service.ts` L77 — `if (process.env.LLM_STUB_MODE === 'true')`
- 상세: `createClient`는 LLM 호출마다 호출되는 메서드인데, 매 호출 시 `process.env`를 직접 참조한다. `process.env`는 Node.js 프로세스 전역 상태이므로, 이 변수를 런타임에 변경(예: 단위 테스트 내 mid-test 조작, 또는 외부 코드가 `process.env.LLM_STUB_MODE = ...`로 수정)하면 캐시에 이미 stub이 저장된 경우에도 다음 호출에서 조건 분기 결과가 달라진다. 특히 캐시에 stub이 아닌 실 클라이언트가 있는 경우(`instanceof StubLlmClient` 체크가 false를 반환) 새 stub이 캐시를 덮어쓰고 기존 실 클라이언트 참조가 유실된다. 프로덕션에서는 `main.ts` 가드가 부팅 시 차단하므로 위험도가 낮지만, process.env 전역 변이는 의도치 않은 상태 전이를 일으킬 수 있다.
- 제안: 생성자에서 `private readonly isStubMode = process.env.LLM_STUB_MODE === 'true'`로 1회만 평가하거나 `ConfigService`에서 읽어 인스턴스 변수로 고정한다. 이후 `createClient` 내부는 `this.isStubMode`를 참조하게 하면 전역 상태 hot-read를 없앨 수 있다.

### [WARNING] stub 활성 시 clientCache에 StubLlmClient 인스턴스를 기록 — 실 캐시 오염 잠재적 위험
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/modules/llm/llm.service.ts` L83 — `this.clientCache.set(config.id, stub)`
- 상세: `LLM_STUB_MODE=true`일 때 `clientCache`(공유 인스턴스 필드 Map)에 `StubLlmClient`를 저장한다. 이후 `LLM_STUB_MODE`가 `false`로 전환되더라도 캐시에는 stub이 남아 있고, 비-stub 경로의 `cached` 체크(`L87-90`)는 이 stub을 실 클라이언트로 반환한다. 현재 코드는 stub-mode 경로에서 `instanceof StubLlmClient` 가드로 stub을 걸러내지만, 비-stub 경로는 type-check 없이 `cached`를 그대로 반환한다. 프로덕션에서는 환경 전환이 일어나지 않으므로 실 발현 가능성은 낮지만, 공유 상태(`clientCache`)를 두 분기가 공동 수정하는 설계는 future regression 위험을 내포한다.
- 제안: stub 전용 캐시(`stubCache`)를 `clientCache`와 분리하거나, `clearClientCache`를 호출해 캐시를 초기화하는 테스트 헬퍼 메서드를 노출한다.

### [INFO] main.ts — bootstrap 함수 내 환경 변수 읽기, throw로 프로세스 시작 차단
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/main.ts` L273-278
- 상세: `LLM_STUB_MODE=true && NODE_ENV=production` 조합에 `throw new Error(...)`를 추가했다. 이 throw는 `bootstrap()` async 함수 내에서 발생하며, 호출부는 `void bootstrap()`으로 반환값을 무시한다. Node.js에서 `void`로 호출된 async 함수의 reject는 기본적으로 `unhandledRejection`으로 이어진다. 기존 `OAUTH_STUB_MODE` 가드도 동일한 패턴이므로 프로젝트 내 선례와 일관성은 있으나, `process.exit(1)`을 명시적으로 호출하는 것이 fail-closed 의도를 더 명확히 표현할 수 있다. 현재도 unhandledRejection 핸들러가 없으면 Node.js는 프로세스를 종료하므로 실제 동작은 동등하다.
- 제안: 현 상태 유지(OAUTH_STUB_MODE 선례 일관). 필요하다면 `process.exit(1)` 명시적 종료로 교체.

### [INFO] StubLlmClient — 인터페이스 충족, 공개 API 시그니처 변경 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/modules/llm/clients/stub.client.ts`
- 상세: `StubLlmClient`는 `LLMClient` 인터페이스를 그대로 구현한다. `chat`, `embed`, `listModels`, `testConnection` 모두 인터페이스 시그니처와 일치한다. 신규 파일이므로 기존 호출자에 대한 시그니처 변경은 없다. `LlmService.createClient`의 반환 타입(`LLMClient`)도 변경되지 않아 기존 호출부에 영향 없음.

### [INFO] stub 사용 시에도 usageLogService.record 호출 — e2e DB에 stub usage row 기록
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/modules/llm/llm.service.ts` (chat 메서드 내 usage log 기록 경로)
- 상세: `LlmService.chat`은 `createClient`가 반환한 클라이언트(`StubLlmClient`든 실 클라이언트든)의 응답 후 `usageLogService.record`를 호출한다. stub 응답도 정상 흐름을 타므로 e2e DB에 `inputTokens: 1, outputTokens: 1, totalTokens: 2` usage row가 기록된다. 현재 e2e 테스트가 usage log를 검증하지 않으므로 실제 충돌은 없지만, 미래 usage 검증 테스트 추가 시 stub 고정값(1/1/2)과 충돌할 수 있는 숨겨진 상태 기록이다.
- 제안: stub 경로에서 usage log 기록을 건너뛰거나, 주석에 "stub usage row 기록됨, 향후 usage 검증 e2e 추가 시 확인 필요"를 명시.

### [INFO] package.json — jsonwebtoken devDependency 명시 (부작용 없음)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/package.json` — `devDependencies` 에 `jsonwebtoken: 9.0.3`, `@types/jsonwebtoken: ^9.0.0` 추가
- 상세: devDependency 명시는 빌드/런타임 번들에 영향 없고, 이미 전이 의존성으로 설치된 버전(9.0.3)과 동일하므로 잠금 파일 충돌 없음. 추가적인 부작용 없음.

### [INFO] 리뷰 산출물 파일(RESOLUTION.md, SUMMARY.md, _retry_state.json, meta.json) — 프로젝트 상태 변경 없음
- 위치: `review/code/2026/06/06/11_22_25/` 하위 신규 파일들
- 상세: 리뷰 산출물 파일은 `review/` 디렉터리에만 기록되며 실행 코드에 아무런 영향을 주지 않는다. 파일시스템 부작용으로 볼 수 있으나 의도된 결과물이며 애플리케이션 동작에 영향 없음.

---

## 요약

이번 변경의 핵심 부작용 위험은 두 가지다. 첫째, `LlmService.createClient`가 `process.env.LLM_STUB_MODE`를 요청마다 hot-read함으로써 프로세스 전역 상태를 매번 읽는다. 프로덕션에서는 `main.ts` 부팅 가드(`LLM_STUB_MODE=true && NODE_ENV=production → throw`)가 차단하므로 실제 위험은 낮지만, 공유 `clientCache` Map을 stub과 실 클라이언트 분기가 공동으로 수정하는 설계는 mid-test 환경 변수 변경 시 캐시 오염을 일으킬 수 있다. 둘째, stub 경로에서도 `usageLogService.record`가 호출되어 DB에 dummy usage row가 기록된다는 숨겨진 상태 변경이 있다. `StubLlmClient` 자체는 순수 무상태 구현체로 외부 호출·파일시스템·전역 변수 변경이 없으며, 공개 API 시그니처(`LlmService.createClient` 반환 타입)도 변경되지 않았다. `main.ts`의 프로덕션 가드 추가는 기존 `OAUTH_STUB_MODE` 패턴과 일관하며 부작용 관점에서 올바른 방향이다.

## 위험도

LOW
