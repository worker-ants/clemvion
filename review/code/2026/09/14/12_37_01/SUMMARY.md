# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건, WARNING 1건(신규 repo-guard 의 한 분기가 대조군 없이 열려 있음, 뮤테이션 실측으로 확인). forced 화이트리스트 7개 reviewer 전원 결과 확보됨(누락 없음) — 강제 미이행으로 인한 거짓 clean 아님.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing / requirement (중복 통합) | `readStringArrayConst` — "이름이 일치하는 선언을 찾았지만 초기값이 배열 리터럴이 아닌" 분기가 대조군 테스트로 한 번도 실행되지 않는다. 이 함수의 JSDoc 이 `null`(못 읽음) vs `[]`(빈 배열)을 명시적으로 가른다고 선언하는데, 그 경계의 한쪽 진입로가 열려 있다. 뮤테이션 실측: 이 분기를 `null` 대신 `[]` 를 반환하도록 바꿔도 `npx jest trigger-secret-columns.spec.ts` 가 **11/11 GREEN 유지**(대조 실험으로 `unwrap()` 언랩 로직을 단일 패스로 바꾸는 뮤턴트는 5/11 즉시 RED — 다른 분기는 정상 판별력을 가짐을 확인). 현재 실제 대상 3개 상수 파일은 모두 배열 리터럴이라 지금 당장 기능 결함은 아니다. | `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts:89-100` (소비 spec: `trigger-secret-columns.spec.ts`) | `it('선언은 있지만 배열이 아니면 null', () => { const rel = write('non-array.ts', "const X = { a: 1 };\nexport default X;"); expect(readStringArrayConst(tmp, rel, 'X')).toBeNull(); });` 형태의 대조군 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability | 파일 부재 에러 메시지가 자기 파일명(`trigger-secret-columns-guard.ts`)을 문자열 리터럴로 하드코딩 — 리네임 시 안내 문구가 자동 갱신 안 됨(검출 능력엔 영향 없음). 라운드 3 RESOLUTION 에서 "리네임 시 함께 고칠 자리"로 이미 유예 처분됨 | `trigger-secret-columns-guard.ts:55-58` | 조치 불필요(처분됨). 다음 리네임 접촉 시 `__filename` 검토 |
| 2 | maintainability | AST 래퍼-언랩(`unwrap`) 로직이 `engine-error-code-anchor-guard.ts` 등과 유사 목적으로 저장소에 독립적으로 3벌 존재(완전 중복은 아님) | `trigger-secret-columns-guard.ts:68-79` | 조치 불요 — "가드별 독립 순수 로직" 관례 유지, 4번째 유틸 생기면 추출 재고 |
| 3 | maintainability | `expectTriggerWorkflowRef(x, { present: true, expectedWorkflowId })` 동일 인자 형태 호출 3곳 반복(서로 다른 독립 시나리오 회귀 방어라 공용화 시 오히려 의도 흐려짐) | `schedule-trigger.e2e-spec.ts:277-280,392-395,429-432` | 조치 없음 |
| 4 | testing | `readAllTriggerSecretColumnLists`(3개 원자 함수를 배선하는 합성 함수) 자체를 겨냥한 전용 단위 테스트 없음 — "정본·사본이 실제로 다르면 잡는다"는 이 PR 핵심 동기가 현재는 우연히 일치하는 실 데이터에만 의존해 간접 검증됨 | `trigger-secret-columns-guard.ts:109-123` | 필수 아님. 참고용 기록 |
| 5 | security | 신규 repo-guard 는 파일 경로 인자를 전부 하드코딩 상수로만 받아 경로 탐색 위험 없음, AST 파싱만 사용해 코드 실행 경로 없음, 대조 대상 3곳 값이 diff 시점에 실제로 일치함을 직접 grep 확인(가드가 검증하는 대상 자체가 유효) | `trigger-secret-columns-guard.ts` 전반, `triggers.service.ts:104-107`, `schedule-trigger-ref.ts:24-27`, `trigger-workflow-ref.ts:45-48` | 조치 불필요 |
| 6 | security | e2e 파일의 더미 시크릿 값(hex32/hex64, `xoxb-*`, `111:*`)은 diff 범위 밖(기존 코드)이며 실제 provider 키 아님 — 재확인. `secret_store` 고아 row 무해성 서술은 프로덕션 삭제 경로(`secret-store.md §R4`)와 경계를 diff 안에서 명시적으로 유지 | `chat-channel-trigger-create.e2e-spec.ts:46-47,76-79`, `trigger-workflow-ref.e2e-spec.ts:136,148-168` | 조치 불필요 |
| 7 | requirement | spec 문서 자체의 결함 2건(`2-trigger-list.md` frontmatter `code:` 가 신규 파일들을 누락, `secret-store.md §R4` 의 `delete()`가 실제 `remove()`와 불일치)이 존재하나, developer 권한 밖이라 직접 고치지 않고 `spec-draft-nullable-notation-followups.md` 에 planner-owned 항목으로 정확히 등재됨 | `plan/in-progress/spec-draft-nullable-notation-followups.md` (약 3935·3942행) | 조치 불필요 — planner 턴에서 처리될 사항 |
| 8 | requirement (절차 노트) | 리뷰 도중 공유 워크트리에서 `trigger-secret-columns-guard.ts` 에 uncommitted 뮤테이션(비-배열 분기를 `null` 대신 `[]` 반환하도록 변경)이 관측됨 — requirement reviewer 본인이 만든 것이 아니며(세션 시작 시 원본 상태로 Read, 이후 Edit/Write 미호출) 원복하지 않고 그대로 보고. 다른 reviewer(testing 계열로 추정)가 동시에 같은 가설을 검증 중이었던 것으로 판단됨. 위 WARNING#1 의 결론과 별개로 코드 정적 분석만으로도 동일 결론이 성립함 | (해당 없음 — 절차 기록) | 정보 공유. resolution-applier 는 이 파일에 남은 uncommitted diff 가 있는지 착수 전 `git status` 로 재확인 권장 |
| 9 | documentation | 라운드 1~3에서 지적된 항목(plan 수치 불일치 "9자리"→13, `schedule-trigger.e2e-spec.ts` 헤더 bullet 미반영, 중첩 템플릿 리터럴, 원문자→아라비아 숫자 통일)이 HEAD 시점에 전부 실제로 해소됨을 grep/Read 재현으로 확인 | `trigger-workflow-ref.spec.ts`, `trigger-canary-hardening.md:172-174`, `schedule-trigger.e2e-spec.ts:27-29` | 조치 불필요 — 검증 완료 |
| 10 | scope | `codebase/**` diff 6개 파일 전부 plan 이 선언한 4개 항목에 1:1 대응, 범위 이탈 없음. `review/**`·`plan/**` 나머지 70개 파일은 harness 의무(4회 `/ai-review`+`--impl-done`) 산출물로 지정 저장 위치 규약 준수 | 전체 diff (`git diff origin/main...HEAD`) | 조치 불필요 |
| 11 | side_effect | 신규 코드는 전역 가변 상태·네트워크·DB 호출 없음. 임시 파일 I/O 는 `os.tmpdir()` 격리 + `afterAll` 확실한 회수. e2e 신규 단언 3곳은 기존 export 헬퍼를 시그니처 변경 없이 재사용 — 새 자원 소비/누수 경로 없음 | `trigger-secret-columns-guard.ts:46-123`, `trigger-secret-columns.spec.ts:99-109`, `schedule-trigger.e2e-spec.ts:277-280,392-395,429-432` | 조치 불필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 프로덕션 코드 무편집, repo-guard 경로 하드코딩·AST-only 로 신규 공격 표면 없음, 3중 사본 값 실측 일치 확인 |
| requirement | LOW | `readStringArrayConst` 비-배열 분기 대조군 누락(WARNING, testing 과 중복 통합). spec 문서 결함 2건은 이미 올바르게 planner 백로그 등재됨 확인. 공유 워크트리 뮤테이션 관측(절차 노트) |
| scope | NONE | codebase diff 6개 파일 전부 plan 4항목에 1:1 대응, 범위 이탈 없음 |
| side_effect | NONE | 신규 코드 순수 읽기 전용, 임시 I/O 완전 봉쇄, 기존 헬퍼 재사용으로 새 부작용 없음 |
| maintainability | LOW | 라운드3 이후 codebase diff 0줄. INFO 3건 전부 이미 유예/조치불요 처분된 항목의 재확인 |
| testing | LOW | `readStringArrayConst` 비-배열 분기 미감지를 뮤테이션(11/11 GREEN 유지)으로 직접 실측 확인(WARNING). 대조 실험(unwrap 단일패스 뮤턴트, 5/11 RED)으로 다른 분기 판별력은 정상임도 확인 |
| documentation | NONE | 라운드 1~3 지적사항 전부 HEAD 시점 해소를 grep/Read 재현으로 확인. 신규 CRITICAL/WARNING 없음 |

