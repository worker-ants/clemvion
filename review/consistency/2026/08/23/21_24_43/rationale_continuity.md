# Rationale 연속성 검토 — `plan/in-progress/spec-text-fixes.md`

## 검토 요약

target 의 3개 항목(① `15-chat-channel.md` §5.1·§8 InteractionRequestContext 서술을 EIA §3.3.1
포인터로 대체 / ② EIA §5.1 의 "webhook §5.2 legacy `statusCode/errors` shape" 대비 문구 정정 /
③ `data-flow/15-external-interaction.md:119` 의 미정의 `EIA-AU-09` 참조 제거) 는 모두 **어느
spec 의 `## Rationale` 절도 직접 수정하지 않는다** — 세 항목 다 본문(body) 서술의 시점-드리프트
정정이다. 아래는 각 항목을 실제 git 이력·현재 코드·기존 다회 consistency-check 기록과 대조해
"과거 결정 번복" 여부를 판정한 결과다.

## 발견사항

### [INFO] ① 의 pointer 치환은 기존 Rationale 의 역할 분리 원칙과 정합 — 오히려 강화

- target 위치: `plan/in-progress/spec-text-fixes.md` 작업 ①, 대상은
  `spec/5-system/15-chat-channel.md` §5.1(319행 4번째 불릿)·§8(507행)
- 과거 결정 출처: `spec/5-system/15-chat-channel.md` `## Rationale` R6
  ("`chat-channel-adapter.md` 를 `spec/conventions/` 에 두는 정당화") — 이 spec 자신의 역할을
  "시스템 동작·lifecycle·**EIA 관계**·요구사항 ID (구현 무관 시스템 정의)" 로 명시하고, 함수
  시그니처·데이터 타입 계약은 별도 계층(`conventions/chat-channel-adapter.md`)에 위임한다고
  선언한다.
- 상세: `git log -S`로 확인한 결과 15-chat-channel.md §5.1 의 "단일 인터페이스 + optional
  `scope`" 서술은 `#258`(2026 이전, chat-channel 최초 구현)에서 작성됐고, EIA
  §3.3.1 의 discriminated union(`ExternalInteractionRequestContext` /
  `InternalInteractionRequestContext` + `isInternalCtx()`)은 그보다 **나중** 커밋(`#259`
  이후, `907616c61`/`#604` 시점 "v1 구현 완료"로 확정)에 도입됐다. 즉 15-chat-channel.md 쪽이
  먼저 쓰였고 EIA 쪽 타입이 나중에 갈라지며 동기화가 누락된 **단순 시점 드리프트**이지, 15-
  chat-channel.md 가 의도적으로 다른 타입 모델을 채택했던 적은 없다. 코드(`interaction.guard.ts`)
  도 이미 union 을 구현하고 있어 15-chat-channel.md 서술이 코드·EIA 양쪽과 모두 어긋난 상태다.
  포인터 치환은 R6 이 이미 선언한 "타입 계약은 이 문서의 책임이 아니다" 원칙을 어기는 게 아니라
  오히려 그 원칙을 뒤늦게 준수하는 방향이다. `spec-sync-external-interaction-api-gaps.md` 트래커
  (2026-08-15 `09_00_27` 등재분)도 동일하게 "포인터로 대체하는 편이 재-drift 를 막는다"고 이미
  기록해 두었다.
- 제안: (경미) ①은 보안 민감 타입이라 체커가 우선순위를 표시한 항목이므로, target 실행 시
  EIA §3.3.1 의 "외부 HTTP guard 는 `scope` 를 절대 set 하지 않는다"는 불변식 문장까지 포인터
  경유로 확인 가능하도록 링크 앵커를 §3.3.1(전체 절)로 잡을 것 — §3.3(EIA-AU-08 요구사항 행)만
  가리키면 구현 불변식 부분을 놓칠 수 있다. Rationale 자체를 새로 쓸 필요는 없다(치환 대상이
  Rationale 절이 아니라 본문 서술이므로).

### [INFO] ② 의 "legacy" 대비 문구는 실제로 시점상 옳았던 서술 — 번복이 아니라 후속 미동기화

- target 위치: `plan/in-progress/spec-text-fixes.md` 작업 ②, 대상은
  `spec/5-system/14-external-interaction-api.md` §5.1(331행 "에러 응답" 문단)
