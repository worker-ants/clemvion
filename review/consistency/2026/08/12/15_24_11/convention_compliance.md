# 정식 규약 준수 검토 — spec/data-flow/** (impl-done, diff-base=origin/main)

## 검토 범위 및 방법

- 코드 diff 는 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` +
  `idempotency.interceptor.spec.ts` 두 파일뿐 (Redis 런타임 장애 시 `get()` reject 를 캐시 미스로
  강등하는 fail-open 보강 + 캐너리 테스트). spec 문서 자체의 diff 는 없다 — 이번 리뷰는 "이미 있는
  `spec/data-flow/15-external-interaction.md` 가 이 변경의 근거로 인용한 문구·규약을 실제로
  충족하는가" 와 "spec/data-flow/** 전체가 `spec/conventions/**` 정식 규약을 따르는가" 를 함께
  점검했다.
- 프롬프트 번들에서 본문이 잘린 파일은 target 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-idempotency-fixes-aabdc9`)에서 절대경로로 직접 `Read` 했다:
  `spec/conventions/error-codes.md`, `swagger.md`, `migrations.md`, `interaction-type-registry.md`,
  `audit-actions.md`, `node-output.md` 전문 확인. `spec/data-flow/` 의 9개 미번들 파일(4·5·6·7·8·9·10·13·14)은
  구조 컨벤션(`## Overview` / `## Rationale` 존재 여부, 파일명 패턴)만 `grep`/`ls` 로 전수 스팟체크했다.

## 발견사항

이번 diff·target 범위에서 CRITICAL/WARNING 급 정식 규약 위반은 발견되지 않았다. 확인한 항목:

- **에러 코드 명명 (`error-codes.md`)** — target 문서가 쓰는 `TOKEN_EXPIRED`/`TOKEN_REVOKED`/
  `TOKEN_SCOPE_MISMATCH`/`TOKEN_AUDIENCE_MISMATCH`/`TOKEN_INVALID`/`STATE_MISMATCH`/
  `EXECUTION_TERMINATED`/`TOO_MANY_CONNECTIONS`/`WEBCHAT_IDLE_TIMEOUT`/
  `EXECUTION_TIME_LIMIT_EXCEEDED`/`WORKER_HEARTBEAT_TIMEOUT` 및 diff 가 신설한
  `IDEMPOTENCY_KEY_CONFLICT` 모두 `UPPER_SNAKE_CASE` + 의미 기반 명명 원칙(§1)을 만족한다.
  `error-codes.md` §3 historical-artifact 예외 레지스트리에 새로 등재해야 할 lowercase/PascalCase
  이탈은 없다.
- **Idempotency 헤더/토큰 프리픽스** — `Idempotency-Key`(`IDEMPOTENCY_HEADER = 'idempotency-key'`),
  `iext_<JWT>`/`itk_<opaque>` 는 `spec/conventions/swagger.md` §2-1(`interaction-token` Bearer scheme)
  이 명시한 값과 코드·문서가 일치한다.
- **fail-open 서술의 근거 순환 검증** — diff 의 주석·테스트가 인용하는
  `spec/data-flow/15-external-interaction.md` §4 "Redis … 전 경로 fail-open (warn) — 가용성 우선"
  문구가 실제로 그 위치에 존재하고(§4 외부 의존 표), `§EIA-RL-02` 참조도
  `spec/5-system/14-external-interaction-api.md:140` 에 실재한다 — 인용이 허상 앵커가 아니다.
- **문서 구조 3섹션 규약** — `spec/data-flow/` 16개 파일 전수(`grep -c "^## Overview"` /
  `"^## Rationale"`)가 각각 정확히 1개씩의 `## Overview`·`## Rationale` 를 보유. 파일명도
  `<N>-<kebab-case>.md` 로 일관.
- **`0-overview.md` vs `_product-overview.md` 구조 차이** — `spec/data-flow/` 는 다른 영역 폴더
  (`2-navigation`·`3-workflow-editor`·`4-nodes`·`5-system`·`7-channel-web-chat`)와 달리
  `_product-overview.md` 없이 `0-overview.md` 하나만 갖는다. 내용을 확인한 결과 이 폴더는
  "제품 기능 영역"이 아니라 cross-cutting 데이터 흐름 레퍼런스 인덱스(대상 독자: 기획자·개발자·
  SRE·리뷰어)이므로 CLAUDE.md 표의 "제품 정의·요구사항 = `_product-overview.md`" 대상이 아니다 —
  누락이 아니라 폴더 성격 차이로 판단해 위반으로 보지 않는다(INFO 수준 관찰, 아래 참고).
- **audit action 명명 (`audit-actions.md`)** — `spec/data-flow/1-audit.md` §1.1 표의 모든
  action(`integration.*`/`workspace.*`/`member.*`/`execution.re_run`/`auth_config.*`/`user.*`/
  `workflow.*`/`trigger.*`/`schedule.*`/`model_config.*`)이 `<resource>.<verb>` dot-prefix +
  언더스코어 토큰 규약을 준수하며, 이미 컨벤션 문서와 상호 링크되어 cross-audit 이 완료된 상태다.
- **Swagger/DTO 데코레이터 패턴** — target 은 코드가 아닌 data-flow 문서라 DTO/컨트롤러 데코레이터를
  직접 선언하지 않는다. 문서가 서술하는 응답 shape(`{ executionId, status, interaction: {...} }` 등
  웹훅 트리거 응답, `202 Accepted { executionId, accepted, currentStatus }`)는 `hooks`/`interaction`
  컨트롤러가 실제로 `TransformInterceptor` 래핑 대상인지까지는 이번 diff 범위 밖이라 별도 확인하지
  않았다 — 필요 시 코드-스펙 일관성 관점(consistency-checker 의 다른 렌즈)에서 재확인 권장.

## 요약

이번 diff(`IdempotencyInterceptor` Redis 런타임 fail-open 보강)와 그 근거로 인용된
`spec/data-flow/15-external-interaction.md`, 그리고 함께 번들된 `spec/data-flow/{0-overview,1-audit,
3-execution,11-workflow,12-workspace,2-auth}.md` 는 `spec/conventions/**`(error-codes·swagger·
audit-actions·migrations·interaction-type-registry 등) 이 정의한 명명·문서 구조·출력 형식 규약을
충실히 따르고 있다. 코드 주석·테스트 캐너리가 인용하는 spec 문구·§ID 참조도 실측 검증 결과 모두
유효했다(허상 인용 없음). `spec/data-flow/` 16개 파일 전수의 Overview/Rationale 3섹션 구조와 파일명
패턴도 일관됐다. 명백한 CRITICAL/WARNING 위반은 발견되지 않았다.

## 위험도

NONE
