# 보안(Security) 리뷰 — eslint 9→10 상향 + 연쇄 lint 정리

## 발견사항

이번 변경분은 (1) `.github/dependabot.yml`·`eslint.config.mjs`·각 워크스페이스 `package.json`·`pnpm-lock.yaml` 의 eslint 9→10 / eslint-plugin-unicorn 56→73 상향, (2) 그로 인해 새로 활성화된 `no-useless-assignment`·`preserve-caught-error` 룰을 만족시키기 위한 기계적 리팩터(`let x: T = []` → `let x: T`, 두 곳의 `throw new Error(msg, { cause: err })` 추가), (3) 회귀 가드 테스트(`eslint-unicorn-peer*.ts`) 보강으로 구성된다. 실제 코드 로직/보안 경계를 바꾸는 커밋이 아니다. 다음 파일들을 직접 열어(`Read`) 대조 검증했다:

- `codebase/backend/src/common/utils/ssrf-safe-url.util.ts`
- `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts`
- `codebase/backend/src/modules/secret-store/secret-resolver.service.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.ts`
- `codebase/backend/src/nodes/data/code/code.handler.ts`
- `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts`
- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/kb-tool-provider.ts`
- `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts`
- `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts`
- `codebase/backend/src/common/filters/http-exception.filter.ts`

주요 확인 사항:

1. **`let x = []` → `let x` 변화는 전부 안전** (INFO, 결함 아님) — `ssrf-safe-url.util.ts:156`, `public-webhook-throttle.guard.ts:67`, `execution-engine.service.ts:4918`, `kb-tool-provider.ts:239`, `information-extractor.handler.ts:332`, `form-mode.ts:289`, `web-chat-sdk/src/index.ts:63` 전부, `catch` 블록이 조기 `return`(또는 이후 미사용)하는 구조라 TS strict definite-assignment 분석을 통과하며 실제 미할당 참조 경로가 없다. 특히 `public-webhook-throttle.guard.ts`(공개 webhook 인증 우회 방지 로직)와 `ssrf-safe-url.util.ts`(SSRF 방어) 를 중점 대조했으나 조건 분기·fail-open/fail-closed 의미가 원본과 동일하다.
2. **`cause: err` 추가 2건은 정보노출(CWE-209) 재유입 없음** — `expression-resolver.service.ts` 의 `Expression error in config.${path}` 와 `code.handler.ts` 의 `code has a syntax error` 에 `{ cause: err }` 가 새로 붙었다. 다운스트림 소비 경로(`execution-engine.service.ts` 전수, `http-exception.filter.ts`)를 grep 했을 때 어디서도 `err.cause` 를 읽거나 직렬화하지 않고 전부 `err.message` 만 사용한다 — 즉 `cause` 를 붙여도 Activity API·HTTP 에러 응답으로 추가 노출되는 필드가 없다.
3. **`secret-resolver.service.ts` 의 `eslint-disable-next-line preserve-caught-error` 는 의도적이고 근거가 문서화됨** — 원본 crypto 에러 상세(`Unsupported state or unable to authenticate data` 등)를 `cause` 로 흘리면 `#814` 에서 이미 반증된 "서버 로그니까 안전" 전제가 되살아나므로, 이 지점만 예외 처리한 것은 타당한 판단이다. 로그는 `ref`+`workspaceId` 만 남기고 plaintext 는 기록하지 않는다(SS-SE-05 준수 확인).
4. **`eslint-unicorn-peer-guard.ts` 의 `parseGteFloor` 정규식 확장**(`>=X`/`>=X.Y`/`>=X.Y.Z` 허용) 은 catastrophic backtracking 소지가 없는 단순 digit-group 패턴이며, 테스트 전용 가드 코드(런타임 공격 표면 아님)라 ReDoS/인젝션 우려 없음.
5. **`eslint-unicorn-peer.spec.ts` 의 `readInstalledPackageJson`** 은 `node_modules/<pkgName>/package.json` 경로를 조립해 직접 읽지만 `pkgName` 인자가 테스트 내부 하드코딩 문자열(`'eslint-plugin-unicorn'`)뿐이라 경로 탐색(path traversal) 벡터가 없다. 테스트 전용 코드로 프로덕션 공격 표면과 무관.
6. **의존성 보안**: 이번에 버전이 오른 `eslint@10.9.1`, `eslint-plugin-unicorn@73.0.0`, `@eslint/js@10.0.1` 은 전부 devDependency(빌드·린트 전용, 런타임 미포함)이며 알려진 Critical CVE 는 확인되지 않는다. `frontend`/`channel-web-chat` 은 `eslint-config-next` 의 하위 플러그인(react/jsx-a11y/import)이 아직 eslint 10 을 지원하지 않아 의도적으로 `^9` 에 잔류시켰고, 이는 `pnpm install --strict-peer-dependencies` 로 실측 후 되돌린 결정이라 근거가 충분하다(운영 리스크는 없음 — dev-tool 버전 스큐일 뿐 런타임 비대칭 아님).
7. **하드코딩된 시크릿/API 키**: 이번 diff 전체(프롬프트에 포함된 pnpm-lock.yaml 대량 diff 포함)에서 시크릿·토큰·자격증명 패턴 없음. `dependabot.yml`/`eslint.config.mjs`/plan 문서의 변경은 주석·버전 pin 뿐이다.
8. **인젝션/인증/암호화 관점**: 이번 diff 범위 내에 SQL/커맨드/경로 인젝션, 인증·인가 로직 변경, 해시/암호화 알고리즘 변경은 없다. `knowledge-base.service.ts` 의 `graphRequeued -= slice.length;` 제거는 이후 `throw err` 로 함수가 즉시 종료돼 반환값에 영향이 없는 죽은 코드 제거이며 보안과 무관하다.

