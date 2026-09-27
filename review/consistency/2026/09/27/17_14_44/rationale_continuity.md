# Rationale 연속성 검토 — `spec/2-navigation/` (--impl-prep, patch-null-validation)

## 검토 방법

`target` 은 `spec/2-navigation/` 번들(프롬프트에 15개 파일이 컨텍스트 예산 초과로 절단돼 있어
`Read` 로 직접 원본을 열어 보강)이고, 실제 변경 동인은
`plan/in-progress/patch-null-validation.md`(PATCH 21라우트의 NOT NULL 필드에 `null` 전송 시
500/오동작 나던 43필드를 `@IsOptional()` → `IsOptionalNonNull()` 로 바꿔 400 `VALIDATION_ERROR`
로 조기 거부)다. `spec_impact: none` 이므로 target 문서 자체는 바뀌지 않는다 — 이 계획이
`spec/2-navigation/` 에 이미 박혀 있는 Rationale·설계 원칙과 충돌하는지, 과거 기각된 대안을
말없이 되살리는지를 검사했다.

대상 43필드(A 38 + D 5)를 spec/2-navigation 각 문서(2-trigger-list · 1-workflow-list ·
3-schedule · 6-config · 4-integration · 5-knowledge-base · 9-user-profile)의 해당 PATCH
절·Rationale 과 하나씩 대조했고, 공용 tri-state 계약의 SoT인
`spec/5-system/2-api-convention.md §5.4`(프롬프트에서는 예산 초과로 누락돼 원본을 직접 읽음)도
함께 확인했다.

## 발견사항

### 없음 (CRITICAL/WARNING 없음)

기각된 대안 재도입·원칙 위반·무근거 번복·invariant 우회 어느 항목에도 해당하는 사례를 찾지
못했다. 오히려 이 계획은 기존 Rationale 을 적극적으로 준수하도록 설계돼 있다:

