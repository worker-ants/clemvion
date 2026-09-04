# Cross-Spec 일관성 검토 — spec/5-system (impl-done)

## 검토 범위 요약

`spec/5-system/**` 자체의 델타는 0파일(정상 — 이 브랜치는 spec 을 바꾸지 않았다). 실제
검토 대상은 `origin/main...HEAD` 의 codebase 변경 8파일(`git diff origin/main...HEAD --
codebase/` 로 직접 재확인, 640+45줄):

- `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts`
- `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts`
- `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` (+`.spec.ts`)
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` (신규, +`.spec.ts`)
- `codebase/backend/src/common/__test-utils__/temp-fixture.ts` (신규, +`.spec.ts`)

핵심은 OpenAPI(`@ApiProperty`/`@ApiPropertyOptional`) 선언과 TS 타입(`?`/`| null`) 간
불일치("계약 거짓") 9곳 수정 + 그 축을 지키는 신규 AST 가드. 이 회차 직전 code-review
세션(`review/code/2026/09/04/11_02_30/`)이 이미 architecture/maintainability/testing 등
9개 관점에서 코드 레벨 결함을 훑었고 전부 조치됐다(RESOLUTION.md 확인) — 아래는 그 리뷰가
다루지 않은 **spec-vs-spec / spec-vs-code 교차** 관점에 한정한다.

---

## 발견사항

### [WARNING] `2-api-convention.md` §5.4 "DTO 선언 형태" 규칙이 응답 전용인데, 요청(PATCH) DTO 의 tri-state 패턴과 경계가 불명확하다

- **target 위치**: `spec/5-system/2-api-convention.md` §5.4(라인 1122~1152, `## 5. 응답 형식`
  하위) — "DTO 선언이 wire 를 반영해야 한다" 규칙: *"키를 생략하는 필드 → `@ApiPropertyOptional()`
  + `field?: T` (`| null` 금지)"* / *"`null` 을 쓰는(상시 존재) 필드 → `@ApiProperty({ nullable:
  true })` + `field: T | null`"*. 이번 diff 의 `CHANGELOG.md` 신규 항목("`create-assistant-
  session.dto.ts` `llmConfigId`")이 "형태는 [API 규약 §5.4] 를 따랐다" 라고 명시적으로 이
  절을 인용한다. 신규 가드 `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-
  guard.ts` 의 docstring 도 이 절을 SoT 로 인용하며, request/response 구분 없이
  `collectTsFiles(SRC_ROOT)` — backend `src` 전체 — 를 스캔한다.

- **충돌 대상**:
  - `codebase/backend/src/modules/workflow-assistant/dto/update-assistant-session.dto.ts`
    (동일 필드 `llmConfigId?: string | null` + `@ApiPropertyOptional({ nullable: true })`,
    주석 "Allow explicit null to clear the pinned config" — 명시적 PATCH tri-state)
  - 저장소 전역 `update-*.dto.ts` 류(`update-node.dto.ts`, `update-trigger.dto.ts`,
    `update-workflow.dto.ts` 등, `grep -l "ApiPropertyOptional({" ... | xargs grep -l
    "nullable: true"` 로 20여 곳 확인) — 동일하게 optional+nullable 조합
  - `plan/in-progress/spec-draft-nullable-notation-followups.md` §③ 및 "§5.4 drift 배치"
    후속 항목(라인 216~246) — 이 조합(`@ApiPropertyOptional({nullable:true})+field?:T|null`)을
    **§5.4 신규 문면과 어긋나는 "구형(drift)"** 로 명시 분류하고, "새 가드는 이 형태를 잡지
    않는다 — 판정은 필드별 의미 판단이라 기계화되지 않는다" 고 스스로 적어 둔 채 **104곳**
    일괄 마이그레이션을 미착수 백로그로 남겨 두었다.

