# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-done)

## 검토 범위 요약

이번 diff(`origin/main...HEAD`)의 실질 변경은 EIA 종결 이벤트(`execution.completed`/
`failed`/`cancelled`)의 `durationMs` 필드 구현(16 경로 전체, 그중 엔티티 미로드 5경로는
SQL `RETURNING` + `PG_INT4_MAX` 클램프)과 `spec/5-system/14-external-interaction-api.md`
§12 Re-run API 경로 오탈자(`/api/v1/executions/...` → `/api/executions/...`) 정정이다.
이 변경분은 `spec/3-workflow-editor/3-execution.md`(WS 이벤트 표)·
`spec/conventions/chat-channel-adapter.md`(`EiaEvent` union)·
`codebase/backend/.../chat-channel/types.ts` 세 곳과 이미 동기화되어 있고, 직전 라운드
(`10_52_07`)가 diff 자체에서 새 cross-spec 충돌이 없음을 확인했다. 이후 커밋들
(`2c9b490fd` 등)은 JS/SQL 클램프 비대칭 CRITICAL 을 SQL 과 동일 상수(`PG_INT4_MAX`)로
해소하고, "취소 경로 durationMs = 대기 시간" 캐비엇을 큐 대기 타임아웃뿐 아니라 park
취소·공개 위젯 idle 회수까지 셋 다로 확장했다(§6.5).

본 라운드는 **직전 라운드가 놓친 각도** — target 문서가 새로 명문화한 `duration_ms`/
`started_at` 의미론이, 그 필드를 **소유하는 엔티티 정의 문서**(`spec/1-data-model.md`,
diff 밖·컨텍스트 예산 초과로 이번 프롬프트에서 본문이 생략됨)와 정합하는지를 절대경로로
직접 열어 대조했다. 그 결과 새 WARNING 1건을 확인했다.

---

## 발견사항

### [WARNING] `spec/1-data-model.md` Execution.`duration_ms`/`started_at` 필드 설명이 EIA §6.5 가 새로 명문화한 "취소 경로 = 대기 시간" 의미론을 반영하지 않는다

- **target 위치**: `spec/5-system/14-external-interaction-api.md` §6.5 (2c9b490fd 로 최종 확장된
  캐비엇) — "**취소 경로의 값은 실행 시간이 아니라 대기 시간에 가깝다** — 셋 다 그렇다:
  `EXECUTION_QUEUE_WAIT_TIMEOUT`(admission 이전부터의 큐 대기), park 취소(**무기한** 대기),
  공개 위젯 idle 회수(grace 기본 1시간). `started_at` 이 실행 시작이 아니라 **생성 시각**이기
  때문이다."
- **충돌 대상**: `spec/1-data-model.md` §2.13 Execution 엔티티 표
  - `started_at | Timestamp | 실행 시작 시각` (467행) — 무조건적 서술, "admission 전에는
    생성 시각" 이라는 예외가 없다
  - `duration_ms | Integer? | 실행 소요 시간 (wall-clock, start→finish)` (469행) — 마찬가지로
    무조건적 서술
