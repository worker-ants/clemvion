# Rationale 연속성 검토 — error-code-emission-axis

## 검토 대상

- `plan/in-progress/error-code-emission-axis.md` (구현 착수 전 계획 — `spec_impact: none`)
- 계획이 수정 대상으로 삼는 `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`
- 대조 축: `spec/conventions/error-codes.md` `## Rationale`, `spec/5-system/3-error-handling.md §1.4`
  `## Rationale`, `spec/conventions/user-guide-evidence.md` `## Rationale`, 및 과거 소비 리뷰
  `review/consistency/2026/09/13/11_33_51/naming_collision.md`

(주: prompt 번들의 `spec/conventions/error-codes.md`·`user-guide-evidence.md` 본문은 컨텍스트
예산 초과로 생략돼 있어, 두 파일과 관련 코드를 디스크에서 직접 읽어 검토했다.)

## 발견사항

- **[WARNING] "메시지 접두는 코드가 아니다" 라는 계획의 전제가 §1.4 의 기존 카탈로그 관행과
  정합하지 않는다**
  - target 위치: `plan/in-progress/error-code-emission-axis.md` §D ("가이드가 «코드» 라고 적은
    것이 코드가 아니다" — `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 을 "동작은 안
    바꾼다" 는 전제 하에 가이드 문장만 정정)
  - 과거 결정 출처: [`5-system/3-error-handling.md §1.4`](spec/5-system/3-error-handling.md) 표
    머리말 — "이 표는 단일 등재처를 뜻하지 않는다... **나머지 7종은 앵커 없는 맨 문자열**이라
    오탈자가 `tsc` 를 통과한다"
  - 상세: §1.4 카탈로그는 `RECURSION_DEPTH_EXCEEDED`·`MAX_ITERATIONS_EXCEEDED`·
    `CYCLE_DETECTED`·`INVALID_EXPRESSION`·`VARIABLE_NOT_FOUND`·`TYPE_MISMATCH` 를 "엔진 수준
    에러(`execution status → failed`)" 로 **정식 등재**하면서 앵커가 "없음"(= `ErrorCode`/
    `EngineErrorCode` enum 도 아니고 에러 클래스 `readonly code` 도 아님)이라고 명시한다.
    실측 결과 이 앵커-없음 코드들의 실제 방출 경로도 `CONTAINER_MISSING_EMIT`/
    `CONTAINER_MULTIPLE_EMIT` 와 동형이다 — `loop-executor.ts:64,85` 는
    `throw new Error('MAX_ITERATIONS_EXCEEDED: ...')` 로 일반 `Error` 를 던지고,
    `execution-engine.service.ts` 의 `finalizeFailedExecution`(L5006-5015)은 **`ErrorPortFallbackError`
    와 `ExecutionTimeLimitError` 두 sentinel 타입만** `savedExecution.error.code` 로 보존하도록
    **의도적으로 좁혀 놓았다**(주석: "임의 Error 의 우발적 `.code` 가 Execution.error 로
    누수되지 않도록"). 즉 `MAX_ITERATIONS_EXCEEDED` 도 `CONTAINER_MISSING_EMIT` 과 마찬가지로
    `error.code` 필드에는 결코 실리지 않고 `error.message` 안의 텍스트로만 존재하는데, 전자는
    §1.4 에 정식 카탈로그 항목으로 등재돼 있고 후자(`CONTAINER_MISSING_EMIT`/
    `CONTAINER_MULTIPLE_EMIT`, `spec/4-nodes/1-logic/0-common.md` 등 노드 spec 5곳 + §3.0 에서
    "…에러로 실행 실패" 로 서술)는 등재돼 있지 않다. 계획이 "코드가 아니다" 로 단정하고
    가이드 문장만 고치는 것은, 같은 방출 형태를 가진 형제 6종을 §1 이 이미 "코드" 로 취급해 온
    기존 관행과 **암묵적으로 어긋난다** — CONTAINER_MISSING_EMIT/MULTIPLE_EMIT 이 "코드가
    아니다" 가 아니라 "`.code` 필드로는 안 나가는(앵커 없는) 엔진 수준 코드" 라는, §1.4 가 이미
    쓰고 있는 더 정확한 분류가 있는데도 계획은 이를 참조하지 않는다.
  - 제안: (a) §D 의 결론(문장만 고치고 동작은 안 바꾼다) 자체는 유지하되, "코드가 아니다" 대신
    "§1.4 형태의 앵커-없는 엔진 수준 코드이며 `error.code` 필드로는 방출되지 않는다" 로 서술을
    정정할 것. (b) 그 김에 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 을 §1.4 카탈로그에
    형제 6종과 나란히 **등재**하는 것을 별도 체크리스트 항목으로 남길 것(엔진 동작 변경이 아니라
    문서 완결성 pass이므로 §D 가 "별 배치" 로 미룬 "엔진이 전용 코드를 방출하게 하는 것"과는
    다른, 훨씬 저비용인 작업이다 — `3-error-handling.md` 의 기존 "§1 카탈로그 완결성" Rationale
    항목들이 이런 backfill 을 정상 관행으로 이미 여러 차례 수행했다).

- **[INFO] `GUIDE_NON_EMITTED_VOCABULARY` 는 `#1330` "허용목록 없음" 원칙의 두 번째 번복이다 —
  선례 링크를 코드에 명시할 것**
  - target 위치: `plan/in-progress/error-code-emission-axis.md` §C
  - 과거 결정 출처: `guide-identifier-scan.ts` 상단 주석 "허용목록을 둔다 — 그리고 그 결정의
    대가를 적는다" (`#1330` 의 "허용목록 없음" 원칙을 `GUIDE_EXTERNAL_VOCABULARY` 도입으로 이미
    한 번 번복한 자리)
  - 상세: 이번 계획은 같은 원칙을 **다시** 번복해 두 번째 허용목록(`GUIDE_NON_EMITTED_VOCABULARY`)을
    도입한다. 계획 자체는 실측 근거(§A/§B)와 대칭 제약(§C, "기준집합에 **있을 것**" vs 기존의
    "**없을 것**")을 명시해 두 목록이 서로 다른 결함 축을 덮는다는 것을 정확히 설명하므로
    "무근거 번복" 은 아니다. 다만 이는 같은 원칙에 대한 **두 번째** 예외이므로, 새 목록의 코드
    주석이 "이것이 `#1330` 원칙의 첫 번째 예외(`GUIDE_EXTERNAL_VOCABULARY`)에 이은 두 번째
    예외이며 왜 통합하지 않는지" 를 `guide-identifier-scan.ts` 자신의 기존 설명을 인용하는
    형태로 명시하면, 다음 사람이 "허용목록이 세 번째로 늘 때" 그 판단 기준(대칭 제약·통합 불가
    사유)을 재구성하지 않고 참조할 수 있다.
  - 제안: `GUIDE_NON_EMITTED_VOCABULARY` 선언부 주석에 "`GUIDE_EXTERNAL_VOCABULARY` 도입 시
    번복한 `#1330` 원칙의 두 번째 적용" 이라는 한 줄을 남길 것 (차단 사유는 아니며 문서 완결성
    제안).

