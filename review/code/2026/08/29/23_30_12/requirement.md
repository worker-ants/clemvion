# Requirement Review — ws-event-types-followups (23_30_12)

## 검증 방법
- 실제 파일 4개(`notification-config.dto.ts`, `websocket-events.types.ts`, `websocket-events.types.spec.ts`, `websocket.service.ts`)를 `Read` 로 전문 확인.
- `grep -rn "NotificationEventType" codebase/` 전수 검색 — `InAppNotificationEventType`(신규) 과 DTO 쪽 `NotificationEventType`(의도적 잔존) 만 남고, 오래된 이름을 참조하는 사각지대가 있는지 확인.
- `npx jest src/modules/websocket/websocket-events.types.spec.ts` (12/12 GREEN), `npx jest src/modules/websocket/` (7 suites / 172 tests GREEN) 로 직접 재실행 — RESOLUTION.md 가 보고한 수치와 일치.
- `spec/5-system/6-websocket-protocol.md` §4.4, `spec/5-system/14-external-interaction-api.md` EIA-NX-02 를 열어 wire 값·화이트리스트가 이번 개명으로 변경되지 않았음을 대조.
- `git blame -L 85,92 spec/conventions/egress-masking.md` 로 plan 문서가 주장한 "그 문장은 developer 가 안 썼다" 를 직접 확인.
- `npx tsc --noEmit` 을 backend 전체에 대해 실행 — websocket/notification 관련 신규 에러 없음(기존에도 있던 무관한 presentation 노드 3개 파일의 사전 존재 에러만 나옴, 이번 diff 와 무관).
- 저장소를 뮤테이션하지 않음 — 순수 read-only 검증만 수행. `git status --short` 로 확인해도 이 세션이 남긴 변경 없음.

## 발견사항

