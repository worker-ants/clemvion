# 테스트(Testing) 리뷰 — SSE/fanout `nodeOutput` allowlist (`23_56_18`, 3라운드)

이번 라운드의 실질 변경은 코드가 아니라 **범위 정정**이다(`23_29_27` cross_spec
CRITICAL 대응, 커밋 `fe4d58de7`). `websocket.service.ts`/`node-output-allowlist.ts` 프로덕션
코드는 직전 라운드(`23_16_40`)와 동일하고, 테스트 파일은 `websocket.service.spec.ts` 에
잔여 갭을 명시하는 캐너리 1건(+52줄)만 추가됐다. 직전 두 라운드(`22_51_46`→WARNING 2건,
`23_16_40`→WARNING 0건 수렴)의 발견사항은 이미 처리·수렴됐으므로 재론하지 않고, 이번
라운드의 신규 산출물(잔여 캐너리)과 전체 diff 를 대상으로 실측 검증했다.

## 실측 검증 방법

- `node-output-allowlist.spec.ts` + `websocket.service.spec.ts` + `interaction.service.spec.ts`
  3개 spec 단독 실행: **143 passed / 3 suites**.
- 신규 잔여 캐너리(`websocket.service.spec.ts` `[잔여] execution.node.* 의 envelope.output
  은 아직 allowlist 를 지나지 않는다`)의 vacuous 여부를 직접 뮤테이션으로 확인: `toFanoutEnvelope`
  에 "`externalPayload.output` 에도 `allowlistNodeOutputKeys` 를 적용한다"는 **정확히 그 커밋
  메시지가 경고한 나이브한 fix** 를 실제로 넣고 재실행 → `tsc --noEmit` 통과, 테스트는
  `expect(out._retryState).toBeDefined()` 에서 **RED**(`Received: undefined`)로 정확히 실패.
  변이 후 즉시 `cp` 백업본으로 원복, `git diff` 로 무변경 확인. 즉 이 캐너리는 vacuous 가
  아니라 실제로 "닫혔는데 아무도 안 고쳤다"는 미래 회귀를 잡는다.
- `emitNodeEvent(executionId, nodeId, eventType, payload)` 소스를 직접 대조해 새 캐너리가
  `payload` 를 envelope 최상위로 스프레드하는 실제 경로(`toFanoutEnvelope` 포함)를 태우는지
  확인 — mock 으로 우회하지 않고 실제 서비스 메서드를 호출한다.

## 발견사항

- **[INFO]** 잔여 캐너리를 정당화하는 실측 수치("버튼 재개 record 를 그대로 걸면 `{}`")가
  코드 리뷰/plan 문서에만 있고, 그 수치 자체를 고정하는 회귀 테스트는 없다
  - 위치: `plan/complete/sse-nodeoutput-allowlist.md`(뮤테이션 표 하단 서술) / 실제 소스
    `codebase/backend/src/modules/execution-engine/button-interaction.service.ts`(버튼 재개
    record 조립부, `buttonId`/`clickedAt`/`selectedItem`/`_selectedPort` 필드)
  - 상세: `envelope.output` 을 지금 안 닫은 이유는 "버튼 재개 record 에 `allowlistNodeOutputKeys`
    를 적용하면 13키 중 하나도 안 맞아 `{}` 가 된다"는 **측정값**이다. 그런데 이 값을 직접
    검증하는 테스트(`allowlistNodeOutputKeys({type, buttonId, ...})` 를 넣고 `{}` 를 기대하는
    unit, 또는 `button-interaction.service.spec.ts` 쪽에서 그 shape 을 스냅샷하는 테스트)는
    `node-output-allowlist.spec.ts`/`button-interaction.service.spec.ts` 어디에도 없다(grep
    확인). 즉 "왜 안 닫았는가"의 근거가 실측 시점엔 참이었지만, 버튼 재개 record 의 필드
    구성이 향후 바뀌어도(예: 필드 하나가 우연히 allowlist 키 이름과 겹치게 되어도) 그 사실을
    알려줄 테스트가 없다. 새 잔여 캐너리(`[잔여] execution.node.*…`)는 "닫혀 있지 않다"는
    사실만 고정하지, "닫으면 왜 위험한가"의 근거 자체는 고정하지 않는다.
  - 제안: 우선순위 낮음(이 diff 는 `envelope.output` 경로를 건드리지 않으므로 지금 당장의
    회귀 위험은 없다). 이 잔여 항목에 실제로 착수할 때, `allowlistNodeOutputKeys` 에 버튼
    재개 record 형태의 fixture를 하나 추가해 `{}` 로 무너진다는 사실 자체를 캐너리로 먼저
    고정해 두면, shape 판별 설계를 시작하기 전에 "그 전제가 아직 참인가"를 재확인할 필요가
    없어진다.

