# Cross-Spec 일관성 검토 — spec-text-fixes.md

## 검토 대상
`plan/in-progress/spec-text-fixes.md` (draft) — `spec/5-system/15-chat-channel.md`,
`spec/5-system/14-external-interaction-api.md`, `spec/data-flow/15-external-interaction.md`
3곳의 문구 정정을 예고하는 planner 트래커. 실제 spec 본문은 아직 미변경(체크박스 전부 미체크) —
Read 로 관련 spec 3파일 + 인접 참조 파일(§1.6/§1.7 error-handling, providers 3종, data-model, trigger-list 등)을
직접 열어 target 이 서술하는 "살아있다" 주장과 처분 방침을 실측으로 검증했다.

## 발견사항

- **[INFO]** 항목①이 겨냥하는 대상은 실제로 spec 간 CRITICAL 데이터 모델 충돌이며, 제안된 처분(포인터화)이 그 충돌을 안전하게 해소한다
  - target 위치: `plan/in-progress/spec-text-fixes.md` "착수 전 재확인" 표 1행, "처분 방침" ①
  - 충돌 대상: `spec/5-system/15-chat-channel.md:319`·`:507` (§5.1·§8) vs `spec/5-system/14-external-interaction-api.md:113-150` (§3.3.1)
  - 상세: 실측 결과 chat-channel.md 는 `InteractionRequestContext` 를 **단일 interface + optional `scope?: 'in_process_trusted'` 필드**로 서술(319행 "별도 필드 도입", 507행 "optional 필드만 추가")하는 반면, EIA §3.3.1(125-149행)은 이미 **discriminated union** —
    `ExternalInteractionRequestContext | InternalInteractionRequestContext` (+ `isInternalCtx()` 타입가드) — 로 "v1 구현 완료" 라고 명시한다. 두 서술은 같은 타입의 shape 에 대해 정면으로 모순되며(optional field vs union 은 컴파일 타임 강제력이 다르다), 코드 SoT 는 union 쪽이다. target 이 제안하는 "①은 포인터로 대체" 방침은 이 모순을 없애는 올바른 방향이다.
  - 교차 확인: `InteractionRequestContext`/`scope: 'in_process_trusted'` 를 언급하는 다른 spec 파일(`4-execution-engine.md:1083`, `data-flow/14-chat-channel.md:67,256`)은 모두 값 언급뿐 shape 서술이 없어 추가 drift 지점 없음. `15-chat-channel.md#5.1`/`#8` 앵커를 inbound 로 참조하는 다른 spec 파일도 없어(전수 grep) 절 제목을 유지하는 한 앵커 파손 위험 없음.
  - 제안: 그대로 진행. 다만 포인터로 대체할 때 319행의 "`tokenFamily` 와 직교적 의미" 설명처럼 chat-channel 고유 맥락(왜 이 어댑터가 이 필드를 쓰는지)까지 지우면 독자가 EIA §3.3.1 을 왕복해야 하니, "무엇을 보장하는지" 요약은 target 서술대로 최소 1~2문장 남기는 편이 안전.

- **[INFO]** 항목②의 "legacy" 대비 문구가 stale 이라는 실측이 다른 spec(error-handling §1.7)의 현재 서술과도 일치한다
  - target 위치: "착수 전 재확인" 표 2행, "처분 방침" ②
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md:331` vs `spec/5-system/12-webhook.md:293-305`(§5.2), `spec/5-system/3-error-handling.md:183-200`(§1.7)
  - 상세: EIA §5.1(331행)은 "12-webhook §5.2 의 `statusCode/errors` shape 는 webhook 호출 진입점 전용 legacy 형식" 이라 적는다. 그러나 webhook §5.2 실측은 `GlobalExceptionFilter` 가 `{ error: { code, message, requestId, details } }` 봉투로 직렬화한다고 명시하며, error-handling §1.7 도 동일 봉투(`INVALID_WEBHOOK_PAYLOAD` 등)로 카탈로그 등재돼 있다 — 즉 두 문서 모두 이미 EIA §5.1 과 **같은 봉투**를 쓴다고 일관되게 서술 중이며, "legacy" 라고 부르는 곳은 EIA §5.1 한 곳뿐(spec 전체 grep 으로 확인). target 의 처분(취소선 정정)은 세 문서를 정합시키는 방향이라 안전.
  - 제안: 그대로 진행.

- **[INFO]** 항목③ `EIA-AU-09` 미정의 참조 확인 — 다른 위치의 잔존 참조 없음
  - target 위치: "착수 전 재확인" 표 3행, "처분 방침" ③
  - 충돌 대상: `spec/data-flow/15-external-interaction.md:119` vs `spec/5-system/14-external-interaction-api.md` §3.3(EIA-AU-01~08 전수)
  - 상세: EIA 요구사항 ID 전수 grep 결과 `EIA-AU-*` 는 01~08 만 정의(105-111행). data-flow:119 는 `interaction.guard.ts EIA-AU-08/09` 라 적어 09 를 함께 인용하나 어디에도 09 는 정의된 적이 없다. `EIA-AU-09` 문자열을 참조하는 다른 spec 파일도 없음(전수 grep, data-flow/15 1건만). target 의 "08 만 참조하도록 좁힌다"는 처분은 안전하며 다른 영역과 충돌하지 않는다.
  - 제안: 그대로 진행.

- **[INFO]** `spec_impact` frontmatter 목록이 실제 처분 방침 3항목과 1:1 대응
  - target 위치: frontmatter `spec_impact`
  - 상세: `15-chat-channel.md`(①), `14-external-interaction-api.md`(②), `data-flow/15-external-interaction.md`(③) 3개 파일만 열거돼 있고, 실측 결과도 정확히 이 3파일 3위치 외에 추가로 손대야 할 spec 파일이 없다(위 교차 확인 참조). 과소·과대 선언 없음.

새로 도입되는 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 충돌은 발견되지 않았다 — target 은 신규 정의를 추가하지 않고 기존 3곳의 stale 서술만 실제 코드/타 spec 과 정합시키는 순수 정정이다.

## 요약
target 이 지목한 3건은 모두 실측으로 재확인되며, 그중 ①은 chat-channel.md 와 EIA §3.3.1 사이의 실재하는 CRITICAL 급 데이터 모델(타입 shape) 모순이고 나머지 둘은 stale 대비 문구·미정의 ID 참조다. 제안된 각 처분 방향(포인터화·취소선 정정·번호 축소)은 모두 다른 spec 영역(webhook §5.2, error-handling §1.6/§1.7, execution-engine, data-flow/14-chat-channel 등)의 현재 서술과 이미 정합하며, 새로운 충돌을 만들지 않는다. 앵커 참조·spec_impact 커버리지도 문제없다.

## 위험도
NONE
