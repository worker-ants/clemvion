# 신규 식별자 충돌 검토 — `spec-draft-egress-masking-convention.md`

## 조사 방법

target 문서(`plan/in-progress/spec-draft-egress-masking-convention.md`)가 실제로 새로 부여/명명하는
식별자를 추출한 뒤(`MAX_MASK_DEPTH`·`MAX_REDACT_DEPTH`·`MAX_SANITIZE_DEPTH`·`VALUE_MASK_MARKER`·
`DEPTH_MASK_MARKER`·`isMaskedMarker`·`stripExternalOnlyFields`·`deepRedactSecrets`·
`hasMaskedMarkerLeaf`·`sanitizePayloadForWs`·`maskWireEnvelope`·`attachRoutingContext`), `spec/`
전체와 `plan/in-progress/` 전체를 grep, 관련 소스(`@workflow/masked-markers`,
`reject-masked-resubmission.ts`, `sanitize-error-message.ts`, `websocket.service.ts`,
`interaction.service.ts`)를 직접 읽어 이미 다른 의미로 쓰이고 있는지 대조했다. 프롬프트에
포함되지 않은 파일(`6-websocket-protocol.md` 등)도 관련 있는 부분은 직접 `Read`/`grep` 했다.

## 발견사항

- **[WARNING]** `hasMaskedLeaf`(backend) vs `hasMaskedMarkerLeaf`(frontend) — 한 글자(`Marker`)
  차이의 두 함수가 같은 개념(마스킹 마커 leaf 탐지)을 서로 다른 레이어에서 구현하는데, target
  의 좌표계 표가 backend 쪽을 통째로 누락한다.
  - target 신규 식별자: 좌표계 표 3행 소비처 `hasMaskedMarkerLeaf` (frontend,
    `codebase/frontend/src/lib/utils/masked-markers.ts:94`, `MAX_MASK_DEPTH` 사용).
  - 기존 사용처: `spec/5-system/14-external-interaction-api.md:1581` —
    *"판정기는 같은 파일의 `hasMaskedLeaf`(깊이 상한 `MAX_REDACT_DEPTH` 공유)"*.
    실코드: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts:132`
    (private 함수, `depth >= MAX_REDACT_DEPTH`).
  - 상세: target 의 2행(`MAX_REDACT_DEPTH`)은 소비처를 `deepRedactSecrets` 하나만 적었다.
    그러나 EIA 스펙은 이미 `MAX_REDACT_DEPTH` 를 **공유하는 두 번째 소비처**
    (`hasMaskedLeaf` — Manual 실행 재제출 거부 판정기, `reject-masked-resubmission.ts`)를
    문서화하고 있다. 이 함수는 프런트 `hasMaskedMarkerLeaf` 와 정확히 대칭인 역할(마스커가
    쓰는 깊이만큼 스캐너도 내려가야 마커를 놓치지 않는다)을 backend 에서 수행하는데, 이름이
    `hasMaskedMarkerLeaf` 와 거의 동일해 두 함수를 혼동하기 쉽다. target 문서는 스스로
    "좌표계 표의 모든 셀이 실측 출처를 가진다" 를 검증 기준으로 내걸었으므로, 이미 spec 에
    실재하는 소비처 하나가 좌표계 표에서 빠진 채로 승격되면 문서가 **자기소개한 완전성 기준을
    스스로 어기는 상태로 출발**한다.
  - 제안: 좌표계 표 2행("`MAX_REDACT_DEPTH`") 소비처 열에 `deepRedactSecrets` 외에
    `hasMaskedLeaf`(`reject-masked-resubmission.ts` — Manual 실행 재제출 거부 판정, EIA §5.4
    인용처와 동일 사실)를 추가하거나, 최소한 3행("`MAX_MASK_DEPTH` — 프런트 스캐너") 옆에
    "backend 대응 스캐너는 `hasMaskedLeaf`(별개 파일·별개 이름, 혼동 주의)" 각주를 단다.

- **[INFO]** 좌표계 표 2행의 "값" 표기 `= 1` 이 정수 리터럴로 오독될 수 있다.
  - target 신규 표기: `| 2 | \`MAX_REDACT_DEPTH\` (backend 지역 별칭 = 1) | = 1 | ... |` —
    "값" 열이 "= 1" 인데 이는 실제 정수 1 이 아니라 "1행(`MAX_MASK_DEPTH`)과 같은 값"이라는
    뜻으로 보인다(실측: `sanitize-error-message.ts:128` `export const MAX_REDACT_DEPTH =
    MAX_MASK_DEPTH` → 10).
  - 기존 사용처: 없음(target 이 처음 도입하는 표기 관례라 "충돌"은 아니지만, 문서의 존재
    이유 자체가 "값이 같아도 합치면 안 된다"는 깊이 숫자 정밀성이므로 그 숫자를 나타내는
    표기 자체가 모호하면 문서 목적과 상충한다).
  - 상세: 실제 정식 conventions 문서로 승격할 때 이 표기가 그대로 들어가면, 숫자 10 이
    아니라 "1" 로 읽는 사고가 날 수 있다 — 정확히 이 문서가 막으려는 "한 칸 차이" 류의
    오독과 같은 성격의 위험이다.
  - 제안: "= 1" 대신 "row 1 과 동일(=10)" 또는 "→ §1 참조(10)" 처럼 참조 관계를 명시적으로
    표기.

