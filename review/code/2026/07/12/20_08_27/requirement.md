# 요구사항(Requirement) 리뷰

## 발견사항

- **[WARNING]** plan 완료 노트가 최종 구현의 상수명·문법과 불일치 (documented-vs-actual drift)
  - 위치: `plan/in-progress/eia-context-schema-followups.md` L33 (`- [x] **EIA 응답 DTO \`status\` 리터럴 유니온 SoT 통합**` 항목의 `**완료(2026-07-12, PR eia-context-dev)**:` 절)
  - 상세: 완료 노트는 "신규 로컬 SoT 파일 `execution-status.literal.ts`(`EXECUTION_STATUS_VALUES` as const + `ExecutionStatusLiteral` 파생)로 두 DTO 통합 ... `[...EXECUTION_STATUS_VALUES]` 로 swagger 배열 공유" 라고 서술하지만, 실제 최종 코드(`execution-status.literal.ts`, `execution-status-response.dto.ts`, `interact-ack-response.dto.ts` — diff 및 현재 파일 내용으로 확인)는 상수명이 `EIA_EXECUTION_STATUS_VALUES`(동일 세션의 fresh ai-review `review/code/2026/07/12/19_49_01/RESOLUTION.md` I1 항목에서 동명 상수(`workflow-assistant/tools/explore-tools.service.ts`) grep 혼동 방지를 위해 접두 부여)이고, swagger `enum` 옵션도 spread 없이 `enum: EIA_EXECUTION_STATUS_VALUES` 직접 참조(같은 RESOLUTION I2 항목에서 스타일 통일)를 쓴다. 즉 plan 노트는 I1/I2 fix **이전** 상태를 서술한 채로 남아 있고, 그 fix가 반영된 코드와 사후 동기화되지 않았다.
  - 실제 코드 확인(빌드·테스트 통과, 이 리뷰에서 재실행 검증):
    ```
    codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts:113: @ApiProperty({ enum: EIA_EXECUTION_STATUS_VALUES })
    codebase/backend/src/modules/external-interaction/dto/responses/interact-ack-response.dto.ts:21:    enum: EIA_EXECUTION_STATUS_VALUES,
    ```
  - 영향: 런타임/wire 계약에는 영향 없음(순수 문서 기록의 부정확). 다만 "plan 체크박스 = 실제 상태" 원칙(향후 archaeology 시 완료 근거가 실제 diff 와 어긋나면 오독 유발)에 어긋난다.
  - 제안: plan 완료 노트의 상수명을 `EIA_EXECUTION_STATUS_VALUES` 로, 문법 설명을 "직접 참조(스프레드 없음)"로 정정. (developer 트랙 — plan 은 `codebase` 와 함께 developer 가 쓰기 가능한 경로이므로 spec 변경이 아님.)

- **[INFO]** swagger.md §5-1 이 `dto/responses/` 내 비-`*-response.dto.ts` 파일(`*.literal.ts`) 패턴을 다루지 않음 — 회색지대
  - 위치: `spec/conventions/swagger.md` §5-1 (`codebase/backend/src/modules/<module>/dto/responses/*-response.dto.ts` 로만 명시)
  - 상세: 신규 `execution-status.literal.ts` 는 DTO 클래스가 아니라 공유 `as const` 리터럴 + 파생 타입이며 `dto/responses/` 안에 위치한다. §5-1 본문은 "응답 DTO" 파일명 패턴만 규정하고, 형제 DTO 간 enum 값 공유용 헬퍼 파일의 위치·명명은 다루지 않는다 — 명시적 위반은 아니고(비-DTO 헬퍼 파일을 금지하는 문구가 없음) spec 이 침묵하는 영역이라 회색지대(INFO)로 판단. 동일 세션 리뷰(`review/code/.../documentation.md` I5)에서도 동일하게 지적·비차단으로 판정됨.
  - 제안: 코드를 되돌릴 사안이 아니다. `project-planner` 트랙에서 §5-1 에 "형제 DTO 간 enum 공유가 필요하면 `<name>.literal.ts` 로 `as const` 배열 + 파생 타입을 두고 엔티티 enum 에서 파생하지 않는다(순서 보존)" 한 줄을 추가하는 후속(현재 plan 에 별도 항목으로 등재돼 있지 않음 — RESOLUTION.md 는 "별도 후속으로 남김" 이라고만 적고 실제 backlog 항목을 만들지 않았다).

- **[INFO]** `EIA_EXECUTION_STATUS_VALUES` 가 `Object.values(ExecutionStatus)` 와 순서가 다름 (기존부터 존재, 이번 diff 무관)
  - 위치: `execution.entity.ts::ExecutionStatus`(`pending,running,completed,failed,cancelled,waiting_for_input`) vs `execution-status.literal.ts`(`pending,running,waiting_for_input,completed,failed,cancelled`)
  - 상세: 순서 차이는 리팩터 이전부터 존재했던 wire-doc enum 순서를 그대로 보존하기 위한 **의도적** 설계로, 파일 JSDoc 에 근거가 명시돼 있고 신규 테스트(순서-무관 집합 동등성)로 회귀 가드까지 갖췄다. 실질 결함 아님 — 기록 목적으로만 남김.

