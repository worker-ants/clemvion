STATUS=success rationale_continuity review complete — 0 CRITICAL, 0 WARNING, 1 INFO

===REPORT_MARKDOWN_BELOW===

# Rationale 연속성 검토 — `execute-body-openapi` (impl-prep, scope=spec/5-system/)

## 조사 방법 메모

`--impl-prep` bundle 의 명목 target 은 `spec/5-system/` 폴더 전체(변경 없음, `spec_impact: none`)였으나,
실제로 이번 세션에서 구현 착수 대상은 `plan/in-progress/execute-body-openapi.md` 와 그에 대응하는
코드 diff(`codebase/backend/src/modules/workflows/workflows.controller.ts` +
`codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts` 신설)다. spec 본문 자체는
불변이므로 "target 이 spec Rationale 을 재도입/번복" 하는 경우는 원천적으로 없고, 실질적으로 유의미한
검토는 **이 impl-prep 이 착수하려는 설계가 spec/5-system 및 `spec/conventions/swagger.md` 에 이미
기록된 Rationale·원칙과 충돌하는가**다. 이 관점으로 분석했다.

## 발견사항

- **[INFO]** `@ApiBody` 전용 DTO(파라미터 타입과 분리) 패턴이 `swagger.md` 컨벤션에 아직 등재되지 않음
  - target 위치: `plan/in-progress/execute-body-openapi.md` "핵심 판단" 절 + 신설
    `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts` (전문 docstring) +
    `workflows.controller.ts` 의 `@ApiBody({ type: ExecuteWorkflowDto, required: false })`
    (`@Body()` 파라미터는 인라인 타입 유지)
  - 과거 결정 출처: `spec/conventions/swagger.md` §2-2(Controller 패턴 예시 `async create(@Body() dto: CreateWorkflowDto)`)
    및 §1-4 "예외 — 형태는 고정이나 SoT 이중화 회피로 여는 경우… 이 예외를 쓸 때는 해당 DTO 의
    `## Rationale` 에… 명시" 조항
  - 상세: 현재 코드베이스에서 `@ApiBody({ type })` 를 쓰는 기존 두 선례
    (`llm-model-config.controller.ts` 의 `PreviewModelListDto`, `knowledge-base.controller.ts` 의
    `RetryFailedBodyDto`)는 모두 `@Body()` 파라미터 타입과 `@ApiBody` 의 `type` 이 **동일**하다 —
    `@ApiBody` 는 CLI 플러그인 자동추론에 대한 명시적 보강일 뿐, 파라미터 타입과의 의도적 분리
    사례는 없다. 이번 PR 이 신설하는 "OpenAPI 스키마 전용 DTO(런타임 미검증)" 패턴은 코드베이스에
    선례가 없는 **신규 설계**다. 이 자체가 Rationale 위반은 아니다 — 오히려 `swagger.md` §1-4 가
    이미 제도화한 "기본 패턴에서 벗어날 때는 그 DTO 의 문서에 이유를 명시한다" 는 정신을
    `ExecuteWorkflowDto` 의 docstring 이 충실히 따르고 있고(전역 파이프 스킵 메커니즘·계약 축소 위험·
    캐너리 테스트 근거까지 상세 기술), plan 자체도 트래커([`spec-sync-external-interaction-api-gaps.md`]
    L931-938)에 "DTO 승격이 아니라 `@ApiBody` 만 단다"는 판단 근거를 명시적으로 남겼다. 다만
    `swagger.md` §1(DTO 패턴)/§2(Controller 패턴)은 지금 이 예외 형태(파라미터-스키마 분리)를
    이름 붙여 등재하지 않았으므로, 다음에 비슷한 상황(공개 API 인라인 타입 + 계약 비파괴 문서화)을
    마주치는 사람은 이 사례를 못 찾고 처음부터 다시 판단하거나, 반대로 "타입을 맞추는 게 맞다"며
    캐너리가 지키려는 바로 그 실수(파라미터 타입을 DTO 로 승격)를 저지를 수 있다.
  - 제안: 필수는 아니나, `spec/conventions/swagger.md` §1 또는 §2 에 짧은 절
    ("문서화 전용 DTO — `@Body()` 인라인 타입 유지, 계약 비파괴 필요 시")을 추가해 이 사례를
    참조점으로 남기는 것을 고려. 지금 당장 안 해도 리스크는 낮다 — `ExecuteWorkflowDto`
    docstring 과 plan 이 이미 근거를 충분히 보존하고 있고, 계획된 캐너리 테스트가 회귀를 잡는다.

