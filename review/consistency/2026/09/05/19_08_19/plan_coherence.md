# Plan 정합성 검토

## 발견사항

- **[WARNING]** HEAD 최신 커밋(`cb17f0870`, §5.4 금지 조합 정정 + 래칫 가드 신설)이 이 작업의 SoT 트래커인 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 반영되지 않았다
  - target 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`(신규 `findOptionalNullableResponseFields`/`EXPECTED_OPTIONAL_NULLABLE_DRIFT` 78건 래칫), `codebase/backend/src/modules/schedules/{dto/responses/schedule-response.dto.ts,schedules.controller.ts}`(`trigger` 를 `null` present → **키 생략**으로 wire 형태 변경), `codebase/backend/src/modules/{alerts,integrations,knowledge-base}/dto/responses/*.ts`(23개 필드를 `@ApiPropertyOptional+nullable:true` → `@ApiProperty(+nullable:true)` 로 재정정), `codebase/backend/src/modules/triggers/triggers.service.ts`(`config.notification.signing.secretRef` 스트립 추가)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` §후속 "§5.4 drift 배치 — 2단계"(:331) 안의 "스윕 1차 (2026-09-05) — 4 → 18개 DTO"(:378) 및 "종결 조건" 표(:728)
  - 상세: `git log`로 확인하면 이 plan 파일을 마지막으로 건드린 커밋은 `dfb2664af`(§5.4 스윕 1차, "종결 조건" 표의 stale 수치 정정)이고, 그 직후·최신 커밋 `cb17f0870` 은 plan 파일을 전혀 건드리지 않았다(`git diff dfb2664af cb17f0870 -- plan/...` = 변경 없음). 그런데 `cb17f0870` 은:
    1. "스윕 1차" 가 방금 만든 §5.4 선언 23곳이 사실은 **§5.4 자신이 응답 바디에서 금지하는 조합**(`required:false`+`nullable:true`)이었음을 자기반박하고 재정정했다 — 즉 "완료(2026-09-05)" 로 적힌 스윕 1차의 산출물 일부가 그 사이 이미 한 번 틀렸다가 고쳐졌는데, 이 사실 자체가 plan 문서 어디에도 없다.
    2. 두 기존 검증자(정적 선언-vs-선언, 런타임 값-vs-선언) 어느 쪽도 이 조합을 못 잡는다는 "사각지대"를 발견하고 `swagger-dto-contract-guard.ts` 에 **세 번째 검증 축**(78건 baseline 래칫)을 신설했다 — spec §5.4 "검증 층" 절(`spec/5-system/2-api-convention.md:223-237`)이 여전히 두 검증자만 표로 열거한다(코드 레벨 신규 사실이라 spec 갱신이 필수는 아니지만, 이 plan 문서가 정확히 이 발견들을 등재하는 관례를 스스로 세워 왔다).
    3. **동일한 숫자 "78"이 이제 두 가지 다른 모집단을 가리킨다** — plan 이 이미 추적 중인 "§5.4 drift 배치 — 2단계: 검증자가 없는 응답 DTO **78곳**"(요청/응답을 전이 폐포로 가른 뒤 센 필드 수)과, 새 래칫 가드의 "**78건**"(금지 조합 baseline, 완전히 다른 집합)이 같은 자릿수다. 이 plan 문서는 바로 위(:331-345)에서 "세 숫자가 다 다르고, 각각 다른 것을 센다 … **더하지 말 것**" 이라고 스스로 경고해 둔 실패 패턴인데, 이번엔 문서 밖(코드 주석·커밋 메시지)에서 네 번째 "78" 이 생겨 plan 이 그 존재조차 모른다.
    4. `ScheduleDto.trigger` 의 wire 형태가 이번 정정으로 `null`-present 에서 **키 생략**으로 바뀌었다 — "스윕 1차" 절은 이 필드를 "컨트롤러에서 참조 4필드로 좁힘"으로만 서술하고 이 두 번째 형태 변경은 언급하지 않는다.
  - 제안: plan 의 `## 후속` 에 새 불릿을 추가해 (a) §5.4 금지 조합 자기반박·정정 경위, (b) 새 래칫 가드와 78건 baseline(성격을 "§5.4 drift 배치 — 2단계" 의 78곳과 구분하는 문장 포함), (c) `ScheduleDto.trigger` 최종 wire 형태(키 생략)를 기록한다. 코드 자체는 게이트(`--impl-done`/`--ai-review`) 지적을 반영해 이미 올바르게 정정된 상태이므로 코드 변경은 불필요 — plan 문서만 최신 상태로 동기화하면 된다.

- **[INFO]** "스윕 착수 시 헬퍼로 접기" 항목의 "지금 2곳" 이 이미 실측보다 낡았다
  - target 위치: `codebase/backend/test/*.e2e-spec.ts` — `list → find(mine) → toBeDefined → assertMatchesContract` 패턴이 `background-monitoring`·`alerts-threshold-wire-type`·`schedule-trigger`(목록+상세 두 자리)·`workflow-crud` 등 다수 파일로 이미 늘어났다(16개 파일이 `contractForDto` 를 쓰고 그중 다수가 이 패턴)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` §후속 "스윕 착수 시 `find → toBeDefined → assert` 3문장을 헬퍼로 접기"(:266) — "지금 2곳", "스윕이 56개로 늘리면 그만큼 는다"
  - 상세: plan 이 이미 이 성장을 예견하고 헬퍼 도입을 "스윕이 어떤 형태를 만나는지 본 뒤" 로 의도적으로 유예한 항목이라 결정 충돌은 아니다. 다만 "지금 2곳" 이라는 숫자는 이 PR 의 스윕 1차만으로도 이미 사실이 아니다.
  - 제안: 급하지 않음 — 다음에 이 항목을 열 때(헬퍼 도입 여부 재판단 시) "2곳" 을 현재 실측치로 갱신할 것. 지금 당장 plan 을 고칠 필요는 없다(INFO).

## 요약

이번 diff(26파일/코드)는 `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 추적해 온 "§5.4 drift 배치" 워크스트림의 연속이며, 스윕 자체는 리뷰 게이트(`--impl-done`/`--ai-review`) 지적을 정확히 반영해 자기반박·정정까지 마친 건강한 상태다. 다만 그 정정과 그 결과로 신설된 검증 축(78건 래칫)이 정확히 이 워크스트림의 SoT 인 plan 문서에는 반영되지 않았다 — 이 문서가 스스로 "숫자 conflation 을 조심하라" 고 경고해 둔 바로 그 실패 유형이 문서 밖에서 재발할 조건을 만든 것이다. 미해결 결정을 우회하거나 선행 조건을 건너뛴 것은 없고(§5.4 금지 조합 규칙은 spec 에 이미 명시돼 있었다), 순수하게 후속 기록 누락(WARNING) 문제다.

## 위험도
LOW
