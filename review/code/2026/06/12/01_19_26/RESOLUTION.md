# RESOLUTION — DB_HOST_BLOCKED PR (그룹 2b)

ai-review `review/code/2026/06/12/01_19_26` — RISK=LOW, 0 Critical, 6 Warning.
(rate-limit 으로 1차 summary 실패 → resume 로 재생성, reviewer outputs 는 캐시 재사용.)

## Warning 처리

| # | 발견 | 판정 | 조치 |
|---|------|------|------|
| 1 | SPEC-DRIFT: 2-database-query §4 callout 이 구버전(INTEGRATION_CALL_FAILED/"향후 통일 후보") | **FALSE POSITIVE** | reviewer 가 origin/main baseline 을 읽음. `git diff origin/main...HEAD` 3-dot 으로 반증 — §4 callout 은 이미 `DB_HOST_BLOCKED` 로 갱신됨(commit 6525597c). |
| 2 | SPEC-DRIFT: 3-error-handling §1.4·§3.2 Database 행에 DB_HOST_BLOCKED 누락 | **FALSE POSITIVE** | 동일 main-baseline FP. 3-dot diff 에 두 행 모두 `DB_HOST_BLOCKED` 추가 확인. |
| 3 | SPEC-DRIFT: 2-database-query §5.3·§6.2 에 DB_HOST_BLOCKED 누락 | **FALSE POSITIVE** | 동일 FP. 3-dot diff 에 §5.3 enum·§6.2 행 추가 확인. |
| 4 | i18n: `backend-labels.ts ERROR_KO` 에 DB_HOST_BLOCKED 한국어 매핑 누락(HTTP_BLOCKED 대칭) | **FIXED** | `ERROR_KO` 에 DB_HOST_BLOCKED KO 메시지 추가(HTTP_BLOCKED 바로 뒤). FE lint clean. (참고: EMAIL_HOST_BLOCKED 는 본디 ERROR_KO 미등재 — pre-existing gap, 본 PR 범위 밖.) |
| 5 | Testing: MySQL 드라이버 DB_HOST_BLOCKED 경로 테스트 누락 | **FIXED** | `mysqlIntegrationWithHost` 헬퍼 + MySQL 차단 테스트 1건 추가(createPool 미호출·DB_HOST_BLOCKED·메시지 일반화·logUsage 단언). 72 unit green. |
| 6 | Testing: `ALLOW_PRIVATE_HOST_TARGETS` env-mutation 병렬 간섭 가능성 | **ACCEPTED** | Jest 는 파일 단위 worker 격리(별도 프로세스)라 다른 spec 파일과 env 가 공유되지 않음. 동일 파일 내 직렬 실행 + `try/finally` 복원으로 충분. reviewer 도 "파일 단위 워커 격리 보장 시 현 수준 충분" 명시. 추가 격리 불요. |

INFO(서버 로그에 차단 host structured field, SSRF 메시지 공유 상수화, §5.3 JSON 예제, chat-channel-adapter §3.1 `DB_*` 명시 주석 등)는 선택 개선 — 일부는 기존 follow-up(SSRF 메시지 일반화 audit)과 연계, 본 PR 범위 밖 유지.

## 비고
- scope reviewer output_file 미존재(요약에 미포함) — 라우터는 scope 를 forced 로 실행했으나 산출 파일 누락. 본 변경은 plan 항목(DB_HOST_BLOCKED 신설)에 정확히 대응하므로 scope 이탈 위험 낮음.
- side-effect INFO(에러코드 INTEGRATION_CALL_FAILED→DB_HOST_BLOCKED 승격이 기존 분기 워크플로우에 영향 가능) — PR 본문/릴리스 노트에 명시.

## consistency-check `--impl-done` (`review/consistency/2026/06/12/01_19_26`) — BLOCK: NO, MEDIUM

| # | Checker | 발견 | 판정 | 조치 |
|---|---------|------|------|------|
| W1 | Cross-Spec | 3-error-handling §1.4·§3.2 Database 행에 DB_HOST_BLOCKED 미등재 | **FALSE POSITIVE** | main-baseline FP. 3-dot diff 에 두 행 모두 DB_HOST_BLOCKED 확인(W1/2/3 ai-review FP 와 동일 원인). |
| W2 | Naming Collision | `spec/2-navigation/4-integration.md` 에러코드 vocabulary 표에 DB_HOST_BLOCKED 미등재(EMAIL_HOST_BLOCKED 대칭) | **FIXED** | 표에 DB_HOST_BLOCKED 행 추가. 같은 표에 HTTP_BLOCKED 도 누락돼 있던 pre-existing C-3 gap 도 함께 보강(세 *_BLOCKED 대칭 완성). |
| W3 | Convention | 2-database-query §5 dry-run 출력 구조 미문서화(Principle 11) | **DEFERRED** | dry-run 은 본 PR 이전 기존 기능 — DB_HOST_BLOCKED 와 무관한 pre-existing 문서 갭. 별도 spec 항목으로 분리(범위 밖). |
| W4 | Convention | 1-http-request §5.3.2 output.response.error 폐기 일정 미명시 | **DEFERRED (부분 처리됨)** | 본 PR diff 밖. 그룹2a(PR #551)에서 이미 "Deprecated" 명시로 강화. 폐기 일정/plan 항목화는 별도 follow-up. |
| W5 | Plan Coherence | PR #551 과 3-error-handling.md 동일 파일 수정 — merge 충돌 위험 | **ACKNOWLEDGED** | 실제로는 #551=HTTP/EXECUTION_TIMEOUT 행, 본 PR=Database 행으로 *다른 행* (인접 hunk). 머지 순서 1→2a→2b 로 조율, 충돌 시 trivial. PR 본문에 명시. |
| I3 | — | http-ssrf plan DB_HOST_BLOCKED 체크박스 미완료 | **FALSE POSITIVE** | 본 PR commit 6525597c 에서 이미 `[x]` 처리(main-baseline FP). |
| I8 | Convention | cafe24 appstore-orders `order` wrapper 행 오기입 | **OUT OF SCOPE** | group1 consistency 에서도 검출된 무관 pre-existing 결함(별도 기획 정리). |

## 최종 상태
build PASS · backend lint PASS · FE lint(backend-labels) PASS · DB handler 72 unit + classifier green.
ai-review: in-scope Warning(4,5) 해소, FP(1,2,3) 반증, (6) 수용. consistency: BLOCK NO, W2 fix·
나머지 FP/deferred/merge-coordination. 0 Critical.
