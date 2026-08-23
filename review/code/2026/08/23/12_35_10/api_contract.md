# API 계약(API Contract) 리뷰

## 대상 요약

이번 diff 는 이전 라운드(`12_22_08`)에서 이미 API-contract 관점 LOW 로 판정됐던 동일 변경에 대한
재검토다. 실질 API 표면 변경은 여전히 `ExecuteWorkflowDto.input` 필드에 OpenAPI
`deprecated: true` 플래그를 추가하고 description 문구를 보강한 것 하나뿐이다
(`codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts`). 이번 라운드에서 추가된
변경분(전 라운드 W1~W3 fix)은 `spec/conventions/swagger.md` 의 Rationale 제목·앵커·오타 정정과
`plan/**` 트래커 서술 보강뿐이며, 어느 것도 실제 엔드포인트의 요청/응답 스키마·상태 코드·인증을
건드리지 않는다.

- `execute-workflow.dto.ts` — `input` 필드 `@ApiPropertyOptional` 에 `deprecated: true` 추가 +
  description 에 "신규 통합은 `parameterValues` 를 쓴다" 문구 보강. 와이어 필드명·타입은 불변.
- `workflows-execute-body.spec.ts` — 위 결정을 고정하는 가드 테스트(대조군 포함) 추가. 코드 아님(테스트).
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md`,
  `plan/in-progress/swagger-decisions.md` — 계획/결정 기록. 코드 아님.
- `spec/conventions/swagger.md` — DTO `description` 길이 규칙을 "강제"에서 "지향"으로,
  보안·정책 캐비엇을 "예외"에서 "적극 지시"로 재정의. 엔드포인트 `summary`(10~20자)·
  `description`(50~150자)은 여전히 강제. 컨벤션 문서이며 런타임 API 표면 무변경.
- `review/code/**`, `review/consistency/**` — 이전 라운드 산출물(과거 리뷰·SUMMARY·RESOLUTION 등).
  리뷰 메타데이터이며 API 계약과 무관.

런타임 동작은 이번 diff 로 전혀 바뀌지 않는다. `ExecuteWorkflowDto` 는 `@Body()` 파라미터 타입이
아니라 `@ApiBody({ type })` 로만 쓰이므로(`execute-workflow.dto.ts:1-29` 상단 docstring, 이번 diff
밖의 기존 코드) `CustomValidationPipe.toValidate()` 가 `metatype === Object` 를 검증 제외 목록에
둬 이 DTO 데코레이터는 실제 요청 검증에 관여하지 않는다. 이 상태 자체(문서-동작 분리)는 이번
PR 이 새로 만든 게 아니라 기존에 이미 확인·수용된 설계이고, "여분 top-level 키를 400 으로 거부할
것인가" 항목도 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에서 **"현행 유지"로
사용자가 명시 결정**해 닫혔다.

## 발견사항

- **[INFO]** `deprecated: true` 는 OpenAPI 스키마 표시일 뿐, 런타임 수용 범위는 변하지 않는다 —
  문서와 동작이 구조적으로 분리된 상태가 그대로 유지된다.
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:60-67`
    (`@ApiPropertyOptional` 데코레이터, `input` 필드), 배경 서술은 `:1-29`
  - 상세: `input` 필드에 `deprecated: true` 를 달아 OpenAPI 소비자(코드젠 SDK, Swagger UI)에게
    "새 통합은 `parameterValues` 를 쓰라"는 신호를 준다. 와이어 필드명을 바꾸지 않는 비파괴 변경이라
    하위 호환성 관점에서 안전하다. 다만 이 DTO 는 실제 `@Body()` 파라미터 타입이 아니어서 문서상의
    스키마(`additionalProperties: true`, `deprecated` 플래그)가 실제 요청 처리 동작을 강제하지
    않는다 — 여분 top-level 키가 와도 여전히 조용히 통과한다. PR 스스로 이 사실을
    `workflows-execute-body.spec.ts` 캐너리로 고정해 뒀고, 관련 plan 항목이 사용자 결정으로 이미
    닫혔으므로 이번 리뷰에서 새로 지적할 결함은 아니다.
  - 제안: 없음(이미 결정·테스트로 고정됨).

- **[INFO]** `deprecated: true` 에 sunset 일정·마이그레이션 헤더(`Sunset`/`Link`) 등 형식적
  폐기 정책 신호는 동반되지 않는다.
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:60-67`
  - 상세: 통상 OpenAPI `deprecated` 플래그는 제거 시점이나 대체 안내와 함께 쓰이는 경우가 많다.
    이번 결정은 "영구 병존, 시간이 지나며 클라이언트가 `parameterValues` 로 자연 유도되는" 설계를
    의도적으로 택했다고 docstring(46~53행)과 `plan/in-progress/swagger-decisions.md` §②에 명시돼
    있어, 제거 계획 부재는 누락이 아니라 설계다.
  - 제안: 없음(설계 의도). 유저 가이드(`02-nodes/triggers.mdx`)에도 이 필드가 노출되므로 문서
    사이트 쪽 deprecation 안내 동기화는 API-contract 리뷰 범위 밖이라 참고로만 남긴다.

- **[INFO]** `spec/conventions/swagger.md` 의 DTO `description` 길이 규칙 완화(강제→지향)와
  보안·정책 캐비엇 재정의(예외→지시)는 실제 엔드포인트 계약(요청/응답 필드·상태 코드·인증)에
  영향이 없는 순수 문서화 컨벤션 변경이다.
  - 위치: `spec/conventions/swagger.md` — `## 3) 주석/설명 톤` 절, 신설 `### §3 DTO 길이는 왜
    강제가 아닌가`, 개정된 `### §3 보안·정책 캐비엇 — 왜 길이를 이유로 줄이지 않는가, 그리고 왜
    양방향인가`
  - 상세: 엔드포인트 `summary`(10~20자)·`description`(50~150자)은 여전히 강제로 유지되고, DTO
    `description` 만 "지향"으로 낮아진다. 실측(요청 34%, 응답 45% 미준수) 기반의 현실화 결정이며,
    보안·정책 캐비엇 필드는 오히려 "예외"에서 "반드시 적는다"는 적극 지시로 강화됐다. API 소비자
    관점에서 스키마 구조·필드 존재 여부·타입은 전혀 바뀌지 않으므로 계약 위반이 아니다. 이번
    라운드에서 추가된 부분(Rationale 절 제목·앵커 정정, W1 fix)도 동일 내용의 프레이밍만 바꾼
    것으로 실질 규칙 변화는 없다.
  - 제안: 없음.

이번 diff 범위 안에서 breaking change, API 버전 관리 문제, 응답 형식/에러 응답 불일치, URL/경로
설계, 페이지네이션, 인증/인가 관련 문제는 발견되지 않았다.

## 요약

핵심 코드 변경은 `ExecuteWorkflowDto.input` 필드에 `deprecated: true` OpenAPI 플래그를 추가하는
비파괴적 문서화 변경 하나뿐이며, 와이어 필드명·런타임 검증 동작은 전혀 바뀌지 않는다(가드 테스트로
고정 확인됨). 동반된 `swagger.md` 컨벤션 개정도 문서 스타일/강제 범위 규칙이지 실제 API 표면에는
영향이 없다. 세 사용자 결정(여분 키 미거부 유지·`input` deprecation·DTO 길이 비강제화) 모두 plan
문서에 근거와 함께 명확히 기록돼 추적 가능하다. 이전 라운드(`12_22_08`) API-contract 리뷰의 INFO
지적사항은 설계 의도로 확인되어 반영 불필요로 처분됐고(RESOLUTION.md #5·#7), 이번 라운드의 fix는
문서 프레이밍 정정뿐이라 판정을 바꿀 실질 변화가 없다. 새로운 breaking change, 인증/인가 회귀,
응답 스키마 불일치는 없다.

## 위험도
LOW
