# Cross-Spec 일관성 검토 — spec/5-system/ (--impl-prep, masking-gate-consolidation)

## 검토 방법 메모

프롬프트 번들은 예산 초과로 `spec/5-system/` 18개 파일 중 3개(`1-auth.md`·`2-api-convention.md`·
`3-error-handling.md`)만 본문이 포함되고, 이번 작업(`inputData`/`outputData`/`error` 마스킹 게이트
통합)과 직접 관련된 `4-execution-engine.md`·`14-external-interaction-api.md` 는 절단됐다. "관련 spec
본문" 섹션도 `spec/0-overview.md` 1개만 온전하고 `spec/1-data-model.md` 를 포함한 나머지 ~90개 파일이
전부 절단됐다. 프롬프트 자신의 지시("판정에 관련되면 Read 로 직접 열어라")에 따라 아래 파일을 실제
저장소에서 직접 열어 대조했다:

- `spec/conventions/egress-masking.md`
- `spec/5-system/14-external-interaction-api.md` §R17 (전문)
- `spec/1-data-model.md` §2.14 (`NodeExecution`/`Execution.error` 관계)
- `spec/5-system/2-api-convention.md` §5.4 (부재 표현)
- `spec/5-system/3-error-handling.md` (`MASKED_VALUE_RESUBMITTED` 등재)
- 실제 코드 `codebase/backend/src/shared/utils/redact-stored-error.ts` (이미 uncommitted 수정 상태로
  `redactStoredFieldsForResponse`/`redactNodeExecutionRow` 헬퍼가 구현돼 있음) + 호출부
  (`executions.service.ts`/`background-runs.service.ts`)

## 발견사항

- **[INFO]** impl-prep 번들 예산이 이번 작업과 무관한 파일(`1-auth.md` 등)에 소진되어 관련 파일이 전량 절단됨
  - target 위치: `review/consistency/2026/08/23/13_55_36/_prompts/cross_spec.md` 상단 "⚠️ 컨텍스트 예산
    초과로 생략된 파일 15개" 목록 + "관련 spec 본문" 섹션 전체(거의 전량 절단)
  - 충돌 대상: 없음(내용 충돌이 아니라 **커버리지 갭**) — `spec/5-system/4-execution-engine.md`,
    `spec/5-system/14-external-interaction-api.md`(마스킹 정책의 실제 SoT `§R17` 소재), 그리고
    "관련 spec" 축의 `spec/1-data-model.md` 등 거의 전부가 번들에 없다
  - 상세: scope=`spec/5-system/`인데 번들링이 파일명/순번 순서로 채워지는 듯하며, 이번 작업(마스킹
    게이트 통합)의 실제 SoT 인 `§R17`(`14-external-interaction-api.md`)이 아니라 무관한 `1-auth.md`가
    예산을 다 쓴다. Cross-Spec 검토자가 번들만 보고 판정하면 "관련 spec 없음"으로 오판할 위험이 있다
    (기존 메모리 패턴 `feedback_consistency_spec_mode_budget.md`의 `--impl-prep` 판)
  - 제안: 번들링 정책을 `code:` frontmatter 글롭·plan 의 실제 diff 대상과 겹치는 파일을 우선순위로
    정렬하도록 개선 검토. 본 세션은 직접 `Read` 로 갭을 메웠으므로 이번 판정 자체는 영향 없음.

