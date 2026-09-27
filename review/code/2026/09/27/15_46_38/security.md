# 보안(Security) 리뷰 — patch-body-followups

## 검토 범위

이번 PR 은 `PATCH /workflows/:id`·`PATCH /nodes/:id`·`PATCH /auth-configs/:id` 요청 DTO 의
`description`/`ipWhitelist` 를 `nullable`(OpenAPI)·`T | null`(TS 타입)로 선언해, 이미 런타임이
받아들이던 동작(명시적 `null` 로 값을 지운다)에 선언을 맞추는 변경이다. 실질 로직 변경은 DTO
타입/데코레이터뿐이고, 나머지는 테스트(unit/e2e)·JSDoc 주석·plan/consistency 산출물이다.

- `codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts`
- `codebase/backend/src/modules/nodes/dto/update-node.dto.ts`
- `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts`
- `codebase/backend/src/common/utils/omit-undefined.ts` (JSDoc 만 추가, 코드 변경 없음)
- 나머지: `*.spec.ts`/`*.e2e-spec.ts`(테스트 전용), `CHANGELOG.md`, `plan/**`, `review/consistency/**`(산출물)

## 발견사항

- **[INFO]** `ipWhitelist: null` 은 IP 화이트리스트를 완전히 비활성화한다(모든 IP 허용) — 새 취약점은 아니고 기존 `[]` 전송과 동일한 의미의 재확인
  - 위치: `codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts:62` (필드 선언), 실제 적용부는 (변경 범위 밖) `auth-configs.service.ts` `ac.ipWhitelist?.length` 가드
  - 상세: `@IsOptional()`(class-validator)은 값이 `null`/`undefined`면 `@IsArray()`·`@IsString({each:true})`·`@IsIpOrCidr({each:true})`를 모두 건너뛰므로 `null`이 그대로 저장된다. 저장된 `ipWhitelist: null`은 `ac.ipWhitelist?.length`가 falsy 라 IP 검사 자체가 스킵된다 — 즉 웹훅/엔드포인트 접근 제어(§5.4)의 IP 화이트리스트가 통째로 해제된다. 다만 이 결과는 이번 PR 이전에도 **빈 배열(`[]`) 전송으로 동일하게 달성 가능**했던 동작이라(CHANGELOG "동작 변화는 없다"), 이번 diff 가 새 우회 경로를 여는 것은 아니다. 이 PATCH 를 호출할 권한(누가 auth-config 를 수정할 수 있는지의 인가 검사)은 이번 diff 범위 밖이라 별도로 확인하지 않았다 — 그 인가 경계가 적절한지가 이 기능의 실질 보안 통제다.
  - 제안: 조치 불요(회귀 아님). 다만 auth-config 수정 권한(RBAC)이 실제로 적절한 역할로 제한되는지는 별도 축으로 확인할 가치가 있다(이번 PR 의 diff 에 없음).

- **[INFO]** `@IsOptional()` 이 `null` 전체를 "값 없음"으로 취급해 다른 NOT NULL 컬럼에서 500(`INTERNAL_ERROR`)을 유발하는 별도 결함 클래스가 `plan/in-progress/patch-body-followups.md`·`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 문서화됨 — 이번 PR 의 코드 변경 대상은 아님
  - 위치: `plan/in-progress/patch-body-followups.md`(실측 표), `plan/in-progress/spec-draft-nullable-notation-followups.md`(신규 백로그 항목)
  - 상세: 이번 PR 이 손댄 세 필드(`description`×2, `ipWhitelist`)는 전부 nullable 컬럼이라 해당 결함과 무관하다. 별도로 `GlobalExceptionFilter`(`codebase/backend/src/common/filters/http-exception.filter.ts`, 이번 diff 범위 밖, 미변경)를 확인한 결과 — 매핑되지 않은 `Error`/DB 예외는 스택트레이스나 원문 메시지를 응답 바디로 돌려주지 않고 `'An unexpected error occurred...'` 로 마스킹한다(코드 내 주석이 CWE-209 방지 의도를 명시). 즉 이 500 결함은 **정보 노출(info disclosure)은 아니며**, 클라이언트 입력이 400 대신 500 을 만드는 입력 검증 완결성 문제다. plan 문서가 이미 근본 원인(`@IsOptional()`이 null 을 건너뜀)과 처방(필터 매핑이 아니라 입구 DTO 검증, `keyset-cursor-uuid-validation.md §A` 선례 인용)을 정확히 적어 백로그에 등재했으므로 이번 PR 에서 추가 조치는 불필요.
  - 제안: 조치 불요 — 이미 별도 트래커 항목으로 정확히 좁혀 등재됨.

- **[INFO]** 하드코딩된 시크릿·평문 자격증명 없음
  - 위치: 변경분 전체(diff 21개 파일)에 `password`/`secret`/`api_key`/토큰 리터럴 값 등을 grep 했으나 전부 필드명·상수명·문서 서술(`SecretV2`·`secret-store.md` 인용 등)이며 실제 값은 없음.

## 요약

이번 diff 는 세 개의 request DTO(`UpdateWorkflowDto.description`·`UpdateNodeDto.description`·`UpdateAuthConfigDto.ipWhitelist`)의 타입·OpenAPI 선언을 이미 런타임이 지원하던 `null` 입력에 맞추는 순수 선언 정합화이며, 실질 검증 로직·인가 로직·직렬화 경로는 바뀌지 않는다(CHANGELOG 도 "동작 변화 없음"으로 명시하고, 뮤테이션 테스트 D1~D6·H1 로 회귀를 확인함). 인젝션·인증 우회·하드코딩 시크릿·안전하지 않은 암호화·에러 메시지 정보 노출 등 OWASP Top10 관점에서 이번 diff 가 새로 만든 취약점은 발견되지 않았다. `ipWhitelist: null`이 화이트리스트를 해제하는 것과 NOT NULL 컬럼에 대한 500 오류는 둘 다 실재하는 관찰이지만 (a) 전자는 기존에도 `[]`로 동일하게 가능했던 동작의 재확인이고 (b) 후자는 이번 PR 의 코드 변경 대상 밖이며 이미 정확한 근본 원인·처방과 함께 별도 백로그 항목으로 등재돼 있다. 두 가지 모두 차단 사유가 아니다.

## 위험도

NONE
