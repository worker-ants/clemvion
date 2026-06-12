# RESOLUTION — chat-channel/WORKSPACE 후속 잔여 정리 (최종 수렴 리뷰)

> 대상 review: `review/code/2026/06/12/18_58_19/SUMMARY.md` — **LOW · Critical 0 · WARNING 2 · INFO 12**
> 본 세션은 이전 두 리뷰(`18_01_52`, `18_31_37`)의 경고를 fix 한 뒤 최종 상태에 대해 돌린 수렴 리뷰다.
> 리뷰 히스토리: `18_01_52`(W3 fix) → `18_31_37`(BOT_TOKEN_INVALID/SETUP_FAILED 추가 등 W4 fix) → `18_58_19`(수렴).

## 처리 요약

Critical 0. 남은 WARNING 2건은 모두 **의도된 비차단 trade-off**(generator 재생성 후속 + 자동화 테스트 기술 부채)로, 코드 결함이 아니다. 추가 코드 변경 없음.

### WARNING dispositions

| # | 발견 | disposition |
|---|------|-------------|
| 1 | generator 재실행 시 타 카탈로그 파일 추가 변경 가능 | **의도/기록**: 본 PR 은 generator 로직 fix + unambiguous `order` 충돌 3파일(appstore-orders·orders·orders-setting)만 hand-fix. 잔여(`links` 등 충돌명, 다수가 정당한 property-list 설명)는 false-positive 위험이라 hand-edit 부적절 — 수정된 generator 로 전체 재생성 시 일괄 정정. `cafe24-backlog-residual.md §G-4` + `_overview.md §7.3` 에 명시. |
| 2 | `_generator.py` `resp_param_rows` pytest 부재 | **disposition(기술 부채)**: 프로젝트에 cafe24 generator(spec/conventions/ 하 standalone CLI)를 수집하는 pytest 하니스가 없다(.claude/tests 는 harness 툴링 전용, run-test.sh unit 은 node). docstring 에 컨테이너 제외 규칙 명문화 + `_overview.md §7.3` 수동 회귀 검증 레시피로 대체(리뷰어 수용 대안). `§G-4` 에 장기 pytest 추적. |

### INFO dispositions (주요)

- **INFO#2 (`TRIGGER_NOT_FOUND` 번역 범용성)**: **유지**. 영문 SoT 가 "Webhook endpoint not found"(hooks.service.ts, chat-channel 외 webhook 공통)이므로 충실한 번역. 변경 시 SoT 와 괴리.
- **INFO#3/#4/#5 (테스트 코드 중복 열거 / 코드 구분 주석 / 주석 상세도)**: 비차단 스타일 — 현 주석 수준이 신규 코드 추적성에 유익. 유지.
- **INFO#8 (`WORKSPACE_ID_REQUIRED` callout 미포함)**: callout 코드 목록에는 이미 포함돼 있음(triggers.mdx/en 둘 다). guard·ERROR_KO 도 등재. 정합.
- **INFO#9/#10/#11 (plan-lifecycle `spec_impact`/`(unstarted)` sentinel 미정의, 후속 항목 링크)**: **별 doc task**. plan-lifecycle.md 규약 보강은 본 구현 범위 밖 — 비차단 기록. `(unstarted)` 는 이미 sibling plan(`spec-sync-auth-gaps.md` 등)에서 de facto 사용 중인 값을 따른 것.
- **INFO#1/#6/#7 (generator 경로 트래버설 / parity 단방향 / generator 전반 테스트)**: 기존 기술 부채·이론적 — 비차단.
- **INFO#12 (docstring 컨테이너 규칙)**: 이미 `18_01_52` 라운드에서 보강 완료.

## 직전 리뷰(18_31_37) 경고 처리 결과 (본 세션에서 fix 확인)

- W#1(BOT_TOKEN_INVALID/CHAT_CHANNEL_SETUP_FAILED ERROR_KO 미등재): **fix** — ERROR_KO + callout(KO/EN) + parity guard + 행동 테스트 추가. spec §5.4 8종 전부 ko 커버.
- W#2(WORKSPACE_ID_REQUIRED 직접 행동 테스트 부재): **fix** — 케이스 (9) 추가.
- W#3/#4(generator pytest / CI path): disposition(위 WARNING#1/#2 참조). generator 는 수동 CLI 전용 — CI 자동 실행 경로 없음.
- 직전 라운드 W1(테스트 it-title "5종" vs 7 코드): **fix** — "7종" 정정 + 출처 주석 보강.

## TEST 결과

마지막 코드 변경(테스트 it-title "5종"→"7종") 후 전 단계 재수행 — 마지막 코드 commit 다음에 전 단계 통과:

- lint: PASS (38s)
- unit: PASS (frontend 4296 tests incl. backend-labels 20 / backend)
- build: PASS (64s)
- e2e: PASS (188 tests, 67s) — `.claude/tools/run-test.sh e2e` (docker compose 실 인프라)

e2e: **통과**. 변경 set 이 e2e 화이트리스트 밖(`backend-labels.test.ts` .ts)이라 수행.

## consistency-check (--impl-done spec/conventions/) 최종 결과

산출: `review/consistency/2026/06/12/19_04_18/SUMMARY.md` — **BLOCK: NO** (Critical 0, WARNING 2, INFO 7). 최종 코드 상태(BOT_TOKEN_INVALID 등 추가 + 5종→7종 fix) 기준 재수행 — push Gate 2(spec-linked impl-done freshness) 충족.

- **W#1 (fix)**: `_overview.md §7.1` 의 `<entity_id>` "(snake_case)" → "(kebab-case)" 정정 (실제 파일명·생성기 모두 kebab). spec-only.
- **W#2 (disposition)**: `INVALID_BOT_TOKEN`(입력 검증) ↔ `BOT_TOKEN_INVALID`(provider 인증) 명명 반전 — `INVALID_BOT_TOKEN` 은 **기존 API 에러 코드**(chat-channel.controller.ts·spec §5.4)로 본 PR 은 i18n 매핑만 추가. rename 은 backend throw-site + spec + test 동반 breaking 변경이라 본 i18n followup 범위 밖. 별 task 후보로 기록.
- **INFO#1 (fix)**: `store/users.md` line 136·195 의 wrapper `order`(↳↳↳ 자식 보유 = 컨테이너) → `(응답 객체)`. 동일 generator 버그 검증 후 정정. §7.3 예시 + §G-4 에 반영.
- **INFO#2~#7 (disposition)**: Rationale 절 부재 / "Retreive" docs 원문 오탈자 / G-4↔G-1-remaining 순서 / TRIGGER_NOT_FOUND 배열 그룹핑 / G-4 순번 확인 — 전부 비차단 doc nit·기존 패턴. §G-4 backlog + 본 RESOLUTION 기록으로 갈음.

> 위 spec-only 수정(_overview.md·store/users.md·plan)은 codebase 파일이 아니므로 push review-guard Gate 1(code review freshness)·Gate 2(impl-done freshness, spec-linked **codebase** 대상)에 영향 없음.