- **[정보성 확인 — 충돌 없음]** 마스킹 게이트 4곳 통합(`plan/in-progress/masking-gate-consolidation.md`)이
  실제로 겨냥하는 SoT(`spec/5-system/14-external-interaction-api.md` §R17)와 코드 상태를 대조한 결과
  **모순 없음**
  - target 위치: 번들에는 없음(직접 Read) — `spec/5-system/14-external-interaction-api.md` §R17
    "적용 범위는 총칭이 아니라 열거다" (line 1532~1545)
  - 충돌 대상: `spec/1-data-model.md` §2.14 `Execution.error ↔ NodeExecution.error 관계` 표,
    `spec/5-system/2-api-convention.md` §5.4(부재 표현 `null` 기본), `spec/5-system/3-error-handling.md`
    (`MASKED_VALUE_RESUBMITTED` details 코드), `spec/conventions/egress-masking.md`
  - 상세: §R17 은 표면 **여섯**(`findById`·`getChain`·`stop`·`toExecutionDto`·`findById`의
    `nodeExecutions[]`·`BackgroundRunsService.toNodeExecutionDto`) · 컬럼 **둘**(`error`→
    `redactStoredErrorForResponse`, `outputData`→`redactStoredDataForResponse`)로 이미 정정돼 있고,
    실제 코드(`redact-stored-error.ts`, 현재 uncommitted 로 헬퍼 2개 신설됨)의 호출 지점도 이와
    정확히 일치한다(`toResponseExecution` 이 `findById`/`getChain`/`stop` 세 표면을 한 관문으로 흡수 →
    plan 이 측정한 "4곳"과 §R17 의 "여섯 표면"은 같은 것을 다른 축(구성 호출부 vs 소비 표면)으로 센
    것이라 모순이 아님). `2-api-convention.md` §5.4 의 "기본은 `null`" 원칙도 헬퍼의 부재→`null`
    정규화와 일치. `3-error-handling.md` 의 `MASKED_VALUE_RESUBMITTED` 항목도 §R17 을 SoT 로 인용해
    일관. data-model.md §2.14 도 표면 열거를 §R17 로 위임(중복 서술 금지)해 두 문서가 서로를 침범하지
    않는다.
  - 제안: 없음(교정 불요) — 참고로 남긴다.

- **[정보성]** 번들의 실제 본문(`1-auth.md`/`2-api-convention.md`/`3-error-handling.md`)은 이번 마스킹
  게이트 통합 작업과 도메인이 겹치지 않는다
  - target 위치: `spec/5-system/1-auth.md` 전체(§1~§4, RBAC 매트릭스 §3.2, 감사 액션 §4.1 등)
  - 충돌 대상: 없음
  - 상세: 검토 범위 안에서 읽은 한 `1-auth.md`는 이미 다수의 과거 `--impl-prep` CRITICAL(예: §3.2
    "멤버 관리" Admin 열 CRU→CRUD 정정, §2.3 재인증 흐름 정합화)을 각주·Rationale 로 반영해 자기
    정합적이며, 데이터 모델·RBAC·감사 규약과의 상호 참조도 명시적 포인터로 연결돼 있어 새로 발견되는
    모순은 없었다. 다만 이 문서가 이번 target 번들의 대부분을 차지한 것은 위 INFO 항목의 원인이다.
  - 제안: 없음.

## 요약

이번 세션에서 실제로 관련도가 높은 마스킹 정책 SoT(`spec/5-system/14-external-interaction-api.md`
§R17, `spec/conventions/egress-masking.md`, `spec/1-data-model.md` §2.14, `spec/5-system/
2-api-convention.md` §5.4, `spec/5-system/3-error-handling.md`)를 직접 열람해 대조한 결과 데이터
모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 CRITICAL/WARNING 급 충돌은
발견되지 않았다 — `masking-gate-consolidation` 작업이 이미 반영한 헬퍼 설계(`redactStoredFieldsForResponse`
/`redactNodeExecutionRow`, 표면 여섯·컬럼 둘)는 §R17 이 정본으로 기록한 좌표계와 정확히 일치한다.
다만 impl-prep 번들 자체가 예산 초과로 이번 작업과 무관한 `1-auth.md` 등에 예산을 소진해 정작 관련
파일(`14-external-interaction-api.md`·`4-execution-engine.md`)과 "관련 spec" 축 거의 전부(`spec/
1-data-model.md` 포함)를 누락시킨 점은 프로세스 갭으로 별도 기록해 둔다(이번 판정은 직접 `Read` 로
메웠으므로 결론에는 영향 없음).

## 위험도

LOW
