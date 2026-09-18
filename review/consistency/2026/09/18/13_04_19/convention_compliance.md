# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-trigger-workflow-index.md` (3라운드, 초점: S4)

## 검토 범위

이번 회차는 새로 추가된 **S4**(`spec/conventions/migrations.md` §5 말미 콜아웃을 "인덱스 교체" 한정에서
"인덱스를 만드는 마이그레이션 전부"로 넓히는 제안, 아직 실제 spec 파일에는 미반영)를 중심으로,
S1~S3(이미 적용·직전 회차 통과)까지 포함해 `spec/conventions/**` 전체와의 정합을 재확인했다. 관련
확인 대상: `spec/conventions/migrations.md`(전문), `codebase/backend/migrations/README.md` §5,
`codebase/backend/migrations/V111__trigger_workflow_id_index.sql`/`.conf`, `spec/1-data-model.md` §3·Rationale,
`spec/data-flow/10-triggers.md` §2.1, `spec/data-flow/8-notifications.md`(자매 문서), 직전 라운드 산출물
(`review/code/2026/09/18/12_54_44/SUMMARY.md`, `review/consistency/2026/09/18/13_04_19/naming_collision.md`).

## 발견사항

- **[WARNING] `spec/conventions/migrations.md` 가 아직 `codebase/backend/migrations/README.md §5` 와 어긋난 상태다 — S4 는 계획일 뿐 적용 전**
  - target 위치: `plan/in-progress/spec-draft-trigger-workflow-index.md` `## 변경안 > S4` (draft 워킹트리 diff, 아직 unstaged)
  - 위반 규약: `spec/conventions/migrations.md` §5 새 마이그레이션 추가 절차 말미 콜아웃
  - 상세: 이 PR 의 `51aef0107`→`ff7d79967` 커밋이 `codebase/backend/migrations/README.md §5` 를 "인덱스 교체(V056) 뿐 아니라
    신규 추가(V106/V111)도 `CREATE` 앞에 invalid 잔재 정리를 둔다"로 이미 넓혔다. 그런데 `spec/conventions/migrations.md`
    (정책 SoT, README 를 가리키는 정식 규약 문서)는 여전히 "인덱스 **교체**는 별도 패턴이 있다 … **기존 인덱스를 갈아 끼우는**
    마이그레이션은 README §5 를 따른다"로 **교체 사례만** 언급한다(현재 실측: 202줄 파일 74~79행, S4 미적용 그대로).
    이 draft 의 Rationale 자신이 지적하듯("1라운드 처분을 뒤집는다") "교체는 README 를 따른다"는 곧 "신규 추가는
    안 따라도 된다"로 오독되어, 이 PR 이 없애려는 V106 결함(신규 추가에 짝 DROP 미적용 → 실패 후 영구 invalid)의
    재발 경로를 정책 문서 자체가 열어 둔다. 같은 갭이 `review/code/2026/09/18/12_54_44/SUMMARY.md` WARNING#2 로도
    독립 확인됐다(RESOLUTION.md 없음 — 미해소).
  - 제안: S4 본문(현재→변경 diff)은 정확하고 V056/V106 인용도 실물과 일치하므로, 그대로
    `spec/conventions/migrations.md` §5 콜아웃에 적용한다. 적용 후에는 이 --spec 게이트가 아니라
    `--impl-done`(spec-linked scope) 이 해당 파일을 다시 훑도록, plan 체크리스트 1번 항목을
    "S1~S4 반영"으로 갱신해 S4 가 어느 게이트에서 반영 확인됐는지 남긴다.

- **[WARNING] 자매 문서 `spec/data-flow/8-notifications.md:277` 가 같은 규칙을 더 좁게 서술 — S4 적용 후에도 그대로면 두 정책 문서가 서로 다른 폭을 말한다**
  - target 위치: `plan/in-progress/spec-draft-trigger-workflow-index.md` `## 변경안 > S4` (scope 명시 없음)
  - 위반 규약: `spec/conventions/migrations.md` §5(단일 정책 SoT 원칙) — CLAUDE.md 의 "정보 저장 위치 단일 진실 원칙"과 동일 정신
  - 상세: `spec/data-flow/8-notifications.md:274~277` 은 "새로 쓰는 인덱스 **교체**는 README §5 의 3문장 순서를 따른다"고
    적어 현재 `migrations.md` 와 같은 폭(교체 한정)이다. S4 가 `migrations.md` 만 "교체든 신규 추가든"으로 넓히면,
    두 spec 문서가 **같은 README §5 규칙**을 서로 다른 범위로 설명하게 된다 — 이 draft 가 막으려는 "좁은 문구가 다음
    작성자를 오독시킨다"는 위험과 동일한 성격의 잔여 표면이다. `naming_collision.md`(같은 세션)도 이를 식별자 충돌은
    아니라며 NONE 등급으로 참고 처리했지만, 정책 문서 정합성 관점에서는 다음 라운드로 미룰 만한 사소함은 아니다.
  - 제안: 이번 PR 스코프 밖이라도 좋으니, S4 커밋 메시지 또는 draft 의 "트래커 반영" 절에 "`8-notifications.md:277` 의
    '교체' 한정 표현을 README §5 확장 폭에 맞춰 동행 갱신" 한 줄을 반드시 등재한다(현재 draft 본문에는 이 항목이 없다 —
    naming_collision 체커의 제안이 실제 트래커/체크리스트에는 아직 반영되지 않았다).

