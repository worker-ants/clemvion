# 신규 식별자 충돌 검토 — `plan/in-progress/spec-draft-schedule-index.md`

## 검토 범위 확인

target 은 `spec/1-data-model.md` §3 인덱스 전략 표의 **`Schedule` 행 하나를 교체**하고
**`Schedule (trigger_id)` 행 하나를 추가**하는 spec draft다. 신규로 "도입"되는 식별자
후보를 목록화하면:

| 후보 | 성격 |
|---|---|
| 인덱스 컬럼 조합 `(workspace_id, next_run_at)` | 신규 — 종전 `(next_run_at, is_active)` 대체 |
| 인덱스 컬럼 조합 `(trigger_id)` (Schedule 테이블) | 표에 행 추가 — 하지만 **실체는 기존**(`V106`, `idx_schedule_trigger_id`) |
| 마이그레이션 버전 `V110` | 신규 — 아직 파일 없음 |

이 세 후보를 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV/설정키·파일 경로 6개 관점에
대조했다.

## 발견사항

- **[INFO]** 마이그레이션 버전 `V110` 사전 기재는 현재 시점 충돌 없음, 단 확정 시점이 아니다
  - target 신규 식별자: `V110` (§3 변경안(A) 표 셀 · §5 본문)
  - 기존 사용처: `codebase/backend/migrations/` 실측 결과 현재 main 의 최대 버전은
    `V109__workspace_personal_owner_unique.sql` — `V110` 은 아직 어떤 `.sql`/`.conf` 파일도
    점유하지 않았다(전수 검색 0건, `plan/in-progress/**` 에서도 `V110` 언급은 이 target
    문서 자신뿐).
  - 상세: `spec/conventions/migrations.md` §5 는 V번호를 **"PR 을 열기 직전"** 실측
    (`ls migrations | tail -2`)으로 확정하라고 명시한다 — 이유는 §6 이 설명하는 병렬 PR
    간 V번호 점유 경합(merge race) 창을 최소화하기 위해서다. target 은 spec 만 반영하는
    PR 이고 실제 `V110__*.sql` 생성은 "같은 PR 의 developer 단계에서 이어서 수행"(§5 본문)
    이라 창은 짧을 것으로 보이나, spec 승인과 developer 착수 사이에 다른 병렬 세션이
    `V110`을 먼저 점유하면 이 문서에 박힌 숫자가 실측 없이 낡는다. `V109`가 최근작(`d8b7cb93e`
    이전 커밋들의 흐름)이라 활발히 갱신되는 영역임을 감안하면 현실적 리스크다.
  - 제안: 이 자체를 target 의 결함으로 보지 않는다(문서 형식상 다른 표 행들도 `V096`·`V095`·
    `V034` 처럼 버전을 기재하는 관례를 따른 것뿐이고, 실제 `.sql` 도 아직 없어 "충돌"은
    아니다) — 다만 developer 단계 착수 시 `migrations.md §5` 절차대로 `V110`을
    **재확인**(`ls codebase/backend/migrations | tail -2`)하고, 만약 그 사이 `V109` 뒤에
    다른 파일이 들어왔다면 spec 표의 숫자도 함께 갱신할 것. (신규 결정 불필요 — 착수 시
    체크리스트 항목으로만 남기면 충분.)

