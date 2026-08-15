# 아키텍처(Architecture) 리뷰 — `21_14_51`

## 검토 방법

이 diff(`origin/main...HEAD`)는 `ws-event-types-extract` 리팩터(backend 코드 27개 파일) +
그 위에서 누적된 4차례 코드 리뷰(`19_27_37` → `20_05_17` → `20_27_08` → `20_50_49`)와
2차례 consistency-check 산출물 + spec frontmatter 1줄로 구성된다. 직전 아키텍처 라운드
(`20_50_49`)는 위험도 NONE 으로 수렴했다. 이번 라운드에서 그 이후 추가된 실질 코드 델타는
커밋 `fa1bca013`("네 번째 재발에서 패치를 멈췄다 — 간선 열거를 한 곳으로")로, 회귀 가드
(`websocket-events.types.spec.ts`)의 모듈 간선 판별 로직을 `moduleRefs()` 단일 헬퍼로
통합한 것이다. 프롬프트 게이트가 아니라 현재 워크트리 소스를 직접 `Read`/`grep` 로
재대조했다:

- `codebase/backend/src/modules/websocket/websocket-events.types.ts` 전체(265줄) — import 0줄 재확인
- `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` 전체(318줄) — `moduleRefs`/`originalName`/`insideFunction` 로직 재독
- `codebase/backend/src/modules/websocket/websocket.gateway.ts` — `ExecutionEventType` import 경로(`./websocket-events.types`, 23행) + DI 순환(`forwardRef`, 115-126행) 확인
- `codebase/backend/src/modules/websocket/websocket.service.ts` 상단 46행 — 값/타입 import·re-export 분리 형태

## 발견사항

이번 라운드에서 새로 지적할 CRITICAL/WARNING 급 아키텍처 결함은 없다.

- **[INFO]** re-export facade 가 여전히 3중 수동 동기화 지점(`websocket.service.ts` export
  블록 / `websocket-events.types.ts` 선언 / `websocket-events.types.spec.ts` 의
  `EXPECTED_EXPORTS`)이다 — `20_27_08`/`20_50_49` architecture.md 가 이미 기록한 관찰이며
  이번 라운드의 `moduleRefs()` 통합 커밋은 이 구조 자체를 바꾸지 않았다. 재확인만 하고 새
  항목으로 세지 않는다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` (`export { … } / export type { … }` 블록, 31-46행), `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` (`EXPECTED_EXPORTS` 배열, 49-62행)
  - 제안: 조치 불필요(비차단, 3개 라운드 연속 합의 유지).

- **[INFO]** 순환 재편입 가드가 lint/CI 아키텍처 계층이 아니라 단위 테스트 계층
  (`websocket-events.types.spec.ts`)에서 `src/` 전체(~1,230 파일)를 파일마다 파싱해 스캔하는
  배치도 이전 라운드가 이미 지적·합의한 사안이다. 이번 커밋은 오히려 이 배치를 **개선**했다 —
  종전에 테스트마다 산발적으로 파일을 다시 읽던 것을 `collectOffenders()` 로 통합해 전수 스캔이
  한 곳에서만 일어나도록 했다(파일당 1회 파싱). 구조 자체(단위 테스트 계층에 fitness function 을
  두는 선택)는 그대로지만 델타는 개선 방향이다.
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` (`collectOffenders`, 217-228행)
  - 제안: 조치 불필요 — 이전 라운드가 "후속 PR 에서 `no-restricted-imports`/`*.arch.spec.ts` 로 승격 고려"로 이미 처분했고 이번 라운드가 그 판단을 반증할 근거가 없다.

## 확인 완료 — `moduleRefs()` 통합의 아키텍처 영향 (문제 없음)

- **간선 열거 단일화**: 이전에는 "완전한 열거"와 "손으로 다시 짠 좁은 열거"가 테스트마다
  따로 있어(리뷰 4라운드 연속 후자가 형태를 놓쳤다 — `export … from`(`20_05_17`) → 별칭
  오판정(`20_27_08`) → `require()`(`20_50_49` 이후)), 이번 커밋이 `moduleRefs(sf): ModuleRef[]`
  하나로 `import`/`export … from`/`import = require`/top-level `require`/동적 `import()` 5개
  문법 형태를 전부 반환하고 각 `it()` 은 그 결과를 필터링만 하도록 재구성했다. 이는 **간선
  판별이라는 단일 책임을 한 함수로 모으는 정당한 SRP 정리**이고, "판별 로직 이원화 → 좁은
  쪽이 계속 blind spot 을 만든다"는 4라운드짜리 근본 원인을 구조적으로 닫는다 — 인스턴스
  patch 가 아니라 부류(class of bug)를 없앤 리팩터다.
