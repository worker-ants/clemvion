# 정식 규약 준수 검토 — spec/5-system/ (--impl-prep)

## 검토 범위 및 방법

- 대상: `spec/5-system/` 전 영역 (impl-prep bundle). 번들은 컨텍스트 예산 초과로 `1-auth.md`·
  `2-api-convention.md`·`3-error-handling.md` 3개만 전문이 실렸고 나머지 15개(`4-execution-engine.md`
  포함)는 절단됐다. 작업 브랜치명(`eia-idem-resolve-cache-hit`)과 워킹트리 diff(아래 참고)가
  가리키는 실제 관심 영역인 `14-external-interaction-api.md`(Idempotency-Key, §5·§7·§8·R8)는
  번들에서 절단되어 있어 `Read` 로 리포지토리 원본을 직접 열어 대조했다. 함께 직접 연 정식 규약:
  `redis-keys.md`, `error-codes.md`, `swagger.md`, `audit-actions.md`, `spec-impl-evidence.md`.
- 참고: 이번 워킹트리의 미커밋 변경은 `codebase/backend/.../idempotency.interceptor.ts` 코드 1개
  파일뿐이며 `spec/5-system/**` 는 변경되지 않았다 — 즉 이번 대조는 "diff 검토" 가 아니라
  **현재 spec 본문이 정식 규약을 지키고 있는가"의 standing 감사**다.
- 코드 diff 자체의 로직 결함(`resolveCacheHit` 호출부에서 `redisKey`/`bodyHash` 필드가 뒤바뀐 것으로
  보이는 지점)은 `spec/conventions/**` 준수 여부의 범위 밖이라 본 리포트의 등급 대상에 넣지 않았다 —
  코드 리뷰/spec-impl 정합 담당 검토에서 다뤄야 한다는 점만 남겨 둔다.

## 대조 결과 (관점별)

### 1. 명명 규약
- Redis 키 `interaction:idempotency:<executionId>:<route>:<key>` ([EIA §R8](../../../../../spec/5-system/14-external-interaction-api.md)) 는
  `redis-keys.md §1` 의 `{도메인}:{용도}[:{식별자}...]` 형태를 그대로 따르고, `redis-keys.md §3`
  인벤토리에 동일 키가 이미 등재되어 있다 — 신규 키 등재 의무(§5)도 이미 충족된 상태.
- 에러 코드 `IDEMPOTENCY_KEY_CONFLICT` 는 `error-codes.md §1` 의 `UPPER_SNAKE_CASE` + 의미 기반
  명명을 따르고, `3-error-handling.md` 카탈로그(§1.x, `409`)에도 정확히 등재되어 있다. §3
  historical-artifact 예외 레지스트리에 들어갈 이유가 없는(규약 위반이 아닌) 케이스.
- 응답 DTO 파일 `dto/responses/interact-ack-response.dto.ts`·`execution-status-response.dto.ts`·
  `refresh-token-response.dto.ts` 는 `swagger.md §5-1` 의 `dto/responses/*-response.dto.ts` 패턴을
  준수.

### 2. 출력 포맷 규약
- `IDEMPOTENCY_KEY_CONFLICT` 를 포함한 에러 응답 봉투(`{ error: { code, message, details } }`)는
  EIA §5.1 표에서 `2-api-convention.md §5.3` 을 명시 포인터로 참조 — 이중 SoT 없이 위임.
  성공 응답(`202 { executionId, accepted, currentStatus }` = `InteractAckDto`)도 `TransformInterceptor`
  의 `{ data: ... }` 래핑을 EIA §5 상단 캡션에서 명시해 `swagger.md §2-5` pass-through 규칙과 충돌 없음.
- R8 이 규정한 "캐시 대상 닫힌 목록"(2xx/409/410, `400 VALIDATION_ERROR` 및 `5xx` 제외)과 diff 의
  `resolveCacheHit` 주석 표(7갈래: 미스/문법손상/형태불일치/bodyHash불일치/payload손상/409·410 재현/
  2xx 재현)가 의미상 정합 — 새로 추가된 "엔트리 형태 불일치" 분기도 R8 의 "손상 엔트리는 버리고
  신규 처리로 강등" 서술 안에 이미 포함되는 케이스라 spec 쪽 추가 갱신 없이도 drift 가 아니다.

