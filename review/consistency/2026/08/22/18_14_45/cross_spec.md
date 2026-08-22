# Cross-Spec 일관성 검토 — `spec-draft-egress-masking-convention.md`

## 검토 방법

target plan 문서(`plan/in-progress/spec-draft-egress-masking-convention.md`)의 "실측한 좌표계" 표(5행)를
실제 코드(`@workflow/masked-markers/src/index.ts`, `sanitize-error-message.ts`,
`websocket.service.ts`, `strip-external-only-fields.ts`, `masked-markers.ts`)와 대조하고,
"소유하지 않는다" 표가 가리키는 각 spec 문서(`spec/5-system/14-external-interaction-api.md §R17`,
`spec/conventions/node-output.md §Principle 7`, `spec/conventions/error-codes.md §4.2`)의 실제 본문을
직접 열어 대조했다. 프롬프트 번들에 포함되지 않은 `spec/conventions/**` 전체와 `spec/1-data-model.md`
(예산 초과로 생략)는 `Read`/`grep` 으로 직접 열었다.

## 발견사항

- **[WARNING]** 좌표계 표 2·3행의 "값" 열 표기 `= 1` 이 리터럴 값 1 로 오독될 수 있다
  - target 위치: `plan/in-progress/spec-draft-egress-masking-convention.md` §"실측한 좌표계" 표
    (`| 2 | MAX_REDACT_DEPTH (backend 지역 별칭 = 1) | = 1 | ... |`,
    `| 3 | (프런트는 ... MAX_MASK_DEPTH 직접 사용) | = 1 | ... |`)
  - 충돌 대상: 같은 문서 바로 아래 캐비엇("2·4는 값이 같고 ... 둘 다 10")과 실제 코드
    (`sanitize-error-message.ts:128 export const MAX_REDACT_DEPTH = MAX_MASK_DEPTH;` →
    `masked-markers/src/index.ts:81 export const MAX_MASK_DEPTH = 10;`)
  - 상세: 표의 "값" 열에 두 번 등장하는 `= 1` 은 문맥상 "1번 행(= `MAX_MASK_DEPTH`)과 같은 값"이라는
    **행-참조 축약 표기**로 읽힌다(실측 결과 MAX_REDACT_DEPTH·프런트 사용값 모두 10 으로 확인, 표
    바로 아래 캐비엇이 이를 명시). 그러나 이 표기는 리터럴 정수 `1`과 구분되지 않는다 — 표만
    보고 문단을 안 읽으면 "MAX_REDACT_DEPTH = 1" 로 오독하기 쉽다. 이 문서가 존재하는 이유
    자체가 "좌표계 혼동이 CRITICAL 을 낸 전례"(`15_35_56` naming_collision, 실재 확인함)를
    막기 위함인데, 정작 그 좌표계를 적는 표 안에 같은 오독 소지를 남기면 목적이 스스로
    반증된다.
  - 제안: `spec/conventions/egress-masking.md` 신설 시 이 값 열은 리터럴 숫자(`10`)로 쓰거나,
    행-참조가 필요하면 "10 (1행과 동일 — `MAX_MASK_DEPTH` 별칭)"처럼 숫자와 참조를 함께 적어
    단독으로 오독되는 표기를 피한다.

