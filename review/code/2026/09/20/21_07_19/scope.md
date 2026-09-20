# 변경 범위(Scope) 리뷰 — dup-delete-audit (21_07_19)

## 검증 내역

- `git diff --stat origin/main...HEAD` 로 51개 파일 전체를 재조회해 프롬프트 번들과 정확히 일치함을
  확인했다(누락·추가된 파일 없음). `git diff --stat origin/main...HEAD -- spec/` 는 빈 결과 — `spec/` 는
  전혀 건드리지 않았다(plan 의 `spec_impact: none` 과 일치). `*.json`/`*.yml`/`package.json`/`tsconfig.json`
  전수 검색도 `review/**` 세션 산출물(`_resolution_state.json`, `_retry_state.json` 등) 외의 설정 변경은
  없음을 확인했다.
- 핵심 코드 변경 4파일(`trigger-resource-release.ts`, `trigger-resource-releaser.service.ts`,
  `workflows.service.ts`, `workspaces.service.ts`)이 전부 단일 원인 — 공유 헬퍼
  `lockParentAndListTriggerIds` 가 `pessimistic_write` 로 잠그며 읽은 부모 행의 존재 여부를 버리던 것 —
  으로 수렴한다. `LockedParentTriggers { parentPresence, triggerIds }` 신설과 그 계약을 강제하는 두
  호출부(워크플로·워크스페이스 삭제) 갱신만 있고, 목적과 무관한 라인은 발견되지 않았다.
- `grep -rn "\bparent:"` 로 4개 핵심 파일을 재검사해 리네임(`parent` → `parentPresence`, 2라운드
  WARNING#2 대응)이 완전히 끝났음을 확인했다 — 잔존하는 옛 필드명은 없다.
- 워크스페이스 삭제 경로 확장(`27f488d09`)과 신규 `workspace-delete-concurrency.e2e-spec.ts`
  (`c3607d907`)는 스코프 이탈이 아니라, 트래커 원 항목("동시 중복 DELETE 가 감사 행을 두 번 남길 수
  있다")이 애초에 워크플로에 국한되지 않았고, 같은 공유 헬퍼(`lockParentAndListTriggerIds`)를 워크스페이스
  삭제도 그대로 쓰기 때문에 같은 결함 클래스가 그대로 적용된다. plan 문서(`plan/in-progress/dup-delete-audit.md`
  §B)가 "이미 재검사가 덮는다"던 최초 전제를 취소선으로 남기고 반증 근거(403 오응답 + 거짓 ERROR 로그
  실측)를 붙여 정정한 이력도 확인했다 — 원문 보존 + 국한된 정정 + 실측 병기 요건을 충족한다.
- 테스트 변경(spec 3개 + 신규 e2e 2개)은 전부 새 반환 계약(`{parentPresence, triggerIds}`)과 404 분기만
  검증한다. `workflow-delete-concurrency.e2e-spec.ts`/`workspace-delete-concurrency.e2e-spec.ts` 모두
  `SELECT ... FOR UPDATE` 로 경합을 결정적으로 재현하는 동일 기법을 재사용해, 새 파일 자체가 별도
  설계 표면을 늘리지 않는다.
- `CHANGELOG.md` 는 파일 최상단에 순수 삽입(30줄)만 했고 기존 항목은 불변이다 — 이 저장소가 "동시 X
  두 건" 류 결함마다 지켜온 관례를 따른 것이다.
- `plan/in-progress/dup-delete-audit.md` 신설과 `review/code/2026/09/20/{20_06_26,20_43_03}/**`
  (28개 파일), `review/consistency/2026/09/20/19_30_57/**`(8개 파일) 는 코드 변경이 아니라 이 프로젝트
  SDD+TDD 워크플로가 강제하는 산출물이며, `CLAUDE.md` "정보 저장 위치" 표가 정한 경로에 정확히 놓여
  있다 — `--impl-prep` consistency-check(BLOCK:NO)와 두 라운드의 `/ai-review`(Critical 0, WARNING 각 4건·
  2건 전부 조치) 게이트를 거친 필수 증거물이지 스코프 이탈이 아니다. 이 리뷰(21_07_19)가 세 번째 라운드로,
  이전 두 라운드(20_06_26, 20_43_03)의 `scope.md` 도 각각 독립적으로 "발견사항 없음 / NONE" 으로 판정했고,
  이번 재검토도 그 결론과 달라질 근거를 찾지 못했다.
- 불필요한 리팩토링·기능 확장(over-engineering)·무관한 파일 수정·포맷팅 전용 변경·불필요한 주석·
  미사용 임포트·의도치 않은 설정 변경 — 어느 것도 발견되지 않았다. 추가된 주석은 전부 "왜 이렇게
  했는가"(잠금 뒤 부재 판정 근거, 거짓 로그 억제 근거)를 설명하며 실제 분기 조건과 정확히 대응한다.
- 저장소 뮤테이션 없음 — 전 과정 `Read`/`git diff`/`grep`(read-only)만 수행했고, `git status --short`
  로 이번 세션 출력 디렉터리(`review/code/2026/09/20/21_07_19/`) 외 잔여 변경이 없음을 확인했다.

## 발견사항

없음.

## 요약

작업 목적("동시 워크플로/워크스페이스 DELETE 두 건이 `workflow.deleted` 감사 행을 두 번 남긴다")과
diff 51개 파일 전부가 일대일로 대응한다. 핵심은 공유 헬퍼
`TriggerResourceReleasePort.lockParentAndListTriggerIds` 의 반환 계약을 `string[]` →
`{ parentPresence: 'present'|'absent'; triggerIds: string[] }` 로 바꾼 것 하나이고, 그 계약이 강제하는
두 호출부(워크플로·워크스페이스 삭제)만 실질 동작을 바꿨다. 워크스페이스 경로 확장과 그 전용 e2e 는
스코프 확대가 아니라 같은 헬퍼·같은 결함 클래스에 대한 필연적 대칭 적용이며, plan 문서가 최초 전제의
오류를 취소선+실측으로 정정한 이력까지 남아 있다. 나머지 40개 파일은 이 프로젝트가 강제하는
plan/review 산출물이며 규정된 경로에 정확히 위치한다. `spec/`·설정 파일 변경은 전혀 없고, 목적과 무관한
리팩토링·포맷팅·주석·임포트 정리도 발견되지 않았다.

## 위험도

NONE
