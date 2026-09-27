# Cross-Spec 일관성 검토 — `patch-null-validation` (`--impl-prep`, scope=`spec/2-navigation/`)

## 검토 대상 요약

`plan/in-progress/patch-null-validation.md` — PATCH 21 라우트 중 NOT NULL 컬럼/필수 값에 대응하는
43 필드의 `@IsOptional()` 을 `@IsOptionalNonNull()` 로 바꿔, `null` 을 400 `VALIDATION_ERROR` 로
거부한다. `spec_impact: none`. 대상 필드 중 `spec/2-navigation/` 소관은 `triggers`(name·isActive·
endpointPath) · `workflows`(name·isActive·tags) · `folders`(name·sortOrder) · `schedules`(isActive·
parameterValues) · `workspaces settings`(interactionAllowedOrigins·timezone) · `alerts`(threshold·
window·channel·enabled) 다.

각 필드를 `spec/1-data-model.md`(컬럼 타입·nullable 여부) · `spec/2-navigation/2-trigger-list.md`
· `1-workflow-list.md` · `3-schedule.md` · `9-user-profile.md` (해당 부분은 bundle 절단으로 직접
`grep`/`Read` 로 확인) 와 대조했다. 결론: 43 필드 어디에도 "null 을 보내면 초기화/특정 의미로
동작한다" 는 **명시적 계약이 spec/2-navigation/ 안에 없다** — 오히려 `2-trigger-list.md §3` 는
"top-level 키는 모두 optional(=생략 가능)" 이라 적으면서 그중 **`authConfigId` 에만** "`null`
허용" 을 명시해, null 계약이 **필드별로 opt-in** 임을 이미 스스로 말하고 있다(§3 註, plan D-2 가
그대로 인용). `workspaces.settings.timezone`/`interactionAllowedOrigins` 도 "빈 문자열/빈 배열 =
해제" 라는 **이미 문서화된 별도 클리어 값**이 있고, plan 은 그 값은 건드리지 않은 채 `null` 만
막는다(`9-user-profile.md:371`, `data-flow/12-workspace.md:162`). 즉 필드 단위로 보면 이 PR 은
spec/2-navigation/ 과 **충돌하지 않고 오히려 그 문서가 이미 적어 둔 경계를 코드로 집행**하는
방향이다.

다만 그 필드별 정합성의 **상위 근거**로 쓰이는 시스템 공통 규약 문서 한 곳에 범위가 모호한
문장이 있어 아래에 WARNING 으로 남긴다.

## 발견사항

