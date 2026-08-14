STATUS=success side_effect review complete — 0 CRITICAL, 0 WARNING, 4 INFO
===REPORT_MARKDOWN_BELOW===
### 발견사항

- **[INFO]** `execution.failed` 의 `error` wire 형태(string → `{code, message, nodeId, details?}` object)는 이 브랜치가 도입하는 실질적 인터페이스(공개 API) breaking change다 — 전수 확인 결과 적절히 완화·문서화돼 있다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`(`EXECUTION_FAILED` emit 3곳: `toTerminalErrorPayload(row.error)`·`toTerminalErrorPayload(stalledError)`·`toTerminalErrorPayload(savedExecution.error)`), `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`(1곳), `codebase/backend/src/modules/chat-channel/types.ts`(`EiaFailedEvent.error.code: string` → `string | null`), `CHANGELOG.md`
  - 상세: `grep -rln "EiaFailedEvent"`·`grep -rn "\.error\?\.code\|\.error\.code"` 로 전수 대조한 결과, `execution-failure-classifier.ts:105`(`event.error?.code ?? ''`), `telegram-message.renderer.ts:63`(`event.error?.code?.startsWith(...)`)는 이미 optional-chaining 관용구라 `code: string|null` 로의 변경에 안전하고, `notification-fanout.service.ts:55`(`payload: event.payload`)는 가공 없이 webhook 큐로 그대로 전달하므로 실제 외부 webhook/SSE 수신자가 이 shape 변화를 받는다. `CHANGELOG.md` 에 breaking change 가 명시돼 있고(이 저장소는 URL 버전 세그먼트를 쓰지 않아 문서가 유일한 통지 경로), 내부 유일 소비자인 프런트엔드(`use-execution-events.ts`)는 같은 diff 안에서 캐스팅 대신 타입 내로잉으로 동반 갱신됐다. 새로운 결함은 아니며(이미 3라운드에 걸쳐 api_contract·side_effect 리뷰가 반복 확인) 재확인 목적으로만 기재한다.
  - 제안: 조치 불요.

- **[INFO]** `chat-channel.dispatcher.ts` 의 string-wrap 경로에서 지어내던 `code: 'INTERNAL_ERROR'` 가 `code: null` 로 바뀌면서, 구조화 warn 로그(`chat_channel_unknown_failure_code`) 의 `code` 필드 값이 `'INTERNAL_ERROR'` → `''`(`execution-failure-classifier.ts:105` `?? ''`)로 조용히 바뀐다 — 저장소 내부 소비자는 없지만 외부 로그 매칭 대시보드가 있다면 관측 가능한 변화다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts`(`case 'execution.failed':` 블록 — `toTerminalErrorPayload(errorRaw) ?? {code: null, ...}` 대입부), `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts:105`(`const code = event.error?.code ?? '';`)
  - 상세: `execution-failure-classifier.ts` 를 직접 읽어 확인 — `'INTERNAL_ERROR'` 와 `null`(`?? ''`) 모두 `TIMEOUT_CODES`/`THIRD_PARTY_CODES`/`INTERNAL_CODES` 세 Set 어디에도 없어 분류 결과(`executionFailedInternal`)는 동일하다. 저장소 전체(테스트 제외) `error.code === 'INTERNAL_ERROR'` 리터럴 비교 0건. 기능 회귀는 없고, `CHANGELOG.md` 에 이 전환이 명시돼 있다.
  - 제안: 조치 불요.

- **[INFO]** `EiaCompletedEvent.result` 에서 제거된 `finalNodeId`/`finalPort` 필드가 저장소 전역에서 실제로 dead 였음을 재확인했다 — 인터페이스 축소가 숨은 소비자를 깨뜨리지 않는다.
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts`(`EiaCompletedEvent.result` 타입 정의)
  - 상세: `grep -rn "finalNodeId\|finalPort" --include="*.ts" --include="*.tsx" .`(node_modules/dist 제외) 결과 살아있는 참조는 이 diff 자신의 주석 1건뿐이고 코드 참조는 0건이다.
  - 제안: 조치 불요.

- **[INFO]** (긍정 확인) 신규 헬퍼 `toTerminalErrorPayload` 와 그 재사용 지점(`finalizeStalledExhausted` 의 `stalledError` 공유)이 "의도치 않은 상태 변경" 클래스를 스스로 방어한다.
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts:48-82`(순수 함수 — 스프레드 없이 새 리터럴만 반환), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3268-3316`(`finalizeStalledExhausted` — `stalledError` 를 부모 DB write·자식 `error.code`(값만 추출)·`toTerminalErrorPayload(stalledError)` emit 세 곳이 공유)
  - 상세: 직접 코드를 읽어 확인 — 세 지점 모두 `stalledError` 를 읽기만 하고 뮤테이트하지 않으며, `toTerminalErrorPayload` 는 새 객체를 반환하는 순수 함수(`terminal-error-payload.spec.ts` 의 `'입력을 변형하지 않는다'` 테스트로 고정)다. TypeORM `.set({...})` 도 전달받은 리터럴을 그대로 저장할 뿐 원본을 변형하지 않는다. aliasing 부작용 없음.
  - 제안: 조치 불요.

### 요약

이 changeset(base `origin/main` → HEAD, 실행 코드 파일 11개: `terminal-error-payload.ts` 신규 헬퍼+테스트, `execution-engine.service.ts`/`retry-turn.service.ts` 의 `EXECUTION_FAILED` emit 4곳 통일, `chat-channel.dispatcher.ts`/`types.ts` 의 back-compat wrap·유령 필드 정리, `use-execution-events.ts` 프런트엔드 동반 수정)의 핵심 side-effect 표면은 `execution.failed` 의 `error` wire 형태를 string→object 로 바꾸는 하나의 실질적 인터페이스 변경이다. 이미 3라운드(`22_55_51`→`23_17_57`→`23_34_12`)에 걸쳐 side_effect·api_contract 리뷰가 이 표면을 반복 검증했고, 이번 라운드에서 독립적으로 emit 지점 전수(grep)·`EiaFailedEvent`/`code` 소비자 전수(`execution-failure-classifier.ts`, telegram renderer, `notification-fanout.service.ts`)·`finalNodeId`/`finalPort` dead-code 재확인·`toTerminalErrorPayload`/`stalledError` 의 non-mutation 을 직접 코드로 재검증했으며 모두 기존 판정과 일치했다. 전역 변수 도입, 파일시스템 부작용, 환경 변수 읽기/쓰기, 의도치 않은 네트워크 호출, 시그니처 파괴(함수 인자 개수/순서 변경으로 인한 컴파일 실패)는 이 diff 범위(`git diff origin/main..HEAD --stat -- codebase/` 로 재확인한 11개 파일)에서 발견되지 않았다. `execution-engine → chat-channel` import 순환을 피하려 헬퍼를 `shared/utils/` 로 승격한 것도 producer/consumer 양쪽에 대칭적으로 적용돼 있어 모듈 경계 부작용이 없다. 남는 관찰은 전부 이미 문서화·완화된 breaking-change 계열 INFO 다.

### 위험도
LOW
