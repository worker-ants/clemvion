# RESOLUTION — review/code/2026/06/06/16_43_17 (PR-B2b 최종 리뷰: resolution-fix 델타)

본 리뷰는 full-B3 ai-review(`15_45_59`) 의 resolution-applier fix(`a053630f`: 신규
단위테스트 + `failFirstSegmentSetup` catch 가드 + stale 주석 정정) 와 spec flip
잔여(`35524fe4`) 를 커버하는 **freshness 보강용 최종 리뷰**다. **Critical 0**.
11 Warning 은 (a) false-positive SPEC-DRIFT 2건, (b) 테스트 유지보수 nitpick, (c)
이미 수용/추적된 설계 항목으로, 추가 코드 변경 없이 disposition 한다 (리뷰-게이트
무한루프 회피 — `feedback_review_gate_loop_avoidance`: 실 이슈 2회 cycle 로 해소 완료,
본 3차는 polish 만 발견).

## 조치 항목

| SUMMARY # | 분류 | 판정 | 근거 |
|---|---|---|---|
| W1 | SPEC-DRIFT | **무효(false positive)** | reviewer 가 L914 를 "PR-B2 후속 커밋 미구현" 으로 봤으나, 현 spec L910-916 은 이미 완료형(`driveCallStackResume` frame-by-frame, 버전가드)으로 flip 됨(commit `35524fe4`/`5dc6444f`). stale line ref. `grep "후속 커밋에서 구현\|미적용\|구현 예정"` → 잔존 0. |
| W2 | SPEC-DRIFT | **무효(false positive)** | L415/L417 "PR-B2b 미적용" 잔존 주장이나 §4.x banner 는 이미 완료형 flip 됨. L412-418 실제 내용은 WebsocketService canonical sink 결정(무관). stale line ref. |
| W3 | Maintainability | **보류(수용)** | 테스트 모듈 setup 중복(`buildTestModule` 팩토리 추출 권장) — 비차단 유지보수. 후속 test-refactor 로 이관. |
| W4 | Maintainability | **보류(수용)** | `service2`/`service3` 네이밍 — 비차단. 후속. |
| W5 | Maintainability | **보류(수용)** | Subject 타입 분산 선언 통합 — 비차단. 후속. |
| W6 | Requirement | **보류(수용)** | non-sentinel 폴백 테스트가 한국어 경고 문자열 의존 — 동작 검증은 유효(폴백 진입 + payload passthrough). 메시지 안정 키 전환은 후속. |
| W7 | Requirement | **보류(수용)** | W7 테스트 로그 문자열 의존 — 동작(2차 오류 흡수) 검증은 유효. 후속. |
| W8 | Requirement | **보류(수용)** | W3 테스트 callStack 타입을 공개 `ResumeCallStack` 로 교체 권장 — 비차단(`{version,frames}` 호환). 후속. |
| W9 | Side Effect | **보류(수용)** | repo 필드 직접 재할당 vs `jest.spyOn` — 현 순서 오염 없음(`afterEach` 격리). spyOn 전환은 후속. |
| W10 | Side Effect | **수용(설계)** | `failFirstSegmentSetup` 2차 오류 `.catch` 흡수 시 row PENDING/RUNNING 잔류 가능 — `recoverStuckExecutions`(30분) 백스톱으로 수습. BullMQ 이중 실행 차단이 우선(의도된 trade-off). 관측 메트릭은 후속 고려. |
| W11 | Documentation | **추적됨** | `driveResumeDetached` 명칭 vs await 동작 불일치 — plan "잔여 doc polish" 에 이미 등재(비차단). |

INFO(I1~I15): 테스트 커버리지 보강(processButtonResumeTurn 전용 describe, frames=[] 경계, 화이트리스트 필터 assert 등) + 매직 문자열 enum 화 등 — 모두 비차단 polish, plan follow-up 으로 이관.

## TEST 결과
- lint  : 통과 (eslint 0 error; e2e 파일 기존 `any` warning 2건은 비차단)
- unit  : 통과 (execution-engine 690+ / executions 포함 772 pass)
- build : 통과 (nest build, 0 TS error)
- e2e   : 통과 (dockerized 176 pass — 중첩 D6 게이트 포함; 본 리뷰 델타는 신규 단위테스트 + 주석/가드라 e2e 재실행 불요분이나 직전 full set 통과 상태 유지)

## 보류·후속 항목
- W3~W9 + INFO 테스트 polish(setup 팩토리·네이밍·타입 통합·메시지 안정키·spyOn·커버리지 보강): 별도 test-refactor 작업으로 이관(비차단, 정확성 영향 없음, 현 772 unit green).
- W10 observability 메트릭, W11 `driveResumeDetached` rename: plan `exec-park-durable-resume.md` "잔여 doc polish / umbrella 잔여" 에 등재.
- SPEC-DRIFT W1/W2 는 무효(이미 flip 완료) — 조치 불요.
