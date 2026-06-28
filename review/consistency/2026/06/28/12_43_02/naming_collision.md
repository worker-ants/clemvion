# 신규 식별자 충돌 검토

## 검토 범위

- **검토 모드**: impl-done (diff-base: `origin/main`)
- **target spec 영역**: `spec/5-system/` (실제 변경 spec 파일: `spec/5-system/12-webhook.md`, `spec/5-system/3-error-handling.md`, `spec/4-nodes/7-trigger/1-manual-trigger.md`)
- **연관 코드 변경**: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`, `hooks.service.ts`, `workflows.controller.ts`

## 신규 식별자 목록

이번 변경이 도입하는 신규 공개 식별자:

| 식별자 | 종류 | 위치 |
|--------|------|------|
| `TriggerParameterErrorDetail` | TypeScript interface | `trigger-parameter.types.ts` |
| `toTriggerParameterErrorDetails` | 함수(export) | `trigger-parameter.types.ts` |
| `MISSING_REQUIRED_FIELD` | field-level error code (public API) | `error.details[].code` |
| `TYPE_COERCION_FAILED` | field-level error code (public API) | `error.details[].code` |
| `INVALID_SCHEMA` | field-level error code (public API) | `error.details[].code` |
| `invalid_schema` | 내부 분류 문자열 (non-public) | `TriggerParameterValidationError.reason` 확장 |

## 발견사항

### 발견 없음 (NONE)

이번 변경이 도입하는 신규 식별자들과 기존 사용처 간 의미 충돌은 발견되지 않았다. 구체적 검토 근거는 아래와 같다.

**1. 요구사항 ID 충돌**
`MISSING_REQUIRED_FIELD`·`TYPE_COERCION_FAILED`·`INVALID_SCHEMA` 는 `spec/5-system/3-error-handling.md §1.7` 에 신규 등재되며, 기존 에러 코드 카탈로그(`§1.1`~`§1.6`, `§2.1`)에 동일 문자열이 없다. `INVALID_FIELD`(기존, `§2.1`, DTO validation pipe 전용)와는 레이어가 구분된다: 전자는 trigger parameter 도메인 전용 field code, 후자는 class-validator 기반 DTO 검증의 generic field code이다. spec은 두 코드가 "동일 레이어"임을 명시하고 있으며 이는 `error.details[].code` 위치에서의 구조적 동일성을 가리키는 것이지, 값 충돌을 의미하지 않는다.

**2. 엔티티/타입명 충돌**
`TriggerParameterErrorDetail` 은 새로 추가된 interface 로, 기존에 동일명 또는 유사명 인터페이스가 없다. `ValidationDetail`(기존, `workflow-errors.ts`, `validation.pipe.ts` 두 파일에 동명 로컬 선언)과는 파일 스코프가 분리되며 export 경로도 다르다. 두 `ValidationDetail`은 `code: 'INVALID_FIELD'` 로 고정되어 trigger parameter 도메인과 겹치지 않는다.

**3. API endpoint 충돌**
신규 endpoint 없음. 변경은 기존 `POST /api/hooks/:endpointPath`(Webhook) 및 워크플로우 수동 실행 endpoint의 응답 본문 구조(`errors` 키 → `details` 키 교체)만 수정한다. endpoint 경로·메서드는 변경되지 않는다.

**4. 이벤트/메시지명 충돌**
새 WebSocket 이벤트·queue 이름 없음.

**5. 환경변수·설정키 충돌**
새 ENV var·config key 없음.

**6. 파일 경로 충돌**
신규 spec 파일 없음. 수정된 파일들은 기존 경로(`spec/5-system/12-webhook.md`, `spec/5-system/3-error-handling.md`, `spec/4-nodes/7-trigger/1-manual-trigger.md`)다.

### INFO — `INVALID_SCHEMA`가 spec의 에러 코드 example에서 명시적으로 노출되지 않음

- **target 신규 식별자**: `INVALID_SCHEMA` (field-level error code)
- **기존 사용처**: `spec/5-system/3-error-handling.md §1.7` note에 텍스트로 언급되나, `spec/5-system/12-webhook.md §5.2`의 응답 예시 JSON에는 `MISSING_REQUIRED_FIELD`·`TYPE_COERCION_FAILED`만 등장하고 `INVALID_SCHEMA`는 예시에서 생략됨.
- **상세**: 구현 코드(`resolve-trigger-parameters.ts`)에서 4곳에 `invalid_schema` reason이 사용되고 있으며 `toTriggerParameterErrorDetails`가 이를 `INVALID_SCHEMA` public code로 정규화하는데, webhook spec §5.2 응답 예시는 이 코드를 예시하지 않는다. 충돌은 아니고 문서 커버리지의 소폭 누락이다.
- **제안**: `spec/5-system/12-webhook.md §5.2` 예시 또는 `details[]` 설명 목록에 `INVALID_SCHEMA` = "트리거 파라미터 스키마 구조 위반"을 추가하면 완전한 카탈로그가 된다. 비차단 사항이므로 별도 follow-up 으로 처리 가능.

## 요약

이번 변경(`trigger-parameter.types.ts`의 `TriggerParameterErrorDetail` 인터페이스·`toTriggerParameterErrorDetails` 함수 신규 추가, 관련 spec 3개 파일 업데이트)이 도입하는 신규 식별자는 기존 코드베이스·spec 어디에서도 동일 이름으로 다른 의미로 사용되지 않는다. `ValidationDetail`(기존, DTO 검증 레이어)·`INVALID_FIELD`(기존, generic field code)와 용도·도메인이 분리되어 있으며 충돌하지 않는다. webhook 응답 봉투 키가 `errors` → `details`로 바뀐 것은 이번 변경의 의도된 정규화이며, 기존에 `details` 키를 같은 위치에서 다른 의미로 사용하는 경로는 존재하지 않는다. INFO 1건(INVALID_SCHEMA 의 webhook spec 예시 누락)은 비차단 문서 보완 제안이다.

## 위험도

NONE
