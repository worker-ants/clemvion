# Rationale 연속성 검토 — spec/conventions/ (impl-prep, trigger-canary-hardening)

## 검토 범위와 방법

`--impl-prep` 번들은 `spec/conventions/` 전체(대부분 컨텍스트 예산으로 절단)와 "관련 Rationale 발췌"
(다른 spec 문서들의 `## Rationale` 절)로 구성돼 있고, 이번 작업 자체(`plan/in-progress/trigger-canary-hardening.md`,
`spec_impact: none`)는 `spec/`을 전혀 편집하지 않는 순수 코드 하드닝이다. 따라서 "target 문서"인
`spec/conventions/`에 새로 도입되는 내용은 없으며, 검토는 ① 번들에 완전 포함된 컨벤션 문서
(`audit-actions.md`, `cafe24-api-catalog/*`, `cafe24-api-metadata.md`)가 자체 모순을 갖는지, ②
plan 이 서술한 실제 구현 방향(트리거 비밀 컬럼 목록·schedule workflow 커버리지·캐너리 주석·e2e
teardown)이 이 저장소의 기존 Rationale(특히 trigger/secret 도메인)과 충돌하는지 두 축으로 진행했다.
절단된 파일 중 plan 항목과 직접 맞닿는 `spec/conventions/secret-store.md`, `spec/data-flow/10-triggers.md`,
`spec/2-navigation/3-schedule.md`, `spec/2-navigation/2-trigger-list.md`는 리포지토리에서 직접 열어
`## Rationale` 전문을 확인했다.

## 발견사항

- **[INFO]** e2e teardown 처분(plan 항목 4)은 `secret-store.md §Rationale R4`를 명시적으로 인용해야 정합성이 완성된다
  - target 위치: `plan/in-progress/trigger-canary-hardening.md` §B "4" 항목(옵션 (a) 서비스 경로 삭제로 관례 변경 / (b) `PROJECT.md` 한 줄) — 이 계획이 실제로 손댈 코드는 e2e teardown 이지만, 그 판단 근거가 정확히 아래 기존 Rationale 영역이다.
  - 과거 결정 출처: `spec/conventions/secret-store.md` `## Rationale` → `### R4. Trigger FK 미설정` — *"`secret_store.workspace_id`는 workspace FK 를 가질 수 있으나 본 spec 은 application-level cascade 만 정의 ... trigger 삭제 시의 명시적 cleanup 책임은 `TriggersService.delete()`가 진다. `ON DELETE CASCADE`는 채택하지 않는다 — implicit DB 동작과 explicit application 동작이 섞이면 추적이 어려워지기 때문."*
  - 상세: plan 이 실측한 문제(`DELETE FROM trigger` raw SQL 로는 FK 가 없는 `secret_store` row 가 고아로 남는다)는 R4 가 이미 예견한 정확히 그 상황이다 — R4 는 "명시적 정리는 `TriggersService.delete()`(application 경로)의 책임"이라고 선언했는데, e2e teardown 의 raw `DELETE FROM`은 그 경로를 우회한다. plan 의 옵션 (a)(서비스 경로로 teardown 을 바꿔 관례를 변경)는 R4 의 원칙("explicit application 책임")과 정확히 정렬되는 선택이고, 옵션 (b)(`PROJECT.md`에 한 줄 남기고 raw SQL 을 유지)는 R4 가 명시적으로 기각한 "implicit 동작에 기대는" 상태를 그대로 문서화만 하는 것에 가깝다. 아직 결정되지 않았고(plan 이 "실측 후 택일"이라고 명시) 위반이 확정된 것은 아니므로 CRITICAL/WARNING 은 아니지만, 택일 시점에 R4 를 인용하지 않으면 나중 검토자가 "왜 이 teardown 만 raw SQL 인가"를 R4 없이 재추적해야 한다.
  - 제안: 착수 시 실측 후 어느 옵션을 택하든 커밋/RESOLUTION 에 `secret-store.md §R4`를 근거로 명시한다. 옵션 (b) 를 택할 경우 R4 의 "explicit cleanup 책임" 원칙에 대한 **테스트 인프라 한정 예외**임을 한 문장으로 남겨, 이후 다른 e2e 파일(같은 raw `DELETE FROM` 패턴을 쓰는 나머지 8개 파일)에 동일 예외가 조용히 확산되는 것을 막는다.

