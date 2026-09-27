# 문서화(Documentation) 리뷰 — patch-null-validation

## 발견사항

- **[WARNING]** `endpointPath` 필드의 JSDoc/Swagger 설명이 이번 PR 이 바꾼 핵심 동작(널 거부)을 반영하지 않는다
  - 위치: `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts:49-68` (JSDoc 49-57, `@ApiPropertyOptional` description 58-65)
  - 상세: 이 필드는 CHANGELOG 가 "43필드" 중 유일하게 이름을 붙여 설명한 두 사례 중 하나다 — "웹훅 트리거의 `endpointPath`에 `null`을 보내면 200으로 수신 경로가 조용히 지워졌다 — 이제 400이고 경로는 그대로다"(`CHANGELOG.md:34`). 그런데 정작 필드 자신의 JSDoc(변경 가능 조건·404·squatting 차단·schedule 타입 거부 사유까지 이미 상세히 관리되는 주석)과 Swagger `description`(v4 UUID 강제·변경 시 404·schedule 타입 거부만 언급)에는 `null` 처리에 대한 언급이 전혀 없다. 이 docblock 은 이미 "잘 유지되는 주석"의 예시라서, 다음 사람이 CHANGELOG 를 보지 않고 이 파일만 읽으면 "null 을 보내면 무슨 일이 나는지" 를 알 수 없다 — 예전엔 조용히 지워졌다는 사실(보안·데이터 유실 성격의 회귀)이 남긴 흔적조차 안 보인다.
  - 제안: JSDoc 에 한 줄 추가 — 예: "`null` 은 400 `VALIDATION_ERROR`로 거부한다(과거엔 웹훅 수신 경로가 조용히 삭제됐다 — `IsOptionalNonNull`)." Swagger `description` 문자열에도 같은 취지를 붙이면 OpenAPI 문서를 보는 외부 API 소비자도 이 계약을 알 수 있다.

- **[INFO]** 43개 필드의 `@ApiPropertyOptional` description 은 일반적으로 "null 거부" 동작을 문서화하지 않는다 — 이 코드베이스의 기존 관행과 대조됨
  - 위치: 예 `codebase/backend/src/modules/nodes/dto/update-node.dto.ts` — `description`(nullable) 필드는 description 에 "null 이면 설명을 지운다" 를 명시하는데(58행 근방), 같은 파일의 `label`·`positionX`·`config`·`isDisabled`(모두 이번에 `IsOptionalNonNull` 로 바뀜)는 description 에 tri-state 관련 언급이 없다.
  - 상세: 이 저장소는 nullable 필드에 한해 "null 이면 지운다" 를 Swagger description 에 적어 온 관행이 있다(`update-node.dto.ts`·`update-workflow.dto.ts`·`update-workspace-settings.dto.ts` 등에서 확인). NOT NULL 필드 43개는 그 대칭 관행 — "null 은 허용하지 않는다(생략만 값 유지)" — 을 명시하지 않는다. 런타임 에러 메시지(`$property must not be null — omit the field to keep the current value`)가 이 정보를 실어 나르지만, OpenAPI 문서 자체에는 나타나지 않는다.
  - 제안: 필수는 아니지만, 최소한 자주 쓰이는 필드(예: `name`, `isActive`) description 템플릿에 짧은 문구를 표준화해 붙이면 이후 신규 PATCH 필드 작성 시 일관되게 반영될 수 있다. 이번 PR 을 막을 사안은 아니다.