- **§5.4 tri-state 원칙과 정합.** `spec/5-system/2-api-convention.md §5.4` 는 "요청 바디는
  §5.4 표현 규칙의 대상이 아니다 — PATCH 는 키 생략(불변)·`null`(초기화)·값(설정)의 tri-state 이며,
  `null` 이 뜻을 가지는 필드는 `field?: T | null` + `nullable: true` 로 선언하라" 고 명시하고
  `UpdateAssistantSessionDto.llmConfigId`("null 전달 시 workspace default 로 폴백")를 선례로
  든다. 계획은 이 경계를 코드 주석에도 그대로 옮겨 적었다
  (`codebase/backend/src/common/utils/optional-non-null.ts`: "쓰지 말아야 할 자리 — 컬럼이
  nullable 이고 null 이 «값을 지운다» 는 뜻인 필드... API 규약 §5.4 의 PATCH tri-state").
  실제로 `UpdateAssistantSessionDto` 안에서도 `llmConfigId`(tri-state, 유지)와 `status`(A,
  변경 대상)를 정확히 분리해 다루고 있어 같은 DTO 안에서도 축이 섞이지 않는다.
- **null-이 유효한 필드는 전부 스코프 밖으로 빠져 있다.** `triggers.authConfigId`
  ("`null` = 인증 없음", R-14/R-15 SoT), `folders.parentId`("`parentId: null` 로 루트 이동은
  항상 허용", 코드 `UpdateFolderDto` 확인), `workspaces settings.timezone`("빈 문자열은 설정
  해제" — `9-user-profile.md §6.1`), `workspaces settings.interactionAllowedOrigins`("빈
  배열=추가 origin 없음")는 모두 이 PR 의 43필드 목록에 없거나(전자 둘), null 자체를 거부하고
  기존에 문서화된 "지우기는 빈 문자열/빈 배열" 경로는 그대로 둔다(후자 둘, D-3/D-4). spec 이
  이미 선언한 "null 이 아니라 다른 sentinel 로 지운다" 라는 결정을 이 계획이 뒤집지 않는다.
- **필터 레벨 매핑을 다시 채택하지 않는다.** 계획은 `plan/in-progress/keyset-cursor-uuid-validation.md`
  §A 가 "`GlobalExceptionFilter` 에서 SQLSTATE 를 400 으로 일괄 매핑" 을 이미 기각한 것을
  인용하며 같은 이유(필터는 값의 출처를 모른다 — `spec/5-system/3-error-handling.md §1.3`
  `VALIDATION_ERROR`/`X-Workspace-Id` 행이 이미 세운 원칙과 같은 축)로 입구(DTO)단 조기 거부를
  택한다 — 과거 기각된 대안을 되살리지 않고 오히려 그 판례를 정확히 재적용한 사례다.
- **Import 의 permissive config 정책과 축이 다르다.** `1-workflow-list.md ## Rationale 2` 는
  `POST /api/workflows/import` 의 노드 `config` 파싱 실패를 관용적으로(raw 보존) 처리하는
  정책을 정의하지만, 이는 **JSON 가져오기의 스키마 파싱 실패**에 대한 정책이고 이 계획이 다루는
  **`PATCH /api/nodes/:id { config: null }`(값 자체가 없음)** 과는 다른 입구·다른 실패 모드다.
  같은 문서 안에서도 `settings`(admission-gate 파라미터)는 이미 hard-fail 로 분리해 둔 선례가
  있어("노드 `config`(soft)와 달리 workflow-level 실행 파라미터는... hard-fail"), 필드 성격별로
  strict/permissive 를 구분하는 것 자체가 이미 이 문서의 관행이다.
- **에러 코드 taxonomy 도 신설이 아니라 재사용.** 400 `VALIDATION_ERROR` + `details[].field` 는
  `spec/5-system/3-error-handling.md §1.3` 이 이미 표준으로 못 박은 형태이며, 이 계획은 새 에러
  코드를 만들지 않는다.

## INFO — 관찰 (비차단)

- **[INFO] `interactionAllowedOrigins` PATCH 바디 표기의 `?` 누락 — target 위치**:
  `spec/2-navigation/9-user-profile.md` §6.1 (`PATCH /api/workspaces/:id/settings` 행).
  `body { interactionAllowedOrigins: string[]; timezone?: string }` 로 적혀 있어
  `timezone?` 과 달리 `interactionAllowedOrigins` 는 물음표가 없다 — 실제 DTO
  (`update-workspace-settings.dto.ts`)는 `@IsOptional() interactionAllowedOrigins?: string[]`
  로 완전히 선택적이고 JSDoc 도 "미전송 시 기존 값 보존(partial patch)" 이라 명시한다. Rationale
  번복은 아니고(문서·코드 어느 쪽도 null 의미를 바꾸지 않는다) 이 PR 이 바로 이 필드(D-3,
  `null.map` TypeError)를 건드리므로, 후속 spec 정비 시 `?` 를 붙여 tri-state 표기를 정확히
  하는 것을 제안한다. `spec_impact: none` 판단 자체는 유효하다 — OpenAPI 선언은 이미 옳고
  런타임만 느슨했다는 이 PR 의 전제와 무관한, 별도의 표기 사소 오류다.
- **[INFO] 자매 검증 원칙의 명시적 상호 참조 제안**: `spec/5-system/2-api-convention.md §5.4`
  본문 자체가 "요청 바디는 대상이 아니다" 단서를 상당히 조밀한 한 문단에 응축해 두고 있고,
  이번 조사에서도 orchestrator 번들이 컨텍스트 예산으로 이 문서를 실제로 누락했다(다른
  reviewer 도 같은 누락을 겪을 수 있다). 이 PR 이 완료되면 `IsOptionalNonNull()` 데코레이터를
  `spec/5-system/2-api-convention.md §5.4` 의 "검증 층" 표에 (선택적으로) 추가해, 다음 사람이
  "왜 어떤 NOT NULL 필드는 `@IsOptional()`, 어떤 것은 `IsOptionalNonNull()` 인가" 를 코드
  주석이 아니라 spec 검증-층 표에서도 찾을 수 있게 하는 안을 고려할 만하다 — 다만 이는 개선
  제안이지 이번 검토의 결함 지적은 아니다.

## 요약

`plan/in-progress/patch-null-validation.md` 가 계획한 43필드 PATCH null-validation 강화는
`spec/2-navigation/` 각 문서의 Rationale·API 계약과 충돌하지 않는다. 오히려 이 계획은
`spec/5-system/2-api-convention.md §5.4` 의 PATCH tri-state 원칙(키 생략=불변·null=초기화·값=설정)을
정확히 이해하고, null 이 실제로 의미를 갖는 필드(`authConfigId`·`llmConfigId`·`parentId`·
`timezone`·`interactionAllowedOrigins`)는 전부 스코프 밖에 남긴 채 "OpenAPI 가 이미
non-nullable 이라고 선언했는데 런타임 검증이 느슨했던" 43개 필드만 좁혀 고친다. 필터 레벨
SQLSTATE 매핑 기각이라는 인접 판례도 다시 채택하지 않고 그대로 계승한다. `spec_impact: none`
선언도 타당하다 — 이 변경은 이미 선언된 계약을 실제로 강제하는 것이지 계약을 바꾸는 것이
아니다. 발견한 두 건은 모두 INFO 로, 차단 사유가 아니라 후속 문서 정비 제안이다.

## 위험도

NONE
