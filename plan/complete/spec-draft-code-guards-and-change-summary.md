---
title: 데이터 모델 spec 의 code 에 전용 e2e 가드 셋 등재 · 캔버스 §8.1 change_summary 서술을 실제에 맞춤
status: complete
owner: project-planner
worktree: spec-code-summary-4e7a20
started: 2026-09-19
completed: 2026-09-19
spec_impact:
  - spec/1-data-model.md
  - spec/3-workflow-editor/0-canvas.md
---

# 데이터 모델 `code:` 에 e2e 가드 셋 · 캔버스 `change_summary` 서술

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 planner 항목 둘을 닫는다. 둘 다 **사용자 결정(2026-09-19)** 이
있었다.

1. «`spec/1-data-model.md` frontmatter `code:` 에 이 문서를 지키는 e2e 가드를 넣을지» → **셋 다 넣는다**.
2. «`0-canvas.md` §8.1 «버전에는 자동 생성된 `change_summary` 포함» — 자동 생성이 없다» → **spec 을 실제에 맞춘다**(기능을 새로 만들지 않는다).

## 1. `spec/1-data-model.md` frontmatter `code:`

현재:

```yaml
code:
  - codebase/backend/src/modules/**/entities/*.entity.ts
  - codebase/backend/migrations/V*.sql
```

더한다(이 문서의 사실을 지키는 **전용** e2e):

```yaml
  - codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts      # §3 FK 인덱스(V112~V130)가 유효하게 있다
  - codebase/backend/test/trigger-endpoint-path-dedupe.e2e-spec.ts  # Rationale «Webhook endpoint_path 전역 유일» 의 V131 중복 정리
  - codebase/backend/test/entity-schema-declarations.e2e-spec.ts    # 엔티티 선언(인덱스·유니크·CHECK·FK)이 DB 에 그대로 있다
```

