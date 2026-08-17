# Cross-Spec 일관성 검토 — `spec/5-system/**` (impl-prep)

## 범위 확정

target = `spec/5-system/**`(전체) + 관련 spec(`1-data-model.md`·`data-flow/15-external-interaction.md`·
`7-channel-web-chat/**`·nodes/navigation 등). 컨텍스트 예산 초과로 `1-auth.md`·`4-execution-engine.md`·
`15-chat-channel.md` 등 13개 파일과 `spec/conventions/**` 전체가 번들에서 생략되어, 해당 파일은
저장소에서 직접 `Read`/`grep` 했다(`spec/5-system/1-auth.md` §3.1~3.2, `spec/5-system/12-webhook.md`
§5.3+Rationale, `spec/conventions/chat-channel-adapter.md` R-CCA-5, `spec/3-workflow-editor/3-execution.md`
§1.3/§751 등).

이 impl-prep 세션은 워크트리에 준비된 미착수 plan
[`plan/in-progress/eia-fanout-and-internal-data-masking.md`](../../../../../../plan/in-progress/eia-fanout-and-internal-data-masking.md)
(§A: WS `execution.node.*`/비종결 `execution.*` emit 값-패턴 마스킹, §B: 내부 REST `inputData`/`outputData`
마스킹)의 착수 직전 상태를 반영한다. 그 plan이 전제로 삼는 `spec/5-system/14-external-interaction-api.md`
§R17 "잔여(범위 밖)" ①·② 서술 자체는 이미 spec에 정확히 등재돼 있어 이 dimension은 충돌 없음(§R17:1515-1518).
아래 두 건은 그 plan이 앞으로 내릴 **설계 선택**이 같은 target 디렉토리 안의 **기존 확정 결정**과
정면으로 부딪히는 지점이다.

## 발견사항