발견된 CRITICAL/WARNING 은 없다.

- **[INFO]** 상향된 `eslint@^10.9.1` 의 `no-useless-assignment` 룰이 앞으로 "초기화 후 catch 에서 조기 return" 패턴에 계속 의존하게 만든다.
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (`buildAgentSingleTurnSystemPrompt`/`applySingleTurnMemoryInjection` 주변, `const finalSystemPrompt` 로 전환된 지점)
  - 상세: `finalSystemPrompt` 재할당 두 곳(`memInjection.finalSystemPrompt`, `multiTurnInjection.finalSystemPrompt`)이 제거되고 `const` 로 바뀌었다. 실측 확인 결과 이후 코드는 `messages` 배열만 소비하고 `finalSystemPrompt` 지역변수는 더 이상 참조되지 않아(grep 대조) 회귀는 없다. 다만 이 지점은 "주입된 system prompt 가 실제로 LLM 호출에 반영되는가"를 좌우하는 민감한 조립 순서(§11.4 ordering)라, 향후 리팩터 시 `messages` 경로 하나로만 시스템 프롬프트가 전달된다는 불변식이 깨지지 않는지 계속 회귀 테스트로 고정해 둘 것을 권장한다.
  - 제안: 별도 조치 불요(이미 안전). 코드 리뷰 관점 참고용 기록.

## 요약

이번 PR 은 eslint 9→10 및 eslint-plugin-unicorn 56→73 devDependency 상향과 그에 따른 `no-useless-assignment`/`preserve-caught-error` 린트 규칙 대응이 전부이며, 신규 인젝션·인증 우회·시크릿 노출·암호화 약화를 유발하는 로직 변경은 발견되지 않았다. SSRF 방어(`ssrf-safe-url.util.ts`), 공개 webhook 인증 판정(`public-webhook-throttle.guard.ts`), 시크릿 복호화 에러 마스킹(`secret-resolver.service.ts`), 전역 예외 필터(CWE-209 방지)의 동작이 리팩터 전후로 동일함을 직접 대조 확인했고, 새로 추가된 `cause: err` 두 건은 어디서도 `.cause` 를 직렬화/노출하지 않아 정보노출 위험이 없다. devDependency 버전 자체도 알려진 Critical 취약점이 없는 최신 안정 버전이다.

## 위험도

NONE