(위 줄 끝 주석은 draft 설명용이다. spec frontmatter 에는 세 경로 위에 규칙 주석 두 줄만 둔다 — `2-trigger-list.md` 의 `code:` 주석 선례:
«# 이 문서의 사실을 지키는 전용 e2e — 새 전용 가드는 여기에 더한다. 기능 e2e 는 넣지 않는다» ·
«# (자기 기능의 인덱스를 곁들여 보는 테스트까지 넣으면 이 문서가 무관한 기능 변경의 게이트가 된다).»)

**효과**: 이 세 파일을 바꾸는 변경은 spec-linked 가 되어 `--impl-done` 을 부른다 — 가드를 약하게 고치는 변경도 이 문서와의
대조를 거친다. 다른 spec 이 e2e 경로를 `code:` 에 넣는 선례와 같다(`2-navigation/2-trigger-list.md` · `3-schedule.md` ·
`5-system/15-chat-channel.md` 등).

**전수로 확인한 것**: `codebase/backend/test/*.ts` 중 DB 카탈로그(`pg_index` · `pg_indexes` · `pg_constraint` · `information_schema` ·
`indisvalid`)를 단언하는 파일은 여덟이다(grep). 위 둘(`deletion-cascade-indexes` · `entity-schema-declarations`)과 달리 나머지 여섯은
**기능 e2e** 가 자기 기능의 인덱스 · 컬럼을 곁들여 확인하는 것이다. 그중 둘은 이미 기능 spec 의 `code:` 에 있고
(`schedule-trigger` · `trigger-deletion-releases-resources` → `2-trigger-list` · `3-schedule`), 넷은 어느 spec 에도 없다 —
`background-monitoring`(V047 · V048) · `notifications-dismiss`(V056) · `terminal-duration-sql`(컬럼 타입) · `webhook-trigger`(V132).
이 넷은 데이터 모델 전용 가드가 아니다. 넣으면 그 기능을 고칠 때마다 이 문서의 대조가 걸린다 — **넣지 않는다**(아래 «비대상»).
`trigger-endpoint-path-dedupe` 는 카탈로그 단어가 없어 grep 에 안 걸리지만(임시 스키마 사본에서 V131 을 실행한다) 이 문서
Rationale 의 마이그레이션 전용 테스트라 넣는다.

## 2. `spec/3-workflow-editor/0-canvas.md` §8.1 (526행)

«- 버전에는 자동 생성된 `change_summary` 포함 (예: "노드 3개 추가, 엣지 2개 수정")» →

«- 버전의 `change_summary` 는 저장 요청이 보낸 값을 그대로 담는다(`[버전 이력 §7.4](./5-version-history.md#74-캔버스-저장)`). 에디터의
수동 저장 · 실행 직전 저장은 이 값을 보내지 않아 비어 있다. 서버가 스스로 채우는 것은 버전 복원이 만드는 새 버전의
`Restored from vN` 하나다.»

근거:

- 서버가 채우는 곳은 `workflows.service.ts` 의 복원(`changeSummary: \`Restored from v${target.version}\``) 하나다. 저장은
  `dto.changeSummary` 를 그대로 넘긴다(`save-canvas.dto.ts` `changeSummary?`).
- 프론트는 저장 요청에 `changeSummary` 를 싣지 않는다 — `codebase/frontend/src` 에서 이 이름은 응답 타입(`lib/api/workflows.ts`)과
  표시 컴포넌트(`version-history-panel.tsx` · `version-detail-dialog.tsx`)에만 나온다.
- 같은 사실을 적는 다른 자리는 이미 맞다: `5-version-history.md` §7.4(«body 에 `changeSummary?` … 그대로 표기») · §9(«복원 … 항상
  `Restored from vN`») · `data-flow/11-workflow.md`(save 의 `changeSummary?` · restore 의 `Restored from vN`). `1-data-model.md` §2.15 의
  «변경 사항 요약» 은 누가 채우는지 말하지 않아 틀리지 않다. 전수: `grep -rn "change_summary\|changeSummary" spec` 10줄 중 틀린 것은 이 한 줄.

## 3. Rationale 두 절

- **`spec/1-data-model.md` `## Rationale` 맨 위** «`code:` 에 전용 e2e 가드 셋 (2026-09-19)» — 무엇을 넣었나 · 넣지 않은 기능 e2e 넷과
  그 이유(58개 중 7개만 `code:` 에 걸림) · **glob 이 아니라 나열인 이유**: `15-chat-channel` R-CC-22 는 같은 접두로 늘어나는 구현 파일
  집합을 glob 으로 잡았다. 이 셋은 이름으로 모을 공통 접두가 없고 새 전용 가드는 드물게 생긴다 — 그 가드를 만드는 PR 이 여기에 더한다.
- **`spec/3-workflow-editor/0-canvas.md` `## Rationale` 끝** «R-5. §8.1 `change_summary` 자동 생성 서술 정정 (2026-09-19)» — R-3 과 같은 결
  (§8 이 없는 저장 기능을 약속) · 사용자 결정 · 이미 맞게 적은 곳 · 가이드 정정.

## 4. 사용자 가이드 정정 (developer 커밋 — `codebase/`)

`codebase/frontend/src/content/docs/05-run-and-debug/version-history.mdx` · `.en.mdx` 가 없는 입력 기능을 안내한다:

- ko 20행 · en 9행 «저장 요청에 `changeSummary` 메모를 넣으면 버전 이력에 그대로 표시돼요» — 에디터에는 요약 입력란이 없다.
- ko 83행 · en 72행 «작업 전에 `Save` 로 버전을 만들고 의미 있는 `changeSummary` 를 남겨요» — 사용자가 할 수 없다.

사실대로 고친다: 에디터로 저장한 버전의 변경 요약은 비어 있고, 복원으로 만든 버전만 `Restored from vN` 을 가진다. 체크포인트 팁은
«Save 로 버전을 만들고 그 버전 번호를 기억해 둔다» 로. 가이드는 e2e 면제 화이트리스트(`PROJECT.md` «`codebase/frontend/src/content/docs/**`»)
이고 어느 spec 의 `code:` 에도 걸리지 않는다(`review_guard._spec_linked_changes` → 빈 목록) — `/ai-review` 한 라운드가 붙는다.

## 비대상

- **기능 e2e 넷의 `code:` 등재**(`background-monitoring` · `notifications-dismiss` · `terminal-duration-sql` · `webhook-trigger`): 이 문서가
  아니라 각 기능 spec 의 일이고, 그마저 결함이 아니다 — backend e2e 58개 중 어떤 spec 의 `code:` 에 걸린 것은 7개뿐이다
  (`review_guard._spec_linked_changes` 로 판정). 기능 e2e 를 `code:` 에 넣지 않는 쪽이 정상이라 트래커에 올리지 않는다.
- **자동 요약 기능**: 사용자 결정으로 만들지 않는다.

## Rationale

- **`code:` 에 셋을 넣는 이유(사용자 결정)**: 이 문서의 사실을 기계적으로 지키는 것은 이 셋이다. `code:` 밖에 두면 가드를 약하게
  고치는 변경이 코드 리뷰만 거치고 이 문서와의 대조를 거치지 않는다. 대가는 그 파일들을 고칠 때 `--impl-done` 한 번이다.
- **넷을 넣지 않는 이유**: 전용 가드와 기능 e2e 를 가르는 기준은 «그 파일이 이 문서의 사실을 지키려고 존재하는가» 다. 기능 e2e 를
  넣으면 이 문서가 무관한 기능 변경의 게이트가 된다.
- **`change_summary`(사용자 결정)**: 에디터가 요약을 만들지 않는 것이 현재 제품 동작이다. spec 이 없는 기능을 약속하면 다음 사람이
  그것을 찾거나 전제로 삼는다.

## 체크리스트

- [x] `--spec` 이 draft — `review/consistency/2026/09/19/10_23_21` **BLOCK: NO** (Critical 0 · WARNING 3 · INFO 6). 반영:
      WARNING 1(사용자 가이드가 없는 입력 기능을 안내) → §4 · WARNING 2(R-CC-22 «열거 말고 술어» 와의 거리) → §3 첫 절 ·
      WARNING 3(R-3 연장을 Rationale 에) → §3 둘째 절 · INFO 1 · 2(`code:` 주석) → §1 · INFO 3(게이트 기준 명시) → §3 첫 절은 «`--impl-done` 을 거친다» 까지만 적었다(판정 함수
      `review_guard._spec_linked_changes` 이름은 spec 에 넣지 않았다 — 구현 이름이라 draft §1 «효과» 에만 둔다).
- [x] spec 반영 — planner 커밋 `19f58a3b7` (frontmatter `code:` 셋 + 주석 · §8.1 · Rationale 두 절)
- [x] 가이드 정정 `4a00859cd`(user-guide-writer 위임 → 새 문장이 실행 직전 자동 저장을 빠뜨려 넓힘) · lint · unit(frontend 291파일 ·
      6590) · build PASS · e2e 면제(`PROJECT.md` 화이트리스트 «`codebase/frontend/src/content/docs/**`») · `/ai-review`
      `review/code/2026/09/19/10_42_30` Critical 0 · WARNING 1(이 체크리스트가 낡았고 `plan/complete/` 를 선인용 — 이 커밋으로 닫힘) →
      `codebase/` 수정 0 으로 종결
- [x] 트래커 두 항목 닫기(해소 기록) · 이 draft `plan/complete/` 로