- **[WARNING]** WS `execution.node.*` 내부 wire를 원문으로 남기는 설계가 R17 "masking parity" 원칙과 정면 충돌
  - target 위치: `plan/in-progress/eia-fanout-and-internal-data-masking.md` §A "왜 wire가 아니라 fanout인가" (
    "같은 자리에 얹으면 워크플로 소유자의 콘솔 디버깅(원문 에러)은 보존하면서 외부 노출만 닫힌다") — 이 plan은
    `execution.node.*` emit의 값-패턴 마스킹을 **fanout 분기(SSE/notification/ChatChannelDispatcher)에만** 걸고,
    **내부 WS wire(에디터로 가는 Socket.IO room emit)는 원문을 유지**하는 것을 명시적으로 선택했다.
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` §R17 "내부 읽기 경로도 같은 마스킹을 적용한다
    (결정 2026-08-16)" 서브불릿(:1486-1511) — 같은 날 확정된 `Execution.error` 마스킹 결정의 핵심 근거는
    "**안전성은 롤 게이팅이 아니라 서버 boundary masking parity에 의존**"(:1505-1510)이며, 그 정당화는
    "`GET /api/executions/:id`에 `@Roles` 게이트가 없어 **viewer를 포함한 워크스페이스 멤버 전원**이 조회한다"는
    사실이다.
  - 상세: `execution:{executionId}` WS 채널의 구독 인가는 `spec/5-system/6-websocket-protocol.md` §3.3
    (:147-155)에서 "workspace 소유 검증"만 요구한다 — role 구분이 없다. `spec/5-system/1-auth.md` §3.2 RBAC
    매트릭스(:366-374)도 Workflow 리소스에 Viewer=`R`을 부여해, WS 채널 구독 인구와 `GET /api/executions/:id`
    조회 인구가 **동일**함을 확인했다(둘 다 "워크스페이스 멤버 전원", "워크플로 소유자"만의 특권 계층이
    RBAC에 존재하지 않는다). 즉 plan이 "wire는 소유자 전용이라 원문을 남겨도 된다"고 전제한 근거(§A)는
    RBAC 문서로 실증되지 않으며, R17이 같은 날 `Execution.error`에 대해 명시적으로 기각한 바로 그 전제
    ("내부는 신뢰 경계 → 원문 유지해도 안전")를 `execution.node.*`에서 되살리는 모양이 된다. 이 plan의
    자체 무수정 프로브(§A 도입부)가 보여준 것과 같은 클래스의 누출(`Bearer …`, DB 연결 문자열, 스택
    프래그먼트)이 `output.error`에도 실릴 수 있으므로 위험의 성격도 동일하다.
  - 제안: (a) `execution.node.*` WS wire에도 같은 `deepRedactSecrets` 관문을 적용해 R17의 parity 원칙과
    맞추거나, (b) wire를 원문으로 남기기로 한다면 그 예외가 R17의 parity 원칙과 다른 이유(예: 에디터
    WS 채널만 별도 신뢰 경계로 재정의하는 결정이 함께 필요하다면 그 결정 자체)를 §R17 옆에 캐비엇으로
    명시해 두 결정이 같은 문서 트리 안에서 서로 다른 원칙을 쓰는 것처럼 보이지 않게 해야 한다. 어느 쪽이든
    `spec/5-system/6-websocket-protocol.md` §4.1 `execution.node.*` 행에도 최종 정책을 반영해야 한다
    (현재 그 표는 `error` 필드 shape만 정의하고 마스킹 여부는 언급하지 않는다).

- **[WARNING]** `inputData`/`outputData` egress 마스킹이 `12-webhook.md`의 "display 시점 마스킹 기각" Rationale과 상충
  - target 위치: `plan/in-progress/eia-fanout-and-internal-data-masking.md` §B ("`toExecutionDto`/
    `toResponseExecution`" 두 경로에 `inputData`/`outputData` 마스킹 적용 — `Execution.error`와 "같은 구조로
    닫는다") 및 그 근거로 인용하는 `spec/5-system/14-external-interaction-api.md` §R17 "잔여(범위 밖) ②"
    (:1517-1518, "`inputData`/`outputData`는 다른 컬럼이라 포함되지 않는다").
  - 충돌 대상: `spec/5-system/12-webhook.md` Rationale "민감 헤더 마스킹 — ingestion(저장) 시점 채택
    (2026-07-07)" (:434-439).
  - 상세: 이 Rationale은 **같은 컬럼(`Execution.inputData`)**에 대해 정확히 plan §B가 채택하려는 전략
    ("원본을 `Execution.inputData`에 저장하고 execution/background-run 응답 DTO에서만 마스킹" = display
    시점 마스킹)을 **명시적으로 검토 후 기각**했다 — 기각 근거는 "raw secret이 DB에 잔존해 유출 표면
    (DB 접근·백업·신규 endpoint)이 남고, 모든 read 경로를 개별적으로 마스킹해야 한다"(:439)이며, 채택한
    대안(ingestion 시점 마스킹)의 근거는 "`inputData`·`output.request.headers`·`$trigger.headers` +
    향후 신규 read 경로까지 단일 소스로 커버 — 표면별 마스킹의 whack-a-mole을 원천 차단"(:438)이다. 이
    ingestion-시점 전략은 `spec/5-system/12-webhook.md`(:56,:276,:400) 뿐 아니라
    `spec/5-system/4-execution-engine.md`(:766)·`spec/5-system/5-expression-language.md`(:240-242,:539)·
    `spec/4-nodes/7-trigger/1-manual-trigger.md`(:142)까지 4개 문서가 "`Execution.inputData` 전반이
    ingestion 시점에 masked"라는 전제를 공유하며 인용한다. 반면 plan §B와 그 전례인 R17의 `Execution.error`
    마스킹(:1479-1481, "egress-only … 여기서는 서버 로그·사후 디버깅의 진실을 남기는 것")은 정반대 방향
    (DB는 원문 보존, 응답 시점에만 마스킹)을 택했다. `12-webhook.md`가 스스로 명명한 기각 사유("raw secret이
    DB에 잔존")는 plan §B가 새로 열려는 값-패턴 마스킹 대상(자격증명 패턴이 박힌 자유 텍스트 — 헤더
    key-blacklist로는 못 잡는 클래스)에도 문자 그대로 적용된다. 두 결정이 양립 불가능한 것은 아니다
    (ingestion층=알려진 헤더 key, egress층=임의 값-패턴 — 방어 계층이 다르다는 논리는 성립한다) 하지만
    plan에도 §R17에도 이 재조정을 명시적으로 인정·연결하는 문장이 없어, 향후 독자가 `12-webhook.md`
    Rationale과 새 §R17 확장을 나란히 읽으면 서로 모순된 정책 선언처럼 보인다. 부수적으로
    `12-webhook.md` §5.3(:319)의 "`inputData`/`output_data`를 노출하는 **모든** read 경로가 자동으로
    마스킹된다(표면별 개별 마스킹 불필요)"라는 문장은 스코프(민감 헤더 key만)를 명시하지 않아, plan §B가
    닫으려는 자유-텍스트 갭이 이미 해소된 것처럼 오독될 소지가 있다.
  - 제안: plan §B가 spec을 갱신할 때 `12-webhook.md`의 이 Rationale을 명시적으로 인용하고, R17의
    `Execution.error` 사례처럼 "다른 레이어다" 캐비엇("여기는 ingestion 시점 key-name 마스킹이 못 잡는
    값-패턴 자유 텍스트 계층이며, DB-at-rest는 §R17의 `Execution.error`와 같은 이유로 원문을 보존한다")을
    §R17 또는 §B가 갱신할 자리에 추가한다. 동시에 `12-webhook.md` §5.3(:319)의 "모든 read 경로가 자동으로
    마스킹된다" 문장에 "민감 헤더 key 한정" 스코프 캐비엇을 붙여 새 값-패턴 레이어와의 경계를 분명히 한다.

### 점검 관점별 확인 내역 (참고 — 위 두 건 외 충돌 없음)

- **데이터 모델 충돌**: `Execution`/`NodeExecution` 엔티티 정의(`1-data-model.md` §2.13/§2.14)는
  `Execution.error ↔ NodeExecution.error` "복사" 관계를 명시하고 이미 egress 마스킹 캐비엇을 갖고 있어
  §R17과 정합. `inputData`/`outputData` 필드 자체의 shape 정의는 위 WARNING 2건이 지적한 마스킹 **정책**
  충돌 외에는 모순 없음.
- **API 계약 충돌**: `6-websocket-protocol.md` §4.6 "외부 표면 매핑"과 `14-external-interaction-api.md`
  §11 매핑 표는 서로 1:1 정합(둘 다 `execution.node.*`가 SSE에는 도달하고 Outbound Notification에는
  `—`로 도달하지 않음을 동일하게 서술) — plan §A의 "node 이벤트는 종결 이벤트와 같은 외부 도달 범위를
  갖는다(SSE·ChatChannelDispatcher·NotificationFanout)"는 서술은 **NotificationFanout(webhook)** 부분이
  두 spec 표와 어긋난다(webhook 화이트리스트는 종결 3종 + `waiting_for_input`/`ai_message`뿐, `node.*`는
  제외). spec 자체는 서로 정합하므로 cross-spec 충돌은 아니지만, plan이 구현 범위를 정할 때 이 표와
  대조해 webhook 경로까지 손대지 않도록 주의가 필요하다(정보성).
- **요구사항 ID 충돌**: 이 target에서 신규로 발급되는 요구사항 ID 없음 — 기존 EIA-*/R17 서브항목 확장뿐.
  충돌 대상 없음.
- **상태 전이 충돌**: 이번 검토 범위는 상태 머신을 변경하지 않음(egress 마스킹 논의) — 해당 없음.
- **권한·RBAC 모델 충돌**: 위 WARNING 1건(WS wire) 외에는 `1-auth.md` §3.2 매트릭스·
  `6-websocket-protocol.md` §3.3 채널 인가 표 사이에 새로운 불일치 없음.
- **계층 책임 충돌**: plan이 마스킹 관문을 "fanout 분기"에 두려는 설계는 `14-external-interaction-api.md`
  §R10 "WebsocketService 단일 sink 정책"(엔진은 `emitToExecution` 한 곳만 호출, WS wire·`executionEvents$`
  세 형제 listener는 그 아래 facade 계층)과 구조적으로 충돌하지 않는다 — R10은 엔진의 호출 지점 단일화를
  요구할 뿐 wire·fanout 간 payload 동일성을 요구하지 않는다. 위 WARNING 1건은 R10이 아니라 R17의 masking
  parity 원칙과의 충돌이다.

### 부수 관찰 (INFO)

- **[INFO]** BackgroundRunsService parity 체크리스트 누락 가능성 — `14-external-interaction-api.md` §R17
  "적용 범위는 총칭이 아니라 열거다"(:1512-1514)는 `Execution.error` 마스킹의 현재 적용 범위를 "`ExecutionsService`
  4경로 + `BackgroundRunsService` body 노드까지"로 명시적으로 열거했고, `4-nodes/1-logic/12-background.md`
  §8.2(:246)도 이를 반영해 갱신됐다(2026-08-16 커밋 f5351e9c2). 그러나 plan의 §B 체크리스트
  ("`toExecutionDto` + `toResponseExecution` 두 자리")는 `BackgroundRunsService`를 언급하지 않는다.
  `inputData`/`outputData`도 같은 이유(같은 컬럼이 여러 표면에 원문 병존)로 새지 않으려면
  `BackgroundRunsService`의 대응 read 경로도 같은 라운드에서 갱신 대상에 포함해야 이 plan 자신의 §D가
  경계하는 "자매 넷 중 하나만" 패턴을 반복하지 않는다.
- **[INFO]** `spec/conventions/**` 미번들 — 이 impl-prep 세션의 조립 프롬프트는 `spec/conventions/*.md`
  전체를 포함하지 않았다(예산 초과 이전에 아예 목록에 없음). `chat-channel-adapter.md`의 R-CCA-5("`error.message`를
  그대로 redact해 전달하지 않는 이유는 … spec 차원 redact 가이드는 모든 노드 핸들러 audit을 요구해
  비현실적")는 직접 관련 있는 선례라 저장소에서 직접 읽어 대조했다 — 다만 `execution.node.failed`의
  `error`는 chat-channel-adapter가 소비하지 않는 필드(입력 화이트리스트는 `execution.failed`의
  `error.code`+`details.statusCode`뿐, `.message` 비참조)라 R-CCA-5와는 충돌하지 않음을 확인했다. 기존에
  알려진 예산 갭(memory: `feedback_consistency_spec_mode_budget`)이 재발한 사례로 기록해 둔다 — `spec/5-system/`을
  target으로 하는 향후 impl-prep 세션은 `spec/conventions/{chat-channel-adapter,node-output,error-codes}.md`를
  명시적으로 우선 포함하는 편이 안전하다.

## 요약

`spec/5-system/**` 자체(WS §4.6 ↔ EIA §11 매핑, R17 마스킹 카탈로그, 데이터 모델 §2.13/§2.14)는 내부적으로
잘 정합돼 있고 새로운 CRITICAL급 자기모순은 없다. 다만 이 세션이 준비 중인 착수 직전 plan
(`eia-fanout-and-internal-data-masking.md`)이 앞으로 내릴 두 설계 선택 — (1) WS `execution.node.*` 내부
wire를 원문으로 남기는 것, (2) `inputData`/`outputData`를 display(응답) 시점에 마스킹하는 것 — 은 각각
같은 target 디렉토리 안의 기존 확정 결정(R17의 "masking parity, 롤 게이팅 아님" 원칙 / `12-webhook.md`의
"display 시점 마스킹 기각" Rationale)과 반대 방향을 가리킨다. 둘 다 시스템을 작동 불가로 만드는 직접
모순은 아니지만, 명시적 우선순위 결정과 spec상의 상호 캐비엇 없이 진행하면 같은 문서 트리 안에 서로
다른 방향의 마스킹 철학이 병존하게 된다 — 이 저장소가 반복해 겪어 온 "선례가 갈렸다" 패턴이므로 구현
착수 전에 결정해 두길 권장한다.

## 위험도

MEDIUM
