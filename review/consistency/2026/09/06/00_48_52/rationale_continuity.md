# Rationale 연속성 검토

## 검토 범위 참고

`--impl-done` 모드, scope=`spec/5-system/`, diff-base=`origin/main`. 이 브랜치는
`spec/**` 을 전혀 변경하지 않았다(`git diff --stat origin/main...HEAD -- spec/` 결과
없음) — 실제 검토 대상은 `spec/5-system/2-api-convention.md`(§5.4) ·
`spec/conventions/secret-store.md`(§1·§1.1)가 이미 정의한 Rationale/invariant 를,
이번 코드 diff(31파일/2279줄, 주로 `codebase/backend/src/modules/{schedules,triggers,
integrations,knowledge-base,alerts}` 응답 DTO + `shared/testing/response-contract.ts` +
`repo-guards/__tests__/swagger-dto-contract-guard.ts`)가 지키는지다.

## 발견사항

검증 없음 — CRITICAL/WARNING 급 Rationale 연속성 위반을 찾지 못했다. 아래는 실제로
대조한 근거와 함께 INFO 하나만 남긴다.

- **[INFO]** `secret-store.md §1` 의 "노출 창이 아직 닫혀 있지 않다" 서술이 이 브랜치
  머지 시점에 낡는다
  - target 위치: (spec 비변경) — 참고로 `codebase/backend/src/modules/triggers/triggers.service.ts` 의
    `sanitizeForResponse`(`TRIGGER_RESPONSE_STRIP_COLUMNS` 도입) 및
    `schedules.controller.ts` 의 `toResponse()`(트리거 참조 4필드로 축소)
  - 과거 결정 출처: `spec/conventions/secret-store.md` §1 세 번째 비대상 등재 하위 "노출
    창은 아직 설계대로 닫혀 있지 않다 … **현행 구현은 `GET/POST/PATCH /api/triggers` 와
    `GET /api/schedules` … 응답에도 이 컬럼을 그대로 싣는다** … 유출을 닫는 코드 수정은
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 추적한다"
  - 상세: 이번 diff 는 바로 그 문장이 지적한 두 엔드포인트(`triggers`/`schedules`)에서
    `notificationSecretV2`/`chatChannelTokenV2` 노출을 실제로 닫는다(`CHANGELOG.md` "Unreleased
    — 트리거 회전 secret 이 두 엔드포인트로 나갔다" 항목, e2e·unit 뮤턴트 RED 확인 포함).
    Rationale 번복이 아니라 **그 Rationale 이 예고한 후속 수정 그 자체**이므로 문제는
    아니다. 다만 머지 후에는 secret-store.md §1 의 현재형 서술("매 요청 노출된다")이
    사실과 어긋나게 된다.
  - 제안: 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 "`secret-store.md
    §1` 의 '노출 창이 아직 닫혀 있지 않다' 가 낡는다" 항목(§7.1 정정-이력 패턴 준용, 커밋
    참조 추가)이 planner 담당으로 등재돼 있다 — 별도 조치 불필요, 그 항목이 다음
    planner 턴에서 실제로 반영되는지만 확인하면 된다.

## 대조 근거 (위반 없음을 확인한 주요 지점)

- **§5.4 (null vs 키 생략) 준수**: `trigger-response.dto.ts`·`schedule-response.dto.ts`·
  `alert-rule-response.dto.ts`·`integration-response.dto.ts`·`knowledge-base-response.dto.ts`
  신규 필드 전부 — 엔티티 컬럼(상시 존재)은 `@ApiProperty({nullable:true})` 기본형,
  `workflow` 참조(부가 컨텍스트, 생성 응답에만 부재)는 `@ApiPropertyOptional` 키-생략형으로
  기준 (a)/(b) 를 필드별로 명시. `IntegrationDto.appUrl` 은 `spec/2-navigation/4-integration.md`
  §9.1 이 이미 `string | null`(기본형)로 문서화한 것과 일치(실측: grep 결과 확인).
- **두 검증자 경계(§5.4 "검증 층" 절) 준수**: `response-contract.ts`(값↔선언, 런타임) 신규
  `allowMissing` 옵션은 "spec 에 이미 Planned 로 적힌 갭만" 이라는 자기 문서화 규칙대로
  `workflow-crud.e2e-spec.ts` 에서 `ExportWorkflowDto.formatVersion` 1건에만 쓰이고, 인용한
  `spec/2-navigation/1-workflow-list.md`:153 "포맷 버전 협상은 미구현 (Planned)" 문구가 실제로
  존재함을 확인(지어낸 인용 아님 — MEMORY `feedback_rationale_rejected_alternatives_need_history`
  경계에 해당하지 않음).
- **secret-store.md §1.1 ("select:false 미채택, 응답 경계에서 지운다") 준수**:
  `TRIGGER_RESPONSE_STRIP_COLUMNS` 는 컬럼 자체를 비활성화하지 않고 응답 사본에서만
  `delete` — 회전 스윕(`sweepNotificationRotation`)이 그 컬럼을 계속 읽을 수 있게 하는
  것과 정확히 일치.
- **자기 반증 정정의 정당성**: 이 브랜치 자신이 커밋 `cb17f0870` 에서 "§5.4 금지 조합을
  내가 넓혔다"(17개 필드를 `@ApiPropertyOptional({nullable:true})` 로 잘못 선언)를 인지하고
  같은 브랜치 안에서 즉시 정정 + 양방향 래칫 가드(`swagger-dto-contract-guard.ts` 의
  `findOptionalNullableResponseFields` + `EXPECTED_OPTIONAL_NULLABLE_DRIFT`)를 신설했다.
  번복이 무근거가 아니라 원인·정정·재발방지가 한 세트로 기록되어 있다.
- **`ScheduleDto.trigger`/`isActive` 분기 제거**: `schedules.service.ts` 가 `saved.trigger =
  savedTrigger` 대입을 `if (isActive)` 밖으로 옮긴 것은 "트리거는 `isActive` 와 무관하게
  항상 존재한다"는 §5.4 상시-존재 판정과 일치하도록 만드는 수정이며, 코드 주석이 종전
  주석의 오류("`registerJob` 이 필요로 하므로")를 실측으로 반박하고 정정한 것도 명시.

## 요약

이번 코드 diff 는 `spec/5-system/2-api-convention.md` §5.4 와 `spec/conventions/secret-store.md`
§1/§1.1 이 이미 세워 둔 원칙(null vs 키-생략 선택 기준, 두 검증자의 경계, `select:false`
비채택 이유, 저장-위치 예외 ≠ 노출 예외)을 정면으로 따르며, 그 Rationale 이 "아직 닫히지
않았다" 고 명시적으로 남겨 둔 유출 갭(트리거 회전 secret 의 응답 노출)을 실제로 닫는
후속 조치에 해당한다. 과거 기각된 대안을 사유 없이 재도입하거나 합의 원칙을 우회하는
지점은 발견되지 않았다. 브랜치 자체 내에서 한 차례 있었던 규칙 위반(§5.4 금지 조합
확대)도 같은 브랜치 안에서 원인·정정·재발방지 가드까지 갖춰 자기 회복됐다. 유일한
잔여 사항은 머지 후 `secret-store.md §1` 의 현재형 서술이 낡는 것인데, 이는 이미
`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 후속 planner 작업으로
등재되어 있어 이번 코드 변경의 결함이 아니다.

## 위험도

LOW