- **eager/lazy·value/type 분류가 데이터로 표현됨**: `ModuleRef.eager`/`ModuleRef.value` 필드로
  판정 기준을 명시적 데이터 모델로 승격했고, 각 테스트는 그 필드를 필터링하는 선언적 조건문만
  갖는다(예: `r.eager && r.value && SERVICE_MODULE.test(r.specifier)`). 이 파일이 커지면서도
  응집도가 흐트러지지 않았다 — 새 문법 형태가 추가되면 `moduleRefs()` 안에 분기 하나만
  추가하면 되고, 5개 테스트는 손댈 필요가 없다(개방-폐쇄 원칙에 부합).
- **`websocket.gateway.ts` 순환 노드 상태 회귀 없음**: `import { ExecutionEventType } from
  './websocket-events.types'`(23행)로 유지되고 있으며, `WebsocketService`/`websocket.service`
  값·타입 참조는 여전히 0건(grep 재확인) — `19_27_37` W1 이 지적했던 결함이 이후 라운드에서
  회귀하지 않았다.
- **클래스 레벨 DI 순환은 의도적으로 그대로**: `websocket.gateway.ts` 생성자가
  `forwardRef(() => ExecutionEngineService)` / `forwardRef(() => RetryTurnService)` /
  `forwardRef(() => ExecutionsService)` 를 그대로 유지(115-126행)하고, `websocket.service.ts`
  는 `WebsocketGateway` 를 값으로 import 한다(3행) — 즉 서비스 인스턴스 그래프의 순환은
  이번 리팩터로 제거되지 않았다. 이는 은폐된 리스크가 아니라 `websocket-events.types.ts`
  헤더 주석이 스스로 명시한 범위("이 모듈은 그 봉인 기법을 대체하지 않는 보완 조치다 — 값
  평가 순서만 정리한다")와 정확히 일치하고, `4-execution-engine §4.4` Rationale 이 유예한
  "이벤트 기반 디커플링" 대규모 리팩터의 존재도 같은 문서에 명시돼 있다. 범위 밖 결정을
  숨기지 않고 문서화한 점은 아키텍처 커뮤니케이션 관점에서 바람직하다.

## 설계 평가

5차례 리뷰 이력의 마지막 단계인 이번 diff 는, 회귀 가드 자신의 판별 로직을 한 함수로
통합하는 것 외에 프로덕션 아키텍처 표면(모듈 경계·순환·레이어 책임)을 전혀 바꾸지 않는다.
핵심 설계 — ES-module 순환 위에 있던 `websocket.service.ts` 에서 값(enum)·타입 선언을
의존성 0인 leaf 모듈(`websocket-events.types.ts`)로 물리적으로 분리하고, 하위호환은
re-export facade 로 유지하며, "다시 순환에 편입되지 않는다"는 불변식을 AST 기반 정적 가드
(fitness function)로 코드에 고정한다 — 는 SRP(서비스 구현 vs 값/타입 선언 분리)와 DIP
(구체 서비스가 아니라 값·타입 leaf 모듈에 의존)에 부합하는 정석적 순환 차단 기법이다.
이 가드 코드 자체가 4라운드 연속 스스로의 blind spot 을 리뷰에 지적당하다가, 이번에 그
근본 원인(판별 로직 이원화)을 단일 헬퍼로 제거한 것은 "패치의 패치"를 멈추고 구조로
수렴한 사례로 평가할 만하다.

## 요약

이번 라운드(`21_14_51`)는 직전 라운드(`20_50_49`)가 NONE 으로 확정한 아키텍처 구조 위에서,
회귀 가드의 모듈 간선 판별 로직을 `moduleRefs()` 단일 함수로 통합해 4라운드 연속 반복되던
"판별 로직 이원화 → 좁은 쪽이 새 문법 형태를 놓친다"는 결함 부류를 구조적으로 닫은 것이다.
`websocket.gateway.ts` 의 순환 노드 이탈은 회귀하지 않았고, `websocket-events.types.ts` 는
여전히 import 0줄이며, 클래스 레벨 DI 순환(`forwardRef` 3곳)이 의도적으로 남아 있다는 사실도
소스 주석에 정직하게 문서화되어 있다. 잔여 관찰(re-export facade 3중 수동 동기화, 가드의
테스트-계층 배치)은 세 라운드 전부터 이미 INFO 로 합의된 비차단 사안이며 이번 라운드가 이를
악화시키지 않았다. 이 PR 을 막을 아키텍처 사유는 없다.

## 위험도

NONE
