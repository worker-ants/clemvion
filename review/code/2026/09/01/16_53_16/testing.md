# 테스트(Testing) 리뷰

## 사전 확인

이 changeset 은 이미 5라운드의 리뷰-fix 사이클을 거쳤다(`review/code/2026/09/01/{14_31_12,15_10_38,15_25_56,15_49_24,16_29_11}`). 직전 라운드(16_29_11)가 지적한 WARNING(`findUnboundHelpers` 가 리소스 바인딩의 정확성까지는 안 본다)은 이후 `4b15f0393` 커밋에서 `findMisboundHelpers` + 대조군 fixture(`WRONG_RESOURCE_BOUND_SOURCE`/`MATCHED_RESOURCE_SOURCE`/`MIXED_NOTATION_SOURCE`)로 실제로 닫혔음을 코드에서 직접 확인했다.

이번 라운드에서 재검증한 것:

- 관련 4개 spec 파일을 직접 실행: `audit-logs.spec.ts` · `business-metrics.service.spec.ts` · `audit-action-binding.spec.ts` · `auth-configs.service.spec.ts` → **4 suites / 86 tests, 전부 GREEN** (`npx jest` 직접 실행, 스크래치·mutation 없이 순수 재확인).
- `findMisboundHelpers` fixture 커버리지(`WRONG_RESOURCE_BOUND_SOURCE` vs `MATCHED_RESOURCE_SOURCE` vs `MIXED_NOTATION_SOURCE`)를 직접 읽고 대조군 설계가 이전 라운드가 지적한 "위반 케이스만 넣으면 비교 무력화 뮤턴트가 생존한다" 문제를 실제로 막는 구조인지 확인 — `MATCHED_RESOURCE_SOURCE`(같은 리소스, 통과해야 함)와 `MIXED_NOTATION_SOURCE`(표기만 다르고 값 같음, 통과해야 함) 둘 다 있어, `boundResource !== recordedResource` 비교를 항상 `true`로 바꾸는 뮤턴트가 두 대조군 중 하나에서 RED 를 낸다.
- `auth-configs.service.spec.ts` 에서 5개 `recordAudit` 호출부(create/update/regenerate/delete/reveal) 전부가 `AUDIT_ACTIONS.AUTH_CONFIG_*` 상수로 단언되어 있어, `action` 파라미터 타입을 `AuditAction` → `AuditActionFor<...>` 로 좁힌 변경의 런타임 회귀가 없음을 재확인.

## 발견사항

- **[INFO]** `audit-action-binding-fixture.ts` 의 형태 번호 라벨이 중복된다 — "형태 5" 가 두 번 쓰인다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-fixture.ts:64`(`ARROW_FIELD_BARE_SOURCE` — "형태 5"), 같은 파일 `:98`(`WRONG_RESOURCE_BOUND_SOURCE` — 역시 "형태 5")
  - 상세: 두 fixture 모두 각자의 `it`(`audit-action-binding.spec.ts`)이 정확히 단언하고 있어 테스트 커버리지 자체에는 영향이 없다. 다만 주석 번호가 카탈로그 역할(가드가 잡아야 하는 형태가 몇 종인지)을 하는데, 뒤쪽 라벨이 6이 아니라 5로 남아 있어 다음에 fixture 를 추가하는 사람이 "잡아야 하는 형태가 5종" 으로 오해하고 개수 기반 전제 단언(`sites.length >= 5` 류)을 잘못된 수로 갱신할 여지가 있다.
  - 제안: `WRONG_RESOURCE_BOUND_SOURCE` 주석의 "형태 5" → "형태 6" 으로 정정. 조치 여부는 낮은 우선순위.

- **[INFO]** `recordExecutionError` 에는 여전히 `recordAuditWriteFailed` 와 대칭인 65자 클램핑 경계 테스트가 없다 — **새 발견 아님**.
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.spec.ts:54-60`(`recordExecutionError` — 짧은 문자열만 사용), 대조군은 같은 파일 `:75-83`(`recordAuditWriteFailed` 의 65자 경계 테스트)
  - 상세: 직전 라운드(16_29_11 testing.md)가 이미 지적했고, `plan/in-progress/spec-sync-auth-gaps.md` 의 `clampLabel 대칭 테스트 + record() JSDoc` 항목으로 명시 등재되어 **우선순위 판단으로 이월** 상태임을 재확인했다(공유 상수 `PROMETHEUS_LABEL_MAX_LEN` 자체는 `X4` 뮤턴트로 이미 물려 있어 "두 메트릭의 방어 강도가 갈린다" 는 리팩터 근거는 무너지지 않음 — plan 서술과 일치).
  - 제안: 추적된 대로 다음 세션. 지금 차단 사유 아님.

