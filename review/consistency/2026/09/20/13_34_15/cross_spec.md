# Cross-Spec 일관성 검토 — schedule cron flake (impl-done, scope=spec/2-navigation/)

## 점검 대상 요약

- **diff-base**: `origin/main` → HEAD, **1개 파일 / 실질 변경 29줄** (`codebase/backend/test/schedule-trigger.e2e-spec.ts`)
- 변경 내용: `D. PATCH cron → nextRunAt 재계산` e2e 테스트의 단언 방식을 「PATCH 전후 값이 달라졌는가」(대리 지표, 두 cron 의 다음 실행이 우연히 같아지는 순간 거짓 실패)에서 「PATCH 뒤 값이 새 cron(분 단위)이 만드는 값의 형태(요청 시각 기준 좁은 시간창 + 초 자리 0)를 가지는가」로 교체. 생성 cron 도 `0 10 * * *`(하루 1회, 경계 충돌 가능)에서 `0 0 1 1 *`(연 1회, 경계 충돌 확률 극소)로 변경.
- **spec/2-navigation/** 델타: 0개 파일 — 이 브랜치는 spec 을 바꾸지 않았다.
- `codebase/backend/test/schedule-trigger.e2e-spec.ts` 는 `spec/2-navigation/3-schedule.md` 의 frontmatter `code:` 에 "§4 응답 형태 註가 주장하는 네 응답 형태를 양성 3 + 생성 음성 대조 1 로 고정" 하는 시행 코드로 이미 등재되어 있다(스케줄 축), 트리거 축(`2-trigger-list.md`)에서도 `TriggerDto.workflow` 캐너리로 동일 파일이 등재됨.

## 발견사항

없음.

검토한 6개 관점 모두 해당 사항 없음 — 근거:

- **데이터 모델 충돌**: 없음. 이번 diff 는 테스트 파일의 단언 로직만 바꾸며 엔티티·필드 정의를 건드리지 않는다.
- **API 계약 충돌**: 없음. `PATCH /api/schedules/:id` 의 request/response shape 는 변경되지 않았다. `spec/2-navigation/3-schedule.md §4` 는 PATCH 의 `nextRunAt` 재계산 자체만 서술할 뿐 재계산 완료까지의 수치적 허용 오차(시간창)를 규정하지 않으므로, 테스트가 도입한 "요청 시각 기준 −30s~+90s, 초=0" 판정 기준은 spec 이 선언한 계약이 아니라 테스트 내부의 검증 방법론이다. spec 과 모순될 표면 자체가 없다.
- **요구사항 ID 충돌**: 없음. 새 요구사항 ID 부여 없음.
- **상태 전이 충돌**: 없음. Schedule/Trigger 상태 머신(활성/비활성, cascade 등, `3-schedule.md §3`)에 대한 서술·코드 변경 없음.
- **권한·RBAC 충돌**: 없음. 권한 관련 코드·문서 변경 없음.
- **계층 책임 충돌**: 없음. 변경은 backend e2e 테스트 파일 내부에 국한되며, `3-schedule.md` frontmatter 가 이미 이 파일을 "§4 응답 형태를 시행하는 코드"로 지정해 둔 책임 구획과 일치한다. 새 책임 이동이 없다.

부수적으로 확인한 사항(발견사항으로 등재하지 않음 — cross-spec 범위 밖):
- diff 의 테스트 주석이 인용하는 `plan/in-progress/spec-draft-nullable-notation-followups.md` 와 `review/code/2026/09/20/09_35_16`, `review/code/2026/09/20/11_54_10`, `review/code/2026/09/20/12_17_18` 등은 plan-coherence/rationale-continuity 검토자의 영역이며, 여기서는 spec 간 모순 여부만 판단했다.

## 요약

이번 변경은 `spec/2-navigation/` 을 전혀 수정하지 않는 순수 테스트 파일(1개, 29줄) 리팩터링으로, 플레이키했던 e2e 단언을 "값이 달라졌는가" 대리 지표에서 "새 cron 이 만드는 값의 형태를 가지는가" 직접 판정으로 교체한 것이다. 이 파일은 이미 `3-schedule.md`·`2-trigger-list.md` 두 spec 문서의 `code:` frontmatter 에 시행 코드로 등재돼 있고, spec 본문(§4 API, §3 Trigger 동기화 규칙 등)이 규정하는 어떤 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임과도 접촉면이 없다. 데이터 모델/API/RBAC/상태 전이/계층 책임 6개 관점 전부에서 충돌 후보가 발견되지 않았다.

## 위험도

NONE
