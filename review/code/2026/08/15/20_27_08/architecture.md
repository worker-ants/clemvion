# 아키텍처(Architecture) 리뷰

## 검토 방법

이 라운드(`20_27_08`)의 diff(`origin/main...HEAD`, 73개 파일)는 실질적으로 `ws-event-types-extract`
리팩터 자체(코드 26개 파일) + 그 위에서 이미 진행된 두 차례 코드 리뷰(`19_27_37`, `20_05_17`)의
누적 산출물(RESOLUTION/개별 리포트) + `consistency-check`(`18_53_27`, `20_05_19`) 산출물 +
spec frontmatter 1줄로 구성된다. 즉 사실상 "두 라운드 fix 이후의 fresh review" 다.

기존 두 라운드가 이미 WARNING 7건(순환 노드 누락 · JSDoc 고아 2건 · 회귀 테스트 부재 · disambiguation
JSDoc 병합 · `import type` 누락 3곳 · 가드 테스트 blind-spot)을 찾아 모두 반영했다고 기록하고 있어,
이번 라운드는 그 "반영 완료" 주장을 재검증하는 데 집중했다. diff 조각만으로는 순환 참여 여부·재-export
동기화 상태를 판정할 수 없으므로 아래 파일들을 직접 `Read`/`Grep` 로 현재 워크트리에서 열어 대조했다
(diff 인용이 아니라 실제 소스 확인):

- `codebase/backend/src/modules/websocket/websocket-events.types.ts` 전체(266줄) — import 0줄 재확인
- `codebase/backend/src/modules/websocket/websocket.service.ts` 상단 re-export 블록·WARN #10 위치·`134-136`행 stale 주석
- `codebase/backend/src/modules/websocket/websocket.gateway.ts` — `ExecutionEventType`/`WebsocketService` 참조 전수
- `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts` — `TERMINAL_SHAPE`/클래스 JSDoc 인접성
- `grep -rn "from '.*websocket\.service'"` 로 `src/` 전체에서 남은 `websocket.service` importer 전수(9곳 — 전부 `WebsocketService` 클래스 값 import, enum 값 재유입 0)
- `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` 전체(214줄) — 가드 로직 재독

## 발견사항

이번 라운드에서 새로 지적할 CRITICAL/WARNING 급 아키텍처 결함은 없다. 직전 두 라운드가 찾은 항목은
현재 소스에서 실제로 해소되어 있음을 직접 확인했다(재확인 상세는 아래 "확인 완료" 참고).

