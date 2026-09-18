# Plan 정합성 검토 — `spec/conventions/`

## 컨텍스트

이번 `--impl-prep` 대상은 `plan/in-progress/spec-draft-deletion-cascade-indexes.md`
(워크트리 `usage-log-workflow-index-5b1e07`, 다음 단계가 정확히 이 `--impl-prep`)다. 이 draft 는
`node_execution`/`integration_usage_log`/`llm_usage_log` 삭제 연쇄 FK 인덱스 V112~V116 을
같은 PR 에서 구현할 계획이며, `spec/conventions/` 안에서 실제로 관련 있는 부분은
`spec/conventions/migrations.md §5`(인덱스 마이그레이션 패턴) 뿐이다. 번들이 전달한
`spec/conventions/` 스코프는 관련 conventions 디렉토리 전체가 딸려 온 것으로 보이며, 대부분
(`chat-channel-adapter.md`·`error-codes.md`·`node-output.md` 등)은 예산 초과로 본문이
절단돼 있다. 절단된 파일은 실제 저장소 파일을 직접 읽어 교차 확인했다.

## 발견사항

- **[INFO]** `migrations.md §5` 는 이번 draft 의 구현 계획과 정합
  - target 위치: `spec/conventions/migrations.md §5` (번들에는 절단, 디스크 원본으로 확인)
  - 관련 plan: `plan/in-progress/spec-draft-deletion-cascade-indexes.md` §"구현 (같은 PR, developer 턴)",
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "`CREATE INDEX CONCURRENTLY IF NOT EXISTS` 재실행 위험" 항목(완료 표시, 2026-09-05)
  - 상세: §5 말미 콜아웃은 "`CREATE INDEX CONCURRENTLY` 를 쓰는 파일은 교체든 신규 추가든 … `CREATE` 앞에 invalid 잔재 정리(`DROP INDEX CONCURRENTLY IF EXISTS <이름>`)를 둔다" 로 이미 일반화돼 있다(V111 draft 가 `--spec` WARNING 2 처방으로 "교체만" → "신규 추가도" 로 넓혀 놓음). 이번 draft 의 "구현" 절이 명시한 "파일당 `CREATE INDEX CONCURRENTLY` 하나 + 앞에 `DROP INDEX CONCURRENTLY IF EXISTS` + `.conf executeInTransaction=false`" 패턴과 정확히 일치한다. `codebase/backend/migrations` 최신 파일도 V111 이라 V112~V116 채번에 공백·충돌이 없다.
  - 제안: 조치 불요 — 선행 plan(닐러블 표기 후속 트래커)이 이미 이 conventions 문서를 정정해 둔 상태이며 이번 draft 는 그 규약을 그대로 따른다.

- **[INFO]** `cafe24-api-catalog` mains 모순 — 기존에 등재된 미해결 항목, 이번 PR 과 무관
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` `## Rationale` "미문서화 seed 9개 outright 제거 (G-3l, 2026-06-27)" 문단, `spec/conventions/cafe24-api-catalog/category.md` 표(`mains_list`/`mains_add` 만 존재) + `category/mains.md` field-level 문서(`PUT`/`DELETE /mains/{display_group}` 여전히 실존 docs 항목으로 기재)
  - 관련 plan: `plan/in-progress/cafe24-backlog-residual.md` `## mains_update/mains_delete 제거 근거가 field-level 카탈로그와 모순 (2026-07-26 발견)` — "처리 (착수 시)" 4개 체크박스 전부 미해결
  - 상세: `_overview.md` Rationale 은 `mains_update`/`mains_delete` 가 "Cafe24 공식 docs 에 부재 확정" 되었다고 여전히 단정하지만, 같은 target 디렉토리의 field-level 카탈로그(`category/mains.md`)는 지금도 `PUT`/`DELETE /mains/{display_group}` 를 공식 docs anchor 와 함께 실존 항목으로 기록하고 있다(직접 확인: `### PUT …Update main category` / `### DELETE …Delete main category` 존재). 두 target 문서가 서로 반대 사실을 SoT 로 주장하는 모순이 그대로 남아 있다. 이 모순은 2026-07-26 에 **다른 무관한 티켓**(`ie-resume-turn-boundary-cancel`)의 `--impl-prep spec/conventions` 스코프에서 발견돼 "그 PR 범위 밖" 으로 판단하고 plan 으로 이관됐는데, 이번에도 **또 다른 무관한 티켓**(현재 draft, 삭제 연쇄 인덱스)의 넓은 conventions 번들에 딸려 재등장했다 — 두 번째 우회 경유다.
  - 제안: 이번 draft(FK 인덱스 작업)의 범위는 아니므로 이 PR 을 막을 필요는 없다. 다만 이 항목이 "무관한 티켓 스코프에 딸려서만 재발견되는" 패턴이 반복되고 있으므로, 별도로 `cafe24-backlog-residual.md` 의 해당 항목("Cafe24 공식 docs 에서 PUT/DELETE 실존 여부 재확인")을 독립적으로 착수해 닫는 편을 권장한다.

## 요약

이번 `--impl-prep` 대상 draft(`spec-draft-deletion-cascade-indexes.md`, V112~V116 FK 인덱스)는
`spec/conventions/migrations.md §5` 의 기존 규약(DROP-먼저 + CONCURRENTLY 패턴, 이미 선행
plan 이 정정해 둔 상태)과 완전히 정합하며, 이 draft 가 가정하는 선행조건(V111 까지의 마이그레이션
번호, `--spec` 처분 반영)도 모두 충족돼 있다. `spec/conventions/` 번들에 함께 실린 cafe24
API 카탈로그 쪽에서 `mains_update`/`mains_delete` 존재 여부를 둘러싼 기존 미해결 모순
(`cafe24-backlog-residual.md`, 2026-07-26 등재)이 여전히 열려 있으나 이는 이번 PR 의 작업
범위와 무관하며 이미 plan 에 추적 중이므로 차단 사유는 아니다. 나머지 conventions 문서(`error-codes.md`·`node-output.md`·`secret-store.md` 등)는 번들 예산 초과로 본문이 절단돼 있었고, 이번 draft 와 직접 연관된 참조가 없어 별도 교차 확인은 생략했다.

## 위험도

NONE
