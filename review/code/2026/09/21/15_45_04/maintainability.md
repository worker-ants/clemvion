# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `remove()` 의 처방 근거 주석이 실제 로직 대비 여전히 매우 길다 (주석 ~20줄 vs 실제 실행문 ~6줄)
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:301`~`322`(주석), 로직은 `323`~`329`
  - 상세: `findById` 유지 이유(2줄) + 동시성 처방 배경(원자적 `DELETE`, `affected===0` 명시 비교, `remove(entity)`→`delete(criteria)` 전환이 cascade/훅에 영향 없음 등, 약 18줄)를 전부 인라인 주석으로 붙였다. 다만 이 파일은 `recordAudit`·`ipInWhitelist`/`parseIp`·`getUsage` 등에서 이미 "왜"를 코드 옆에 남기는 스타일을 확립해 두었고, 형제 PR(#1369~#1373) 전부가 같은 밀도의 주석을 남겼다 — 파일·PR 계열 컨벤션과 일치하는 트레이드오프이지 이번 변경만의 이탈은 아니다.
  - 제안: 조치 불요. 향후 이 계열(8번째 `model-config`, 9번째 `webauthn`)에서도 반복될 근거이므로, "`affected===0` 명시 비교" 판정 규율 설명만이라도 공용 JSDoc(예: 별도 유틸 함수나 아키텍처 문서)으로 승격해 각 서비스 파일의 인라인 주석은 링크 한 줄로 줄이는 것을 고려할 만하다.

- **[INFO]** 동시-삭제 e2e 스펙 계열이 7번째 파일로 늘었고 구조적 보일러플레이트가 계속 반복된다
  - 위치: `codebase/backend/test/auth-config-delete-concurrency.e2e-spec.ts` 전체(신규) — 형제 `trigger-/schedule-/integration-/workflow-/workspace-delete-concurrency.e2e-spec.ts`, `member-remove-concurrency.e2e-spec.ts` 와 비교
  - 상세: `beforeAll`/`afterAll`(DB 커넥션 2개 생성·해제), `fireDelete` 류 요청 헬퍼, `Promise.race` 공허성 가드, `pending.sort(...)` 정렬 판정, `try/finally` 락 해제 골격이 파일마다 거의 동일한 형태로 재작성된다. 파일 자신의 헤더 주석이 "이 결함 클래스의 일곱 번째 짝" 이라고 스스로 명시할 만큼 패턴이 누적되고 있다.
  - 제안: 이번 PR을 막을 사유는 아니다(도메인별 락 종류·시드 흐름 차이로 완전 통합은 무리가 있고, plan 문서도 8번째·9번째를 예고해 두었다). 다음 인스턴스(`model-config` 또는 `webauthn`) 시점엔 `test/helpers/concurrency.ts` 류 공용 헬퍼(`raceTwoRequests` + 공허성 가드) 추출을 권장한다 — 이미 이전 라운드(`review/code/2026/09/21/15_18_16/maintainability.md`)에서도 같은 제안이 있었고 이번에도 유효하다.

- **[INFO]** `throwAuthConfigNotFound` 와 `triggers.service.ts` 의 `AUTH_CONFIG_NOT_FOUND`(400) 간 이름 근접은 JSDoc 으로 완화됐으나 여전히 잠재적 혼동 지점이다
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:141`~`157`(`throwAuthConfigNotFound` 정의 및 JSDoc)
  - 상세: 12줄짜리 disambiguation JSDoc(consistency-check WARNING #1 대응)이 두 자리(404 `RESOURCE_NOT_FOUND` vs 400 `AUTH_CONFIG_NOT_FOUND`)가 다르다는 것을 명시하지만, 이만큼 긴 설명이 필요하다는 사실 자체가 이름이 근접함을 방증한다. 코드 자체는 정상이며 IDE 로 정의로 이동해 JSDoc 을 읽으면 혼동이 사라지므로 차단 사유는 아니다.
  - 제안: 조치 불요 — 이미 완화됨. grep 만으로 두 식별자를 훑는 미래 유지보수자를 위해 두 파일(`triggers.service.ts`/`auth-configs.service.ts`) 중 하나에 상호 참조 주석을 남겨두는 것도 고려할 만하지만 필수는 아니다.

- **[INFO]** 이전 라운드(`15_18_16`)의 maintainability 관련 지적 사항은 이번 diff 에서 실제로 정리됐다 (긍정적 확인)
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts:43`~`51`(mock 팩토리), `:346`~`351`("대상이 없으면 DELETE 를 시도하지 않는다" 테스트)
  - 상세: 죽은 `remove: jest.fn(async () => undefined)` mock 필드가 제거되고 `delete` mock 하나로 교체됐으며, `findById` JSDoc 호출자 목록도 `remove` 를 포함하도록 재작성됐다. no-op `mockClear()` 도 제거됐다. 세 항목 모두 앞선 리뷰가 INFO 로 지적했던 것이고 `review/code/2026/09/21/15_18_16/RESOLUTION.md`/`_resolution_log.md` 가 기록한 커밋(`5502d1dee`, `69539209f`)과 diff 내용이 일치한다.
  - 제안: 없음 — 조치 확인.

- **[INFO]** CHANGELOG.md 항목이 매우 서술적이며(항목당 40~90줄) 동일 서사가 `plan/in-progress/authconfig-dup-delete.md` 와 상당 부분 중복된다
  - 위치: `/CHANGELOG.md`(diff 상 3~101행, 신규 두 항목: 인증 설정 7번째·`#1373` backfill 6번째), `plan/in-progress/authconfig-dup-delete.md` 전체
  - 상세: 결함 배경·판별자 근거·"고친 것"·판별력 실측·남는 것 서술이 CHANGELOG 항목과 plan 문서 양쪽에 각각 다른 표현으로 반복된다. 형제 PR 4건(#1369~#1372)이 이미 세운 형태를 그대로 따른 것이라 이번 PR 만의 이탈은 아니지만, 두 문서가 독립적으로 유지되므로 향후 한쪽만 갱신되면(예: 처방이 바뀌었는데 CHANGELOG 만 정정) 두 서술이 갈라질 여지가 있다.
  - 제안: 조치 불요(기존 4건과 동일 컨벤션). 다만 이 계열이 9번째까지 예고돼 있으므로, CHANGELOG 항목을 plan 문서를 요약 인용하는 짧은 형태로 통일하는 것을 검토하면 향후 유지보수 비용을 줄일 수 있다.

## 요약

핵심 프로덕션 변경(`auth-configs.service.ts` 의 `remove()` 원자적 `DELETE` 전환 + `throwAuthConfigNotFound` 추출)은 형제 PR 4건(#1369~#1372)과 동일한 형태를 정확히 따르고, 네이밍·에러 코드·감사 액션 재사용이 기존 컨벤션과 일치한다. 함수 길이·중첩 깊이·순환 복잡도 모두 문제 없는 수준이며, 이전 라운드(`15_18_16`)가 지적했던 죽은 mock 필드·stale JSDoc·no-op `mockClear()` 는 이번 resolution 커밋들로 실제로 정리됐음을 diff 로 확인했다. 남은 관찰은 전부 INFO 수준이다 — `remove()` 의 주석 밀도가 실행 로직보다 훨씬 크다는 점(파일·계열 전체의 기존 스타일과 일치), 동시-삭제 e2e 보일러플레이트가 7번째 인스턴스로 계속 누적된다는 점(8·9번째 시점에 공용 헬퍼 추출 권장, 이번 PR 차단 사유 아님), `throwAuthConfigNotFound` 와 형제 도메인의 400 `AUTH_CONFIG_NOT_FOUND` 간 이름 근접이 JSDoc 으로 이미 완화됐다는 점, 그리고 CHANGELOG 서사가 plan 문서와 상당 부분 중복돼 향후 두 문서가 갈라질 여지가 있다는 점이다. 이 중 어느 것도 이번 PR 을 막을 사유가 아니다.

## 위험도

LOW
