# 정식 규약 준수 검토 — spec draft: 종결 이벤트 payload 단일 SoT 화

target: `plan/in-progress/spec-draft-eia-notification-payload-contract.md`

## 발견사항

- **[WARNING]** 결정 (3) "코드 타입을 SoT 로" 가 `chat-channel-adapter.md` 자신의 R3 원칙과 충돌
  - target 위치: target 문서 "## 결정 — 필드 집합은 1곳, 봉투는 채널별 1곳, 나머지는 포인터" → "### (3) 나머지는 포인터로 — 필드 열거를 없앤다" 첫 번째 불릿
    ("`conventions/chat-channel-adapter.md` §1.2 `EiaEvent` — 3 variant 의 필드 열거를 (1) 참조로.
    타입 정의가 필요하면 **코드 타입을 SoT 로** 가리킨다(`chat-channel/types.ts`).")
  - 위반 규약: `spec/conventions/chat-channel-adapter.md` §1.2 서문
    ("`EiaEvent` 는 [EIA §6 outbound notification payload] 의 5종 union — 별 신규 타입 정의 없이
    EIA spec 의 payload shape 을 재사용 (**drift 회피**)") 및 그 근거인
    **R3 "EiaEvent 를 별 타입으로 정의하지 않고 EIA spec 위임"**
    ("EIA spec §6 의 payload 가 SoT — 본 컨벤션은 union 만 정의. 두 spec 간 type drift 회피.
    **구체 필드의 spec 갱신은 항상 EIA spec 우선.**")
  - 상세: R3 는 "필드 형태의 SoT 는 항상 EIA spec, `chat-channel-adapter.md` 는 절대 별도 타입을
    선언하지 않는다"를 명시적으로 확립한 규칙이다. target 의 결정 (1)도 이 정신을 이어받아
    "EIA §6.3 을 유일한 규범 필드 집합"으로 신설한다. 그런데 결정 (3)은 "타입 정의가 필요하면
    **코드** 타입(`chat-channel/types.ts`)을 SoT 로 가리킨다"고 적어, 필드 형태의 최종 권위를
    spec 표 (1) 이 아니라 구현 코드 파일로 옮긴다. `chat-channel-adapter.md` 전체에서 "SoT" 로
    표시된 다른 모든 참조는 예외 없이 spec 문서/섹션을 가리키며(`§1.1 provider별 field type
    범위`·`§R-CCA-7`·`§R-CCA-8`·`EIA §6.2` 등), `.ts` 코드 파일을 SoT 로 지정한 선례가 이 문서
    안에는 없다(다른 컨벤션 문서, 예: `execution-context.md` 의 `node-handler.interface.ts` 는
    선례가 있으나 그건 인터페이스 자체가 코드에만 존재하는 경우다 — 여기서는 이미 spec §6.3 에
    같은 필드 집합의 정본이 별도로 존재하므로 사정이 다르다). 더 나아가 target 자신의
    "## 후속 (developer)" 체크리스트 항목 "`chat-channel/types.ts:388` 을 (1) 최종형과 동기화"는
    코드가 spec 표 (1) 을 **따라가야 하는 쪽**이라고 말하고 있어, 결정 (3) 의 "코드가 SoT" 표현과
    직접 모순된다. 이 상태로 실행되면 spec §6.3 표(1)와 `chat-channel/types.ts` 가 다시 "각자
    필드를 보유하는 두 곳"이 되어, 이번 작업이 없애려는 바로 그 N-곳 drift 패턴(`14_18_42`
    CRITICAL 의 근본 원인)을 좁은 규모로 재생산할 위험이 있다.
  - 제안: 두 가지 중 하나로 정리 권장 — (a) "코드 타입을 SoT 로 가리킨다" 문구를 삭제하고 R3 의
    기존 패턴을 그대로 유지 (`chat-channel-adapter.md` §1.2 는 `unknown`/pointer 로 (1) 을
    참조하고, `chat-channel/types.ts` 는 구현체일 뿐 SoT 가 아님을 명확히), 또는 (b) 정말로
    코드-우선으로 정책을 바꾸는 것이 의도라면 R3 본문도 함께 갱신해 "필드 형태 SoT = 코드,
    spec §6.3 표는 파생 요약"이라고 명시하고, 후속 체크리스트의 "코드를 (1) 최종형과 동기화"
    문구도 반대 방향("spec (1) 을 코드 타입과 동기화")으로 정정한다.

## 요약

target 은 `redis-keys.md` 가 이미 증명한 "필드 집합은 단일 SoT + 나머지는 포인터" 패턴을 EIA 종결
이벤트 payload 에 그대로 이식하려는 계획이며, 참조하는 규약 인용(`redis-keys.md` §1·§3 인용문,
`error-codes.md`/`node-output.md` 의 명명·`Planned` 어휘, 프론트매터 스키마)은 모두 정확하고
기존 컨벤션과 정합한다. 다만 결정 (3)에서 `chat-channel-adapter.md` §1.2 `EiaEvent` 의 타입 SoT 를
"코드(`chat-channel/types.ts`)"로 지정한 한 문장이 그 문서 자신의 R3 원칙("EIA spec 이 SoT, 구체
필드 갱신은 항상 spec 우선")과 충돌하고, target 의 후속 체크리스트 항목("코드를 spec 표 (1)과
동기화")과도 모순된다. 이는 이번 작업의 핵심 목표(단일 SoT 확립)를 부분적으로 다시 흐리는 표현이라
WARNING 으로 반영이 필요하나, 아직 실행 전 계획 단계이고 문구 정정만으로 해소되므로 전체 계획의
방향성 자체는 견고하다.

## 위험도
LOW
