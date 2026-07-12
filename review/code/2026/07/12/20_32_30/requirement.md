# 요구사항(Requirement) 리뷰

## 발견사항

- **[WARNING]** 신규 `interact-ack-response.dto.spec.ts` 및 `InteractAckDto` class JSDoc 이 주장하는 "EIA §5.4 준수"가 spec 본문과 실제로 불일치 (spec fidelity)
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/interact-ack-response.dto.ts` 클래스 JSDoc(`[Spec EIA §5.1 / §5.4]`) 및 신규 `interact-ack-response.dto.spec.ts` JSDoc(`계약 SoT: ... EIA §5.1 / §5.4`) ↔ `spec/5-system/14-external-interaction-api.md` §5.4(L493-497) · §5(전송 봉투 콜아웃, L273) · Rationale R16(L1123-1127)
  - 상세: `POST /:executionId/cancel` 컨트롤러(`interaction.controller.ts:109-135`)와 `InteractionService.cancel()`(`interaction.service.ts:193-201`)은 실제로 `InteractAckDto` 를 그대로 반환하며 `{ executionId: string, accepted: true, currentStatus: 'cancelled' }` 형태다(직접 코드 확인). 그런데 spec §5.4 본문은
    ```
    202 Accepted
    { "executionId": "uuid", "status": "cancelled" | "running" }
    ```
    로 **다른 필드명(`status`≠`currentStatus`)·`accepted` 필드 부재·2값으로 제한된 enum**을 명시하고, 이는 우연한 표기가 아니라 §5 전송 봉투 콜아웃과 Rationale R16 두 곳에서 각각 "§5.1 `InteractAckDto` `{ executionId, accepted, currentStatus }`, §5.4 `{ executionId, status }`" 로 **의도적으로 구분**해 반복 서술한다. 즉 spec 은 `/interact` 와 `/cancel` 의 ack shape 를 서로 다른 것으로 설계 문서화했으나, 실제 구현은 두 endpoint 모두 동일한 `InteractAckDto`(3필드, 6값 enum) 를 공유한다. 이번 diff 가 새로 추가한 `interact-ack-response.dto.spec.ts` 는 이 DTO 의 OpenAPI 스키마(swagger 반영 상태)만 검증할 뿐 spec 본문의 문언(`status` 필드명·2값 제한)과의 line-level 일치는 검증하지 않으며, class/spec 양쪽 JSDoc 은 "§5.4 를 만족한다"고 주장한다 — 이 주장이 실제로는 부정확하다.
  - 참고: 이 DTO 3필드 shape 자체(및 `/cancel` 이 동일 DTO 를 재사용하는 결정)는 이번 diff 이전부터 존재했고(diff 는 `currentStatus`/`status` 필드의 enum **타입 출처**만 공유 SoT 로 치환), 3회에 걸친 이전 리뷰 라운드(19_49_01/20_08_27 requirement/scope/api_contract 등)도 "§5.1/§5.4 wire 형태·필드명 모두 spec 서술과 일치"라고 판정했는데 실제로는 §5.4 쪽 필드명이 불일치함을 놓쳤다.
  - 판단(방향 불명확 — SPEC-DRIFT 미태깅): 코드(controller `편의 alias` 문구 + 서비스 구현 + 두 endpoint 가 하나의 DTO/decorator 조합(`@ApiAcceptedWrappedResponse(InteractAckDto)`)을 공유)가 일관되게 "두 endpoint 는 동일 ack shape" 를 의도한 것으로 보이나, spec Rationale R16 은 두 shape 를 의도적으로 분리 서술해 판단이 갈린다 — 실수(코드가 spec 의 leaner cancel-ack 설계를 못 따라간 것)인지, 의도된 단순화(spec 갱신 누락)인지 이 리뷰만으로 단정 불가. 사람 판단 필요.
  - 제안: `project-planner` 트랙에서 (a) spec §5.4·§5(전송 봉투 콜아웃)·R16 세 곳을 실제 구현(`InteractAckDto` 3필드 공유)에 맞춰 갱신하거나, (b) 실제로 `/cancel` 전용 leaner ack DTO(`{executionId, status}`)가 필요하다고 판단되면 `developer` 트랙에서 별도 DTO 분리를 검토 — 어느 쪽이든 현재 상태(문서와 코드가 서로 다른 shape 를 주장)로 방치하면 안 됨.

- **[INFO]** (범위 밖, 참고) `InteractionService.cancel()` 이 `currentStatus` 를 항상 `'cancelled'` 로 하드코딩 — spec 이 서술하는 `'running'` 분기와 잠재적 불일치
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:193-201` (이번 diff 미변경 파일)
  - 상세: spec §5.4 는 "동기 처리 시 cancelled, 비동기 처리 중일 때 running" 이라 서술하는데, `cancel()` 은 `executionsService.stop()` 결과를 재조회하지 않고 즉시 `currentStatus: 'cancelled'` 를 반환한다. 반면 `interact()` 의 `command:'cancel'` 분기(§5.1 과 "동치"로 spec 이 명시)는 실행 후 DB 를 재조회해 `refreshed?.status ?? 'running'` 을 반환한다(L181-190) — "동치" 라는 EIA-IN-05 서술과 달리 두 경로가 실제로 다른 값을 낼 수 있다. `executionsService.stop()` 자체가 `waiting_for_input` 상태에서 fan-out 비동기 publish 로 처리됨(즉시 재조회해도 여전히 running/pending 일 수 있음, `executions.service.ts:752-761` 주석)을 볼 때 이 하드코딩은 낙관적 값일 가능성이 있다.
  - 이번 diff 는 이 파일을 건드리지 않았으므로(순수 enum-SoT 리팩터 범위 밖) 이번 리뷰의 차단 사유는 아니나, 위 WARNING 과 연관된 근본 원인일 수 있어 기록으로 남김.
  - 제안: 조치 불요(이번 diff 범위 밖). 위 WARNING 후속 조사 시 함께 검토 권장.

