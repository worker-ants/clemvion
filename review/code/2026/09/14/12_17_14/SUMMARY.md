# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건. WARNING 2건(둘 다 devtime 테스트/문서 하드닝 성격, 프로덕션 코드 영향 없음). forced 화이트리스트(7개) 전원 결과 확보 확인됨 — 강제 목록 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | 신규 repo-guard `unwrap()` 의 `ParenthesizedExpression`(괄호) 언랩 분기가 어떤 테스트로도 커버되지 않는다 — 분기를 통째로 제거해도 10/10 GREEN 유지(직접 뮤테이션·원복으로 확인). JSDoc 은 "as·satisfies·괄호 **전부** 벗긴다"고 명시하지만 실측은 2/3만 잠겨 있음 | `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts:73-74` (`unwrap()` 함수) | `[대조군]` describe 블록에 괄호로 감싼 선언 fixture 케이스 1건 추가 (예: `const X = (['a','b'] as const);` → `readStringArrayConst` 가 `['a','b']` 반환하는지 단언). 기존 `write()` 헬퍼 재사용 가능 |
| 2 | 문서화 | 라운드 2 에서 이미 자기-반증되어 정정된 "9자리" 수치(정정본: 총 13줄=케이스 헤딩3+구획주석7+산문3)가, **함께 편집된 sibling 트래커 문서**에 "(실측)" 표시를 단 채 옛 오류 그대로 잔존 — 정본 이중 서술로 다음 사람이 재검증 없이 오신뢰할 위험 | `plan/in-progress/spec-draft-nullable-notation-followups.md:4143` (vs 정정 표 `plan/in-progress/trigger-canary-hardening.md:169-179`) | `spec-draft-nullable-notation-followups.md:4143` 의 "지금은 9자리 전부 잡힌다(실측)." 문장을 `trigger-canary-hardening.md` 의 정정 표와 동일한 수치(총 13줄, 케이스 헤딩 3 등)로 정정 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] 신규 e2e(`schedule-trigger.e2e-spec.ts`)가 `TriggerDto.workflow` 계약(§3)을 schedule 타입 표면에 처음 시행하는데, 코드가 spec 의 추적성 메타데이터보다 앞서 나가 `2-trigger-list.md` frontmatter `code:` 목록이 이 시행 파일을 아직 반영하지 못함(구현이 계약을 넓혔을 뿐 위반은 아님) | `spec/2-navigation/2-trigger-list.md:6-27` (frontmatter `code:`) | 코드 수정 불요. `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 동일 항목으로 planner 소유 등재됨 — planner 가 `code:` 에 `schedule-trigger.e2e-spec.ts` 한 줄 추가 |
| 2 | 문서 | `spec/conventions/secret-store.md` §R4 가 `TriggersService.delete()` 라 쓰는데 실제 메서드명은 `remove()` (신규 e2e JSDoc 은 정확한 이름을 인용해 이 불일치가 가시화됨) | `secret-store.md:428` vs 실제 코드 `triggers.service.ts:842`(`remove()`) | 코드 수정 불요. 이미 트래커 등재됨 — planner 가 §R4 한 단어(`delete()`→`remove()`) 정정 |
| 3 | 유지보수성 | 신규 가드의 파일-부재 에러 메시지가 자기 파일명(`trigger-secret-columns-guard.ts`)을 문자열로 하드코딩 — 이 파일이 리네임되면 안내 문구 자체가 조용히 낡음 | `trigger-secret-columns-guard.ts:55-58` (`readStringArrayConst` 의 `fs.existsSync` 분기) | `__filename`(또는 `path.basename(__filename)`) 사용, 또는 최소한 리네임 시 이 문자열도 함께 고치라는 안내를 파일 헤더에 추가 |
| 4 | 유지보수성 | AST "래퍼 언랩"(as/satisfies/괄호) 로직이 저장소 내 3곳에서 각기 다른 범위로 독립 재구현됨 | `trigger-secret-columns-guard.ts:68-79` vs `engine-error-code-anchor-guard.ts:90-92, 184-188` | 조치 불요(저장소가 "가드별 독립 순수 로직" 관례를 명시적으로 채택). 4번째 유사 유틸이 생기면 공용 추출 재고 |
| 5 | 테스트 | `readStringArrayConst` 가 동명(同名)의 비-최상위 선언과 실제 대상 선언을 구분하지 못하는 축이 여전히 테스트 0건 (라운드 2 부터 이미 근거와 함께 유보) | `trigger-secret-columns-guard.ts` `visit()` 81-103행 | 급하지 않음. 다음에 이 파일을 손댈 때 JSDoc "최상위 선언 하나 가정" 명시 또는 케이스 추가 |
| 6 | 테스트 | `schedule-trigger.e2e-spec.ts` 에 단건 `GET /api/triggers/:id` 케이스가 없어 `TriggerDto.workflow` 단건 조회 경로의 양성 커버리지가 이 파일 스코프에서 0건 (은폐 아니라 plan 이 스스로 인지하고 명시적으로 좁힌 스코프) | `plan/in-progress/trigger-canary-hardening.md:104` | 이미 트래커 등재됨. 별도 후속 작업으로 처리 |
| 7 | 문서 | 헤더 docstring 이 케이스 헤딩 표기를 `## 가드 N:`(콜론)으로 예시하나 실제 파일은 콜론/em dash 를 혼용 — `grep '가드 [0-9]'` 매칭(목적)에는 영향 없음 | `trigger-workflow-ref.spec.ts` 헤더 JSDoc | 급하지 않음. 다음 편집 시 "구두점은 자유, 숫자만 통일" 한 구절 추가로 모호함 해소 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 실질 코드 diff 6파일 전부 devtime 테스트/가드 — 프로덕션 코드·인증/인가·암호화·네트워크 변경 없음. 하드코딩된 실제 시크릿 없음(키워드 스캔 확인) |
| requirement | NONE | plan 4개 선언 항목 전부 코드와 1:1 대응 확인(10/10, 12/12 GREEN 재실행). SPEC-DRIFT 1건 + spec 오기 1건은 이미 planner 트래커에 정확히 등재됨 |
| scope | NONE | 3커밋 누적 56파일 중 실질 코드는 정확히 6파일(+357/-23), 전부 4개 선언 항목에만 대응. `spec/**` 편집 0건, 범위 이탈 없음 |
| side_effect | NONE | 신규 guard 는 순수 읽기, 신규 spec 은 `os.tmpdir()` 격리+정리, e2e 신규 단언은 기존 순수 assertion 헬퍼 재사용 — 신규 부작용 표면 없음 |
| maintainability | LOW | INFO 2건(자기 파일명 하드코딩, AST 언랩 로직 3곳 독립 재구현) — 둘 다 차단 사유 아님. 라운드 1·2 WARNING/INFO 는 해소 확인 |
| testing | LOW | WARNING 1건(괄호 언랩 분기 미검증, 뮤테이션으로 확인) + 유보 INFO 2건(동명 선언 미구분, 단건 GET 커버리지 0) |
| documentation | LOW | WARNING 1건(정정된 "9자리"→13 수치가 sibling 트래커에 stale 채로 "(실측)" 표시와 함께 잔존) + INFO 1건(헤딩 구두점 혼용) |