- **[INFO] `plan/complete/` 로 아직 이동하지 않은 draft 를 가리키는 forward reference — 정식 규약 위반은 아니나 같은 PR 이 재생산 중**
  - target 위치: `codebase/backend/migrations/V111__trigger_workflow_id_index.sql:5`,
    `codebase/backend/test/trigger-deletion-releases-resources.e2e-spec.ts:196`(둘 다 `codebase/**`)
  - 위반 규약: 해당 없음 — `spec/conventions/review-citations.md` §3 은 `review/**` 세션 인용의 날짜 완전성만 규정하고
    `plan/**` 경로 인용 형식은 다루지 않는다. 따라서 이 항목은 `spec/conventions/**` 직접 위반은 아니다(참고용으로만 기록).
  - 상세: 두 자리 모두 "plan/complete/spec-draft-trigger-workflow-index.md" 를 인용하지만 실제 파일은 아직
    `plan/in-progress/`에 있다(현재 시점 거짓 참조). 같은 사실이 `review/code/2026/09/18/12_54_44` WARNING#1 로 이미
    확인됐고, draft 체크리스트가 "draft 이동을 이 PR 의 마지막 커밋에서 한다"로 해소 계획을 명시하고 있다.
  - 제안: `spec/conventions/review-citations.md` 관점의 조치는 불요(스코프 밖). 다만 draft 이동 커밋에서
    `grep -rn "plan/complete/spec-draft-trigger-workflow-index" spec/ codebase/` 로 3곳(spec 문서 1 + 위 코드 2)
    전부 유효해졌는지 재확인이 필요하다는 기존 권고를 그대로 따른다.

## 재확인 — 이미 적용된 S1~S3, 마이그레이션 명명·번호 정책

- `codebase/backend/migrations/V111__trigger_workflow_id_index.sql`/`.conf` — 파일명 `V<번호>__<snake_case_descriptor>`
  형식 준수, V번호는 main 최대(V110)+1로 단조·gap 없음, `.conf` base name 이 `.sql` 과 동일, `executeInTransaction=false`
  로 트랜잭션 밖 실행 명시. `spec/conventions/migrations.md` §1·§2·§4 위반 없음.
- 인덱스 이름 `idx_trigger_workflow_id` — 기존 `idx_schedule_trigger_id`(V106)·`idx_schedule_workspace_next_run`(V110) 과
  같은 `idx_<table>_<column>` 패턴, 이탈 없음(정식 규약이 아니라 관행이지만 일관성 유지).
- `spec/1-data-model.md` §3 표 신규 행("Trigger | (workflow_id) | … CONCURRENTLY, V111") 과 `## Rationale`
  "### Trigger `(workflow_id)` 인덱스 (2026-09-18)" 절, `spec/data-flow/10-triggers.md` §2.1 문구 추가 —
  모두 draft S1~S3 원안과 실제 커밋(`fa1153e64`)이 문자 그대로 일치. Overview/본문/Rationale 3섹션 구조를 갖춘
  기존 spec 문서에 본문·Rationale 절만 추가하는 형태로, CLAUDE.md 의 문서 구조 컨벤션과 어긋나지 않는다.
  `spec/conventions/migrations.md` §5 새 마이그레이션 추가 절차(rebase→작성→가드→e2e dry-run→PR)도 checklist 상
  순서대로 수행된 흔적이 있다(migration-guard OK, e2e 322).
- `spec/conventions/audit-actions.md`·`cafe24-api-catalog/**` 등 번들의 다른 정식 규약은 이번 target 문서의
  변경 범위(DB 인덱스·마이그레이션 정책)와 무관 — 적용 대상 아님.

## 요약

S1~S3(spec/1-data-model.md, spec/data-flow/10-triggers.md 실편집)과 V111 마이그레이션 파일·번호 정책은
`spec/conventions/migrations.md`를 정확히 따른다. 반면 이번 라운드의 초점인 **S4 는 아직 계획 단계**이고,
그 계획이 고치려는 정책 SoT(`spec/conventions/migrations.md`)와 실제 기술 가이드(`codebase/backend/migrations/README.md §5`)
사이의 폭 불일치는 **지금 이 순간에도 실재**한다(`review/code/2026/09/18/12_54_44` WARNING#2 로 독립 확인, RESOLUTION 없음).
S4 문안 자체(현재→변경 diff, V056/V106 인용)는 정확하므로 그대로 적용하면 이 갭은 닫히지만, 적용되기 전까지는
정식 규약이 스스로 지적한 오독 위험을 안고 있다. 부수적으로 `spec/data-flow/8-notifications.md:277` 라는 자매
문서가 S4 적용 이후에도 좁은 표현으로 남아 두 spec 문서 간 정책 서술 불일치를 재생산할 소지가 있다 — 이번 PR
스코프는 아니되 트래커 등재가 누락되어 있다.

## 위험도

MEDIUM