## 검증 사항 (문제 없음)

- **기능 완전성**: `execution-status.literal.ts` 신설 + 두 DTO(`ExecutionStatusDto.status`, `InteractAckDto.currentStatus`) 참조 치환은 plan 항목("리터럴 유니온 SoT 통합")이 요구한 범위를 정확히 충족한다. 값·순서 모두 리팩터 이전과 100% 동일(diff 대조 확인) — 순수 behavior-preserving.
- **엣지 케이스**: enum 자체는 고정 6값 집합이라 별도 엣지케이스 없음. 두 신규 drift 가드 테스트(값 배열 deep-equal, 엔티티-wire 집합 순서무관 동등성)가 상태값 추가/누락 같은 향후 회귀를 검출하도록 설계됨 — 적절.
- **TODO/FIXME**: 대상 diff(파일 1~5) 내 TODO/FIXME/HACK/XXX 주석 없음.
- **의도와 구현 간 괴리**: `execution-status.literal.ts` JSDoc 이 (a) `EIA_` 접두 이유(동명 상수 grep 혼동 회피), (b) `Literal` 접미 이유(엔티티 enum 이름 충돌 회피), (c) 엔티티 enum 비파생 이유(레이어 결합 회피 + 순서 보존)까지 코드와 1:1 로 일치 — 검증 완료(엔티티 파일 직접 대조, 순서 실제로 다름을 확인).
- **에러 시나리오**: 응답 DTO(문서화 계층)이라 별도 검증 로직 변경 없음 — 해당 없음.
- **데이터 유효성**: 변경 없음(응답 DTO 는 request validation 대상 아님, class-validator 데코레이터 부재는 리팩터 이전과 동일).
- **비즈니스 로직**: `ExecutionStatusDto.status`/`InteractAckDto.currentStatus` 가 노출하는 6개 상태값 집합은 `Execution.status` 엔티티 enum 과 (순서만 다르고) 집합이 완전히 일치함을 신규 테스트로 확인 — EIA §5.1/§5.3 서술과도 부합(`pending/running/waiting_for_input/completed/failed/cancelled`).
- **반환값**: `execution-status.literal.ts` 는 `as const` 배열 + 파생 타입만 export, 별도 함수 없음 — 반환값 이슈 대상 아님. `interaction.service.ts` 의 `currentStatus`/`status` 대입부(L189, 199, 379)는 이번 diff 로 타입만 alias 로 바뀌었을 뿐 대입 로직 자체는 무변경 — 별도 컴파일 확인(`tsc -p tsconfig.build.json --noEmit`) 결과 에러 없음.
- **spec fidelity**: 관련 spec `spec/5-system/14-external-interaction-api.md` §5.1(`InteractAckDto { executionId, accepted, currentStatus }`)·§5.3(`GET .../:executionId` status 필드 6값)·§5.4(`cancel` ack) 를 대조. wire 형태·필드명·enum 값 집합 모두 spec 서술과 일치하며 이번 diff 로 인한 변경 없음(순수 내부 리팩터). `spec/conventions/swagger.md` §5-1 은 위 INFO 항목 외 불일치 없음.
- **테스트 실행 재검증**: `npx jest src/modules/external-interaction/dto/responses/execution-status-response.dto.spec.ts src/modules/external-interaction/dto/responses/interact-ack-response.dto.spec.ts` → 2 suites / 21 tests 전부 pass (RESOLUTION.md 의 "DTO 스키마 회귀 21" 주장과 일치). `tsc -p tsconfig.build.json --noEmit` → 에러 0.

## 요약

`execution-status.literal.ts` 신설로 `ExecutionStatusDto.status` / `InteractAckDto.currentStatus` 의 중복 6값 상태 리터럴 유니온을 단일 SoT 로 통합한 순수 behavior-preserving 리팩터다. 실측(테스트 21건 재실행 green, `tsc --noEmit` 무오류, entity/DTO/spec 3자 대조)으로 기능 완전성·spec 일치를 확인했으며 CRITICAL 은 없다. 유일한 실질 지적은 `plan/in-progress/eia-context-schema-followups.md` 의 완료 노트가 동일 PR 내 fresh ai-review(19_49_01) 에서 적용된 I1(`EIA_` 접두)·I2(spread→직접 참조) 수정 **이전** 상태의 상수명/문법을 그대로 서술한 채 사후 동기화되지 않은 것(WARNING) — 런타임 영향은 없으나 완료 기록의 정확성 문제로 정정을 권한다. 나머지는 swagger.md §5-1 이 신규 `*.literal.ts` 헬퍼 파일 패턴을 아직 다루지 않는 회색지대(INFO, 이미 별 리뷰어가 지적·비차단 판정)와 그 후속이 실제 plan backlog 항목으로 등재되지 않은 점(INFO) 뿐이다.

## 위험도

LOW
