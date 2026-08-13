# Plan 정합성 검토 — `plan/in-progress/backend-lint-gate-broken-on-main.md`

## 사전 확인 — 이 라운드는 재검토다

target 은 직전 라운드(`review/consistency/2026/08/13/08_06_47/plan_coherence.md`)가 잡은 두
WARNING(① `spec/conventions/redis-keys.md` 죽은 링크 — 미머지 `#1160` 이 만드는 파일을
전방 참조 ② `statusCode` 유효 HTTP 범위 검증을 "이미 한다" 고 SoT 에 사실로 적음 — 실제
코드는 `typeof === 'number'` 뿐)에 대한 수정판이다. 두 항목 모두 현재 uncommitted diff에서
**해소를 확인했다**:

- `grep -rn redis-keys spec/` — 0건. 링크는 `4-execution-engine.md#91-키-패턴` (유효 앵커,
  heading 실재 확인)로 교체됐다.
- `spec/5-system/14-external-interaction-api.md:1068` — "`statusCode` 는 현재 **타입만**
  검사한다(`typeof === 'number'`) — 값 범위는 아직 보지 않는 **선재 갭**이다" 로 정정. 실제
  코드(`idempotency.interceptor.ts` `isIdempotencyEntry()`, `typeof e.statusCode === 'number'`
  만 검사, 범위 비교 없음)와 대조해 **일치**를 확인했다. 같은 파일 docstring 의 "다섯 경로 표"
  (63-71행)도 `data-flow/15` §Rationale 의 "warn 은 다섯 경로 중 넷" 서술과 문구·개수·예외
  대상(경로 1)까지 정확히 일치한다.

## 발견사항

### [WARNING] 새로 추가한 §9.1 인용이, 같은 문서가 아직 열어 둔 "EIA 키는 그 레지스트리에 없다" 항목과 나란히 있으면 오독을 만든다

- target 위치: `spec/data-flow/15-external-interaction.md` §4 외부 의존 표(현재 308행,
  uncommitted) — "Redis | 내부 | blacklist · idempotency · seq · BullMQ. **미가용 또는 캐시
  손상** 시 fail-open — 가용성 우선. 경로마다 warn 을 남기되 **기동 시 미주입(설정 상태)만
  예외** ([실행 엔진 §9.1](../5-system/4-execution-engine.md#91-키-패턴) · 아래 §Rationale)"
- 관련 plan: 같은 target 문서(`backend-lint-gate-broken-on-main.md`) §후속의 **아직 열린
  항목** — "**EIA 계열 Redis 키가 실행 엔진 §9.1/§9.2 키 레지스트리에 없다**" (`- [ ]`,
  `19_56_51` convention_compliance INFO 4): "`4-execution-engine.md` §9.1 은 '**모든** Redis
  키는 `{service}:{workspaceId}:{resource}:{id}:{sub}` 를 따른다' 고 선언하고 … 등재하는데,
  `interaction:idempotency:*` 와 `iext:blacklist:<jti>` 등 **EIA 계열이 통째로 빠져 있다**"
- 상세: 직전 라운드가 지적한 죽은 링크(`conventions/redis-keys.md`)는 "가장 빠른 수정" 으로
  §9.1 앵커로 교체됐고, 그 교체 자체는 유효한 앵커를 가리키므로 `spec-link-integrity` 관점에서는
  옳다. 다만 §9.1 은 "Redis 키 네이밍 컨벤션 — 9.1 키 패턴" 섹션으로, 실제 내용은 키 **형태**
  규칙(`{service}:{workspaceId}:...}`)뿐이고 "기동 시 미주입만 warn 예외" 라는 **fail-open
  동작**에 대해서는 아무것도 말하지 않는다(직접 확인 — §9.1/§9.2 본문에 `interaction:idempotency`·
  `iext:blacklist`·"미주입"·`IdempotencyInterceptor` 언급 0건). 그리고 그 섹션이 지금
  다루고 있는 "모든 Redis 키" 목록에는 바로 이 표가 인용하는 EIA 계열 키들이 **없다** — 이
  사실을 target 자신이 같은 문서 안에서 아직 미해결 항목으로 등재해 뒀다. 즉 이 인용은 (a)
  인용 지점 바로 옆 문장의 근거가 되지 못하고 (b) 링크를 따라간 독자가 "이 키들이 §9.1 아래
  등록돼 있(을 것이)다" 로 오인할 여지를 만드는데, 그 오인은 같은 plan 문서가 이미 반증해
  둔 것이다. `spec/**` → `plan/in-progress/**` 링크 금지 컨벤션(이 문서 다른 자리에서 이미
  준수 중 — "링크가 아니라 서술로 적었다") 때문에 이 모순을 spec 쪽에서 자체적으로 드러낼
  방법이 없다는 점도 위험을 키운다.
- 제안: 다음 중 하나. (1) §9.1 링크를 이 문장에서 제거하고 "아래 §Rationale" 만 남긴다 —
  그쪽은 이미 다섯 경로·예외 근거를 정확히 서술하므로 그것으로 충분하다. (2) 링크를 유지하려면
  "키 **형태** 컨벤션 참고용이며, 이 EIA 계열 키는 아직 그 레지스트리에 등재되지 않았다(별도
  항목)" 정도로 한정해, target 이 스스로 열어 둔 미해결 항목과 spec 인용이 서로 다른 말을
  하지 않게 맞춘다. 우선순위는 낮다 — 죽은 링크나 "보장이 구현보다 넓다" 류와 달리 게이트를
  깨거나 사실을 오도하는 **단정문**은 아니고, 인접 배치로 인한 **암시**의 문제다.

## 요약

target(`backend-lint-gate-broken-on-main.md`)의 이번 uncommitted 편집(`eia-failopen-wording`
planner 턴, `spec/data-flow/15-external-interaction.md`·`spec/5-system/14-external-interaction-api.md`
4자리)은 직전 라운드가 잡은 두 WARNING(미머지 PR 이 만드는 파일로의 죽은 링크, 구현보다 넓은
`statusCode` 범위 보장 주장)을 실측으로 확인 가능한 수준까지 정확히 정정했다 — 코드
docstring 과 spec 서술이 "다섯 경로 중 넷 warn" 프레이밍까지 일치한다. 다른
`plan/in-progress/**` 문서(`spec-draft-eia-r8-alignment.md`·`spec-sync-external-interaction-api-gaps.md`
등)와의 결정 충돌이나 선행조건 미해소는 발견되지 않았고, 오히려 이번 편집이 참조하는 미해결
백로그 항목(`readKey`/`hashBody` 경계값·`isIdempotencyEntry` 값 범위)과의 정합도 정확하다.
다만 정정 과정에서 새로 붙인 §9.1 인용 하나가, target 이 같은 문서에서 이미 열어 둔 "EIA 키가
§9.1/§9.2 레지스트리에 없다" 미해결 항목과 인접 배치로 인해 오독 소지를 만든다 — 게이트를
깨거나 사실을 단정하는 수준은 아니라 WARNING 으로 남긴다.

## 위험도
LOW
