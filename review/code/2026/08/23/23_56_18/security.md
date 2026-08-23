# 보안(Security) 코드 리뷰

## 스코프

이번 diff(56개 파일)의 실질 프로덕션 코드 변경은 `codebase/backend/src/shared/utils/node-output-allowlist.ts`(allowlist 배열/JSDoc 정정)와 `codebase/backend/src/modules/websocket/websocket.service.ts`(변경 없음 — 이전 라운드에서 이미 배선 완료)에 국한된다. 나머지는 CHANGELOG·plan·spec 문서 정정, 그리고 앞선 두 코드 리뷰 라운드(`22_51_46`, `23_16_40`)와 consistency-check 라운드(`22_26_33`, `23_29_27`)의 산출물이다. 이번 라운드(`23_56_18`)가 검토하는 실질 변경은 직전 consistency-check(`23_29_27`)가 낸 **CRITICAL 1건**("REST 와 SSE 는 같은 강도" 라는 spec 서술이 구현보다 넓었다)에 대한 **fe4d58de7** 커밋의 해소 내역 — spec/plan/CHANGELOG 정정 + 신규 캐너리 테스트다. 직접 소스(`Read`/`grep`)로 실측을 재확인했다.

## 발견사항

- **[WARNING]** `execution.node.completed`/`.failed` fanout 의 `envelope.output` 은 여전히 fail-open — 엔진 내부 전용 필드(`_retryState`)가 외부(SSE/webhook/chat-channel)로 샌다. 이번 PR 이 새로 만든 결함은 아니지만, 이번 PR 의 스코프에서 **의식적으로 닫지 않기로 확정**된 현존 정보노출 표면이라 보안 리뷰 관점에서 별도로 기재한다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` 함수 `allowlistFanoutNodeOutput`(182~205행) — `envelope.nodeOutput`/`envelope.buttonConfig.nodeOutput` 두 자리만 좁히고 `envelope.output` 은 검사하지 않는다. `emitNodeEvent`(373~401행, 특히 391~394행)가 그 envelope 을 그대로 `toFanoutEnvelope`(468~476행)로 넘긴다. emit 측 실제 페이로드는 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:6112-6120`(`NODE_COMPLETED`, `output: nodeExecution.outputData`)와 `:6372-6381`(`NODE_FAILED`)에서 직접 확인했다 — `nodeExecution.outputData` 는 `NodeHandlerOutput` shape 이라 `_retryState` 를 담을 수 있다(같은 파일 5398행 부근 주석, `retry-turn.service.ts` 가 그 필드를 영속화).
  - 상세: `NODE_OUTPUT_ALLOWED_KEYS` 는 `nodeOutput`/`buttonConfig.nodeOutput` 두 자리에만 적용되고 `output` 키에는 걸리지 않는다. 즉 waiting-for-input 표면(REST `getStatus`·SSE `nodeOutput`)은 이번 작업으로 fail-closed 가 됐지만, node 완료/실패 이벤트의 `envelope.output` 은 여전히 자매 deny-list(`stripExternalOnlyFields`, `llmCalls` 한 필드만 앎)에만 의존하는 fail-open 상태다 — 이는 이 allowlist 유틸이 애초에 막으려던 것과 정확히 같은 종류의 정보노출(엔진 내부 재시도 카운터 유출)이 다른 emit 경로로 남아 있다는 뜻이다. 다행히 이 팀은 이를 인지하고 있다 — `codebase/backend/src/modules/websocket/websocket.service.spec.ts:906-956`(`[잔여] execution.node.* 의 envelope.output 은 아직 allowlist 를 지나지 않는다`)가 `_retryState` 가 현재 **노출됨**을 명시적으로 단언하는 캐너리이고, `spec/5-system/14-external-interaction-api.md:1751`(범위 표 "deny-list 유지 (잔여)")와 1768~1771행(정정 블록)이 같은 사실을 spec SoT 에 정확히 반영했다. 직전 라운드(`23_29_27`)의 checker 가 제안한 "그대로 `allowlistNodeOutputKeys` 를 `envelope.output` 에도 걸어라"는 처방을 실측(정본 구현에 넣어 실행)으로 반증했다는 기록도 확인했다 — 버튼 재개 record(`button-interaction.service.ts:180` 저장 shape)에 그 13키 목록을 걸면 결과가 `{}` 가 되어 carousel/buttons 프레젠테이션의 chat-channel 외부 발송이 통째로 비게 된다. 즉 이 잔여는 "안 고친 결함"이 아니라 "섣부른 fail-broken 을 피하기 위해 의식적으로 좁혀 놓은 스코프"이며, 트래커 신규 항목 + 캐너리로 재발/망각을 막는 구조가 이미 갖춰져 있다.
  - 제안: 코드 변경은 불요(이미 올바른 스코프 판단 + 캐너리 고정). 후속 작업이 이 표면을 닫으려면, `outputData` 가 취할 수 있는 shape 을 전수 열거하고(`NodeHandlerOutput` vs 버튼 재개 record 등) shape 판별이 선행되어야 한다는 것이 트래커에 이미 재개 조건으로 적혀 있다 — 그 조건 없이 성급히 동일 allowlist 를 얹지 말 것.

