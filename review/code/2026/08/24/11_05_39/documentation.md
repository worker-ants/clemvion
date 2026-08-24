STATUS=success documentation review complete
===REPORT_MARKDOWN_BELOW===
# 문서화(Documentation) 리뷰 — `node-output-envelope` (`envelope.output` fail-closed allowlist 확장)

## 발견사항

- **[WARNING]** `narrowTopLevelNodeOutput` 의 JSDoc 이 리팩터 이전 함수(`allowlistFanoutNodeOutput`)를 설명한 채로 남아, 새 시그니처(`key` 매개변수)와 새 호출 대상(`output` 키)을 설명하지 않는다. 실제 chokepoint 인 `allowlistFanoutNodeOutput` 은 자체 JSDoc 이 없다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:172`(JSDoc 시작) ~ `182`(`function narrowTopLevelNodeOutput(` 선언) / `192`(`function allowlistFanoutNodeOutput(` 선언, 프롬프트 게이트 179~192 구간과 대응)
  - 상세: 이번 diff 는 기존 단일 함수 `allowlistFanoutNodeOutput` 을 두 함수로 쪼갰다 — 범용 헬퍼 `narrowTopLevelNodeOutput(envelope, key: 'nodeOutput' | 'output')` 과, 그것을 두 번(각 `nodeOutput`, `output`) 호출한 뒤 `buttonConfig.nodeOutput` 을 별도 처리하는 조립 함수 `allowlistFanoutNodeOutput`. 그런데 원래 있던 JSDoc 블록("fanout envelope 안의 `nodeOutput` **두 자리**를 fail-closed allowlist 로 좁힌다… 폼 waiting 은 `nodeOutput`, 버튼 waiting 은 `buttonConfig.nodeOutput`")은 함수 분리 후에도 그 자리(이제는 `narrowTopLevelNodeOutput` 바로 위)에 그대로 남았다. 이 문서는 세 가지가 실제와 어긋난다: (1) `narrowTopLevelNodeOutput` 은 `buttonConfig.nodeOutput` 을 전혀 다루지 않는다(그건 `allowlistFanoutNodeOutput` 안에서 별도 인라인 처리) — "두 자리"라는 문장이 이 함수엔 적용되지 않는다. (2) `key: 'nodeOutput' | 'output'` 매개변수가 존재한다는 사실 자체가 문서에 없다 — 이 함수가 이번 PR 의 핵심 변경(=`output` 키도 같은 헬퍼로 처리)인데 그 사실이 docstring 에 없다. (3) 정작 세 자리(nodeOutput / output / buttonConfig.nodeOutput)를 조립하는 실제 공개 chokepoint `allowlistFanoutNodeOutput` 은 인라인 `//` 주석만 있고 함수 레벨 JSDoc 이 없다 — `toFanoutEnvelope` 처럼 이 리포지토리가 다른 곳에서는 매우 공들여 유지하는 "chokepoint 문서화" 수준에 못 미친다. 이 프로젝트는 바로 이 PR 안에서 "유예 근거가 틀렸다", "질문이 한 칸 좁았다" 류의 자기반증 문서화에 큰 비중을 두는데, 정작 새로 쪼갠 함수의 docstring 배치는 그 기준에서 벗어났다.
  - 제안: JSDoc 을 `narrowTopLevelNodeOutput` 용(매개변수 `key` 설명 + "이 헬퍼는 top-level 한 키만 다룬다, `buttonConfig.nodeOutput` 은 별도" 명시)과 `allowlistFanoutNodeOutput` 용(현재 인라인 주석 2건을 통합해 "세 자리(`nodeOutput`/`output`/`buttonConfig.nodeOutput`)를 이 함수가 조립한다"는 함수 레벨 JSDoc)으로 분리해 재작성.

- **[WARNING]** CHANGELOG.md 의 2026-08-24 정정 문단이 "왜 이전 유예 근거가 틀렸는가"만 설명하고, 같은 CHANGELOG 항목의 형제 문단이 명시했던 **외부 수신자 대상 breaking-change 고지**를 이번에 새로 닫힌 `execution.node.completed`/`.failed` 의 `envelope.output` 표면에 대해서는 반복하지 않는다.
  - 위치: `CHANGELOG.md:34-38`(신규 "정정 (2026-08-24)" 문단) — 비교 대상은 같은 파일의 기존 문단 `CHANGELOG.md:41-44`("대신 목록이 9키에서 13키로… **외부 수신자에게는 동작 변경이다**… 제3자 webhook 구독자가 다른 키를 참조 중이었다면 그 키는 더 이상 도달하지 않는다")
  - 상세: `#1208`(`waiting_for_input` 표면을 닫을 때)의 CHANGELOG 항목은 "이건 외부 수신자에게 동작 변경이다"를 명시적으로 적었다 — SSE/webhook 구독자가 allowlist 밖 키를 참조하고 있었다면 더 이상 그 키가 도달하지 않는다는 구체적 경고다. 이번 PR 은 정확히 같은 성격의 narrowing 을 `execution.node.completed`/`.failed` 의 `envelope.output` 에도 적용한다 — 즉 그 두 이벤트를 구독하는 제3자 webhook/SSE 클라이언트가 13키 밖의 필드(예: 핸들러가 미래에 추가할 내부 필드, 혹은 현재 미관측이지만 코드 경로로는 열려 있는 `nodeOutputCache` flat 폴백 필드)를 참조하고 있었다면 이제 그 필드가 사라진다. 그런데 새로 추가된 정정 문단은 그 운영 영향을 언급하지 않고 기술적 반증 근거(전제가 틀렸다, 실 DB 조회 결과)만 적는다. `spec/5-system/14-external-interaction-api.md` §R17 표의 같은 정정 블록도, `plan/in-progress/node-output-envelope.md` 전체도 동일하게 이 breaking-change 고지가 빠져 있다(grep 결과 "외부 수신자"·"breaking"·"webhook" 무매치) — CHANGELOG 만의 누락이 아니라 이 PR 문서화 전체에 걸친 누락이다.
  - 제안: CHANGELOG 정정 문단 끝에 "이번에도 `execution.node.completed`/`.failed` 를 구독하는 외부(webhook/SSE) 소비자에게는 동작 변경이다 — `envelope.output` 최상위에서 13키 밖 필드가 사라진다"는 한 문장을 추가. 같은 문장을 EIA §R17 정정 블록에도 반영하면 세 SoT(CHANGELOG·§R17·plan)가 다시 어긋나지 않는다.

## 확인했지만 문제 없음 (참고)

- `toFanoutEnvelope` 의 JSDoc(`websocket.service.ts` private 메서드)은 이번 diff 로 대폭 갱신됐고, 새 키 이름 함정("`nodeOutput` 과 `output`" 두 키)·반증된 유예 근거·실측 표·"내부 WS 는 건드리지 않는다" 불변식까지 정확하고 상세하게 반영했다 — 이 PR 안에서 문서화 품질이 가장 높은 지점이다.
- `websocket.service.spec.ts` 의 테스트 JSDoc(뒤집힌 캐너리 + 신규 flat-폴백 캐너리)은 이전 라운드(`[잔여]` 캐너리)가 스스로 남긴 "닫히면 이 단언을 뒤집는 것이 그 작업의 일부" 계약을 정확히 이행했고, 무엇을 왜 고정하는지 서술도 정확하다.
- `spec/5-system/14-external-interaction-api.md` §R17, `spec/5-system/6-websocket-protocol.md` §4.4, `spec/conventions/conversation-thread.md` §8.4 세 곳 모두 취소선 보존 + 인접 정정 블록 패턴을 일관되게 적용했다 — 이력이 지워지지 않고 "측정은 맞았다, 전제가 틀렸다"는 동일 논리가 세 곳에 동기화돼 있다(직접 대조 확인).
- `spec/5-system/6-websocket-protocol.md` §4.1 표의 `execution.node.completed`/`.failed` 행 정정은 `output` 식별자가 wire 최상위 래퍼(`NodeHandlerOutput` 전체)와 그 안의 도메인 값(`NodeHandlerOutput.output`)이라는 두 레벨을 갖는다는 사실을 명시적으로 갈라 적어, `10_44_28` naming WARNING 이 지적한 혼동을 실제로 해소했다.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 트래커 항목 종결은 `[x]`+취소선+`<details>` 이력 보존 + 파생 신규 항목("`finalAdapted ?? nodeOutputCache` 폴백") 등재까지 기존 관례를 정확히 따랐다 — 모범적 처리.
- README·API 문서(swagger 등)·환경변수 문서는 이번 변경 범위 밖(내부 필터링 로직, 신규 엔드포인트·설정 없음)이라 갱신 불요.

## 요약

이번 PR 의 문서화 수준은 전반적으로 이 저장소의 높은 기준(취소선 보존 정정, 실측 근거 동봉, 다중 SoT 동기 스윕)을 잘 따르고 있고, 특히 `toFanoutEnvelope` JSDoc·spec 3곳의 정정 블록은 모범적이다. 다만 두 가지 실질 갭이 있다 — (1) 함수를 둘로 쪼갠 리팩터에서 JSDoc 이 옛 함수 설명 그대로 남아 새 매개변수(`key`)와 새 chokepoint(`allowlistFanoutNodeOutput`)를 설명하지 못하고, (2) 이번에 새로 narrowing 되는 `execution.node.completed`/`.failed` 의 `envelope.output` 표면에 대해 CHANGELOG·spec·plan 어디에도 "외부 webhook/SSE 소비자에게는 동작 변경"이라는 breaking-change 고지가 없다 — 바로 이전 PR(#1208)이 형제 표면(`waiting_for_input`)에 대해서는 그 고지를 명시적으로 남겼던 것과 비대칭이다. 둘 다 머지를 막을 사안은 아니나 후속 세션이 놓치기 쉬운 종류의 문서 drift라 이번 라운드에서 고치는 것을 권한다.

## 위험도

LOW