- 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` 는 이 대비 문구를 최초 커밋
  `9ed6e6305`(#228, EIA 최초 spec)에서 작성했다. `spec/5-system/12-webhook.md` 는 그 시점에
  실제로 flat `{ statusCode, message, errors[].reason }` 구조를 썼다(비-공식 봉투) — 즉
  "legacy" 라는 서술은 **작성 당시 사실과 일치**했다.
- 상세: 이후 `7e181ed8e`(#754, 2026-06-28, "webhook 400 에러 봉투 정합화")가 webhook §5.2 를
  공식 봉투(`{error:{code,message,requestId,details}}`)로 통일했으나, 같은 PR 은
  `spec/5-system/14-external-interaction-api.md` 를 건드리지 않았다(diff stat 확인 — 12-webhook,
  15-chat-channel, 1-data-model, 2-trigger-list, 1-manual-trigger, 2-api-convention,
  3-error-handling, 5-admin-console, 10-triggers 만 수정). 따라서 EIA §5.1 의 대비 문구만
  갱신되지 않고 남아 오늘 시점엔 stale 이다. target 의 처분("취소선으로 이력을 남긴다 — 그
  대비가 당시에는 옳았다")은 이 실측과 정확히 일치하는 서술이라 **Rationale 위반이 아니라
  오히려 프로젝트 관행("기각된 대안 재도입 판단은 실제 이력에 근거")에 부합**한다.
- 제안: 없음 (target 처분 그대로 유효). 다만 취소선 주석에 `7e181ed8e`(#754) 커밋 해시를
  근거로 함께 남기면 향후 재검토 시 "언제 갈렸는가"를 다시 `git log -S` 로 재현할 필요가 없어진다.

### [INFO] ③ 의 `EIA-AU-09` 제거는 무결하나, 동일 오기가 backend 코드 주석에도 남는다(target 범위 밖)

- target 위치: `plan/in-progress/spec-text-fixes.md` 작업 ③, 대상은
  `spec/data-flow/15-external-interaction.md:119`
- 과거 결정 출처: 없음 — `EIA-AU-09` 는 `spec/5-system/14-external-interaction-api.md` §3.3 의
  `EIA-AU-01`~`EIA-AU-08` 어디에도 정의된 적이 없다(전수 grep 재확인, `01`~`08` 까지만 존재).
  기각된 결정의 재도입이 아니라 애초에 실체가 없던 dangling ID다. 2026-08-15/16 두 차례 이상
  cross_spec 리뷰가 이미 동일 결론(INFO, "정의된 적 없는 ID 삭제")으로 등재했고
  `spec-sync-external-interaction-api-gaps.md:1322` 트래커도 동일하다.
- 상세(참고, 지적 아님): `codebase/backend/src/modules/external-interaction/interaction.guard.ts:27`
  의 JSDoc 도 `[Spec EIA §3.3 EIA-AU-08 + §3.3.1 EIA-AU-09]` 로 동일한 존재하지 않는 ID 를
  인용한다 — data-flow 문서의 오기와 같은 근원(복사 시 결합 표기 `08/09` 가 그대로 옮겨진 것으로
  보임)으로 추정된다. target 은 spec 문서만 수정하며 `codebase/**` 는 의도적으로 무변경이라고
  명시하고 있어(검증 절 "codebase/** 무변경") 이 코드 주석은 이번 작업 범위 밖이다. Rationale
  연속성 관점에서 문제는 아니지만(애초에 존재한 적 없는 ID 라 "번복"할 결정 자체가 없음),
  spec 쪽만 `08` 로 좁히면 코드 주석과 spec 표기가 다시 어긋나는 잔여 drift 가 하나 남는다는
  점은 참고로 남긴다.
- 제안: 이번 target 실행에는 영향 없음. 후속 developer 작업(코드 변경) 시 동일 주석도 함께
  정정하도록 트래커에 한 줄 남기면 재발 방지에 도움이 된다(선택 사항, 이번 planner 턴의 필수
  의무는 아님).

## 요약

target 의 3개 항목 모두 어떤 spec 의 `## Rationale` 절도 직접 수정하지 않으며, 본문(body)
서술의 시점 드리프트를 정정하는 성격이다. git 이력으로 셋 다 대조한 결과 — ① 15-chat-channel.md
쪽 서술이 EIA 의 discriminated union 도입보다 먼저 쓰였다가 동기화가 누락된 경우, ② EIA §5.1
의 "legacy" 대비는 작성 시점(#228)엔 사실이었고 이후 webhook 이 별도 PR(#754)로 봉투를
통일하면서 EIA 쪽만 갱신이 안 된 경우, ③ `EIA-AU-09` 는 애초에 정의된 적 없는 dangling ID —
이는 모두 "기각된 대안의 재도입"·"합의된 원칙 위반"·"무근거 번복"·"invariant 우회" 어느
범주에도 해당하지 않는다. 오히려 ①은 15-chat-channel.md 자신의 R6("타입 계약은 EIA/convention
쪽이 SoT")를 뒤늦게 준수하는 방향이고, ②는 target 이 스스로 "그 대비가 당시에는 옳았다"는
정확한 역사적 근거를 취소선과 함께 남기려는 계획이라 프로젝트의 기존 관행(근거 없는 소급
서술 금지)에 부합한다. 세 항목 모두 이미 2026-08-15/16 다회 consistency-check 라운드와 정본
트래커(`spec-sync-external-interaction-api-gaps.md`)에서 동일하게 진단·등재되어 있어 target
의 판단과 독립적으로 교차 확인된다.

## 위험도

NONE