## 발견 없는 에이전트

없음 — 다만 security·requirement·scope·side_effect 4개 에이전트는 실질적 조치가 필요한 WARNING/actionable INFO 없이, 전부 "문제 없음 확인" 또는 이미 등재된 사항의 재확인만 보고했다(위험도 NONE).

## 권장 조치사항

1. `trigger-secret-columns-guard.ts` 의 `unwrap()` 괄호(ParenthesizedExpression) 언랩 분기에 대응하는 대조군 테스트 케이스 1건 추가 (WARNING #1) — 기존 `write()` 헬퍼로 저비용.
2. `spec-draft-nullable-notation-followups.md:4143` 의 stale "9자리(실측)" 문장을 `trigger-canary-hardening.md` 의 정정된 표(총 13줄)와 일치하도록 수정 (WARNING #2) — plan 문서 수정이라 developer 권한 내에서 즉시 처리 가능.
3. (선택, 급하지 않음) `readStringArrayConst` 파일-부재 에러 메시지의 자기 파일명 하드코딩을 `__filename` 참조로 교체.
4. (planner 후속, 이미 트래커 등재됨) `2-trigger-list.md` frontmatter `code:` 에 `schedule-trigger.e2e-spec.ts` 추가, `secret-store.md §R4` 의 `delete()`→`remove()` 정정.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음)
  - **제외**: 아래 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — diff 가 devtime 테스트/가드 전용(신규 프로덕션 코드·핫패스 없음), 위 7개 reviewer 보고와 일치하게 성능 영향 표면 없음 |
  | architecture | 라우터 판단 — 신규 모듈 경계·의존 구조 변경 없음(6파일 모두 테스트/가드) |
  | dependency | 라우터 판단 — `package.json`/lockfile 변경 0건(scope 리뷰가 `git diff --stat` 로 확인) |
  | database | 라우터 판단 — 스키마·쿼리 변경 없음, e2e teardown 로직도 diff 밖(unchanged) |
  | concurrency | 라우터 판단 — 신규 동시성 로직·락·큐 변경 없음 |
  | api_contract | 라우터 판단 — 신규 API 엔드포인트·DTO 계약 변경 없음(기존 export 헬퍼 재사용만) |
  | user_guide_sync | 라우터 판단 — 사용자 대면 문서/가이드 영향 없음(devtime harness + e2e 주석) |