- **[INFO]** 신규 잔여 캐너리도 `describe('llmCalls strip — 외부 fanout 수신자 보호', …)`
  블록 안에 위치해, 직전 라운드(`23_16_40` testing INFO)가 지적한 describe 명 불일치가
  그대로 이어진다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts` — 604번째 줄
    `describe('llmCalls strip — 외부 fanout 수신자 보호', …)` 블록, 그 안의 신규
    `it('[잔여] execution.node.* 의 envelope.output 은 아직 allowlist 를 지나지 않는다', …)`.
  - 상세: 새 항목이 아니다 — 이미 정본 트래커(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`)
    에 "`testing 14 + 12`" 로 등재돼 있고 우선순위가 낮게 책정돼 있음을 확인했다. 다만 이번
    라운드에 추가된 캐너리도 같은 블록에 더해져 탐색성 갭이 미세하게 넓어졌다는 사실만 기록한다.
  - 제안: 조치 불요(이미 트래커에 등재·defer 확정). 다음 정리 라운드에서 일괄 이동 시 이 캐너리도
    포함할 것.

- **[INFO]** 잔여 캐너리에 대응하는 뮤테이션 항목이 plan 의 M1~M5 표에 없다 — 단, 본 리뷰가
  직접 뮤테이션으로 non-vacuous 함을 확인했다(위 "실측 검증 방법" 참조)
  - 위치: `plan/complete/sse-nodeoutput-allowlist.md`(뮤테이션 표), `websocket.service.spec.ts`
    신규 `it('[잔여] …')`.
  - 상세: 이 저장소의 관례(예측/실측 2열 뮤테이션 표)가 M1~M5 에 대해서만 적용됐고, `23_29_27`
    CRITICAL 대응으로 마지막에 추가된 이 캐너리는 그 표에 포함되지 않았다. 표가 이 캐너리의
    존재 이유("닫히면 이 단언이 뒤집힌다")를 문서화하지 않는다는 점에서 형식적 갭이지만,
    본 리뷰가 독립적으로 재현한 결과 캐너리 자체는 정확히 의도대로 동작한다(위 실측 참조).
  - 제안: 우선순위 낮음 — plan 문서 보강 성격이라 지금 라운드에서 코드/테스트 변경을 요구할
    사유는 아니다.

## 강점 (직전 두 라운드 대비 확인)

- `22_51_46`/`23_16_40` 라운드가 지적한 WARNING(REST 표면 확대 미검증, `buttonConfig`
  copy-on-change 미검증)은 각각 `interaction.service.spec.ts` 캐너리와
  `websocket.service.spec.ts` M5 캐너리로 이미 닫혀 있고, 이번 라운드에 회귀가 없음을 143건
  전수 실행으로 재확인했다.
- 신규 잔여 캐너리는 "미래에 이 갭이 닫히면 반드시 여기서 터진다"는 목적에 정확히 부합한다 —
  본 리뷰가 실제 나이브한 fix 를 넣어 RED 로 전환됨을 직접 재현했다(vacuous 아님, 대리
  단언·mock 우회 없음).
- `emitExecutionEvent` 경로와 달리 `emitNodeEvent` 경로를 처음으로 exercise 하는 캐너리라,
  직전 라운드(`23_16_40` testing INFO "`emitNodeEvent` 경로 미검증")가 지적했던 갭을 이번
  잔여 캐너리가 (의도치 않게) 부분적으로 메웠다 — 다만 이 캐너리는 "여전히 안 닫혔다"만
  검증하므로 `emitNodeEvent` 가 `nodeOutput`/`buttonConfig` 를 실을 때의 allowlist 자체는
  여전히 미검증이다(그 경로가 현재 도메인상 존재하지 않는다는 근거는 직전 라운드가 이미
  확인함).
- `node-output-allowlist.spec.ts` 는 리터럴 대조 + 파생 `it.each` 이중 방어, `Object.freeze`
  런타임 불변 검증, `__proto__` 오염 방어, copy-on-change, non-object passthrough 를 모두
  갖춰 순수 유틸 unit 커버리지에 갭이 없다. 테스트 격리도 각 `it` 가 독립 fixture 를 쓰고
  공유 mutable 상태가 없어 실행 순서 의존성이 없다.

## 요약

이번 라운드의 실질 diff(잔여 캐너리 52줄)는 테스트 관점에서 CRITICAL/WARNING 급 결함이
없다. 직전 두 라운드가 이미 REST 표면 확장·`buttonConfig` copy-on-change 갭을 캐너리와
뮤테이션(M1~M5)으로 닫았고, 이번에 추가된 "잔여 갭 고정" 캐너리는 본 리뷰가 독립적으로
재현한 뮤테이션 실험(나이브 fix 삽입 → 정확히 RED)으로 vacuous 하지 않음을 확인했다.
남은 갭은 전부 INFO 수준 — ① 잔여 판단의 근거가 된 실측값("버튼 재개 record → `{}`")
자체를 고정하는 회귀 테스트가 없어 향후 그 전제가 조용히 stale 해질 수 있다는 점, ②
describe 블록명 불일치가 신규 캐너리에도 이어졌다는 점(이미 트래커 등재·defer 확정), ③
plan 의 뮤테이션 표가 이번 캐너리를 아직 반영하지 않았다는 점(리뷰가 대신 실측)이다. 셋
다 지금 diff 범위(잔여 갭을 "닫지 않고 기록"하는 정정)에서 즉시 조치를 요구할 사유는
아니다.

## 위험도
LOW
