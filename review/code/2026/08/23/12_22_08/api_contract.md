# API 계약(API Contract) 리뷰

## 대상 요약

이번 변경의 실질 코드는 `ExecuteWorkflowDto.input` 필드에 OpenAPI `deprecated: true` 플래그를
추가하고 description 문구를 보강한 것 하나뿐이다(`execute-workflow.dto.ts`). 나머지는:

- `workflows-execute-body.spec.ts` — 위 결정을 고정하는 가드 테스트(대조군 포함) 추가
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md`, `plan/in-progress/swagger-decisions.md` — 계획/결정 기록 (코드 아님)
- `spec/conventions/swagger.md` — DTO `description` 길이 규칙을 "강제"에서 "지향"으로 완화하고, 엔드포인트 `summary`/`description` 은 강제로 유지, 보안·정책 캐비엇은 "예외"에서 "적극 지시"로 재정의 (컨벤션 문서, 런타임 API 표면 무변경)

런타임 동작은 이번 diff 로 전혀 바뀌지 않는다 — DTO 클래스는 `@Body()` 파라미터 타입이 아니라
`@ApiBody({ type })` 로만 쓰이므로 (`execute-workflow.dto.ts:1-29` 상단 docstring, 이번 diff 밖 기존
코드) `CustomValidationPipe` 를 아예 타지 않는다. 이 사실은 이번 PR 이 새로 만든 게 아니라
`00_33_31` naming_collision 리뷰에서 이미 확인됐고, 이번 PR 은 그 위에 문서 표시만 얹는다.

## 발견사항

- **[INFO]** `deprecated: true` 는 스키마 표시일 뿐, 런타임 수용 범위는 변하지 않는다 — 문서와 동작이
  구조적으로 분리된 상태가 유지된다.
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:60-67` (`@ApiPropertyOptional` 데코레이터), 배경 서술은 `:1-29`
  - 상세: `input` 필드에 `deprecated: true` 를 달아 OpenAPI 소비자(코드젠 SDK, Swagger UI)에게
    "새 통합은 `parameterValues` 를 쓰라" 는 신호를 준다. 이는 와이어 필드명을 바꾸지 않는 비파괴
    변경이라 하위 호환성 관점에서 안전하다. 다만 이 DTO 는 실제 `@Body()` 파라미터 타입이 아니어서
    (`CustomValidationPipe` 의 `toValidate()` 가 `metatype === Object` 를 검증 제외 목록에 둠)
    문서상의 스키마(`additionalProperties: true` 인 두 필드, `deprecated` 플래그)가 실제 요청 처리
    동작을 강제하지 않는다 — 이 엔드포인트로 오는 요청은 여분 top-level 키가 와도 여전히 조용히
    통과한다. PR 스스로 이 사실을 `workflows-execute-body.spec.ts` 캐너리로 고정해 뒀고,
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 "여분 키 400 거부" 항목을
    "(b) 현행 유지" 로 사용자가 명시 결정했으므로, 이번 리뷰에서 새로 지적할 결함은 아니다.
  - 제안: 없음(이미 결정·테스트로 고정됨). 향후 외부 클라이언트의 여분 키 전송 관측 데이터가
    쌓이면 plan 에 적힌 재검토 조건(관측 데이터 확보 시)에 따라 다시 논의하면 된다.

- **[INFO]** `deprecated: true` 만 있고 제거 시점/마이그레이션 가이드는 명시되지 않는다.
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:60-67`
  - 상세: 통상 OpenAPI `deprecated` 플래그는 sunset 일정이나 `Sunset`/`Link` 헤더 같은 추가
    신호와 동반되는 경우가 많다. 이번 결정은 의도적으로 "영구 병존, 시간이 지나며 자연 해소" 를
    택했다고 문서(`swagger-decisions.md` §②)에 명시돼 있어 제거 계획 부재가 누락이 아니라 설계다.
  - 제안: 없음(설계 의도). 다만 유저 가이드(`02-nodes/triggers.mdx`)에도 이 필드가 노출되므로,
    문서 사이트 쪽에도 동일 deprecation 안내가 반영됐는지는 API-contract 범위 밖이라 별도 확인
    권장 정도로만 남긴다.

- **[INFO]** `spec/conventions/swagger.md` 의 DTO `description` 길이 규칙 완화는 실제 엔드포인트
  계약(요청/응답 필드, 상태 코드, 인증)에는 영향이 없는 순수 문서화 컨벤션 변경이다.
  - 위치: `spec/conventions/swagger.md` (`## 3) 주석/설명 톤` 절 및 신설 `### §3 DTO 길이는 왜
    강제가 아닌가`)
  - 상세: 엔드포인트 `summary`(10~20자)·`description`(50~150자)은 여전히 강제로 유지되고, DTO
    `description` 만 "지향" 으로 낮아진다. 실측 기반(요청 34%, 응답 45% 위반)으로 규칙을 현실화한
    결정이며, 보안·정책 캐비엇 필드는 오히려 "예외"에서 "반드시 적는다" 는 적극 지시로 강화됐다.
    API 소비자 관점에서 스키마 구조·필드 존재 여부·타입은 전혀 바뀌지 않으므로 계약 위반이 아니다.
  - 제안: 없음.

이번 diff 범위 안에서 하위 호환성 breaking change, 버전 관리 문제, 응답 형식/에러 응답 불일치,
URL 설계, 페이지네이션, 인증/인가 관련 문제는 발견되지 않았다.

## 요약

핵심 코드 변경은 `ExecuteWorkflowDto.input` 필드에 `deprecated: true` OpenAPI 플래그를 추가하는
비파괴적 문서화 변경 하나뿐이며, 와이어 필드명·런타임 검증 동작은 전혀 바뀌지 않는다(가드
테스트로 고정 확인됨). 동반된 `swagger.md` 컨벤션 완화도 문서 스타일 규칙이지 실제 API 표면에는
영향이 없다. 세 사용자 결정(여분 키 미거부 유지·`input` deprecation·DTO 길이 비강제화) 모두
plan 문서에 근거와 함께 명확히 기록돼 있어 추적 가능하다. 새로운 breaking change, 인증/인가 회귀,
응답 스키마 불일치는 없다.

## 위험도
LOW
