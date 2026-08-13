# 정식 규약 준수 검토 — `spec/data-flow/` (impl-done, diff-base=origin/main)

## 검토 범위 요약

- 이번 diff 는 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` 와
  그 `.spec.ts` **두 파일에 한정**된다(다른 `diff --git` 청크 없음, 확인:
  `grep -n "^diff --git" _prompts/convention_compliance.md` → 2건 모두 이 모듈).
  `spec/data-flow/**` `.md` 파일은 이번 PR 에서 **한 건도 변경되지 않았다** — target 문서 자체는
  diff 이전과 동일한 워킹트리 상태다.
- 코드 변경 내용은 순수 내부 방어 로직 강화다: `readKey`/`hashBody` 경계값 테스트 보강, 캐시
  엔트리 `statusCode` 필드에 대한 `isHttpStatusCode`(100~599 정수) 검증 추가, `rawKey === null`
  로의 truthiness 판정 정정. **새 API 엔드포인트·DTO·wire 포맷·에러 코드는 도입되지 않았다** —
  손상된 캐시 엔트리를 "무시하고 신규 처리"로 강등하는 내부 판정만 촘촘해졌을 뿐, 클라이언트가
  관측하는 202/409/410 계약이나 `Idempotency-Key` 헤더 계약은 변화가 없다.
- 따라서 본 검토는 (a) 이 diff 가 target 문서(`spec/data-flow/`)의 기존 서술과 어긋나는 신규
  명명/포맷을 만들었는지, (b) target 문서 자체가 `spec/conventions/**` 구조·명명 규약을 준수하는지
  두 축으로 진행했다.
- **비고 — 번들 예산 절단**: 조립된 prompt 에서 `spec/conventions/error-codes.md` ·
  `swagger.md` · `node-output.md` · `execution-context.md` · `interaction-type-registry.md` ·
  `spec-impl-evidence.md` 는 컨텍스트 예산 초과로 본문이 절단되어 있었다(`⚠️ 본문 생략됨`). 판정
  신뢰도를 위해 이 6개 파일은 워크트리에서 **절대경로로 직접 재조회**해 원문 전체를 확인했다
  (`error-codes.md`, `swagger.md` 전문 확인). 절단 자체는 harness 의 기존 한계이지 target 문서의
  결함이 아니므로 별도 발견사항으로 등재하지 않는다.

## 발견사항

없음 — CRITICAL/WARNING 위반을 찾지 못했다.

- **[INFO] 캐시 손상 방어 로직의 data-flow 문서 미기재 (선택적 완결성 제안)**
  - target 위치: `spec/data-flow/15-external-interaction.md` §2.2 Redis/BullMQ 표의
    `interaction:idempotency:<executionId>:<route>:<key>` 행, 및 `## Rationale` →
    "Fail-open 정책의 일관 표기" 단락
  - 위반 규약: 해당 없음 — `0-overview.md` §3.3(Schema 매핑) 은 "흐름에서 실제로 read/write 되는
    컬럼"만 요구하며, 캐시 엔트리 내부의 방어적 값-범위 검증(`isHttpStatusCode`)까지 문서화하라는
    규정은 없다. 즉 이 항목은 **위반이 아니라 완결성 제안**이다.
  - 상세: 이번 diff 는 캐시 엔트리의 `statusCode` 가 `100~599` 정수 범위를 벗어나면(손상으로 간주)
    폐기하고 신규 처리로 강등하도록 강화했다. §2.2 표는 이미 `{bodyHash, responseJson,
    statusCode}` shape 와 "24h TTL" 을 적어 두었고, Rationale 은 "idempotency 저하 =
    같은 `Idempotency-Key` 재요청이 전부 캐시 미스로 판정" 시나리오까지 이미 다루고 있어, 이번
    강화("손상 엔트리 하나가 500 을 만드는 것을 방지")도 같은 운영자-관측 결의 서술과 정합적으로
    이어붙일 수 있는 자리다.
  - 제안: 필수 아님. 굳이 반영한다면 §2.2 해당 행 비고에 "손상 엔트리(예: 범위 밖 `statusCode`)는
    무시하고 신규 처리(폐기)"를 한 문구 추가하는 정도로 충분하다. target 수정도, 규약 갱신도
    강제하지 않는다.

## 관점별 확인 결과

1. **명명 규약** — 이번 diff 의 신규 식별자(`MIN_HTTP_STATUS_CODE`/`MAX_HTTP_STATUS_CODE`
   `UPPER_SNAKE_CASE` 모듈 상수, `isHttpStatusCode` camelCase 술어 함수)는 같은 파일의 기존
   `MAX_KEY_LENGTH`/`TTL_SEC`/`REDIS_KEY_PREFIX` 표기와 일치한다. 클라이언트에 노출되는 wire-level
   에러 코드(`error-codes.md` §1 대상)는 신설되지 않았다 — `isHttpStatusCode` 실패는 코드 값이
   아니라 내부 로그(`Logger.warn`)로만 관측되므로 `error-codes.md`(UPPER_SNAKE_CASE 표기 규약)
   적용 대상이 아니다.
2. **출력 포맷 규약** — 202/409/410 응답 계약, `Idempotency-Key` 캐시 shape(`{bodyHash,
   responseJson, statusCode}`), `TransformInterceptor` 의 `{ data }` 래핑 등 어느 것도 이번
   diff 로 바뀌지 않았다. `spec/data-flow/15-external-interaction.md` §2.2 표의 서술과 diff 후
   런타임 동작이 계속 일치한다(손상 엔트리는 애초에 "표에 없던" 방어적 예외 경로).
3. **문서 구조 규약** — `spec/data-flow/*.md` 16개 파일 전수 확인 결과 `## Overview` 1회·
   `## Rationale` 1회를 모두 갖춘다(grep 실측). `0-overview.md`(도메인 인덱스, `0-` prefix) /
   `_product-overview.md`(제품 정의, `2-navigation`·`3-workflow-editor`·`4-nodes`·`5-system`·
   `7-channel-web-chat` 에만 존재) 의 역할 분리도 CLAUDE.md 표와 일치한다 — `data-flow/` 는 순수
   기술 명세 영역이라 `_product-overview.md` 가 없는 것이 정상이며 위반이 아니다. `0-overview.md`
   §3 이 명시하는 5요소(System role·Source→Sink·Schema 매핑·상태 전이·외부 의존) + 선택 §3.6(권한
   요약)도 `15-external-interaction.md` 가 전부 갖춘다.
4. **API 문서 규약** — 이번 diff 는 컨트롤러·DTO 를 건드리지 않아 `swagger.md` 의 데코레이터
   패턴(§1~§5, `writeOnly`/`readOnly`, `ApiOkWrappedResponse` 계열, §5-4 `@ApiForbiddenResponse`
   체크리스트)이 적용될 표면이 없다. 참고로 `swagger.md` §1-4 "닫힌 union 을
   `additionalProperties` 로 뭉개지 않는다" 규칙과 `15-external-interaction.md` 의 서술 사이에도
   모순은 없다(EIA `context` 오픈-스키마 결정은 이 문서가 다루는 §1.2 dispatch 표와 별개 layer).
5. **금지 항목** — `error-codes.md` §2(rename 은 breaking, 정확성만을 위한 rename 금지), §3
   historical-artifact 예외, `swagger.md` §6(레거시 "빈 껍데기" 스키마 금지) 등 명시적 금지 패턴을
   이번 diff·target 문서 어디서도 재현하지 않는다.

## 요약

이번 PR 의 실제 코드 변경은 `IdempotencyInterceptor` 내부의 `readKey`/`hashBody`/캐시 엔트리
`statusCode` 방어 로직을 뮤테이션 실측 기반으로 굳힌 것으로, API 표면·wire 포맷·에러 코드·DTO 어느
것도 바꾸지 않는 순수 내부 하드닝이다. `spec/data-flow/**` 문서는 이번 PR 에서 전혀 수정되지 않았고,
현재 상태로도 `0-overview.md` §3 이 정의한 5요소 구조·Overview/본문/Rationale 3섹션·`0-` /
`_product-overview.md` 명명 분리·`error-codes.md`/`swagger.md` 의 명명·포맷·금지 항목 규약을 모두
준수한다. CRITICAL·WARNING 급 위반은 발견되지 않았고, 유일한 언급 사항은 완결성 차원의 선택적
INFO(캐시 손상 방어 로직을 §2.2 비고에 한 줄 추가하면 좋다는 제안)뿐이다.

## 위험도

NONE
