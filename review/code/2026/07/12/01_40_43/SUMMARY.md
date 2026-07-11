# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical/Warning 0건. 전 리뷰어가 NONE~LOW 를 보고했고 모든 발견사항은 INFO(참고) 수준이며, 실질적으로 새로운 조치가 필요한 항목은 없다(대부분 직전 리뷰 세션(`01_10_15`)의 WARNING 2건이 정확히 해소되었음을 재검증한 결과이거나, 이미 plan/RESOLUTION 에 의도적으로 defer 처리된 사안의 재확인).

## Critical 발견사항

없음.

## 경고 (WARNING)

없음. (직전 세션 WARNING#1(Testing: `threadMessages=undefined` 커버리지 갭·오해 소지 코멘트), WARNING#2(Documentation: `mergeMessages` JSDoc 이 실제 동작과 불일치)는 커밋 `462a23e4e` 에서 해소되었음을 requirement/testing/documentation/maintainability 4개 리뷰어가 독립적으로 재검증함.)

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | mock 인증 토큰 문자열(`iext_prev`, `iext_x` 등)이 테스트 코드에 다수 등장하나 fetch mock 반환값일 뿐, 실 시크릿과 무관 | `use-widget-eager-start.test.ts` | 조치 불필요 |
| 2 | Security | `[user-input]...[/user-input]` 마커 strip 검증 — 기존 sanitize 로직에 대한 긍정적 회귀 가드(HTML/XSS 이스케이프 자체는 스코프 밖) | `use-widget-eager-start.test.ts` "복원 통합" 테스트 | 조치 불필요 |
| 3 | Security | 에러 메시지 일반화(CWE-209 방지) 기존 테스트가 이번 diff 로 훼손되지 않음 확인 | `use-widget-eager-start.test.ts` | 조치 불필요 |
| 4 | Security | 세션 토큰을 `sessionStorage`(XSS 지속성 낮음)에 저장하는 기존 PR #874 패턴을 신규 테스트가 그대로 전제 — 신규 도입 아님 | `use-widget-eager-start.test.ts` | 조치 불필요 |
| 5 | Requirement | `plan/in-progress/webchat-multiturn-restore-test.md` 의 `/consistency-check --impl-done` 체크박스가 아직 `[ ]` — 프로세스 gate, 본 리뷰(`--impl-done` 직전 단계) 이후 수행 예정으로 판단되어 blocking 아님 | `plan/in-progress/webchat-multiturn-restore-test.md` | 리뷰 이후 impl-done 체크 진행 |
| 6 | Scope | `mergeMessages` JSDoc 재작성(로직 무변경)이 plan 범위·RESOLUTION 표에 명시적으로 추적된 정당한 수정임을 확인 | `codebase/channel-web-chat/src/lib/widget-state.ts` | 조치 불필요 |
| 7 | Scope | `DisplayMessage` type-only import 는 `user()`/`bot()` 헬퍼에 실사용, 불필요한 임포트 아님 | `widget-state.test.ts` | 조치 불필요 |
| 8 | Scope/Side Effect/Documentation | 직전 리뷰 세션(`review/code/2026/07/12/01_10_15/**`) 산출물 11개 신규 파일 커밋 — CLAUDE.md 규약(`review/` 산출물 커밋 대상)에 부합, 애플리케이션 코드·설정 영향 없음, 시크릿 없음 | `review/code/2026/07/12/01_10_15/**` | 조치 불필요 |
| 9 | Side Effect | `mergeMessages` 는 배열을 참조 그대로(clone 없이) 반환하나, 현재 두 프로덕션 호출부 모두 `threadToMessages(...)` 가 매번 새 배열을 생성해 넘기므로 aliasing/mutation 위험 없음 | `widget-state.ts:614-617`, `use-widget.ts:154,240` | 향후 캐시된 배열을 넘기는 호출부가 생기면 방어적 복사 고려(현재 스코프 밖) |
| 10 | Side Effect | 신규 통합 테스트의 전역 stub(`fetch`/`EventSource`/`sessionStorage`)은 파일 레벨 `beforeEach`/`afterEach` 로 이미 격리, 신규 위험 없음 | `use-widget-eager-start.test.ts:641-702` | 조치 불필요 |
| 11 | Maintainability/Testing | 신규 "복원 통합" 테스트가 `installFetch()`/`installControllableSse()` 공용 빌더 대신 ~30줄 인라인 `fetchMock` 골격을 재복제(파일 전반 기존 관례 답습). 직전 세션에서 이미 INFO 로 지적되어 후속 리팩터로 명시적 defer됨(RESOLUTION.md INFO 1) | `use-widget-eager-start.test.ts:641-702` | 후속 리팩터 시 `installFetchWithStatusContext(...)` 류 공용 헬퍼로 GET status 분기 추출 권고. 이번 diff 단독 조치 불요 |
| 12 | Testing | `seedWaitingFromStatus` 의 soft-fail(네트워크 오류/5xx) 경로가 복원 통합 문맥에서 미검증 — 본 PR 이전부터 존재하던 갭, 이번 diff 가 신규로 만든 것 아님 | `use-widget.ts:225-251` | 선택적 후속: "getStatus 실패 시 SSE replay 만으로 복구" 케이스 추가 |
| 13 | Testing | `buttons`/`form` interactionType 복원 시 `threadMessages` 시드 미검증 — 이전 라운드 지적이 plan 에 명시적 out-of-scope(carve-out)로 문서화되어 추적 가능한 의도적 축소로 전환됨 | `plan/in-progress/webchat-multiturn-restore-test.md`, `use-widget-eager-start.test.ts` | 조치 불필요(이미 처리됨) |
| 14 | Documentation | `mergeMessages` 함수명·테스트 describe 제목·블록 코멘트에 "병합(merge)" 표현이 여전히 잔존 — JSDoc 은 이미 "선택(select), interleave/dedup 아님"으로 정확히 정정되어 기능적 결함 아님, 어휘상 낮은 우선순위 잔여 | `widget-state.test.ts` describe 제목 | 후속 커밋에서 함수명(예: `selectMessages`) 또는 describe 제목 표현을 JSDoc 과 일치시키는 것 고려(우선순위 낮음) |
| 15 | Documentation | plan 문서 e2e 소요시간 표기(`216s` vs `229s`) 불일치가 회차 구분으로 명확히 해소됨, e2e 면제 화이트리스트 인용도 `PROJECT.md:99` 원문과 정확히 일치 확인 | `plan/in-progress/webchat-multiturn-restore-test.md` | 조치 불필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 제품 로직 변경 0(JSDoc 1건 제외), 신규 공격 표면 없음. 마커 strip/에러 일반화 등 긍정적 회귀 검증 |
| requirement | NONE | 직전 WARNING 2건 해소를 소스·spec·테스트 실행 3중 재검증(63/63 PASS). spec §2/§3.1 과 line-level 정합 |
| scope | NONE | plan 범위와 diff 1:1 대응, 불필요한 리팩토링/기능확장/무관 수정 없음 |
| side_effect | NONE | reducer 순수성 유지, 전역 stub 격리 확인, 참조 반환 이슈는 현재 호출부 기준 안전 |
| maintainability | LOW | fetchMock 인라인 재복제(이미 defer), JSDoc-테스트-코드 추적성 개선 긍정적 |
| testing | NONE | WARNING 2건 해소 확인 + 촘촘한 경계 테스트(`>=` mutation 즉시 검출). 잔여 갭은 모두 스코프 밖/의도적 defer |
| documentation | NONE | JSDoc 정정 line-level 검증, plan 문서 표기 불일치 해소 확인. "병합" 어휘 잔존은 non-blocking |

## 발견 없는 에이전트

없음(전 에이전트 INFO 이상 최소 1건씩 보고했으나, 모두 non-blocking 이며 다수는 긍정적 확인/재검증 성격).

## 권장 조치사항

1. (선택, 낮은 우선순위) 후속 리팩터 시 `use-widget-eager-start.test.ts` 의 반복되는 GET status `fetchMock` 골격을 `installFetchWithStatusContext(...)` 류 공용 헬퍼로 추출(maintainability/testing 공통 지적, 이미 RESOLUTION 에 defer 기록됨).
2. (선택, 낮은 우선순위) `mergeMessages` 관련 "병합" 어휘(함수명·describe 제목)를 정정된 JSDoc("선택", interleave/dedup 아님)과 일치시키는 네이밍 정리를 다음 접촉 시 고려.
3. (선택) `seedWaitingFromStatus` soft-fail 경로 및 `buttons`/`form` interactionType 복원 시드에 대한 커버리지는 plan 에 명시된 대로 별도 후속 백로그로 남긴다(현재 blocking 아님).
4. `plan/in-progress/webchat-multiturn-restore-test.md` 의 `/consistency-check --impl-done` 체크박스를 본 리뷰 완료 후 진행.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 아래 표 (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (실행된 7명 전원이 router_safety 로 강제 포함됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | diff 가 test-only + 문서/리뷰 아티팩트로 성능 영향 경로 없음(router 판단) |
  | architecture | 아키텍처 구조 변경 없음(JSDoc 정정 1건 제외 로직 무변경) |
  | dependency | 의존성/패키지 변경 없음 |
  | database | DB/쿼리 관련 변경 없음 |
  | concurrency | 동시성 로직 변경 없음(reducer 순수 함수 무변경) |
  | api_contract | API 계약(엔드포인트/DTO) 변경 없음 |
  | user_guide_sync | 사용자 가이드 문서 동기화 대상 변경 없음(test-only) |