---
worktree: trigger-canary-hardening-a71e04
started: 2026-09-14
owner: developer
spec_impact: none
---

# 트리거 캐너리 하드닝 — 2026-09-10 그루밍 배치의 잔여 4건

트래커(`spec-draft-nullable-notation-followups.md`)의 **2026-09-10 등재 4건**을 닫는다.
넷은 같은 표면(트리거 응답의 비밀 컬럼 · `workflow` 관계 · 캐너리 두 파일 · e2e teardown)을
가리키고, 전부 *"동작은 지금 맞는데 **방어가 없다**"* 형태다.

| # | 항목 | 성격 |
|---|---|---|
| 1 | 트리거 비밀 컬럼 목록이 3중 독립 사본 | 드리프트 위험 (결속 없음) |
| 2 | `TriggerDto.workflow` (`type:'schedule'`) 양성 커버리지 0건 | 회귀 방어 구멍 |
| 3 | 캐너리 두 파일의 주석 표기·성격 | 정리 3건 |
| 4 | e2e teardown 이 `secret_store` 고아 row 를 남긴다 | 관례 + 근거 정정 |

## A. 착수 전 전제 실측 — 넷 다 성립한다

트래커 항목의 *"왜 필요한가"* 가 측정 가능한 주장이면 착수 전에 프로브한다. 넷 다 돌렸고,
**반증된 것은 없다.** (반증됐다면 그 자리에 다른 결함이 있는지부터 봤을 것이다.)

### 1 — 비밀 컬럼 3중 사본

| 자리 | 값 |
|---|---|
| 정본 `triggers.service.ts` 의 `TRIGGER_RESPONSE_STRIP_COLUMNS` (비-export) | `['notificationSecretV2', 'chatChannelTokenV2']` |
| `shared/testing/schedule-trigger-ref.ts` 의 `TRIGGER_SECRET_COLUMNS` | 동일 |
| `shared/testing/trigger-workflow-ref.ts` 의 `TRIGGER_SECRET_COLUMNS` | 동일 |

**값·순서 완전 일치. 결속 장치 0.** 정본이 세 번째 비밀 컬럼을 더해도 두 헬퍼는 조용히 통과한다.

> **self-spec 의 네 번째 사본은 대상이 아니다** — `trigger-workflow-ref.spec.ts` 가 같은
> 이름들을 또 적는 것은 **일부러**다(헬퍼 상수를 import 해 순회하면 목록을 줄여도 스펙이
> 통과해 대조군이 사라진다). 헬퍼↔프로덕션 중복은 드리프트, **스펙↔헬퍼 중복은 독립 대조군**.

### 2 — schedule 의 `workflow` 양성 커버리지 — **표면이 둘이다**

**첫 판에 이 항목을 너무 넓게 적었다.** *"schedule 의 `workflow` 양성 커버리지 0"* 이라
썼는데, 실측하면 표면이 **둘**이고 하나는 이미 덮여 있다:

| 표면 | 응답 DTO | 헬퍼 | 실측 |
|---|---|---|---|
| 스케줄 응답의 중첩 트리거 | `ScheduleDto.trigger.workflow` | `expectNarrowedScheduleTriggerRef` | **양성 3 + 음성 1** |
| 트리거 목록·수정 | `TriggerDto.workflow` (`type:'schedule'`) | `expectTriggerWorkflowRef` | **0건** |

첫 행은 `schedule-trigger.e2e-spec.ts` 안에서 `withWorkflow: true` 3회 · `false` 1회로
이미 고정돼 있다 — **`3-schedule.md` §4 註가 주장하는 *"네 응답 형태를 양성 3 + 생성 음성
대조 1 로 고정"* 과 정확히 일치한다.**

