# RESOLUTION — chat-channel/WORKSPACE 후속 잔여 정리

> 대상 review: `review/code/2026/06/12/18_01_52/SUMMARY.md` (위험도 LOW · Critical 0 · Warning 3 · INFO 8)

## 처리 요약

Critical 0. Warning 3건 전부 fix. INFO 중 #1 동반 처리, 나머지는 비차단 — 아래 dispositions 참조.

### Warning (전부 해소)

| # | 발견 | 조치 | 위치 |
|---|------|------|------|
| 1 | `translateBackendError` 직접 단위 테스트에 신규 chat-channel 5종 행동 검증 부재 | 케이스 (7)(ko→ERROR_KO 반환) / (8)(en→fallback) 추가 — 5종 일괄 루프 | `backend-labels.test.ts` |
| 2 | generator 컨테이너 kind 가드에 전용 테스트/문서 부재 | `resp_param_rows` docstring 에 컨테이너 제외 규칙 명문화 + `_overview.md §7.3` 에 수동 회귀 검증 레시피 추가 | `_generator.py`, `_overview.md` |
| 3 | `triggers.en.mdx`(EN) callout 동반 갱신 누락 (stale "Some codes may appear in English") | EN callout 을 "All codes are shown as localized Korean messages…" 으로 갱신 (KO parity) | `triggers.en.mdx` |

### INFO dispositions

- **INFO#1** (`WORKSPACE_ID_REQUIRED` parity guard 미포함) → **fix**: `LOCALIZED_ERROR_CODES` 에 추가 + 공용 데코레이터 코드임을 주석. 이미 `ERROR_KO` 에 존재해 guard 통과.
- **INFO#6** (`resp_param_rows` docstring 컨테이너 규칙 미반영) → **fix**: Warning#2 처리에 포함.
- **INFO#3** (`TRIGGER_NOT_FOUND` 번역 "웹훅 엔드포인트") → **유지**: 영문 SoT 가 "Webhook endpoint not found" (hooks.service.ts, chat-channel 외 webhook 공통) 이므로 충실한 번역. 변경 시 SoT 와 괴리.
- **INFO#2** (generator 캐시 경로 트래버설 이론적 가능성) → **비차단**: 입력이 신뢰된 Cafe24 공식 HTML + 개발자 전용 CLI. 별 task 후보.
- **INFO#4/#5/#7** (guard stale-entry 미탐지 / spec_impact 스키마 문서화 / generator 전반 테스트 부재) → **비차단 기술 부채**, 본 변경 범위 밖. 기록만.
- **INFO#8** (generator 재실행 시 타 카탈로그 파일 변경 가능성) → **기록**: 본 PR 은 generator 로직 fix + 명시 대상 `appstore-orders.md` 만 hand-fix. `order`/스칼라 충돌을 공유하는 다른 카탈로그 파일(~25건)은 **재생성(HTML+네트워크 필요) 시 자동 정정** 대상으로 남김 (silent cap 아님 — 본 RESOLUTION + `_overview.md §7.3` 에 명시). 무관 파일 100여 건 hand-edit 은 scope 규율상 배제.

## scope 리뷰 누락 註
SUMMARY 에 기록된 대로 `scope.md` 출력 파일이 생성되지 않아 scope 결과는 통합에서 빠졌다 (강제 포함 목록엔 있었음). 변경 set 이 i18n 매핑·문서·generator 로 범위가 명확하고 의도 외 변경이 없어 비차단으로 판단.

## TEST 결과

review fix(코드 변경: `backend-labels.test.ts`) 후 전 단계 재수행 — 마지막 코드 commit 다음에 전 단계 통과:

- lint: PASS (37s)
- unit: PASS (frontend 199 files / 4296 tests + backend; `schedules-page.test.tsx` 1회 flaky timeout 발생 → 격리 재실행 10/10 PASS, 재-full-run PASS. 본 변경과 무관한 testing-library async timeout)
- build: PASS (63s)
- e2e: PASS (188 tests, 67s) — `.claude/tools/run-test.sh e2e` (docker compose 실 Postgres/Redis/MinIO)

e2e: **통과**. 변경 set 이 e2e 화이트리스트 밖(`backend-labels.test.ts` .ts)이라 수행함.

## consistency-check (--impl-done spec/conventions/) 결과

산출: `review/consistency/2026/06/12/18_18_36/SUMMARY.md` — **BLOCK: NO** (Critical 0, WARNING 2, INFO 10).

- **WARNING#1 (해소)**: `_overview.md §7.3` 회귀 검증 예시로 `order/orders.md` 를 명시했는데 해당 파일은 미수정이라 자가 불일치. → 동일 PR 에서 unambiguous `order` 정렬-충돌 래퍼를 `order/orders.md`(2행) + `store/orders-setting.md`(2행) 까지 `(응답 객체)` 로 정정. 이로써 §7.3 예시와 실제가 일치.
- **WARNING#2 (비차단)**: `application.md` 인덱스 표 `restricted` 컬럼 누락 — 선택 컬럼이라 규약 위반 아님. 향후 규약 갱신 시 고려.
- **INFO#1/#8 (기록)**: `order`/스칼라 충돌 외의 다른 충돌명(`links` 등)을 공유하는 잔여 field-level 파일은 다수가 정당한 property-list 설명(예: `coupons → 쿠폰 리소스`)이라 일괄 hand-edit 부적절. generator 재생성(HTML+네트워크) 시 자동 정정 대상으로 `cafe24-backlog-residual.md` 에 backlog 노트 추가. 본 PR 은 generator 로직 + unambiguous `order` 케이스(3파일)까지로 범위 한정.
- **INFO#8 (plan_coherence, 확인)**: `fix-spec-frontmatter-catalog.md` 는 `git mv` 로 `in-progress/` 원본 제거 완료(RM) — complete/ 이동 완전.
- 나머지 INFO(Rationale 섹션 부재, off-by-one 주석 번호, 이중밑줄 패턴 미정의 등)는 비차단 doc nit — 기록만.
