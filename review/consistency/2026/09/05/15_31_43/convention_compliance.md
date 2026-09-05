# 정식 규약 준수 검토

## 검토 범위 확인

- `spec/5-system/` 델타(`origin/main` 대비): **0개 파일**. 이 브랜치는 target 영역의 spec 문서를 바꾸지 않았다. 따라서 본 검토는 (a) 실제 코드 diff(8개 파일 / 1129줄)가 기존 `spec/conventions/**` 을 지키는지, (b) 번들에 포함된 target 문서 원문(`1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 전문)이 그 conventions 와 정합하는지 두 축으로 진행했다.
- 코드 diff 실체: `audit-logs.service.ts`(감사 로그 `GET /api/audit-logs` 의 `user` 필드 과다 노출 보안 수정 — `leftJoinAndSelect` → `leftJoin`+`addSelect` 3필드 한정, 반환 타입 `AuditLogListItem` 신설) + `src/shared/testing/response-contract.ts`/`.spec.ts`(§5.4 계약 대조 신규 테스트 인프라, 기존 `swagger-probe.ts` 재사용) + 4개 e2e 스펙에 `assertMatchesContract` 배선 + `CHANGELOG.md`/plan 문서 갱신. 신규 API endpoint·에러 코드·이벤트명·ENV 도입 없음(naming_collision.md 검토와 일치).
- `spec/conventions/error-codes.md`·`swagger.md`·`audit-actions.md` 를 직접 열어 대조 SoT 로 사용했다(prompt 번들이 예산 절단으로 conventions 본문 274개 파일을 모두 생략했기 때문).

## 발견사항

이번 PR 이 신규로 도입한 코드·target 문서 원문에서 **CRITICAL/WARNING 급 정식 규약 위반은 발견되지 않았다.**

- **[INFO]** 신규 테스트 인프라(`response-contract.ts`)의 배치 위치는 기존 관례와 일치
  - target 위치: 해당 없음 (코드: `codebase/backend/src/shared/testing/response-contract.ts`)
  - 관련 규약: `spec/conventions/swagger.md` §5-1 (DTO/응답 관련 산출물 위치 관례)
  - 상세: 이 파일은 DTO 가 아니라 테스트 유틸리티라 §5-1 의 `dto/responses/*-response.dto.ts` 규칙 대상은 아니다. 다만 같은 폴더(`src/shared/testing/`)에 `origin/main` 에 이미 존재하던 `swagger-probe.ts`(스키마 추출 유틸)와 나란히 배치되고, export 이름(`findContractViolations`/`assertMatchesContract`/`contractForDto`)도 기존 `buildSwaggerDocument`/`schemaOf`/`schemasOf` 와 이름 충돌 없이 그 위에 조합되는 형태라 기존 관례를 그대로 따른다.
  - 제안: 조치 불요 (규약 위반 아님, 확인 목적의 기록).

- **[INFO]** 새로 강화된 §5.4 계약 대조가 우연히 마주친 기존(diff 밖) DTO 선언 drift — 이미 추적 중
  - target 위치: 해당 없음 (코드: `codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts:25-26` `AuditLogDto.user`)
  - 위반 규약: `spec/5-system/2-api-convention.md` §5.4 (부재 표현 — `null` vs 키 생략) — "`null` 을 쓰는(상시 존재) 필드는 `@ApiProperty({ nullable: true })`, 키 생략 필드는 `@ApiPropertyOptional()` + `field?: T`(`| null` 금지)"
  - 상세: `AuditLogDto.user` 는 `@ApiPropertyOptional({ nullable: true })` + `user?: AuditLogUserDto | null` 로 optional+nullable 을 동시 선언한다 — §5.4 가 응답 바디에서 금지하는 조합이다. 그러나 이 필드는 이번 PR 의 diff 대상이 아니며(선언은 변경되지 않음), `plan/in-progress/spec-draft-nullable-notation-followups.md`(§5.4 drift 트래커, L341 `AuditLogDto` 행)에 이미 등재돼 있고 이전 코드 리뷰 라운드(`review/code/2026/09/05/15_12_02/api_contract.md`)도 "조치 불요 — 기존 트래커에서 처리"로 판정했다. 실제 서비스는 이 필드를 항상 채워 보내므로(키 생략이 아니라 값이 `null` 이거나 3필드 객체) 선언보다 **더 엄격**하게 동작해 런타임 결함은 아니다.
  - 제안: 이번 PR 범위에서 조치 불요. 기존 트래커(`spec-draft-nullable-notation-followups.md`)가 처리할 항목이며 본 검토가 새로 추가할 필요는 없다.

## 정합성 확인 (위반 아님 — 검토 근거로 기록)

- `spec/5-system/1-auth.md` §1.5.4 의 `lower_snake_case` 에러 코드(`invitation_not_found` 등)는 `spec/conventions/error-codes.md` §3 historical-artifact 레지스트리에 "초대 API 한정" 예외로 명시 등재돼 있고, 본문의 각주도 그 예외를 정확히 인용한다 — 명명 규약 위반이 아니다.
- `spec/5-system/1-auth.md` §4.1 의 감사 액션 카탈로그(`workspace.transfer_ownership`·`user.password_changed` 등)는 `spec/conventions/audit-actions.md` §1~§3 의 `<resource>.<verb>` 구조·verb 시제 3분류·도메인별 레지스트리와 표기·분류 모두 일치한다(§4.1.A/§4.1.B Rationale 이 그 결정 이력을 소유).
- `spec/5-system/3-error-handling.md` §1.4 의 "엔진 수준 에러" 표는 `EngineErrorCode`/`ErrorCode`/클래스 `readonly code` 앵커 열로 등재처를 분리해, `spec/conventions/error-codes.md` 가 요구하는 "대표 surface 는 둘(+클래스 code)" 구조와 정합한다. 이 정합화는 같은 세션의 `plan/in-progress/spec-conventions-engine-error-code-surface.md` 편집(2026-09-05)이 "이미 해소" 로 표시한 것과 일치한다.
- `spec/5-system/2-api-convention.md` §2.2 의 URL 명명 규칙(복수형·kebab-case·중첩 2단계 제한)과 그 예외(RPC-style sub-channel, `/api/external/*`, `/api/auth/{action}`)는 `1-auth.md §5` 의 실제 엔드포인트 목록과 대조해 예외 조항 범위 안에 모두 들어간다 — 예외 밖 위반 사례 없음.
- `spec/5-system/2-api-convention.md` §5.2/§5.4 의 비-페이징 고정 컬렉션(`{ data: { items } }`) 규칙은 `1-auth.md §5` 의 WebAuthn credential 목록·세션 목록 응답 서술과 일치하며, `spec/conventions/swagger.md` §2-5/§6 의 pass-through·레거시 버그 구분과도 정합한다.
- 신규 코드가 도입하는 식별자(`AuditLogListItem`, `response-contract.ts` 의 export 일체)는 저장소 전수 대조 결과 기존 식별자와 충돌하지 않는다(같은 세션 `naming_collision.md` 검토와 교차 확인).

## 요약

이번 PR 은 `spec/5-system/` 문서 자체를 변경하지 않았고(델타 0), 실제 코드 변경은 감사 로그 API 의 과다 응답 노출 보안 수정과 §5.4 응답-계약 검증 테스트 인프라 신설로 구성된다. 두 변경 모두 `spec/conventions/swagger.md`·`error-codes.md`·`audit-actions.md` 가 정한 명명·배치·응답 포맷 규약을 위반하지 않으며, 번들에 포함된 target 문서 원문(1-auth·2-api-convention·3-error-handling) 도 해당 conventions 와 표기·구조 양면에서 정합했다. 이번 검토 중 유일하게 확인된 §5.4 선언 층 drift(`AuditLogDto.user` optional+nullable)는 diff 밖 기존 파일이며 이미 별도 트래커에 등재·처분(조치 불요)된 항목이라 신규 위반으로 집계하지 않았다.

## 위험도

NONE
