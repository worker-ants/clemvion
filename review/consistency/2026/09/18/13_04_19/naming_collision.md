# 신규 식별자 충돌 검토 — trigger `(workflow_id)` 인덱스 draft (3라운드, 초점: S4)

## 검토 범위

이번 회차는 직전 두 회차(`review/consistency/2026/09/18/12_18_52`, `12_26_41`)가 이미 NONE 으로
판정한 S1~S3(`idx_trigger_workflow_id`, `V111`, `spec/1-data-model.md` 신규 표 행·Rationale 절
제목, `spec/data-flow/10-triggers.md` 문구 추가)을 재확인하고, **새로 더해진 S4**(`spec/conventions/migrations.md`
§5 말미 콜아웃 교체 — 아직 spec 본문에는 미적용, 브랜치 대비 `origin/main` diff 0)에 새 식별자가
있는지를 본다.

## 발견사항

이번 회차에서 신규 CRITICAL/WARNING 없음. 참고용 INFO 1건.

- **[INFO]** S4 콜아웃 일반화 후 자매 문서의 좁은 표현이 남는다
  - target 신규 식별자: S4 가 바꾸는 콜아웃 라벨 `**인덱스를 만드는 마이그레이션은 별도 패턴이 있다**`
    (기존 `**인덱스 교체는 별도 패턴이 있다**` 를 대체 — "교체" 한정에서 "교체+신규 추가" 로 범위 확대)
  - 기존 사용처: `spec/data-flow/8-notifications.md:277` — `> ⚠️ **위 2문장 순서는 V056 이 적용된 시점의 것이다.**`
    콜아웃이 `"새로 쓰는 인덱스 교체는 [README §5] 의 3문장 순서를 따른다"` 라고 **"교체" 로만** README §5 를 가리킨다.
  - 상세: 이것은 식별자 **충돌**(같은 이름이 다른 뜻)이 아니라 **범위 서술의 불일치**다 — S4 가 `migrations.md`
    §5 의 콜아웃을 "교체든 신규 추가든" 으로 넓히면, `8-notifications.md` 의 오래된 메아리는 여전히 "교체" 만
    언급해 두 문서가 같은 README §5 규칙을 다른 폭으로 설명하게 된다. 새 식별자를 도입하는 것이 아니므로
    naming-collision 등급 기준(동일 식별자의 의미 충돌)에는 해당하지 않는다 — cross-spec 정합성 관점의
    참고 사항으로만 남긴다.
  - 제안: 이 draft 의 scope 밖(target 이 `8-notifications.md` 를 건드리지 않음)이므로 이번 PR 에서 고칠 필요는
    없다. 트래커에 "README §5 문구 확장 시 `8-notifications.md:277` 의 '교체' 한정 표현도 동행 갱신" 을
    한 줄 남겨두는 정도면 충분하다.

## 재확인 — 직전 회차가 다룬 식별자 (변경 없음, 최신 실측)

- `idx_trigger_workflow_id` — `codebase/backend/migrations/V111__trigger_workflow_id_index.sql`,
  `codebase/backend/test/trigger-deletion-releases-resources.e2e-spec.ts:204` 에만 실존. 그 외 매치는 전부
  이 draft/리뷰 산출물 자신에 대한 인용. `idx_schedule_trigger_id`(V106)·`idx_schedule_workspace_next_run`(V110)
  과 같은 `idx_<table>_<column>` 패턴, 컨벤션 이탈 없음.
- `V111` — `codebase/backend/migrations/` 리스팅상 `V110` 다음 유일한 신규 파일(`V111__trigger_workflow_id_index.sql`
  + `.conf`). `spec/1-data-model.md`, `spec/data-flow/10-triggers.md`, `plan/in-progress/spec-draft-trigger-workflow-index.md`
  에 참조로만 등장, 다른 의미의 기존 사용처 없음.
- README.md §5 신규 라벨 `**신규 추가에도 0) 을 둡니다**` (2026-09-18, 커밋 `ff7d79967` 로 이미 반영) —
  기존 라벨 `**인덱스 교체는 DROP-먼저**` 와 별개 표제로 병기, 이름 충돌 없음. 표 행 `교체 | … | V110`,
  `신규 추가 | … | V111` 도 기존 표 구조와 정합.
- S4 본문이 인용하는 `V056`(`쓸 수 있는 인덱스를 0개로`) · `V106`(`영영 유효하지 않게`) — 두 마이그레이션
  파일이 실재하며(`codebase/backend/migrations/V056__notification_active_partial_index.sql`,
  `V106__schedule_trigger_id_index.sql`) README.md 의 동일 인용과 부합. S4 자체는 이 두 기존 식별자를
  **재사용**할 뿐 새 식별자를 만들지 않는다.
- 요구사항 ID·API endpoint·webhook/queue/SSE 이벤트명·ENV 변수·신규 spec 파일 경로 — 이 draft·S4 어디에도
  새로 도입되는 항목이 없다(전부 기존 문서의 본문/Rationale 절 편집, 기존 마이그레이션 파일 컨벤션 참조).

## 요약

이번 회차의 초점인 S4(`spec/conventions/migrations.md` §5 콜아웃 일반화)는 새 요구사항 ID·엔티티/타입명·API
endpoint·이벤트명·환경변수·spec 파일 경로 중 어느 것도 새로 도입하지 않는다 — 기존에 이미 존재하는 마이그레이션
파일(`V056`, `V106`)과 README.md §5 절을 인용해 콜아웃 문구의 범위만 넓히는 순수 산문 편집이다. 직전 두 회차가
NONE 으로 판정한 `idx_trigger_workflow_id`·`V111` 등 실체 식별자는 이번 실측에서도 저장소 전수에서 이 draft
자신과 그 실제 구현물(V111 마이그레이션·e2e) 외에는 나타나지 않아 충돌이 없다. 유일한 참고 사항은 S4 가 넓히는
규칙을 오래된 자매 문서(`spec/data-flow/8-notifications.md:277`)가 여전히 좁게("교체" 한정) 설명한다는
범위-정합성 메모이며, 이는 식별자 충돌이 아니라 트래커에 남길 만한 사소한 후속 항목이다.

## 위험도

NONE