- **[INFO]** `Schedule (trigger_id)` 행은 "신규 식별자"가 아니라 기존 것의 문서화
  - target 신규 식별자: 없음(§4 변경안(B))
  - 기존 사용처: `codebase/backend/migrations/V106__schedule_trigger_id_index.sql` —
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_trigger_id ON schedule (trigger_id)`
  - 상세: target 스스로 "V106 이 idx_schedule_trigger_id 를 추가했는데 이 표에 행이 없다"
    라고 정확히 진단했고, 추가하는 행은 실측한 실제 DB 객체와 컬럼·용도가 정확히 일치한다.
    충돌 없음 — 확인 목적으로만 기재.

- **[INFO]** `(next_run_at, is_active)` 잔존 참조 — `data-flow/10-triggers.md:175`
  - target 신규 식별자: 없음(target 이 §3 표에서 `(next_run_at, is_active)` 를 삭제하지만,
    이 컬럼 조합 문자열은 target 범위 밖의 `spec/data-flow/10-triggers.md:175` "발사 후"
    행 `인덱스 / 제약` 열에도 등장한다)
  - 기존 사용처: `spec/data-flow/10-triggers.md:175` — "`schedule` | 발사 후 | UPDATE
    `last_run_at, next_run_at` | `(next_run_at, is_active)`"
  - 상세: 이것은 식별자 **충돌**이 아니라(두 문서가 같은 대상을 같은 의미로 가리켜 왔다)
    §3 표가 그 컬럼 조합을 폐기하면 이 문서의 참조가 **가리키는 대상을 잃는** 잠재적
    staleness다. naming-collision 범주(요구사항 ID/엔티티/endpoint/이벤트/ENV/파일 경로)
    어디에도 딱 들어맞지 않아 경계선에 있지만, 같은 식별자 문자열이 여러 파일에 흩어져
    있다는 점에서 참고용으로 남긴다.
  - 제안: 이 checker 의 소관은 아니나, 이 PR 의 다른 검토 관점(spec 정합성/cross-reference)
    에서 `10-triggers.md:175` 도 `(workspace_id, next_run_at)` 로 갱신 대상인지 확인 권고.

## 나머지 5개 점검 관점 — 해당 없음

- **요구사항 ID 충돌**: target 은 신규 요구사항 ID를 부여하지 않는다(기존 §3 표의 행 교체/
  추가일 뿐).
- **엔티티/타입명 충돌**: `Schedule` 은 이미 `spec/1-data-model.md`·`V001` 에 존재하는
  엔티티이고, target 은 새 엔티티·DTO·인터페이스를 도입하지 않는다.
- **API endpoint 충돌**: target 은 API endpoint 를 신설하지 않는다(DB 인덱스 전략 문서
  수정).
- **이벤트/메시지명 충돌**: 해당 없음. webhook/queue/sse 이벤트를 다루지 않는다.
- **환경변수·설정키 충돌**: 해당 없음.
- **파일 경로 충돌**: target 문서 자신의 경로 `plan/in-progress/spec-draft-schedule-index.md`
  는 동일 세션의 형제 문서들(`spec-draft-nullable-notation-followups.md`,
  `spec-draft-scope-and-anchor-drift.md`, `spec-draft-eia-62-waiting-payload.md`,
  `spec-draft-eia-notification-payload-contract.md`)과 동일한 `spec-draft-<slug>.md`
  명명 컨벤션을 따르고, 기존 파일과 겹치지 않는다(신규 생성). `spec_impact` 에 적힌
  `spec/1-data-model.md` 도 기존 파일이며 target 은 그 안의 표 행만 편집하고 신규 spec
  파일을 만들지 않는다.

## 요약

target 이 도입하는 실질적 "신규 식별자"는 마이그레이션 버전 번호 `V110` 하나뿐이며, 실측
결과 현재 main 기준 미점유 상태로 충돌이 없다. `Schedule (trigger_id)` 행은 신규 식별자가
아니라 이미 `V106`으로 존재하는 인덱스의 문서화 공백을 메우는 것이고, 그 실체(컬럼·용도)도
DB 실측과 정확히 일치한다. 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV/설정키
관점에서는 신규 식별자 자체가 없어 충돌 검토 대상이 아니다. 파일 경로도 기존 명명 컨벤션을
그대로 따른다. 유일한 잔여 리스크는 `V110`이 spec 승인과 실제 마이그레이션 파일 생성 사이의
시간차 동안 병렬 세션에 선점될 가능성으로, 이는 `migrations.md` 자체가 이미 절차(§5: PR 열기
직전 재확인)로 흡수하도록 설계된 통상적 프로세스 리스크이지 target 문서의 결함은 아니다.

## 위험도

NONE
