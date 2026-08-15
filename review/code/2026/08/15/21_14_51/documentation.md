# 문서화(Documentation) 리뷰 — `21_14_51`

## 검토 방법

이 diff(`origin/main`...`HEAD`)는 `ws-event-types-extract` 작업 전체(총 98개 파일)를 포함하지만,
이 중 82개는 이전 4라운드의 `/ai-review`(`19_27_37`→`20_05_17`→`20_27_08`→`20_50_49`)와
consistency-check(`18_53_27`, `20_05_19`) 산출물이며, documentation 관점은 직전 두 라운드
(`20_27_08`, `20_50_49`)에서 이미 "신규 발견 없음"으로 수렴했다. 실제로 **이번 라운드가 처음
보는 델타**는 마지막 커밋 `fa1bca013` 하나뿐이고, 그 코드 변경은
`codebase/backend/src/modules/websocket/websocket-events.types.spec.ts`(317줄 재작성)와
`plan/in-progress/ws-event-types-extract.md`(체크리스트 34줄 추가) 두 파일로 한정된다
(`git show --stat fa1bca013` 실측 — `websocket-events.types.ts` 자체는 이번 커밋에서 무변경).
프롬프트 diff가 두 파일 모두 "생략"으로 표시돼 있어, `git show`/`Read` 로 현재 소스를 직접
열어 대조했다.

## 발견사항

- **[INFO]** 신설 정규식 상수 2개(`SERVICE_MODULE`/`EVENT_MODULES`)에 설명 주석이 없다 —
  이름의 비대칭이 살짝 헷갈릴 수 있다
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts:72-73`
    (`const SERVICE_MODULE = /websocket\.service$/;` / `const EVENT_MODULES = /websocket-events\.types$|websocket\.service$/;`)
  - 상세: 이 파일은 다른 모든 상수·함수(`EXPECTED_EXPORTS`, `REEXPORT_FACADE_TEST`,
    `ModuleRef`, `originalName`, `insideFunction`, `moduleRefs`, `destructuredKeys`,
    `collectOffenders`)에 전부 목적을 설명하는 JSDoc/인라인 주석이 달려 있는데, 이 두 정규식만
    예외적으로 무주석이다. 특히 `EVENT_MODULES` 라는 이름은 "이벤트 모듈(들)"을 가리키는
    것처럼 읽히지만 실제로는 `websocket-events.types` **와** `websocket.service` 양쪽 경로를
    다 매치한다(타입 심볼이 재-export facade 경유로도 들어올 수 있어서) — 왜 서비스 파일까지
    포함하는지는 그 정규식을 쓰는 5번째 테스트(`:305-314`)의 필터 로직을 따라가야만 알 수
    있다. 기능 결함은 아니며, 이 파일의 나머지 부분이 보여주는 "왜"를 남기는 문서화 밀도에
    비추면 사소한 누락이다.
  - 제안: 두 상수 위에 한 줄씩 — 예: `// 타입 전용 심볼이 재-export facade(websocket.service)
    경유로 들어올 수도 있어 두 경로를 함께 검사한다.` 급하지 않음(INFO).

## 그 외 확인 — 이번 델타(`fa1bca013`)의 문서 품질 (문제 없음)

- **헤더 JSDoc 재작성**(`websocket-events.types.spec.ts:5-42`) — "간선을 세는 곳은 하나뿐이다"
  절이 이 리팩터의 동기(4라운드 연속 같은 클래스의 좁은 판정 결함 재발)를 구체적 라운드
  레이블(`20_05_17`/`20_27_08`/`20_50_49`)과 함께 서술한다. "네 라운드 연속" 이라는 수치
  주장을 `review/code/2026/08/15/20_50_49/{RESOLUTION,testing}.md` 및 `git log`(가드 부재
  → `export…from` 미검출(`a6d764ac6`) → 별칭 오판(`e8585b574`) → `require()`(`fa1bca013`))로
  교차 검증했다 — "가드가 아예 없었다"를 첫 번째 narrow-scope 사례로 포함하면 정확히 4회이고,
  직전 라운드 리뷰어가 이미 같은 수치("4번째로 재발")로 확인한 셈이라 새로 지어낸 숫자가
  아니다. eager/lazy 표(`:34-38`)도 실제 `moduleRefs`/`eager` 필드 구현(`:170-184`)과 정확히
  일치한다(동적 import 는 항상 `eager: false`, `require` 는 `!insideFunction(node)` 일 때만
  `eager: true`).
- **함수별 JSDoc 인접성** — `originalName`(`:97-105`→`:106`), `insideFunction`(`:110`→`:111`),
  `moduleRefs`(`:118`→`:119`), `destructuredKeys`(`:193-195`→`:197`), `collectOffenders`
  (`:217`→`:218`) 전부 선언 바로 위에 붙어 있어, 이 저장소가 3라운드에 걸쳐 반복 지적하고
  고친 "JSDoc orphan" 패턴(`19_27_37` W2/W3/W4)이 이번 재작성에서 재발하지 않았다.
  `originalName`(`:101-104`)의 FP/FN 양방향 실측 인용도 `20_27_08` 라운드 실제 기록과 일치.
- **`destructuredKeys` JSDoc**(`:193-195`, "프로퍼티 키(`A`)를 꺼낸다, 별칭이 아니라 키로 읽는
  이유는 import 쪽과 같다")을 구현(`:197-205`, `el.propertyName ?? el.name`)과 대조 — 정확히
  일치.
- **테스트명 ↔ 구현 정합** — 3번째 테스트명이 `` `websocket.service` 로의 **eager** 값 간선이
  없다 ``(`:257`)로 갱신되어 필터 로직(`:263`, `r.eager && r.value`)과 어긋나지 않는다. 5번째
  테스트 위 JSDoc(`:285-293`)이 "위 세 번째 테스트의 판별 기준이 `value`" 라고 정정한 것도
  실제 필드명 변경(`isTypeOnly` → `value`)과 일치한다.
- **삭제된 함수 잔재 없음** — `moduleSpecifiersOf`/`valueEdgeToWebsocketService`/
  `isDynamicImport` 등 제거된 옛 식별자를 가리키는 주석·문서 참조가 파일 전체에 남아 있지
  않음을 `grep` 으로 확인.
- **`plan/in-progress/ws-event-types-extract.md`** — 새 체크리스트 항목("네 번째 재발에서
  패치를 멈추고 구조를 고쳤다")이 뮤테이션 표(M15~M18, N4/N5)·판정 기준 표를 코드와 동일하게
  재수록했고, "값 4 + 타입 8" 정정(`20_50_49` INFO7)도 `websocket-events.types.ts` 의 실제
  export 12종(enum 4 + interface/type 8)과 일치함을 `grep '^export'` 로 재확인. `## 체크리스트`
  의 `fresh /ai-review (fix 이후)`가 여전히 미체크인 것도 실제 상태(이번 라운드가 그 첫
  fresh review)와 정확히 일치.
