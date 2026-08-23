# 보안(Security) 코드 리뷰

## 스코프

이번 diff(72개 파일) 중 실질 프로덕션 코드 변경은 6개 TS 파일뿐이다(`git diff origin/main...HEAD -- codebase/` 로 직접 확인):

- `codebase/backend/src/shared/utils/node-output-allowlist.ts` (+35/-… — JSDoc 정정 + 그룹 표 갱신, `NODE_OUTPUT_ALLOWED_KEYS` 자체는 이미 13키로 안정)
- `codebase/backend/src/modules/websocket/websocket.service.ts` (+70 — `allowlistFanoutNodeOutput` 신설 + `toFanoutEnvelope` 배선 + JSDoc)
- `codebase/backend/src/modules/external-interaction/interaction.service.ts` (+4/-2 — JSDoc 정정만, 로직 변경 없음)
- `codebase/backend/src/shared/utils/node-output-allowlist.spec.ts`, `.../interaction.service.spec.ts`, `.../websocket.service.spec.ts` (테스트/캐너리 추가)

나머지 66개 파일은 `CHANGELOG.md`, plan(`plan/in-progress/**`, `plan/complete/**`), spec(`spec/5-system/14-external-interaction-api.md`, `6-websocket-protocol.md`), 그리고 앞선 세 코드 리뷰 라운드(`22_51_46`/`23_16_40`/`23_56_18`)와 두 consistency-check 라운드(`22_26_33`/`23_29_27`)의 산출물이다. 소스(`Read`/`grep`)로 실측을 재확인했다.

## 발견사항

