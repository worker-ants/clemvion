# 테스트(Testing) 리뷰

## 개요

이번 diff 는 두 차례 리뷰 라운드(`19_25_39` → `19_36_12`)를 거쳐 수렴한 뒤, 마지막 커밋
(`4a1c8bc48` — Swagger description 을 `swagger.md §3` 형식(요약 + SoT 링크)으로 압축)까지
누적 반영된 상태다. 코드 파일 4개(`trigger-parameter.types.ts`, `resolve-trigger-parameters.ts`,
`re-run.dto.ts`, `workflows.controller.ts`) 모두 실행되는 문(statement)·조건식·반환값·시그니처
변경은 여전히 0줄이며, 소스를 직접 열어 대조해 확인했다.

독립 검증으로 다음을 실행했다(이전 두 라운드가 "커버됨"으로 판정한 spec 을 실제로 재실행):

```
npx jest resolve-trigger-parameters.spec.ts workflows.controller.spec.ts \
  masked-reject-callers.spec.ts reject-masked-resubmission.spec.ts
```

→ 4개 스위트 전부 GREEN (합계 80 테스트 통과). `REASON_TO_DETAIL` 4종 매핑
(`missing_required`/`coerce_failed`/`invalid_schema`/`masked_value_resubmitted`)을 나란히
단언하는 테스트(`resolve-trigger-parameters.spec.ts` `toTriggerParameterErrorDetails` describe
블록), `workflows.controller.spec.ts` 의 `details[0].code === 'MASKED_VALUE_RESUBMITTED'` 단언,
`masked-reject-callers.spec.ts` 의 "블록 주석 속 예시"·"접두 겹침 오탐 방지" 캐너리가 실존하고
GREEN 임을 실측으로 재확인했다.

## 발견사항

- **[INFO]** 신규 테스트 불필요 — 실행으로 재확인됨
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
    (`REASON_TO_DETAIL`, 게이트 40-68), `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts`
    (게이트 100-124), `codebase/backend/src/modules/executions/dto/re-run.dto.ts` (게이트 18-26),
    `codebase/backend/src/modules/workflows/workflows.controller.ts` (게이트 320-322 catch 블록)
  - 상세: 4곳 모두 JSDoc·인라인 주석·Swagger `description` 문자열 변경뿐이며, 그 문서가 서술하는
    실제 동작(4가지 `reason`→`code` 매핑, `MASKED_VALUE_RESUBMITTED` 거부 배선, `details[]` 봉투
    구성)은 기존 spec 이 이미 커버하고 있음을 위 실행으로 직접 확인했다. 추가 테스트 불요.
  - 제안: 없음.

