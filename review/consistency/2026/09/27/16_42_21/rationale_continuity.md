# Rationale 연속성 검토 — patch-body-followups (impl-done, scope=spec/2-navigation/)

## 검토 대상 요약

- spec 델타: `spec/2-navigation/` 0개 파일(정상 — 코드 전용 PR).
- 코드 diff: 11개 파일 / 372줄. 요지 — `UpdateWorkflowDto.description` · `UpdateNodeDto.description` ·
  `UpdateAuthConfigDto.ipWhitelist` 세 요청 DTO 필드를 `nullable: true` + `T | null` 로 선언 정정(런타임은
  이미 `null` 을 받아 값을 지우고 있었음 — 동작 변화 없음, 선언만 동작에 맞춤), 단위/e2e/선언 캐너리 추가,
  `omit-undefined.ts` JSDoc 보강, CHANGELOG 항목 1건.
- plan: `plan/in-progress/patch-body-followups.md` (§실측 · §방향 · §뮤턴트 · 3R `/ai-review` · `--impl-prep` 처분).

## 발견사항

이번 diff 에서 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 중 어느 것도 발견되지
않았다. 오히려 두 지점에서 Rationale 연속성을 **명시적으로 준수**하는 근거가 확인되어 아래 INFO 로만 남긴다.

- **[INFO] 요청 DTO nullable 선언은 §5.4 선례를 정확히 따른다**
  - target 위치: `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts` ·
    `.../nodes/dto/update-node.dto.ts` · `.../auth-configs/dto/update-auth-config.dto.ts`
  - 과거 결정 출처: `spec/5-system/2-api-convention.md` §5.4 "적용 범위 — 응답 바디" 단락 — "요청 DTO
    에서는 `@ApiPropertyOptional({ nullable: true })` + `field?: T | null` 조합이 정당하다 (선례:
    `UpdateAssistantSessionDto.llmConfigId`)"
  - 상세: §5.4 응답 바디 기본 규칙("null 을 쓰는 상시 존재 필드 → `@ApiProperty({nullable:true})` + non-optional")을
    그대로 요청 바디에 적용하면 `?` 가 사라져 PATCH tri-state(생략=유지·null=초기화·값=설정) 계약이 깨진다는
    점을 §5.4 가 이미 예외로 못박아 뒀다. 이번 diff 는 정확히 그 예외 형태(`@ApiPropertyOptional({nullable:true})`
    + `field?: T | null`)로 세 필드를 고쳤다 — 새 예외를 만든 것이 아니라 기존에 문서화된 예외를 적용한 것.
  - 제안: 조치 불요. 굳이 보완한다면 §5.4 선례 문장의 "선례: `UpdateAssistantSessionDto.llmConfigId`" 뒤에
    이번 세 필드를 추가 선례로 병기할 수 있으나, 필수는 아니다.

- **[INFO] "필터 계층에서 23502 를 매핑" 대안 재도입을 스스로 차단**
  - target 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 항목 "PATCH 의 NOT NULL
    필드에 `null` 을 보내면 500 이다" (line ~1440), `plan/in-progress/patch-body-followups.md` `--impl-prep`
    처분 W4
  - 과거 결정 출처: `plan/in-progress/keyset-cursor-uuid-validation.md` §A — "필터는 값의 출처를 모른다 ·
    500 은 입구 검증 누락의 알람이다 · 전략은 입구마다 조기 거부"(23502/22P02 를 필터 레벨에서 매핑하는
    안을 이미 기각)
  - 상세: 이번 세션에서 실측(고치기 전 코드로 프로브)한 새 결함 클래스 — PATCH 로 NOT NULL 컬럼에 `null` 을
    보내면 7곳 모두 500 — 를 트래커에 새 항목으로 등재하면서, 처방을 "필터에 23502 매핑을 넣지 않는다.
    `keyset-cursor-uuid-validation.md` §A 가 이미 그 방향을 기각했다"고 **명시적으로 인용**하고 입구(DTO)
    검증으로만 방향을 잡았다. 이는 기각된 대안이 이유 없이 재도입되는 것을 막은 사례다(§방향 6 / `--impl-prep`
    W4 에도 동일하게 기록).
  - 제안: 조치 불요 — 이미 올바르게 처리됨. 후속 PR 착수 시에도 이 인용을 유지할 것.

- **[INFO] 응답 DTO 축과 요청 DTO 축의 구분을 3R 에서 재확인**
  - target 위치: `plan/in-progress/patch-body-followups.md` `/ai-review` 3R 절 (review/code/2026/09/27/16_29_51)
  - 과거 결정 출처: `spec/5-system/2-api-convention.md` §5.4 (응답 바디 규칙) vs 요청 바디 예외 문단
  - 상세: 3R 에서 리뷰어가 제기한 "응답 DTO 의 nullable 선언도 데코레이터·타입을 함께 되돌리는 회귀에
    캐너리가 없다"는 지적을, `NodeDto.description` · `AuthConfigDto.ipWhitelist` 가 §5.4 양방향 래칫에
    이미 등재돼 있어 방어된다는 사실로 반증하고 뮤턴트(R1·R2)로 실측했다. 요청/응답 두 축을 혼동하지
    않고 각각의 방어 메커니즘(선언 캐너리 vs 래칫)을 정확히 구분한 것으로, §5.4 의 "요청 바디는 대상이
    아니다" 구분과 정합한다.
  - 제안: 조치 불요.

## 요약

diff 는 `spec/5-system/2-api-convention.md` §5.4 가 이미 정의해 둔 "요청 DTO nullable 선언" 예외를
그대로 적용한 선언 정정이며, 런타임 동작 변화가 없는 문서화 성격의 수정이다. plan 문서는 관련된 과거
기각 결정(`keyset-cursor-uuid-validation.md` §A 의 필터-레벨 매핑 기각)을 새 트래커 항목에서 명시적으로
인용해 재도입을 스스로 차단했고, 응답/요청 두 축의 방어 메커니즘 구분도 §5.4 의 구획과 일치한다. 기각된
대안의 무단 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 중 어느 유형도 발견되지 않았다.

## 위험도

NONE