## 정합성 확인 (충돌 없음으로 판정한 근거)

다음은 검토 관점 1~4 에 해당할 수 있어 보였으나, 실측 결과 **충돌이 없다고 판정**한 항목이다(참고용으로 남긴다):

- **마스킹 마커 거부(`MASKED_VALUE_RESUBMITTED`)는 서비스 레이어 문제이지 `ValidationPipe`/DTO 문제가
  아니다.** `spec/5-system/14-external-interaction-api.md` §R17 은 "구현 위치: 두 호출부는 base
  `resolveTriggerParameters` 가 아니라 wrapper `resolveTriggerParametersRejectingMasked` 를 부른다…
  **base 에 넣지 않은 것은 의도**" 라고 명시한다. 이 가드는 `@Body()` 파라미터 타입이 `Object` 든
  `ExecuteWorkflowDto` 든 무관하게 컨트롤러→서비스 호출 경로에서 동작하므로, 이번 PR 이
  `@Body()` 인라인 타입을 유지해도 이 가드는 그대로 걸린다 — Rationale 이 요구하는 "재제출뿐
  아니라 fresh 입력도 대상" 불변식을 우회하지 않는다.
  - re-run(`POST /executions/:id/re-run`)과 execute(`POST /workflows/:id/execute`) 모두 **같은
    헬퍼**를 쓰며 2026-08-22 부터 같은 `INVALID_TRIGGER_PARAMETERS` 봉투를 낸다는 대칭성도
    이번 변경으로 깨지지 않는다(§1.7 각주, error-handling.md L1547).
- **`forbidNonWhitelisted` (여분 top-level 키 거부) 비대칭은 이번 PR 이 만든 게 아니라 기존
  상태다.** re-run 은 `ReRunRequestDto` 를 실제 `@Body()` 타입으로 써서 class-validator 가 진입하고,
  execute 는 인라인 `Object` 타입이라 `CustomValidationPipe.toValidate()` 의 제외 목록에 걸려
  스킵된다 — 이 비대칭은 PR 이전부터 있던 상태이고, 이번 변경은 그 비대칭을 유지할 뿐 새로
  만들지도 악화시키지도 않는다. plan 은 "여분 키 거부를 켤지"를 **의도적으로 범위 밖**으로 두고
  트래커에 신규 항목으로 등재하기로 했는데, 이 "정합화(문서 정직화)"와 "계약 변경(breaking)"을
  분리해 후자를 별도 결정으로 defer 하는 패턴은 `spec/5-system/2-api-convention.md` 의 기존
  Rationale ("비-페이징 고정 컬렉션은 `{data:{items}}` 유지 — … 정합화하되 bare-array 전환은
  breaking 이라 별도 결정 시까지 defer")과 **동형**이다. 즉 기각된 대안의 재도입이 아니라, 이미
  이 spec 이 채택한 "정합화-vs-계약변경 분리" 원칙을 그대로 따른 것이다.
- **`spec/conventions/egress-masking.md` §3 이 관련 마커 계약을 소유** — 이번 DTO 의 `description`
  이 "마스킹 마커와 정확히 일치하는 값은 400 `MASKED_VALUE_RESUBMITTED` 로 거부. SoT: EIA §R17."
  로 리터럴을 재기술하지 않고 SoT 를 가리키는 것도, 트래커가 이미 닫은 항목("마커 리터럴을 다시
  적지 않는다")의 방식을 그대로 따른 것이라 번복이 아니다.

## 요약

이번 세션의 실질적 target(구현 계획 `execute-body-openapi.md` + 대응 코드 diff)은 spec/5-system 에
기록된 마스킹 마커 가드의 레이어 분리 원칙("base 함수에 넣지 않는다", "판정 기준은 저작 주체")과
`re-run`/`execute` 두 경로의 동일 헬퍼 사용 대칭성을 전혀 건드리지 않으며, "문서 정합화"와
"계약(behavior) 변경"을 분리해 후자를 별도 트래커 항목으로 defer 하는 방식은 이 spec 영역이 이미
채택한 Rationale 패턴(비-페이징 컬렉션 예시)과 동형이다. 기각된 대안의 재도입, 원칙 위반, 무근거
번복, invariant 우회 중 어느 것도 발견되지 않았다. 유일한 관찰은 이번에 신설되는 "문서 전용
`@ApiBody` DTO(파라미터 타입과 분리)" 패턴이 `spec/conventions/swagger.md` 에 아직 이름 붙여
등재되지 않았다는 점이며, 이는 차단 사유가 아닌 향후 정합 보완 제안(INFO)이다.

## 위험도

LOW
