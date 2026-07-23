# 테스트(Testing) 리뷰 — presentation-thread-optout-drift

## 전제: 이 changeset 은 코드 변경이 아니다

리뷰 대상 12개 파일 전부 `plan/**`·`review/**`·`spec/**` 하위 마크다운/JSON 문서다
(`plan/in-progress/node-output-redesign/form.md`, `plan/in-progress/presentation-thread-optout-drift.md`,
`review/consistency/2026/07/23/19_48_09/*`, `spec/4-nodes/6-presentation/0-common.md`,
`spec/conventions/conversation-thread.md`). `codebase/**` 소스 파일도, `*.spec.ts`/`*.test.ts` 테스트
파일도 diff 에 없다 — project-planner 의 `spec/`·`plan/` 작업이며 CLAUDE.md 권한표상 developer 영역
코드 변경은 아직 없다(§비목표에 "코드 작업은 별건"으로 명시). 따라서 아래 8개 점검 관점(테스트 존재
여부/커버리지 갭/엣지케이스/Mock/격리/가독성/회귀/용이성)은 이 diff 자체에는 대부분 적용 대상이 없다.
다만 문서가 새로 주장하는 "런타임 동작" 이 실제 테스트로 뒷받침되는지, 그리고 문서가 향후로 미룬 코드
변경(D1 위반 수정)에 대한 테스트 계획이 비어 있는지는 테스트 관점에서 검증할 가치가 있어 직접 실측했다.

## 발견사항

- **[INFO]** 신규 spec 서술의 핵심 기술 주장이 기존 회귀 테스트로 이미 뒷받침됨 (검증 완료, 조치 불요)
  - 위치: `spec/4-nodes/6-presentation/0-common.md:166-168` (§4.6 "두 층위" 표), `spec/conventions/conversation-thread.md:189-195`
  - 상세: 두 spec 문서 모두 "`appendInternal`/`isOptedOut` 게이트는 노드 종류를 가리지 않고
    presentation 노드에도 동일 적용된다"는 주장을 새로 명문화했다. 실제 코드를 확인한 결과
    `codebase/backend/src/modules/execution-engine/conversation-thread/conversation-thread.service.spec.ts:112`
    (`'skips when excludeFromConversationThread=true (silent opt-out)'`)가 이미 이 정확한 시나리오를
    커버한다 — 해당 테스트 파일의 `makeNode()` 헬퍼(`:23-29`)는 `type: 'form'`을 **기본값**으로 사용해
    (AI 노드 타입이 아닌 presentation 노드 타입), 문서가 이번에 명문화한 "노드 종류 무관" 동작을 실제로
    회귀 검증하고 있다. 문서 변경이 코드 사실과 어긋나지 않는다는 판단을 테스트 근거로도 재확인.
  - 제안: 없음(확인용). 다만 spec 본문에 이 테스트를 근거로 명시 인용하면(예: `conversation-thread.service.spec.ts:112`)
    추후 누군가 게이트를 리팩터링할 때 "이 스펙 문장이 지금 몇 번 테스트로 고정돼 있는지" 추적이 쉬워진다.

- **[INFO]** D1 위반(`form.handler.ts` 의 `{ ...rawConfig }` spread) 후속 수정에 대한 테스트 계획이 아직 없음 — 이번 diff 범위 밖이지만 착수 시점에 비어 있을 위험
  - 위치: `plan/in-progress/node-output-redesign/form.md:156-161` (D1 재검토 각주), `plan/in-progress/presentation-thread-optout-drift.md:56-59`(§비목표 2), `:70`(WARNING 3 pin)
  - 상세: 두 plan 문서가 "form 만 명시 enumeration 대신 spread 를 쓰고 있다(D1 위반)"는 진단에는
    합의했고 "developer 후속 task 로 등록"한다고 적었지만, 실제로 생성된 산출물은 두 plan 파일에 붙은
    **각주뿐**이며 별도 backlog 추적 항목(task 파일)은 이 diff 에 없다. 실측 결과 이미 명시 enumeration 을
    쓰는 형제 handler(`carousel.handler.ts:183-221` 의 `configEcho`)조차 "enumeration 이 실제로
    비열거 필드를 걸러낸다"는 것을 확인하는 회귀 테스트가 없다(`carousel.handler.spec.ts` 에
    `configEcho`/`credential`/`passthrough` 관련 assertion 0건, grep 으로 직접 확인). 즉 향후
    `form.handler.ts` 를 spread→enumeration 으로 고칠 때 참고할 테스트 패턴이 sibling 에도 아직
    존재하지 않는다.
  - 제안: developer 후속 task 를 실제로 등록할 때(현재 두 plan 의 미해결 pin 사항), 수정 자체뿐 아니라
    "config 에 enumeration 되지 않은(예: credential-shaped) 키를 섞어 넣어도 `output`/반환 `config` 에
    echo 되지 않는다"를 assert 하는 회귀 테스트를 `form.handler.spec.ts`에 추가하도록 명시하고, 가능하면
    동일 패턴을 `carousel.handler.spec.ts` 등 sibling 에도 소급 적용하는 것을 함께 스코프에 넣을 것을 권고.

- **[INFO]** 기존에 이미 추적 중인 `rawConfig` ↔ `config` 분리 unit 테스트 공백이 이번 diff 로 재차 노출되었으나 상태 변화 없음
  - 위치: `plan/in-progress/node-output-redesign/form.md:169-171,188` (체크리스트 미해결 항목)
  - 상세: `form.handler.spec.ts:10-19` 의 `beforeEach` 컨텍스트는 `rawConfig` 를 설정하지 않아,
    `defaultValue` 가 `{{ }}` 표현식일 때 handler 가 반환하는 `config` 가 raw 값을 보존하는지
    (`form.handler.ts:42` `context.rawConfig ?? config`) 검증하지 못한다 — 실제 소스로 확인해 재확인됨.
    이 갭은 이번 diff 이전부터 문서화돼 있었고 diff 는 이를 변경하지 않는다(신규 결함 아님).
  - 제안: 이미 체크리스트에 있으므로 신규 조치 불요. developer 착수 시 우선순위 목록에 포함되어 있는지만
    재확인 권고.

## 요약

리뷰 대상 12개 파일은 전부 spec/plan/review 문서이며 애플리케이션 코드나 테스트 파일은 diff 에 포함되지 않아, 표준 8개 테스트 점검 관점 대부분이 이 changeset 자체에는 적용되지 않는다. 문서가 새로 주장하는 핵심 런타임 동작("opt-out 게이트는 노드 종류 무관 공통 적용")은 직접 소스를 대조해 `conversation-thread.service.spec.ts:112`의 기존 회귀 테스트(기본 노드 타입이 `'form'`)가 이미 정확히 그 시나리오를 커버함을 확인했고, 이는 문서 변경의 사실관계를 뒷받침한다. 유일하게 테스트 관점에서 남는 잔여 리스크는 이번 문서가 developer 범위로 미룬 `form.handler.ts` D1(spread→enumeration) 수정에 대해 아직 구체적인 테스트 계획(및 그 패턴의 sibling 선례)이 없다는 점과, 기존에 이미 추적 중이던 `rawConfig`↔`config` 분리 unit 테스트 공백이 여전히 미해결이라는 점이며, 둘 다 이번 diff 의 신규 결함이 아니라 향후 developer 작업 착수 시 유의할 사항이다.

## 위험도

NONE