### 3. 문서 구조 규약
- `14-external-interaction-api.md` 는 `## Overview (제품 정의)` → §3~§12 본문 → `## Rationale`
  3섹션 구조를 지킨다. Frontmatter `id: external-interaction-api` / `status: partial` /
  `pending_plans: [plan/in-progress/spec-sync-external-interaction-api-gaps.md]` (실존 확인) 는
  `spec-impl-evidence.md §2`~§3 스키마와 라이프사이클을 준수. `code:` 글로브에
  `codebase/backend/src/modules/external-interaction/**` 가 포함되어 있어 `idempotency.interceptor.ts`
  변경도 커버리지 안에 있다(R-1 글로브 허용 원칙).

### 4. API 문서 규약 (swagger.md)
- §5-1 파일 위치, §2-5 wrapping, §1-4 닫힌 union/열린 map 구분 관련해 EIA 문서 어디에서도 규약
  위반 패턴(빈 껍데기 스키마, `additionalProperties` 오남용, unsound discriminator 등)을 재도입하는
  서술을 발견하지 못했다.

### 5. 금지 항목
- Redis 키에 워크스페이스 세그먼트를 넣는 금지 패턴, 인라인 에러 코드 문자열(카탈로그 미등재),
  이중 래핑 응답 등 conventions 가 명시적으로 금지하는 패턴이 EIA §5~§8/R8 범위에서 재발한 곳은
  없었다.

## 발견사항

없음 — 검토 범위(EIA Idempotency-Key 관련 spec 본문 + 직접 대조한 5개 conventions 문서) 안에서
CRITICAL/WARNING 급 정식 규약 위반을 찾지 못했다.

- **[INFO]** 번들 예산 절단으로 인한 커버리지 한계
  - target 위치: 프롬프트 상단 "컨텍스트 예산 초과로 생략된 파일 15개" 목록
  - 위반 규약: 해당 없음 (규약 위반이 아니라 이번 회차의 검증 범위 한계)
  - 상세: `4-execution-engine.md`(§7.5.1/§9.2 등 EIA §5.1·§8.4 가 직접 포인터로 참조하는 절 포함)·
    `6-websocket-protocol.md`·`12-webhook.md` 등이 번들에서 절단되어, 이번 검토는 EIA
    Idempotency 절과 그 직접 인용 대상(redis-keys/error-codes/swagger/audit-actions/
    spec-impl-evidence)만 `Read` 로 보완 대조했다. 절단된 15개 파일 자체의 규약 준수는
    이번 회차에서 실측하지 못했다.
  - 제안: 다음 회차에 절단 목록이 달라지면(예: `4-execution-engine.md` 가 포함되는 방식으로
    청크가 재구성되면) 그 시점에 재검증. orchestrator 예산 정책상 즉시 조치는 불필요.

## 요약

이번 작업(브랜치 `eia-idem-resolve-cache-hit`)의 실제 코드 diff 는 `idempotency.interceptor.ts`
1개 파일이고 `spec/5-system/**` 는 손대지 않았다. 그 코드가 근거로 삼는 spec 절(EIA §3.2
EIA-IN-11, §5.1 에러 코드 표, §7.3 데이터 모델, §R8 캐시 대상/스코프 규정)을 직접 열어
`redis-keys.md`·`error-codes.md`·`swagger.md`·`audit-actions.md`·`spec-impl-evidence.md` 와
대조한 결과, 명명·출력 포맷·문서 구조·API 문서·금지 항목 다섯 관점 모두에서 정식 규약 위반을
발견하지 못했다 — 키 형태·에러 코드·DTO 파일 위치·frontmatter 라이프사이클이 모두 규약과
일치한다. 다만 컨텍스트 예산으로 번들의 15개 파일이 절단돼 그 파일들 자체의 규약 준수는
이번 회차에서 확인하지 못했다(INFO, 조치 불요). 코드 diff 안의 `resolveCacheHit` 호출부
필드 스왑으로 보이는 로직 결함은 정식 규약 범위 밖이라 등급 없이 별도 언급만 남긴다.

## 위험도

NONE
