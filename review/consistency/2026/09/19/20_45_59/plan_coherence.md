# Plan 정합성 검토 — `spec-draft-spec-fact-orm-defaults.md`

## 발견사항

없음. Plan 정합성 관점에서 CRITICAL/WARNING/INFO 없음.

### 검증 근거 (참고)

- **미해결 결정과의 충돌 없음**: target 이 닫으려는 두 항목은 `plan/in-progress/spec-draft-nullable-notation-followups.md`
  §후속 (4866~4877행) 에 `owner: planner`, 등재사유 `사실 정정이다` 로 명시된 항목이다. 둘 다 "결정 필요" 로 남겨둔 미해결
  분기가 아니라 이미 사실관계가 실측(코드베이스에 `prisma` 의존성 0건, 엔티티 컬럼 선언 확인)으로 확정된 정정이므로,
  target 이 새로 결정을 내리는 것이 아니라 트래커가 이미 지시한 정정을 수행하는 것이다.
- **선행 plan 미해소 없음**: target 이 전제하는 사전 조건 — "엔티티가 `model_config.kind` · `workflow_assistant_session.last_interaction_at`
  두 컬럼의 DB 기본값을 이제 선언한다" — 는 `plan/complete/entity-column-declaration-drift.md` (표 8·9행, `default: 'chat'` /
  `default: () => 'now()'`) 로 이미 완료·머지되어 있다 (커밋 `6f9c0f1c1`, git status 최근 커밋과 일치). Flyway/TypeORM 선택
  자체를 바꾸는 게 아니라 Rationale 의 ORM 이름 오기 하나만 정정하므로 `self-hosting-deployment.md` 등 §2.8(Flyway)을
  참조하는 다른 plan 에도 영향 없음을 확인했다.
- **후속 항목 누락 없음**: target 의 변경 B 셋째 항목("`entity-schema-declarations` 를 인덱스·제약=선언→DB 단방향,
  컬럼 정의=양방향으로 구분")은 트래커 4876행이 정확히 요구한 문구이며, 현재 `spec/1-data-model.md:1059` 는 아직 이 구분이
  없는 옛 문구("엔티티 선언 ↔ DB")임을 확인했다 — target 이 반영 대상으로 남겨둔 것과 실제 spec 현황이 일치한다.
  같은 트래커의 인접 항목(4879~4886행, "컬럼 층 가드의 남은 빈칸 — RETURNING 테스트")은 developer 트랙의 별개 잔여이며
  target 의 범위(§비대상)와 충돌하지 않는다. target 의 체크리스트 3번째 항목("트래커 두 항목 해소")이 트래커 쪽 갱신도
  같은 턴에 예정하고 있어 후속 동기화 누락도 없다.
- 다른 `plan/in-progress/**` 문서 중 `0-overview.md`/`entity-schema-declarations`/`Flyway 채택` 을 참조하는 것은
  `webchat-auth-session-status-reconcile.md`(무관 섹션), `self-hosting-deployment.md`(§2.8 을 배포 자동화 관점에서만
  참조, ORM 이름과 무관), `marketplace-and-plugin-sdk.md`(다른 `0-overview.md` — `spec/4-nodes/0-overview.md`, 동명이
지만 별개 문서) 뿐이며 모두 target 의 두 정정과 충돌하지 않는다.

## 요약

Target 문서는 이미 종료된 선행 plan(`entity-column-declaration-drift.md`, complete)이 확립한 사실과, 아직 열려 있는
트래커(`spec-draft-nullable-notation-followups.md`)가 명시적으로 지시한 두 개의 "사실 정정" 항목을 정확한 범위로만
수행한다. 결정 필요 항목을 우회하지도, 선행 조건을 건너뛰지도, 다른 plan 의 후속 항목을 무효화하지도 않는다. 트래커
원문과 target 의 변경 문구를 대조한 결과 완전히 부합했다.

## 위험도
NONE
