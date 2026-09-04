# Rationale 연속성 검토 — spec/5-system/ (impl-done, diff-base origin/main)

## 범위 요약

- scope(`spec/5-system/`) 델타: 0개 파일 — 이번 브랜치는 그 spec 영역을 직접 고치지 않았다.
- 구현 diff: 16개 파일 / 1262줄. 실질 내용은 두 갈래다.
  1. 저장소 repo-guard 테스트 인프라 리팩터 — `path.relative(...).split(path.sep).join('/')` 8곳 중복을
     `toPosixPath`/`toPosixRelative`(source-scan.ts) 로 추출, `withFiles`/`withFixture` tmpdir 픽스처를
     `temp-fixture.ts` 공유 헬퍼로 승격. 순수 리팩터 — 설계 결정 없음.
  2. `spec/5-system/2-api-convention.md §5.4`("부재 표현 — `null` vs 키 생략")를 강제하는 신규 AST 가드
     `swagger-dto-contract-guard.ts`/`.spec.ts` 추가 + 그 가드가 잡은 실제 "계약 거짓" 9곳 수정
     (`background-run-response.dto.ts` 8필드 `@ApiPropertyOptional` → `@ApiProperty({nullable:true})`,
     `create-assistant-session.dto.ts` `llmConfigId?: string` → `llmConfigId?: string | null`).

## 발견사항

검토 관점 4가지(기각된 대안 재도입 / 합의된 원칙 위반 / 결정의 무근거 번복 / 암묵적 가정 충돌) 전부에서
**CRITICAL·WARNING 급 충돌을 찾지 못했다.** 아래는 조사 과정과 그 근거만 기록한다(별도 조치 불요).

### [검토 완료 — 충돌 아님] 신규 `swagger-dto-contract` 가드와 §5.4 "소급 적용 대상 아님" 조항

- target 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts`(신규) —
  `expect(findSwaggerContractMismatches(files, SRC_ROOT)).toEqual([])` (저장소 전수 스캔, zero-tolerance)
- 과거 결정 출처: `spec/5-system/2-api-convention.md` §5.4 본문(`## Rationale` 절 바로 위, `:195`)
  — *"**소급 적용 대상 아님**: 본 규칙은 — 표현 선택과 **DTO 선언 형태 양쪽 모두** — **앞으로
  도입·변경되는 필드**에 적용한다."*
- 처음 읽었을 때는 잠재적 충돌로 보였다 — 신규 가드가 **저장소 전체**의 기존 DTO 선언에 대해
  예외 없이 0건을 요구하는데, §5.4 는 명시적으로 "DTO 선언 형태" 까지 포함해 기존 필드는 소급
  강제하지 않는다고 적고 있기 때문이다.