## 확인했으나 위반이 아닌 것 (기록용)

- **AST 축 폐기**: 계획 §B 는 `guide-identifier-scan.ts` 자신이 "트래커에 등재돼 있다" 고 적어 둔
  AST 기반 방출-위치 특정 축을 실측(오탐 0·미탐 0)으로 기각한다. 이는 `#970` "유한한 문제를
  무한한 문제와 바꾸지 말 것" 원칙과 **정합**하며, 트래커 예고를 반증으로 정정하는 것이지 과거에
  거부된 대안을 근거 없이 되살리는 것이 아니다.
- **MAKESHOP_UNRESOLVED_PATH_PARAM 처분**: 계획이 인용한 선행 CRITICAL
  (`review/consistency/2026/09/13/11_33_51/naming_collision.md`)과 `makeshop.handler.ts:358-360`
  실코드를 대조한 결과 인용이 정확했다 — 지어낸 이력이 아니다. 그 CRITICAL 이 제시한 두 대안(문장
  정정 vs `IntegrationError` 로 코드 정정) 중 전자를 택한 것도 그 리포트 자체의 제안 범위 안이다.
- **"존재 vs 방출" 축**: `spec/` 전체에서 이 구분을 선언한 기존 Rationale 이 없어(grep 0건),
  계획이 기존에 다르게 결정된 축을 뒤집는 것이 아니라 새로 도입하는 것이다.

## 요약

계획은 실측 기반으로 매우 꼼꼼하게 근거를 쌓았고, 과거에 명시적으로 기각된 대안을 근거 없이
되살리거나 합의된 설계 원칙을 정면으로 위반하는 지점은 발견되지 않았다. 다만 §D 의 "가이드가
적은 코드가 실제로는 코드가 아니다" 라는 결론은, §1.4 가 이미 형제 격의 앵커-없는 엔진 수준
코드 6종(`MAX_ITERATIONS_EXCEEDED` 등, 방출 형태가 `CONTAINER_MISSING_EMIT`/
`CONTAINER_MULTIPLE_EMIT` 과 동형임을 실측으로 확인함)을 정식 카탈로그 항목으로 취급해 온
기존 관행과 어긋나므로, 서술을 "앵커 없는 카탈로그 코드" 로 정정하고 §1.4 등재를 별도
follow-up 으로 남기는 것을 권한다. `GUIDE_NON_EMITTED_VOCABULARY` 는 `#1330` 원칙의 두 번째
예외라는 계보를 코드 주석에 한 줄 더 남기면 연속성이 더 분명해진다. 두 건 모두 계획을 막을
정도는 아니다.

## 위험도

LOW
