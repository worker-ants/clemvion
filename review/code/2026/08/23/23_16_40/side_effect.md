# 부작용(Side Effect) Review

## 발견사항

- **[WARNING]** SSE/webhook fanout `nodeOutput` narrowing 은 이미 운영 중인 외부 수신자에게 소급 적용되는 하위 호환성 변경이다 — 알려진 두 소비처(위젯·chat-channel) 밖의 제3자 webhook 구독자는 검증 범위 밖이다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` 함수 `allowlistFanoutNodeOutput`(187~202행) 및 `toFanoutEnvelope`(468~476행, 특히 472~474행의 배선), `codebase/backend/src/shared/utils/node-output-allowlist.ts` `NODE_OUTPUT_ALLOWED_KEYS`(66~92행)
  - 상세: `toFanoutEnvelope` 가 `emitExecutionEvent`/`emitNodeEvent` 의 유일한 외부 출구라 이 chokepoint 를 지나는 SSE·webhook(`NotificationFanout`)·chat-channel 세 구독자 전원의 `nodeOutput`/`buttonConfig.nodeOutput` 응답 바디가 이 배포 시점부터 fail-open deny-list 에서 fail-closed 13키 allowlist 로 즉시 좁아진다. 알려진 두 소비처(위젯·chat-channel)는 실측으로 무손실이 확인됐지만, `CHANGELOG.md`(파일 1) 자신도 "제3자 webhook 구독자가 다른 키를 참조 중이었다면 그 키는 더 이상 도달하지 않는다"고 명시하는 것처럼, 이 narrowing 은 코드 레벨 side effect 로서 관측 가능한 외부 행위 변경이다. 버전 분리·Deprecation 공지·트래픽 감사 없이 서버 사이드에서 전체 트래픽에 즉시 적용된다 — 이는 이미 api_contract/security 리뷰가 별도 관점에서 지적·수용한 항목이며 이번 라운드에서 코드가 변경되지 않았으므로 신규 결함은 아니지만, side effect 관점에서도 "이벤트 payload 변경이 이 함수 호출자가 전혀 모르는 외부 구독자에게 전파된다"는 성격이라 함께 기록한다.
  - 제안: 현재 조치(CHANGELOG 정정 + 실측 기반 무손실 확인)로 코드 변경을 막을 사유는 아니다. 후속으로 배포 전/후 webhook payload 로그의 `nodeOutput` 키 분포 표본 감사가 가능해지면 수행할 것(RESOLUTION.md W4 가 이미 "이 세션에서 수행 불가"로 명시).

- **[INFO]** `NODE_OUTPUT_ALLOWED_KEYS` 가 REST `getStatus`(`interaction.service.ts`)와 WS `toFanoutEnvelope`(`websocket.service.ts`) 두 소비처의 공유 상수가 되면서, 한쪽 표면(chat-channel/SSE)을 위해 넓힌 4키가 다른 표면(REST)의 공개 응답에도 자동으로 통과한다.
  - 위치: `codebase/backend/src/shared/utils/node-output-allowlist.ts` 78~89행(`'payload'`·`'title'`·`'rendered'`·`'nodeType'` 추가), `codebase/backend/src/modules/websocket/websocket.service.ts` 9행(신규 import)
  - 상세: 설계 문서(`node-output-allowlist.ts` 8~12행, `plan/in-progress/sse-nodeoutput-allowlist.md` "설계" 절)가 "표면별로 목록을 가르지 않는다"를 의식적으로 선택했고, `interaction.service.spec.ts`(파일 2, 719~763행)에 REST 쪽에서도 이 4키가 통과함을 고정하는 캐너리가 추가돼 이 결합이 우연이 아니라 의도임을 테스트가 명시한다. 다만 구조적으로는 여전히 "한 표면을 위한 배열 추가가 다른 표면의 노출 표면도 함께 바꾼다"는 결합이 남아 있다 — 다음에 세 번째 소비처가 생기거나 한쪽 표면 전용으로만 필요한 키가 추가될 때 같은 형태(의도치 않은 표면 확장)가 재발할 수 있는 지점이다. RESOLUTION.md(W1)가 이미 인지하고 캐너리로 고정했으므로 즉시 조치 대상은 아니다.
  - 제안: 조치 불요(이미 캐너리로 고정됨). 향후 소비처가 셋이 되거나 표면별 정책이 갈릴 경우 이 결합 지점을 재검토할 것 — plan(`sse-nodeoutput-allowlist.md` "재배치 defer 사유")이 이미 재개 신호를 "shared 아래가 아닌 소비처가 생겼다"로 못박아 뒀다.

## 확인했으나 문제 없음 (근거 기록)

- **의도치 않은 상태 변경 없음**: `allowlistFanoutNodeOutput`(websocket.service.ts 182~205행)은 입력 `envelope`/`bc`/`top`/`inner` 를 전혀 변이하지 않는다 — narrowing 이 필요할 때만 `allowlistNodeOutputKeys` 가 `{ ...obj }` 로 복사한 뒤 그 복사본에서 `delete` 하고(`node-output-allowlist.ts` 121~137행), 바뀐 게 없으면 원본 참조(`next = envelope`)를 그대로 반환한다(copy-on-change). `NODE_OUTPUT_ALLOWED_KEYS` 자체도 `Object.freeze` 로 런타임 불변이 유지된다(변경 없음, 92행).
- **전역 변수 없음**: 새 모듈 스코프 함수 `allowlistFanoutNodeOutput` 하나만 추가됐고 전역/모듈 레벨 mutable 상태는 도입되지 않았다.
- **파일시스템 부작용 없음**: 프로덕션 코드(`websocket.service.ts`, `node-output-allowlist.ts`)는 순수 함수·주석 갱신뿐, 신규 파일 I/O 없음. `plan/**`·`review/**` 신규 파일은 이 저장소 워크플로가 항상 만드는 표준 산출물이다.
- **시그니처 변경 없음**: `private toFanoutEnvelope(executionId, maskedWireEnvelope)` 의 파라미터·반환 타입은 그대로다(468~476행) — 내부 구현만 `allowlistFanoutNodeOutput` 로 감쌌다. `emitExecutionEvent`/`emitNodeEvent` 등 공개 메서드 시그니처도 변경 없음.
- **내부 WS 채널 비영향**: `broadcastToChannel` 호출(319행·391행)이 `toFanoutEnvelope` 호출보다 먼저 끝나므로, allowlist 는 그 이후 만드는 새 clone 에만 적용된다 — 신규 캐너리(`websocket.service.spec.ts` 762~796행, 803~835행)가 wire envelope 은 `_retryState`/`someUnknownInternalField` 를 그대로 유지함을 명시적으로 단언한다.
- **환경 변수 읽기/쓰기 없음**: 이번 diff 어디에도 `process.env` 접근이 없다.
- **네트워크 호출 없음**: 순수 in-memory 동기 변환(객체 필터링)만 수행 — 외부 서비스 호출 도입 없음.
- **이벤트/콜백 변경 없음**: `emitExecutionEvent`/`emitNodeEvent` 가 발행하는 이벤트 종류·타이밍·구독 관계(`executionEvents$` → SSE/webhook/chat-channel)는 변경되지 않았다. 오직 그 이벤트가 나르는 `nodeOutput`/`buttonConfig.nodeOutput` **payload 의 키 집합**만 좁아진다(위 WARNING 참고).
- **재조립 최소화 검증**: `buttonConfig` 분기의 copy-on-change 도 신규 캐너리(`websocket.service.spec.ts` 848~872행)가 `fanout.payload`·`fanout.payload.buttonConfig` 양쪽의 참조 동일성을 단언해, top-level 분기만이 아니라 두 분기 모두에서 불필요한 재구성이 없음을 확인한다(뮤테이션 M5 로 검증됨, `plan/in-progress/sse-nodeoutput-allowlist.md` 검증 기준 표).

## 요약

핵심 프로덕션 변경(`node-output-allowlist.ts` 의 allowlist 4키 확장, `websocket.service.ts` 의 `allowlistFanoutNodeOutput` 신설과 `toFanoutEnvelope` 배선)은 순수 함수·copy-on-change·단일 chokepoint 로 구현돼 있어 예상 외의 상태 변경, 전역 변수 도입, 파일시스템/환경변수/네트워크 부작용, 함수 시그니처·이벤트 구독 관계 변경이 없다. 내부 WS(에디터) 채널이 이 필터링의 영향을 받지 않는다는 안전 조건도 캐너리 테스트로 명시적으로 고정돼 있다. 남는 부작용은 두 가지이며 둘 다 이미 이전 라운드(`22_51_46`)에서 식별돼 문서·캐너리로 완화된 것이다: (1) 이미 운영 중인 SSE/webhook 응답 바디를 소급 축소하는 하위 호환성 변경으로, 검증 범위 밖 제3자 구독자에게는 관측 가능한 동작 변경이다(WARNING, CHANGELOG 로 이미 기록·수용됨) — 코드를 막을 사유는 아니나 재확인 가치가 있어 다시 기재한다. (2) `NODE_OUTPUT_ALLOWED_KEYS` 가 REST/WS 두 표면의 공유 상수가 되어 한 표면을 위한 확장이 다른 표면의 노출 표면도 함께 넓히는 구조적 결합이 남아 있다(INFO, 캐너리로 의도가 고정됨). 두 항목 모두 즉시 차단 사유는 아니다.

## 위험도
LOW
