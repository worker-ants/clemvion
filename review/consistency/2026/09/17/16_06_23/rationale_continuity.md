# Rationale 연속성 검토 — spec-draft-window1-measured.md

## 검토 범위

target: `plan/in-progress/spec-draft-window1-measured.md` (spec draft, `--spec` 모드).
대조: `spec/2-navigation/2-trigger-list.md` `## Rationale`(R-1~R-17) 전문, `spec/5-system/15-chat-channel.md`
`## Rationale`(R-CC-10~R-CC-24, R-K) 원본(번들에서 절단돼 리포지토리에서 직접 재취득), `spec/5-system/3-error-handling.md`
`## Rationale`, `spec/5-system/14-external-interaction-api.md` `## Rationale`(R1~R17). 아울러 근거 구현(`plan/complete/trigger-save-partial-patch.md`,
`codebase/backend/src/modules/triggers/triggers.service.ts`·`trigger-config-lock.ts`, `codebase/backend/test/trigger-update-save-window.e2e-spec.ts`)을
직접 열어 target 이 인용하는 실측 수치(23502/23503, `rewriteTriggerConfigLocked` 0행 판정 등)가 실제 소스와 일치하는지 대조했다.

## 발견사항

- **[INFO]** `trigger-config-lock.ts` JSDoc 표의 "창 1 → 404" 행과 target 이 §3 ⚠️ 자리에 적는 "창 1 → 500" 문장이 표면상 나란히 읽히면 상충으로 보일 수 있다
  - target 위치: 변경안 A3 (§3 ⚠️ 문단 교체, "재읽기 뒤 FK CASCADE 가 끼어들면 저장은 실패하고 롤백되어... 일반 500")
  - 과거 결정 출처: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` `rewriteTriggerConfigLocked` JSDoc — "창 1 `update()` (동기 요청) | **404 로 드러낸다**"
  - 상세: 두 문장은 실제로는 **다른 부분-경합**을 가리킨다. JSDoc 의 "창 1 → 404" 행은 `assertTriggerFound(fresh)` 가 락 안 재읽기 자체에서 행을 못 찾는 경우(트리거 목록 §3 본문의 "재읽기가 비면 쓰지 않고" 문장과 동일 사례)를 말하고, target 이 새로 적는 500 은 재읽기는 **성공했으나** 그 뒤 저장(`m.save`) 시점에 CASCADE 가 끼어드는, `#1341`/`#1342` 이후 `#1343`(`plan/complete/trigger-save-partial-patch.md`)이 비로소 실측한 **더 좁은 하위 창**이다. `#1343` 커밋 메시지("① 재읽기 뒤 FK CASCADE(워크플로 삭제) — 시끄럽게 실패·롤백·부활 없음, 통째 23503/부분 23502")와 `trigger-update-save-window.e2e-spec.ts` 의 실제 단언(`QueryFailedError` code `23503`/`23502`)이 target 의 서술과 정확히 일치해, target 의 결론 자체는 근거가 탄탄하다. 다만 `trigger-config-lock.ts` 는 이 PR(#1343)에서 손대지 않아(diff 로 확인) 두 문서(코드 JSDoc·spec)를 나란히 읽는 다음 사람이 "창 1 은 404 아닌가"로 오독할 여지가 남는다
  - 제안: 필수는 아니나, target A3 또는 §3 본문에 "락 안 재읽기 자체가 비는 경우(404, 기존 서술)와 재읽기 뒤 저장 시점에 CASCADE 가 끼어드는 경우(500, 본 항목)는 서로 다른 하위 창"이라는 한 문장을 덧붙이면 두 문서 간 교차 오독을 예방할 수 있다. Rationale 위반은 아니므로 이번 draft 를 막을 사유는 아니다.

- **[INFO]** `trigger-config-lost-update.e2e-spec.ts` 는 여전히 `code:` 미등재 — target 이 강화하는 "e2e 로 고정한다고 적으면 등재" 원칙의 적용 범위 밖에 남아 있다
  - target 위치: 변경안 A1 (frontmatter `code:` 에 `trigger-update-save-window.e2e-spec.ts` 추가)
  - 과거 결정 출처: `spec/2-navigation/2-trigger-list.md` frontmatter 기존 주석(줄 24~25) — "註에 «e2e 가 고정한다» 고 적으면서 그 파일을 등재하지 않으면 보장의 근거가 추적 불가"
  - 상세: 같은 module 의 `trigger-config-lost-update.e2e-spec.ts`(락·재읽기 lost-update 자체를 판별하는 e2e, `plan/in-progress/trigger-config-lost-update.md` §C 산출물)도 `code:` 에 없다. 다만 §3 본문 어디에도 "이 lost-update 보장은 e2e 가 고정한다"는 명시적 claim 이 없어(target 이 새로 추가하는 문장들과 달리) 위 원칙이 이 파일에 **적용되는 대상인지 자체가 불명확**하다 — 원칙 위반이라 단정할 근거는 부족하다
  - 제안: target 의 스코프(트래커 항목 7)와 무관하므로 이번 draft 에서 처리할 필요는 없다. 다만 이 사실을 인지한 상태이므로, 후속 spec 정비 시 §3 본문에 lost-update 보장에 대한 e2e-고정 claim 을 넣게 되면 그때 같은 파일을 등재해야 한다는 점만 기록해 둔다.

