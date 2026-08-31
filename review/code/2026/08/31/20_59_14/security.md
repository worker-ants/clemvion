# 보안(Security) 리뷰

## 검토 범위

`codebase/` 변경 7개 파일(순수 리팩터: 엔진 에러 코드 9지점을 맨 문자열 → 타입 상수 참조로 치환 + 신규 AST 앵커 가드/픽스처/스펙) + `CHANGELOG.md`, `plan/**`, 그리고 이전 리뷰 라운드(`20_27_29`, `20_43_35`)의 산출물(과거 리뷰 리포트 md/json)이 이번 diff 에 포함되어 있습니다. 후자는 애플리케이션 코드가 아니라 리뷰 세션 산출물이므로 별도 표로 간단히 확인만 했습니다.

- `codebase/backend/src/nodes/core/error-codes.ts` — `EngineErrorCode` const 신설
- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` — `LLM_*` 4지점 상수화
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `EngineErrorCode.*` 3지점 상수화
- `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts` — `SERVER_INTERRUPTED` 2지점 상수화
- `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts` (신규) — AST 기반 재발 방지 가드
- `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-fixture.ts` (신규) — 가드 형태 커버리지 픽스처
- `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor.spec.ts` (신규) — 가드 소비 spec

값 치환은 **문자열 값 자체가 바뀌지 않는 순수 리팩터**(예: `'SERVER_INTERRUPTED'` → `EngineErrorCode.SERVER_INTERRUPTED`, 런타임 값은 동일)이며, 신규 가드는 저장소 자신의 소스 트리(`ENGINE_DIR`, `CODES_SOURCE` 는 하드코딩 상수, 사용자 입력 아님)를 빌드/테스트 시점에만 읽는 dev-tooling입니다. 검증은 코드를 정적으로 읽는 것만으로 충분해 저장소를 뮤테이션하지 않았습니다(`git status --short` 로 최종 확인 — 이 리뷰가 만든 산출물 디렉터리 외 변경 없음).

## 점검 관점별 확인

1. **인젝션**: 해당 없음. `error-codes.ts`/`EngineErrorCode` 는 리터럴 상수 정의일 뿐이고, 신규 가드는 TypeScript Compiler API(`ts.createSourceFile`)로 자신의 소스 트리를 정적 파싱한다 — 사용자 입력이 경로나 쿼리로 흘러들어가는 지점이 없다. 대상 디렉터리(`ENGINE_DIR`, `CODES_SOURCE`)와 스캔 대상 경로가 모두 코드 상수로 고정돼 있어 경로 탐색 가능성도 없다.
2. **하드코딩된 시크릿**: 없음. 코드값(`SERVER_INTERRUPTED`, `WEBCHAT_IDLE_TIMEOUT` 등)은 도메인 에러 코드이지 자격증명이 아니다. 픽스처의 `FIXTURE_*` 값도 마찬가지로 시크릿이 아니다. 리뷰 산출물(`review/code/2026/08/31/20_27_29`, `20_43_35`)에서도 `password|secret|token|api[_-]?key|BEGIN … PRIVATE` 패턴을 grep 했으나 전부 `ts.SyntaxKind.EqualsToken` 문자열의 `Token` 부분 매칭뿐인 false positive였다.
3. **인증/인가**: 영향 없음. 변경은 에러 코드 값의 *표현*(리터럴 → 상수 참조)만 바꾸며 인증/인가 로직·권한 검증 경로를 건드리지 않는다.
4. **입력 검증**: 영향 없음. 이번 변경으로 새로 소비되는 외부 입력이 없다.
5. **OWASP Top 10**: 해당 없음. 새 엔드포인트·직렬화 경계·역직렬화 로직이 없다.
6. **암호화**: 영향 없음.
7. **에러 처리 — 민감 정보 노출**: 오히려 기존 안전장치가 그대로 유지됨을 확인했다. `error-codes.ts` 의 기존 주석이 `EXECUTION_INTERNAL_ERROR` 에 대해 "내부 `error.message`/stack 은 서버 로그에만 남고 클라이언트로는 절대 전송하지 않는다(leak-block security gate)"고 명시하는데, 이번 diff 는 이 경계·문구를 변경하지 않았다. `code` 값 자체(`SERVER_INTERRUPTED`, `WORKER_HEARTBEAT_TIMEOUT` 등)는 이미 클라이언트/DB 로 노출되는 것이 설계 의도이고, 리팩터 전후로 그 노출 범위는 동일하다.
8. **의존성 보안**: 신규 가드가 `typescript` 컴파일러 API 를 사용하지만, 이는 이미 devDependency 로 존재하는 패키지이고 코드 검사 로직 자체는 저장소 내부에서만 실행되는 test/guard 유틸이라 공급망 관점의 새 표면이 아니다.

### 신규 AST 가드(`engine-error-code-anchor-guard.ts`) 자체에 대한 부가 검토

- `walkTsFiles`/`readDeclaredCodes`/`collectBoundCodes` 는 모두 `repoRoot`+고정 상대경로(`ENGINE_DIR`, `CODES_SOURCE`, 스펙에서 넘기는 `codebase/backend/src/repo-guards/__tests__` 픽스처 디렉터리)만 인자로 받는다. 외부에서 임의 경로를 주입할 방법이 없고, 이 가드는 CI/로컬 테스트 실행 시점에만 자신의 리포지토리를 읽으므로 공격 표면이 되지 않는다.
- `ANCHORED_ELSEWHERE` 화이트리스트에 사유 문자열 길이(>20자) 및 코드 형식(`^[A-Z][A-Z0-9_]+$`)을 강제하는 테스트가 있어 "이유 없는 예외 등재"를 구조적으로 막는다 — 보안이라기보다 유지보수성 가드이지만, 화이트리스트가 조용히 넓어지는 것을 막는다는 점에서 이 가드의 설계 원칙과 일관된다.

## 요약

이번 변경은 엔진 레벨 에러 코드 9지점을 맨 문자열에서 타입 상수(`ErrorCode`/신규 `EngineErrorCode`) 참조로 바꾸는 순수 리팩터와, 그 회귀를 막는 AST 기반 repo-guard 테스트 추가로 구성된다. 런타임 문자열 값·API 표면·인증/인가 로직·에러 메시지 노출 정책에 변경이 없고, 신규 가드도 사용자 입력이 아닌 자신의 소스 트리만 정적으로 읽는 dev-time 유틸이라 인젝션·시크릿·인가 우회 등 어떤 점검 관점에서도 유의미한 위험을 발견하지 못했다. diff 에 섞여 들어온 과거 리뷰 세션 산출물(md/json)에도 시크릿이나 민감정보가 없음을 확인했다.

## 위험도

NONE
