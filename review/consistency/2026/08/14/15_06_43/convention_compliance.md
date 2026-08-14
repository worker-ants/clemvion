# 정식 규약 준수 검토 — spec-draft-eia-62-waiting-payload.md

## 검토 대상
`plan/in-progress/spec-draft-eia-62-waiting-payload.md` (`--spec` 모드) — EIA §6.2
`waiting_for_input` payload 재작성안. 비교 대상 정식 규약: `spec/conventions/**`
(주로 `node-output.md`, `error-codes.md`, `swagger.md`, `conversation-thread.md`,
`interaction-type-registry.md`, `secret-store.md`, `execution-context.md`,
`spec-impl-evidence.md`, `data-hydration-surfaces.md`을 직접 열람).

전체적으로 이 문서는 이미 여러 라운드의 checker 피드백(`09_38_17`·`12_06_21`·
`14_30_36`·`11_02_18`·`10_32_29`·`14_55_31`·`11_02_16`)을 흡수하며 정리된 상태다.
제안 (2)의 상대경로 URL 정정, (5)의 `nodeId` 미러링 요구는 실측(`spec/5-system/2-api-convention.md
§1`, `spec/5-system/14-external-interaction-api.md:659-662`, `spec/1-data-model.md`
Execution `error` 필드 정의)으로 직접 대조해 정확함을 확인했다 — 새 위반이 아니라
기존 위반의 정정 제안이다.

## 발견사항

- **[WARNING]** `error.code` optional 화 — 부재 표현(null vs 키 생략) 결정과 사유
  명시가 빠져 있다
  - target 위치: `## 변경 제안 (4) error.code 를 옵셔널로 (§6.4 + 필드 집합 표)`
  - 위반 규약: `spec/conventions/swagger.md §1-3/§1-5` (Optional 필드는 DTO 선언
    방식이 wire 표현과 1:1 대응해야 하고, 보호돼야 할 필드는 `writeOnly`/`readOnly`
    등 명시적 데코레이터 패턴을 갖는다) — 이 규칙이 실제로 참조하는 결정 프레임(어느
    경우 `null` 을 쓰고 어느 경우 키를 생략하는지, 그리고 "그 필드를 문서화하는 절에
    사유를 명시" 하라는 의무)의 SoT 자체는 `spec/5-system/2-api-convention.md §5.4`
    에 있어 엄밀히는 `spec/conventions/**` 바깥이지만, `swagger.md §1-3` 이 그 결정을
    DTO 선언(`field?: T` vs `field?: T | null`)으로 직접 강제하므로 conventions
    관점에서도 실질적으로 걸리는 지점이다.
  - 상세: 제안 (4)는 "코드 없음은 부재로 전달하는 편이 정직하다" 는 근거만 적고,
    그 부재를 **`null`** 로 표현할지 **키 생략**으로 표현할지 결정하지 않았다.
    `execution.failed.error` 는 이미 `nodeId: "uuid" | null` 처럼 `null` 관례를
    따르는 형제 필드를 갖고 있어(§6.4 JSON 예시), `code` 만 다른 표현을 택하면
    같은 객체 안에서 표현 방식이 갈린다. DTO 를 실제로 작성할 impl-prep 단계에서
    작성자가 임의로 하나를 고르면 wire 와 DTO 선언이 어긋날 위험이 있다.
  - 제안: (4)에 한 문장 추가 — "code 부재는 `null` 로 표현한다(형제 필드 `nodeId`
    와 동일 관례, 키 생략이 아님)" 또는 반대 결정과 근거를 명시. 후속 DTO 작성 시
    `code?: ErrorCodeLiteral | null` 형태로 반영하도록 §6.4 필드 표에도 `?`/`null`
    표기를 명시하면 swagger.md §1-3 패턴과 맞아떨어진다.