> **`--impl-prep` 의 INFO#3 은 반증됐다.** checker 는 *"항목 2 는 §4 가 이미 주장한
> 계약의 **미이행분**을 채우는 작업"* 이라고 했는데, 그 주장은 **이미 이행돼 있다.**
> 내가 처음 `expectTriggerWorkflowRef` **하나만** 세어 0 을 본 것과 같은 실수다 —
> **같은 개념에 헬퍼가 둘**이고 한쪽만 세면 «주어» 를 놓친다.

빠진 것은 **둘째 행**이다. C-2 본문 확인: `cron`·`timezone`·`nextRunAt` +
`assertMatchesContract(row, TriggerDto)` 뿐이고 `workflow` 를 안 본다. §5.4 키 생략형이라
계약 검증자는 부재를 위반으로 보지 않는다. 같은 표면의 `TriggerDto` 응답이 이 파일에 셋 있다:

| 케이스 | 경로 | 처분 |
|---|---|---|
| C-2 | `GET /api/triggers?type=schedule` (목록) | `present: true` |
| G | `PATCH /api/triggers/:id` `isActive:false` | `present: true` |
| H | `PATCH /api/triggers/:id` `isActive:true` | `present: true` |

**음성 대조는 이 표면에 없다** — schedule 트리거는 `POST /api/triggers` 로 만들지 않으므로
`TriggerDto` 생성 응답 자체가 존재하지 않는다. 트래커 항목이 *"비용은 두 줄"* 이라 적었는데
**실측하면 세 줄**이고, 음성이 빠지는 이유를 함께 적어야 다음 사람이 *"음성 대조가 없다"* 를
결함으로 다시 등재하지 않는다.

### 3 — 캐너리 주석 표기

`trigger-workflow-ref.spec.ts` 헤더가 마스터 목록을 **원문자 ①~⑨** 로 적고, 케이스 헤딩
하나(`## 가드 ③·⑤`)만 원문자다 — 나머지 케이스 헤딩은 아라비아. `grep '가드 [0-9]'` 로
그 케이스가 안 잡힌다.

### 4 — e2e teardown

`DELETE FROM` 을 쓰는 e2e **9파일**(실측). 그중 트래커가 지목한 둘
(`chat-channel-trigger-create` · `trigger-workflow-ref`)이 `secret_store` row 를 만든다.
`secret_store` 는 FK 가 없어 raw `DELETE FROM trigger` 로는 안 지워진다.

## B. 무엇을 하고 무엇을 안 하나

- **1** → repo-guard 로 세 목록 동일성 강제. 정본이 `export` 가 아니고 서비스 모듈을 테스트
  헬퍼로 끌어오는 것은 의존 그래프상 과하므로 **런타임 공유가 아니라 정적 가드**다.
  선례: `CREATOR_PROJECTION`(동일 리터럴 4중 복사가 실제 Critical 로 터진 뒤 통합).

  > **첫 판에 «blind 정규식이 맞는 자리» 라고 적었다가 형제 가드를 읽고 뒤집었다.**
  > 이 저장소의 backend repo-guard 는 **AST** 를 쓰고 그 이유를 명시한다 —
  > `redis-fail-open-catalog-guard.ts`: *"주석 안의 예시나 JSDoc 의 문자열이 값으로 잡히면
  > 가드가 자기 오판을 사실로 굳힌다."* 판별 기준은 «유한한가» 가 아니라
  > **«대상에 진짜 문법 + 정본 파서가 있는가»** 이고, TS 소스는 둘 다 있다.
  >
  > **세 선언의 형태가 다르다** — 정본만 `as const satisfies readonly (keyof Trigger)[]`,
  > 헬퍼 둘은 `as const`. `as const` 만 벗기는 리더는 **정본에서 조용히 0건**을 낸다.
  > 그것이 이 가드의 판별 fixture 다.
