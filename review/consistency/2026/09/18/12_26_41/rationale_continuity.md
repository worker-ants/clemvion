# Rationale 연속성 검토 — `spec/2-navigation/` (impl-prep, trigger-workflow-index)

## 검토 대상 정리

번들의 실질 target 은 착수 예정 작업(`plan/in-progress/spec-draft-trigger-workflow-index.md`) —
`spec/1-data-model.md` §3 인덱스 표 + `## Rationale`(2026-09-18 신설 절), `spec/data-flow/10-triggers.md`
§2.1 각주, 그리고 뒤이을 구현(V111 마이그레이션 + `TriggerResourceReleaserService.releaseExternalForParent`
의 `select` 좁히기)이다. 두 spec 문서는 이미 커밋됐고(`fa1153e64`), 코드는 아직 착수 전(`select({ where: parent })`
그대로, V111 파일 없음) — impl-prep 시점과 일치한다.

## 발견사항

없음 — 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 어느 것도 확인되지 않았다.
아래는 교차 확인한 근거다.

### 1. 기각된 대안의 재도입 — 해당 없음

- `트리거 자원 정리(2026-09-17)` 트래커의 세 불릿 중 첫째(인덱스)·셋째(`select` 좁히기)만 닫고,
  둘째(부모당 트리거 수에 선형인 순차 처리 지연 — "부모 하나의 트리거 수가 작다"는 미실측 가정)는
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커에 명시적으로 남겨 둔다
  (draft §"트래커 반영"). 조용히 빠뜨린 게 아니라 스코프를 밝히고 이연했다.
- `select: { id, type, config }` 로 좁히는 방향은 [`spec/1-data-model.md` "User 민감 컬럼 방어를
  select: false 가 아니라 응답 경계에 둔 이유(2026-09-06)"]가 이미 **채택안**으로 명시한 "쿼리 범위
  select 투영"(엔티티 컬럼 `select: false` 와는 다른, 그 쿼리 하나만 좁히는 형태)과 정확히 같은 패턴이다.
  그 Rationale 이 명시적으로 기각한 것은 엔티티 레벨 `@Column({ select: false })` 뿐이고, 지금 계획은
  기각된 그 형태를 쓰지 않는다. 실제로 `releaseExternalMany` 가 소비하는 필드는 `id`(리스너·로그) ·
  `type`(schedule 분기) · `config`(chat channel teardown, `chat-channel-binder.service.ts:365-370`) 셋뿐임을
  코드로 확인했다 — narrowing 이 fail-silent 읽기를 만들지 않는다.
- 인덱스 설계("단독 컬럼, CONCURRENTLY, DROP-먼저") 는 기존에 명시적으로 기각된 대안을 되살리지 않는다.
  오히려 `migrations/README.md §5` 가 "V106(CREATE 만 둔 신규 추가)은 실패 시 invalid 인덱스가 영영
  유효해지지 않는 나쁜 선례"라고 적어 둔 것을 이 계획이 인용하며 **그 실패 패턴을 피하려고** DROP-먼저를
  신규 추가 케이스에도 적용한다(draft `--spec` INFO 3 처분). 나쁜 선례의 재도입이 아니라 그 선례를 피하는
  교정이다.

### 2. 합의된 원칙 위반 — 해당 없음

- "선두는 술어 컬럼이어야 한다" 원칙은 `spec/1-data-model.md` "Schedule 인덱스 (2026-09-04)" Rationale 이
  실측으로 확립했다. 새 Rationale 절이 "단독 컬럼인 이유: 세 쿼리가 모두 `workflow_id` 등치 하나뿐이라
  복합 인덱스가 줄 것이 없다(위 Schedule 절의 «선두는 술어 컬럼»)" 로 **그 원칙을 직접 인용해 적용**한다 —
  원칙을 우회하지 않고 계승한다.
- CONCURRENTLY + `.conf`(`executeInTransaction=false`) 요구, 한 파일 한 CREATE 컨벤션(README §5) 도
  구현 계획(V111, 별도 `.conf` 동봉)이 그대로 따른다.
- `workflow_id` 가 v1 에서 불변이라는 쓰기비용 논거는 [`2-trigger-list.md` §2.3.1 `workflowId: read-only (v1)`
  / R-1]을 직접 가리켜 근거로 삼는다 — 다른 문서의 invariant 를 임의로 가정하지 않고 출처를 인용했다.

### 3. 결정의 무근거 번복 — 해당 없음

이 작업은 기존 결정을 뒤집는 것이 아니라 **빈 자리(인덱스 부재)를 채우는 신규 추가**다. 트리거 삭제 자원
정리(2026-09-17, `a9288bf6e`)가 새로 만든 조회 두 번을 계기로 인덱스 필요성이 처음 생겼고, 그 인과관계를
Rationale 이 정확히 서술한다("앞의 둘은 트리거 삭제 자원 정리(2026-09-17)가 더했고, 그 전에는 CASCADE
한 번이었다"). 번복이 아니라 새 결정의 최초 확정이다.

### 4. 암묵적 가정 충돌 — 해당 없음

- §3 "동시 쓰기 직렬화"(트리거 단위 advisory lock)·§4.3 cascade 순서·5초 락 대기 상한 등 트리거 삭제
  관련 invariant 는 이번 작업이 건드리지 않는다 — 인덱스 추가는 조회 경로(Bitmap Index Scan)만 바꾸고
  잠금 순서·트랜잭션 경계·외부 자원 해제 순서(§4.3 표)는 그대로다.
- "이 셋 말고 `workflow_id` 로 트리거를 찾는 곳은 없다"는 주장을 `where: { workflowId` grep 으로
  스팟체크한 결과 프로덕션 코드의 실사용처는 `trigger-resource-releaser.service.ts` 의
  `releaseExternalForParent` / `lockParentAndListTriggerIds` 두 곳뿐으로, 주장과 어긋나지 않는다.

## 요약

`spec/1-data-model.md`(V111 인덱스 + 신설 Rationale) · `spec/data-flow/10-triggers.md`(§2.1 각주) 두 spec
문서, 그리고 뒤이을 구현(`select` 좁히기 포함)은 기존 Rationale — Schedule 인덱스의 "선두는 술어 컬럼" 원칙,
User 민감 컬럼 방어의 "쿼리 범위 select 투영 채택 / 엔티티 select:false 기각" 구분, 트리거 목록의
`workflowId` read-only invariant, migrations README §5 의 DROP-먼저 컨벤션 — 을 모두 정확히 인용하며 그
경계 안에서 움직인다. 트래커에 남긴 둘째 불릿(순차 처리 지연)도 스코프를 명시하고 이연했을 뿐 은폐가
아니다. Rationale 연속성 관점에서 구조적 위반이나 무근거 번복은 발견되지 않았다.

## 위험도

NONE
