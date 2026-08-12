# Plan 정합성 검토 — `plan/in-progress/backend-lint-gate-broken-on-main.md`

## 발견사항

### [WARNING] 방금 "완료"로 표시한 spec 편집이 죽은 링크를 만든다 — `conventions/redis-keys.md` 부재

- target 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md` §후속 "`data-flow/15` 의
  '전 경로 fail-open (warn)' 이 실제보다 한 칸 넓다" 항목의 "**완료 (2026-08-13, planner 턴
  `eia-failopen-wording`)**" 서술 (현재 uncommitted diff, `git diff -- plan/in-progress/...`
  로 확인 — 방금 `[ ]` → `[x]` 로 바뀐 바로 그 항목)
- 관련 plan: 같은 target 문서 §후속의 아직 열린 항목 — **"EIA 계열 Redis 키가 실행 엔진
  §9.1/§9.2 키 레지스트리에 없다"** (`- [ ]`, "spec_impact 에 `4-execution-engine.md` 가
  추가되는 planner 작업" 로 명시)
- 상세: `eia-failopen-wording` 턴이 고친 4자리 중 하나인
  `spec/data-flow/15-external-interaction.md` §4 "외부 의존" 표(현재 308행, uncommitted)가
  다음 링크를 새로 추가했다:
  ```
  ([`conventions/redis-keys.md`](../conventions/redis-keys.md) · 아래 §Rationale)
  ```
  그런데 `spec/conventions/redis-keys.md` 는 저장소에 **존재하지 않는다**
  (`ls spec/conventions/` 확인 — 근접한 파일 없음). 저장소 전체에서 `conventions/redis-keys.md`
  를 참조하는 곳은 이 한 줄뿐이다(`grep -rn` 확인). 실제 Redis 키 컨벤션의 SoT 는
  `spec/5-system/4-execution-engine.md §9.1`(`### 9.1 키 패턴`, 1144행)이고, 다른 문서들은
  전부 그쪽을 정확한 앵커로 링크한다(예: `spec/conventions/execution-context.md:62` 의
  `[execution-engine §9.1](../5-system/4-execution-engine.md#91-키-패턴)`). 즉 이번 편집은
  **아직 존재하지 않는 문서를 마치 있는 것처럼 전방 참조**했다 — 정확히 target 자신이 아직
  열어 둔 "EIA Redis 키가 §9.1/§9.2 레지스트리에 없다" 항목이 해소돼야 채워질 자리다.
  이 저장소에는 이 정확한 결함 클래스를 잡는 자동 가드가 있다 —
  `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` 가 `spec/**.md` 의
  모든 상대 링크 대상 파일 존재를 검사하며, 지금 상태로 커밋하면 그 테스트가 DEAD link 로
  실패한다.
- 제안: 링크를 실제 SoT 인 `[execution-engine §9.1](../5-system/4-execution-engine.md#91-키-패턴)`
  로 정정하거나(가장 빠른 수정), 아니면 아직 열린 "EIA Redis 키 레지스트리 통합" planner
  항목을 먼저 집행해 `spec/conventions/redis-keys.md` 를 실제로 만든 뒤 링크를 건다. 전자가
  이번 편집의 즉시 커밋을 막지 않는 가장 싼 경로다.

### [WARNING] 같은 편집이 target 자신의 아직 열린 항목과 상충하는 "보장"을 spec 에 적었다 — `statusCode` 범위 검증은 구현되어 있지 않다

- target 위치: `spec/5-system/14-external-interaction-api.md` §R8 Rationale, 1068행
  (uncommitted, 같은 `eia-failopen-wording` 편집): "`statusCode` 는 타입뿐 아니라 **유효 HTTP
  범위**(100~599 정수)까지 본다 — `res.status(-1)` 이 전송 시점 `RangeError` 로 같은 500 을
  만들기 때문이다."
- 관련 plan: 같은 target 문서(`backend-lint-gate-broken-on-main.md`) §후속의 아직 열린 항목
  684행 — "**`readKey`/`hashBody` 경계값 테스트 부재**" 항목 안: "`isIdempotencyEntry()` 가
  `statusCode` 를 `typeof === 'number'` 로만 보고 **값 범위를 안 본다** — 음수·0 같은 비-HTTP
  코드가 `res.status()`/`HttpException` 으로 그대로 흘러간다" (`- [ ]`, 이 PR 범위 밖으로
  명시 유예)