- **2** → `schedule-trigger.e2e-spec.ts` 의 **`TriggerDto` 를 받는 세 케이스**(C-2 목록 ·
  G·H PATCH)에 `expectTriggerWorkflowRef(…, { present: true, expectedWorkflowId })`.
  헬퍼 JSDoc 이 *"목록·단건·수정은 채운다, 생성만 `false`"* 를 이미 계약으로 적고 있고,
  이 파일에 **단건 `GET /api/triggers/:id` 는 없다** — 그래서 셋이다(§A.2 표).
  `expectedWorkflowId` 를 넘겨 identity 까지 고정한다 — shape 만 보면 *엉뚱한 relation 에서
  채워진 그럴듯한 UUID+이름* 이 통과한다(헬퍼 JSDoc 이 인용하는 선례).
- **3** → 트래커가 등재한 세부는 **셋**이다. 첫 판에 ①② 만 적어 ③ 이 빠져 있었다
  (`--impl-prep` plan_coherence WARNING#5). 셋 다 한다:
  - ① **표기 통일** + *"어느 표기가 어디 쓰이는지"* 한 문장.
  - ② **리뷰 이력 서술**을 소스에서 빼고 RESOLUTION·커밋·트래커로.
    **판별 질문**: *"이 문장이 없으면 다음 사람이 코드를 잘못 쓰는가."*
  - ③ 인용 `"keys [] ≠ ['id','name']"` 이 Jest 실제 출력의 리터럴이 아니라 **의역**이다 —
    의역임을 표시하거나 실제 출력 형태로 교체.
- **4** → **실측했고 (b) 로 확정했다.** 두 측정이 (a) 를 기각한다:

  | 경계 | 측정 | 결과 |
  |---|---|---|
  | 세션 «간» | `make e2e-test` 는 항상 `e2e-down` = `docker compose down -v` | **볼륨째 삭제** → 고아 row 누적 없음 |
  | 세션 «안» | `secret_store` 를 읽는 유일한 e2e(`secret-store-like-prefix`) | `ref LIKE <자기 접두>` 로 **스코프됨** → 간섭 없음 |

  (a)(서비스 경로 삭제)는 teardown 에 **외부 provider 호출**(`teardownChatChannel`)과 인증
  의존을 더한다 — `remove()` 실측으로 확인. 이득 없이 취약해진다.

  > **정정할 것은 관례가 아니라 근거다.** 두 e2e 의 `afterAll` 주석이 *"row 정리 불필요를
  > `secret_store` 까지 검증한 것으로 오인하지 말 것"* 이라 적고 있는데, 이제 **검증됐다.**
  > 그 문장을 «미검증» 에서 «검증됨 + 두 경계» 로 올린다.
  >
  > `secret-store.md §R4`(*"explicit application 경로 정리, implicit cascade 기각"*)와
  > 충돌하지 않음을 함께 적는다 — R4 는 **프로덕션 삭제 경로**의 규율이고 여기는 **테스트
  > 인프라 한정**이다. 그 한정을 안 적으면 나머지 7개 e2e 로 *"정리 안 해도 된다"* 가
  > 번진다 (`--impl-prep` rationale_continuity INFO#2).

**하지 않는 것**: `SecretResolver.rotate` 빈 값 가드(별 항목, 호출부 전수 선행) ·
커서 디코더 클러스터(계약 통일이 **제품 결정** 선행) · `spec/` 편집(권한 밖).

## 체크리스트

- [x] `/consistency-check --impl-prep` — `review/consistency/2026/09/14/10_44_37`
      **BLOCK: NO** (Critical 0 · WARNING 5 · MEDIUM). `[CRITICAL]` 마커 실측 0건.

      | # | 처분 |
      |---|---|
      | W4 트래커 체크박스 동기화 단계 부재 | **수용** — 아래 체크리스트에 추가 |
      | W5 캐너리 세부 ③ 누락 | **수용** — §B.3 에 추가 |
      | W1 번들이 spec 387개 중 380개를 절단 | **등재** — 관점 2/4 는 *"문제 없음"* 이 아니라 **미검증**이다. 기록된 `feedback_consistency_spec_mode_budget` 보다 범위가 넓다(conventions 가 아니라 spec 트리 전체) |
      | W2·W3 `cafe24-api-catalog/_overview.md` frontmatter·`__` 표기 | **planner 권한** — 등재 |
      | INFO#3 *"§4 양성 3 주장이 미이행"* | **반증** — §A.2 참조. 이미 이행돼 있다 |
- [x] 1 — 비밀 컬럼 repo-guard — `trigger-secret-columns-{guard.ts,spec.ts}` 신설, **9건 GREEN**

      | 뮤턴트 | 예측 | 실측 |
      |---|---|---|
      | 정본에 4번째 컬럼 추가 | RED | **RED** |
      | 사본 순서 뒤집기 | RED | **RED** |
      | 사본에서 컬럼 삭제 | RED | **RED** |
      | 리더에서 `satisfies` 분기 제거 | RED | **RED** — 원본 출력으로 «정본이 `null`» 확인(컴파일 오류 0) |
      | 비-문자열 원소를 거절 대신 skip | RED | **RED** |

      > **내 JSDoc 이 반증됐다.** *"`AsExpression` 만 벗기면 정본에서 조용히 **빈 배열**"* 이라
      > 적었는데 실측은 **`null`** 이다(`satisfies` 노드에서 멈춰 배열 리터럴에 도달하지 못한다).
      > 두 자리(가드 JSDoc · spec 주석)를 실측에 맞췄다.
- [x] 2 — schedule `workflow` 양성 커버리지 — C-2 목록 · G·H PATCH **세 자리**

      뮤턴트(세 자리 `present: true`→`false`) → **정확히 그 세 케이스만 RED**, 다른 케이스
      영향 0. 비-vacuity 와 «세 표면이 실제로 `workflow` 를 싣는다» 를 함께 고정했다.
      **`tests=307` 은 변하지 않는다** — `it()` 이 아니라 단언을 더했기 때문이고, 그래서
      GREEN 만으로는 증거가 되지 않아 이 뮤턴트를 돌렸다.
- [x] 3 — 캐너리 주석 정리 — 세부 ①②③ 전부. 원문자 잔여 **0**, `grep '가드 [0-9]'`
      **9자리 전부 검색됨**(종전엔 `3·5` 케이스가 안 잡혔다). self-spec 12/12 GREEN.

      > 항목이 *"케이스 헤딩 8개는 아라비아"* 라 적었는데 실측 `## 가드` 헤딩은 **3개**
      > (아라비아 2 · 원문자 1)다. 갈렸다는 사실은 맞고 개수만 틀렸다.
- [x] 4 — teardown — **실측이 (a) 를 기각**, (b) 로 근거만 정정. 서술은
      `trigger-workflow-ref.e2e-spec.ts` 를 정본으로 두고 자매 파일이 가리킨다.
- [x] 트래커 4건 `[x]` + 실측 각주 (`--impl-prep` plan_coherence WARNING#4)
- [x] `--impl-prep` W1·W2·W3 등재 — 번들 절단(harness) · `_overview.md` frontmatter(planner) ·
      `__` 표기 규약(planner)
- [x] `run-test-all.sh` — **ALL PASS** (lint · unit · build · e2e 307).
      첫 실행은 **lint 에서 멈췄다**(내 새 spec 의 prettier 2줄) — backend 패키지의 prettier 로
      고치고 재실행. 뮤테이션 검증용 e2e 2회를 별도로 더 돌렸다(뮤턴트 RED · 원복 GREEN).
- [ ] `/ai-review` + `--impl-done`

      **완료 기준**: 마지막 라운드가 **`codebase/**` 수정 0 으로 끝날 것.**
      **정지 규칙**(결과를 보기 전에 선언): `/ai-review` 가 **Critical 0 이고 WARNING 0** 이면
      INFO 내용과 무관하게 멈추고 INFO 는 등재한다.