- **[WARNING]** 새 문서명 `egress-masking.md` 가 이미 존재하는 별개의 "AuthConfig 마스킹" SoT
  와 용어·주제가 겹쳐 보일 수 있다
  - target 위치: target 문서 §Overview("egress 마스킹 좌표계를 정식 conventions 문서로
    승격") 및 제안 파일 경로 `spec/conventions/egress-masking.md`
  - 충돌 대상: `spec/1-data-model.md` §2.17.2 "마스킹·노출 정책" (`AuthConfig.config` 의
    `***<last4>` 형태 필드 마스킹, "본 §2.17.2 가 **AuthConfig 마스킹 정책의 단일 진실**"
    이라고 자체 선언)
  - 상세: 두 마스킹 체계는 메커니즘·엔티티·소비처가 완전히 다르다 — target 이 다루는 것은
    실행 I/O(에러·output·conversation thread 등) 안에 우연히 박힌 자격증명 **패턴**을
    깊이 상한 안에서 스캔·치환하는 것이고, §2.17.2 는 `AuthConfig` 리소스의 **지정된 필드**
    (`config.key`/`token`/`secret`/`password`)를 `***<last4>` 로 고정 마스킹하는 것이다.
    target 의 "소유하지 않는다" 표(4행)는 이 §2.17.2 를 언급하지 않는데, 파일명이 범용적인
    "egress-masking"이라 향후 독자·작성자가 "모든 egress 마스킹의 SoT"로 오인하고 §2.17.2
    범위까지 이 문서가 다룬다고 가정하거나, 반대로 §2.17.2 작성자가 신규 마스킹 관련 결정을
    적을 때 이 신설 문서 대신 계속 개별 파일에 흩뿌릴 위험이 있다. `spec/conventions/secret-store.md`
    는 이미 이런 혼동을 막기 위해 "비대상" 콜아웃(§AuthConfig.config 는 본 scheme 대상 아님,
    응답 마스킹 SoT 는 데이터 모델 §2.17.2)을 명시적으로 두는 선례가 있다.
  - 제안: 신설 문서의 Overview 에 "비대상 — `AuthConfig.config` 필드 마스킹은 본 문서가 아니라
    [`1-data-model.md §2.17.2`](../1-data-model.md#2172-마스킹노출-정책)가 SoT"라는 한 줄
    캐비엇을 추가해 두 체계의 경계를 명시한다(프로젝트가 이미 쓰는 "비대상" 관용구와 동형).

- **[INFO]** 동일 파일(`14-external-interaction-api.md`, `6-websocket-protocol.md`)을 건드리는
  병행 세션 2건 존재 — 병합 시 라인 충돌 가능성(내용 충돌 아님)
  - target 위치: target 문서 frontmatter `spec_impact`
    (`spec/5-system/14-external-interaction-api.md`)
  - 충돌 대상: `plan/in-progress/spec-draft-eia-62-waiting-payload.md` ·
    `plan/in-progress/spec-draft-eia-notification-payload-contract.md`
    (둘 다 `worktree: eia-r8-cache-scope-4ae434`, 같은 두 파일을 `spec_impact` 에 등재)
  - 상세: 두 병행 plan 은 EIA §6.2~§6.5 의 **payload 필드 집합/봉투(envelope) 정규화**를
    다루며 target 의 §R17 마스킹 좌표계 인입 포인터 추가와 **주제는 겹치지 않는다** — 의미
    충돌은 없다. 다만 같은 섹션대(§6.x)를 편집할 가능성이 있어 나중에 머지하는 쪽이 git
    라인 충돌을 겪을 수 있다.
  - 제안: `/consistency-check --spec` 통과 후 실제 파일을 편집하기 직전, 위 두 plan 이 먼저
    머지됐는지 `git log origin/main -- spec/5-system/14-external-interaction-api.md` 로
    재확인한다(프로젝트의 "병렬 세션 백로그 착수 전 재판정" 관행).

- **[INFO]** `spec/conventions/swagger.md` §3 의 "egress 마스킹 대상" DTO 설명 예외가 가리킬
  구체적 SoT 링크가 지금은 없다 — 신설 문서가 그 자리를 채울 수 있다
  - target 위치: target 문서가 신설할 `spec/conventions/egress-masking.md`
  - 충돌 대상: `spec/conventions/swagger.md` §3 (2026-08-17 규약화 — "응답 값이 저장된 값과
    다를 수 있는 필드(egress 마스킹 대상 등)"는 "요약 1~2문장 + SoT 링크"로 DTO 설명을
    적으라고 규정하지만, 현재 그 SoT 링크가 4개 파일 JSDoc 산문에 흩어져 있어 가리킬 단일
    지점이 없다)
  - 상세: 충돌이 아니라 보강 기회다 — 신설 문서가 생기면 `execution-response.dto.ts` 등
    9곳 이상의 DTO 주석이 가리킬 단일 링크가 생긴다.
  - 제안: 이번 PR 범위는 아니나, 후속으로 swagger.md §3 예시에 신규 문서 링크를 추가하는
    것을 고려할 수 있다(target 의 "작업" 체크리스트에는 없음 — 강제 아님).

## 검증 결과 (반증되지 않음)

- 좌표계 표의 5행 전부(값·비교 연산자·초과 시 마커·소비처)를 실제 소스로 대조 —
  `masked-markers/src/index.ts:81`, `sanitize-error-message.ts:128,270`,
  `websocket.service.ts:80,119,422-424`, `masked-markers.ts:94-101`,
  `interaction.service.ts:112` 전부 target 서술과 **정확히 일치**한다.
- `spec/` 전수 grep 결과 `MAX_MASK_DEPTH`=0, `MAX_SANITIZE_DEPTH`=0, `isMaskedMarker`=0,
  `MAX_REDACT_DEPTH`=1(`14-external-interaction-api.md` 뿐)로 target 의 "갭 실측" 표(§도입부)와
  **정확히 일치**한다.
- "소유하지 않는다" 표의 4개 포인터(마커 값→`@workflow/masked-markers`, 마스킹 정책→EIA §R17,
  `details[].code`→`error-codes.md §4.2`, echo 금지 관계→`node-output.md`)는 각 문서의 실제
  본문과 대조해 **모두 정합**한다. 특히 `error-codes.md §4.2` 는 2026-08-22 당일 신설된
  섹션으로 target 이 인용하는 `masked_value_resubmitted`→`MASKED_VALUE_RESUBMITTED` 항목이
  실재하며 EIA §R17 을 정의 SoT 로 정확히 가리킨다.
- Rationale 의 "기각된 대안" 근거(`masked-markers/src/index.ts` 의 "합치지 않는다" JSDoc,
  `node-cancellation.md`/`execution-context.md` SoT 분리 선례, `15_35_56` naming_collision
  CRITICAL 이력)는 모두 실재 확인됨 — 지어낸 근거 없음.
- 요구사항 ID·API 계약·상태 전이·RBAC 축에서는 target 이 신규 표면을 정의하지 않아
  (순수 문서 신설 + 2개 기존 문서에 인입 포인터 추가) 해당 축의 충돌 후보가 없다.

## 요약

target 은 매우 높은 정확도로 실측된 문서다 — 좌표계 표의 모든 셀이 실제 소스 코드와
정확히 대조되며, "소유하지 않는다" 포인터도 각 대상 spec 문서의 실제 내용과 정합한다.
Cross-spec 관점에서 발견된 문제는 직접적 모순(CRITICAL)이 아니라 두 종류의 **모호성
위험**이다 — (1) 좌표계 표 자체의 "= 1" 표기가 이 문서의 존재 이유(좌표계 오독 방지)와
반대로 오독을 유발할 수 있다는 자기지시적 위험, (2) 새 문서의 범용적인 이름이 이미
존재하는 완전히 다른 마스킹 체계(`1-data-model.md §2.17.2` AuthConfig 필드 마스킹)와
경계가 불분명해질 위험. 둘 다 실제 신설 문서 작성 시 한두 문장으로 해소 가능한 수준이며,
병행 세션과의 파일 중첩은 내용 충돌이 아니라 머지 순서 문제다.

## 위험도

LOW
