# Rationale 연속성 검토 — `spec/2-navigation/` (--impl-done, patch-null-validation)

## 검토 방법

이 라운드의 "target"은 `spec/2-navigation/` 이지만 그 영역의 spec 델타는 0개다(`spec_impact: none`).
실제 변경 동인은 `plan/in-progress/patch-null-validation.md` — PATCH 21라우트의 NOT NULL 컬럼에
대응하는 43개 필드에서 `@IsOptional()` → `IsOptionalNonNull()` 로 바꿔 `null` 을 400
`VALIDATION_ERROR` 로 조기 거부하게 한 변경이다(`codebase/backend/src/common/utils/optional-non-null.ts`
신설). HEAD 워킹트리에서 `git diff origin/main...HEAD` 로 전체 diff(19파일)를 직접 대조했고,
`spec/5-system/2-api-convention.md §5.4`(부재 표현 — `null` vs 키 생략, 프롬프트 번들에서는 예산
초과로 절단돼 원본을 직접 읽음)와 `spec/2-navigation/{1-workflow-list,2-trigger-list,3-schedule}.md`
의 `## Rationale`, 그리고 `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커를
함께 확인했다.

## 발견사항

### [WARNING] §5.4 PATCH tri-state 문구가 "미선언 필드의 null" 을 다루지 않아 문자 그대로는 이 PR 과 부딪혀 보인다 (이미 트래커에 등재된 미해소 항목)

- target 위치: 해당 사항 없음 (`spec/2-navigation/` 델타 0) — 실제 충돌 지점은
  `codebase/backend/src/common/utils/optional-non-null.ts` + 43개 DTO 필드(`git diff
  origin/main...HEAD` 전체)
- 과거 결정 출처: `spec/5-system/2-api-convention.md §5.4` 상단 블록쿼트 — *"PATCH 부분
  업데이트는 키 생략(=값 불변)·`null`(=초기화)·값(=설정)의 tri-state 가 각각 의미를 갖는 별개
  계약"* 이라 선언하고, 선례로 `UpdateAssistantSessionDto.llmConfigId`("null 전달 시 workspace
  default 로 폴백")를 든다.
- 상세: §5.4 는 이 tri-state 서술에 "null 이 의미를 갖는(=선언된 nullable) 필드에 한정"이라는
  경계 문장을 두지 않는다. 문자 그대로 읽으면 "PATCH 요청의 `null` = 초기화"가 일반 원칙처럼
  보이는데, 이번 PR 은 정확히 그 반대 — 43개 필드에서 `null` 을 초기화가 아니라 **400 거부**로
  바꾼다. 실제로는 이 PR 이 다루는 43개 필드가 애초에 OpenAPI 상 non-nullable 로 선언돼 있었고
  런타임 검증만 느슨했던 경우들이라 §5.4 의 tri-state 대상(선언된 nullable 필드)과 겹치지
  않는다 — 즉 **설계 자체는 §5.4 의 취지(선언과 런타임이 일치해야 한다)를 정확히 따른다.**
  실제로 tri-state 가 적용되는 필드들(`triggers.authConfigId` = null→인증 없음,
  `UpdateAssistantSessionDto.llmConfigId` = null→workspace default,
  `folders.parentId` = null→루트 이동, `workspaces settings.timezone`/`interactionAllowedOrigins`
  = 빈 문자열/빈 배열로 지움)은 전부 이번 43필드 목록에서 제외돼 있고, 코드 주석
  (`optional-non-null.ts`: *"쓰지 말아야 할 자리: 컬럼이 nullable 이고 null 이 «값을 지운다»
  는 뜻인 필드 — 거기는 `@IsOptional()` + `nullable: true` 가 맞다(API 규약 §5.4 의 PATCH
  tri-state)"*)도 이 경계를 명시적으로 인지하고 있다. 따라서 **구현이 §5.4 의 원칙을 위반한 것이
  아니라, §5.4 의 "미선언 필드는 어떻게 하나" 라는 문장 부재가 드러난 것**이다.
  이 gap 은 이번 세션이 처음 발견한 것이 아니라 같은 PR 의 `--impl-prep` 단계
  (`review/consistency/2026/09/27/17_14_44` cross_spec W2)에서 이미 WARNING 으로 지적됐고,
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 미해소 체크리스트 항목
  ("`spec/2-navigation/` 목록 API 둘의 응답 형태 · 완료된 `pending_plans`" 항목 하위 (10))에
  planner 몫으로 등재돼 있다(*"§5.4 블록쿼트의 PATCH tri-state «null = 초기화» 는 nullable 로
  선언된 필드에만 적용되고 미선언 필드의 null 은 400 VALIDATION_ERROR 라는 문장이 없다 — 글자
  그대로는 patch-null-validation 의 null 거부와 부딪혀 보인다. 한 문장 추가."*). spec 파일
  자체는 아직 그 한 문장을 반영하지 않았으므로 이 WARNING 은 spec 텍스트 기준으로는 여전히
  살아 있다 — 다만 **새로 발견된 결함이 아니라 이미 트래커·plan 체크리스트에 정직하게 옮겨진
  기존 항목**이다.
- 제안: 별도 조치 불필요(이미 추적 중, 이 PR 을 막을 사유 아님). planner 턴에서
  `spec/5-system/2-api-convention.md §5.4` 블록쿼트에 "미선언(non-nullable) 필드에 온 `null`
  은 400 `VALIDATION_ERROR` 로 거부한다" 한 문장만 추가하면 해소된다 — 트래커 항목 (10)이
  이미 정확한 처방을 담고 있다.

## INFO — 관찰 (비차단, 이미 트래커에 함께 등재)

- **[INFO] `interactionAllowedOrigins` PATCH 바디 표기 `?` 누락** — `spec/2-navigation/9-user-profile.md`
  §6.1 이 `body { interactionAllowedOrigins: string[]; timezone?: string }` 로 적어 `timezone?`
  과 달리 물음표가 없다. 실제로는 완전히 optional(`@IsOptionalNonNull() interactionAllowedOrigins?: string[]`,
  이번 PR 이 `null.map` TypeError 를 막은 바로 그 필드)이라 사실 정정 대상이지 Rationale 번복은
  아니다. 위 WARNING 과 같은 트래커 항목 (10)에 함께 등재돼 있다.
- **[INFO] 검증 층 표에 신규 헬퍼 미등재** — `spec/5-system/2-api-convention.md §5.4` "검증 층"
  표에 `optional-non-null.ts` 를 추가하면 다음 사람이 "왜 어떤 NOT NULL 필드는 `@IsOptional()`,
  어떤 것은 `IsOptionalNonNull()` 인가"를 spec 에서 바로 찾을 수 있다 — 이 또한 개선 제안이며
  이번 PR 의 결함은 아니다.

## 확인했으나 문제 없음 (반증 근거로 남김)

- **기각된 대안 재도입 없음**: `plan/in-progress/patch-null-validation.md` 는 필터(GlobalExceptionFilter)
  단에서 SQLSTATE 를 400 으로 매핑하는 안을 `keyset-cursor-uuid-validation.md §A` 가 이미 기각한
  것을 명시적으로 인용하며 그 판례를 그대로 따른다(입구 DTO 단 조기 거부) — 기각된 대안을
  말없이 되살리지 않는다.
- **폴더 계층 무결성 Rationale(§3, 2026-07-05)과 충돌 없음**: `folders.parentId` 는 이번 43필드
  목록에서 제외돼 여전히 `@IsOptional()` + `null`(=루트 이동) 을 허용한다 — 현재 코드
  (`update-folder.dto.ts`) 로 직접 확인.
- **Import permissive config 정책(§2)과 축이 다름**: 그 정책은 `POST /api/workflows/import` 의
  JSON 스키마 파싱 실패를 다루고, 이번 PR 은 `PATCH /api/nodes/:id { config: null }`(값 자체의
  부재)를 다룬다 — 다른 입구·다른 실패 모드라 번복이 아니다.
- **트리거 `endpointPath` mutable 결정과 충돌 없음**: 기존 "webhook endpointPath 는 변경
  가능"이라는 설계는 그대로 유지된다. 이번 변경은 그 필드의 **가변성**을 바꾸는 것이 아니라
  `null` 전송 시 조용히 200 으로 웹훅 수신 경로가 지워지던 버그를 400 거부로 막는 것뿐이다
  (`update-trigger.dto.ts` 코드 주석에도 "종전 `@IsOptional()` 은 null 을 통과시켜 웹훅 수신
  경로가 200 과 함께 조용히 지워졌다"고 명시).
- **`UpdateAssistantSessionDto` 내부 두 필드 분리 확인**: 같은 DTO 안에서 `llmConfigId`(tri-state,
  변경 없음, `@ValidateIf` 유지)와 `status`(A, `IsOptionalNonNull` 로 변경)를 정확히 분리해
  §5.4 의 취지대로 필드별 근거를 유지한다.

## 요약

이번 PR(43개 PATCH 필드의 `@IsOptional()` → `IsOptionalNonNull()`)은 spec/2-navigation 각
문서의 Rationale·API 계약을 위반하지 않으며, 오히려 `spec/5-system/2-api-convention.md §5.4`
의 PATCH tri-state 원칙을 필드 단위로 정확히 구분해 적용한다 — null 이 실제로 의미를 갖는
필드(`authConfigId`·`llmConfigId`·`parentId`·`timezone`·`interactionAllowedOrigins`)는 전부
스코프 밖에 남기고, 원래 non-nullable 로 선언됐던 필드의 런타임 검증 누락만 좁혀 고친다. 유일한
WARNING 은 §5.4 텍스트 자체가 "선언된 nullable 필드에 한정"이라는 경계 문장을 아직 담고 있지
않아 문자 그대로는 이 PR 과 부딪혀 보인다는 것인데, 이는 이 세션이 새로 발견한 문제가 아니라
같은 PR 의 `--impl-prep` 단계에서 이미 WARNING 으로 지적돼 `plan/in-progress/spec-draft-nullable-notation-followups.md`
트래커(planner 몫, 항목 10)에 정직하게 등재된 상태다. 코드 자체가 기각된 대안을 되살리거나
합의된 invariant 를 우회하는 사례는 발견되지 않았다.

## 위험도

LOW