- **상세**: §5.4 는 "## 5. 응답 형식" 하위 절이고 본문도 "**한 응답 안에** 섞여도 무방하나"
  라고 응답 바디를 전제한다. 그런데 이번 diff 가 고친 `llmConfigId` 는 **요청** DTO
  (`CreateAssistantSessionDto`) 필드이고, 그 자매 `UpdateAssistantSessionDto` 는 **키
  생략(=값 불변)과 명시적 `null`(=초기화)이 서로 다른 의미를 갖는 tri-state** 를 의도적으로
  쓴다 — 이는 응답의 "상시 존재 vs 키 생략" 이분법과 무관한, PATCH 요청 특유의 패턴이다.
  그런데:
  1. §5.4 자체엔 "본 절은 응답 바디 한정" 이라는 명시적 스코프 문구가 없다(섹션 nesting
     으로만 암시).
  2. 신규 가드는 request/response 를 구분하지 않고 스캔하며, §5.4 를 presence·null 두
     축의 SoT 로 인용하면서도 실제로는 "optional+nullable 조합 금지" 를 **강제하지 않는다**
     (`swagger-dto-contract.spec.ts` 의 "[대조군] null 축" 테스트가 이 조합을 명시적으로
     "안 잡는다" 로 단언).
  3. plan 문서(`spec-draft-nullable-notation-followups.md`)는 이 조합을 "§5.4 신문면과
     어긋나는 104곳 drift" 로 분류해 향후 `@ApiProperty({nullable:true})` + **non-optional**
     로 일괄 전환하는 배치 작업을 등재해 두었는데, 이 전환을 `update-*.dto.ts` 류의 PATCH
     tri-state 필드에 기계적으로 적용하면 `?` 가 사라져 **"필드 생략 = 값 불변" 의미가
     깨진다** — 부분 업데이트 계약이 강제 required 로 바뀌는 실제 회귀다. plan 자체가
     "필드별 의미 판단이 필요하다" 고 적어 위험을 완전히 못 본 것은 아니지만, "요청 PATCH
     바디는 이 배치에서 카테고리째 제외" 라는 구조적 경계가 §5.4 본문에도 plan 항목에도
     없다 — 사람이 104곳을 하나씩 판단해야 하는 상태로 남아 있다.
  4. 이번 diff 의 CHANGELOG 문구("형태는 §5.4 를 따랐다")는 이 필드가 §5.4 신문면상
     "compliant" 라고 읽히지만, 실제로는 plan 문서가 스스로 이 정확한 조합을
     "drift(구형)" 로 분류해 별도 배치 대상에 올려 둔 상태라 — 고쳐진 것은 "OpenAPI
     선언과 TS 타입의 내부 일치"(계약 거짓 9곳 클래스) 뿐이고, "이 필드가 `@ApiProperty`
     여야 하는가 `@ApiPropertyOptional` 이어야 하는가" 라는 §5.4 의 DTO-형태 축 판정은
     아직 미해결로 남아 있다. 두 문서(코드가 인용하는 §5.4, 그리고 같은 세션의 plan 트래커)
     가 "이 필드는 §5.4 를 따른다" 와 "이 필드는 §5.4 신문면과 어긋나는 104곳 중 하나다"
     라는 **서로 다른 결론**을 각각 시사한다.

- **제안**:
  1. `spec/5-system/2-api-convention.md` §5.4 본문에 "본 절(특히 DTO 선언 형태 규칙)은
     응답 바디에 적용된다. 요청 바디(PATCH 등)의 부분 업데이트 tri-state(키 생략=불변,
     `null`=초기화, 값=설정)는 이 절의 적용 대상이 아니며 optional+nullable 조합이 정당
     하다" 는 명시적 스코프 문구를 추가한다(`## 4. 요청 형식` 아래 짧은 절 신설도 대안).
  2. `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "§5.4 drift 배치"
     항목에 "PATCH/부분 업데이트 요청 DTO(`update-*.dto.ts` 류)는 이 마이그레이션에서
     카테고리째 제외 — optional+nullable 유지가 의도" 를 구조적 예외로 명문화해, 104곳을
     전수 수동 판단하지 않아도 되게 한다.
  3. 이번 diff 의 `CHANGELOG.md` 문구는 정확히는 "OpenAPI-TS 내부 일치만 고쳤고, DTO 형태
     자체는 §5.4 drift 배치의 미해결 대상으로 남아 있다" 로 세분화하면 향후 배치 착수 시
     `llmConfigId` 를 "이미 해결됨" 으로 오인해 건너뛰지 않는다.

---

## 요약

이번 diff(spec/5-system 코드 영역의 Swagger DTO 계약 정합화 9곳 + 신규 AST 가드)는 실제
구현 대상인 `spec/5-system/2-api-convention.md` §5.4·`spec/4-nodes/1-logic/12-background.md`
(background-run 응답 shape)와 완전히 정합적으로 확인됐다 — `background-run-response.dto.ts`
8필드 수정은 두 문서의 "always-present + null" 서술과 정확히 일치한다. 유일한 교차 우려는
`create-assistant-session.dto.ts` `llmConfigId` 수정이 §5.4 를 "따랐다" 고 표현하지만, §5.4
가 응답 전용 절이면서도 request DTO 를 함께 인용·스캔하는 신규 가드와, 같은 세션의 plan
트래커가 이 정확한 필드 형태를 "104곳 미해결 drift" 로 분류해 둔 사실 사이에 스코프 경계가
문서화돼 있지 않다는 점이다. 즉시 기능 장애는 없으나(가드가 조합 금지를 강제하지 않으므로
현재는 통과), 향후 "§5.4 drift 배치" 가 PATCH tri-state 필드까지 기계적으로 전환하면 부분
업데이트 계약이 깨질 수 있어 명시적 스코프 결정이 필요하다.

## 위험도

LOW
