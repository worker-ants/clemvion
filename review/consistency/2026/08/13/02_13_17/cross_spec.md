# Cross-Spec 일관성 검토 — spec-draft-redis-key-registry

대상: `plan/in-progress/spec-draft-redis-key-registry.md` (spec draft, --spec 모드)

> 프롬프트 조립이 컨텍스트 예산 초과로 target 의 `spec_impact` 4개 중 3개
> (`4-execution-engine.md` · `14-external-interaction-api.md` · `data-flow/15-external-interaction.md`)
> 를 포함한 112개 파일 본문을 생략했다. 아래 검토는 해당 파일들을 `Read`/`grep` 로 직접
> 열고 코드베이스 실측(redis 호출 리터럴 grep, `app.module.ts`, `ws-rate-limiter.service.ts`)
> 으로 교차 검증한 결과다.

## 발견사항

- **[WARNING]** `exec:seq:<executionId>` 소유 모듈 오분류 — 신설 `redis-keys.md` 의 `code:` glob 이 실제 구현 파일을 누락한다
  - target 위치: Overview 실측 표(①, "owner=실행 엔진" 열) 및 "제안 변경 1." 의 frontmatter 계획
    ("`code:` 는 키를 소유한 6개 모듈 다중 glob(execution-engine · external-interaction ·
    chat-channel · hooks · integrations · common/redis)")
  - 충돌 대상: 코드 실측 — `codebase/backend/src/modules/websocket/execution-seq-allocator.service.ts`
    (`SEQ_KEY_PREFIX = 'exec:seq:'`), `modules/execution-engine/execution-engine.service.ts` 에는
    `exec:seq`/`ExecutionSeqAllocator` 참조가 전혀 없음(grep 0건)
  - 상세: target 의 실측 표는 `exec:recover:lock` · `exec:cont:seq:<id>` · `exec:seq:<id>` 셋을
    한 행으로 묶어 "소유=실행 엔진" 이라 표기했다. 실제로는 앞 둘만 `modules/execution-engine`
    소속이고, `exec:seq:<id>`(`ExecutionSeqAllocator`)는 `modules/websocket/` 소속이다
    (`websocket.service.ts`/`websocket.module.ts` 가 호출). 이 오분류는 기존
    `4-execution-engine.md` 자체의 frontmatter `code:` (`modules/execution-engine/**` ·
    `shared/execution-resume/**` · frontend ws 파일 2개)에도 이미 있던 pre-existing 갭이지만,
    이번 draft 는 이를 새 SoT 문서(`spec/conventions/redis-keys.md`)에 그대로 상속시킨다 —
    계획된 6-모듈 glob 리스트에 `modules/websocket` 이 없다. `spec-code-paths.test.ts` 는 glob 이
    ≥1 파일만 매치하면 통과하므로 빌드는 깨지지 않지만, "이 컨벤션 문서가 소유 키의 구현 증거"
    라는 문서의 목적 자체가 `exec:seq` 항목에 대해서는 성립하지 않는다.
  - 제안: 6-모듈 glob 에 `codebase/backend/src/modules/websocket/execution-seq-allocator.service.ts`
    (또는 `modules/websocket/**` 일부)를 추가하거나, 최소한 실측 표의 "owner" 열에서
    `exec:seq:<id>` 를 별도 행으로 분리해 실제 소유 모듈을 정확히 적는다.