- **[INFO]** revoke-token 쪽 에러 표 미신설 결정은 근거가 있으나, 이 저장소가 "적용 범위는 총칭이 아니라 열거다"를 반복 강조해온 관례와 결이 다르다
  - target 위치: 변경안 반영 후 "Rationale" 절 "`revoke-token` 쪽에 에러 표를 만들지 않은 이유"
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` R17 계열이 반복 명시하는 "적용 범위는 총칭이 아니라 열거다" 원칙(예: R17 §"적용 범위는 총칭이 아니라 열거다" 서브섹션)
  - 상세: 이 원칙은 **이미 존재하는 방어·마스킹의 커버리지**를 열거로 명확히 하라는 취지였고, target 의 결정은 애초에 없는 에러 표를 **신설하지 않기로** 한 것이라 성격이 다르다 — target 이 EIA-AU-07 이 "요구사항 행이지 응답 계약 표가 아니다"라고 확인한 근거([`14-external-interaction-api.md`](../../../../../../spec/5-system/14-external-interaction-api.md) 실측)도 맞다. 따라서 이 항목은 원칙 위반이 아니라 스코프 경계를 명시적으로 그은 것으로 판단한다
  - 제안: 없음(참고용 기록)

target 의 다른 모든 변경(§3 ⚠️ 교체, §3 불릿 괄호에 `revoke-token` 추가, chat-channel §5.4 404 행 확장, `code:` e2e 파일 등재)은 기존 spec 의 어떤 `## Rationale` 항목도 재도입·번복하지 않으며, 오히려 다음 기존 원칙을 그대로 따른다:

- **부분 갱신/부분 merge 선호** — `spec/2-navigation/6-config.md` "백엔드 update 는 config 를 통째 대체하지 않고 shallow-merge" 등 기존 관례와 정합. target 이 서술하는 "PATCH 의 저장은 이 요청이 바꾸는 필드만 싣는다"는 새 원칙 도입이 아니라 기존에 이미 퍼져 있던 부분-갱신 선호를 이 엔드포인트에도 확정하는 것이다.
- **미분류 예외는 generic 500 으로 마스킹** — `spec/5-system/3-error-handling.md` §1.1 `INTERNAL_ERROR`(예상하지 못한 서버 오류) 정의 및 Rationale 의 "4xx http-error 고정 문구 — 5xx 마스킹(generic 500)과 일관"과 동일 정신. target 이 CASCADE 창의 500 을 "계약이 아니라 현재 동작"으로 낮춰 적은 것은 이 저장소가 반복해온 "설계된 응답과 우발적 기본값을 구분해 적는다"는 문서화 관례([`spec/5-system/14-external-interaction-api.md` R17]의 다수 "정정"/"현재 구현" 구분 패턴)와 일치한다.
- **명시 파일 등재 vs glob** — `spec/5-system/15-chat-channel.md` R-CC-22 는 "계속 늘어나는 구현 파일 집합"에 대해서만 glob 을 채택했고, target 이 그대로 유지하는 `trigger-list.md` 자체 관례(줄 26 `trigger-workflow-ref.e2e-spec.ts` 개별 파일 등재 + 그 근거 주석)는 "특정 계약을 고정하는 e2e 는 이름으로 등재"라는 별개 축이다. target 의 A1 은 이 별개 축을 그대로 따른 것이라 R-CC-22 와 충돌하지 않는다.
- **정정 시 이력 보존** — target 자신의 "## Rationale" 절이 ⚠️ 를 지운 이유·500 을 계약이 아닌 현재 동작으로 적은 이유·revoke-token 표를 만들지 않은 이유를 모두 명시적으로 적어, "결정 번복 시 새 Rationale 동반" 원칙(§3 관점)을 스스로 충족한다.
- `#1342` 의 §3 괄호("`rotate-bot-token` 은 이때 404")가 `revoke-token` 을 누락했던 사실을 target 이 코드 대조로 확인하고 정정하는 것(A2)은, 이 저장소가 반복해온 "이전 서술이 좁았다"는 정정 패턴(EIA R17 "적용 범위는 총칭이 아니라 열거다" 다수 사례)과 같은 결의 건강한 교정이다.

## 요약

target 의 핵심 주장(부분 객체 save 도입 이유, CASCADE 창에서의 23502/23503 실패, revoke-token 404 경로 추가, 500 이 계약이 아니라는 서술)은 `plan/complete/trigger-save-partial-patch.md` 의 실측·`#1343` 커밋·`trigger-update-save-window.e2e-spec.ts` 실제 단언과 문자 그대로 일치하며, 어느 것도 `2-trigger-list.md`·`15-chat-channel.md`·`3-error-handling.md`·`14-external-interaction-api.md` 의 기존 `## Rationale` 이 명시적으로 기각한 대안을 되살리거나 합의 원칙(부분 merge 선호, generic 500 마스킹, e2e 고정 시 파일 등재, "적용 범위는 열거")을 거스르지 않는다. draft 자신의 새 "## Rationale" 절이 세 가지 변경 각각의 근거를 명시해 "번복 시 새 근거 기록" 요건도 충족한다. 코드 JSDoc(`trigger-config-lock.ts`)의 "창 1 → 404" 행과 표면상 나란히 놓일 때 오독 여지가 있다는 점, 그리고 자매 e2e(`trigger-config-lost-update.e2e-spec.ts`)가 같은 등재 원칙의 적용 대상인지 애매하게 남아 있다는 점만 INFO 로 기록한다 — 둘 다 이번 draft 의 범위를 넘어서는 기존 상태이며 병합을 막을 사유는 아니다.

## 위험도

LOW
