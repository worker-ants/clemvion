# 정식 규약 준수 검토 — spec/data-flow/ (impl-done, diff-base=origin/main)

## 범위 확인

- 실 diff(`git -C <워크트리> diff origin/main...HEAD --stat` 로 재확인)는 두 파일뿐이다:
  `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` /
  `idempotency.interceptor.spec.ts`. `spec/**` 변경은 0건. 코드 변경은 idempotency 캐시
  손상(바깥 엔트리 / 안쪽 `responseJson` 두 겹) 방어를 `discardCorruptEntry` 로 통합하고,
  형태 검증(`isIdempotencyEntry`)·상태코드 범위 검증(`isHttpStatusCode`)·판정 순서
  (bodyHash 비교 → payload 파싱) 를 고정, `readKey`/`hashBody` 경계값 테스트를 보강한
  방어 강화 + 테스트 커밋 묶음이다(`git log origin/main..HEAD` 기준 10 커밋). 신규 wire
  에러 코드·API 계약·DTO·Swagger 데코레이터 변경은 없다.
- 프롬프트 번들의 `## 정식 규약 모음` 섹션은 이번 회차에도 `error-codes.md`·`execution-context.md`·
  `interaction-type-registry.md`·`node-output.md`·`swagger.md`·`migrations.md`·
  `conversation-thread.md`·`spec-impl-evidence.md`·`rag-evaluation.md`·`cafe24-api-catalog/_overview.md`
  등을 "컨텍스트 예산 초과"로 본문 생략했다. 판정 신뢰성을 위해 이 파일들을 워크트리
  절대경로로 직접 `Read` 해 대조했다 — `error-codes.md`(전문 135줄), 그리고
  `spec/5-system/14-external-interaction-api.md` §R8·R9 원문을 직접 확인.
- **이 diff·target 조합에 대한 동일 관점 검토가 이미 세 차례 선행**했다
  (`review/consistency/2026/08/12/23_48_39/convention_compliance.md`,
  `.../08/13/00_20_21/convention_compliance.md`,
  `.../08/13/00_36_23/convention_compliance.md`) — 셋 다 위험도 **NONE**. 그 사이 diff 에
  `readKey`/`hashBody` 경계값 테스트(`c29290c71`)·`statusCode` 범위 검증 테스트·뮤테이션 보강
  (`6cee73065`)·오기 정정(`f2785d8a0`) 커밋이 추가됐으나, 이들은 전부 **테스트 파일 + 동일
  `isHttpStatusCode`/`readKey` 프로덕션 함수의 내부 로직**이라 앞선 결론(신규 wire 계약 없음)을
  뒤집지 않는다. 본 회차는 선행 결론을 전제하지 않고 원본 conventions 파일과 대상 코드를
  독립적으로 재대조했다.

## 대조 결과

### 1. 명명 규약

- **에러 코드**: diff 가 던지는 유일한 코드 `IDEMPOTENCY_KEY_CONFLICT` 는 `error-codes.md §1`
  의 `UPPER_SNAKE_CASE` + 의미 기반 명명을 만족하며, 이번 diff 는 이 리터럴을 신설하지 않고
  기존 `ConflictException` 블록의 위치만 옮겼다(`git diff -- idempotency.interceptor.ts | grep
  "'[A-Z_]\+'"` 로 확인 — 전/후 동일 문자열 1쌍뿐). §3 historical-artifact 예외 레지스트리에
  없는 것도 맞다(원칙 준수 코드).
- **신규 식별자**: `MIN_HTTP_STATUS_CODE`/`MAX_HTTP_STATUS_CODE`(모듈 상수, SCREAMING_SNAKE) ·
  `isIdempotencyEntry`/`isHttpStatusCode`(type-guard, `is` 접두)· `describeShape`·
  `discardCorruptEntry`(private 메서드) 는 전부 module-private/class-private 이며 wire 노출이
  없다 — `error-codes.md` 적용 범위("프로젝트 전체의 에러 코드 문자열")·`node-output.md
  §3.2` 표기 규약 어느 쪽도 이 식별자들을 대상으로 하지 않는다.
- **문서 파일 명명**: target `spec/data-flow/*.md` 16개 전부 `<N>-kebab-case.md` 패턴이고
  entry 문서가 `0-overview.md` 로 CLAUDE.md `0-` prefix 관행을 따른다. `15-external-interaction.md`
  도 동일.

### 2. 출력 포맷 규약

- `{ error: { code: 'IDEMPOTENCY_KEY_CONFLICT', message } }` 형태는 `5-system/2-api-convention.md
  §5.3` 에러 봉투 규약과 정합하며 이번 diff 로 변경되지 않았다.
- `spec/data-flow/15-external-interaction.md §2.2` 의 idempotency 캐시 키 포맷
  (`interaction:idempotency:<executionId>:<route>:<key>`, `{bodyHash, responseJson,
  statusCode}`, 24h, `2xx`/`409`/`410` 닫힌 캐시 대상)과 `spec/5-system/14-external-interaction-api.md
  §R8`("캐시 대상은 닫힌 목록이다" / "캐시 키 스코프")은 diff 가 강화한 손상 처리 경로와
  그대로 정합 — `isErrorStatusCacheable`(`409`/`410` 만) 조건 자체는 이번 diff 에서 변경되지
  않았다(§R8 이 명시적으로 금지하는 "단일 비교로 축약" 패턴도 도입되지 않음).
