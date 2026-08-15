# 문서화(Documentation) 리뷰

## 검토 방법

이 diff(`origin/main`..HEAD)는 직전 리뷰(`19_27_37`)와 그 RESOLUTION 수정 커밋(`65da1a9d7`)까지 포함한다.
`19_27_37/documentation.md`(직전 라운드)가 지적한 WARNING 3건(W2 클래스 JSDoc orphan · W3
`NotificationEventType` JSDoc 이중 블록 · W4 WARN#10 고아 JSDoc)이 실제로 반영됐는지, 그리고
이번 diff 전체(38개 소스/스펙/plan 파일)에 새로 도입된 문서화 결함이 있는지를 현재 소스를 직접
`Read`/`git diff origin/main`으로 열어 확인했다.

## 발견사항

- **[INFO]** `websocket.service.ts` 의 stale 컨텍스트 주석이 이번 리팩터로 참조 대상을 잃었다 — 여전히 미수정
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:134-135`
  - 상세: 이 두 줄(`(블록 JSDoc 으로 두었더니 붙을 선언이 없어 **바로 아래 KB union 문서로 읽혔다** — `14_55_29` maintainability W4.)`)은 WARN #10 JSDoc 을 왜 `//` 라인 주석으로 바꿨는지 설명하며 "바로 아래 KB union 문서"를 근거로 든다. 그런데 이번 PR 이 바로 그 `KbEventType` union 선언 전체를 `websocket-events.types.ts` 로 옮기면서, 이 주석 바로 아래에는 이제 `TERMINAL_EXECUTION_EVENTS`(execution 채널 종결 이벤트 Set) 문서가 온다 — "KB union" 은 이 파일 어디에도 없다. 직전 라운드(`19_27_37/documentation.md` INFO #3)가 정확히 이 문제를 이미 지적했었고("이력적 근거로는 여전히 유효하지만... 혼동할 수 있다", "급하지 않음"), `RESOLUTION.md` 의 반영 항목(W1~W5)·INFO 처분 표(1~6) 어디에도 이 항목이 포함되지 않아 이번 수정 커밋(`65da1a9d7`)에서 그대로 넘어갔다. 기능에는 영향 없으나, 이 파일을 처음 읽는 개발자가 "바로 아래 KB union"을 찾다가 못 찾는 정확한 재현 경로가 남아 있다.
  - 제안: "바로 아래 KB union 문서로 읽혔다"를 "바로 아래 `KbEventType` 문서로 읽혔다(현재는 `websocket-events.types.ts` 로 이동, 이 주석 아래엔 `TERMINAL_EXECUTION_EVENTS`)"처럼 파일-불변적 표현으로 다듬거나, 이번 PR 이 이미 W2/W3 에서 손댄 인접 JSDoc 블록들과 함께 정리. 급하지 않으므로 후속 커밋으로 미뤄도 무방.

## 그 외 확인 — 직전 라운드 지적 사항 수정 검증 (문제 없음)

- **W1 (architecture, gateway 순환 노드 누락)**: `websocket.gateway.ts:23` 이 `./websocket-events.types` 로 전환됨을 `git diff` 로 확인. `websocket-events.types.spec.ts` 의 3번째 테스트("enum 값을 `websocket.service` 경유로 가져오는 파일이 없다")가 이 회귀를 정적으로 고정한다.
- **W2 (클래스 JSDoc orphan)**: `execution-event-emitter.service.ts` 현재 소스 확인 — `TERMINAL_SHAPE` 상수+JSDoc(11-84행)이 클래스 JSDoc(86-101행) **위**로 재배치되어 `@Injectable()` 클래스 선언에 클래스 JSDoc 이 정상 인접한다.
- **W3 (`NotificationEventType` JSDoc 이중 블록)**: `websocket-events.types.ts:209-218` 확인 — 채널/권위 출처 설명과 disambiguation 경고가 한 블록으로 병합되어 `export enum NotificationEventType` 에 정상 부착된다.
- **W4 (WARN #10 고아 JSDoc)**: `websocket-events.types.ts` 에서 WARN #10 블록이 완전히 제거되고, `websocket.service.ts:51-58` — 실제 구현(`CREDENTIAL_KEY_PATTERN`) 바로 위로 이동해 정상 부착됐다.
- **INFO3 (import type 문법 혼용)**: `embedding.service.ts`/`graph-extraction.service.ts` 의 `import { type KbEventType }` → `import type { KbEventType }` 로 통일됨을 확인(저장소 다수 스타일과 일치).
- **W5 (불변식 회귀 테스트 부재)**: `websocket-events.types.spec.ts`(신규, 169줄) 확인 — TS 파서 기반으로 `import`/`export…from`/`import=require`/동적 `import()` 를 모두 세는 4개 테스트, 공허 방지 단언(선언 수·allowlist 파일 실재), 모듈 헤더 JSDoc 모두 구체적 근거(#1174, 72 suites)를 담고 있어 품질이 높다.
- 나머지 20여 개 파일의 diff(`chat-channel.dispatcher.ts`, `notification-fanout.service.ts`, `sse-adapter.service.ts`, `background-execution.processor.ts`, 각 `*.spec.ts` 등)는 전부 `websocket.service` → `websocket-events.types` import 경로 교체뿐인 기계적 변경이며 문서화 관점 결함 없음.
- `spec/5-system/6-websocket-protocol.md` frontmatter `code:` 목록에 신설 파일 추가 — 정확하고 최소한의 갱신.
- `plan/in-progress/ws-event-types-extract.md`(신규 161줄) — "왜"·"실측"·"역재현"·"구현 중 잡은 것" 섹션이 구체적 수치(25→13, 12곳→66 suites 실패→9곳 분리→425/425, 뮤테이션 6/6 RED 표)로 근거를 남긴 모범적 plan 문서. 체크리스트의 "fresh `/ai-review`(fix 이후)"가 미체크 상태인 것도 실제 상태(이번 리뷰가 그 fresh review)와 정확히 일치.
- `review/code/2026/08/15/19_27_37/RESOLUTION.md` — Warning 5건 각각의 지적·조치·근거(특히 W4 "리뷰 처분을 그대로 따르지 않고 실측으로 반박" 케이스)를 투명하게 기록해 리뷰 이력 추적성이 높다.
- README/CHANGELOG/API 문서: 신규 공개 API·엔드포인트·환경변수·설정 옵션 없음(순수 내부 모듈 리팩터) — 갱신 대상 아님. 이 저장소는 CHANGELOG.md 를 쓰지 않고 spec Rationale + plan 으로 변경 이력을 관리하는 기존 컨벤션과 일치.

## 요약

직전 라운드(`19_27_37`)가 지적한 문서화 WARNING 3건(클래스 JSDoc orphan, `NotificationEventType` JSDoc 이중 블록, WARN #10 고아 JSDoc)과 INFO 1건(import type 혼용)은 수정 커밋(`65da1a9d7`)에서 모두 실제로 반영되었음을 현재 소스에서 직접 확인했다. 새 회귀 가드(`websocket-events.types.spec.ts`, TS 파서 기반)도 모듈 헤더·목적·검증 대상을 구체적으로 서술해 문서 품질이 높다. 유일한 잔여 항목은 `websocket.service.ts:134-135` 의 stale 컨텍스트 주석("바로 아래 KB union 문서") — 이번 리팩터가 그 KB union 자체를 다른 파일로 옮기면서 참조가 깨졌는데, 직전 라운드가 이미 INFO 로 지적했음에도(급하지 않음으로 처분) 이번 수정 커밋에서 함께 정리되지 않았다. 기능·컴파일에는 영향 없는 순수 텍스트 결함이라 병합을 막을 사유는 아니다. 그 외 20여 개 파일의 import 경로 교체는 전부 기계적이며, plan/spec 문서 갱신(frontmatter `code:` 목록, in-progress plan 라인 인용 심볼 전환)도 정확하고 시의적절하다.

## 위험도

LOW