- **[INFO]** "마스킹" 이라는 상위 용어가 `spec/1-data-model.md §2.17.2 마스킹·노출 정책`
  (AuthConfig 전용, `***<last4>` 정책의 "단일 진실")과 신설 `egress-masking.md` 사이에서
  겹친다.
  - target 신규 식별자: 문서명 `spec/conventions/egress-masking.md`, 표제어 "egress 마스킹".
  - 기존 사용처: `spec/1-data-model.md:649` — *"본 §2.17.2 가 AuthConfig 마스킹 정책의 단일
    진실 — 다른 문서(`spec/2-navigation/6-config.md`, `spec/conventions/secret-store.md`)는
    본 절을 참조만 한다."* `secret-store.md:40` 은 이미 이 절과의 비대상 관계를 명시적으로
    적어 혼동을 예방하고 있다.
  - 상세: 두 문서는 실질적으로 다른 도메인이다(§2.17.2 = AuthConfig 필드별 `***<last4>`
    노출 정책, 신설 문서 = 실행 출력/에러의 깊이·마커 기반 값-패턴 마스킹 좌표계) — 식별자
    충돌은 아니다. 그러나 둘 다 "마스킹 정책의 SoT" 를 자처하는 문장을 가질 수 있어, 독자가
    검색으로 "마스킹" 을 찾을 때 어느 쪽이 자신이 찾는 대상인지 판단하는 비용이 생긴다.
    `secret-store.md` 가 이미 §2.17.2 에 대해 "비대상" 절을 둔 선례가 있다.
  - 제안: 신설 문서 서두에 "본 문서는 AuthConfig 필드 마스킹(§2.17.2)을 다루지 않는다 — 그건
    별개의 정책·별개의 메커니즘(`***<last4>` vs 마커 치환)" 같은 1줄 비대상 각주를 추가하면
    향후 두 "마스킹 SoT" 간 혼동을 원천 차단할 수 있다. (target 의 "인입 포인터" 체크리스트에
    이 항목이 없다 — EIA §R17·node-output.md 만 있다.)

## 검토 결과 — 충돌 없음 확인 항목

- **요구사항 ID**: target 은 EIA-NX-*, R-* 등 새 formal ID 를 스스로 부여하지 않고 기존 ID
  (EIA §R17, `error-codes.md §4.2`, `node-output.md`)를 참조만 한다 — ID 충돌 없음.
- **API endpoint**: 신규 endpoint 없음.
- **이벤트/메시지명**: 신규 webhook/queue/SSE 이벤트명 없음. `MASKED_VALUE_RESUBMITTED` 는
  기존 코드(`error-codes.md:129`)에 이미 있는 코드를 재인용할 뿐 신규 부여가 아니다.
- **환경변수·설정키**: 신규 ENV var/config key 없음.
- **파일 경로**: `spec/conventions/egress-masking.md` 는 현재 미존재(신규) — 기존 파일과 경로
  충돌 없음. `node-output.md`·`node-cancellation.md`·`error-codes.md` 등과 동일한 kebab-case
  명명 컨벤션을 따른다.
- **엔티티/타입명 본체**: `MAX_MASK_DEPTH`(10, 코드 0/spec 0)·`MAX_SANITIZE_DEPTH`(10, 코드
  0/spec 0)·`VALUE_MASK_MARKER`/`DEPTH_MASK_MARKER`(이름만, 리터럴 미기재)는 spec 전체
  grep 결과 target 문서 자신을 제외하고 0 히트 — 기존에 다른 의미로 쓰인 바 없음. `attachRoutingContext`·
  `maskWireEnvelope`·`stripExternalOnlyFields`·`sanitizePayloadForWs`·`deepRedactSecrets` 는
  실코드(`websocket.service.ts:397/418/435`, `interaction.service.ts:112`,
  `strip-external-only-fields.ts:101`)와 정확히 일치하며 다른 의미로 쓰인 사례 없음.

## 요약

target 문서가 새로 도입하는 식별자·용어 대부분(세 깊이 상한, 두 마커 이름, 함수 참조 6종)은
실제 코드·spec 어디에도 다른 의미로 선점되어 있지 않아 직접적 충돌(CRITICAL)은 없다. 다만
target 문서 스스로가 "좌표계 표의 모든 셀이 실측 출처를 가진다" 를 검증 기준으로 내걸었는데,
정작 `MAX_REDACT_DEPTH` 를 공유하는 backend 소비처 `hasMaskedLeaf`(EIA 스펙에 이미 문서화됨)가
좌표계 표에서 누락돼 있고, 그 이름이 target 이 명시하는 `hasMaskedMarkerLeaf`(frontend)와
한 글자 차이라 혼동 위험이 있다(WARNING). 부차적으로 "값 = 1" 표기의 모호성과, 신설 문서명이
`1-data-model.md §2.17.2` 의 기존 "마스킹 SoT" 선언과 상위 용어를 공유하는 점은 INFO 수준의
명확화 여지로 남는다. 세 항목 모두 최종 spec 파일 작성 시 쉽게 반영 가능한 수정이며 구조적
재설계를 요구하지 않는다.

## 위험도

LOW