- **[INFO]** `execution.node.completed`/`.failed` fanout 의 `envelope.output` 은 여전히 fail-open — 엔진 내부 필드(`_retryState`)가 외부(SSE/webhook/chat-channel)로 새는 경로가 남아 있다. 이번 diff 가 새로 만든 결함이 아니라, 이번 diff 스코프에서 **의식적으로 닫지 않기로 재확정**된 기존 잔여 노출이다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` 함수 `allowlistFanoutNodeOutput` (182~205행) — `envelope.nodeOutput`·`envelope.buttonConfig.nodeOutput` 두 자리만 좁히고 `envelope.output` 은 검사 대상이 아니다. `toFanoutEnvelope` JSDoc 464~469행이 이 스코프 제한을 명시한다. 캐너리는 `codebase/backend/src/modules/websocket/websocket.service.spec.ts:931` (`it('[잔여] execution.node.* 의 envelope.output 은 아직 allowlist 를 지나지 않는다', …)`)가 `_retryState` 가 **현재 노출됨**을 명시적으로 단언해 고정한다.
  - 상세: 직접 확인한 근거로 이 잔여가 "안 고친 결함"이 아니라 정당화된 스코프 제한임을 재확인했다 — 버튼 재개 record 는 `NodeHandlerOutput` shape 이 아니라 이종 payload 라 같은 13키 allowlist 를 걸면 결과가 `{}` 가 되어(실측, JSDoc 466~468행에 기록) chat-channel 발송 자체가 깨진다. spec SoT(`spec/5-system/14-external-interaction-api.md` §R17 범위 표), plan 트래커, 캐너리 테스트 세 곳이 일관되게 이 사실을 기록하고 있어 "잊혀진 갭"이 아니다.
  - 제안: 코드 변경 불요. 이 표면을 닫으려면 `outputData` 가 취할 수 있는 shape 전수 판별(버튼 재개 record vs `NodeHandlerOutput`)이 선행돼야 한다는 조건이 트래커에 이미 재개 조건으로 적혀 있다 — 그 조건 없이 같은 allowlist 를 얹지 말 것.

- **[INFO]** `NODE_OUTPUT_ALLOWED_KEYS` 가 REST `getStatus` 와 WS `toFanoutEnvelope` 두 표면에 공유되면서, chat-channel 전용으로 넓힌 4키(`payload`·`title`·`rendered`·`nodeType`) 가 REST 응답에도 그대로 통과한다 — 이름이 특히 범용적(`payload`/`title`)이라 향후 무관한 핸들러의 동명 내부 필드가 우연히 통과할 이론적 여지가 있다.
  - 위치: `codebase/backend/src/shared/utils/node-output-allowlist.ts:78-89`(4키 추가분) — 소비처는 `interaction.service.ts:394` 부근(`allowlistNodeOutputKeys(...)` 호출)과 `websocket.service.ts:189,197`.
  - 상세: 이 확장은 앞선 라운드(`22_51_46` side_effect W1)에서 이미 지적됐고, 이번 diff 의 `interaction.service.spec.ts` 신규 캐너리(`[캐너리] chat-channel wire 4키는 REST getStatus 에서도 통과한다`)가 "이 넷을 REST 로 읽는 현재 소비처는 없다"는 실측과, 같은 응답에서 `_retryState` 는 여전히 떨어진다는 것을 함께 고정해 W1 을 해소했다(RESOLUTION.md 확인). 목록이 `config`/`output`/`meta`/`port`/`status` 처럼 컴파일타임 결속이 있는 것은 아니고, 4키(+위젯 4키)는 리터럴 테스트만이 유일한 방어라는 구조적 한계는 남는다 — 다만 이는 fail-closed 방향이므로 실패 모드는 "정보 노출"이 아니라 "렌더 파손"이다.
  - 제안: 조치 불요(이미 문서화·테스트로 방어). 신규 top-level 필드를 `nodeOutput` 에 얹는 향후 코드 리뷰 시 "allowlist 13키와 이름이 우연히 겹치지 않는지"를 체크리스트 항목으로 유지할 가치는 있다.

- **[INFO]** SSE/webhook fanout `nodeOutput` narrowing 은 이미 운영 중인 외부 응답 바디를 소급 축소하는 하위 호환성 변경 — 알려지지 않은 제3자 webhook 구독자에 대한 실 트래픽 감사는 이 세션 범위 밖으로 남아 있다.
  - 위치: `CHANGELOG.md`(정정 블록, "외부 수신자에게는 동작 변경이다"), `codebase/backend/src/modules/websocket/websocket.service.ts:182-205,475-483`.
  - 상세: 정보노출 방어를 강화하는 대가로 나가는 필드가 줄어드는 방향의 변경이라 보안 관점에서는 정당한 트레이드오프다(공격 표면 축소). `CHANGELOG.md`·RESOLUTION.md(W4)가 "운영 로그 감사는 수행 불가"임을 정직하게 기록하고 있어 은폐되지 않았다.
  - 제안: 조치 불요(정보성 기록, 코드 결함 아님).

## 긍정적으로 확인된 방어 요소 (참고)

- **fail-closed 설계**: `allowlistNodeOutputKeys`(`node-output-allowlist.ts:121-137`)는 목록에 없는 키를 전부 제거한다 — 실패 방향이 "렌더 파손"이지 "정보 노출"이 아니다.
- **프로토타입 오염 방어**: `Object.keys(obj)` 는 own enumerable 키만 순회하고, `delete out[k]`(대입이 아니라 삭제, 130~134행)를 써서 상속 setter 경로를 피한다 — `__proto__` 오염 방지가 `node-output-allowlist.spec.ts` 캐너리로 고정돼 있다.
- **런타임 불변**: `Object.freeze(NODE_OUTPUT_ALLOWED_KEYS)`(66행) — `as const` 만으로는 못 막는 변조를 차단.
- **컴파일타임 결속**: `assertAllowlistCoversHandlerContract`(102-110행)가 `NodeHandlerOutput` 공개 5키(`_resumeState`/`_retryState` 제외)를 타입 레벨에서 강제 — 새 공개 필드 추가 시 빌드 실패.
- **단일 chokepoint**: `toFanoutEnvelope`(475-483행)가 `emitExecutionEvent`/`emitNodeEvent` 두 곳에서만 호출되고, `nodeOutput`·`buttonConfig.nodeOutput` 두 자리 모두 여기서 걸린다. grep 으로 우회 경로(`broadcastToChannel` 직접 호출하는 다른 emit) 없음을 재확인.
- **순서 보장**: `toFanoutEnvelope` 내부가 `stripExternalOnlyFields` → `allowlistNodeOutputKeys` → `attachRoutingContext` 순으로 실행돼(479-482행), 값 마스킹(`maskWireEnvelope`, 이미 emit 상류에서 완료)과 라우팅 컨텍스트 첨부가 allowlist 적용을 우회하거나 재오염시키지 않는다.
- **copy-on-change 검증**: `websocket.service.spec.ts`에 top-level `nodeOutput`뿐 아니라 `buttonConfig.nodeOutput` 분기의 무변경 시 참조 동일성(envelope 자체 + 서브트리 양쪽)을 검증하는 캐너리가 추가돼(`22_51_46` testing W2 해소), 가드가 제거되면 뮤테이션(M5)으로 RED 가 되는 것까지 확인됨(RESOLUTION.md 기재).
- 하드코딩된 시크릿·SQL/커맨드 인젝션·경로 탐색·인증 우회·안전하지 않은 암호화 패턴은 이번 diff(`git diff origin/main...HEAD -- codebase/` 전체 grep)에서 발견되지 않음 — 순수 필드 필터링 로직 + 문서/테스트 변경.

## 요약

이번 라운드가 검토하는 실질 코드 변경은 6개 TS 파일(4개는 이전 라운드에서 이미 검증된 핵심 로직에 대한 JSDoc 정정, 2개는 신규 캐너리 테스트)에 그친다. 핵심 방어 로직(`allowlistNodeOutputKeys`, `allowlistFanoutNodeOutput`, `toFanoutEnvelope` 배선)은 fail-closed·프로토타입 오염 방어·런타임 불변·컴파일타임 결속·단일 chokepoint·순서 보장을 모두 갖췄고 새로 추가된 캐너리(REST 4키 통과, `buttonConfig` copy-on-change)가 앞선 라운드에서 지적된 WARNING(W1·W2)을 실측 기반으로 해소했다. CRITICAL/WARNING 급 신규 보안 결함은 발견되지 않았다. 유일하게 남는 것은 이미 세 차례 문서화·캐너리로 고정된 기존 잔여 갭(`envelope.output` 을 통한 `_retryState` 노출)과, 정보 노출 축소 방향의 하위 호환성 변경(제3자 webhook 구독자 실 트래픽 미감사)이며 둘 다 코드 결함이 아니라 의식적으로 스코프를 좁힌 정직한 기록이다.

## 위험도

LOW