- 상세: 실제 구현(`codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:370-378`)
  을 열어 확인:
  ```ts
  function isIdempotencyEntry(value: unknown): value is IdempotencyEntry {
    if (value === null) return false;
    const e = value as Record<string, unknown>;
    return (
      typeof e.bodyHash === 'string' &&
      typeof e.responseJson === 'string' &&
      typeof e.statusCode === 'number'
    );
  }
  ```
  `typeof === 'number'` 검사뿐이고 100~599 범위 검사는 어디에도 없다 — target 자신의 열린
  체크리스트 항목이 적은 그대로다. 그런데 같은 커밋 단위 안에서 SoT spec 문서(`5-system/14`
  §R8)에는 이미 범위까지 검사한다고 **사실로 단정**해 적었다. 이는 이 저장소가 이미 3번
  반복해 학습한 "**문서한 보장이 구현보다 넓다**" 결함 클래스의 재발이며(메모리
  `feedback_documented_guarantee_wider_than_built.md` — 같은 브랜치 3회, 매번 테스트로 반증됨),
  이번이 **같은 브랜치의 4번째 사례**다. 위험 성격도 가볍지 않다 — 이 항목이 닫으려던 바로 그
  축("캐시 엔트리 손상"에 의한 500 유출)이 `statusCode` 가 비정상 정수(음수 등)로 손상된
  경우에는 **아직 열려 있는데**, spec 은 이미 닫혔다고 말한다. 다음 사람이 spec 만 읽고
  "범위 검증은 이미 있다" 고 오판할 수 있다.
- 제안: spec 문장에서 "유효 HTTP 범위(100~599 정수)까지 본다" 부분을 지우거나, "값 범위는
  아직 검사하지 않는다(`isIdempotencyEntry()` 는 타입만 확인 — 선재 갭, 별도 항목에서 추적)"
  로 정정한다. 대안으로 이 참에 `isIdempotencyEntry()` 에 실제로 100~599 범위 검사를 추가해
  구현을 spec 에 맞추고 target 의 684행 체크박스를 함께 닫는 방법도 있다 — 어느 쪽이든
  **spec 과 target 의 열린 체크박스가 서로 다른 말을 하는 현재 상태**는 커밋 전에 하나로
  맞춰야 한다.

## 요약

target 문서(`backend-lint-gate-broken-on-main.md`)는 매우 성숙하고 자기참조적인 대형 plan 으로,
과거 다수 라운드의 consistency-check·ai-review 가 잡은 결함을 꼼꼼히 재확인·정정해 왔다. 다른
`plan/in-progress/**` 문서들(특히 `spec-draft-eia-r8-alignment.md`·`spec-draft-eia-idempotency-key-scope.md`(complete)·`execution-engine-residual-gaps.md`)과의 결정 충돌이나 선행조건 미해소는 발견되지
않았다 — 오히려 완료된 spec-draft plan 들이 target 의 후속 항목을 정확히 등재해 두는 등 교차
동기화가 잘 되어 있다. 다만 **오늘(2026-08-13) 방금 완료 처리된 마지막 편집 자체**(uncommitted,
`eia-failopen-wording` planner 턴)에서 두 가지 자기모순이 발견됐다: (1) target 이 아직 열어 둔
"EIA Redis 키 레지스트리 통합" 항목의 해소를 전제로 하는 죽은 링크를 새로 만들었고(자동
`spec-link-integrity` 가드가 커밋 시점에 이를 잡을 것), (2) target 이 아직 열어 둔 `statusCode`
범위 검증 부재 항목과 정면으로 모순되는 "이미 검증한다" 는 문장을 SoT spec 에 사실로 적었다 —
이 저장소가 같은 브랜치에서 이미 3회 겪은 "문서한 보장이 구현보다 넓다" 클래스의 4번째 사례다.
둘 다 커밋 전 수정이 필요하다.

## 위험도
MEDIUM