- **[INFO]** re-export facade 가 3중 수동 동기화 지점을 만든다 — 이미 알려진 트레이드오프, tsc 로 fail-closed
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` 의 `export { ... } / export type { ... }` 블록(값 4·타입 8), `codebase/backend/src/modules/websocket/websocket-events.types.ts` 의 실제 선언 12개, `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` 의 `EXPECTED_EXPORTS` 배열(12개) — 세 곳이 각각 손으로 나열된 동일 식별자 목록이다.
  - 상세: 새 이벤트 타입/enum 을 `websocket-events.types.ts` 에 추가했는데 `websocket.service.ts` 의 re-export 블록에 반영을 빠뜨리면, `from '.../websocket.service'` 로 값/타입을 가져오던 13곳 소비자가 컴파일 에러로 즉시 드러난다(사용 시점) — 이는 이전 라운드가 이미 "INFO, `tsc` 가 fail-closed" 로 판정한 근거와 동일하며, 이번 재확인에서도 반증되지 않았다. 다만 `EXPECTED_EXPORTS` 배열은 반대 방향(선언이 딴 데로 옮겨가는 경우)만 잡고, "새 선언을 추가했는데 facade 에 재-export 를 깜빡한 경우"는 어떤 자동 가드도 잡지 않는다 — 사용하는 소비자가 없으면 조용히 새 export 가 facade 를 통해서는 영영 접근 불가능한 상태로 남을 수 있다(런타임 오류는 아니고, 그 경로로 값을 가져오려는 새 코드가 나올 때만 드러난다).
  - 제안: 조치 불필요(비차단). 다만 후속에서 이 목록을 하드코딩 3벌 대신 `export * from './websocket-events.types'` 형태(barrel re-export)로 대체하면 동기화 지점이 1곳으로 줄어든다 — re-export 되는 대상이 이미 이 모듈의 전체 export 표면과 동일하므로 selective re-export 를 유지할 이유가 약하다. Critical/Warning 아님, 다음 관련 PR 에서 고려할 정도.

- **[INFO]** 순환 재편입 가드가 lint/CI 아키텍처 계층이 아니라 단위 테스트 계층에 있다 — 의도된 설계, 비차단
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` (`allTsFiles(SRC_ROOT)` — `SRC_ROOT = backend/src` 전체를 재귀 탐색)
  - 상세: "`websocket-events.types.ts` 는 의존성 0 이어야 한다" + "아무도 `websocket.service` 에서 enum 값을 값-import 하지 않는다" 라는 두 아키텍처 불변식이, `eslint`(`no-restricted-imports`/`import/no-cycle`) 나 `dependency-cruiser`/`madge` 같은 그래프 레벨 정적 분석 도구가 아니라 `websocket` 모듈 디렉터리 안의 Jest spec 파일 하나가 `src/` 전체(~1,230 파일)를 TS 파서로 훑는 형태로 구현되어 있다. 기능적으로는 견고하다(뮤테이션 6/6 + 4/4 RED, 공허 방지 단언 포함, 이전 두 라운드가 실측 검증) — 다만 **아키텍처 경계 하나를 지키는 책임이 그 경계와 무관한 위치(단일 모듈의 spec 파일)에서 저장소 전역을 스캔하는 형태로 구현**된 것은 통상적인 계층 분리(architecture fitness function 은 보통 별도 `*.arch.spec.ts` 또는 CI lint 단계로 분리)와는 다른 배치다. 실행 비용(파일 I/O + 파싱, 두 라운드 실측 약 1초)도 이 spec 파일 하나가 짊어진다.
  - 제안: 조치 불필요 — 두 차례 리뷰가 이미 이 지점을 지적했고(`19_27_37/dependency.md`, `19_27_37/testing.md`) "lint 레벨 가드는 후속 개선, Critical/Warning 아님" 으로 합의된 사안이다. 이번 재검토도 그 판단에 동의한다. 후속 PR 에서 이 spec 을 `eslint-plugin-import` 의 `no-restricted-imports` overrides 로 승격하거나 최소한 파일명을 `*.arch.spec.ts` 류로 분리해 "이건 일반 단위 테스트가 아니라 아키텍처 가드다" 를 명시하면 의도가 더 뚜렷해진다.

## 확인 완료 — 직전 두 라운드 WARNING 반영 상태 재검증 (문제 없음)

- **순환 당사자 노드 누락** (`19_27_37` W1): `websocket.gateway.ts` 전체를 grep — `ExecutionEventType` import 는 `./websocket-events.types`(23행) 하나뿐이고, `WebsocketService`/`websocket.service` 에 대한 참조가 파일 전체에 0건. `websocket.service.ts → websocket.gateway.ts` 직접 2-노드 순환의 gateway 쪽이 이제 의존성-프리 모듈만 값으로 참조한다.
- **`ExecutionEventEmitter` 클래스 JSDoc 고아화** (`19_27_37` W2): `execution-event-emitter.service.ts` 를 전체 재독 — `TERMINAL_SHAPE` JSDoc+선언(50-84행)이 클래스 JSDoc(86-101행) **앞**에 위치해 `@Injectable() export class`(103-104행)에 클래스 JSDoc 이 바로 인접.
- **재-export facade 동기화**: `websocket.service.ts` 의 값 4종(`ExecutionEventType`/`NodeEventType`/`BackgroundRunEventType`/`NotificationEventType`) + 타입 8종 재-export 목록과, `websocket-events.types.ts` 의 실제 `export` 12종을 1:1 대조 — 완전 일치.
- **잔여 순환의 다른 세 노드**(`execution-engine.service.ts`/`retry-turn.service.ts`/`execution-event-emitter.service.ts`): `execution-event-emitter.service.ts:2,110-111` 이 여전히 `forwardRef(() => WebsocketService)` 로 `WebsocketService` **클래스**를 값으로 주입받는다 — 이는 plan 이 명시한 범위 밖(`WebsocketService` 자체의 책임 분리·`forwardRef` 제거는 별도 판단)이며, enum 값이 아니라 서비스 클래스에 대한 DI 이므로 이번 리팩터가 고치는 위험 클래스(모듈 스코프 enum 평가)에 해당하지 않는다. `execution-engine.service.ts`/`retry-turn.service.ts` 는 `ExecutionEventType`/`NodeEventType` 을 `websocket-events.types` 에서만 값으로 가져오고 `websocket.service` 경유 값 import 는 0건.
- **`src/` 전체 재스캔** (`grep -rn "from '.*websocket\.service'" --include="*.ts"`, `.spec.ts` 제외): 9곳 전부 `WebsocketService` 클래스 import(의도된 sink 참조)이고 enum 값 재유입은 0건 — `websocket-events.types.spec.ts` 세 번째 테스트가 주장하는 상태와 실측이 일치.

