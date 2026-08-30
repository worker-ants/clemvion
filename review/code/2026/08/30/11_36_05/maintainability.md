STATUS=success reviewed 6 files (1 code + 5 plan docs), no repo mutation
===REPORT_MARKDOWN_BELOW===
# 유지보수성(Maintainability) 리뷰

## 리뷰 범위

- `codebase/backend/src/modules/websocket/websocket.service.spec.ts` — 실질 코드 변경(신규 `describe('re-export facade', …)` 블록, +23줄)
- `plan/complete/spec-draft-followups-drain-2026-08-30.md` (신규) / `plan/in-progress/spec-draft-followups-drain-2026-08-30.md` (삭제) — draft 가 in-progress → complete 로 이동
- `plan/complete/ws-event-types-extract.md` (신규) / `plan/in-progress/ws-event-types-extract.md` (삭제) — 같은 성격의 plan 이동, `complete/` 판에 후속 섹션 추가
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — 링크 갱신 1줄

코드 변경은 사실상 테스트 파일 하나뿐이라 나머지는 plan 문서(md) 다. plan 문서는 "함수 길이/중첩/매직넘버" 같은 코드 지표가 문자 그대로 적용되지 않지만, 관점을 그대로 대입해 관찰한 내용도 함께 적는다.

## 발견사항

- **[INFO]** 신규 테스트가 실제로 검증하는 값과 그 정당성 서술이 코드 주석과 plan 문서 두 곳에 나뉘어 유지된다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts:1449`~`1461` (JSDoc), `plan/complete/ws-event-types-extract.md` "facade 재수출 커버리지 비대칭" 항목(파일 3, diff 게이트 477~509줄)
  - 상세: 새 `describe('re-export facade', …)` 위의 JSDoc(13줄)이 "왜 이 값만 명시 단언이 필요한가"를 산문으로 다시 설명하는데, 같은 설명이 `plan/complete/ws-event-types-extract.md`에도 이미 있다(완료 처리 문단). 두 서술이 같은 사실(다른 셋은 사용으로 커버되고 `InAppNotificationEventType`만 명시 단언이 필요하다)을 두 곳에서 각자 유지한다. 이 파일이 이미 `makeFakeAllocator` 등에서 근거 주석을 다는 컨벤션을 갖고 있어 코드 주석 자체는 적절하지만, 향후 이 테스트명·설명이 바뀌면 plan 문서 쪽 서술이 조용히 낡을 수 있다(반대 방향도 마찬가지).
  - 제안: 특별한 조치는 불필요 — 코드 주석이 SoT, plan 문서는 이력 기록이라는 이 저장소의 기존 원칙(plan-lifecycle.md)과 맞는 배치다. 다만 다음에 이 테스트를 개명/제거할 때 plan 문서의 "완료" 서술과의 정합을 함께 확인할 필요가 있다는 점만 남겨 둔다.

- **[INFO]** `describe('re-export facade', …)` 타이틀이 파일 내 다른 top-level `describe` 와 달리 순수 영어 문구
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts:1462`
  - 상세: 같은 파일의 다른 top-level `describe` 타이틀은 전부 한국어를 포함한다 (`'seq counter — execution 채널 monotonic 보장'`, `'nodeOutput allowlist · fanout 파이프라인 불변식'`, `'값-패턴 마스킹 — emit 두 경로 × wire·fanout'` 등). `'re-export facade'`만 순수 영어다. 다만 같은 개념(`re-export facade`)이 자매 파일 `websocket-events.types.spec.ts`의 상수/주석에서도 동일한 영어 표현으로 쓰이고 있어(`REEXPORT_FACADE_TEST`, "re-export facade 자체를 검증한다") 두 파일 간 용어는 일관적이다. 파일 내부 네이밍 스타일과의 국소적 불일치일 뿐 실질적 가독성 저해는 아니다.
  - 제안: 조치 불요. 굳이 맞추려면 `'re-export facade — 하위호환 재수출'` 식으로 한국어를 덧붙이는 정도이나, 비용 대비 효과가 낮다.

- **[INFO]** `plan/complete/ws-event-types-extract.md` (파일 3) 는 563줄에 최대 4단계까지 중첩된 blockquote(`>`) 로 6라운드 리뷰 이력을 누적한 매우 긴 단일 문서다
  - 위치: `plan/complete/ws-event-types-extract.md` (예: 게이트 300~412줄 구간의 다단 인용 블록)
  - 상세: 코드 관점의 "중첩 깊이"·"함수 길이" 기준을 그대로 문서에 대입하면, 특정 결정(예: facade 커버리지 처분)을 찾으려면 문서 전체를 스캔해야 하고 인용 깊이도 깊다. 다만 이는 이 저장소가 `plan-lifecycle.md`에서 명시적으로 요구하는 "완료 이동 시 이력을 보존한다"는 감사 추적(audit trail) 관례이고, 취소선·타임스탬프·라운드 태그(`20_05_19`, `21_49_51` 등)로 각 결정의 출처를 명확히 구분해 두어 구조 자체는 일관적이다. 결함이 아니라 이 문서 유형의 정상 형태로 판단한다.
  - 제안: 조치 불요.

- **[INFO]** plan 파일 2/4, 3/6 쌍은 각각 in-progress → complete 이동으로 내용이 (거의) 동일한 텍스트가 두 경로에 나타난다
  - 위치: `plan/complete/spec-draft-followups-drain-2026-08-30.md` ↔ `plan/in-progress/spec-draft-followups-drain-2026-08-30.md`(삭제); `plan/complete/ws-event-types-extract.md` ↔ `plan/in-progress/ws-event-types-extract.md`(삭제)
  - 상세: diff 상으로는 "중복 코드" 패턴처럼 보이지만, 실제로는 `git mv`가 파일 rename 으로 인식되지 못하고(3번 파일은 새 절이 추가돼 유사도가 임계값 아래로 떨어짐) delete+add 로 표시된 것뿐이다. 최종 상태에는 경로당 1개 파일만 남는다.
  - 제안: 실질 결함 아님. 별도 조치 불요.

## 요약

이번 diff 의 실질 코드 변경은 `websocket.service.spec.ts` 에 `describe('re-export facade', …)` 블록 하나(23줄)를 추가한 것으로, 함수 길이·중첩·복잡도 어느 기준으로도 문제가 없고, 네이밍·주석 스타일도 파일의 기존 컨벤션(근거를 설명하는 JSDoc, `한국어+영어 기술용어` 혼용 describe 타이틀)과 대체로 일치한다. 자매 스펙 파일(`websocket-events.types.spec.ts`)이 이 파일을 "facade 의 유일한 소비자"로 지목해 둔 전제를 정확히 충족시키는 목적 지향적 추가이며, 매직 문자열('notification.new')도 wire 값 불변성을 검증하는 테스트의 본질적 요소라 문제되지 않는다. 나머지 변경은 plan 문서(md)의 lifecycle 이동·링크 갱신뿐이며, 문서 자체의 길이·중첩은 이 저장소가 명시적으로 채택한 감사 추적 관례에 부합해 결함으로 보지 않는다. 전체적으로 유지보수성 리스크는 없다.

## 위험도

NONE
