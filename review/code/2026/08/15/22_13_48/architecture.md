# 아키텍처(Architecture) 리뷰 — `22_13_48`

## 검토 방법

이 diff(`origin/main...HEAD`)는 `ws-event-types-extract` 리팩터(backend 27개 소스/spec
파일)와 그 위에 누적된 **7차례** 코드 리뷰(`19_27_37`→`20_05_17`→`20_27_08`→`20_50_49`→
`21_14_51`→`21_49_51`→본 라운드) + 2차례 consistency-check 산출물 + plan/spec 문서로
구성된다. 직전 아키텍처 라운드(`21_49_51`)는 위험도 NONE 으로 확정했다.

이번 라운드의 델타를 먼저 실측했다:

```
git show --stat eeaf9c3ba
```

프로덕션/테스트 코드로는 `websocket-events.types.spec.ts` **단 하나**만 건드리며(나머지는
plan 문서 + review 산출물), production 소스(`websocket-events.types.ts`,
`websocket.service.ts`, 25개 소비 지점)는 `21_49_51` 이후 **1바이트도 바뀌지 않았다** —
`git diff origin/main...HEAD --stat -- 'codebase/**/*.ts'` 로 27개 파일 목록을 재확인했고
전부 이미 6라운드에 걸쳐 검토된 동일 파일이다.

델타 커밋(`eeaf9c3ba`)의 내용을 현재 소스로 직접 대조했다:

- `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` 전체(399줄) —
  `importLeavesValueEdge` / `exportLeavesValueEdge` 로 판별 로직이 소진형(exhaustive)으로
  재구성됨을 재독
- `grep -rn "websocket\.service'" codebase/backend/src --include="*.ts"` (spec 제외) —
  잔존 값 import 지점이 전부 `WebsocketService` 클래스(DI 목적)뿐임을 재확인, 이벤트
  enum/타입 값 import 0건

## 발견사항

이번 라운드에서 새로 지적할 CRITICAL/WARNING 급 아키텍처 결함은 없다.

- **[INFO]** (재확인, 신규 아님) re-export facade 3중 수동 동기화 지점 — `20_27_08` 이래
  5개 라운드가 이미 기록·수용
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:31-46`,
    `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts:49-62`
  - 제안: 조치 불필요 — `tsc` 가 drift 를 fail-closed 로 잡는다는 근거가 5라운드 연속 유지.

- **[INFO]** (재확인, 신규 아님) 회귀 가드가 lint/CI 아키텍처 계층이 아니라
  unit-test 계층에서 `src/` 전체를 스캔하는 fitness-function 배치 — 이전 라운드가 이미
  검토·합의(후속 PR 에서 `no-restricted-imports` 승격 고려, 지금은 불필요).
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts`
    (`collectOffenders`, `moduleRefs`)
  - 제안: 조치 불필요.

## 확인 완료 — 이번 델타(exhaustive `ImportClause`/`ExportDeclaration` 소진)의 아키텍처 영향

- `importLeavesValueEdge(clause: ts.ImportClause | undefined)` / `exportLeavesValueEdge(decl:
  ts.ExportDeclaration)` 로 판별 로직이 재구성됐다. 두 함수 모두 **순수 함수**이고, 공유
  로직(`namedBindingValueNames`)은 정확히 한 곳에 있다 — `21_49_51` 커밋 메시지가 스스로
  지적한 "INFO1: 두 분기 로직 중복" 이 이번 델타로 실제로 해소됐음을 소스로 확인했다(중복
  조건식이 남아 있지 않음).
- 판별 전략이 "조건을 하나씩 덧대는 방식"(불리언 누적)에서 "문법 형태를 유한 집합으로
  소진"(`ImportClause` 는 clause 부재·default·namedBindings 셋뿐)으로 바뀐 것은, 저장소
  메모리에 기록된 "정적 가드는 정밀 파서 위에서 유한한 문제로 남겨야 한다"는 원칙과
  정확히 일치하는 방향이다 — 새 경우가 생기려면 TS 문법 자체가 바뀌어야 하므로, 지난
  6라운드처럼 "한 형태 덧댐 → 다음 형태 누락" 진자가 구조적으로 종결됐다.
