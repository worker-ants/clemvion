# RESOLUTION — review/code/2026/09/25/16_03_32

SUMMARY: Critical 0 · Warning 8 · INFO 12. 조치는 main 이 직접 했다(판단이 필요한 항목이 섞여 있어 resolution-applier 대신).
정지 규칙(결과 보기 전 선언): «Critical 0 · Warning 0 · 그 라운드의 codebase 수정 0건» — 이 라운드는 수정이 있었으므로 다음 라운드를 돈다.

## 조치 항목

| # | 발견 | 처분 | 커밋 |
| --- | --- | --- | --- |
| W1 | `@Roles()` 전 라우트(≈87)의 403 `error.code` 가 `FORBIDDEN` 에서 전용 코드로 일괄 변경 — announce 필요 | **변경 없음(이미 announce 됨)**. 의도된 변경이고 spec(`12-workspace.md` §Rationale «가드 거부의 오류 코드» · `2-api-convention.md` 기본값 註) · CHANGELOG 항목 «워크스페이스 권한 거부가 코드를 싣고…» 가 전역 범위와 코드 표를 적었다. 이 저장소의 워크스페이스 API 소비자는 자사 frontend 이고, frontend 가 코드로 가르는 자리는 `OWNER_REQUIRED` 하나(가드도 같은 코드) | — |
| W2 | 가드와 서비스가 같은 멤버십을 두 번 조회 | **주석으로 의도 명시**. 서비스 검사는 spec 이 «두 번째 선» 으로 남긴 것이라(가드 인식이 깨질 때) 가드가 읽은 role 을 넘겨받으면 그 선이 가드에 기대 독립성을 잃는다. 비용은 PK 인덱스 조회 1회 · 저빈도 관리 라우트. `workspaces.service.ts` 헬퍼 docstring | `37ee970a2` |
| W3 | `removeMember` 주석 두 곳이 이 PR 로 낡음 | **고침** — e2e 와 같은 모양(취소선 + 2026-09-25 정정) | `37ee970a2` |
| W4 | 역할 서열이 가드 · 두 서비스에 따로 | **고침** — `common/constants/workspace-roles.ts` 한 표에서 파생(`workspaceRoleLevel` · `ADMIN_ROLES`). 테스트 4 + 뮤턴트 R1~R3 KILLED | `37ee970a2` |
| W5 | 403 설명 문자열 8곳 중복 | **고침** — 요구 역할별 모듈 상수 셋. `@ApiForbiddenResponse` 리터럴을 읽는 저장소 가드는 없다(확인) | `37ee970a2` |
| W6 | 초대 서비스 `admin_required` 가 HTTP 로 도달 불가 | **주석으로 명시(제거하지 않음)**. spec `error-codes.md` §3 註가 이미 «가드가 빠졌을 때만 닿는 두 번째 선» 으로 적었다 — 제거하면 그 선이 사라진다 | `37ee970a2` |
| W7 | Swagger 403 설명 갱신이 부분적(`executions.controller.ts` 다른 라우트 등) | **변경 없음(후속 등재됨)** — `swagger.md §5-4` 는 새 엔드포인트 체크리스트이고, 나머지 ~120곳은 트래커 «기존 `@ApiForbiddenResponse` 설명 ~120곳이 가드 거부 코드를 싣지 않는다» 가 실측과 함께 추적한다(reviewer 도 확인). W6 은 위에서 주석으로 처리 | — |
| W8 | `07-workspace-and-team` 유저 가이드 검토 기록 없음 | **검토함 — 갱신 불필요**, plan §구현 중 결정에 근거 기록. 가이드의 권한 서술(역할별 권한 표 · 나가기 · Owner 이양 · 삭제)은 그대로 참이다 — 누가 무엇을 할 수 있는지는 바뀌지 않았다. 바뀐 것은 거부 코드와, frontend 가 만들지 않는 요청(헤더 워크스페이스 ≠ 경로 워크스페이스)의 판정뿐 | (plan 커밋) |
| INFO 6 | 병용 핸들러 + 경로 값 형식 불량 미고정 | **테스트 추가** | `37ee970a2` |
| INFO 9 | 긴 JSDoc 줄 | **재줄바꿈** | `37ee970a2` |
| INFO 7 | `workspaceParamNamesOf` 순서가 `.sort()` 로 가려짐 | **변경 없음** — 가드는 모든 이름을 순회해 순서에 기대지 않는다(reviewer 의 «가드가 선언 순서에 의존» 은 사실이 아니다) | — |
| 그 외 INFO | 1~5 · 8 · 10~12 | 기록만(조치 불요 또는 사용처가 늘 때) | — |

## TEST 결과

- lint: 통과 (`_test_logs/lint-20260925-162820.log`)
- unit: 통과 — backend 10041 passed (`_test_logs/unit-20260925-162917.log`)
- build: 통과 (타입체크 ratchet 포함, `_test_logs/build-20260925-163043.log`)
- e2e: 통과 — 71 스위트 · 390 passed (`_test_logs/e2e-20260925-163406.log`)

## 보류·후속 항목

- W7 의 나머지 설명 ~120곳 — `plan/in-progress/spec-draft-nullable-notation-followups.md` 기존 등재 항목.
- POST 라우트의 200 광고 vs 201 응답(e2e 에서 관측) — 같은 트래커에 등재.