- **[INFO]** allowlist 확장(`payload`/`title`/`rendered`/`nodeType`)은 이름 기반이라, 향후 어떤 핸들러가 우연히 같은 이름의 **내부 전용** 필드를 도입하면 그대로 통과한다.
  - 위치: `codebase/backend/src/shared/utils/node-output-allowlist.ts` 78~88행(`NODE_OUTPUT_ALLOWED_KEYS` wire 전용(chat-channel) 4키)
  - 상세: `config`/`output`/`meta`/`port`/`status` 는 `assertAllowlistCoversHandlerContract`(같은 파일, `NodeHandlerOutput` 타입 결속)로 지켜지지만, 이 4키(+ 위젯 4키)는 리터럴 테스트(`node-output-allowlist.spec.ts` "[리터럴] wire 전용 키가 목록에서 사라지면 여기서 잡힌다")만이 유일한 방어다. 앞선 두 라운드가 이미 지적·수용한 구조적 트레이드오프이며 이번 라운드가 새로 만든 문제는 아니다.
  - 제안: 조치 불요(이미 문서화·테스트됨). 신규 top-level 필드를 `nodeOutput` 에 얹는 코드를 리뷰할 때 "이름이 우연히 allowlist 13키와 겹치지 않는지" 체크리스트 항목으로 남겨 둘 가치는 있다.

- **[INFO]** SSE/webhook fanout `nodeOutput` narrowing 은 이미 운영 중인 외부 응답 바디를 소급 축소하는 하위 호환성 변경이다 — 제3자 webhook 구독자 실 트래픽 감사는 세션 범위 밖으로 남아 있다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:182-205,468-476`, `CHANGELOG.md`(정정 블록, "외부 수신자에게는 동작 변경이다")
  - 상세: 정보노출 방어를 강화하는 대가로 알려지지 않은 외부 소비자에게는 관측 가능한 행위 변경이 될 수 있다. 알려진 두 소비처(위젯·chat-channel)는 실측으로 무손실이 확인됐고, 나머지는 CHANGELOG·spec 이 정직하게 "확인 범위 밖"으로 명시했다 — 보안 목적상 정당한 트레이드오프이며 코드 결함은 아니다(API 계약 관점은 `api_contract`/`side_effect` 리뷰가 이미 상세히 다룸).
  - 제안: 조치 불요(정보성 기록). 향후 EIA 에 breaking-change 공지 절차가 생기면 활용.

## 긍정적으로 확인된 방어 요소 (참고)

- **fail-closed 설계**: `allowlistNodeOutputKeys`(`node-output-allowlist.ts` 120행 부근)는 목록에 없는 키를 전부 제거 — 목록이 좁아져도 안전한 방향(렌더 파손)으로만 실패한다.
- **프로토타입 오염 방어**: `delete out[k]`(대입이 아니라 삭제)를 선택했고 `__proto__` 키 오염 방지가 캐너리(`node-output-allowlist.spec.ts:116-121`)로 고정돼 있음을 직접 확인.
- **런타임 불변**: `Object.freeze(NODE_OUTPUT_ALLOWED_KEYS)` — `as const` 만으로는 못 막는 변조를 차단.
- **컴파일타임 결속**: `NodeHandlerOutput` 의 공개 5키(`_resumeState`/`_retryState` 제외)가 allowlist 에 있는지 타입 레벨에서 강제 — 새 공개 필드 추가 시 빌드 실패.
- **`_resumeState` 는 애초에 DB 비영속**(`execution-engine.service.ts:1320,1505` 확인) — `envelope.output` 잔여 갭으로 노출될 수 있는 실질 위험은 `_retryState` 하나로 좁혀진다.
- **단일 chokepoint**: `toFanoutEnvelope` 가 `emitExecutionEvent`/`emitNodeEvent` 두 곳에서만 호출되고, `nodeOutput`/`buttonConfig.nodeOutput` 두 자리 모두 여기서 걸린다 — grep 으로 우회 경로 없음을 재확인.
- **정직한 스코프 축소**: `23_29_27` CRITICAL(구현보다 넓은 spec 보장)에 대해, 잘못된 즉석 처방(shape 이 다른 표면에 같은 allowlist 적용)을 실측으로 반증하고 채택하지 않은 뒤, 보장 문구를 좁히고 잔여를 캐너리+트래커로 고정한 방식은 "fail-open 을 fail-broken 으로 바꾸지 않는다"는 보안 원칙에 부합한다.
- 하드코딩 시크릿·SQL/커맨드 인젝션·인증 우회·안전하지 않은 암호화 관련 패턴은 발견되지 않음(이 변경분은 순수 필드 필터링 로직).

## 요약

이번 라운드는 직전 consistency-check(`23_29_27`)가 낸 CRITICAL("REST 와 SSE 는 같은 강도"라는 spec 서술이 구현보다 넓었다)의 해소 커밋을 검토한다. 처방은 코드가 아니라 **보장의 정확한 축소**였다 — `execution.node.completed`/`.failed` 의 `envelope.output` 표면에 섣불리 같은 13키 allowlist 를 걸면 shape 이 다른 버튼 재개 record 가 `{}` 로 비어 chat-channel 발송이 깨진다는 것을 정본 구현으로 실측한 뒤, 그 표면을 명시적 잔여로 남기고 spec·CHANGELOG·트래커·캐너리 테스트 네 곳에 일관되게 기록했다. 코드 자체(`node-output-allowlist.ts`, `websocket.service.ts`)는 이전 두 라운드에서 이미 검증된 상태에서 변경이 없고, fail-closed 설계·프로토타입 오염 방어·컴파일타임 결속·단일 chokepoint 등 방어 요소가 견고하게 유지된다. 유일하게 실질적인 잔여 리스크는 `envelope.output`(node 완료/실패 이벤트)을 통한 `_retryState` 노출인데, 이는 이번 PR 이 만든 결함이 아니라 원래부터 있던 갭이며, 이번 PR 이 그 존재를 처음으로 정확히 문서화·캐너리로 고정했다(닫지 않은 것은 무리한 fail-broken 을 피하기 위한 의도적 결정). CRITICAL 급 신규 보안 결함은 발견되지 않았다.

## 위험도

LOW