- **[WARNING]** `turnDebug` 이름 충돌이 "landed" 상태로 남을 위험 — node-output.md
  Overview 설계원칙과 상충
  - target 위치: `## 🔴 조사 중 발견 > ### 처분 (실제 상태)` 두 번째 미체크 항목
    ("이름 충돌은 이 커밋에 포함되지 않았다 — 별도 잔여")
  - 위반 규약: `spec/conventions/node-output.md` Overview — "워크플로우 작성자가
    `$node["노드 이름"].output.*` 로 값을 꺼낼 때, **노드 종류를 몰라도 어디에
    무엇이 있을지 예측 가능**하도록 한다"
  - 상세: 현재 wire 에는 top-level `turnDebug: { llmCalls, metadata }` (AI turn1
    스냅샷, object)와 `nodeOutput.meta.turnDebug[]` (WS §4.4:449 정본, array)가
    **동일 이름·다른 shape** 으로 공존한다. 문서 자신도 이를 "spec 에 정식 충돌로
    고착된다" 고 명시하고 있으나, 처리는 "planner 인계" 로 넘겨졌고 (1)의 §6.2
    재작성 범위(봉투만 맞춘다)에는 이 리네임이 포함돼 있지 않다. 즉 이번 spec 반영
    (7항목) 이 이 문서 그대로 실행되면, §6.2 예시 JSON 에 두 가지 의미의 `turnDebug`
    가 나란히 등장할 신규 표면(§6.2 "안쪽 JSON은 그대로 둔다" + (7)의 SoT 확장 문구
    추가)이 생길 수 있다.
  - 제안: 이미 문서 안에 "planner 인계" 로 못박혀 있으므로 새로운 작업 지시는
    아니지만, **7항목 spec 반영 체크리스트에 이 handoff 항목을 명시적으로 선행
    조건으로 걸거나**, 최소한 §6.2 예시에 두 `turnDebug` 를 나란히 쓸 때는
    `turnDebugSnapshot`(top-level) 처럼 즉시 구분 가능한 이름을 함께 적용하는 편이
    node-output.md 의 예측가능성 원칙에 더 부합한다.

- **[INFO]** `interaction.token` 필드(Planned) — 향후 구현 시 `writeOnly` 데코레이터
  적용을 미리 못박아두면 좋음
  - target 위치: `## 변경 제안 (2) interaction 블록 — 삭제하지 않고 Planned 로 표기`
  - 위반 규약: 위반은 아님. `spec/conventions/swagger.md §1-5` (secret-store 입력
    plaintext·토큰류 필드는 `writeOnly: true` 의무)
  - 상세: `interaction.token`(재개용 인터랙션 토큰)은 이후 실제 구현될 때 secret
    성격의 필드가 될 가능성이 높다. 지금은 "Planned" 표기로 미룬 것이 맞는 선택
    이지만(§Rationale 의 "만들 수 있는 것을 아직 안 만든 것" 논리), 실제 구현 PR
    에서 swagger.md §1-5 를 놓치지 않도록 짧게라도 언급해두면 후속 작업자가
    체크리스트로 바로 연결할 수 있다.
  - 제안: 필수 조치는 아님 — 참고용 INFO.

- **[INFO]** 문서 구조 규약은 잘 준수됨 (긍정 확인)
  - target 위치: 전체 구조
  - 상세: frontmatter `spec_impact` 가 리스트 형식(Gate C 준수), `worktree`/
    `started`/`owner` 필수 필드 모두 존재, Overview → 본문(실측/변경 제안) →
    Rationale → 체크리스트 순서로 CLAUDE.md 가 권장하는 3섹션 + plan 체크리스트
    관행을 따른다. `spec/1-data-model.md` 는 `spec-impl-evidence.md §1`
    (`EXCLUDE_BASENAMES`)에 의해 frontmatter 의무 대상에서 제외되므로, 이 문서가
    그 경로에 `spec_impact` 를 걸어도 frontmatter-evidence 가드와 충돌하지 않는다.

## 요약

target 문서는 spec/conventions/** 를 정면으로 위반하는 새로운 패턴을 도입하지
않는다. 오히려 (2)의 URL 버전 표기(`api-convention.md §1` 위반)·(5)의 데이터모델
누락(`error.nodeId`)처럼 **기존 위반을 식별해 고치는** 방향이며, 두 사례 모두 실측
으로 정확함을 확인했다. 남는 리스크는 두 가지 모두 "결정을 문서에 명시하지 않고
후속 단계로 넘긴" 종류다 — (a) `error.code` 부재의 wire 표현(`null` vs 키 생략)이
swagger.md 의 DTO 선언 요구와 맞물려 있는데 이번 제안엔 그 선택이 없고, (b) 이미
자체적으로 "정식 충돌로 고착될 위험" 이라고 적어 둔 `turnDebug` 명명 충돌이 이번
7항목 반영 범위 밖에 남아 있다. 둘 다 CRITICAL 은 아니며(다른 시스템의 invariant를
즉시 깨뜨리지 않음), 후속 impl-prep/DTO 작성 단계에서 작성자가 임의로 결정하게
두면 규약과 어긋날 여지가 있는 WARNING 수준이다.

## 위험도
LOW
