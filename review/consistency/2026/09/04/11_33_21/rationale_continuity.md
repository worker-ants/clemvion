# Rationale 연속성 검토 — spec/5-system (impl-done)

## 검토 범위 요약

- `spec/5-system/` 델타: 0개 파일 (이 브랜치는 spec 을 변경하지 않음 — 정상, CRITICAL 근거 아님)
- 구현 diff: `codebase/` 8개 파일 / 820줄 (전량 직접 확인 완료, 절대경로 `git diff origin/main...HEAD -- codebase/`)
- 변경 내용: `background-run-response.dto.ts`·`create-assistant-session.dto.ts` 의 Swagger
  `@ApiPropertyOptional` → `@ApiProperty({ nullable: true })` 정정(9곳, "계약 거짓" 수정) +
  재발 방지 AST 가드(`swagger-dto-contract-guard.ts`/`.spec.ts`) 신설 + 가드 공유 헬퍼
  (`temp-fixture.ts`) 추출 + `nullable-type-lie-cast-guard.ts` 경로 정규화(W3)
- 대조 대상 Rationale: `spec/5-system/2-api-convention.md` §5.4 "부재 표현 — `null` vs 키 생략"
  및 그 `## Rationale` 절, `spec/5-system/1-auth.md` `## Rationale`(WebAuthn·세션 등 무관 항목
  포함 전수 확인)

## 발견사항

### [INFO] 신규 enforcement 가드가 spec 의 `code:` 프론트매터·Rationale 어디에도 포인터가 없다

- target 위치: 구현 diff — `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`,
  `swagger-dto-contract.spec.ts` (신규 파일, §5.4 규약을 코드로 강제)
- 과거 결정 출처: `spec/5-system/2-api-convention.md` §5.4 본문이 이 가드의 판정 로직(§5.4 는
  "SoT: `spec/5-system/2-api-convention.md` §5.4" 로 가드 코드 내부 주석에 역참조됨)의 근거다.
  같은 문서의 `1-auth.md` `## Rationale` "부트 캐너리 — `@WorkspaceId()` reflection 자가검증"
  항목은 이와 유사한 "규약을 지키는 코드 가드"를 spec Rationale 에 명시적으로 기록하는 선례다.
- 상세: 이 diff 는 §5.4 의 "`null` 을 쓰는(상시 존재) 필드 → `@ApiProperty({ nullable: true })`"
  규칙을 **정확히** 구현·강제한다 — 대안 재도입도, 원칙 위반도, 무근거 번복도 없다. 다만 spec
  쪽에는 이 강제 메커니즘(AST 가드)의 존재를 알리는 문장이 없어, 다음 사람이 §5.4 위반이
  CI 에서 잡히는지 spec 만 보고는 알 수 없다. `1-auth.md` 의 부트 캐너리 사례처럼 "이 규약은
  코드가 강제한다" 를 한 줄 남기는 관례와 다소 어긋난다.
- 제안: `spec/5-system/2-api-convention.md` §5.4 또는 그 Rationale 에 "강제:
  `swagger-dto-contract.spec.ts`(AST 기반, `backend-checks.yml`)" 한 줄을 추가할 것을 고려.
  단, 이는 정합 보완 제안일 뿐 이번 diff 를 막을 사유는 아니다(scope 델타 0 인 코드 전용 PR).

## 상세 근거 (반증 시도 — 기각된 대안 재도입/원칙 위반 여부)

- diff 가 손댄 두 필드(`BackgroundRunNodeExecutionDto` 계열의 8개 필드, `CreateAssistantSessionDto
  .llmConfigId`)는 모두 §5.4 규칙과 **반대 방향으로 어긋나 있던 "계약 거짓"**(TS `| null` 인데
  `@ApiPropertyOptional()`로 optional 선언 / `nullable:true` 인데 TS 에 `| null` 부재)이었고,
  이번 diff 가 §5.4 문면에 맞춰 정정한다. §5.4 Rationale 의 "왜 `null` 필드에
  `@ApiPropertyOptional` 을 쓰지 않는가" 문단과 판정 논리가 정확히 일치한다.
- §5.4 의 "소급 적용 대상 아님" 예외(이미 문서화된 **키 생략** 필드는 소급 요구하지 않음)는
  이번 diff 의 대상(키 생략이 아니라 **null 표현의 선언 불일치**)에 해당하지 않는다 — 동봉된
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 이 구분을 스스로 명시하고,
  §5.4 의 소급 면제로 정당화되는 "103곳 drift 배치"는 **이번 PR 범위에서 명시적으로 제외**했다.
  이는 원칙을 어기지 않고 오히려 원칙의 경계(무엇이 예외이고 무엇이 아닌지)를 정확히 지킨
  사례다.
- `1-auth.md` Rationale 전수(1.1.B·1.4.A~K·2.3.A~D·4.1.A~B 등)를 diff 대상 파일(background-run/
  create-assistant-session/repo-guards)과 대조했으나 이번 diff 는 인증·세션·WebAuthn·RBAC 어느
  결정에도 접촉하지 않는다 — 재도입·번복 후보 없음.
- `temp-fixture.ts` 추출·`nullable-type-lie-cast-guard.ts` 경로 정규화는 순수 테스트 인프라
  리팩터로 spec Rationale 이 다루는 범위(제품 결정) 밖이다.

## 요약

이번 diff(8파일/820줄)는 `spec/5-system/2-api-convention.md` §5.4 "부재 표현 — `null` vs 키
생략" 규칙 및 그 Rationale 을 **재도입도 번복도 아닌 정확한 실행**으로 구현했다. 기각된 대안을
근거 없이 되살리거나, 합의된 설계 원칙을 우회하거나, 과거 결정을 무근거로 뒤집는 패턴은 발견되지
않았다. 오히려 §5.4 의 "소급 적용 대상 아님" 예외 경계를 스스로 정확히 지켜 103곳 drift 배치를
이번 범위에서 제외한 점, 두 차례의 자기 측정 오류(70→102→103)를 문서에 투명하게 남긴 점은
Rationale 연속성 관점에서 모범적이다. 유일한 코멘트는 신규 enforcement 가드를 spec 쪽에서
포인터로 남기지 않은 정합 보완 제안(INFO) 하나다.

## 위험도

NONE