- **[INFO]** 개명 근거로 쓰인 `<도메인>EventType` 네이밍 규칙이 `spec/conventions/**` 에 문서화돼 있지 않음(plan 자신도 "23_23_48 convention_compliance INFO 1" 으로 이미 지목·후속 planner 턴에 위임 기재).
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.ts:222-224` (JSDoc), `plan/in-progress/ws-event-types-extract.md` "같은 planner 턴에 함께 볼 것" 단락
  - 상세: 실제 다섯 enum(`ExecutionEventType`/`NodeEventType`/`BackgroundRunEventType`/`KbEventType`/`InAppNotificationEventType`) 은 그 패턴을 따르지만, 그 패턴 자체는 아직 spec 본문 어디에도 규칙으로 명문화돼 있지 않다. 회색지대(spec 침묵) 이고, 코드가 spec 을 위반한 것은 아니다.
  - 제안: 조치 불요(코드 관점). spec 갱신은 plan 이 이미 다음 planner 턴으로 위임한 항목이라 중복 지적하지 않음.

- **[INFO]** `plan/in-progress/ws-event-types-extract.md` 가 "developer 가 `egress-masking.md:89` 캐비엇을 직접 못 고친다" 는 근거로 든 `git blame` 결과(`bdcfdc514`, planner 커밋)를 독립적으로 재확인 — 정확함. `CLAUDE.md` §자기-반증형 소정정 조건 1(developer 자신이 그 문장을 썼을 것) 불충족 판정이 옳고, `plan/complete/` 미이동은 프로세스상 정상 대기 상태이지 결함이 아니다.
  - 위치: `plan/in-progress/ws-event-types-extract.md` "② 산출은 끝냈고, 이동이 막혔다" 단락
  - 상세: `git blame -L 85,92 spec/conventions/egress-masking.md` 결과 89번째 줄 저자는 `bdcfdc514c`(`docs(conventions)`, 2026-08-22) — developer 본인 커밋이 아님을 확인.
  - 제안: 없음(검증 통과, 정보성 기록).

## 기능 완전성 / 엣지 케이스 / 반환값 (핵심 diff)

1. **개명(`NotificationEventType` → `InAppNotificationEventType`) 전수 확인**: `websocket-events.types.ts` 선언 + `{@link}`, `websocket.service.ts` import/re-export/사용 3곳, `websocket-events.types.spec.ts` 의 `EXPECTED_EXPORTS` — plan 이 주장한 "6곳" 과 정확히 일치. `grep -rn NotificationEventType codebase/` 결과 그 외 잔존 참조 0건(DTO 쪽 동명 타입 2곳은 의도적으로 남김, disambiguation JSDoc 양쪽 대칭 확인).
2. **`hasDefaultExport` 리팩터**: `ExportAssignment`(`export default X` / `export = X` 공용 AST) · modifier `default` · `NamedExports` 의 `as default` 별칭(직접 + `from` 절) 3형태를 전수 소진. 신규 `it.each` 테이블이 양성 4케이스 + 음성 2케이스를 합성 소스로 고정 — 12/12 GREEN 직접 재실행 확인. RESOLUTION.md 가 보고한 "main 독립 재검증" 뮤테이션 결과(별칭 술어 무력화 → RED 2, `return true` 뭉갬 → RED 3)도 이 로직의 방어 완전성과 정합적이다.
3. **캐스트 제거(`getModifiers(st as ts.HasModifiers)` → `ts.canHaveModifiers` 가드)**: 타입이 실제 계약(모든 statement 가 modifier 를 가질 수 있는 게 아님)을 반영하도록 좁혀졌고, 런타임 동작 변화 없음(순수 타입 정밀화).
4. **반환값**: `hasDefaultExport` 는 모든 경로에서 명시적 boolean 을 반환(early return 3개 + 최종 표현식) — falls-through 로 `undefined` 가 새는 경로 없음.
5. **TODO/FIXME/HACK/XXX**: 4개 대상 파일 전수 grep 결과 0건.
6. **에러 시나리오**: 이번 diff 는 컴파일타임 심볼 개명 + 정적 분석 헬퍼 리팩터라 신규 런타임 에러 경로가 없다. 기존 `WebsocketService.emitNotificationEvent` 의 try/catch(소켓 미준비 시 WARN 로그) 는 불변.
7. **데이터 유효성/비즈니스 로직**: DTO 의 `NOTIFICATION_EVENT_TYPES` 화이트리스트 값·검증 데코레이터(`@IsIn` 등)는 이번 diff 에서 손대지 않았고, `spec/5-system/14-external-interaction-api.md` EIA-NX-02 의 5값과 여전히 일치.

## Spec fidelity

- `spec/5-system/6-websocket-protocol.md` §4.4 는 wire 이벤트명 `notification.new` 와 payload shape 만 규정하고 TS 심볼 이름은 언급하지 않는다 — 이번 개명은 spec 표면과 무관한 내부 리팩터. `grep -rn "NotificationEventType\|InAppNotificationEventType" spec/` 결과 0건으로, plan 문서가 주장한 "spec 은 이 이름을 인용하지 않는다" 를 그대로 확인.
- EIA §3.1 EIA-NX-02 의 5개 이벤트값(`execution.waiting_for_input`/`completed`/`failed`/`cancelled`/`ai_message`)과 `notification-config.dto.ts` 의 `NOTIFICATION_EVENT_TYPES` 배열이 line-level 로 일치 — 이번 diff 에서 값 변경 없음(JSDoc 만 추가).
- spec 결함·drift 없음.

## 요약

핵심 diff(파일 1~4)는 `NotificationEventType` → `InAppNotificationEventType` 개명(내부 심볼, wire 값 불변)과 `hasDefaultExport` 정적 가드의 세 번째 분기(별칭 default export)에 대한 회귀 테스트 하드닝으로, 두 변경 모두 완전하고 정확하다. 개명은 6곳 전수 확인(grep 으로 잔존 참조 0건 재확인)되었고 disambiguation JSDoc 이 DTO 쪽·WS 쪽 양방향 대칭이다. `hasDefaultExport` 는 AST 세 형태를 빠짐없이 다루고, 신규 `it.each` 합성 소스 테이블(양성 4/음성 2)이 이전 라운드의 WARNING(임시 사본 뮤테이션 증거가 영구 테스트로 남지 않음)을 정확히 해소했다 — 직접 재실행(12/12, 172/172 GREEN)과 RESOLUTION.md 의 독립 재검증 뮤테이션(별칭 무력화 → RED 2, 함수 뭉갬 → RED 3) 결과가 일치한다. spec fidelity 는 EIA-NX-02 화이트리스트·§4.4 wire shape 모두와 line-level 로 정합하며 이번 diff 가 그 값들을 건드리지 않았다. TODO/FIXME 없음, 모든 경로에서 반환값 명시, 에러 시나리오 변경 없음. 남은 두 관찰(네이밍 컨벤션 미문서화, plan-complete 이동 대기)은 모두 plan 문서 자신이 이미 정확히 진단하고 다음 planner 턴으로 위임한 상태로, 코드 결함이 아니라 INFO 로만 기록한다.

## 위험도
NONE