- **재확인 결과 실제 충돌이 아니다.** `plan/in-progress/spec-draft-nullable-notation-followups.md`
  §③(`:120~233`)이 정확히 이 텐션을 이번 세션에서 이미 실측·분석·해소해 두었다:
  - 새 가드가 잡는 것은 "선언과 TS 타입이 서로 모순되는" **계약 거짓**(항상 버그, 도입 시점 무관)
    뿐이다. `nullable`/`?` 선언이 TS 타입과 **내적으로 일치**하는 기존 필드(103곳, 옛 문면
    `@ApiPropertyOptional({nullable:true}) + field?: T`)는 가드가 애초에 offender 로 잡지 않는다
    — "선언과 TS 가 서로 일치하므로"(같은 plan `:247`).
  - 그 103(+1)곳은 "규약 변경에 따른 drift" 로 분류되어 **§5.4 소급 면제 아래** 별도
    "§5.4 drift 배치"(같은 plan `:243~256`, 아직 미착수)로 이월됐고, 급하지 않다고 명시했다.
  - 이번 diff 가 고친 9곳(`background-run-response.dto.ts` 8 + `create-assistant-session.dto.ts`
    `llmConfigId` 1)은 그 drift 집합과 달리 **선언 자체가 내적으로 모순**되는 진짜 버그
    (예: `nullable:true` 선언인데 TS 는 `string` — null 이 오면 타입이 거짓말)였다. §5.4 소급
    면제는 "표현 선택(스타일)" 을 보호하는 것이지 "선언·타입 간 모순(버그)" 를 보호하지 않는다는
    것이 그 plan `:304~313` 의 명시적 결론("기각한 대안 — 선례 103곳을 문면에 맞춘다")이다.
  - 나아가 §5.4 본문의 "소급 적용 대상 아님" 문구 자체("표현 선택과 DTO 선언 형태 양쪽 모두")도
    이 plan 이 이번 세션에 **직접 정정해 넣은 것**이다(`:231~233`: 원문 맥락은 "키 생략 필드의
    사유 문구" 면제뿐이었고 "DTO 선언 형태" 로의 확장은 유추였다 — 정정으로 유추를 없앴다).
    즉 지금 읽은 spec 본문 자체가 이 diff 와 같은 축의 작업이 만든 최신 상태다.
- 결론: 신규 가드의 zero-tolerance 스코프는 "타입 거짓말" 로 좁게 유지되고 있고, "스타일 drift"
  는 명시적으로 배제·이월돼 있다 — Rationale 원칙(§5.4 소급 면제)과 실제로 충돌하지 않는다.

### [검토 완료 — 충돌 아님] `create-assistant-session.dto.ts` `llmConfigId` 타입 확장

- target 위치: `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts`
  (`llmConfigId?: string` → `llmConfigId?: string | null`)
- 과거 결정 출처: `spec/3-workflow-editor/4-ai-assistant.md:494` — `llmConfigId?: UUID; // 생략 시
  세션 저장값 또는 workspace default`(메시지 요청 DTO), `:586` 세션 생성 Body `{workflowId,
  llmConfigId?}`.
- 확인한 것: 데코레이터의 `nullable: true` 는 이 diff 이전부터 이미 있었다(가드가 "반대 방향" 으로
  지목한 사례) — 즉 API 계약(OpenAPI)은 이미 `null` 허용을 선언했고 `class-validator` 의
  `@IsOptional()` 은 런타임에서도 `null`/`undefined` 를 동일하게 통과시킨다. 이번 변경은 TS 타입을
  기존에 이미 선언·허용되던 동작에 맞춘 **표기 정정**이며, "생략 시 default" 서술과 "명시적 null"
  이 공존하는 새로운 의미를 도입하지 않는다. spec 본문과 충돌하지 않는다.
- 추가로 이 필드는 요청(request) DTO 라 §5.4(`## 5. 응답 형식` 하위)의 "응답 바디 전용" 스코프
  범위 밖일 수 있으나, plan 후속 항목(`:239~242`)이 이 필드를 "§5.4 drift 배치" 가 아니라 별도의
  "계약 거짓 9곳"(선언·타입 내적 모순)으로 분류해 지금 고친 것으로 정확히 기록해 두었다 — 스코프
  오독이 아니다.

### 나머지 diff(리팩터 8개 파일)

`source-scan.ts`(toPosixPath/toPosixRelative 추출), `temp-fixture.ts`(withFiles/withFixture 승격),
및 그 소비처(`nullable-type-lie-cast.spec.ts`·`audit-action-binding.spec.ts`·
`websocket-events.types.spec.ts`·`production-build-devdep-guard.ts`·`masked-reject-callers-guard.ts`·
`engine-error-code-anchor-guard.ts`)의 변경은 전부 크로스플랫폼 경로 정규화 + 사본 제거 리팩터이며
설계 결정이나 spec 서술을 건드리지 않는다. Rationale 연속성 관점에서 검토 대상이 아니다.

## 요약

이번 diff 는 spec/5-system/ 을 직접 수정하지 않았고, 코드 변경도 (a) 저장소 repo-guard 픽스처
리팩터와 (b) `spec/5-system/2-api-convention.md §5.4` 를 **강제하는 방향**의 신규 가드 + 그 가드가
잡은 진짜 타입 거짓말 9곳 수정으로 좁게 국한된다. 처음 조사 시 신규 가드의 zero-tolerance 스캔이
§5.4 의 "소급 적용 대상 아님" 조항과 충돌할 잠재 소지가 보였으나, 같은 세션의 `plan/in-progress/
spec-draft-nullable-notation-followups.md` 가 그 텐션을 이미 실측 기반으로 분석해 "타입 거짓말(항상
버그, 가드가 잡음)" 과 "스타일 drift(103곳, 소급 면제 아래 별도 배치로 이월, 가드가 잡지 않음)" 를
명확히 갈라 두었고, §5.4 본문의 소급 면제 문구 자체도 이번 세션에 "DTO 선언 형태" 까지 명시적으로
포함하도록 함께 정정됐다. 따라서 기각된 대안의 무단 재도입, 합의 원칙 위반, 무근거 결정 번복,
invariant 우회 중 어느 것도 확인되지 않았다.

## 위험도

NONE