- **[WARNING]** §9.1 재작성 후 같은 파일 안에 남는 옛 패턴 문자열 2곳이 댕글링 참조가 된다
  - target 위치: "제안 변경 2." 표 — "§9.1 '모든 Redis 키는 …' → 규약 문서 참조로 대체"
  - 충돌 대상: `spec/5-system/4-execution-engine.md:1179` (§9.2 각주) ·
    `spec/5-system/4-execution-engine.md:1183` (§9.3 도입부) — 둘 다 `§9.1 의
    {service}:{workspaceId}:{resource} 패턴` 문자열을 그대로 인용한다
  - 상세: target 은 §9.1 본문(패턴 선언 자체)을 규약 문서(`redis-keys.md`, 새 패턴
    `{도메인}:{용도}:{식별자}`) 참조로 통째로 교체할 계획이다. 그런데 `{service}:{workspaceId}:
    {resource}` 라는 정확히 그 문자열이 같은 파일의 §9.2 각주(line 1179, "전역 키 …는 §9.1 의
    `{service}:{workspaceId}:{resource}` 패턴을 따르지 않는다")와 §9.3 도입부(line 1183, "BullMQ
    가 내부적으로 사용하는 Redis 키 … 는 §9.1 의 `{service}:{workspaceId}:{resource}` 패턴 범위
    밖이다")에도 등장한다. 체크리스트는 §9.1/§9.2 편집 항목에서 "heading 텍스트 보존"만 명시하고
    이 두 인라인 인용은 언급하지 않는다. §9.1 본문이 그 패턴 문자열을 더 이상 담지 않게 되면, 이
    두 문장은 삭제된 텍스트를 가리키는 근거 없는 참조로 남는다 — 같은 문서 내부의 직접 모순이다.
  - 제안: 체크리스트에 "§9.2 각주(line ~1179)·§9.3 도입부(line ~1183)의 `{service}:{workspaceId}:
    {resource}` 인용을 새 규약 문서 참조(`§9.1` 또는 `conventions/redis-keys.md`)로 함께 갱신"
    항목을 추가한다.

- **[INFO]** §9.2 앵커 인바운드 참조 수가 target 자체 실측과 다르다(결론은 불변)
  - target 위치: 체크리스트 "INFO 2·7" 처분 행 — "실측: §9.1 1건 · §9.2 3건(14-external-interaction-api.md
    2건 · data-flow/3-execution.md 1건)"
  - 충돌 대상: 실제 grep 결과 — `#92-용도별-키-정의-및-ttl` 인바운드는
    `14-external-interaction-api.md` **3건**(line 156, 1051, 1070) + `6-websocket-protocol.md`
    **1건**(line 106, target 표에서 누락) + `data-flow/3-execution.md` 1건 = **총 5건**
    (target 은 3건으로 집계). `#91-키-패턴` 은 `conventions/execution-context.md` 1건으로 target
    수치와 일치.
  - 상세: heading 보존이라는 결론 자체는 바뀌지 않으며 오히려 실제 인바운드가 더 많아 결론을
    강화한다. 다만 "실측했다"고 명시한 수치가 자체적으로 부정확하고, `6-websocket-protocol.md`
    가 인바운드 목록에서 통째로 빠졌다 — 이 문서는 `spec_impact` 에도 없어 이번 편집 대상은
    아니지만, 향후 §9.2 본문을 손대는 작업에서 실측 목록을 그대로 재사용하면 같은 누락이
    반복된다.
  - 제안: 체크리스트 각주 수치를 "§9.2 5건(14-ext 3 · 6-websocket-protocol 1 · data-flow/3-execution 1)"
    로 정정.

- **[INFO]** data-flow/15 §2.2 의 `exec:seq` 중복 등재를 "이미 겪은 결함의 증상"으로 규정한 Rationale 이 기존 data-flow 문서 컨벤션과 어긋난다
  - target 위치: Rationale "왜 단일 표로 합치지 않는가" — "이 저장소가 이미 겪은 형태다 — exec:seq
    가 두 문서에 중복 등재돼 있는 것이 그 증상이다"
  - 충돌 대상: `spec/data-flow/0-overview.md` §3.3 "Schema 매핑 표" — "데이터 객체별로 다음 표를
    둔다 … Redis: BullMQ 큐 이름·repeat job key·캐시 key 패턴" (해당 도메인이 실제로 건드리는
    모든 Sink 를 나열하는 것이 이 표의 설계 목적)
  - 상세: `data-flow/15-external-interaction.md` §2.2 는 정확히 이 §3.3 패턴을 따르는 표이고,
    그 안의 `exec:seq:<executionId>` 행은 "EIA 가 이 키를 소비/공유한다"는 사실을 알리는 정상
    항목이다(§3.6 RBAC 요약처럼 "요약표 아래에 SoT 링크를 반드시 단다"는 규정은 §3.3 표엔 없다 —
    §3.6 전용). 즉 이 중복은 이 저장소가 "이미 겪은 결함"이 아니라 data-flow 문서군의 의도된
    설계다. "포인터-only 신규 인벤토리" 결론 자체는 여전히 타당하지만(전역 인벤토리가 TTL·정책
    상세까지 다 옮겨 적으면 진짜 이중 SoT 가 되는 것은 맞다), 근거로 든 비유가 정확하지 않다.
  - 제안: Rationale 문구를 "data-flow 문서는 원래 해당 도메인이 건드리는 sink 를 전부 요약
    나열한다(§3.3) — 신설 전역 인벤토리가 상세까지 옮겨 적으면 그 요약들과 별개로 세 번째
    SoT 가 생긴다"는 식으로 정정하면 근거가 더 정확해진다. 급하지 않음.

## 요약

핵심 제안(신설 `spec/conventions/redis-keys.md` 를 pointer-only SoT로 두고, `4-execution-engine.md`
§9.1/§9.2 를 실측에 맞게 정정하며, EIA rate-limit 3키 리터럴을 `14-external-interaction-api.md`
§8.4 에 추가)은 코드베이스 실측(redis 호출 리터럴 grep, `app.module.ts` 의 `ThrottlerModule.forRoot`
in-memory 설정, `ws-rate-limiter.service.ts` 의 "Redis 없이" 주석, `cc:rl:`/`cafe24:install:*`
기존 spec 리터럴)과 전부 부합하며 phantom 항목(`core:`/`ws:`) 부재·`background:run:` 이 WS 채널
전용(Redis 미경유)이라는 핵심 정정도 코드로 재확인된다. 다만 신설 문서의 `code:` glob 계획이
`exec:seq:<executionId>` 의 실제 소유 모듈(`modules/websocket`)을 빠뜨렸고, §9.1 본문을 규약
문서 참조로 교체하면 같은 파일 안의 §9.2 각주·§9.3 도입부에 남는 옛 패턴 문자열 2곳이 댕글링
참조가 되는데 체크리스트가 이를 다루지 않는다 — 둘 다 CRITICAL 은 아니지만 반영하지 않으면
이번 정정 작업 직후 새로운 (더 작은) 형태의 "선언과 실제가 다른" 문제를 재생산한다. 나머지는
target 자신의 실측 수치·Rationale 비유의 정확도에 관한 INFO 성격이다.

## 위험도

MEDIUM