- **[INFO]** plan 항목 2(schedule `workflow` 양성 커버리지 추가)는 위반이 아니라 기존 계약의 미이행분을 채우는 작업임 — 근거를 명시하면 연속성이 더 분명해진다
  - target 위치: `plan/in-progress/trigger-canary-hardening.md` §B "2" 항목
  - 과거 결정 출처: `spec/2-navigation/3-schedule.md` §4 API 註(부재 표현 표) — *"부재는 생성 응답에만 있고 ... 목록·상세·수정에는 채워지며, e2e 가 네 응답 형태를 양성 3 + 생성 음성 대조 1 로 고정한다."*
  - 상세: 이 문장은 이미 "e2e 가 양성 3건을 고정한다"고 서술하지만, plan 이 실측한 바로는 `schedule-trigger.e2e-spec.ts`에 `expectTriggerWorkflowRef` 호출이 0건이다. 즉 스펙 문서의 서술과 실제 e2e 커버리지 사이에 기존 갭이 있었고(이번 작업이 만든 갭이 아니라 발견한 갭), plan 의 수정은 그 서술을 사실로 만드는 방향이라 Rationale 번복이 아니라 완성이다. `2-trigger-list.md`의 R-17(같은 `workflow` 필드에 대한 자매 캐너리 설계 근거)과도 방향이 일치한다.
  - 제안: 구현 커밋 메시지 또는 트래커에 "3-schedule.md §4 註의 '양성 3' 서술을 실측 커버리지로 채운다"는 한 문장을 남겨, 이 변경이 spec 서술의 사후 이행(구현 완료에 따른 동기화)이지 새로운 결정이 아님을 명확히 한다 — `3-schedule.md`의 다른 항목("sort/order 쿼리 반영 — 'Planned' 표기 해제")이 이미 쓰는 것과 같은 패턴이다.

## 비대상 확인 (충돌 없음을 확인한 항목)

- plan 항목 1(`TRIGGER_RESPONSE_STRIP_COLUMNS` 3중 사본에 대한 정적 repo-guard)은 `spec/1-data-model.md`
  Rationale 의 "값을 읽는 내부 소비자가 있으면 `select:false` 금지, 응답 경계에서 지운다" 원칙
  (`Trigger.notification_secret_v2`을 명시적 사례로 인용)과 정합한다. 정적 가드로 처리하기로 한 것(런타임
  공유 대신)도 plan 자신이 "정본 모듈을 테스트 헬퍼로 끌어오는 의존 그래프 비용"이라는 새 근거를 대며
  `CREATOR_PROJECTION` 선례(통합)와의 차이를 스스로 설명하고 있어 "무근거 번복"에 해당하지 않는다.
- plan 항목 3(캐너리 헤더 원문자 표기 정리)은 `trigger-workflow-ref.e2e-spec.ts`/`trigger-list.md R-17`이
  다루는 "`workflow` 필드가 계약이 아니라 구현임을 고정한다"는 설계 결정 자체를 건드리지 않는 순수
  표기 정리다. 관련 Rationale 없음.
- `spec/conventions/audit-actions.md`, `cafe24-api-catalog/*`, `cafe24-api-metadata.md`(번들에 완전
  포함된 컨벤션 문서) 자체에는 이번 작업과 충돌하는 내용이 없다 — 이들은 트리거/캐너리 도메인과
  무관하며, `audit-actions.md`의 `trigger.*` 항목(§3 레지스트리, 2026-08-11 결정)도 이번 plan 이
  다루는 표면(비밀 컬럼 strip·workflow ref·teardown)과 겹치지 않는다.

## 요약

이번 작업(`trigger-canary-hardening`)은 `spec/`을 편집하지 않는 순수 코드 하드닝이며, 검토 결과 기각된
대안의 재도입이나 합의 원칙의 명시적 위반은 발견되지 않았다. 유일하게 주의가 필요한 지점은 plan 항목
4(e2e teardown 의 `secret_store` 고아 row 처분)로, `secret-store.md §R4`가 이미 "명시적 application
경로 정리, implicit cascade 기각"이라는 원칙을 세워 두었으므로 최종 택일(서비스 경로 vs 문서화)이
그 원칙과 어떻게 관계되는지 한 문장으로 남기는 것이 좋다. plan 항목 2 는 오히려 `3-schedule.md`/
`2-trigger-list.md`의 기존 Rationale이 이미 약속한 커버리지를 뒤늦게 채우는 작업으로, 연속성 관점에서
문제가 아니라 정합을 강화하는 변경이다.

## 위험도
LOW