- **`websocket.service.ts:134-136`** — 3라운드에 걸쳐 반복 지적되던 stale "KB union" 주석이
  이전 라운드(`20_27_08`)에서 파일-불변적 표현으로 정정된 상태가 이번 델타에서도 그대로
  유지됨을 재확인(이번 커밋은 이 파일을 건드리지 않았다).
- **README/CHANGELOG/API 문서**: 신규 공개 API·엔드포인트·환경변수·설정 옵션 없음(테스트
  파일 재작성 + plan 갱신뿐). 이 저장소 컨벤션(CHANGELOG 미사용, spec Rationale + plan 으로
  이력 관리)과 일치하며 갱신 대상 아님.

## 요약

이번 라운드가 처음 보는 실질 델타는 커밋 `fa1bca013` 하나이며, 범위는
`websocket-events.types.spec.ts` 재작성(간선 열거를 `moduleRefs` 단일 지점으로 통합 +
"eager/lazy" 의미 기반 판별로 전환)과 `plan/in-progress/ws-event-types-extract.md` 체크리스트
갱신으로 좁다. 새 헤더 JSDoc·함수별 문서·테스트명이 실제 구현과 정확히 일치하고, 이전 3라운드가
같은 파일에서 반복 지적한 "JSDoc orphan"·"stale 인용"류 패턴이 재발하지 않았음을 직접 대조로
확인했다. "네 라운드 연속" 이라는 수치 주장도 커밋 이력·이전 리뷰 기록과 교차 검증해 근거가
있다. 유일한 관찰은 신설된 정규식 상수 2개(`SERVICE_MODULE`/`EVENT_MODULES`)가 이 파일의
평소 문서화 밀도에 비해 설명 주석이 없다는 INFO 수준 사소한 지적뿐이며, 병합을 막을 문서화
사유는 없다.

## 위험도

NONE
