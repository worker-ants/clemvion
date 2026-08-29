# 테스트(Testing) 리뷰

## 검증 방법

- `npx jest src/modules/websocket/websocket-events.types.spec.ts` — 6/6 통과 (실측)
- `npx jest src/modules/websocket/websocket.service.spec.ts` — 63/63 통과 (실측, `NotificationEventType` → `InAppNotificationEventType` 개명 회귀 없음)
- `hasDefaultExport()` 세 번째 분기(`NamedExports` 의 `as default` 별칭 감지)를 저장소 안에서
  직접 뮤테이션해 확인(원본은 scratch 로 `cp` 백업 후 되돌림, `git status --short` 로 클린 확인
  완료): `el.name.text === 'default'` → `el.name.text === 'NEVER_MATCH_MUTATION'` 로 바꿔도
  같은 스위트가 **6/6 GREEN** — 아래 WARNING 근거.

## 발견사항

- **[WARNING]** `hasDefaultExport()` 의 새 세 번째 분기(`export { X as default }` 별칭 감지)가
  커밋된 테스트 스위트 어디서도 **양성 경로로 실행되지 않는다** — 실측으로 확인.
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts:188-193`
    (함수 3번째 분기), 유일한 소비처는 `:352-363`
    (`it('두 모듈 어디에도 export default 가 없다 …')`)
  - 상세: 이 테스트는 실제 소스 파일 두 개(`TYPES_FILE`, `websocket.service.ts`)를 파싱해
    `hasDefaultExport` 가 **항상 `false`** 를 반환하는지만 확인한다. 두 파일 다 설계상
    default export 가 없어야 하므로, 이 테스트는 함수의 **음성 경로**만 매 실행마다 통과시킨다.
    3번째 분기(`NamedExports` 의 `as default` 별칭 — 이번 diff 가 새로 추가한, 바로 그 결함을
    고친 로직)를 실제로 참으로 만드는 입력은 스위트 안 어디에도 없다.
    직접 뮤테이션으로 실증: 그 분기의 술어를 절대 매치되지 않는 문자열로 바꿔도 6/6 GREEN —
    즉 이 로직이 다시 깨져도(예: 향후 리팩터가 `el.name.text` 를 `el.propertyName?.text` 로
    잘못 바꾸는 등) **현재 스위트는 감지하지 못한다.**
    plan 문서(`plan/in-progress/ws-event-types-extract.md`, "둘 다 완료 (2026-08-29 …)" 절)가
    기록한 "types 모듈 끝에 `export { NodeEventType as default };` → RED" 뮤테이션은 실행됐지만
    **임시 사본에서 수행되고 되돌려졌을 뿐, 영구 회귀 테스트로 커밋되지 않았다.** 이 파일의
    헤더 주석 자체가 "주석/일회성 검증만으로는 조용히 깨진다" 는 철학을 여러 번 명시하는데
    (`## 간선을 세는 곳은 하나뿐이다`, JSDoc 의 "**세 번째가 종전에 빠져 있었다**" 서술), 정작
    이번에 고친 바로 그 분기가 같은 문제(자기점검의 완전성이 테스트가 아니라 리뷰/plan 기록에만
    의존)를 반복하고 있다. 이 파일은 이미 4라운드 연속 "형태 하나를 놓쳤다 → 고침 → 다음 형태를
    놓침" 패턴을 겪었다는 것이 plan 에 기록돼 있어(`수렴 판정` 표), 재발 가능성이 낮지 않다.
  - 제안: `hasDefaultExport` 를 문자열 소스에서 직접 파싱하는 합성(synthetic) 유닛 테스트를
    추가한다 — 기존 `parse(file: string)` 은 파일 경로만 받으므로, `ts.createSourceFile('t.ts',
    sourceText, …)` 를 직접 호출하는 소형 헬퍼(또는 인라인)로 세 형태 각각
    (`export default X` / `export default function f(){}` / `export { X as default }`) 에 대해
    `true`, 그리고 일반 named export 에 `false` 를 단언하는 테이블 기반 테스트를 추가하면
    이번 뮤테이션이 실측한 갭이 영구히 닫힌다. 비용은 낮다(이미 이 파일을 만지는 diff다).

## 요약

핵심 코드 변경(개명 `NotificationEventType` → `InAppNotificationEventType`, `hasDefaultExport()`
추출)은 실행 검증 결과 회귀 없이 정상 동작한다 — 개명은 정적 가드(`EXPECTED_EXPORTS`)와
런타임 동작 테스트(`websocket.service.spec.ts` 의 `notification.new` emit 테스트, 63/63 통과)
양쪽으로 이중 커버되고, 리팩터된 `hasDefaultExport()` 헬퍼도 기존 6개 테스트 전부 통과한다.
다만 이번 diff 가 새로 추가한 세 번째 방어 분기(별칭 `as default` 감지)는 실제 파일에 해당
패턴이 없다는 설계 특성상 **양성 경로가 커밋된 스위트에서 한 번도 실행되지 않는다** — 직접
뮤테이션으로 실증했다(GREEN 유지). plan 문서가 기록한 뮤테이션 검증은 임시 사본에서 이뤄지고
되돌려졌을 뿐 영구 테스트로 남지 않았고, 이 파일이 이미 여러 라운드 반복해온 "형태 누락" 패턴을
감안하면 합성 소스 기반 양성 테스트를 추가해 이번 개선을 영구 고정하는 것이 바람직하다. 그 밖에
mock 사용·테스트 격리·가독성·회귀 유효성 관점에서는 결함을 찾지 못했다. `plan/in-progress/
ws-event-types-extract.md` 는 문서 변경으로 테스트 관점 리뷰 대상은 아니나, 기록된 다라운드
뮤테이션 표는 이번 리뷰의 실측과 정합했다.

## 위험도

LOW
