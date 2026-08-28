# 보안(Security) 리뷰 — eslint 9→10 상향 + 연쇄 lint 정리 (12_28_11)

## 검토 범위

`.github/dependabot.yml`, `PROJECT.md`, 각 워크스페이스 `eslint.config.mjs`/`package.json`,
`pnpm-lock.yaml`, backend `no-useless-assignment`/`preserve-caught-error` 대응 12개 파일,
`eslint-unicorn-peer-guard.ts`(파서 확장) + 관련 스펙/테스트, 그리고 직전 라운드
(`review/code/2026/08/28/11_45_02/`)의 RESOLUTION 적용분(시크릿 복호화 실패 테스트 신설,
force-split 회귀 테스트 신설, `dependabot.yml` 주석 축약, `eslint-disable` 인라인 사유 추가)과
그 리뷰/consistency-check 산출물. 아래 보안 민감 파일은 diff 만이 아니라 `Read`로 전체 맥락을
직접 열어 대조했다: `ssrf-safe-url.util.ts`, `public-webhook-throttle.guard.ts`,
`secret-resolver.service.ts`, `ai-turn-executor.ts`(시스템 프롬프트 조립 순서),
`web-chat-sdk/src/index.ts`, `http-exception.filter.ts`, `telegram-client.ts`.

## 발견사항

- **[INFO]** `let x: T = <default>;` → `let x: T;` 형태의 dead-initializer 제거 8개 지점 전수
  확인 — 전부 안전, 동작 변화 없음
  - 위치: `codebase/backend/src/common/utils/ssrf-safe-url.util.ts:156`,
    `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts:67`,
    `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4918`,
    `codebase/backend/src/modules/chat-channel/shared/form-mode.ts:289`,
    `codebase/backend/src/nodes/ai/ai-agent/tool-providers/kb-tool-provider.ts:239`,
    `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts:332`,
    `codebase/packages/web-chat-sdk/src/index.ts:63`
  - 상세: 보안 경계에 직접 관여하는 두 곳을 특히 중점 대조했다. (1) `ssrf-safe-url.util.ts`
    의 `checkResolvedHostIp` — `addrs`는 `try` 블록 안에서 무조건 할당되고, DNS resolve 가
    실패하는 모든 경로는 `catch`에서 `return { ok: true }`로 조기 종료해 `addrs`를 읽는 지점에
    도달하지 않는다(fail-open 의미 불변). (2) `public-webhook-throttle.guard.ts` 의
    `canActivate` — `trigger`는 `try` 안에서 무조건 할당되고, DB 조회 실패 시 `catch`에서
    `return true`로 조기 종료해 공개 webhook 인증 판정(비-null `authConfigId` 체크) 로직에
    도달하기 전에 함수가 끝난다. 즉 `#1049`류 사고(과거 `select` partial projection 버그)와
    무관하게 이번 변경은 순수 구문 정리다. 나머지 6곳도 동일 패턴(catch 조기 return/throw)임을
    직접 추적했다.
  - 제안: 조치 불요.

