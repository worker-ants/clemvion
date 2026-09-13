# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 공유 트래커 파일에 이번 작업과 무관한 새 백로그 항목이 포함돼 있다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` — `cafe24-api-metadata.md §4` Principle 7→0 오인용 항목 (`git diff origin/main...HEAD` 확인 시 추가된 체크박스)
  - 상세: `guide-identifier-existence` 가드 작업과 완전히 무관한 별개 결함(`spec/conventions/cafe24-api-metadata.md`)을 같은 트래커 파일에 등재한다. 다만 이 저장소의 확립된 관례(`developer` 는 `spec/` 쓰기 권한이 없어 `--impl-prep` 중 발견한 것을 그 턴에 `plan/` 백로그로 등재해야 함)를 정확히 따랐고, 항목 자체에 "(선재, 무관)"이라고 스스로 명시해 은폐 없이 투명하게 기록했다. 이전 5개 리뷰 라운드(`14_41_14`~`16_04_15`)의 scope reviewer 가 전부 같은 결론(조치 불요)에 도달했고 이번 검증에서도 동일하다.
  - 제안: 조치 불요 — 프로젝트 관례상 정당한 처리다.

- **[INFO]** 가드 파일 교체가 `git mv` 대신 delete+create 로 이뤄져 이력이 끊긴다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts`/`guide-error-code-scan.ts`(삭제) → `guide-identifier-existence.test.ts`/`guide-identifier-scan.ts`(신규)
  - 상세: `git diff --stat origin/main...HEAD` 상 rename 이 아니라 통째 delete+add 로 기록된다. 내용이 축 구조·기준집합·허용목록까지 실질적으로 재설계됐으므로 순수 리네임은 아니지만, `git blame`/`--follow` 추적이 끊긴다. 이 결함은 라운드 1~2 scope/dependency 리뷰어가 이미 지적했고, RESOLUTION 라운드에서 "실측 결과 `--find-renames=25%` 로도 D+A 로 기록됨(회고적 재작성 비용이 이익보다 큼)"으로 처분 확정됐다 — 재발이 아니라 기존 처분의 재확인이다.
  - 제안: 조치 불요(이미 처분 완료, 되돌리는 비용이 더 큼).

- **[INFO]** 방대한 `review/code/**`·`review/consistency/**` 산출물 커밋이 diff 대부분(152개 변경 파일 중 143개)을 차지한다
  - 위치: `review/code/2026/09/13/{14_41_14,15_03_06,15_24_12,15_42_54,16_04_15}/**`, `review/consistency/2026/09/13/{12_33_41,14_41_43,15_03_36,15_23_53,15_43_24,16_04_45}/**`
  - 상세: `git diff --stat origin/main...HEAD -- 'codebase/**' 'plan/**' CHANGELOG.md PROJECT.md` 로 실제 코드/문서 변경만 추리면 9개 파일·934 삽입/393 삭제로 좁혀진다. 나머지는 `/ai-review`·`/consistency-check` 라운드마다 생성되는 리뷰 산출물이며, 프로젝트 관례상 라운드 종료 시 커밋 대상이다(임의 확장이 아니다). scope 관점에서 "코드 변경"으로 셀 대상이 아니라고 판단한다.
  - 제안: 조치 불요.

- **[INFO]** 이번 라운드(round 5, 커밋 `1984d72d3`)의 실제 diff 는 직전 리뷰(`review/code/2026/09/13/16_04_15` requirement WARNING#1)에 대한 좁고 정확한 응답이다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`(`CODE_FIELD` 경계 `(?<![A-Za-z])`→`(?<!\w)`, 상단에 정규식 5개 감사 표 추가) / `guide-identifier-existence.test.ts`(`collectSourceTokens` 대조군 5건 + `error_code`/`http_code` 판별 fixture 2건 추가) / `plan/in-progress/guide-identifier-existence.md`(§E 라운드 5 절 + 라운드 표 갱신)
  - 상세: 지적된 결함(밑줄 포함 키 오탐)의 정정, 그 결함 클래스를 겨냥한 회귀 fixture, 그리고 plan 라운드 표의 정직한 갱신으로만 구성된다. 요청 범위를 넘는 신규 기능·리팩토링·무관 파일 수정은 없다.
  - 제안: 없음.

## 요약

`origin/main` 대비 실질 코드/문서 변경(`CHANGELOG.md`·`PROJECT.md`·`codebase/frontend/src/lib/docs/__tests__/guide-{error-code,identifier}-*`·`plan/in-progress/guide-identifier-existence.md`·`plan/in-progress/spec-draft-nullable-notation-followups.md`, 9개 파일)은 트래커 항목 하나("가이드가 적는 식별자가 실재하는지 세는 가드가 없다")를 닫는 단일 목적에 수렴한다. `guide-error-code-*` → `guide-identifier-*` 리네임, 환경변수 축 추가, 허용목록 4강제 도입은 임의 확장이 아니라 plan·코드 주석에 실측 근거(과거 결함 `MCP_INSECURE_URL_ALLOWED` 를 구 가드 3축이 전부 놓친다는 사실)와 함께 정당화돼 있다. 가장 최근 커밋(`1984d72d3`, round 5)은 직전 리뷰 라운드의 지적 하나(`CODE_FIELD` 경계 오류)에 대한 좁은 수정+회귀 테스트+plan 갱신뿐이다. `spec-draft-nullable-notation-followups.md` 에 등재된 `cafe24-api-metadata.md` 무관 항목과 delete+create 로 인한 이력 단절은 스코프 경계선에 있지만, 둘 다 이전 라운드에서 이미 검토·처분됐고 프로젝트가 명문화한 절차(무관 발견 즉시 등재, 재작성 비용 대비 회고적 이력 복구 불요)를 따른다. 포맷팅·주석·임포트·설정 파일 관점에서 실질 변경과 섞인 무의미한 변경은 관찰되지 않았다. `review/code/**`·`review/consistency/**` 하위의 대량 신규 파일은 다수의 `/ai-review`·`/consistency-check` 라운드 산출물이며 관례상 커밋 대상이라 스코프 크리프로 보지 않는다.

## 위험도

LOW
