# Rationale 연속성 검토 — folders-contract-e2e (spec/2-navigation/, impl-done)

## 점검 대상 요약

- scope `spec/2-navigation/` 델타: 0 파일 (정상 — 이 브랜치는 코드 전용 PR).
- 실 구현 diff(9파일/425줄, `git diff origin/main...HEAD -- codebase/ CHANGELOG.md`): `omitUndefined` 공용 헬퍼 신설 →
  `folders.service.ts` `update()` 와 `triggers.service.ts` `update()` 양쪽에 적용, `FolderDto.parentId` 선언을
  `@ApiPropertyOptional({ nullable: true })`(optional+nullable) → `@ApiProperty({ type: String, nullable: true })`(항상 존재 +
  nullable)로 변경, `swagger-dto-contract.spec.ts` 의 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 래칫에서 해당 행 제거, 신규
  `folder-crud.e2e-spec.ts`.
- 대조한 과거 결정: `spec/5-system/2-api-convention.md` §5.4(부재 표현 — `null` vs 키 생략), `spec/2-navigation/1-workflow-list.md`
  `## Rationale` §1~§4(폴더 관련은 §3 "폴더 계층 무결성은 생성·부모 변경 양쪽에서 강제"), `spec/2-navigation/2-trigger-list.md`
  `## Rationale` R-1~R-17(PATCH 경로·필드 정책 전반), `plan/in-progress/folders-contract-e2e.md`(이번 작업 자체의 실측·근거 기록).

## 발견사항

없음 — CRITICAL/WARNING 대상 발견되지 않음.

### 참고 (INFO) — DTO 응답-계약 수정은 §5.4 를 번복이 아니라 집행한 것

- target 위치: `codebase/backend/src/modules/folders/dto/responses/folder-response.dto.ts` (`parentId` 선언),
  `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` (`EXPECTED_OPTIONAL_NULLABLE_DRIFT` 목록에서
  `folder-response.dto.ts:FolderDto.parentId` 제거)
- 과거 결정 출처: `spec/5-system/2-api-convention.md` §5.4 — "TS 타입이 `| null` 인데 `nullable: true` 를 선언하지 않는 것은
  어느 쪽에서도 틀렸다" / "`null` 을 쓰는(상시 존재) 필드 → `@ApiProperty({ nullable: true })` + `field: T | null`". 코드 쪽
  `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 배열 자체가 "일부러 §5.4 를 어기는" 기존 위반을 동결해 둔 **채무 목록**이라는 성격이
  `swagger-dto-contract.spec.ts` 상단 주석(`RATCHET_FIXTURE` 부근)에 명시돼 있다.
- 상세: `FolderDto.parentId` 는 종전 `optional + nullable`(§5.4 가 "어느 쪽에서도 틀렸다"고 명시한 금지 조합)이었고 이번
  PR 이 이를 §5.4 의 두 정본 형태 중 하나("상시 존재 + null")로 정정했다. 이는 §5.4 를 뒤집거나 새로 해석한 것이 아니라
  이미 문서화된 규칙을 뒤늦게 준수시킨 것이며, 래칫 배열도 애초에 "언젠가 줄어들어야 할 채무" 로 설계돼 있어 항목 제거가
  그 설계와 정합한다. §5.4 의 "소급 적용 대상 아님" 문구는 *새 사유 문구 요구를 면제*하는 대상(이미 문서화된 키-생략
  필드)에 한정되고, 이번처럼 필드를 실제로 변경하는 경우는 그 문구가 말하는 "앞으로 변경되는 필드" 범주에 들어가 §5.4
  준수가 그대로 요구된다 — 이 PR 은 그 요구를 충족했다.
- 폴더 API 의 계층 무결성(깊이 5·순환·워크스페이스 소속)을 다루는 `1-workflow-list.md` `## Rationale` §3 은 응답 형태를
  다루지 않으므로 이번 변경과 겹치지 않는다. `plan/in-progress/folders-contract-e2e.md` 도 "§3.1 은 폴더 API 의 동작만
  적고 응답 필드 부재 표현은 §5.4 가 SoT" 라고 스스로 근거를 적어 `spec_impact: none` 을 정당화했다 — 이는 criterion 3
  ("결정의 무근거 번복") 이 요구하는 "새 Rationale 동반" 요건을 spec 문서 대신 plan 문서 레벨에서 충족한 사례로 본다
  (SoT 분리가 이미 §5.4 쪽에 있으므로 `spec/2-navigation/` 쪽에 별도 Rationale 신설을 요구하지 않는 것이 맞다).
- `triggers.service.ts` 의 `omitUndefined` 치환은 2026-09-05 에 이미 도입된 것과 동일한 로직을 헬퍼로 옮긴 것뿐이라
  `2-trigger-list.md` `## Rationale` 의 R-1~R-17 어느 항목과도 동작이 달라지지 않는다(순수 리팩터, 회귀 뮤턴트 H4 로
  동등성 실측 — `plan/in-progress/folders-contract-e2e.md` H1~H4 표).
- 제안: 조치 불요. 굳이 강화한다면 `spec/2-navigation/1-workflow-list.md` §3.1 폴더 API 표에 "응답 필드 부재 표현은
  §5.4 SoT" 라는 각주를 다는 것인데, 이는 이미 이번 PR 의 `--impl-prep`(`review/consistency/2026/09/27/10_39_26`) 처분에서
  기존 planner 트래커 항목에 보강 사항으로 등재됐다(developer 는 spec 을 직접 못 고치므로) — 중복 지적 불필요.

## 요약

folders-contract-e2e 구현은 `spec/2-navigation/` 를 전혀 건드리지 않았고(스코프 델타 0), 실제 코드 변경(`omitUndefined`
공용화, `FolderDto.parentId` 선언 정정, 래칫 1행 정리, 신규 e2e)은 모두 `spec/5-system/2-api-convention.md` §5.4 에 이미
박혀 있는 "부재 표현" 원칙을 뒤늦게 집행한 것이며, `2-trigger-list.md` 쪽은 기존 로직을 헬퍼로 옮긴 순수 리팩터다.
`1-workflow-list.md`·`2-trigger-list.md` 의 `## Rationale` 어느 항목도 이번 변경으로 재도입·번복·우회되지 않았고,
plan 문서(`plan/in-progress/folders-contract-e2e.md`)가 왜 `spec_impact: none` 인지(§5.4 가 SoT)를 명시적으로 근거
지어 두어 "결정 번복 시 새 Rationale 부재" 우려도 해소된다. Rationale 연속성 관점에서 이번 PR 은 기각된 대안의 재도입도,
합의 원칙 위반도, 무근거 번복도 없다.

## 위험도

NONE