- **[WARNING]** `spec/5-system/2-api-convention.md` §5.4 의 PATCH tri-state 서술이 "선언된
  nullable 필드에만 적용" 인지 "모든 PATCH 필드에 적용" 인지 문면상 갈린다 — 43 필드 null 거부와
  글자 그대로는 충돌 가능
  - target 위치: `plan/in-progress/patch-null-validation.md` §처방 3번째 불릿(*"null 을 «기본값으로
    초기화» 로 해석하지 않는다"*) — 이 plan 이 §5.4 를 인용하며 스스로 좁게 해석하는 자리
  - 충돌 대상: `spec/5-system/2-api-convention.md:278` §5.4 블록쿼트 — *"적용 범위 — 응답
    바디... 요청 바디는 대상이 아니다 — **특히 PATCH 부분 업데이트는 키 생략(=값 불변)·`null`
    (=초기화)·값(=설정)의 tri-state 가 각각 의미를 갖는 별개 계약이라**..."*
  - 상세: 이 문장을 문자 그대로 읽으면 "PATCH 부분 업데이트"(전체 범주)에 대해 `null`=초기화가
    성립하는 것처럼 읽힌다. 그런데 실제로 이 문장이 존재하는 이유(바로 다음 문장)는 응답 DTO
    선언 규칙(`?` 제거)을 요청 DTO 에 그대로 적용하면 안 된다는 것을 설명하기 위함이고, 예시로
    든 `UpdateAssistantSessionDto.llmConfigId` 는 **애초에 `nullable: true` 로 선언된 필드**다.
    이 PR 이 다루는 43 필드는 정확히 그 **반대** 축 — OpenAPI 가 `nullable` 을 선언하지 **않은**
    필드(plan 원문: *"이 필드들은 OpenAPI 가 이미 nullable 이 아니라고 광고한다"*) — 이고, plan 은
    "tri-state 는 null 을 **받는** 필드의 계약" 이라고 **암묵적으로 좁혀 해석**해서 43 필드에는
    적용되지 않는다고 결론 낸다. 이 좁은 해석은 필드별 실측(§2.3.1 매트릭스·§3 註·nullable 컬럼
    선언)과는 전부 부합하지만, §5.4 원문은 그 좁힘을 **명시하지 않는다** — "tri-state 가 각각
    의미를 갖는 별개 계약" 이라는 카테고리 진술이 "PATCH 부분 업데이트" 단위로 읽히는지 "null 을
    선언한 필드" 단위로 읽히는지는 다음 사람이 또 판단해야 하는 채로 남는다. 지금은 프런트가 43
    필드 중 어디에도 null 을 보내지 않아(plan §범위 "프런트 소비처: 0") 실제로 깨지는 소비자가
    없지만, 문서 자체의 범위 선언이 이 PR 의 근거보다 넓게 읽힐 수 있다는 점에서 "문서한 보장이
    구현보다 넓다" 패턴에 해당한다.
  - 제안: `spec/5-system/2-api-convention.md` §5.4 블록쿼트에 한 문장을 보태 tri-state 의
    `null`=초기화 분기가 **`nullable: true` 로 선언된(=null 을 받기로 한) 필드에만** 적용되고,
    선언되지 않은 필드에 대한 `null` 은 400 `VALIDATION_ERROR` 라는 것을 명시한다(이 PR 이 정확히
    그 명시를 코드로 만드는 사례이므로 인용하기 좋다). 이 편집은 developer 권한 밖(§`spec/` 읽기
    전용)이므로, 이번 PR 의 `spec_impact: none` 을 그대로 두더라도 트래커
    (`plan/in-progress/spec-draft-nullable-notation-followups.md`, 이미 §5.4 자기모순 항목을 다루고
    있는 문서)에 이 항목을 등재해 planner 턴에서 §5.4 범위를 좁히는 것을 권한다. CRITICAL 로
    올리지 않은 이유: 현재 어떤 소비자도 이 43 필드에 null=초기화를 기대해 보내고 있지 않아
    (plan 실측), 즉시 깨지는 동작은 없다 — 문서 표현의 모호성 정리 문제다.

## 요약

`spec/2-navigation/` 스코프의 개별 필드(트리거 name/isActive/endpointPath, 워크플로 name/isActive/
tags, 폴더 name/sortOrder, 스케줄 isActive/parameterValues, 워크스페이스 settings, 알림 규칙
threshold 등) 는 데이터 모델(`spec/1-data-model.md`)·API 문서(`2-trigger-list.md`·`1-workflow-list.md`·
`3-schedule.md`·`9-user-profile.md`) 어디에서도 `null` 을 통한 초기화·특수 의미를 계약하지 않으며,
오히려 `authConfigId`(트리거)·빈 문자열/빈 배열(워크스페이스 settings) 처럼 **명시적으로 다른
클리어 값**을 이미 문서화해 두었다 — 이 PR 은 그 경계와 정확히 일치하는 방향으로 코드를 좁힌다.
유일한 잔여 리스크는 상위 규약 문서(`api-convention.md §5.4`)의 PATCH tri-state 서술이 "null=
초기화" 의 적용 범위를 필드 단위로 명시하지 않아, 문자 그대로 읽으면 이번 43 필드 null-거부와
외견상 부딪히는 것처럼 보일 수 있다는 문서 정밀도 문제이며 — 실제 동작·기존 하위 spec 문서와는
충돌하지 않는다. RBAC·상태 전이·요구사항 ID·계층 책임 축에서는 이번 변경과 관련된 충돌을
찾지 못했다.

## 위험도

LOW
