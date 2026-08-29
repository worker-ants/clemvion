# 변경 범위(Scope) 리뷰 — ws-event-types-followups

## 검토 대상

- `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts`
- `codebase/backend/src/modules/websocket/websocket-events.types.ts`
- `codebase/backend/src/modules/websocket/websocket.service.ts`
- `plan/in-progress/ws-event-types-extract.md`

## 요청된 범위 (plan 문서 기준)

`plan/in-progress/ws-event-types-extract.md` 의 "후속 (이 PR 범위 밖)" §"그 밖" 절이 이번
`ws-event-types-followups` 작업의 정본 스코프다. 명시적으로 등재된 두 백로그 항목:

1. `NotificationEventType` → 개명 (`triggers/dto/notification-config.dto.ts` 동명 타입과 충돌,
   이전 라운드에서 "개명은 별도 항목"이라고만 써 두고 항목을 만들지 않았던 것을 발각·집행)
2. `export-default` 캐너리가 `export { X as default } from` 별칭 형태를 못 보는 갭 + 그 옆
   `ts.getModifiers(st as ts.HasModifiers)` 캐스트를 `ts.canHaveModifiers` 가드로 교체

## 발견사항

- **[INFO]** 개명이 plan 이 주장한 "6곳"과 diff 상에서 정확히 1:1 대응한다 — 스코프 이탈 없음
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts:59`(EXPECTED_EXPORTS),
    `codebase/backend/src/modules/websocket/websocket-events.types.ts:226`(enum 선언),
    `codebase/backend/src/modules/websocket/websocket-events.types.ts:231`(`{@link}` 주석),
    `codebase/backend/src/modules/websocket/websocket.service.ts:27,44,588`(import·re-export·사용)
  - 상세: plan 이 "6곳: enum 선언 · JSDoc `{@link}` · websocket.service.ts 의 import/re-export/사용
    3곳 · 캐너리의 `EXPECTED_EXPORTS`"라고 명시한 목록과 실제 diff 의 개명 지점이 정확히 일치한다.
    이 세 파일 밖에 `NotificationEventType` 잔존 참조가 diff 에 없다(즉 drive-by 로 다른 파일을
    건드리지 않았다). 스코프 준수를 확인하는 근거로 남긴다.
  - 제안: 없음 (문제 아님)

- **[INFO]** `hasDefaultExport()` 추출 + `canHaveModifiers` 가드 교체는 두 백로그 항목을
  같은 5줄에서 함께 닫은 것으로, plan 의 사전 승인 근거("두 항목이 같은 다섯 줄이라 함께 닫는
  게 자연스러웠다", "한계비용이 0")와 부합한다
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts:180-194`(신설 헬퍼),
    `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts:357`(호출부 치환)
  - 상세: 세 번째 default-export 테스트의 인라인 화살표 함수를 top-level 헬퍼로 뽑아낸 것 자체는
    "리팩터링처럼" 보일 수 있으나, 이는 순수 스타일 변경이 아니라 **두 번째 백로그 항목**
    (`ExportAssignment`/modifier 두 형태만 보던 것 → `NamedExports` 의 `as default` 별칭까지
    세 형태로 소진)을 구현하기 위한 불가피한 구조 변화다. 함수로 뽑지 않고 인라인으로도 구현
    가능했겠으나, 파일 전체가 이미 이런 top-level 헬퍼 + 상세 JSDoc 패턴을 일관되게 쓰고 있어
    (`importLeavesValueEdge`, `exportLeavesValueEdge`, `originalName` 등) 기존 컨벤션과 일치한다.
    범위 이탈로 보지 않는다.
  - 제안: 없음 (문제 아님)

