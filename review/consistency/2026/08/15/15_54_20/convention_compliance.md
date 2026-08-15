# 정식 규약 준수 검토 — spec/5-system/ (--impl-prep)

> 검토 범위 주의: prompt 번들은 컨텍스트 예산 초과로 `spec/5-system/` 15개 파일(14-external-interaction-api.md
> 포함)과 `spec/conventions/` 268개 파일(주로 cafe24/makeshop 카탈로그)의 본문을 생략했다. 또한 번들에 포함된
> `spec/conventions/node-cancellation.md` 는 **git HEAD 스냅샷**이며, 현재 워크트리의 실제 작업 대상인
> 미커밋 diff(§6 표 신규 1행)는 번들에 없었다 — "번들에 없다 = 없다" 로 오판하지 않기 위해 아래는 실제
> working tree 파일(`spec/conventions/node-cancellation.md`, `spec/5-system/4-execution-engine.md`,
> `spec/conventions/redis-keys.md`, `spec/conventions/error-codes.md`, `spec/data-flow/15-external-interaction.md`,
> 관련 코드 `execution-engine.service.ts`)을 직접 Read 해 대조했다.
>
> 실측한 실제 변경분(`git diff origin/main`)은 `spec/conventions/node-cancellation.md` §6 "구현 현황 / 후속"
> 표에 1행 추가뿐이며, `spec/5-system/` 나머지 파일들은 이번 턴에 수정되지 않았다. 아래 검토는 이 diff를
> 주 대상으로 하고, 관련 SoT 문서와의 정합성을 점검했다.

## 발견사항

