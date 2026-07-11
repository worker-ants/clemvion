# Security Review — EIA response DTO 디렉토리 정규화

## 발견사항

- **[INFO]** 순수 구조 리팩터 — 런타임 로직/보안 통제 변경 없음
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts` → `dto/responses/{execution-status-response,interact-ack-response,refresh-token-response}.dto.ts` 분리, `interaction.controller.ts`/`interaction.service.ts`/`interaction.controller.spec.ts` 의 import 경로 갱신
  - 상세: `git diff origin/main` 확인 결과 각 신규 DTO 파일의 클래스 정의는 기존 `dto/responses.dto.ts` 내용과 완전히 동일(바이트 단위)하게 이동되었을 뿐이며, 컨트롤러/서비스 diff 는 import 문 재배선 3줄이 전부다. 인증 가드(`InteractionGuard`, `InteractionRateLimitGuard`), `@Public()` 배치, idempotency interceptor, 시크릿 마스킹(`deepRedactSecrets`, `redactThreadForPublic`) 호출부는 전혀 손대지 않았다.
  - 제안: 해당 없음 — 정보성.

- **[INFO]** 신규 파일 `execution-status-response.dto.spec.ts` 는 순수 스키마(OpenAPI) 회귀 가드
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.spec.ts`
  - 상세: 실제 사용자 입력을 다루지 않고, `SwaggerModule.createDocument()` 로 생성된 문서 구조(oneOf/discriminator 부재/required 필드 등)만 단언한다. 인젝션·인증·암호화 관점에서 공격 표면이 없다.
  - 제안: 해당 없음.

- **[INFO]** (기존 코드 관측, 본 diff 범위 밖) `getStatus`/`interact`/`refreshToken` 의 시크릿 마스킹·2단계 조회·토큰 검증 로직은 이번 변경으로 인해 옮겨지거나 재작성되지 않았다
  - 위치: `interaction.service.ts` (`deepRedactSecrets`, `redactThreadForPublic`, `STATUS_PROJECTION_COLUMNS` 등)
  - 상세: 참고용으로 전체 파일 컨텍스트가 제공되었으나 diff 는 import 3줄뿐이므로 이 로직 자체는 이번 리뷰 대상 변경이 아니다. 기존 구현은 이미 outputData/conversationThread 에 대해 egress-time redaction 을 적용하고, DB 프로젝션도 필요한 컬럼만 select 하는 등 양호한 상태를 유지하고 있다.
  - 제안: 해당 없음 — 회귀 없음 확인.

## 요약

이번 변경은 `external-interaction` 모듈의 응답 DTO 를 단일 flat 파일(`dto/responses.dto.ts`)에서 `swagger.md §5-1` 규약에 맞춘 `dto/responses/*-response.dto.ts` 서브디렉토리로 옮기는 순수 구조 리팩터이며, 여기에 OpenAPI 스키마 표현(oneOf/discriminator/required/nullable)을 검증하는 회귀 테스트가 추가되었다. `git diff origin/main` 대조 결과 DTO 클래스 정의, 컨트롤러의 가드/인터셉터 배선, 서비스의 인증·시크릿 마스킹·에러 매핑 로직은 문자 단위로 동일하게 보존되어 있어 인젝션, 인증/인가, 입력 검증, 암호화, 에러 노출, 의존성 측면에서 새로 도입된 취약점이나 회귀는 없다. 코드 이동에 수반해 시크릿·자격증명이 하드코딩되지도 않았다.

## 위험도

NONE