- **[INFO]** `spec/5-system/2-api-convention.md` §5.4 PATCH tri-state 서술의 적용 범위 모호성 — 이미 발견·추적됨, 중복 조치 불필요
  - 위치: `spec/5-system/2-api-convention.md` §5.4 블록쿼트 (동일 세션 `review/consistency/2026/09/27/17_14_44/cross_spec.md` WARNING, `SUMMARY.md` WARNING #2)
  - 상세: `Read` 로 직접 확인한 결과 §5.4 첫 블록쿼트가 "요청 바디는 대상이 아니다" 라고 선언하면서도 바로 이어 "PATCH 부분 업데이트는 ... tri-state 가 각각 의미를 갖는 별개 계약" 이라고 서술해, 이 PR 의 43필드 null-거부와 글자 그대로는 충돌해 보일 수 있다는 cross_spec checker 의 지적이 실측과 일치한다. `spec/` 은 developer 쓰기 권한 밖이라 이 세션이 직접 고칠 수 없고, 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 (10)에 planner 턴 작업으로 등재됐다(diff 확인: `spec-draft-nullable-notation-followups.md:6402-6407`). 새로 지적할 필요 없이 추적 상태만 확인.
  - 제안: 조치 불필요(이미 트래커에 있음). 다음 planner 턴에서 §5.4 블록쿼트에 "nullable 로 선언된 필드에만 적용" 한 문장을 보태면 해소된다.

- **[INFO]** 신규 공용 데코레이터 `optional-non-null.ts` 가 spec `code:` 어디에도 등재되지 않음 — 이미 발견·추적됨
  - 위치: `codebase/backend/src/common/utils/optional-non-null.ts` (신규 파일)
  - 상세: `omit-undefined.ts` 선례와 동일한 패턴(공용 헬퍼가 spec frontmatter `code:` 목록에 없음)이 이번에 13개 라우트 규모로 반복된다는 plan_coherence checker 지적이 타당하다. 이 역시 `spec-draft-nullable-notation-followups.md` "2026-09-27 보강" 문단에 이미 등재됐다(§(6) 모집단 확장). README 갱신 대상도 아니다 — `codebase/backend/README.md` 에는 애초에 `common/utils/` 개별 헬퍼를 나열하는 절이 없다(grep 확인, 0건).
  - 제안: 조치 불필요(이미 트래커에 있음).

## 긍정적으로 확인한 부분 (참고)

- `IsOptionalNonNull` 데코레이터(`codebase/backend/src/common/utils/optional-non-null.ts:3-13`) JSDoc 은 문제(왜 `@IsOptional` 이 위험한가) · 해법(`ValidateIf`+`IsDefined`) · 안 쓸 자리(nullable 컬럼)까지 갖춘 모범적 문서다. 필터에 SQLSTATE 매핑을 넣지 않는 이유까지 설명해 "왜 이렇게 안 했는가" 도 남겼다.
- `CHANGELOG.md:26-36` 항목은 criteria(`CHANGELOG.md` 상단 "제품 동작이 바뀐다" — API 에러 코드 변화)를 충족하고, 43필드·409→400·200→400(경로 삭제) 세 가지 구체적 사례를 실측(e2e 로그)과 정확히 일치시켜 적었다.
- `codebase/backend/src/modules/users/dto/update-me.dto.spec.ts:34-35` 에 추가된 인라인 주석은 "왜 기존 테스트가 통과를 고정했는지" 와 "OS 따르기는 null 이 아니라 system 값" 이라는 도메인 지식을 정확히 설명 — 오래된 주석 남기지 않고 바로 갱신했다.
- `codebase/backend/src/repo-guards/__tests__/patch-null-rejection.spec.ts:20-31` docblock 은 "새 필드는 자동으로 들어오지 않는다" 는 한계를 스스로 명시해 다음 사람이 표를 과신하지 않도록 했다.
- `plan/in-progress/patch-null-validation.md` 는 전수 조사·처방·범위·테스트 설계·실측·뮤턴트 결과·`--impl-prep` 처분까지 3섹션 구성 규약을 충실히 따르며, 체크리스트가 실제 상태(`/ai-review`·`--impl-done` 미체크)와 정확히 일치한다.
- 신규 e2e/unit 테스트 파일 21개는 프롬프트 크기 제한으로 전체 컨텍스트가 실리지 않은 곳이 있었으나(`integration.dto.ts`, `knowledge-base` DTO, `patch-null-rejection.spec.ts`, `patch-null-rejection.e2e-spec.ts`, plan 파일 2건), diff 청크만으로 판단 가능한 범위에서 문서화 결함을 찾지 못했다.

## 저장소 상태

리뷰 중 저장소 파일을 수정하지 않았다(뮤테이션 없음). `Read`/`grep` 만 사용.

## 요약

이 PR 은 문서화 관점에서 전반적으로 높은 완성도를 보인다 — CHANGELOG 항목이 정확하고 기준에 부합하며, 신규 데코레이터의 JSDoc 이 "왜"까지 설명하고, 테스트 docblock 이 스스로 한계를 명시하며, plan 문서와 consistency-check 트래커가 이미 두 건의 spec 모호성(§5.4 tri-state 범위, 공용 헬퍼 spec `code:` 미등재)을 정확히 짚어 planner 백로그로 넘겨 두었다. 유일하게 새로 지적할 만한 갭은 `update-trigger.dto.ts` 의 `endpointPath` 필드 — 이미 상세히 관리되는 JSDoc/Swagger 주석인데도 이번 PR 이 CHANGELOG 에 콕 집어 설명한 "null 로 인한 조용한 경로 삭제 → 400" 변경을 반영하지 않아, 코드를 직접 읽는 다음 사람에게는 그 사실이 보이지 않는다.

## 위험도

LOW
