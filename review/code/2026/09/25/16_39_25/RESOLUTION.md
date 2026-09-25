# RESOLUTION — review/code/2026/09/25/16_39_25 (2라운드, 전수 `--route=all`)

SUMMARY: Critical 0 · Warning 8 · INFO 10. 새 취약점 없음 — 1라운드 처분이 반영됐음을 14명이 재확인했고, 새 Warning 은 구조 · 테스트 ·
문서 · 하드닝이다. 조치는 main 이 직접 했다. 정지 규칙(«Critical 0 · Warning 0 · 그 라운드 codebase 수정 0건»)상 이 라운드도 수정이
있었으므로 3라운드를 돈다.

## 조치 항목

| # | 발견 | 처분 | 커밋 |
| --- | --- | --- | --- |
| W1 | `ROLE_REQUIRED` 가 역할 서열에서 파생되지 않은 별도 리터럴 | **고침** — 역할 서열 모듈로 옮기고 `Record<WorkspaceRoleName, …>` 로 타입을 묶었다(키 누락 = 컴파일 오류). 키 동등성 테스트 추가 | `85a38d00f` |
| W2 | 거부 본문이 가드와 서비스에 따로 | **고침** — `NOT_A_MEMBER` · `ROLE_REQUIRED` 한 표를 `RolesGuard` · `WorkspacesService` · `AuthService`(전환 두 번째 선)가 쓴다. 예외에는 펼쳐서 넘긴다 | `85a38d00f` |
| W3 | `decoratorCallName` 복제 | **고침** — `common/__test-utils__/source-scan.ts` 로 | `85a38d00f` |
| W4 | 다중 `@WorkspaceParam` 테스트가 «마지막만» 회귀를 못 잡음 | **고침** — 역순 케이스 + 전부 멤버 케이스. 뮤턴트 R4(첫째만) · R5(마지막만) 모두 KILLED | `85a38d00f` |
| W5 | 전환 라우트 OpenAPI 설명이 header-first 를 광고 | **고침** — «이 라우트는 경로 :id 만 본다, header-first 는 전환 뒤 다른 API 의 규칙» | `85a38d00f` |
| W6 | `@Roles()` 오탈자가 fail-open | **고침** — 인자를 `WorkspaceRoleName` 유니온으로. 타입 단언(`@ts-expect-error`)을 스펙에 두어 build 의 타입체크 ratchet 이 본다 — 뮤턴트(`string[]` 로 넓힘) → ratchet `roles.guard.spec.ts: 0 → 1` RED | `85a38d00f` · `fdd7d8ff7` |
| W7 | 가드+서비스 이중 조회의 지연 실측 없음 | **변경 없음 — 근거를 실측으로 댄다.** 추가 조회는 `workspace_member` 의 `@Unique(['workspaceId','userId'])` 유니크 인덱스 조회 1회이고, 그 선언이 실제 DB 에 있음은 기존 e2e 가드 `entity-schema-declarations` 가 대조한다. 대상은 관리 라우트 15곳(저빈도). 이중 조회는 spec 이 «서비스 계층 검사는 남는다» 로 정한 두 번째 선의 비용이고, 가드가 읽은 role 을 넘기면 그 선이 가드에 기대 독립성을 잃는다(1라운드 W2 처분과 같은 근거) | — |
| W8 | CHANGELOG 에 전역 범위가 강조되지 않음 | **고침** — 리뷰어는 `.md` 를 changeset 에서 못 봤다(예산). 기존 항목도 «전역» 을 적었지만 수치(editor 66 · admin 9 · owner 7 · viewer 5)와 «`error.code` 로 분기하는 클라이언트는 확인할 것» 을 더해 분명히 했다 | `85a38d00f` |
| INFO 8 | `AuthService` 전환 재조회에 의도 주석 없음 | **고침** — 두 번째 선 주석 | `85a38d00f` |
| INFO 5 | `common` 스펙이 `modules` DTO 를 import | **변경 없음** — 테스트 코드 한 줄이고, 그 import 가 «DTO 가 받는 역할 = 서열의 역할» 을 고정하는 대조 대상이다 | — |
| INFO 9 | `assertMember` 이름 | **변경 없음** — docstring 이 멤버십 + 역할 판정을 적는다 | — |
| 그 외 INFO | 1~4 · 6 · 7 · 10 | 기록만 | — |

## TEST 결과

- lint: 통과 (`_test_logs/lint-20260925-170311.log`)
- unit: 통과 — backend 10045 passed (`_test_logs/unit-20260925-170401.log`)
- build: 통과 (타입체크 ratchet 194건 baseline 일치 포함, `_test_logs/build-20260925-170532.log`)
- e2e: 통과 — 71 스위트 · 390 passed (`_test_logs/e2e-20260925-170859.log`)

## 보류·후속 항목

없음(1라운드 후속 두 건은 트래커에 그대로).
