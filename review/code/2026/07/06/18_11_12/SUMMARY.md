# Code Review 통합 보고서 (PR3 발사 소스 3종)

## 전체 위험도
**MEDIUM** — CRITICAL 없음. team_invite 이메일 2통(미확정, planner 위임) + 2개 서비스 필수 DI 확장(side_effect) + 다수 testing 커버리지 갭 + unrelated cast-sweep(scope, eslint --fix 부작용). security/requirement/scope reviewer disk-gap.

## Critical
없음.

## 경고 (WARNING)
| # | 카테고리 | 발견 | 조치 |
|---|----------|------|------|
| 1 | side_effect | team_invite(channel=both) → 기존 가입자 이메일 2통(초대링크 + 알림) | **defer(planner)** — spec-update-notifications-firing.md 결정 항목(both/in_app/링크생략). 코드 변경 없음(spec-literal) |
| 2 | side_effect | schedule/workspace NotificationsService 필수 DI — split 배포 시 부팅 리스크 | **awareness** — monolith 저위험. execution 만 @Optional 인 건 627KB 스펙 셋업 회피용 workaround(설계 아님) — RESOLUTION 문서화 |
| 3 | testing | @Optional no-op guard 미검증 | **fix** — 미주입 시 no-op 테스트 |
| 4 | testing | workflowRepo.findOne null/reject catch 미검증 | **fix** — null→createMany 미호출, reject→no-throw 테스트 |
| 5 | testing | runExecution FAILED→dispatch wiring 통합 미검증 | **defer** — 호출부 trivial(emit 직후 await), 메서드 unit 커버. 실행실패 통합 e2e 는 heavy |
| 6 | testing | schedule notify() reject 케이스 미검증 | **fix** — notify reject→engine 에러 rethrow 테스트 |
| 7 | testing | schedule workflow.createdBy null 가드 미검증 | **fix** — createdBy null→미발사 테스트 |
| 8 | documentation | CHANGELOG PR3 항목 누락 | **fix** — Unreleased 항목 추가 |

## 참고 (INFO) — 주요
- INFO#2 (scope): eslint --fix 가 execution-engine.service.ts 에 unrelated cast-cleanup 혼입 → **fix**: origin/main 에서 restore + execution_failed 만 재적용(diff clean).
- INFO#5 (@Optional silent no-op): 향후 module import 누락 시 무음 — 문서화됨. INFO#6 (resource_type 공유): spec-update plan 등재. INFO#7 (재시도마다 schedule_failed 중복 발사): 정책 확인 사항(제품 결정). 나머지: dispatch 중복(Rule of Three)·매직스트링=기존 패턴, 저우선.

## 에이전트별
| 에이전트 | 위험도 |
|----------|--------|
| side_effect | MEDIUM (team_invite 2통·DI 확장) |
| testing | LOW (커버리지 갭 다수, fix) |
| documentation/architecture | LOW |
| maintainability/concurrency | NONE |
| security/requirement/scope | 재시도 필요(disk-gap) |

## 판정
critical=0, warning=8. fix: 3/4/6/7/8 + INFO#2(scope restore). defer: 1(planner)/2(문서화)/5(통합 e2e). SPEC-DRIFT=spec-update-notifications-firing.md 위임. fix 후 fresh review 로 수렴.
