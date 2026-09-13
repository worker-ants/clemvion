# Rationale 연속성 검토 — error-code-emission-axis (구현 완료 후, `65256a109`)

## 검토 대상

- 구현 diff 4파일(`guide-identifier-scan.ts`·`guide-identifier-existence.test.ts`·
  `logic.mdx`·`logic.en.mdx`, `65256a109`) — "발행 축"(`GUIDE_NON_EMITTED_VOCABULARY`,
  `collectQuotedLiterals`/`collectMessagePrefixes`/`collectCatalogCodes`) 추가
- 대조 축: `spec/5-system/3-error-handling.md §1.4`(엔진 수준 에러 카탈로그) `## Rationale`,
  직전 `--impl-prep` 라운드 `review/consistency/2026/09/13/18_40_54/rationale_continuity.md`
  (WARNING #3, INFO #1) 및 그 라운드를 반영한 `plan/in-progress/error-code-emission-axis.md`

`spec/conventions/` 스코프 델타는 0개 파일이 맞다(harness 가드 + 가이드 mdx 전용 배치). 아래
발견은 대상 diff 가 인용·재구성하는 `spec/5-system/3-error-handling.md §1.4` Rationale 및
직전 리뷰 라운드의 권고 이행 여부에 관한 것이다.

## 발견사항

- **[WARNING] 가이드 문장이 §1.4 "앵커 없는 카탈로그 코드" 관행과의 불일치를 재확인한 채
  남아 있다 — 직전 라운드 WARNING #3(a) 미이행**
  - target 위치: `codebase/frontend/src/content/docs/02-nodes/logic.{mdx,en.mdx}` (변경된
    Callout 문장), 및 그 근거로 인용되는 `plan/in-progress/error-code-emission-axis.md §D`
    (line ~148-153, "가이드가 *"이건 코드가 아니다"* 라고 **올바르게** 설명하려면…")
  - 과거 결정 출처: [`spec/5-system/3-error-handling.md §1.4`](../../../../../spec/5-system/3-error-handling.md)
    카탈로그 표 머리말 — "**나머지 7종은 앵커 없는 맨 문자열**"이라며 `MAX_ITERATIONS_EXCEEDED`
    등 6종을 **정식 카탈로그 항목("코드")**으로 등재. 그리고 직전 라운드
    `review/consistency/2026/09/13/18_40_54/rationale_continuity.md` WARNING(§D 인용)이
    이미 이 지점을 "코드가 아니다 대신 §1.4 형태의 앵커-없는 엔진 수준 코드로 정정할 것"
    이라고 명시적으로 제안했다.
  - 상세: 코드를 직접 확인한 결과 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`
    (`execution-engine.service.ts:7121,7125,7130`)은 `runContainer` 시작 시점(주석: "Validated
    once at the start of `runContainer`… errors surface upfront")에 던져지는 일반 `Error`의
    메시지 접두이며 `.code` 필드로는 나가지 않는다 — `MAX_ITERATIONS_EXCEEDED`
    (`loop-executor.ts`)와 **방출 형태가 완전히 동형**이고 둘 다 execution 실행 중 실패로
    이어진다. §1.4 는 이 형태를 "앵커 없음"이라고만 부르고 여전히 "코드"로 취급하는데, 이번
    배치가 고친 가이드 문장은 "전용 에러 코드는 없으니 코드가 아니라 메시지를 봐야 해요"
    (`there is no dedicated error code, so read the message rather than the code`)라고 하여
    같은 방출 형태를 §1.4 와 반대로("코드 자체가 없다") 서술한다. 구현은 `GUIDE_NON_EMITTED_VOCABULARY`
    설계로 "카탈로그 등재 여부"를 코드-가드 레벨의 판별 기준으로 삼아(§B-3, `collectCatalogCodes`
    JSDoc — "카탈로그는 «요구 조건» 이 아니라 «탈출구»") 이 문제를 **절차적으로는** 정합화했다
    (`MAX_ITERATIONS_EXCEEDED`는 카탈로그에 있어 통과, `CONTAINER_MISSING_EMIT`은 카탈로그에
    없어 등록 필요 — 이 구분 자체는 새 Rationale 로 코드에 잘 기록돼 있다). 그러나 그 판별
    기준이 성립하는 이유("§1.4 미등재 상태를 유지하기로 한 결정")는 어디에도 근거가 적혀 있지
    않다 — plan §D 는 여전히 "코드가 아니다"를 사실 서술처럼 쓰고, 이는 §1.4 가 구조적으로
    동일한 6종을 "코드"로 부르는 것과 계속 어긋난다. 즉 §1.4 를 등재하지 않기로 한(또는 등재를
    보류하기로 한) 결정 자체가 무근거로 방치돼 있고, 가이드 문장은 그 방치된 결정에 의존해서만
    "정확"하다.
  - 제안: (a) plan §D 및 가이드 문장의 "전용 에러 코드는 없다/코드가 아니다" 서술을 "§1.4 의
    앵커 없는 엔진 수준 코드이며 (아직) 카탈로그에 등재돼 있지 않다"로 좁혀 적어 §1.4 관행과
    충돌하지 않게 하거나, (b) 직전 라운드가 제안한 대로 `CONTAINER_MISSING_EMIT`/
    `CONTAINER_MULTIPLE_EMIT` 을 §1.4 표에 형제 6종과 나란히 backfill 등재하고(동작 변경
    아님, 문서 완결성 pass) 가이드 문장을 그에 맞게 다시 조정할 것. 둘 중 하나를 명시적으로
    선택하고 그 선택 이유를 §D 또는 §1.4 Rationale 에 한 줄 남기면 다음 사람이 "왜 이 둘만
    카탈로그 밖인가"를 재추적하지 않아도 된다.

- **[INFO] 직전 라운드가 제안한 §1.4 backfill/문서 정정 follow-up 이 어디에도 추적되지
  않는다**
  - target 위치: `plan/in-progress/error-code-emission-axis.md`(체크리스트, line 179-181) —
    "WARNING 3건은 전부 이 배치 밖이거나 §D 서술을 정정하라는 것이었고, 그 지적이 §B~§B-3
    재설계를 낳았다"고 자평하지만, 실제로 §D 프로즈는 위 발견사항대로 재설계되지 않았다.
  - 과거 결정 출처: `review/consistency/2026/09/13/18_40_54/SUMMARY.md` 권장 조치사항 #4 —
    "별도 후속 plan(이번 PR 범위 밖)으로 … `3-error-handling.md §1.4`에 `CONTAINER_MISSING_EMIT`/
    `CONTAINER_MULTIPLE_EMIT` backfill 등재, 그리고 plan §D 서술을 '앵커 없는 카탈로그 코드'로
    정정하는 것을 검토."
  - 상세: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 관련 트래커 항목
    (line 3404 "`CONTAINER_MISSING_EMIT`·`CONTAINER_MULTIPLE_EMIT` 도 방출 코드가 아니다
    (선재)")은 이번 diff 에서 손대지 않은 채 `[ ]` 로 남아 있고, §1.4 backfill 을 위한 새
    체크리스트 항목도 `plan/` 어디에도 생성되지 않았다(grep 0건). 이 자체가 "무근거 번복"은
    아니지만(BLOCK:NO 하의 권고 사항이었을 뿐), 자평 문구가 실제 이행 범위보다 넓게 들려
    다음 사람이 "이미 처리됐다"고 오판할 위험이 있다.
  - 제안: 체크리스트 자평 문구를 "WARNING #3(a) 서술 정정은 미이행, 대신 §B-3 카탈로그-탈출구
    설계로 절차적 정합화"처럼 좁히고, §1.4 backfill 항목을 `spec-draft-nullable-notation-followups.md`
    또는 신규 plan 항목으로 명시 등재할 것.

## 확인했으나 위반이 아닌 것 (기록용)

- **`#1330` "허용목록 없음" 원칙의 두 번째 번복**: 직전 라운드 INFO #1 이 요구한 대로
  `GUIDE_NON_EMITTED_VOCABULARY` 선언부 JSDoc 에 "`#1330` 원칙의 두 번째 부분 번복"이라는
  계보와, 첫 번째 예외(`GUIDE_EXTERNAL_VOCABULARY`)와의 대칭/비대칭 제약이 명시적으로
  기록됐다. 무근거 번복이 아니라 새 Rationale 이 코드에 동반된 정상 사례다.
- **AST 축 폐기 유지**: 이번 diff 도 AST 기반 방출-위치 특정 축을 다시 시도하지 않았다 — 이전
  라운드가 확인한 `#970` 원칙과의 정합이 유지된다.
- **`lastIndex` 보일러플레이트 회피**: 직전 라운드 plan_coherence INFO #3(다섯 번째 복제
  발생 예견)에 대해 `String.prototype.matchAll` 사용으로 실제 복제 지점을 늘리지 않았다 —
  선제적으로 반영됨.

## 요약

이번 구현은 직전 `--impl-prep` 라운드가 남긴 INFO(#1330 원칙 번복 계보 명시)를 정확히
이행했고, WARNING(§1.4 관행과의 불일치)에 대해서도 "카탈로그 등재 여부를 코드-가드의 판별
기준으로 삼는다"는 절차적 설계로 부분적으로 대응했다 — 이는 새 Rationale 이 코드에 동반된
정당한 처리다. 다만 그 설계가 성립하려면 "왜 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`
는 구조적으로 동일한 §1.4 형제 6종과 달리 카탈로그 밖에 남는가"라는 질문에 답이 있어야 하는데,
그 답은 어디에도 적혀 있지 않고 plan §D 는 여전히 "코드가 아니다"를 사실처럼 서술한다. 이는
과거에 명시적으로 기각된 대안을 되살리는 CRITICAL 성격은 아니지만, §1.4 Rationale 과의 표면적
불일치를 다음 사람이 다시 재발견해야 하는 상태로 남겨 둔다는 점에서 WARNING 이다. BLOCK 사유는
아니다.

## 위험도

LOW