## 발견 없는 에이전트

security, scope, side_effect, documentation — 실질 결함 없음(NONE), 검증/확인성 INFO만 보고.

## 권장 조치사항

1. (최우선, WARNING 해소) `readStringArrayConst` 에 "선언은 있으나 초기값이 배열 리터럴이 아님" 대조군 `it()` 추가 — `trigger-secret-columns.spec.ts` 에 `write('non-array.ts', "const X = { a: 1 };\nexport default X;")` 케이스와 `toBeNull()` 단언.
2. (선택, 낮은 우선순위) `readAllTriggerSecretColumnLists` 합성 함수를 겨냥한 전용 fixture 테스트 고려 — 필수 아님.
3. 나머지 INFO 항목(자기 파일명 하드코딩, AST unwrap 3중 독립 존재, `expectTriggerWorkflowRef` 반복 호출, spec 문서 오기 2건)은 이미 이전 라운드에서 유예/백로그 처분되었거나 검증 완료된 사항이므로 이번 라운드에서 추가 조치 불필요.
4. resolution-applier 는 착수 전 `git status --short` 로 requirement reviewer 가 보고한 공유 워크트리 uncommitted 변경(다른 reviewer 의 뮤테이션 실험 잔재 가능성) 여부를 확인할 것 — 있다면 항목 1 fix 와 충돌하지 않도록 정리 후 진행.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **제외**: 표 (reviewer · 이유, 7명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명 — 전원 강제 대상이며 전원 결과 확보됨, 누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 와 무관 |
  | architecture | router 판단상 이번 diff 와 무관 |
  | dependency | router 판단상 이번 diff 와 무관 |
  | database | router 판단상 이번 diff 와 무관 |
  | concurrency | router 판단상 이번 diff 와 무관 |
  | api_contract | router 판단상 이번 diff 와 무관 |
  | user_guide_sync | router 판단상 이번 diff 와 무관 |