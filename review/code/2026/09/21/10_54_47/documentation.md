# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `CHANGELOG.md` 에 이번 수정 항목이 빠져 있다 — 같은 결함 클래스의 형제 PR 넷 모두 항목을 남겼다
  - 위치: `CHANGELOG.md` (루트, "Unreleased" 섹션 최상단 — 이번 diff 는 이 파일을 전혀 건드리지 않는다)
  - 상세: 이 저장소는 "동시 DELETE 두 건이 감사 행을 두 번 남기는" 결함 클래스를 고칠 때마다 `CHANGELOG.md` 에
    문제/고친 것/판별력 3단 구성 항목을 남겨 왔다 — 현재 `CHANGELOG.md` 최상단이 스케줄 수정
    (`fc5ea6b76`) 항목이고, 그 앞의 트리거(`4067bf777`)·워크플로(`4a9828afe`)·rotate(`ae4fbc374`) 세 커밋도
    각각 `docs(changelog)` 후속 커밋(`131296205`/`4f4f924ae`/`64e4e434d`/`d532184f5`)으로 항목을 추가했다.
    그중 하나의 커밋 메시지는 이 관례를 스스로 이렇게 명명한다: *"이 저장소가 「동시 X 두 건」류 결함
    수정마다 남겨 온 CHANGELOG 관례를 [이 PR만 건너뛴 것을 …]"*. 즉 이 정확한 결함 클래스에 대해
    "커밋 시점에 CHANGELOG 를 빠뜨렸다가 리뷰에서 지적받아 후속 커밋으로 채운다"는 패턴이 이미 최소
    3회(schedule/trigger/workflow) 반복됐다. 이번 통합(integration) PR 의 유일한 커밋(`707e89dec`)도
    `git show --stat` 기준 `CHANGELOG.md` 를 포함하지 않아, 그 갭이 다섯 번째로 재발했다.
  - 제안: 형제 세 항목과 같은 3단 구성(문제 — 판별자가 다른 이유 — 고친 것)으로 `CHANGELOG.md` 최상단에
    Integration 삭제 수정 항목을 추가한다. 특히 "이 경로엔 락이 없다" · "판정은 `affected === 0` 명시
    비교"라는, 이미 `integrations.service.ts` 주석과 `plan/in-progress/integration-dup-delete.md` §B 에
    적힌 근거를 그대로 옮기면 된다 — 새로 조사할 내용은 없다.

- **[INFO]** `spec/2-navigation/4-integration.md` §9.1/§9.4 에 "동시 삭제 → 두 번째 요청 404" 서술이
  아직 없다 — 단, 이번 diff 안에서 이미 트래커 스코프가 확장되어 새 이슈가 아니다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` L4813-4820 (`--impl-prep`
    `review/consistency/2026/09/21/10_27_27` W3/plan_coherence 가 지적한 문서 갭)
  - 상세: 이번 diff(파일 5)가 그 항목의 스코프에 `4-integration.md §9` 를 이미 추가했고
    (`plan/in-progress/integration-dup-delete.md` 체크리스트도 그 처리를 기록한다), 이는
    developer 권한 밖(`spec/` write) 이라 지금 커밋 대상이 아니다. `spec_impact: none` 결정과
    일치하므로 이번 리뷰에서 별도 조치를 요구하지 않는다 — consistency-check 산출물(파일 6·9·12·13)의
    판단을 그대로 확인했다.

- **[INFO]** 인라인 주석·JSDoc 품질은 이번 diff 의 강점이다 — 오래된/부정확한 주석 없음
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `remove()` 메서드
    (원자적 `delete()` 도입부 주석), `codebase/backend/src/modules/integrations/integrations.service.spec.ts`
    L1073-1096 (동시 삭제 테스트 + 대조군 테스트의 두 JSDoc 블록),
    `codebase/backend/test/integration-delete-concurrency.e2e-spec.ts` L8-22 (파일 헤더 독스트링)
  - 상세: `remove()` 안의 주석은 (a) 결함의 근본 원인(무락 `findOne`), (b) 형제 네 경로와 처방이 다른
    이유, (c) 기각된 advisory lock 재도입이 아니라는 근거, (d) `remove(entity)`→`delete(criteria)`
    전환이 CASCADE/`cascade:true` 관계에 영향 없다는 실측, (e) `affected === 0` 명시 비교의 이유를
    전부 짚는다. `integrationRepository.remove`/`.delete` 를 코드베이스 전체에서 grep 한 결과
    (`grep -n "integrationRepository\.\(remove\|delete\)"`) 이 메서드 밖에 남은 옛 호출·주석은 없다.
    e2e 파일 헤더는 형제 파일 4개(workflow/workspace/trigger/schedule)를 정확히 나열하며 실제로
    `codebase/backend/test/` 에 그 4개가 모두 존재함을 확인했다 — 서술과 저장소 상태가 일치한다.
  - 제안: 없음 (긍정 기록).

- **[INFO]** API 문서(`@ApiNotFoundResponse` 등)는 이미 일반적인 404 를 문서화하고 있어 이번 동작
  변경으로 인한 신규 API 문서 갱신 의무는 없다
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` `DELETE :id`
    (L561-580, 이번 diff 밖 — swagger 데코레이터 불변)
  - 상세: 컨트롤러의 `@ApiNotFoundResponse({ description: '해당 통합을 찾을 수 없음' })` 은 이미
    404 를 문서화하고 있고, 이번 수정은 그 404 가 발생하는 조건(동시 삭제의 진 쪽)을 하나 늘릴 뿐
    OpenAPI 스펙 자체를 바꾸지 않는다. README/설정 문서·CHANGELOG 외 갱신 대상 없음.

## 요약

핵심 코드(`integrations.service.ts`)와 테스트(`integrations.service.spec.ts`, 신규 e2e)의 인라인
주석·JSDoc 은 형제 PR(#1369-#1371)과 동등하거나 더 상세한 수준으로 근거·대조군·판별자 설계를 남겨
문서화 관점에서 흠을 찾지 못했다. spec 문서(`4-integration.md`) 갱신 필요성은 이미 이번 diff 안에서
트래커 스코프 확장으로 처리됐고 developer 권한 밖이라 추가 조치가 없다. 유일한 실질적 갭은
`CHANGELOG.md` 다 — 정확히 같은 결함 클래스의 선행 PR 넷(workflow/trigger/schedule/rotate) 모두 항목을
남겼고, 그중 셋은 "커밋에서 빠뜨렸다가 리뷰 후 후속 커밋으로 채운" 이력이 있다. 이번 PR 의 단일 커밋도
`CHANGELOG.md` 를 건드리지 않아 같은 갭이 다섯 번째로 재발했다 — 병합 전에 채우는 것을 권장한다.

## 위험도
LOW
