# RESOLUTION — review/code/2026/09/25/22_45_37 (1라운드, 전수 `--route=all`)

SUMMARY: Critical 0 · Warning 11 · INFO 18. 14명 전원 결과 확보(forced 7명 누락 없음). 라운드 전 선언한 멈춤 규칙: «Critical 0 ·
Warning 0 · 그 라운드 `codebase/**` 수정 0건이면 종결». 1라운드라 «수렴 예외»는 쓰지 않는다 — W6 하나만 **범위 밖(전역 가드 변경)** 이라
트래커로 보냈고 그 근거를 아래에 적는다.

## 조치 항목

| # | 발견 | 처분 | 커밋 |
| --- | --- | --- | --- |
| W1 | update · updateScope · 비-OAuth reauthorize 가 판정 뒤 엔티티 전체 `save()` — 그 사이 바뀐 scope 를 되돌리는 lost update · 판정 무력화 | **고침 — 락 대신 compare-and-set.** 판정 근거인 scope 를 쓰기 조건에 싣는다(`judgedRow`) · 바꾸는 컬럼만 `update()`. 그 사이 scope 가 바뀌었으면 0행 → 404 · 감사 없음. 락이 아닌 이유: 삭제가 이미 락 없이 원자적 `DELETE` 의 `affected` 로 동시성을 판별한다(#1372) — 같은 원자성에 판정 근거 한 칸을 더 실었다. `created_by` 는 바뀌지 않으므로 scope 가 같으면 가시성 판정도 유효하다 | `5999aedfe` |
| W2 | remove 가 판정 뒤 재확인 없이 DELETE | **고침** — DELETE 조건에 판정 scope(W1 과 같은 `judgedRow`) | `5999aedfe` |
| W3 | OAuth 재인증 · scope 추가 콜백이 커밋 시점에 인가를 다시 보지 않음(begin ~ 콜백 사이 강등 · scope 변경) | **고침** — 락 안, 자격 증명을 덮어쓰기 직전에 `assertRequesterStillAllowed`(보이는가 → Organization 이면 Admin). `pending_install` 행은 설치 흐름(install_token + HMAC 이 인가)이라 제외 — 그 state 의 `userId` 는 요청자가 아니라 생성자다(`persistReauthorizeState`). 역할을 조회할 수 없으면 fail-closed | `5999aedfe` |
| W4 | 컨트롤러 `resolveRole()` 3줄 블록 8곳 · `userId`/`viewerId` 명명 불일치 | **고침** — `roleOf()` 한 줄 · 명명 `userId` 로 통일(`INTEGRATION_USER_PARAM`) | `5999aedfe` |
| W5 | `oauth/begin` 의 mode 분기가 라우트 전수 캐너리 밖 | **고침** — mode → 판정 동작을 `never` 로 소진하는 switch(`modifyActionOfBeginMode`). 새 mode 는 컴파일에서 멈춘다 | `5999aedfe` |
| W6 | 역할 조회 DB 왕복이 가드 · 핸들러 두 번 | **트래커 등재(범위 밖)** — 없애려면 전역 `RolesGuard` 가 판정한 역할을 요청에 실어야 한다(가드 캐너리 · 경로 워크스페이스 분기와 함께 봐야 하는 전역 변경). 통합 모듈의 기존 패턴(`create` · `rotate`)이고 비용은 요청당 `workspace_member` PK 조회 1회다. 항목: «워크스페이스 역할을 가드와 핸들러가 두 번 조회한다» | (plan 커밋) |
| W7 | 가이드가 Viewer 의 자기 Personal 재인증 · scope 추가를 «불가» 로 적음 | **고침** — 코드(라우트에 `@Roles` 없음 · spec §8)대로 «가능» | `5999aedfe` |
| W8 | 가이드 Danger zone 이 자기 Personal 삭제를 «만든 사람이면 충분» 으로 과장 | **고침** — «Editor 이상인 만든 사람(Viewer 는 자기 것도 불가)» | `5999aedfe` |
| W9 | makeshop precheck 행렬이 cafe24 대비 얇음 | **고침** — 남의 personal · 본인 personal · 남이 만든 organization · fallback | `5999aedfe` |
| W10 | `assertCanRotate` 의 고아 JSDoc | **고침** — 삭제하고 근거(락 전 · 락 안 두 지점)를 `assertCanModify` 로 이전 | `5999aedfe` |
| W11 | `Cafe24PrecheckResultDto` 의 두 필드 설명이 마스킹 조건을 모름 | **고침** | `5999aedfe` |
| INFO 7 · 10 · 11 | create 거부 문구 템플릿 · e2e 순서 의존 · 후보 조회 docstring | 고침 | `5999aedfe` |
| INFO 1 · 2 · 13 | `getForExecution` 미판정 · precheck/409 존재 신호 · 코드 승격의 breaking | 조치 불요 — 후속 plan · spec Rationale 이 받아들인 잔여 · CHANGELOG 기재 | — |
| INFO 3 · 4 · 5 · 6 · 8 · 9 · 12 · 14 · 15 · 16 · 17 · 18 | 인덱스 · Actor 값 객체 · 목록 쿼리 두 벌 · scope 유니언 타입 · 테스트 mock · 메시지 단언 · 빌더 주석 · e2e 보강 · 가이드 트리거 · provider 문서 · 의존성 | 기록만. INFO 15(Viewer 의 자기 Personal 재인증 e2e)는 Viewer 가 Personal 을 만들 수 없어(라우트 floor) e2e 로 세우려면 강등 시나리오가 필요하다 — 서비스 unit(`ownMutations` × viewer)이 덮는다 | — |

**뮤턴트**(1라운드 조치분, 예측/실측): R1(쓰기 조건의 scope 제거) · R3(콜백 재판정 호출 제거) · R4(pending 제외 제거) · R5(콜백 Admin
판정 제거) · R6(콜백 가시성 제거) · R7(begin request_scopes 판정 없음) · R8(update 0행 판정 제거) · R9(fail-open) — 예측 전부 KILLED /
실측 전부 KILLED. 표는 plan.

## TEST 결과

마지막 codebase 편집(`5999aedfe`) 뒤 전 단계를 다시 돌렸다.

- lint: 통과 (`_test_logs/lint-20260925-231250.log`)
- unit: 통과 — backend 10217 · frontend 6781 (`_test_logs/unit-20260925-231352.log`)
- build: 통과 (타입체크 ratchet 포함, `_test_logs/build-20260925-231520.log`)
- e2e: 통과 — 72 스위트 · 405 passed (`_test_logs/e2e-20260925-231818.log`, delete-concurrency · personal-owner 포함)

## 보류·후속 항목

- W6 — 트래커 «워크스페이스 역할을 가드와 핸들러가 두 번 조회한다»(전역 가드 변경).
