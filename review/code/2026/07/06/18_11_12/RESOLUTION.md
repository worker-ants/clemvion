# RESOLUTION — PR3 발사 소스 (18_11_12)

review session: `review/code/2026/07/06/18_11_12/` · risk=MEDIUM, Critical=0, Warning=8

## 조치 항목

| SUMMARY # | 유형 | 조치 | 결과 |
| --- | --- | --- | --- |
| WARNING 3 | testing | @Optional 미주입 시 dispatchExecutionFailedNotification no-op 테스트 | fixed |
| WARNING 4 | testing | workflowRepo.findOne null→createMany 미호출 + reject→no-throw 테스트 | fixed |
| WARNING 6 | testing | schedule notify() reject → engine 에러 rethrow 테스트 | fixed |
| WARNING 7 | testing | schedule workflow.createdBy null → 미발사 테스트 | fixed |
| WARNING 8 | documentation | CHANGELOG Unreleased PR3 항목 추가 | fixed |
| INFO 2 | scope | eslint --fix 가 execution-engine.service.ts 에 무관 cast-cleanup 혼입 → origin/main restore + execution_failed 만 재적용(diff: 64 add/0 del, clean) | fixed |
| WARNING 1 | side_effect | team_invite 이메일 2통 | **skipped(defer→planner)** — spec-literal(channel=both) 구현, UX 결정(both/in_app 하향/링크 생략)은 `spec-update-notifications-firing.md` 위임. 코드 변경 없음 |
| WARNING 2 | side_effect | schedule/workspace 필수 DI 부팅 리스크 | **skipped(문서화)** — monolith 배포 저위험. `@Optional` 은 execution 만: 627KB 스펙의 4개 TestingModule 셋업 무수정 목적의 **테스트 workaround**이지 설계상 optional 아님(schedule/workspace 는 스펙 수정으로 mock 주입해 필수 DI 유지 = 더 엄격). |
| WARNING 5 | testing | 실행실패→dispatch 통합 wiring | **skipped(defer)** — 호출부는 EXECUTION_FAILED emit 직후 단순 await, 메서드 로직 unit 커버. 실행실패 통합 e2e 는 별도 heavy 트랙 |

기타 INFO(dispatch 중복=Rule of Three 전 보류·매직스트링·resource_type 공유=spec-update plan·재시도 중복발사=제품 결정)는 비차단.

## TEST 결과
- lint: 통과 (service 는 --fix 미적용 — 무관 cast-sweep 회피, MY 라인만 수동 정렬; 기존 warning 23건 미변경)
- unit: 통과 (388 suites; execution_failed 6 + schedule 4 + team_invite 3 신규)
- build: 통과
- e2e: 통과 (236 — 3-module DI 배선 검증, restore 후 재실행)

## 보류·후속 항목
- team_invite 이메일 2통 UX 결정 + §1.1 배지 flip → `spec-update-notifications-firing.md`(planner).
- 실행실패 통합 e2e → 별도 트랙.
