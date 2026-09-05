# 신규 식별자 충돌 검토

## 전제 — 프롬프트 diff 섹션 누락, 워킹트리 직접 대조로 대체

`_prompts/naming_collision.md` 는 "구현 diff: 30개 파일 / 2003줄" 이 실려야 한다고 명시했으나
실제로는 `## 구현 변경 사항` 헤더조차 파일에 없다(컨텍스트 예산 절단). 프롬프트 지시에 따라
워킹트리를 절대경로로 직접 대조했다:

```
git diff origin/main --stat -- codebase/ spec/ plan/ CHANGELOG.md
→ 32 files changed, 1507 insertions(+), 62 deletions(-)
```

(`review/`, `plan/complete` 아래 이전 검토 라운드 산출물은 노이즈로 제외 — 실제 코드 변경이
아니다.) 이 diff 는 `spec/5-system/`(auth) 이 아니라 `§5.4 응답-계약 검증자` 스윕
(schedules/triggers 응답 DTO 정합화 + `response-contract.ts`/`swagger-dto-contract-guard.ts`
확장)이다. 프롬프트가 번들한 `spec/5-system/` 은 이 브랜치의 실제 변경 대상이 아니며 —
`scope(spec/5-system) 델타 0` 은 프롬프트 자신이 이미 "정상" 이라고 밝힌 전제와 일치한다.
아래는 실제 diff(32개 파일)에서 도입된 신규 식별자를 전수 대조한 결과다.

## 방법

diff 에 등장한 신규 식별자(클래스·인터페이스·함수·모듈 상수·옵션 키) 각각을
`git -C <worktree> grep`/`grep -rn` 으로 저장소 전체에서 재검색해, 정의 파일 밖에서 **다른
의미**로 이미 쓰이고 있는지 대조했다.

| 신규 식별자 | 종류 | 정의 파일 | 저장소 내 타 용처 |
|---|---|---|---|
| `ScheduleTriggerRefDto` | class | `schedule-response.dto.ts` | 없음 |
| `ScheduleTriggerWorkflowRefDto` | class | `schedule-response.dto.ts` | 없음 |
| `TriggerWorkflowRefDto` | class | `trigger-response.dto.ts` | 없음(단, `ScheduleTriggerWorkflowRefDto` 문자열이 이 이름을 부분 포함 — grep 상 오탐이었고 실제 참조·import 충돌 아님, `\b` 경계 재확인 완료) |
| `OptionalNullableOffender` | interface | `swagger-dto-contract-guard.ts` | fixture 파일에서만 재참조(같은 스윕) |
| `OptionalNullableOffenderFixtureDto` | class(양성 대조군) | `optional-nullable.fixture.ts` | 없음 |
| `isResponseDtoFile` | function | `swagger-dto-contract-guard.ts` | spec 파일에서 import 만 |
| `findOptionalNullableResponseFields` | function | `swagger-dto-contract-guard.ts` | spec 파일에서 import 만 |
| `EXPECTED_OPTIONAL_NULLABLE_DRIFT` | const(78건 배열) | `swagger-dto-contract.spec.ts` | `execution-response.dto.spec.ts` 는 **동명이 아닌** 기존 `OPTIONAL_NULLABLE_DRIFT`(사전 존재, 부분집합)를 doc-comment 로만 상호 참조 — 실제 이름 충돌 아님 |
| `allowMissing` | 옵션 키(`ContractCheckOptions`) | `response-contract.ts` | 저장소 내 타 용처 0건. `allowUndeclared`(기존)의 "거울상"으로 의도적 대칭 명명 |
| `contractCache` | module-level const | `response-contract.ts` | 없음(모듈 스코프) |
| `buildContractForDto` | function(내부, 기존 `contractForDto` 로직 분리) | `response-contract.ts` | 없음. 공개 `contractForDto` 는 기존 식별자 유지, 시그니처만 sync 캐시-접근자로 변경(async 내부 로직은 새 이름으로 이동) |
| `NOTIFICATION_SIGNING_STRIP_KEYS` | module-level const | `triggers.service.ts` | 없음 |
| `INTERACTION_RESPONSE_STRIP_KEYS` | module-level const | `triggers.service.ts` | 없음 |
| `TRIGGER_RESPONSE_STRIP_COLUMNS` | module-level const | `triggers.service.ts` | 없음 |
| `sanitizeForResponse` | private method(기존 `sanitizeChatChannelForResponse` 개명) | `triggers.service.ts` | 전 호출부가 이 브랜치 안에서 동시 치환됨(9곳) — 구 이름 잔존 0건 확인 |
| `toResponse` | private method(신설) | `schedules.controller.ts` | 저장소에 동명 메서드 없음(`executions.service.ts` 의 `toResponseExecution` 은 접미사가 달라 별개) |