- `moduleRefs()` 는 여전히 이 파일의 **유일한** 모듈 참조 열거 지점이고(`fa1bca013` 이래
  유지), 각 `it()` 블록은 그 결과를 거르기만 한다 — 단일 책임(간선 열거)과 소비자(assertion)
  분리가 이번 델타로도 후퇴하지 않았다.
- `import Def, { type Bar }` 케이스가 이제 `clause.name`(default 바인딩) 분기에서 명시적으로
  `true` 처리되어, 21_14_51→21_49_51 사이에 있었던 FN(네임드 유무만 본 탓에 default 바인딩을
  건너뛴 결함)이 회귀 여지 없이 닫혔다 — default·namedBindings·clause 부재 세 갈래를 각각
  독립적으로 검사하므로 한 갈래의 로직 변경이 다른 갈래를 깨뜨릴 결합이 없다.
- production 소스 재-grep 결과, `websocket.service` 로부터 남은 값 import 는 전부
  `WebsocketService` 클래스(DI 주입) 하나뿐이고 이벤트 enum/타입 값 import 는 0건 — #1174
  순환의 핵심 두 노드(`websocket.service`↔`websocket.gateway`) 모두 값 간선을
  의존성-프리 모듈로 이전한 상태가 유지된다. 클래스 레벨 DI 순환(`forwardRef`)은 의도적으로
  범위 밖으로 남아 있으며 이는 `websocket-events.types.ts` 헤더 주석이 스스로 명시한 범위와
  일치한다(은폐된 리스크 아님).

## 설계 평가

7차례 리뷰 이력의 마지막 델타인 이번 커밋은 프로덕션 아키텍처 표면(모듈 경계·순환·레이어
책임)을 전혀 건드리지 않고, 회귀 가드 자신의 판별 로직을 "조건 누적형"에서 "문법 형태
소진형"으로 재구조화해 지난 4라운드 동안 반복되던 FN/FP 진자를 구조적으로 종결했다.
핵심 프로덕션 설계 — ES-module 순환 위에 있던 `websocket.service.ts` 에서 값(enum)·타입
선언을 의존성 0 인 leaf 모듈로 분리하고, 하위호환은 re-export facade 로 유지하며, "다시
순환에 편입되지 않는다"는 불변식을 AST 기반 정적 가드로 코드에 고정한 것 — 은 SRP(서비스
구현 vs 값/타입 선언 분리)와 DIP(구체 서비스가 아니라 leaf 모듈에 의존)에 부합하는 정석적
순환 차단 기법이며, 6~7라운드에 걸쳐 발견의 성격이 "제품 코드 결함(1라운드) → 가드
자신의 미검출/오탐(2~6라운드) → 가드 판별 로직의 구조적 소진(본 라운드)"으로 수렴한 것은
근본 원인이 좁게 잡은 판별 기준이었고 그것이 이제 유한 집합 전수 검사로 닫혔다는 증거다.

## 요약

이번 라운드(`22_13_48`)는 직전 라운드(`21_49_51`)가 NONE 으로 확정한 아키텍처 구조 위에서,
회귀 가드 자신의 값/타입 간선 판별 로직을 조건 누적형에서 `ImportClause`/
`ExportDeclaration` 문법 형태 소진형으로 재구성한 테스트-전용 델타 하나만 추가한다.
프로덕션 27개 코드/spec 파일은 `21_49_51` 이후 변경이 없고, `websocket-events.types.ts` 는
여전히 import 0줄이며, production 소스 전수 재-grep 결과 이벤트 enum/타입을 옛 경로
(`websocket.service`)에서 값으로 가져오는 지점이 0건임을 재확인했다. 잔여 관찰(re-export
facade 3중 수동 동기화, 가드의 테스트-계층 배치)은 5개 라운드 전부터 이미 INFO 로 합의된
비차단 사안이며 이번 델타가 이를 악화시키지 않았다. 이 PR 을 막을 아키텍처 사유는 없다.

## 위험도

NONE