## 설계 평가

이 리팩터의 핵심 기법 — ES-module 순환 위에 있는 서비스 구현체에서 값/타입 선언만 떼어 **의존성 0**인
leaf 모듈로 옮기고, 원 파일은 re-export 로 하위호환을 유지한다 — 은 순환에서 발생하는 모듈-평가-순서
버그(#1174)를 근본 차단하는 정석적 해법이다. SRP 관점에서 `websocket.service.ts` 가 지던
"서비스 구현체 + 공유 값/타입 정의처" 이중 책임이 분리됐고, 의존성 역전 관점에서도 다수 소비자
(22개 파일)가 이제 구체 구현체가 아니라 값-전용 계약 모듈에 의존하게 되어 결합도가 낮아졌다.
`forwardRef`/DI 그래프·emit 단일 sink 정책은 의도적으로 범위 밖에 남겨(plan 문서에 명시) 이번
작업의 경계를 좁게 유지했고, 그 경계가 코드 주석(`websocket-events.types.ts` 헤더)과 plan 양쪽에
일관되게 기록돼 있다. 25→13개 import 재배선, 역재현 검증(부분 이동 시 66 suites 실패 → 전체 이동 후
425/425 통과), TS 파서 기반 회귀 가드(mutation 6/6 + 4/4 RED)까지 갖춰 "이 모듈은 의존성 0 이어야
한다"는 구조적 불변식이 주석 서술이 아니라 실행 가능한 코드로 고정되어 있다는 점이 특히 견고하다.
유일한 잔여 관찰은 그 가드의 물리적 배치(모듈-로컬 spec 파일이 저장소 전역을 스캔)와 re-export
facade 의 3중 수동 리스트 동기화인데, 둘 다 기능적으로는 안전하고(각각 mutation-tested·tsc
fail-closed) 이전 두 라운드가 이미 INFO 로 합의한 사안이라 이번 라운드가 독자적으로 반증하지 못했다.

## 요약

3개월치 리뷰 이력(2개 코드 리뷰 라운드 + 2개 consistency-check 라운드)이 누적된 이 diff 를 소스
직접 재검증으로 다시 훑은 결과, 직전 라운드가 지적한 아키텍처 WARNING(순환 참여 노드 누락, 클래스
JSDoc 고아화)은 모두 실제로 해소되어 있고 새로 발견한 CRITICAL/WARNING 급 이슈는 없다. `websocket.service`
경유 enum 값 재유입 표면은 `src/` 전체 재스캔 기준 0건이며, 잔여 4-노드 순환(forwardRef 기반)은
plan 이 명시적으로 범위 밖으로 남긴 부분이고 이번 리팩터가 그 순환 위의 값 평가 안전성만 별도로
확보했다는 설계 목표와 실제 코드 상태가 일치한다. re-export facade 의 수동 동기화와 순환 가드의
테스트-계층 배치는 구조적으로 완전히 이상적이지는 않지만 이미 mutation-test 로 검증된 안전장치이며
비차단 INFO 수준으로 유지한다. SOLID·결합도·레이어 책임·순환 의존성·확장성 전 관점에서 이 PR 을
막을 사유는 없다.

## 위험도

NONE
