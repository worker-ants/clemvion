### 발견사항

- **[WARNING]** Redis 키 세그먼트 `<endpoint>` 가 기존 확립 용어 `endpointPath` 와 혼동 가능
  - target 신규 식별자: `interaction:idempotency:<executionId>:<endpoint>:<key>` (제안 변경 1, L93/L98/L258 대상 — `spec/data-flow/15-external-interaction.md`)
  - 기존 사용처:
    - `spec/1-data-model.md:234` — `endpoint_path | String? | Webhook URL 경로 (type=webhook)` (Trigger 엔티티 컬럼)
    - `spec/1-data-model.md:881` — `Trigger | (workspace_id, endpoint_path) UNIQUE`
    - `spec/5-system/12-webhook.md` (다수, 예 L50 `WH-EP-02`, L89 `WH-MG-02`, L481 이하 "`endpointPath` 가변성 — webhook 은 mutable, schedule 만 frozen") — `endpointPath` 는 이 코드베이스에서 **webhook 트리거의 URL 경로 세그먼트**를 가리키는 확립된 단일 의미의 도메인 용어이며, mutable 하다는 점까지 별도로 문서화된 핵심 개념(프로젝트 메모리 `project_webhook_endpointpath_mutable.md` 도 존재)
    - `spec/5-system/14-external-interaction-api.md:1104` (R11) — "외부 endpoint 경로 prefix 분리" 처럼 "endpoint" 라는 일반 단어 자체도 이미 여러 의미(hooks 진입점 경로 / 외부 REST endpoint 일반 / outbound notification 대상 URL)로 중첩 사용 중
  - 상세: target 이 새로 도입하는 `<endpoint>` 세그먼트는 실제로는 **"어느 interaction 명령이 호출됐는가"**(`interact` vs `cancel`, 즉 축 2 에서 말하는 두 자리)를 구분하기 위한 discriminator 다. 그런데 같은 도메인(webhook/trigger)에 이미 `endpointPath` 라는, **의미가 전혀 다른**(트리거의 URL 경로, DB 컬럼, mutable) 확립된 용어가 광범위하게 쓰이고 있어, `<endpoint>` 라는 짧은 이름만 보고 "webhook 의 `endpointPath` 를 키에 넣는다" 로 오독할 여지가 있다. target 문서 자체도 `<endpoint>` 의 리터럴 값(예: `"interact"` 문자열 그대로인지, HTTP method 포함 전체 path 인지)을 명시하지 않아 이 오독 가능성을 더 키운다. 만약 구현 턴에서 이 세그먼트를 실제로 트리거의 `endpointPath` 값으로 채운다면, 하나의 트리거가 여러 execution 을 낳는 구조상 이 세그먼트가 축 2(같은 execution 내 interact/cancel 구분)를 전혀 해결하지 못하는 채로 스코프가 "고쳐졌다" 고 오인될 위험이 있다.
  - 제안: `<endpoint>` 대신 `<command>` 또는 `<action>` 처럼 이미 문서 내 dispatch 표(§1.2)에서 쓰는 어휘(`submit_form`/`click_button`/`cancel` 등 "command")와 정렬되는 이름을 쓰거나, 최소한 제안 변경 표에 세그먼트의 리터럴 값 규칙(예: `interact` | `cancel` 고정 문자열)을 한 줄 명시해 `endpointPath` 와 다른 개념임을 명확히 할 것.

### 요약

target 이 spec 에 새로 도입하는 식별자는 사실상 Redis 캐시 키 템플릿의 세그먼트 하나(`<endpoint>`)뿐이며, 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·환경변수/설정키·spec 파일 경로 축에서는 새로 부여되는 이름이 없어(기존 EIA-IN-11/EIA-RL-02 행 문구만 한정어를 추가) 직접적인 CRITICAL 급 충돌은 발견되지 않았다. 다만 그 유일한 신규 세그먼트명이, 이미 이 도메인에서 뚜렷하고 다른 의미로 굳어진 `endpointPath`(webhook 트리거 URL 경로, DB 컬럼)와 표면적으로 겹쳐 혼동 가능성이 있고 target 자체도 세그먼트의 정확한 값 규칙을 명시하지 않아 이 위험을 완화하지 않는다. 참고로 같은 두 spec 파일을 동시에 건드리는 병행 draft(`plan/in-progress/spec-draft-eia-r8-alignment.md`)가 존재하지만, 그 draft 는 명시적으로 `EIA-RL-02` 행 자체는 건드리지 않는다고 밝혀 두었고 실측상 라인 텍스트도 겹치지 않아(§R8 "무엇을 캐시하는가" vs 본 target 의 "어디에 캐시하는가") 실질적 편집 충돌은 없다.

### 위험도

LOW
