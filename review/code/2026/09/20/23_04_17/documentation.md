# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** 트래커 정정 문구가 아직 존재하지 않는 `plan/complete/trigger-dup-delete.md` 경로를 선인용
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` 게이트 4767, 4794
    (각각 "`plan/complete/trigger-dup-delete.md`. 처방대로 락 안 재조회..." / "`plan/complete/trigger-dup-delete.md` 가 `TriggersService.remove()` 를 고쳐...")
  - 상세: 두 문구 모두 이 plan 이 이미 `plan/complete/` 로 이동한 것처럼 인용하지만, 실제로는
    `plan/in-progress/trigger-dup-delete.md` 로 여전히 in-progress 상태이고(`ls plan/complete/trigger-dup-delete.md` →
    없음), 그 파일 자신의 체크리스트에도 `/ai-review` 수렴 · `--impl-done` · 트래커 항목 해소+`plan/complete/` 이동
    세 항목이 이번 diff 시점 기준 아직 미체크(`[ ]`)로 남아 있다. 흥미롭게도 이 "`plan/complete/...`" 표현은
    직전 라운드 documentation 리뷰(`review/code/2026/09/20/22_39_21/documentation.md:8`)가 제안한 문구를
    거의 그대로 따온 것으로 보인다 — 그 리뷰어 자신도 아직 일어나지 않은 이동을 앞당겨 인용하는 문구를
    제안했었다. 같은 이슈를 이번 라운드의 `scope.md`(게이트 4767 대상, INFO·"경계 사례, 차단 사유 아님")도
    독립적으로 짚었다.
  - 제안: 조치는 선택적이다 — 실제로 `plan/complete/`로 옮겨지기 전까지는 `plan/in-progress/trigger-dup-delete.md`
    로 표기하거나, "완료되면 `plan/complete/`로 이동 예정"이라는 시제를 명시해 두면 다음 사람이 존재하지
    않는 경로를 찾아보는 헛수고를 줄일 수 있다. 이 plan 이 실제로 `plan/complete/`로 이동하는 커밋에서
    함께 정정해도 무방하다.

- **[INFO]** 같은 관측을 두고 `concurrency` 리뷰어가 매긴 등급([INFO])이 다운스트림 문서에서 `WARNING`으로 격상 인용됨
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` 게이트 4585
    ("`/ai-review` `review/code/2026/09/20/22_07_23` side_effect·concurrency WARNING 1 이 소스를 직접 확인")
  - 상세: 인용 대상인 `review/code/2026/09/20/22_07_23/side_effect.md`의 해당 항목(외부 provider teardown
    중복 호출)은 실제로 `[WARNING]`이 맞지만, 같은 세션의 `review/code/2026/09/20/22_07_23/concurrency.md`는
    바로 이 관측을 "이 diff 의 결함은 아님 — 정보 제공" 섹션에 `[INFO]`로 명시해 뒀다(직접 대조 확인).
    즉 "side_effect·concurrency WARNING 1"이라는 표기는 두 리뷰어가 **똑같이 WARNING 등급으로 수렴**한
    것처럼 읽히지만 실제로는 side_effect 만 WARNING 이고 concurrency 는 INFO 다. 같은 표현이
    `plan/in-progress/trigger-dup-delete.md:91`과 `review/code/2026/09/20/22_39_21/requirement.md:22`
    에도 반복돼 이미 세 문서에 퍼져 있다(단, 뒤의 두 곳은 이번 diff 범위 밖의 기존 텍스트/과거 세션
    산출물이라 이번 PR 이 새로 만든 것은 첫 번째뿐이다). 기능적 영향은 없지만, "두 리뷰어 독립 수렴"이라는
    이 조직의 관용구가 실제로는 "한 리뷰어는 WARNING, 한 리뷰어는 참고용 INFO"였던 사례라 다음 사람이
    잔여 위험의 무게를 과대평가할 소지가 있다.
  - 제안: 조치 불필요에 가깝다 — 굳이 정정한다면 "side_effect WARNING 1(concurrency 도 같은 관측을 INFO 로
    교차 확인)"처럼 등급을 분리해 적으면 더 정확하다.

## 요약

이번 diff 의 실제 문서화 품질은 전반적으로 매우 높다. `CHANGELOG.md` 신규 항목은 형제 커밋(워크플로·워크스페이스,
`4a9828afe`)과 동일한 3단 구성(문제·고친 것·판별력 실측)을 정확히 따르고, `triggers.service.ts`의 새 인라인
주석(락 안 재조회 근거, `.catch`의 `NotFoundException` 분리 근거)은 실제 동작·기존 `throwTriggerNotFound(): never`
패턴과 일치하며 line 번호까지 대조해도 어긋남이 없다. `triggers.service.spec.ts`의 신규 JSDoc 스타일 테스트
설명과 `trigger-delete-concurrency.e2e-spec.ts`의 헤더 주석도 실제 검증 대상(advisory lock 종류, 대기 상한,
공허성 가드)을 정확히 서술하고, `SchedulesService.remove()`(`schedules.service.ts:345`)에 대한 트래커의 신규
후속 항목도 코드를 직접 대조해 정확하다. API 문서(Swagger)·README·환경변수 문서는 이번 변경 범위(신규
엔드포인트·설정 없음)상 갱신 대상이 아니며, 실제로 갱신되지 않은 것이 맞다. 발견한 두 건은 모두 코드가 아닌
plan/tracker 산출물의 부수적 표현 문제(존재하지 않는 `plan/complete/` 경로 선인용, 리뷰어 등급 표기의 미세한
과장)로, 기능·계약에 영향이 없고 이미 이번 라운드의 다른 리뷰어(`scope.md`)도 그중 하나를 독립적으로 INFO 로
포착했다.

## 위험도

LOW