- **[INFO]** `login_history.service.ts` 의 실패 관측 비대칭(카운터 없음, `audit_log` 만 확장됨)은 **plan 에 명시적으로 미결로 등재**되어 있고 재개 신호도 적혀 있다 — 새 발견 아니며, 조치 불필요.
  - 위치: `plan/in-progress/spec-sync-auth-gaps.md`(`login_history 축 — 미결` 항목)
  - 상세: `--impl-done` 게이트가 이 비대칭을 spec 상 서술 불일치로 잡지 않는지만 참고로 확인 — `spec/data-flow/1-audit.md` 가 비대칭을 명시 서술하고 있어 숨어있지 않다는 plan 의 주장과 일치.
  - 제안: 조치 불요.

## 커버리지 요약 (관점별)

1. **테스트 존재 여부**: 8개 변경 소스 파일 중 6개(`audit-logs.service.ts`, `auth-configs.service.ts`, `business-metrics.service.ts`, `audit-action-binding-guard.ts` + 신설 fixture)가 대응하는 spec/fixture 를 갖는다. 신설 `recordAuditWriteFailed`·`findMisboundHelpers`·화살표 필드 인식 분기 전부 직접 테스트가 있다.
2. **커버리지 갭**: 실질적 갭은 없음. 남은 것은 위 INFO 2건(`recordExecutionError` 대칭 테스트, `login_history` 축)뿐이며 둘 다 plan 에 우선순위 판단으로 명시 이월.
3. **엣지 케이스**: 클램핑 65자 경계(64자로는 분기를 못 가른다는 점을 fixture 주석에 명시) · metrics 미주입(`@Optional`) DI 조립 · metrics 호출이 throw 하는 경우 · 표기만 다르고 값이 같은 리소스 상수(오탐 방지 대조군) 전부 다룬다.
4. **Mock 적절성**: `audit-logs.spec.ts` 의 `metrics: { recordAuditWriteFailed: jest.fn() }` 캐스트 mock 은 실제 클래스와 구조적으로만 일치 검증되나(구조 캐스트), `record()` 가 그 메서드 하나만 호출하므로 실질 위험 낮음 — 직전 라운드가 이미 INFO 로 조치 불요 판정.
5. **테스트 격리**: `Logger.prototype.warn` spy 는 `try/finally` 로 스코프 내 복원, `afterEach(jest.restoreAllMocks)` 병행 사용 등 파일마다 격리 패턴 확인. 공유 상태 누출 없음.
6. **가독성**: 각 테스트가 "이 단언이 없으면 무엇이 통과하는가" 를 주석으로 명시하는 패턴이 일관됨(vacuous 방지 의도가 테스트 자체에 문서화됨) — 가독성 우수.
7. **회귀 테스트**: `auth-configs.service.spec.ts` 5개 호출부 액션 상수 단언으로 타입 좁힘의 런타임 무영향을 실측 확인. `AuditLogsService` DI 조립 테스트가 `@Optional` 회귀를 실제로 문다(직전 라운드 뮤테이션 RED 3 확인, 이번 라운드는 GREEN 재확인만 수행).
8. **테스트 용이성**: `BusinessMetricsService` 는 OTel meter 를 생성자에서 직접 얻는 구조라 mock meter 주입에 `jest.spyOn(metrics, 'getMeter')` 이 필요 — 이미 확립된 패턴이라 신규 저항 없음. `audit-action-binding-guard.ts` 는 파서 순수 로직과 소비 spec 을 분리해 fixture 문자열만으로 단위 테스트 가능하도록 설계됨(파일시스템 I/O 는 `collectSourceFiles` 로 분리).

## 요약

5라운드에 걸친 리뷰-뮤테이션-fix 사이클의 결과물로, 직전 라운드가 지적한 유일한 WARNING(리소스 오귀속 미검출)이 `findMisboundHelpers` + 3종 대조군 fixture 로 실제 코드에 반영되어 닫혀 있음을 이번 라운드에서 직접 재확인했다(86/86 GREEN, 뮤테이션 재실행 없이 순수 검증). 새로 발견한 결함은 없으며, 남은 항목은 전부 이미 `plan/in-progress/spec-sync-auth-gaps.md` 에 우선순위 판단으로 명시 이월된 것들과 사소한 주석 번호 중복(INFO) 뿐이다. 테스트 격리·가독성·엣지 케이스(클램핑 경계·DI 선택성·관측 실패 격리·표기-정규화 대조군) 모두 견고하다.

## 위험도
NONE