- **[INFO]** `websocket-events.types.ts` 의 `InAppNotificationEventType` JSDoc 이 이전 2줄
  disambiguation 주석 대비 상당히 길어졌다(약 11줄)
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts:213-224`
  - 상세: 겉보기엔 "불필요한 주석 확장"으로 보일 수 있으나, plan 이 이 확장의 근거를 명시한다 —
    개명 자체가 "주석만으로는 오import 를 못 막는다"는 반성에서 나온 조치이므로, 왜 disambiguation
    주석 대신 이름으로 가르는 방식을 택했는지 그리고 어느 쪽 이름을 바꿨는지의 근거(EIA §3.1
    외부 계약 vs 자매 enum 명명 규칙)를 설명해야 다음 리뷰어가 "왜 저쪽이 아니라 이쪽을
    개명했나"를 재지적하지 않는다. 이 파일의 다른 모든 export(예: `ExecutionRoutingContext`,
    `KbEventType`)도 비슷한 밀도의 근거 주석을 갖고 있어 파일 전반의 문서화 관례와 부합한다.
    범위 이탈로 보지 않는다.
  - 제안: 없음 (문제 아님)

- **[INFO]** `plan/in-progress/ws-event-types-extract.md` 에 상당한 분량의 신규 서술(격리 실패
  이동 시도·`git blame` 조사·planner 턴 위임 결론)이 추가됐다
  - 위치: `plan/in-progress/ws-event-types-extract.md` "`plan/complete/` 이동 시 `spec_impact`
    갱신" 체크박스 하위 블록(`### 2026-08-29 (ws-event-types-followups) — 산출은 끝냈고, 이동이
    막혔다` 절) 및 "그 밖" 절의 두 항목 완료 기록
  - 상세: 코드 스코프는 아니지만 CLAUDE.md 의 plan 라이프사이클 규약(체크박스=실제 상태, 완료
    기록 의무)에 부합하는 process 문서화다. 특히 `plan/complete/` 이동이 링크 무결성 가드로
    막혀 있다는 것을 실측(`git mv` 시도 후 RED)하고, `developer` 가 그 캐비엇을 직접 고칠 권한이
    없다는 것(§자기-반증형 소정정 조건 1 불충족 — 그 문장을 developer 가 쓴 게 아니라 planner
    턴 산출물)을 `git blame` 으로 확인한 뒤 스스로 손대지 않고 planner 턴으로 넘긴 판단이 diff
    에 드러난다. 이는 오히려 **과도한 범위 확장을 자제**한 사례로 읽힌다 — 권한 밖 spec 링크를
    우회 편집하지 않고 멈췄다. 범위 이탈이 아니다.
  - 제안: 없음 (문제 아님)

- **[INFO]** 설정 파일·임포트·포맷팅 변경 없음
  - 위치: 해당 없음
  - 상세: 4개 파일의 diff 전체를 확인한 결과 신규/불필요 import, 공백/줄바꿈만의 포맷팅 변경,
    `.eslintrc`/`tsconfig`/`package.json` 등 설정 파일 변경은 없다.
  - 제안: 없음 (문제 아님)

## 요약

이번 diff 는 `plan/in-progress/ws-event-types-extract.md` 의 "그 밖" 절에 명시적으로 등재된
두 백로그 항목(`NotificationEventType` 개명, `export-default` 캐너리 형태 소진 + 캐스트 제거)
만을 정확히 구현한다. 개명은 plan 이 예고한 6개 지점과 diff 상 1:1로 일치해 drive-by 수정이나
누락이 없고, 두 번째 항목의 헬퍼 추출은 파일 기존 컨벤션(top-level 헬퍼 + 근거 JSDoc)과
일관된다. plan 문서에 추가된 방대한 서술은 코드 스코프는 아니지만 완료 기록·차단 사유 명시
의무에 해당하며, 오히려 권한 밖 spec 링크 편집을 자제하고 planner 턴으로 위임한 판단이 담겨
있어 범위 확장이 아니라 범위 절제의 증거다. 무관한 파일·불필요한 리팩토링·기능 확장·포맷팅
잡음·설정 변경은 발견되지 않았다.

## 위험도

NONE
