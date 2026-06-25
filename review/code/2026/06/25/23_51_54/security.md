# Security Review — refactor(backend): m-1 console.* → NestJS Logger

## 발견사항

### INFO: 로그 레벨 채널 보안 향상 (긍정적 변경)
- 위치: 전체 변경 파일
- 상세: `console.*` → NestJS `Logger` 전환은 로그 파이프라인 집중화·필터링·구조화를 가능하게 해 민감 정보가 stdout 에 무분별하게 흘러나가는 위험을 줄인다. NestJS Logger 는 production 에서 로그 레벨 게이팅을 적용하므로 보안 측면에서 개선이다.
- 제안: 현재 방향 유지.

### INFO: mcp-test-connection.service.ts — 에러 메시지 서버사이드 격리 패턴 유지 확인
- 위치: `codebase/backend/src/modules/mcp/mcp-test-connection.service.ts` logInternal 메서드
- 상세: `logInternal` 메서드는 `err.message` 를 `this.logger.warn` 으로 전송하고, 클라이언트 응답은 `GENERIC_CONNECT_FAILURE_MESSAGE` / `GENERIC_LIST_FAILURE_MESSAGE` 등 제너릭 문자열만 반환한다. 이 패턴은 SDK 내부 경로·IP·스택 프레임 등 정찰 정보 노출을 방지한다. 변경 전후 동일하며 보안적으로 올바르다.
- 제안: 현재 패턴 유지. 향후 `err.message` 자체에 IP 나 경로가 포함될 수 있으므로, 로그 접근 권한(log sink ACL)을 운영 레벨에서 관리하는 것을 권장한다.

### INFO: code.handler.ts — console 면제 3곳의 정보 노출 검토
- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts` resolveMemoryLimitMb 및 DAYJS_SNAPSHOT IIFE
- 상세: `console.warn` 이 면제된 3곳은 모두 module-load 시점 IIFE / pre-bootstrap 환경변수 검증 경로다. 출력 내용은 `CODE_NODE_MEMORY_LIMIT_MB` 환경변수 원본값(raw)과 숫자 경계값, dayjs 스냅샷 오류(`err`)를 포함한다. `err` 객체는 `isolated-vm` 내부 오류이므로 스택 경로 등이 포함될 수 있으나, 이 시점은 NestJS 가 기동하기 전이라 Logger 를 사용할 수 없다는 면제 근거가 타당하다. 해당 내용은 서버 로컬 stdout 에만 출력되며 클라이언트에 노출되지 않는다.
- 제안: 허용 가능. 다만 dayjs 스냅샷 실패 `err` 전체를 출력하는 경로는 내부 라이브러리 버전 정보나 경로가 포함될 수 있으므로, 운영 환경에서 stdout 로그의 접근 범위를 제한할 것을 권장한다.

### INFO: code.handler.ts — BOOTSTRAP_SOURCE 내 `console` 재정의 (격리된 VM 컨텍스트)
- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts` BOOTSTRAP_SOURCE
- 상세: 격리 VM 내부의 `console.log/warn/error` 는 `__host_log` 콜백을 통해 서버측 `logs[]` 배열에 누적되며 `MAX_CONSOLE_LINES = 100` 으로 제한된다. 이는 사용자 코드가 대량 로그로 메모리를 소진하는 DoS 를 막는 적절한 방어다. 이번 변경과 무관하게 기존에 올바르게 구현되어 있으며, `console.*` → Logger 전환과 충돌하지 않는다.
- 제안: 현재 구현 유지.

### INFO: eslint.config.mjs — `no-console: off` 테스트 면제 범위
- 위치: `codebase/backend/eslint.config.mjs` 테스트 파일 override 블록
- 상세: `**/*.spec.ts` / `**/*.e2e-spec.ts` / `test/**/*.ts` 에서 `no-console: off` 를 부여한다. 테스트 파일에서 `console.*` 로 민감 데이터(예: 시크릿, 토큰, 실제 PII)가 출력될 경우 CI 로그에 노출될 수 있다. 보안 위협 수준은 낮으나 CI 로그 접근이 광범위한 경우 주의가 필요하다.
- 제안: 테스트 내에서 시크릿이나 PII 가 `console.*` 로 출력되지 않도록 팀 규약을 유지할 것. 현재 변경 자체는 적절하다.

### INFO: language-hint-defaults.ts — deprecation warn 에 내부 경로 노출 없음 확인
- 위치: `codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.ts` resolveLanguageHint deprecation guard
- 상세: `logger.warn` 에 전달되는 JSON 은 `kind`, `message`, `migration_guide` 세 필드만 포함하며 사용자 입력값(`languageHints`)은 포함하지 않는다. 사용자 제공 문자열이 로그에 그대로 반영되지 않아 로그 인젝션(Log Injection) 위험이 없다.
- 제안: 현재 구현 양호.

---

## 요약

이번 변경은 `console.*` 를 NestJS `Logger` 로 전환하는 유지보수성 리팩터링이다. 보안 관점에서 신규 취약점은 도입되지 않았으며, 오히려 로그 집중화를 통해 민감 정보 노출 표면을 줄이는 방향으로 개선된다. mcp-test-connection 의 에러 격리 패턴, 격리 VM 내 콘솔 제한, deprecation warn 의 사용자 입력 비포함 설계 모두 보안적으로 올바르다. 면제된 3곳의 module-load 시점 `console.warn` 은 기술적 필연성이 명확하고 클라이언트 노출 경로가 없어 허용 가능하다. CI 테스트 로그에서 `no-console` 면제로 인한 민감 정보 출력 가능성은 팀 규약으로 관리해야 하는 잔여 주의사항이다.

## 위험도

NONE
