# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `CHANGELOG.md` 에 이번 수정 항목이 빠졌다 — 같은 결함 클래스의 직전 두 PR 이 정확히 이 자리에서 두 번 놓쳤던 것과 같은 누락
  - 위치: `CHANGELOG.md` (저장소 루트, `## Unreleased` 섹션 최상단이 관례상 삽입 지점)
  - 상세: 이 저장소는 "동시 DELETE/rotate 두 건이 감사 행을 두 번 남기던 것"류 결함을 고칠 때마다 `CHANGELOG.md` 에 "문제 → **고친 것** → **판별력 실측**(→ 있으면 **남는 것**)" 3~4단 구성의 `## Unreleased` 항목을 남겨 왔다 — 현재 `CHANGELOG.md` 최상단부터 정확히 그 형식으로 트리거(#1370)·워크플로(#1369)·통합(#1368) 세 항목이 이미 존재한다. 그런데 **바로 그 트리거·워크플로 두 PR 모두 최초 구현 커밋에는 이 CHANGELOG 항목이 없었고**, 각각 documentation reviewer 가 "이 PR 만 관례를 건너뛰었다" 고 WARNING 을 낸 뒤에야 별도 커밋(`4f4f924ae` 류, `docs(changelog): SUMMARY#4/#5 — 동시 DELETE 감사 중복 수정 항목 추가`)으로 추가됐다(`git show --stat 4067bf777 -- CHANGELOG.md`, `git show --stat 4a9828afe -- CHANGELOG.md` 로 확인, 각각 CHANGELOG 전용 커밋 diff 29줄·33줄 추가). 지금 리뷰 대상인 `eb94361cc`(`fix(schedules): …`)의 diff 에는 `CHANGELOG.md` 가 아예 포함돼 있지 않다(`git diff --name-only origin/main...HEAD` 로 확인) — **같은 시리즈에서 세 번째로 동일 누락이 재발**하는 중이다.
  - 제안: 트리거/워크플로 항목과 같은 3단 구성으로 `## Unreleased` 항목을 추가한다. 최소 포함 내용: (1) `SchedulesService.remove()` 가 잠금 없는 선조회 + advisory lock 뒤 `m.delete(Trigger, triggerId)` 의 `affected` 를 쓰지 않아 진 쪽도 그대로 진행해 `schedule.deleted` 가 두 번 남던 문제, (2) FK CASCADE 때문에 "스케줄 행 자체의 `affected`" 로는 판정할 수 없어 "락 안에서 지운 트리거 행의 `affected`" 를 판별자로 쓴 것(형제 셋과 판정 기준이 다르다는 점이 이 PR 고유의 설명 포인트), (3) e2e 실측값(고치기 전 `[204,204]`+감사 2건 → 고친 뒤 `[204,404]`+감사 1건), (4) "남는 것" — `IntegrationsService.remove()` 가 다섯 번째이자 마지막 남은 자리로 트래커에 등재됐다는 사실.

## 그 외 확인 사항 (문제 없음)

- **주석 정확성**: `schedules.service.ts` 의 신규 인라인 주석(락 안 `affected` 판별, CASCADE 로 인한 판정 기준 상이, `.catch` 에서 `NotFoundException` 조기 재던짐, 방어 분기의 "엔티티상 NOT NULL" 서술)을 각각 코드·엔티티와 대조했다 — `schedule.entity.ts` 의 `triggerId: string` 컬럼에 `nullable` 옵션이 없어 "NOT NULL이라 현재 도달 불가"라는 주장이 실측과 일치한다. 형제 PR(#1369·#1370) 인용도 커밋 로그와 부합한다.
- **테스트 문서화**: `schedules.service.spec.ts` 신규 테스트의 JSDoc(락 안 트리거 삭제 0행 → 404, "판정자가 트리거인 이유")과 `mock` 옆 인라인 주석(계약 변화: `delete` 가 이제 `affected` 를 돌려준다는 것)이 실제 구현·assertion 과 정확히 일치한다.
- **e2e 신규 파일**: `schedule-delete-concurrency.e2e-spec.ts` 헤더 주석이 "네 번째 짝"이라 칭하며 `trigger-/workflow-/workspace-delete-concurrency.e2e-spec.ts` 를 인용하는데, 세 파일 모두 실제로 존재해 인용이 정확하다. 트리거 e2e 파일의 "세 번째 짝" 서술도 자기 시점 기준으로 정확해 상호 staleness 는 없다.
- **API 문서(Swagger)**: `schedules.controller.ts` 의 `DELETE /api/schedules/:id` 는 이번 diff 에 포함되지 않았고 기존 `@ApiNotFoundResponse({ description: '해당 스케줄을 찾을 수 없음' })` 은 형제 서비스들의 동시 삭제 404 도 똑같이 일반 문구로만 다루는 기존 패턴과 동일해, 이 PR 이 새로 만든 문서 격차는 아니다.
- **spec 문서 격차**: `spec/2-navigation/3-schedule.md` §4 에 "동시 삭제 → 두 번째 요청 404" 서술이 없는 것은 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`(4795행대)와 consistency-check(`cross_spec` INFO#1, `plan_coherence` WARNING#2)가 추적 중이며, 이번 diff(파일 5)가 그 스코프에 `3-schedule.md §4` 를 실제로 추가했음을 확인했다 — 별도 조치 불요.
- **README/설정 문서/예제 코드**: 신규 환경변수·설정·공개 API 표면 변화가 없어 해당 없음.

## 요약

코드·테스트 쪽 인라인 문서(주석·JSDoc)는 판정 기준이 형제 세 경로와 다른 이유(FK CASCADE)까지 정확하고 촘촘하게 설명하고 있으며 실측과도 어긋나지 않는다. 유일한 결함은 `CHANGELOG.md` 누락인데, 이는 이 저장소가 이번 PR 직전 두 형제 PR(#1369, #1370) 모두에서 documentation reviewer 가 지적한 뒤에야 별도 커밋으로 수습했던 **바로 그 항목의 세 번째 재발**이다 — 우연한 누락이 아니라 관례가 확립된 지점에서 반복되는 패턴이므로 병합 전 반영을 권장한다.

## 위험도

LOW