- **상세**: 코드로 직접 확인한 결과(`execution.entity.ts:56` `@Column({ name: 'started_at',
  type: 'timestamptz', default: () => 'NOW()' })`, `execution-engine.service.ts:2997` admission
  UPDATE `SET status='running', started_at=NOW() WHERE status='pending' …`,
  `markQueueWaitTimeout`(2886행)이 이 admission UPDATE **이전** 단계인 `admitExecutionOrDefer`
  진입부(2958행)에서 큐 대기 초과를 검사) — `started_at` 은 **admission 에 도달한 실행만**
  "RUNNING 전이 시각"(1-data-model.md 의 서술대로)이고, admission 전에 취소되는 실행(큐
  타임아웃)·park 취소·공개 위젯 idle 회수는 DB 컬럼 default(`NOW()`, INSERT 시점)를 그대로
  들고 있어 사실상 "생성 시각"이다. `spec/5-system/4-execution-engine.md` §Rationale(1702행)
  은 이미 "`started_at`(RUNNING 전이 시각)은 stale 판정에 재사용되어 `queued_at` 신규 컬럼이
  필요했다"고 이 split 을 알고 있으나, **엔티티 필드의 단일 진실인 `1-data-model.md` 자체에는
  이 split 이 전혀 반영돼 있지 않다.** 이번 PR 이전에는 이 nuance 가 문서 레벨(Rationale 각주)
  에 머물렀지만, 이번 PR 이 `duration_ms` 를 처음으로 취소 경로까지 채우면서 그 nuance 가
  **wire 로 노출되는 정식 계약**(EIA §6.5 normative)이 됐다 — 그런데도 엔티티 정의 문서는
  갱신되지 않았다. `spec/1-data-model.md` 만 읽는 구현자·리뷰어는 "duration_ms 는 항상 실행
  소요 시간"이라고 오인할 수 있다(대시보드·통계 집계 코드가 바로 이 오인으로 이번 PR 중
  실제 회귀를 냈고 `f79792621` 로 별도 수정됐다 — `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
  "⚠️ `duration_ms` 에 '대기 시간'이 섞여 집계를 오염시킨다" 절 참조).
- **참고**: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 를 전수 grep 했으나
  `1-data-model.md` 는 그 파일 어디에도 언급되지 않는다 — 다운스트림 소비처(대시보드·통계·
  프런트엔드 Duration 컬럼)의 오염은 이미 여러 라운드가 추적 중이지만, **원천 엔티티 문서
  자체의 캐비엇 누락**은 이번 라운드가 처음 등재하는 각도다. 근본 해결책으로 이미 식별된
  "순수 실행시간과 대기시간의 필드 분리"가 이뤄지기 전까지는, 최소한 `1-data-model.md` 의
  두 필드 설명에 EIA §6.5 로의 cross-link 이 필요하다.
- **제안**: `spec/1-data-model.md` §2.13 의 `started_at`/`duration_ms` 행에 각각 한 줄 캐비엇
  추가 — 예: "admission 이전 취소(큐 대기 타임아웃)·park 취소·공개 위젯 idle 회수는 예외 —
  [EIA §6.5](./5-system/14-external-interaction-api.md#65-페이로드--executioncancelled--executionai_message)
  참조". 혹은 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 기존
  "필드 분리" 항목에 "`1-data-model.md` 캐비엇 추가"를 사전 조치로 병기.

---

## 재확인 (이전 라운드가 이미 등재, 이번 diff 밖 — 상태만 재확인)

아래는 `09_00_27`/`10_52_07` cross_spec 라운드가 이미 발견해 `spec-sync-external-interaction-api-gaps.md`
에 `- [ ]` 로 추적 중인 pre-existing 항목이다. 이번 diff 는 해당 파일들을 건드리지 않았으므로
여전히 미해소이나, 새로 등재하지는 않는다(중복 방지):

- EIA §8.2 HMAC 화이트리스트가 같은 문서 §3.1/R12·`data-flow/15-external-interaction.md`·코드와
  불일치("hmac-sha256 만" vs 실제 sha256+sha512 둘 다) — `a67ec89b7` 커밋이 트래커에 이미
  W1 로 등재함을 확인
- `spec/5-system/15-chat-channel.md` 가 `InteractionRequestContext` 를 EIA §3.3.1 의
  discriminated union 이전 형태(단일 인터페이스 + optional `scope`)로 서술
- EIA §5.1 이 `12-webhook.md` §5.2 를 "legacy statusCode/errors" 라 잘못 대비 서술(2026-06-28
  에 이미 신컨벤션 정합화됨)
- `data-flow/15-external-interaction.md:119` 의 미정의 `EIA-AU-09` 참조 (INFO)

이번 diff(durationMs 구현 + Re-run 경로 정정)는 위 4건과 무관하다.

---

## 요약

이번 diff 자체(durationMs 종결 payload 구현 16경로 + int4 클램프 + Re-run 경로 오탈자 정정)는
관련 3개 spec/코드 표면(3-execution.md 이벤트 표·chat-channel-adapter.md `EiaEvent` union·
chat-channel `types.ts`)과 정확히 동기화되어 있어 즉각적인 API 계약·데이터 모델 충돌은
없다. 다만 이번 PR 이 `duration_ms` 를 취소 경로까지 wire 로 노출시키면서, 그 컬럼의 "실행
시간이 아니라 대기 시간일 수 있다"는 새 의미론이 **엔티티 정의의 단일 진실인
`spec/1-data-model.md`** 에는 반영되지 않은 채로 남아 있다(WARNING, 신규 등재). 이는 이미
추적 중인 "duration_ms 대기시간 오염" 계열 이슈의 근본 문서(엔티티 SoT) 쪽 잔여분이며,
실제 집계 코드 회귀(`f79792621`)가 이 오인의 비용을 이미 실증했다. 그 외 pre-existing
WARNING 3건 + INFO 1건은 이번 diff 밖이며 이미 트래커에 등재돼 재확인만 했다. 어느 것도
이번 PR 을 막을 CRITICAL 은 아니다.

## 위험도

MEDIUM