## 검증 사항 (문제 없음)

- **기능 완전성**: `execution-status.literal.ts` 신설(`EIA_EXECUTION_STATUS_VALUES` as const + `ExecutionStatusLiteral`) + `ExecutionStatusDto.status`/`InteractAckDto.currentStatus` 참조 치환은 plan 백로그 항목("EIA 응답 DTO `status` 리터럴 유니온 SoT 통합")이 요구한 범위를 정확히 충족. 값·순서 모두 리팩터 이전과 100% 동일(diff 대조 확인) — 순수 behavior-preserving. 3회 리뷰 라운드에 걸쳐 지적된 WARNING(신규 SoT 값 미검증, `InteractAckDto` 스키마 회귀 부재, drift 가드의 순서-회귀 무음 통과, plan 완료 노트 stale)이 모두 최종 상태에서 해소돼 있음을 직접 재실행으로 확인(`npx jest execution-status-response.dto.spec.ts execution-status.literal.spec.ts interact-ack-response.dto.spec.ts` → 3 suites / 21 tests 전부 green).
- **엣지 케이스**: enum 은 고정 6값 집합. `execution-status.literal.spec.ts` 의 하드코딩 순서 pin + 엔티티 집합 동등성(순서-무관) 두 테스트가 값 추가/누락·순서 회귀 양쪽을 커버.
- **TODO/FIXME**: 대상 diff(파일 1~7) 내 TODO/FIXME/HACK/XXX 주석 없음.
- **의도와 구현 간 괴리**: `execution-status.literal.ts` JSDoc 의 세 가지 근거 — (a) `EIA_` 접두(동명 `explore-tools.service.ts::EXECUTION_STATUS_VALUES` 와의 grep 혼동 회피), (b) `Literal` 접미(엔티티 `ExecutionStatus` 와의 이름 충돌 회피), (c) 엔티티 enum 비파생 이유(레이어 결합 회피 + 순서 보존) — 모두 코드로 직접 대조 확인함(`execution.entity.ts:14-21` 의 실제 선언 순서가 wire 순서와 다름을 재확인).
- **에러 시나리오**: 응답 DTO(문서화 계층)라 별도 에러 처리 로직 변경 없음 — 해당 없음.
- **데이터 유효성**: 응답 DTO 는 request validation 대상이 아님 — `class-validator` 데코레이터 부재는 리팩터 이전과 동일, 변경 없음.
- **비즈니스 로직**: `ExecutionStatusDto.status`/`InteractAckDto.currentStatus` 가 노출하는 6개 상태값 집합이 `Execution.status` 엔티티 enum 과 (순서만 다르고) 집합이 완전히 일치함을 신규 테스트로 확인 — EIA §5.3 서술(`pending/running/waiting_for_input/completed/failed/cancelled`)과도 부합.
- **반환값**: `execution-status.literal.ts` 는 `as const` 배열 + 파생 타입만 export — 함수 없음, 반환값 이슈 대상 아님. `tsc --noEmit` 로 타입 컴파일 확인(별도 실행, 에러 0).

## 요약

`execution-status.literal.ts` 신설로 `ExecutionStatusDto.status`/`InteractAckDto.currentStatus` 의 중복 6값 상태 리터럴 유니온을 단일 SoT 로 통합한 순수 behavior-preserving 리팩터로, plan 백로그 요구사항을 정확히 충족하며 이전 2회 리뷰 라운드가 지적한 모든 WARNING(SoT 값 미검증·InteractAckDto 회귀 테스트 부재·순서-drift 무음 통과·plan 노트 stale)이 실제로 해소됐음을 재실행 검증했다(21 tests green, CRITICAL 없음). 다만 이번 리뷰에서 새로 발견한 사항으로, 신규 `interact-ack-response.dto.spec.ts`/DTO JSDoc 이 명시적으로 주장하는 "EIA §5.4 준수"가 실제 spec 본문(및 Rationale R16)이 서술하는 `/cancel` ack shape(`{executionId, status}`, 2값 제한)와 실제 구현(`InteractAckDto` 공유, `{executionId, accepted, currentStatus}`, 6값)이 서로 다르다는 점을 확인했다 — 이 DTO shape 자체는 이번 diff 이전부터 있었고 이전 3회 리뷰 라운드가 모두 "일치"로 오판했던 지점이다. 방향(코드 vs spec 중 무엇이 갱신돼야 하는지)이 이 리뷰만으로는 명확하지 않아 SPEC-DRIFT 로 단정하지 않고 WARNING 으로 표기, planner 트랙 검토를 권한다. 부수적으로 `cancel()` 서비스가 `currentStatus` 를 항상 `'cancelled'` 로 하드코딩하는 점(spec 의 `running` 분기와 잠재 불일치)은 이번 diff 미변경 파일이라 범위 밖 INFO 로만 기록한다.

## 위험도

LOW
