# Cross-Spec 일관성 검토 — egress 마스킹 좌표계 spec draft

대상: `plan/in-progress/spec-draft-egress-masking-convention.md` (검토 모드: `--spec`)

## 검토 방법

target 이 인용하는 모든 교차 참조를 실제 파일에서 직접 대조했다(번들이 예산 초과로
`spec/5-system/14-external-interaction-api.md`·`spec/0-overview.md` 를 절단했으므로 두 파일은
저장소에서 직접 읽었다):

- `spec/5-system/14-external-interaction-api.md` §R17 (마커 값·정책·`hasMaskedLeaf`·`MAX_REDACT_DEPTH`·
  재제출 거부 로직 전문)
- `spec/5-system/6-websocket-protocol.md` §4.1 (값-패턴 마스킹 콜아웃), `code:` frontmatter
- `spec/conventions/node-output.md` (기존 egress 마스킹 콜아웃, `outputData` echo 금지 backstop)
- `spec/1-data-model.md` §2.17.1~§2.17.3 (`AuthConfig.config` 필드 마스킹, 별개 메커니즘 주장 검증)
- `spec/conventions/secret-store.md` (동형 "비대상" 콜아웃 선례 검증)
- `spec/conventions/error-codes.md` §4.2 (`MASKED_VALUE_RESUBMITTED` → `details[].code` 소유권 검증)
- `spec/conventions/node-cancellation.md` / `execution-context.md` (SoT 분리 선례 검증)
- `spec/3-workflow-editor/3-execution.md` (동일 파일 `code:` 중복 소유 선례, 마커 리터럴 노출 사례)
- 코드: `codebase/packages/masked-markers/src/index.ts` · `sanitize-error-message.ts` ·
  `strip-external-only-fields.ts` · `websocket.service.ts` · `interaction.service.ts`

좌표계 표(값·비교연산자·소비처·호출부 2곳)를 코드와 줄 단위로 대조한 결과, 모든 셀이 실측과
정확히 일치했다 — `MAX_REDACT_DEPTH`(`depth >= N`) vs `MAX_SANITIZE_DEPTH`(`depth > N`) 연산자
차이, `interaction.service.ts:112` 가 `MAX_REDACT_DEPTH` 를, `websocket.service.ts:422` 가
`MAX_SANITIZE_DEPTH` 를 `stripExternalOnlyFields` 에 넘기는 호출부 분리, `toFanoutEnvelope` 의
strip→routing 순서와 재마스킹 금지 근거(JSDoc 원문과 거의 동일한 서술)까지 확인됨.

## 발견사항

- **[INFO]** "마커 리터럴을 적지 않는다" 원칙이 참조 대상 문서들의 기존 관행과 대비된다
  - target 위치: 본문 81~84행 `"본 문서는 마커 리터럴을 적지 않는다..."`
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` §R17 (라인 1576~1618 부근,
    `***`/`[REDACTED]`/`[REDACTED_DEPTH]`/`MASKED_VALUE_RESUBMITTED` 리터럴을 정상적으로 다수
    인용), `spec/3-workflow-editor/3-execution.md:90` (마스킹 마커 세 문자열을 그대로 명시)
  - 상세: target 이 자신에게 부과하는 "리터럴 대신 이름" 규율은 명시적으로 "본 문서" 로 범위를
    좁혀 있어 다른 문서에 대한 요구는 아니다. 다만 target 이 마커 **값**의 주인으로 지목하는
    바로 그 EIA §R17 이 이미 세 마커 리터럴과 에러 코드를 정상적인 API 계약 서술(클라이언트가
    관찰하는 실제 wire 값)로 반복 사용 중이다. 모순은 아니지만, 향후 독자가 "왜 EIA 는 리터럴을
    쓰고 이 conventions 문서는 안 쓰는가" 를 헷갈릴 수 있다 — API 계약 서술(관찰 가능한 wire 값)과
    내부 좌표계 서술(상수 이름)의 차이라는 이유를 신설 문서에 한 줄 명시하면 혼동을 예방한다.
  - 제안: 필수 아님. 신설 문서 Overview 나 위 콜아웃에 "EIA §R17 은 wire 계약을 서술하므로
    리터럴이 정상이고, 본 문서는 내부 좌표계만 다루므로 이름을 쓴다" 정도의 한 줄을 추가하면
    독자 혼동을 없앤다.

- **[INFO]** 신설 문서의 `code:` 4파일이 기존 3개 spec 문서와 중복 소유된다 (저장소 기존 관행과 일치)
  - target 위치: `## 작업` 133~138행 `code:` 파일 목록
  - 충돌 대상: `spec/3-workflow-editor/3-execution.md`(`websocket.service.ts`),
    `spec/5-system/14-external-interaction-api.md`(`strip-external-only-fields.ts`·
    `sanitize-error-message.ts`), `spec/5-system/6-websocket-protocol.md`(`websocket.service.ts`·
    `strip-external-only-fields.ts`)
  - 상세: 4파일 모두 이미 하나 이상의 다른 spec 문서 `code:` frontmatter 에 등재돼 있다. 이는
    `spec-code-paths.test.ts` 가 존재 여부만 검사하고 배타적 소유를 강제하지 않으므로 가드
    실패는 아니며, 저장소에 이미 같은 패턴(예: EIA·WS 두 문서가 `strip-external-only-fields.ts`
    를 함께 소유)이 있어 이례적이지도 않다. target 이 "소유한다/소유하지 않는다" 표로 관점(어느
    문서가 어떤 **사실**을 서술하는가)을 이미 명확히 분리해 두었으므로 실질 충돌 위험은 낮다.
  - 제안: 조치 불요. 참고로만 남긴다.

- 그 외 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 관점에서는 target 이 기존 spec 을 변경·
  재정의하는 부분이 없다(순수 문서 신설, 기존 동작의 사후 문서화). `AuthConfig.config` 필드
  마스킹과의 "비대상" 구분(§2.17.2 SoT 주장), `error-codes.md §4.2` 로의 `details[].code` 위임,
  `node-cancellation.md`/`execution-context.md` SoT 분리 선례 인용은 모두 실제 문서 내용과
  대조해 정확했다 — 조작되거나 근거 없는 주장이 없었다.

## 요약

target 은 순수 문서 신설(기존 코드 동작의 사후 문서화)이며 데이터 모델·API 계약·요구사항 ID·상태
전이·RBAC 축에서 다른 spec 영역과 직접 모순되는 지점을 찾지 못했다. 좌표계 표의 모든 수치·연산자·
소비처·호출부는 코드와 줄 단위로 대조해 정확했고, EIA §R17·error-codes.md §4.2·secret-store.md·
node-cancellation.md/execution-context.md 인용도 전부 실측 검증됐다(사전 리뷰 `18_14_45` 의
WARNING 2건 — WS §4.1 인입 포인터 누락, `code:` 프론트매터 미확정 — 은 현재 draft 에 이미 반영돼
해소됨). 발견된 2건은 모두 INFO 수준으로, 실제 모순이 아니라 향후 독자 혼동을 줄이기 위한 선택적
보완 제안이다.

## 위험도

LOW