- 신규 상태코드 범위 검증(`isHttpStatusCode`, `100`~`599`)은 캐시에 이미 적재된 값의 **방어적
  재검증**이지 새 wire 계약이 아니다 — HTTP status 자체의 유효 범위(RFC 상 100–599)를 그대로
  반영해 관례와 충돌 없음.

### 3. 문서 구조 규약

- `spec/data-flow/*.md` 16개 전체가 `## Overview` / `## Rationale` 을 보유하며,
  `15-external-interaction.md` 는 `0-overview.md §3` 이 규정한 도메인 spec 5요소(System role /
  Source→Sink / Schema 매핑 / 상태 전이 / 외부 의존) 순서도 그대로 따른다. target 문서 자체는
  이번 diff 로 변경되지 않았다.

### 4. API 문서 규약 (swagger.md)

- 이번 diff 는 컨트롤러·DTO·Swagger 데코레이터를 건드리지 않는다. 신설 함수/상수는 인터셉터
  내부 private 구현이라 API 응답 스키마에 노출되지 않는다 — `swagger.md` 의 데코레이터·DTO
  명명 패턴 적용 대상 자체가 없다.

### 5. 금지 항목

- `swagger.md` 의 금지 패턴, `error-codes.md §2`(이름 정확성 향상만을 위한 rename — 이번
  변경은 로직 리팩터이며 코드 값 자체는 불변), `migrations.md` append-only 위반 등 — 이번
  diff·대상 문서 어디에도 해당 패턴이 관측되지 않는다.

## 발견사항

CRITICAL/WARNING 급 위반 없음.

- **[INFO]** conventions 번들 절단이 4회 연속 재발 (신규 아님, 프로세스 관찰)
  - target 위치: 프롬프트 `## 정식 규약 모음` 섹션
  - 위반 규약: 없음(파이프라인 예산 배분 이슈, 규약 위반 아님)
  - 상세: `15-external-interaction.md` 가 직접·간접 참조하는 conventions SoT
    (`error-codes.md`, `swagger.md`, `execution-context.md`, `interaction-type-registry.md`,
    `node-output.md` 등)가 이번 회차에도 전부 "컨텍스트 예산 초과"로 본문 생략됐다. 앞선 세
    회차와 동일 현상이며, 매번 원본 파일 직접 대조로 보완해 왔다.
  - 제안: 기존 제안과 동일 — orchestrator 프롬프트 조립 시 target 이 명시적으로 참조하는
    `spec/conventions/*.md` 에 예산 우선순위 부여(`feedback_consistency_spec_mode_budget.md`
    계열, 4회 연속 재확인이므로 우선순위를 높여 검토 권장).

- **[INFO]** (참고, 본 checker 관점 밖) `data-flow/15` 의 "전 경로 fail-open (warn)" 표현이
  여전히 실제(5경로 중 4경로만 warn)보다 한 칸 넓음
  - target 위치: `spec/data-flow/15-external-interaction.md` §4 외부 의존 표
    ("전 경로 fail-open (warn) — 가용성 우선") 및 Rationale "Fail-open 정책의 일관 표기"
  - 위반 규약: 해당 없음 — 이는 `spec/conventions/**` 위반이 아니라 spec 본문과 코드
    docstring 간 정밀도(granularity) 격차이므로 엄밀히는 rationale-continuity/cross-spec
    관점이다.
  - 상세: 이미 `23_48_39` 회차(rationale_continuity INFO 1)에서 발견되어
    `plan/in-progress/backend-lint-gate-broken-on-main.md` L648 에 planner 인계로 등재됐고
    (`git grep` 로 현재도 `[ ]` 미체크 확인), 문서 텍스트는 이번 회차까지 그대로다. developer
    권한으로는 `spec/` 을 쓸 수 없어 이 PR 범위에서 해소 불가 — 새로 등재할 필요 없이 기존
    backlog 항목을 재확인만 한다.
  - 제안: 조치 불요(이미 추적 중). 참고용으로만 재확인.

## 요약

이번 PR 의 실 diff(`idempotency.interceptor.ts`/`.spec.ts` — 캐시 엔트리·payload 손상
fail-open 강화, `readKey`/`hashBody` 경계값·`statusCode` 범위 방어, warn 로깅, 판정 순서 고정)는
spec 문서를 전혀 변경하지 않았고, target `spec/data-flow/**` 16개 문서는 에러 코드 표기
(`UPPER_SNAKE_CASE`, 의미 기반 명명), secret URI scheme, BullMQ 큐 카탈로그, 에러 응답 봉투
형식(`{ error: { code, message } }`), idempotency 캐시 키 스코프·닫힌 캐시 목록([Spec EIA
§R8]), 문서 구조(Overview/본문/Rationale 3섹션, `0-` prefix, `<N>-kebab.md` 파일명) 모두
`spec/conventions/**`(error-codes.md, swagger.md, secret-store.md) 및
`5-system/2-api-convention.md`·`5-system/14-external-interaction-api.md §R8` 와 정합한다.
diff 자체에는 Swagger 데코레이터·DTO·신규 wire 에러 코드가 없어 API 문서 규약 적용 대상이
없으며, 명시적 금지 패턴도 관측되지 않았다. 동일 diff·target 조합에 대한 선행 세 회차의
NONE 판정을 독립적으로 재확인했다. 남는 항목은 전부 INFO(파이프라인 프로세스 관찰 1건,
이미 planner backlog 에 등재된 rationale 정밀도 격차 1건 재확인)로 비차단이다.

## 위험도

NONE