- **[WARNING]** node-cancellation.md 신규 행이 문서 자신의 선언된 범위(취소) 밖의 함수를 §2.4(취소 관측 가드) 로 오분류
  - target 위치: `spec/conventions/node-cancellation.md` §6 "구현 현황 / 후속" 표, 신규 행
    `| §2.4 stalled 소진 종결 경로 **원자성** (`finalizeStalledExhausted`) | ✓ | ... |`
  - 위반 규약: (1) 본 문서 자체의 Overview 선언 — "본 컨벤션은 노드 단계 cancellation 의 단일 메커니즘 —
    `ExecutionContext.abortSignal` 전파 — 을 정의한다" 및 §2.4 도입부 — "이 절은 signal 을 만들지 않는
    취소(사용자 Stop)를 엔진이 관측하는 방식을 규정한다." 즉 문서 스스로가 스코프를 "cancellation" 으로
    한정했다. (2) 이 스코프 선언은 CLAUDE.md 의 "정보 저장 위치(단일 진실 원칙)" 및 `spec/conventions/redis-keys.md`
    Rationale "왜 인벤토리가 포인터만 갖나"(TTL·용도를 한 표에 모으면 이중 SoT 가 된다는 동일 계열 원칙)와
    같은 SoT-분리 규약의 구체 사례다.
  - 상세: `finalizeStalledExhausted`(`execution-engine.service.ts:3334`)는 BullMQ stalled-job 재배달
    attempts 소진(=워커 크래시) 시 Execution 을 **`FAILED`** + `error.code='WORKER_HEARTBEAT_TIMEOUT'`
    로 마감하는 함수다(코드 3348-3366행, `status: ExecutionStatus.FAILED` 직접 확인). 사용자 Stop 이나
    `AbortSignal` 과 무관 — §2.4 의 다른 다섯 행(노드 경계 재확인·turn 경계 재확인·park↔resume 짝 전이·
    top-level 취소 종결·retry 재진입 종결)은 전부 `cancelled` 보존을 다루는데, 이 행만 유일하게 `cancelled`
    가 아닌 `FAILED` 경로를 다룬다. 이 함수의 실제 SoT 는 [`4-execution-engine.md §7.1`](../../../../../spec/5-system/4-execution-engine.md#71-워커-크래시-복구--bullmq-stalled-job-target)
    (BullMQ stalled-job 복구 — `WORKER_HEARTBEAT_TIMEOUT`·attempts 소진 로직을 이미 상세히 서술)인데,
    이번 트랜잭션 원자화 변경은 **그 문서에는 전혀 반영되지 않았다** — `grep dataSource.transaction`
    결과 §7.1/§7.5 어디에도 없음을 확인했다. 반대로 "자매" 함수 `markWebChatIdleTimeout` 은 코드에서
    동일하게 "자매"로 묶이지만, 그 세부 서술은 node-cancellation.md 가 아니라
    [`data-flow/15-external-interaction.md:265`](../../../../../spec/data-flow/15-external-interaction.md)
    가 SoT 로 갖고 있다 — 즉 이 저장소의 기존 관례도 "코드 레벨 자매(구현 패턴 재사용)" 와 "spec 주제
    소속" 을 분리해 왔는데, 이번 신규 행만 그 관례를 깨고 구현 패턴 유사성만으로 무관한 문서에 편입됐다.
    추가로 §2.4 의 다른 모든 행은 §2.4 본문에 대응 bullet + 별도 `## Rationale` 하위 절(예: "왜 §2.4 는
    signal 이 아니라 DB 관측인가", "왜 짝 전이에 terminal 가드가 필요한가")을 갖는데, 신규 행은 표 한 줄만
    있고 대응 본문·Rationale 이 전혀 없어(`grep stalled` 결과 표 행 1곳뿐) 문서 자신의 §6 작성 패턴과도
    내부적으로 어긋난다.
  - 제안: 이 행과 상세 서술을 `spec/5-system/4-execution-engine.md` §7.1(워커 크래시 복구) 또는 그 절의
    Rationale 로 이전하고, node-cancellation.md 에서는 제거하거나(선호) 최소한 "§2.4 취소 관측" 라벨을
    떼고 "cancellation 이 아니지만 동일 원자성 패턴을 공유하는 자매 함수" 라는 별도 부록/각주로 명확히
    분리한다. `redis-keys.md` 가 "포인터만 갖는다"고 선언한 것처럼, node-cancellation.md 도 §6 표에는
    "cancellation 관련 항목만" 이라는 암묵 전제가 있으므로 그 전제를 지키거나, 지킬 수 없다면 §6 표 상단에
    "본 표는 cancellation 항목 + 참고용 인접 함수를 모두 포함한다" 는 식으로 문서 자체 스코프 선언을
    갱신해야 한다(CLAUDE.md "결정의 배경·근거는 Rationale" 원칙에 따라 이 재편입 결정도 Rationale 에
    남길 것).

- **[INFO]** node-cancellation.md 에 명시적 `## Overview` 섹션이 없음 (기존 결함, 이번 diff 로 신설되지 않음)
  - target 위치: `spec/conventions/node-cancellation.md` 문서 전체 구조 — `# Node Cancellation 컨벤션`
    제목 직후 바로 `## 1. 목적` 로 진입, `## Overview` 헤딩이 없다.
  - 위반 규약: CLAUDE.md "문서 구조 규약 — Overview / 본문 / Rationale 3섹션 권장". 같은 디렉토리의
    자매 conventions 문서(`audit-actions.md`, `redis-keys.md`, `error-codes.md`)는 전부 제목 직후
    `## Overview` 섹션을 명시적으로 둔다.
  - 상세: `## 1. 목적` 절이 사실상 Overview 역할을 하지만 헤딩 텍스트가 컨벤션과 다르다. 이번 PR 의
    diff(§6 표 1행)와는 무관한 선재 상태이므로 이번 변경이 새로 유발한 위반은 아니다.
  - 제안: 이번 PR 범위는 아니므로 필수 아님. 향후 node-cancellation.md 를 편집할 기회가 있으면
    `## 1. 목적` 을 `## Overview` 로 정렬하거나, 최소한 그 절이 Overview 역할을 한다는 점을 명시.

- **[INFO]** 리뷰 번들의 컨텍스트 예산 초과로 실제 변경분이 번들에 누락됨 — 리뷰 절차상 주의사항
  - target 위치: `_prompts/convention_compliance.md` 내 `spec/conventions/node-cancellation.md` 전문
    (라인 1986-2277 부근)이 git HEAD 상태만 반영하고, 워크트리의 미커밋 diff(§6 신규 1행)를 포함하지
    않았다. 같은 이유로 `spec/5-system/14-external-interaction-api.md` 등 15개 파일과
    `spec/conventions/` 268개 파일(주로 cafe24/makeshop 카탈로그)이 "컨텍스트 예산 초과" 로 본문 생략됨.
  - 위반 규약: 해당 없음(도구 한계) — 다만 "여기 없다는 사실을 '해당 내용이 없다'의 근거로 삼지 말 것"
    이라는 번들 자체의 경고를 따라 이번 리뷰는 파일을 직접 Read 로 열어 위 주 발견사항을 확보했다.
    후속 라운드에서 동일 패턴(번들=커밋 스냅샷, 워크트리=미커밋 diff 괴리) 발생 시 동일하게 직접 diff 를
    대조할 것을 권고.

## 요약

이번 턴의 실제 target 변경분은 `spec/conventions/node-cancellation.md` §6 표의 1행 추가뿐이다. 함수명
(`finalizeStalledExhausted`)·상태 심볼(✓)·표 형식 자체는 문서의 기존 표기 관례와 일치하고, 코드베이스의
실제 함수 시그니처·"자매" 명명(`cancelParkedExecution`/`markWebChatIdleTimeout`)과도 정확히 일치해
명명 규약 위반은 없다. 다만 이 행이 다루는 `finalizeStalledExhausted` 는 사용자 취소가 아니라 워커 크래시
(BullMQ stalled-job 소진) 로 인한 `FAILED` 종결을 다루는 함수로, node-cancellation.md 가 스스로 선언한
"cancellation 전용" 스코프 및 §2.4 "취소 관측 가드" 절의 정의와 주제가 다르다 — 이 저장소가 반복적으로
강조해 온 SoT 분리 원칙("자매 함수 = 구현 패턴 재사용"과 "spec 주제 소속"을 구분해야 한다는 기존 관례,
예: markWebChatIdleTimeout 은 data-flow/15 가 SoT)에 비추면 잘못된 문서에 등재된 것으로 보인다. 이 항목의
자연스러운 SoT 는 `4-execution-engine.md §7.1`(워커 크래시 복구)이나, 그 문서는 이번 트랜잭션 원자화
변경을 반영하지 않았다. 나머지 API/출력 포맷/Swagger 관련 규약(error-codes.md·swagger.md·redis-keys.md
cross-reference)은 이번 diff 범위 밖이며 표본 대조 결과 특이 위반은 발견되지 않았다.

## 위험도

MEDIUM
