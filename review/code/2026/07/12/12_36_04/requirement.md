# 요구사항(Requirement) Review

## 발견사항

- **[INFO]** Cache-Control TTL 값의 파생 계산이 spec 명시값과 정확히 일치
  - 위치: `codebase/backend/src/modules/hooks/hooks.controller.ts:40-44`
  - 상세: `EMBED_CONFIG_CACHE_SEC = 300`, `EMBED_CONFIG_CACHE_CONTROL = \`public, max-age=${EMBED_CONFIG_CACHE_SEC}\`` = `"public, max-age=300"`, `EMBED_CONFIG_CACHE_MAX_MIN = Math.ceil(300 / 60) = 5`. `spec/7-channel-web-chat/4-security.md` §3-① ("응답은 `Cache-Control: public, max-age=300`(워크스페이스 설정 변경 후 최대 5분 반영...)")과 `spec/2-navigation/9-user-profile.md:249` ("반영 지연 | 임베드 soft 검증 캐시 최대 5분(`Cache-Control: max-age=300`)")에 명시된 값·문구와 line-level 로 일치. 렌더 결과를 문자열 결합 방식으로 수동 재구성해 원본과 대조한 결과 byte-identical (`@ApiOperation.description`, `@ApiResponse` header description/example, 실제 `res.set` 값 4곳 모두).
  - 제안: 없음 (정보성 확인).

- **[INFO]** 순수 DRY 리팩터로 behavior-preserving 목표 달성, 사이드이펙트 없음
  - 위치: `codebase/backend/src/modules/hooks/hooks.controller.ts` 전체 diff
  - 상세: `res.set('Cache-Control', EMBED_CONFIG_CACHE_CONTROL)` 는 이전 `res.set('Cache-Control', \`public, max-age=${EMBED_CONFIG_CACHE_SEC}\`)` 과 동일 값을 생성 — 위젯 fail-open 로직, 응답 DTO 형태(`EmbedConfigDto`), 엔드포인트 시그니처(`getEmbedConfig(endpointPath, res)`) 는 전혀 변경되지 않음. `hooks.controller.spec.ts:56-59` 의 `expect(res.set).toHaveBeenCalledWith('Cache-Control', expect.stringContaining('max-age'))` 단언은 여전히 통과 (`npx tsc --noEmit` 로 해당 파일에 신규 타입 에러 없음도 확인).
  - 제안: 없음.

- **[INFO]** TODO/FIXME/HACK/XXX 주석 없음, 미완성 작업 흔적 없음
  - 위치: 변경 파일 전체
  - 상세: 신규·수정 라인 모두 완결된 상수 선언 + 참조 치환. 새 함수·분기·에러 경로 없음(순수 값 소스 통합) — 엣지 케이스(빈 값, null, 최대/최소)는 이 diff 범위에서 해당 없음(상수는 컴파일 타임 리터럴 300 고정, 런타임 입력 아님).
  - 제안: 없음.

- **[INFO]** 신규 plan 문서(`plan/in-progress/hooks-embed-config-cache-ttl-doc-sot.md`)의 배경 서술이 실제 diff 와 일치
  - 위치: `plan/in-progress/hooks-embed-config-cache-ttl-doc-sot.md`
  - 상세: 문서에 적힌 4개 하드코딩 사용처(L55/L71/L72 구 라인 기준)와 해결 상수명(`EMBED_CONFIG_CACHE_CONTROL`, `EMBED_CONFIG_CACHE_MAX_MIN`)이 실제 코드 diff 의 치환 대상·이름과 정확히 대응. `spec_impact: none` 프런트매터도 타당 — 이 변경은 wire 응답·필드·상태 전이를 건드리지 않는 문서 문자열 SoT 통합이라 spec 본문 개정 대상이 아님(코드가 이미 spec 값과 일치하던 상태를 리팩터링만 함, spec drift 아님).
  - 제안: 없음. 체크리스트(lint/unit test/build/e2e/ai-review 등)는 아직 미체크 상태이므로 이후 단계에서 마저 수행 필요(리뷰 대상 diff 자체의 결함은 아님).

## 요약

이번 diff 는 `codebase/backend/src/modules/hooks/hooks.controller.ts` 의 embed-config 엔드포인트에서 캐시 TTL(300초/5분)이 실제 응답 헤더와 Swagger 문서 문자열 2곳에 중복 하드코딩돼 있던 것을 `EMBED_CONFIG_CACHE_SEC` 상수에서 파생된 `EMBED_CONFIG_CACHE_CONTROL`/`EMBED_CONFIG_CACHE_MAX_MIN` 두 상수로 단일화한 순수 DRY 리팩터다. 문자열을 수동으로 재구성해 대조한 결과 렌더 결과가 원본과 byte-identical 이며, `spec/7-channel-web-chat/4-security.md` §3-① 과 `spec/2-navigation/9-user-profile.md` 에 명시된 "public, max-age=300 / 최대 5분" 값과도 정확히 일치한다. 엔드포인트 시그니처·응답 DTO·fail-open 정책·에러 경로 등 기능적 동작은 전혀 변하지 않았고, 기존 unit 테스트(`hooks.controller.spec.ts`)도 영향받지 않는다(`stringContaining('max-age')` 단언은 여전히 유효). TODO/FIXME 등 미완성 흔적 없음, `tsc --noEmit` 에서 해당 파일 관련 신규 타입 에러 없음. CRITICAL/WARNING 급 발견사항 없음 — 전부 INFO(확인 성격).

## 위험도

NONE