- **[INFO]** 마지막 커밋(`4a1c8bc48`, Swagger description 압축)이 어떤 테스트도 깨지 않음 — 확인됨
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts:20-24`
  - 상세: `description` 문자열이 304자 6문장에서 236자로 압축되고 마커 리터럴 3종의 verbatim
    나열이 `SoT: EIA §R17` 링크 참조로 바뀌었다. `grep -rln "ReRunRequestDto" **/*.spec.ts` 로
    확인한 결과 이 DTO 를 직접 import 해 검증하는 spec 파일이 없고(서비스/컨트롤러 spec 에서
    plain object 로 body 를 구성), Swagger description 문자열 리터럴을 단언하는 테스트도 발견되지
    않았다 — 즉 이번 텍스트 압축이 회귀시킬 수 있는 테스트가 애초에 존재하지 않는다. OpenAPI
    스냅샷 diff 테스트도 저장소에 없음(`main.ts`/`common/swagger` 만 확인, snapshot 파일 없음).
  - 제안: 없음. (참고: OpenAPI 문서 텍스트가 SDK codegen 소비처에 영향을 주는 조직이라면 스냅샷
    테스트 도입을 고려할 만하지만, 이는 이 PR 범위를 넘는 인프라 제안이다.)

- **[INFO]** 이연된 테스트 갭 2건은 이번 diff 가 만든 새 갭이 아니며 plan 에 사유와 함께 명시적으로
  계류 중 — 재확인
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` 의
    `findMaskedResubmissions`(직접 단위 테스트 부재, 상위 함수 경유 간접 커버만),
    `resolve-trigger-parameters.ts` 의 `throwIfAny` phase 경계(①raw 통과 후 무관 필드
    coerce_failed 가 resolve 를 선점하면 ②JSON 문자열 안 마커 검사가 그 요청에서 실행되지 않는
    회귀 테스트 부재)
  - 상세: `plan/complete/masked-marker-cosmetic-followups.md` "함께 하지 않는 것" 절이 착수
    조건(전자: "세 번째 소비처가 생기면", 후자: "보안 우회가 아니라 UX 엣지")과 함께 범위 밖으로
    명시했다. 이번 diff 는 두 함수의 로직을 전혀 건드리지 않았으므로 커버리지 상태에 변화가 없다.
  - 제안: 조치 불요(이미 트래킹됨). 착수 조건이 충족되면 별도 PR.

- **[INFO]** Swagger description 프로즈 ↔ 마커 상수 자동 동기화 검증 없음 — 이번 커밋이 오히려
  중복을 줄이는 방향으로 개선
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts:20-24`
  - 상세: 직전 라운드까지는 description 이 마커 리터럴(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)을
    프로즈로 verbatim 나열해 `@workflow/masked-markers` 상수와의 수동 동기화 부담이 있었다.
    마지막 커밋이 이를 "정확히 일치하는 값 leaf 는 예약어로 거부"라는 값-비의존 서술 +
    `SoT: EIA §R17` 링크로 바꿔, 마커 리터럴을 직접 언급하는 지점이 이 파일에서 **0건**이 됐다
    (grep 실측). 남은 verbatim 나열 지점(`spec/4-nodes/7-trigger/1-manual-trigger.md` §6 등)은
    이 diff 범위 밖이며 기존 spec 문서 컨벤션(`egress-masking.md §3` — "기계가 지키지 않는다")이
    이미 그 클래스를 소유한다.
  - 제안: 조치 불요.

- **[INFO]** plan/review 문서(파일 5-45)는 테스트 대상 아님, 체크리스트-실제 대응 확인
  - 위치: `plan/complete/masked-marker-cosmetic-followups.md`,
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
  - 상세: plan 이 기록한 "TEST WORKFLOW 4단계 + 타입체크 ratchet — lint / unit(backend 8,903 ·
    frontend 6,108 · web-chat 451) / build / e2e" 통과 주장은 전체 재실행으로 재검증하지 않았으나
    (비용 대비 범위 밖), 이 리뷰가 직접 실행한 타겟 spec 4개(80 테스트)는 모두 GREEN 이라 그
    주장과 상충하는 신호는 없다. `findMaskedResubmissions`/`throwIfAny` 두 항목이 "함께 하지 않는
    것"으로 명시돼 신규 테스트로 잘못 표시되지 않았음도 확인.
  - 제안: 없음.

## 요약

이번 diff(코드 4파일 + 마지막 Swagger 압축 커밋)는 실행 로직 변경이 여전히 0줄인 순수 문서화
변경이며, 새로 문서화된 내용(4가지 `reason`→`code` 매핑, 마스킹 마커 거부 배선, `details[]` 봉투
형태)을 커버한다고 주장된 기존 spec 4개(`resolve-trigger-parameters.spec.ts`,
`workflows.controller.spec.ts`, `reject-masked-resubmission.spec.ts`,
`masked-reject-callers.spec.ts`, 합계 80 테스트)를 직접 재실행해 전부 GREEN 임을 독립적으로
재확인했다. 마지막 커밋이 Swagger description 문자열을 304→236자로 압축한 것도 그 문자열을
단언하는 테스트가 저장소에 존재하지 않아 회귀 위험이 없다. 남은 테스트 갭 2건
(`findMaskedResubmissions` 직접 단위 테스트, `throwIfAny` phase 경계 회귀 테스트)은 이 PR 이전부터
존재했고 plan 에 착수 조건과 함께 명시적으로 계류 중이라 이번 diff 의 신규 결함이 아니다. 추가로
작성해야 할 테스트는 없다고 판단한다.

## 위험도

NONE
