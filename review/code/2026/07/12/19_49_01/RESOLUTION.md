# RESOLUTION — EIA status 리터럴 유니온 SoT 통합

원 리뷰: `review/code/2026/07/12/19_49_01/SUMMARY.md` — RISK LOW, CRITICAL 0, WARNING 2.

## WARNING (2건 — 전부 반영)

- **W1 (Testing) — 신규 SoT 값 검증 부재**: `execution-status-response.dto.spec.ts` 에
  두 assertion 추가 — (a) `status.enum` deep-equal `[...EIA_EXECUTION_STATUS_VALUES]`
  (wire 값·순서 drift 가드), (b) 엔티티 `ExecutionStatus` 와 순서-무관 집합 동등성
  (엔티티↔wire drift 가드 — 상태 추가 시 wire 리터럴 누락 검출).
- **W2 (Testing) — InteractAckDto 스키마 회귀 테스트 부재**: `interact-ack-response.dto.spec.ts`
  신설(`SwaggerModule.createDocument` 패턴). `currentStatus.enum` 값·순서 assertion +
  optional 검증 + 엔티티 집합 동등성.

## INFO (반영/판정)

- **I1 (Side Effect) — 동명 상수 grep 혼동**: `workflow-assistant/tools/explore-tools.service.ts`
  가 값 순서가 다른 동명 `EXECUTION_STATUS_VALUES` 를 이미 export → 본 신규 상수를
  `EIA_EXECUTION_STATUS_VALUES` 로 접두 구분. (drift 방지가 목적인 변경에 동명 혼동은 아이러니 → 정면 해소.)
- **I2 (Maintainability) — spread 스타일 불일치**: 같은 모듈 `INTERACT_COMMANDS` 가
  `@ApiProperty({ enum: INTERACT_COMMANDS })` 직접 참조를 쓰므로, `enum: [...SPREAD]` →
  `enum: EIA_EXECUTION_STATUS_VALUES` 직접 참조로 통일(build 통과 = readonly `as const` 호환).
- **I3 (Maintainability) — 명명 근거 미문서화**: 리터럴 파일 JSDoc 에 `EIA_` 접두(동명 회피)·
  `Literal` 접미(엔티티 enum 이름 충돌 회피) 근거 명시.
- **I5 (Documentation) — swagger.md §5-1 `*.literal.ts` 패턴 미문서화**: 범위 밖(spec/conventions
  편집=planner 트랙) — 별도 후속으로 남김(비차단).
- **requirement disk-write gap**: reviewer 가 `success` 인데 output 파일 부재(known workflow
  disk-write gap). behavior-preserving SoT 통합이라 요구사항(중복 유니온 단일화) 충족은 자명 —
  실질 미해소 findings 없음으로 판정.

## 검증

- build: PASS (nest build — 직접 참조 컴파일 확인)
- lint: PASS (prettier 줄바꿈 1건 수정 후 clean)
- unit: PASS (DTO 스키마 회귀 21 — 기존 15 + 신규 drift 가드 6)
- e2e: 통과 (253 tests, backend supertest — 무회귀)

fresh `/ai-review --branch origin/main` 후속 예정 (resolution 후 원 리뷰 stale).
