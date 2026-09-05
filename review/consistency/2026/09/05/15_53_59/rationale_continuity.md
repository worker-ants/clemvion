# Rationale 연속성 검토

## 검토 범위

- Target: `spec/5-system/` (--impl-done, diff-base `origin/main`)
- scope(`spec/5-system`) 델타: 0개 파일 (spec 자체는 변경 없음 — 정상, 코드 전용 PR)
- 실제 구현 diff: 9개 파일 / 1299줄 — `audit-logs.service.ts`/`.spec.ts`,
  `response-contract.ts`(신규)/`.spec.ts`(신규), `execution-response.dto.spec.ts`(신규),
  `audit-logs.e2e-spec.ts`/`session-revocation.e2e-spec.ts`/`workflow-crud.e2e-spec.ts`/
  `workflow-execution.e2e-spec.ts`
- 프롬프트 번들의 `## 구현 변경 사항` 절이 예산 절단으로 비어 있어, HEAD 워킹트리에서
  `git diff origin/main` 을 직접 실행해 diff 본문을 확보한 뒤 검토했다.

## 발견사항

없음.

검토 대상 diff 는 두 축으로 구성된다 — (1) `AuditLogsService.findAll` 이 `User` 엔티티를
`leftJoinAndSelect` 로 통째 실어 `passwordHash`·2FA 복구 코드·재설정 토큰 등 26개 키를
응답에 노출하던 것을 `AuditLogUserDto` 가 광고하는 3필드(`id`/`name`/`email`)만 select 하도록
좁힌 보안 수정, (2) `spec/5-system/2-api-convention.md` §5.4(부재 표현 규칙)를 실 응답에
대해 검증하는 일반 헬퍼(`response-contract.ts`) 신설과 4개 엔드포인트 배선. 둘 다 기존
Rationale 과 대조했을 때 다음 이유로 연속성 위반이 아니다.

- **§5.4 규칙 재도입이 아니라 그대로 구현**: `response-contract.ts` 의 판정 규칙(필수+
  non-nullable → 키 존재·non-null / 필수+nullable → 키 존재·null 허용 / 키 생략형 → 부재
  허용·존재 시 non-null)은 스캔한 `2-api-convention.md` §5.4 본문과 정확히 일치한다.
  네 번째 행(키 생략형 + `nullable` 선언)을 "§5.4 위반이지 이 도구의 판정 대상이 아니다"로
  분리한 것도, §5.4 원문이 "요청 바디 tri-state 는 대상 아님"이라 명시한 경계와 일치한다.
- **기각된 대안(반환 타입 명시 annotate)을 되살리지 않음**: `response-contract.ts` 주석과
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 양쪽에 "엔티티 반환 타입을
  DTO 로 명시하는 안은 실측(불일치 59건 중 46건이 Date→string 정상 케이스)으로 반증됐다"는
  동일한 근거·수치가 기록돼 있다 — 지어낸 근거가 아니라 실제 이력이며(plan L353-379),
  이번 diff 는 그 반증된 대안이 아니라 그 다음으로 채택된 "응답 1건 vs DTO 선언 일반 대조"
  경로를 그대로 확장한 것이다.
- **§5.4 drift(10개 optional+nullable 필드)를 고치지 않고 고정한 것도 §5.4 자체가 정한
  소급 예외 범위 안**: §5.4 는 "이미 문서화된 키 생략 필드는 사유 문구를 소급 요구하지
  않는다"고 명시하며, 신설된 `execution-response.dto.spec.ts` 는 이 10개 필드를
  `OPTIONAL_NULLABLE_DRIFT`로 라벨링해 "고치는 것이 아니라 고정"한다고 주석에 명시하고
  트래커(`spec-draft-nullable-notation-followups.md`)에도 후속 스윕 항목으로 남아 있다 —
  결정 번복이 아니라 기존에 알려진 drift 를 그대로 유지하며 회귀만 막는 것이다.
- **"기각한 대안" 인용의 실제 이력 확인**: `swagger-dto-contract` 가드가 실재하고
  (`codebase/backend/src/repo-guards/__tests__/swagger-dto-contract*.ts`),
  response-contract.ts 가 "선언 층은 다른 도구가 본다"고 위임한 대상과 일치한다. 과거
  세션에서 문제됐던 "선례 없는 근거의 소급 부여" 패턴은 이번 diff 에서 관측되지 않았다.

## 요약

이번 diff(감사 로그 응답 필드 축소 보안 수정 + §5.4 응답 계약 검증 헬퍼 신설)는 `spec/5-system/2-api-convention.md` §5.4 의 부재 표현 규칙을 그대로 코드로 옮긴 것이며, 과거 반증된 대안(반환 타입 명시 annotate)을 되살리지 않고 그 반증 근거를 실제 plan 이력과 함께 인용했다. 기존 §5.4 drift(10개 필드)는 뒤집지 않고 "고정 + 추적"으로만 다뤄 spec 이 정한 소급 예외 범위를 벗어나지 않는다. Rationale 에 기록된 원칙·기각 이력과 충돌하는 지점을 찾지 못했다.

## 위험도

NONE
