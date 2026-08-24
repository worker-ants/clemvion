STATUS=success architecture review complete (target: node-output-envelope-458f05, 2 code files + 17 doc/plan/review files)
===REPORT_MARKDOWN_BELOW===
# 아키텍처 리뷰 — `node-output-envelope-458f05`

## 범위 확인

19개 변경 파일 중 실제 프로덕션/테스트 코드는 2개뿐이다:
`codebase/backend/src/modules/websocket/websocket.service.ts`,
`codebase/backend/src/modules/websocket/websocket.service.spec.ts`. 나머지 17개는
`CHANGELOG.md`, `plan/**`, `review/consistency/**`, `spec/**` 문서 산출물이다. 아키텍처
관점(SOLID/결합도/레이어/패턴/순환참조/추상화/모듈경계/확장성)은 본질적으로 코드 구조를
다루므로, 아래 발견사항은 두 코드 파일 및 그 코드가 의존하는 `shared/utils/node-output-allowlist.ts`,
소비처 `external-interaction/interaction.service.ts` 를 `Read`/`Grep` 으로 직접 열어 대조한
결과다. 문서 파일들의 절차적 쟁점(자기-반증형 소정정 적용 범위 등)은 `review/consistency/2026/08/24/10_44_28/RESOLUTION.md` 에서 이미 CRITICAL 로 다뤄지고 처분됐으므로 본 리뷰(아키텍처)에서는 중복 지적하지 않는다.

## 발견사항

- **[INFO]** `narrowTopLevelNodeOutput` 파라미터화는 좋은 리팩터링이지만, 세 번째 자리(`buttonConfig.nodeOutput`)는 여전히 손으로 인라인된 중복 로직이다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:192` (`allowlistFanoutNodeOutput` 함수 본문, 게이트 200~211)
  - 상세: 종전에는 `nodeOutput` 최상위와 `buttonConfig.nodeOutput` 두 갈래가 각각 인라인돼 있었다. 이번 변경은 최상위 두 자리(`nodeOutput`, `output`)를 `narrowTopLevelNodeOutput(envelope, key)` 하나로 통합해 OCP 를 개선했다(세 번째 top-level 키가 추가돼도 호출 한 줄만 늘면 된다). 그런데 `buttonConfig.nodeOutput` 은 한 단계 중첩돼 있다는 이유로 여전히 별도 인라인 블록(`typeof` 체크 → `allowlistNodeOutputKeys` → copy-on-change)으로 남아, 같은 "narrow 하나의 키" 패턴이 두 가지 다른 코드 형태로 존재한다. 주석이 "최상위 헬퍼로 못 덮는 유일한 자리" 라고 설명은 하지만, 헬퍼를 `(container, key) => …` 형태의 경로 접근자로 한 단계 더 일반화하면 세 자리 모두 동일 코드로 커버할 수 있었다.
  - 제안: 지금 당장 고칠 필요는 없다(3곳뿐이고 각 형태가 명확히 문서화돼 있다). 다만 향후 네 번째 nested 자리가 생기면(예: 다른 interaction 타입의 하위 nodeOutput) 이 시점에 `narrowTopLevelNodeOutput` 을 경로 기반 헬퍼로 일반화할 것 — 지금 반영하라는 것이 아니라 다음 확장 시 판단 기준으로 남겨 둔다.

- **[INFO]** wire 레벨 `output` 키(이번에 추가된 필터 대상)와 `NodeHandlerOutput.output` 도메인 필드가 같은 이름을 다른 추상화 레벨에서 공유한다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:199` (`narrowTopLevelNodeOutput(next, 'output')` 호출) — 개념적으로는 `NodeHandlerOutput` 타입 정의(`codebase/backend/src/nodes/core/node-handler.interface.ts`)와의 관계
  - 상세: `execution.node.completed`/`.failed` 이벤트는 envelope 최상위에 `output: NodeExecution.outputData`(=`NodeHandlerOutput` 래퍼 전체)를 싣는데, 그 `NodeHandlerOutput` 자신도 `output` 이라는 필드를 갖는다(`{config, output, port, status, meta?}`). 즉 wire 상에서 `envelope.output.output` 이 성립하고, 이 PR 의 allowlist 는 바깥쪽 `output`(래퍼)에 걸린다. 코드 자체는 정확하지만(뮤테이션 검증 M1/M2 로 실측 확인됨), 같은 식별자가 두 레이어(전송 봉투 레벨 vs 도메인 값 레벨)에서 재사용되는 것은 추상화 경계를 흐린다 — 다음에 이 파일을 만지는 사람이 "`output` 이 곧 도메인 값" 이라고 오독할 위험이 있다.
  - 상태: 이미 같은 세션의 `naming_collision` consistency checker 가 WARNING 으로 잡아 `spec/5-system/6-websocket-protocol.md` §4.1 표를 래퍼/도메인값 구분 서술로 정정했다(`review/consistency/2026/08/24/10_44_28/RESOLUTION.md` WARNING 2). 코드 쪽 조치는 불요 — 문서화로 처분된 사안이라는 점만 기록.