전수 확인 결과, 요구사항 ID·엔티티/타입명·API endpoint·이벤트/메시지명·환경변수/설정키·
spec 파일 경로 어느 관점에서도 **기존 사용처와 다른 의미로 충돌하는 식별자는 없다**:

- **요구사항 ID**: 이 diff 는 spec 을 변경하지 않아 신규 ID 부여 자체가 없다.
- **엔티티/DTO/인터페이스명**: 위 표의 신규 클래스·인터페이스는 전부 최초 등장이며, 기존
  코드베이스에 동명이 없다. `Ref` 접미사(`ScheduleTriggerRefDto`/`TriggerWorkflowRefDto`)는
  같은 스윕 안에서 "조인 엔티티 전체 대신 참조 필드만 노출" 패턴에 일관되게 쓰여 명명
  관례가 유지된다.
- **API endpoint**: diff 전체에서 `@Get`/`@Post`/`@Patch`/`@Put`/`@Delete` 신규 데코레이터가
  없다(grep 확인). 기존 endpoint(`GET/POST/PATCH /api/schedules`, `/api/triggers`)의 응답
  **형태**만 좁혔을 뿐 경로·메서드 변경은 없다.
- **이벤트/메시지명**: webhook·queue·SSE 이벤트 신설 없음.
- **환경변수/설정키**: `process.env.*` 신규 참조 없음. `allowMissing`/`allowUndeclared` 는
  런타임 ENV 가 아니라 TypeScript 함수 옵션 키이고, 저장소 내 다른 의미로 쓰인 자리가 없다.
- **파일 경로**: 신규 파일은 `optional-nullable.fixture.ts`
  (`repo-guards/__tests__/fixtures/dto/responses/`) 하나뿐이며, 형제 가드
  `production-build-devdep-guard.ts`/`masked-reject-callers-guard.ts` 와 동일하게
  "가드 로직 + `__tests__/` 소비 spec" 분리 관례를 따른다. 경로 충돌 없음. (단, plan
  tracker 자신이 이 fixture 가 어떤 `code:` frontmatter glob 에도 안 걸린다는 것을 이미
  별도 항목으로 등재해 두었다 — 이는 naming collision 이 아니라 spec-impl-evidence coverage
  이슈이므로 본 검토 범위 밖이다.)

## 참고 — 충돌은 아니지만 명명 일관성 관찰 (INFO)

- **[INFO]** `SchedulesController.toResponse` vs `ExecutionsService.toResponseExecution`
  — target 신규 식별자: `toResponse` (schedules.controller.ts, private)
  — 기존 사용처: `codebase/backend/src/modules/executions/executions.service.ts:1070`
    `private toResponseExecution(execution: Execution): ResponseExecution`
  — 상세: 두 메서드는 "엔티티 → 응답 형태 매핑" 이라는 같은 역할이지만 한쪽은 접미사 없는
    `toResponse`, 다른 쪽은 `toResponseExecution` 으로 명명 패턴이 다르다. 클래스 스코프가
    달라 컴파일 충돌은 없고 의미 충돌도 없다(둘 다 "응답으로 변환"이라는 같은 의도).
  — 제안: 충돌이 아니므로 조치 불필요. 다만 향후 같은 패턴의 private mapper 가 늘어나면
    저장소 전역 관례(`to<Resource>Response` 또는 클래스-로컬 `toResponse`)를 하나로
    정하는 편이 검색성에 유리하다 — 이번 PR 범위는 아니다.

## 요약

이 diff(32개 파일, `spec/5-system/` 델타 0)는 `§5.4` 응답-계약 검증자 스윕의 연속 작업으로,
schedules/triggers 응답 DTO 를 좁히고(`ScheduleTriggerRefDto`/`TriggerWorkflowRefDto` 등),
`swagger-dto-contract-guard.ts` 에 세 번째 축(`OptionalNullableOffender` 래칫)을 추가하고,
`response-contract.ts` 에 `allowMissing` 옵션과 `contractForDto` 메모이제이션을 넣은 것이다.
diff 에 등장하는 모든 신규 식별자(클래스 6개·함수 3개·모듈 상수 5개·옵션 키 1개·private
메서드 2개)를 저장소 전체에서 재검색했으나, 기존에 **다른 의미로 이미 쓰이고 있는** 동명
식별자는 발견되지 않았다. 새 API endpoint·이벤트/메시지명·환경변수·spec 파일 경로도 이
diff 에는 존재하지 않는다. `sanitizeChatChannelForResponse → sanitizeForResponse` 개명은
같은 PR 안에서 전 호출부가 동시 치환되어 잔존 구식별자가 없다. 유일하게 눈에 띄는 것은
`toResponse`(schedules)와 `toResponseExecution`(executions)의 명명 패턴 불일치인데, 이는
충돌이 아니라 스타일 관찰(INFO)이다.

## 위험도

NONE
