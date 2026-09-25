# RESOLUTION — review/code/2026/09/25/23_23_40 (2라운드, 전수 `--route=all`)

SUMMARY: Critical 1 · Warning 6 · INFO 9. 14명 전원 결과 확보(forced 7명 누락 없음). 멈춤 규칙(Critical 0 · Warning 0 · 그 라운드
`codebase/**` 수정 0건)에 못 미쳐 조치 후 3라운드로 간다. Critical 이 있어 «수렴 예외» 대상이 아니다 — 전부 고쳤다.

## 조치 항목

| # | 발견 | 처분 | 커밋 |
| --- | --- | --- | --- |
| C1 | Organization Admin 거부 문구가 공유 표(`ROLE_REQUIRED.admin`, 한국어)를 영문으로 덮어써, 메시지를 그대로 토스트로 보이는 프런트엔드 세 자리(scope 전환 · rotate · OAuth 팝업)에 영문이 뜬다 | **고침 — 맞는 지적.** 동작별 한국어 구 + 공유 문구(`adminRequiredError(action)` — «Organization 통합을 삭제하려면 Admin 이상의 권한이 필요합니다.»). 1라운드 이전부터 영문이던 네 자리(create · rotate · request-scopes · scope 전환)도 함께 바뀐다. 동작 7종의 문구를 unit 으로 고정 | `2f3562ce7` |
| W1 | 가시성 · Organization Admin 판정 · 404 · 문구가 OAuth 서비스에 손으로 복제(1라운드 W3 조치의 부산물) | **고침** — `integration-visibility.ts` 의 순수 함수(`assertOrgScopeModifiable` · `adminRequiredError` · `integrationNotFoundError`)를 두 서비스가 함께 쓴다. 두 서비스는 서로를 주입하지 못해(IntegrationsService → OAuth 서비스) 서비스 메서드 공유 대신 순수 함수다 | `2f3562ce7` |
| W2 | 콜백 재판정의 403 문구가 mode 와 무관하게 «reauthorize» · request_scopes 403 테스트 없음 | **고침** — mode → 동작(`request-scopes` · `reauthorize`), 두 mode 의 문구를 테스트로 고정 | `2f3562ce7` |
| W3 | 컨트롤러 캐너리의 «생성자 본인 통과» 가 `oauth/begin` 에 없음 | **고침** — reauthorize · request_scopes 모드에 본인 personal integrationId → OAuth 흐름 시작(Viewer 역할로) | `2f3562ce7` |
| W4 | create 의 `@ApiForbiddenResponse` 만 옛 문구 | **고침** — 같은 보간형 설명 | `2f3562ce7` |
| W5 | CHANGELOG 가 코드 변경의 영향을 자사 frontend 로만 좁혀 적음 | **고침** — 외부 API 호출자 확인 문구 | `2f3562ce7` |
| W6 | 워크스페이스 가이드 RBAC 표(«Viewer = 모든 리소스 읽기 전용»)가 통합 예외와 상충 | **고침** — 표 아래 통합 예외 단락(Personal 은 만든 사람만 · Viewer 의 자기 Personal 재인증 · scope 추가) + 통합 가이드 링크, KO/EN | `2f3562ce7` |
| INFO 4 · 6 | precheck DTO 설명의 반복 문장 · 클래스 docstring | 고침 — 공통 문장 상수 · 클래스 docstring | `2f3562ce7` |
| INFO 1 · 2 · 3 | 조건부 쓰기의 왕복 증가 · 역할 조회를 행보다 먼저 · 가시성 인덱스 | 기록만 — 정합성을 위한 의도된 트레이드오프 · 절대 비용 작음. 역할 조회 순서는 트래커 W6 항목(역할 이중 조회)과 함께 볼 자리 | — |
| INFO 5 · 7 · 8 · 9 | precheck 다중 행 조합 · rotate 의 역할 재조회 범위(기존 결정) · 이름 미변경 시 쓰기 생략 · 1라운드 W3 해소 확인 | 기록만 | — |

**뮤턴트**(2라운드 조치분, 예측/실측): R10(콜백 문구가 mode 를 안 따름) · R11(동작 구 제거) · R12(공유 판정이 역할 서열을 안 봄) — 예측 전부
KILLED / 실측 전부 KILLED.

## TEST 결과

마지막 codebase 편집(`2f3562ce7`) 뒤 전 단계를 다시 돌렸다.

- lint: 통과 (`_test_logs/lint-20260925-234856.log`)
- unit: 통과 — backend 10236 · frontend 6781 (`_test_logs/unit-20260925-234949.log`)
- build: 통과 (타입체크 ratchet 포함, `_test_logs/build-20260925-235111.log`)
- e2e: 통과 — 72 스위트 · 405 passed (`_test_logs/e2e-20260925-235353.log`)