- **[INFO]** `secret-resolver.service.ts` 의 `preserve-caught-error` 억제는 CWE-209(정보노출)
  방지 불변식을 그대로 유지하며, 이번에 회귀 테스트까지 신설됨
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts`
    (`resolve()` catch 블록, `eslint-disable-next-line preserve-caught-error -- cause 보존 시
    crypto 에러 상세가 Activity API 로 노출됨 (SS-SE-05, #814 근거)` + `throw new Error('Secret
    decryption failed')` — `cause` 미부착), 대응 테스트
    `secret-resolver.service.spec.ts`("복호화 실패(authTag 위조) 시 메시지만 노출되고 cause 는
    보존되지 않는다")
  - 상세: 직접 파일을 열어 확인 — 원본 crypto 에러 상세(예:
    "Unsupported state or unable to authenticate data")를 `logger.error`로만 남기고 클라이언트에
    던지는 `Error`에는 `cause`를 붙이지 않는다. 새 테스트는 메시지 문자열 단독이 아니라
    `err.cause === undefined`를 **함께** 단언해 vacuous 하지 않다(disable 주석이 실수로 지워지고
    `{ cause: err }`가 붙는 회귀를 실제로 잡는다). eslint 10 룰 도입으로 발생할 수 있었던 "이 룰이
    강제하는 대로 기계적으로 `cause`를 붙였다가 보안 결정을 어긴다"는 클래스의 위험이 이 지점에서
    정확히 회피됐다.
  - 제안: 조치 불요.

- **[INFO]** `preserve-caught-error`가 새로 붙인 `cause: err` 2건은 하류에서 소비되지 않아
  CWE-209 재유입이 없음
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.ts`
    (`throw new Error(\`Expression error in config.${path}: ${message}\`, { cause: err })`),
    `codebase/backend/src/nodes/data/code/code.handler.ts`
    (`throw new Error(\`code has a syntax error: ${message}\`, { cause: err })`)
  - 상세: `grep -rn "\.cause\b" codebase/backend/src`(spec 제외)로 전수 확인한 결과 `.cause`를
    읽는 곳은 `telegram-client.ts` 단 한 곳뿐이며 위 두 파일과 무관하다.
    `common/filters/http-exception.filter.ts`도 `err.message`/`err.status` 등 개별 필드만
    추출하고 예외 객체 전체를 직렬화하지 않는다. `Error.prototype.cause`는 ECMA-262
    `InstallErrorCause`에 의해 **non-enumerable**로 정의되므로 `JSON.stringify(err)` 류의
    직렬화로도 새지 않는다(`ai-turn-orchestrator.service.ts:1339`의 `JSON.stringify(err)`도 같은
    이유로 이미 `message`조차 노출하지 않는 기존 동작). 두 파일 모두 메시지 문자열 자체에 이미
    `${message}`(원본 에러 메시지)를 포함하고 있어, `cause` 첨부가 메시지 대비 추가 정보를 넓히지도
    않는다.
  - 제안: 조치 불요(직전 라운드 rationale_continuity 검토가 제안한 "왜 여긴 붙여도 되는지" 1줄
    코멘트 추가는 문서화 개선이며 보안 결함은 아니다).

- **[INFO]** `ai-turn-executor.ts` 의 `finalSystemPrompt` 재할당 제거 2곳은 시스템 프롬프트 조립
  순서(§11.4)에 영향 없음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (single-turn: 옛
    `finalSystemPrompt = memInjection.finalSystemPrompt;` 제거, `const finalSystemPrompt`로 전환
    / multi-turn: 옛 `finalSystemPrompt = multiTurnInjection.finalSystemPrompt;` 제거)
  - 상세: 프롬프트 인젝션 방어와 직결되는 "시스템 프롬프트가 실제 LLM 호출에 어떻게 전달되는가"를
    직접 추적했다. 두 지점 모두 `grep`으로 로컬 스코프 내 이후 참조를 확인한 결과, 제거된
    재할당 이후에는 오직 `messages`(이미 인젝션된 system 메시지를 포함한 배열)만 소비되고
    지역 `finalSystemPrompt`는 다시 읽히지 않는다 — single-turn 함수 스코프, multi-turn 함수
    스코프 각각 확인. 라인 2432 부근의 `finalSystemPrompt:` 는 별도 함수(`processMultiTurnMessage`
    계열)의 독립된 인자/필드로 이번 제거 대상과 무관하다. 즉 실제 LLM 호출에 전달되는 시스템
    프롬프트 내용·순서는 변경 전후 동일하다.
  - 제안: 조치 불요.

- **[INFO]** devDependency 전용 메이저 상향(`eslint@^10.9.1`, `@eslint/js@^10.0.1`,
  `eslint-plugin-unicorn@^73.0.0`) — 런타임 공격 표면과 무관
  - 위치: `codebase/backend/package.json`, `codebase/packages/*/package.json`(8곳),
    `.github/dependabot.yml`, `codebase/backend/eslint.config.mjs`
  - 상세: 전부 `devDependencies`(빌드/린트 전용)이고 프로덕션 번들에 포함되지 않는다. 알려진
    Critical CVE 없음. `frontend`/`channel-web-chat` 2개 워크스페이스는 `eslint-config-next`의
    하위 플러그인(react/jsx-a11y/import)이 아직 eslint 10 을 지원하지 않아 `^9`에 의도적으로
    잔류했고, 이는 `--strict-peer-dependencies` 실측 기반 결정이며 회귀 가드
    (`eslint-unicorn-peer.spec.ts`) + CI 게이트로 방어된다. 새로 유입된 대량의 transitive
    devDependency(`espree@11`, `super-regex` 등)도 MIT/BSD 계열 소형 유틸리티다.
  - 제안: 조치 불요.

- **[INFO]** `eslint-unicorn-peer-guard.ts` 의 `parseGteFloor` 정규식 확장은 ReDoS 소지 없음,
  테스트 전용 코드로 프로덕션 공격 표면 아님
  - 위치: `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer-guard.ts`
    (`/^\s*>=\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?\s*$/`)
  - 상세: 중첩 정량자·backtracking 유발 구조 없는 단순 digit-group 패턴이며, 입력은 설치된
    `eslint-plugin-unicorn`의 `peerDependencies.eslint` 문자열(신뢰 가능한 로컬 `node_modules`
    산출물)뿐이라 사용자 입력 경로가 아니다. fail-closed(파싱 실패 시 null → 호출부 단언 실패)
    설계도 그대로 유지.
  - 제안: 조치 불요.

- **[INFO]** `knowledge-base.service.ts` 의 `graphRequeued -= slice.length;` 제거는 죽은 코드
  정리이며 보안과 무관
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:601` 부근
  - 상세: 해당 대입 직후 무조건 `throw err`로 함수가 종료돼 반환값에 영향을 주지 않던 dead
    store였다. 인가·데이터 노출과 무관한 카운터 보정 로직.
  - 제안: 조치 불요.

CRITICAL/WARNING 발견 없음. 하드코딩된 시크릿·API 키·인증서, SQL/커맨드/경로 인젝션, 인증·인가
로직 변경, 안전하지 않은 해시/암호화 알고리즘, 평문 전송 도입은 이번 diff(review/ 산출물 포함)
전체에서 발견되지 않았다.

## 요약

이번 변경분은 ESLint 9→10 및 `eslint-plugin-unicorn` 56→73 devDependency 메이저 상향과 그로 인해
새로 활성화된 `no-useless-assignment`/`preserve-caught-error` recommended 룰을 만족시키기 위한
기계적 코드 정리, 그리고 직전 리뷰 라운드(11_45_02)의 Critical/Warning 조치(시크릿 복호화 실패
회귀 테스트 신설, force-split 청킹 회귀 테스트 신설, `dependabot.yml` 고아 주석 축약,
`eslint-disable` 인라인 사유 보강)로 구성된다. SSRF 방어(`ssrf-safe-url.util.ts`), 공개 webhook
인증 판정(`public-webhook-throttle.guard.ts`), 시크릿 복호화 에러 마스킹
(`secret-resolver.service.ts`), 시스템 프롬프트 조립 순서(`ai-turn-executor.ts`), 전역 예외 필터의
CWE-209 방지 로직을 모두 직접 파일을 열어 변경 전후 동작이 동일함을 확인했다. 새로 추가된
`cause: err` 2건은 어디서도 직렬화·노출되지 않으며(`Error.cause`는 non-enumerable), 유일하게 이
계약을 의도적으로 어기지 않는 `secret-resolver.service.ts` 는 그 결정을 코드 주석과 신규 테스트로
정확히 잠갔다. devDependency 버전 자체도 런타임 공격 표면과 무관하고 알려진 Critical 취약점이
없다. 새로운 인젝션·인증 우회·시크릿 노출·암호화 약화 위험은 발견되지 않았다.

## 위험도

NONE