## 양호한 설계 포인트 (violation 아님, 근거로 기록)

- **단일 chokepoint 유지**: `toFanoutEnvelope`(`websocket.service.ts:489`)가 `emitExecutionEvent`/`emitNodeEvent` 양쪽의 유일한 외부 출구로 남아 있다. `allowlistFanoutNodeOutput` 확장이 이 경계를 우회하지 않고 그 안에서만 이뤄져, "새 emit 경로가 생겨도 마스킹·strip 이 구조적으로 빠지지 않는다"는 기존 설계 불변식이 보존됐다.
- **정책의 단일 소유(DIP)**: `NODE_OUTPUT_ALLOWED_KEYS`/`allowlistNodeOutputKeys` 는 `shared/utils/node-output-allowlist.ts` 한 곳에만 있고, WS(`websocket.service.ts`)와 REST(`external-interaction/interaction.service.ts:394`) 양쪽이 이를 그대로 import 해 소비한다. 두 레이어가 서로를 참조하지 않고 공유 정책 모듈에만 의존하는 구조라 순환 의존성이 없고, 목록이 두 곳에서 각각 손-동기화될 위험도 없다.
- **hot-path 불변식 보존**: copy-on-change(변경 없으면 같은 참조 반환) 계약이 `narrowTopLevelNodeOutput` → `allowlistFanoutNodeOutput` 체인 전체에서 정확히 유지된다(`let next = …; next = …;` 순차 갱신 후 `buttonConfig` 블록도 `next` 기준으로 참조). 리팩터링이 기존 성능 특성을 깨지 않았다.
- **타입으로 확장 표면을 제한**: `narrowTopLevelNodeOutput` 의 `key: 'nodeOutput' | 'output'` 리터럴 유니온은 보안 경계 코드에 임의 키를 넘기지 못하게 컴파일타임에 막는다 — 확장이 "코드 변경"을 요구하도록 강제한 것은 fail-closed 정책에 맞는 의도적 설계다.

## 요약

이번 diff 의 실질 코드 변경은 `websocket.service.ts` 의 `allowlistFanoutNodeOutput`/신설 `narrowTopLevelNodeOutput` 두 함수로 국한되며, 종전에 `nodeOutput` 최상위 한 자리만 인라인으로 처리하던 로직을 `nodeOutput`/`output` 두 자리에 재사용 가능한 형태로 일반화한 작은 리팩터링이다. 단일 chokepoint(`toFanoutEnvelope`) 패턴, 공유 정책 모듈에 대한 단방향 의존(REST·WS 양쪽 소비), copy-on-change 성능 불변식이 모두 그대로 보존됐고 새로운 결합도/순환 의존성 문제는 없다. 지적할 만한 것은 `buttonConfig.nodeOutput` 자리가 여전히 별도 인라인 코드로 남아 있는 경미한 중복(다음 확장 시 일반화 검토 대상)과, wire 레벨 `output` 래퍼와 도메인 레벨 `NodeHandlerOutput.output` 필드의 이름 재사용으로 인한 추상화 경계 흐림 정도이며 둘 다 INFO 수준이고 후자는 이미 문서 정정으로 처분됐다. 나머지 17개 파일은 plan/spec/review 문서로 아키텍처 관점 코드 결함의 대상이 아니다.

## 위험도
NONE
