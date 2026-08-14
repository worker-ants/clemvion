STATUS=success side_effect review complete — 0 CRITICAL, 0 WARNING, 4 INFO
===REPORT_MARKDOWN_BELOW===
### 발견사항

- **[INFO]** `execution.failed` 의 `error` wire 형태(string → `{code, message, nodeId, details?}` object)가 이 저장소의 모든 종결 이벤트 외부 소비자(webhook, SSE, chat-channel adapter)에 영향을 주는 실질적 인터페이스(공개 API) 변경이지만, 적절히 문서화·완화돼 있음을 확인했다.
  - 위치: `CHANGELOG.md:9-11` (breaking change 고지), `codebase/backend/src/shared/utils/terminal-error-payload.ts:1-41` (신규 SoT 헬퍼)
  - 상세: 프로젝트가 URL 버전 세그먼트를 쓰지 않는 단일 버전 운영이라(spec `2-api-convention.md`) 기계적 버전 신호가 없다. 직접 grep 으로 `ExecutionEventType.EXECUTION_FAILED` emit 지점 4곳(`execution-engine.service.ts:659,3311,4869`, `retry-turn.service.ts:961`) 전부가 `toTerminalErrorPayload` 를 거치도록 통일된 것을 확인했고, `codebase/channel-web-chat/src/widget/use-widget.ts:71` 등 외부 위젯 SDK 는 `execution.failed` 를 이벤트명으로만 소비하고 `error` 필드 shape 를 직접 파싱하지 않아(grep 으로 `.error.message` 등 참조 0건 확인) 영향이 없음을 확인했다. 내부 에디터 WS 소비자(`use-execution-events.ts`)는 같은 diff 안에서 캐스팅 대신 타입 내로잉으로 갱신됐다. 이미 다수 라운드에 걸쳐 반복 검토·문서화된 항목이라 재차단 사유는 아니다.
  - 제안: 조치 불요(이미 CHANGELOG 로 완화). 재확인만 목적.

- **[INFO]** `chat-channel.dispatcher.ts` 의 string-wrap 경로에서 지어내던 `code: 'INTERNAL_ERROR'` 가 `code: null` 로 바뀌면서, 구조화 warn 로그(`chat_channel_unknown_failure_code`) 의 `code` 필드 값이 `'INTERNAL_ERROR'` → `''` 로 조용히 바뀐다 — 외부 로그 기반 모니터링/대시보드가 그 리터럴 문자열을 매칭하고 있었다면 알아채지 못하게 깨질 수 있는 관측 가능한 부작용이다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:552-558` (assignment), `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts:105`(`const code = event.error?.code ?? '';`)·`:138`(`kind: 'chat_channel_unknown_failure_code'` 로그)
  - 상세: 직접 `execution-failure-classifier.ts` 를 읽어 확인 — `'INTERNAL_ERROR'` 와 `null`(`?? ''`) 모두 `TIMEOUT_CODES`/`THIRD_PARTY_CODES`/`INTERNAL_CODES` 세 Set 어디에도 없어 **분류 결과(`executionFailedInternal`)는 동일**하다. 저장소 전체 grep 으로 소스 코드(테스트 제외) 어디도 `error.code === 'INTERNAL_ERROR'` 형태로 비교하는 곳이 없음을 확인해 기능적 회귀는 없다. 바뀌는 것은 warn 로그의 `code` 필드 리터럴뿐이며, 이 변경은 `CHANGELOG.md` 에 명시적으로 고지돼 있다("`'INTERNAL_ERROR'` → `null`… unknown warn 로그가 유령 코드를 보고하지 않게 된다").
  - 제안: 조치 불요. 외부 대시보드/알림 룰이 이 로그의 `code` 값을 문자열 매칭하는 경우가 있다면 배포 노트에 재차 언급할 것(코드 조치 아님).

- **[INFO]** `EiaCompletedEvent.result` 에서 제거된 `finalNodeId`/`finalPort` 필드가 저장소 전역에서 실제로 dead 였음을 직접 grep 으로 재확인했다 — 인터페이스 축소가 은닉된 소비자를 깨뜨리지 않는다.
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts:387-391`
  - 상세: `grep -rn "finalNodeId\|finalPort" codebase/` 결과 살아있는 참조는 0건이고, 유일하게 남은 건 gitignored 빌드 산출물 `codebase/backend/dist/modules/chat-channel/types.d.ts`(`.gitignore` 로 추적 제외 확인)뿐이라 재빌드 시 자동 갱신되며 실질 영향 없다.
  - 제안: 조치 불요.

- **[INFO]** (긍정 확인) 새 헬퍼 `toTerminalErrorPayload` 와 그 재사용 지점들이 "의도치 않은 상태 변경" 클래스의 부작용을 스스로 방어하고 있다.
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.spec.ts:113-118`(`'입력을 변형하지 않는다'` 테스트), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3268-3316`(`finalizeStalledExhausted` — `stalledError` 객체를 DB write 2곳(부모 `error`, 자식 `error.code`)과 emit 에서 공유)
  - 상세: 직접 코드를 읽어 확인 — `stalledError` 는 부모 Execution 의 `.set({error: stalledError})` 에 그대로 쓰이고, 자식 NodeExecution 은 `code: stalledError.code`(문자열만 추출, 참조 공유 아님)를, emit 은 `toTerminalErrorPayload(stalledError)`(자체 테스트로 입력 비변형이 고정된 순수 함수)를 쓴다. 세 지점이 같은 원본 객체를 공유하지만 어느 쪽도 그 객체를 뮤테이트하지 않아 aliasing 부작용이 없다. `failFirstSegmentSetup`/`finalizeFailedExecution` 도 마찬가지로 로컬 엔티티 필드에만 대입 후 같은 값을 읽어 emit — 예상 밖의 전역/공유 상태 변경 없음.
  - 제안: 조치 불요. 이 패턴(단일 원본 객체를 DB·emit 이 공유)을 향후 다른 종결 이벤트에도 재사용할 수 있음을 참고.

### 요약
이번 diff 의 핵심 side-effect 표면은 `execution.failed` 의 `error` wire 형태를 string→object 로 바꾸는 실질적 인터페이스 변경 하나이며, 4개 emit 지점 전수(grep 으로 재확인) 통일·내부 WS 소비자 갱신·외부 위젯 SDK 무영향(직접 확인)·CHANGELOG breaking-change 고지까지 이미 완비돼 있어 추가 조치가 필요한 잔여 결함을 찾지 못했다. 전역 변수 도입, 파일시스템 부작용, 환경 변수 읽기/쓰기, 의도치 않은 네트워크 호출은 발견되지 않았다. `chat-channel.dispatcher.ts` 의 구조화 로그 `code` 값 변화(`'INTERNAL_ERROR'`→`''`)는 분류 결과에는 영향이 없고 CHANGELOG 에 고지된 관측 가능한 부수 변화로, 저장소 내부 소비자가 없음을 직접 grep 으로 확인했다. `finalizeStalledExhausted` 의 객체 공유 패턴과 `toTerminalErrorPayload` 자체 non-mutation 테스트는 이 부작용 클래스에 대해 오히려 방어적으로 설계돼 있다. `EiaCompletedEvent` 유령 필드 제거도 실측상 dead code 제거로 안전하다.

### 위험도
LOW
