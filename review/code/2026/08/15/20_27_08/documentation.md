# 문서화(Documentation) 리뷰 — `20_27_08`

## 검토 방법

이 diff(`origin/main`..HEAD)는 `ws-event-types-extract` 작업의 전체 커밋 5개
(`8e0728a90`~`a6d764ac6`)와 그 사이 3라운드의 review/consistency 산출물 전부를 포함한다.
직전 세 라운드(`19_27_37`→`20_05_17`→consistency `20_05_19`)의 documentation 관점
WARNING 4건(클래스 JSDoc orphan · `NotificationEventType` JSDoc 이중 블록 · WARN #10
credential JSDoc 고아화 · `import type` 누락 3곳)과 INFO 1건(`websocket.service.ts` stale
"KB union" 주석)이 최종 커밋(`a6d764ac6`)에서 실제로 반영됐는지 프롬프트의 diff 게이트가 아니라
현재 소스(`Read`)를 직접 열어 대조했다. 아래는 그 실측 결과다.

## 발견사항

없음 — Critical/Warning/INFO 신규 항목 없음.

## 그 외 확인 — 직전 라운드 지적 사항의 최종 반영 검증 (전부 해소 확인)

- **클래스 JSDoc orphan (`19_27_37` W2)**: `execution-event-emitter.service.ts` 현재
  소스 — `TERMINAL_SHAPE` 상수+JSDoc(11-84행)이 클래스 JSDoc(86-101행) **위**에 위치해
  `@Injectable()` 클래스 선언에 클래스 JSDoc 이 정상 인접함을 확인.
- **`NotificationEventType` JSDoc 이중 블록 (`19_27_37` W3)**:
  `websocket-events.types.ts:209-218` — 채널/권위 출처 설명과 disambiguation 경고가 한
  블록으로 병합되어 `export enum NotificationEventType` 에 정상 부착됨을 확인.
- **WARN #10 credential JSDoc 고아화 (`19_27_37` W4)**: `websocket-events.types.ts` 에
  WARN #10 블록이 남아있지 않고, `websocket.service.ts:51-58` — 실제 구현
  (`CREDENTIAL_KEY_PATTERN`, 60행) 바로 위에 정상 부착돼 있음을 확인.
- **`import type` 누락 3곳 (`20_05_17` W1)**: `git show a6d764ac6`으로 직접 확인 —
  `chat-channel.dispatcher.ts`, `notification-fanout.service.ts`, `sse-adapter.service.ts`
  세 곳 모두 `import type { ExecutionChannelEvent } from '../websocket/websocket-events.types';`
  로 통일됨. 회귀 가드(`websocket-events.types.spec.ts`)의 판별 기준(`isTypeOnly`)과도
  정합.
- **`websocket.service.ts` stale "KB union" 주석 (`19_27_37` INFO #3 → `20_05_17` INFO
  #1로 재확인 → 이번 커밋에서 해소)**: `websocket.service.ts:134-136` 현재 소스 —
  "블록 JSDoc 으로 두었더니 붙을 선언이 없어 **당시 뒤따르던 선언의 문서로 읽혔다** ...
  그 선언이던 KB union 은 이후 `websocket-events.types.ts` 로 옮겨졌으니 '바로 아래' 로
  읽지 말 것" 로 파일-불변적 표현으로 정정되어 있음을 확인. 3라운드에 걸쳐 반복 지적되던
  항목이 마침내 정리됐다.
- **회귀 가드 테스트 커버리지 갭 (`20_05_17` W2)**: `websocket-events.types.spec.ts` 세
  번째 테스트가 `ts.isImportDeclaration` 만 순회해 `export … from` 재유입을 놓치던 결함이
  `valueEdgeToWebsocketService` 헬퍼로 통합되어 default/namespace/side-effect/named
  값/`export … from`/`export * from`/`import = require()` 7개 형태를 전부 검사하도록
  수정됨을 확인(`websocket-events.types.spec.ts:96-157`). 헬퍼 JSDoc 이 이 결함의 재발
  경위("같은 파일 안에서 같은 실수를 했다")까지 구체적으로 서술해 사후 진단성이 높다.
- **`plan/in-progress/ws-event-types-extract.md`**: 후속(PR 범위 밖) 섹션이
  `KbEventType` 정본 위치 stale 서술을 "한 줄만" 등재했던 것에서 심볼 기준 전수(6곳,
  표기 두 철자를 나눠 실측)로 재등재됐고, `NotificationEventType` 개명 항목·
  `4-execution-engine.md` §4.4 Rationale 후속 한 줄 등도 명시적으로 등재됨. "등재했다"고
  써놓고 실제로 등재하지 않았던 반복 패턴(이 브랜치의 기록된 실패 형태)이 이번엔 실측 근거와
  함께 정정됨.
- **README/CHANGELOG/API 문서**: 신규 공개 API·엔드포인트·환경변수·설정 옵션 없음(순수 내부
  모듈 리팩터 + 회귀 가드 테스트 추가). 이 저장소는 CHANGELOG.md 를 쓰지 않고 spec
  Rationale + plan 으로 변경 이력을 관리하는 기존 컨벤션과 일치하며 갱신 대상 아님.
- `spec/5-system/6-websocket-protocol.md` frontmatter `code:` 목록에 `websocket-events.types.ts`
  가 이미 등재돼 있고(신규 `.spec.ts` 파일은 이 저장소의 기존 convention상 `code:` 글로브에
  spec 파일을 나열하지 않으므로 등재 대상 아님 — 다른 `*.spec.ts` 도 목록에 없음을 대조 확인).

## 요약

이번 라운드에서 새로 도입된 문서화 결함은 없다. 최종 커밋(`a6d764ac6`)이 직전 세 라운드
(`19_27_37`/`20_05_17`/consistency `20_05_19`)가 누적 지적한 documentation 관점 항목
전부 — 클래스 JSDoc orphan, `NotificationEventType` JSDoc 이중 블록, WARN #10 credential
JSDoc 고아화, `import type` 누락 3곳, 그리고 3라운드째 반복되던 `websocket.service.ts` stale
"KB union" 주석까지 — 를 실제 소스 대조로 반영을 확인했다. 새로 추가된 diff(`a6d764ac6`)
자체도 회귀 가드 헬퍼(`valueEdgeToWebsocketService`)의 JSDoc이 자신의 발견 경위를 정확히
서술하고, plan 문서의 후속 항목이 "등재했다고 썼지만 실제로 안 했다"는 이 브랜치의 반복 실패를
스스로 지적하고 실측 근거와 함께 바로잡는 등 문서 위생이 이례적으로 높다. 병합을 막을 문서화
사유 없음.

## 위험도

NONE
