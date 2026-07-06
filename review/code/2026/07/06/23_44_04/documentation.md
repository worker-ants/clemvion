### 발견사항

- **[WARNING]** `finalizeResumedExecutionOutcome` 메서드 JSDoc이 신규 side-effect(`execution_failed` 알림 dispatch)를 반영하지 않음 — 오래된 주석
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2445-2450` (메서드 JSDoc), 실제 dispatch 호출은 2504-2508행
  - 상세: 메서드 상단 JSDoc은 "Resume(rehydration) 중 입력 처리 / 그래프 구동 실패를 Execution 단말 상태로 마감한다. `ExecutionCancelledError` → `cancelled`, 그 외 → `failed`."라고만 서술하며, `RehydrationError` 처리 위임에 대한 설명으로 끝난다. 이번 diff(및 그 직전 커밋 656fc7cce)로 FAILED 분기 끝에 `dispatchExecutionFailedNotification` 호출이 추가되어 메서드 책임이 "상태 마감"에서 "상태 마감 + 알림 발사"로 확장됐으나 JSDoc은 갱신되지 않았다. 바로 위 인라인 주석(2504-2507행)은 "재개 경로로 종결되는 실행이 일반적이므로 여기 누락 시 대부분의 실패가 알림 없이 지나간다"고 상세히 설명해 dispatch 지점 자체는 이해 가능하지만, 메서드 계약을 상단 JSDoc만으로 확인하려는 사람은 "알림 미발사"로 오인할 수 있다. 이번에 수정된 버그 A(재개 세그먼트 dispatch 누락) 자체가 정확히 이런 유형의 "메서드 docstring과 실제 책임 범위의 괴리"에서 비롯된 결함이었다는 점에서, 동일 패턴의 재발 방지 관점에서 우선순위가 있는 지적이다. 직전 재리뷰(22_42_32 documentation.md)에서 이미 동일하게 WARNING으로 지적되었고 이번 최종 통합 커밋(04386bdd4)까지도 반영되지 않은 채 남아 있다.
  - 제안: 메서드 JSDoc 끝에 "FAILED 종결 시 `execution_failed` 알림도 발사한다(best-effort, spec §1.1)" 한 줄 추가.

- **[INFO]** 신규 회귀 가드 unit 테스트(`describe('getNotificationsService — ModuleRef 지연 해석 (버그 B 회귀 가드)')`)의 설명 주석이 버그 컨텍스트·검증 대상을 명확히 기술 — 모범 사례
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:35-38`
  - 상세: describe 블록 앞 주석이 "ExecutionEngineService 가 순환 그래프로 먼저 인스턴스화되면 생성자 @Optional NotificationsService 가 undefined 로 남는다. getNotificationsService 는 그 경우 ModuleRef(strict:false)로 지연 해석한다. 4개 분기(주입/지연해석/throw/캐시) 검증."이라고 왜 이 테스트가 필요한지(버그 재발 방지)와 무엇을 검증하는지를 함께 설명한다. `it` 제목도 각 분기(주입/지연해석/throw/캐시)의 조건과 기대 결과를 한국어로 명확히 서술해 별도 문서 없이도 테스트 의도가 읽힌다.
  - 제안: 없음.

- **[INFO]** 신규 유틸 모듈 `sanitize-error-message.ts`의 모듈 JSDoc이 목적·공유 이유·기존 대비 변경점을 충실히 설명
  - 위치: `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts:1-14`
  - 상세: "실행 실패 에러 메시지를 사용자向 표면(WS 이벤트/알림/이메일)에 노출하기 전 정리", "credential 자체는 상위 계층이 추가 차단하지만 Error.message 안에 평문으로 들어온 경우를 보강 — defense in depth", "Background 본문 실패와 top-level 실행 실패 양 경로가 공유한다 — 한쪽만 적용돼 방어 심도가 갈리는 일을 막기 위해 단일 util 로 둔다"까지 설계 의도(왜 공용 util 로 추출했는지)를 명확히 남겼다. `background-execution.processor.ts`에서 로컬 함수를 제거하고 import 로 교체한 지점에도 동일 취지의 인라인 주석이 남아 두 파일 간 일관성이 있다.
  - 제안: 없음.

- **[INFO]** `execution-engine.service.ts`의 새니타이징 적용 지점 인라인 주석이 "왜 지금 새니타이징이 필요해졌는지" 근거(선행 security 리뷰 참조)까지 포함 — 추적성 우수
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:120-123`
  - 상세: "원본 노드 예외 메시지에 내부 호스트명·연결 문자열·경로가 담길 수 있어, 인앱+이메일(외부 SMTP) 노출 전 background 경로와 동일하게 새니타이징한다 (security review 22_42_32 WARNING — 방어 심도 통일)."이라는 주석이 (a) 위험의 실체, (b) 대칭을 맞춘 대상 경로, (c) 근거가 된 리뷰 세션 ID까지 담고 있어 `git blame`이나 향후 리뷰어가 변경 이력을 추적하기 쉽다.
  - 제안: 없음.

- **[INFO]** e2e 신규 단언의 주석이 검증 대상 컬럼의 노출 정책과 관련 마이그레이션 버전(V107)을 명시
  - 위치: `codebase/backend/test/background-monitoring.e2e-spec.ts:238-250`
  - 상세: "`background_run_id`는 DB 엔티티 `select: false`라 일반 알림 목록 REST 응답에 노출되지 않아야 한다 (내부 attribution 전용, V107)... resource_id는 딥링크용 workflow id로 노출되나, backgroundRunId는 미노출."이라는 주석이 무엇을, 왜 검증하는지, spec 상 근거(V107)까지 압축적으로 담아 테스트 자체가 리그레션 문서 역할을 겸한다.
  - 제안: 없음.

- **[INFO]** spec 동기화(`spec/1-data-model.md §2.19`, `spec/4-nodes/1-logic/12-background.md §8.2`, `spec/data-flow/8-notifications.md`)가 이번 코드 변경(재개 세그먼트 발사 일반화, `background_run_id` 컬럼/attribution 분리)과 내용상 정확히 일치
  - 위치: `spec/1-data-model.md:719-724`(Notification 필드 표), `spec/4-nodes/1-logic/12-background.md:245-247`(§8.2 notifications 필드 설명), `spec/data-flow/8-notifications.md`(§1.1 execution_failed 발사 지점 일반화 + §2.1 background_run_id 컬럼/인덱스 + Rationale "딥링크와 attribution을 별도 컬럼으로 분리" 신설)
  - 상세: `git show 04386bdd4 -- spec/data-flow/8-notifications.md`로 확인한 결과, §1.1의 `execution_failed` 발사 지점 서술이 "runExecution FAILED 분기"에서 "top-level 실행 종결(초기 세그먼트 `runExecution` catch 및 재개 세그먼트 `finalizeResumedExecutionOutcome` 양쪽)"으로 정확히 갱신되어 이번 버그 A 수정 내용과 일치한다. `background_run_id` 컬럼 설명(REST 미노출 `select:false`, 부분 인덱스, `findByBackgroundRun` 조회)과 신규 Rationale 절("딥링크와 attribution을 별도 컬럼으로 분리")도 코드(entity 컬럼, e2e 단언, 서비스 메서드)와 대응이 정확하다. `plan/in-progress/spec-update-notifications-background-run-id.md`에 기록된 "적용 상태(2026-07-06, developer — SPEC-DRIFT reverse-flow)"가 실제 spec 파일 변경과 부합함을 확인.
  - 제안: 없음.

- **[INFO]** `finalizeResumedExecutionOutcome` §4.4(순환 DI 처리) spec 미문서화는 planner 트랙으로 명시적으로 이관되어 있어 이번 PR 스코프에서 조치 불요
  - 위치: `plan/in-progress/spec-update-notifications-background-run-id.md:362-370` (후속 섹션), `spec/5-system/4-execution-engine.md §4.4` (미변경)
  - 상세: `getNotificationsService`의 `ModuleRef(strict:false)` 지연 해석 패턴이 순환 DI 해법으로 신규 등장했으나 `spec/5-system/4-execution-engine.md §4.4`는 현재 `forwardRef`만 문서화하고 있다는 갭을, plan 파일이 "후속 (impl-done rationale_continuity WARNING, LOW — planner 판단)" 섹션에 명시적으로 기록해 planner 위임을 남겼다. developer가 spec read-only 라는 프로젝트 규약과 일치하는 처리이며, 코드 자체에는 `getNotificationsService` 상단 JSDoc(693-699행 부근)이 이미 지연 해석 동작을 설명하고 있어 실무상 급하지 않다.
  - 제안: 없음 (이관 처리 적절).

- **[INFO]** CHANGELOG.md가 이번 버그 픽스 커밋(04386bdd4)에서 갱신되지 않음
  - 위치: `CHANGELOG.md` 최상단 `## Unreleased — 알림 신규 발사 소스 execution_failed·schedule_failed·team_invite (알림 파이프라인 PR3)` 섹션
  - 상세: 이 리포의 CHANGELOG 관례는 각 기능 PR마다 "## Unreleased — <제목>" 섹션을 추가하는 것이며, 직전 PR3 커밋(7eabf1d73)이 "워크플로우 실행 실패·스케줄 시작 실패·팀 초대 시 알림이 발사된다"는 항목을 이미 Unreleased로 기록해 두었다. 그런데 그 `execution_failed` 발사가 재개(rehydration) 세그먼트에서는 실제로 전혀 동작하지 않았고 DI 순환으로 `NotificationsService`가 undefined였다는 두 결함이 이번(656fc7cce, 04386bdd4)에 와서야 수정됐다 — 즉 PR3 Unreleased 항목이 서술한 동작이 릴리스 시점까지 부분적으로 거짓이었던 셈이다. 아직 release 되지 않은 Unreleased 상태이므로 시급하지는 않으나, 릴리스 노트 정리 전에 PR3 항목 자체를 정정하거나 이번 fix를 명시적으로 추가해 두지 않으면 "PR3에서 이미 완전히 동작했다"는 오해가 릴리스 노트에 남을 수 있다.
  - 제안: 릴리스 노트 정리 시점에 PR3 Unreleased 항목 하단에 "재개 세그먼트 dispatch 누락 및 DI 순환으로 인한 undefined 결함을 후속 수정(commit 656fc7cce/04386bdd4)으로 해소, 실동작 확인" 한 줄 보강. 급하지 않음(INFO에 가까우나 CHANGELOG 관례상 계속 누락되면 릴리스 노트 신뢰도에 영향을 줄 수 있어 WARNING 근처로 유지).

- **[INFO]** README 갱신 불요 판단이 타당
  - 위치: 전체 diff
  - 상세: 이번 변경은 내부 버그 픽스(알림 미발사 결함 2건 수정) + 이전 리뷰 반영(에러 메시지 새니타이징 공용화, unit/e2e 보강, spec 동기화)으로 구성되며, 신규 공개 API·CLI·환경변수·설정 옵션이 추가되지 않았다. README/설정 문서 갱신 대상 없음.
  - 제안: 없음.

- **[INFO]** `plan/in-progress/notif-hardening-followups.md` 갱신이 게이트 이행 결과·잔여 항목·아키텍처 부채를 추적성 있게 기록
  - 위치: `plan/in-progress/notif-hardening-followups.md` (게이트 이행 결과 / 후속 / 잔여 섹션 신설)
  - 상세: "게이트 이행 결과(Definition of Done)" 체크리스트가 impl-prep/TEST/`/ai-review` ×2/`/consistency-check --impl-done`/버그 수정/회귀 가드/security WARNING 조치를 커밋 해시와 함께 정확히 기록했고, "후속(followup)" 섹션이 DI 순환 인스턴스화 순서·FAILED 종결 중복이라는 두 아키텍처/리팩터링 부채를 "기능은 정상, 별도 트랙"으로 명확히 구분해 남겼다. 프로젝트 규약(plan-lifecycle)에 따른 진행 중 작업 추적 문서로서 적절하다.
  - 제안: 없음.

### 요약

이번 diff는 알림 미발사 버그 2건(재개 세그먼트 dispatch 누락, DI 순환으로 인한 `NotificationsService` undefined) 수정과 그에 대한 재리뷰(22_42_32) 반영(에러 메시지 새니타이징 공용 util 추출, 회귀 가드 unit 4건, e2e select:false 단언 추가)으로 구성되며, 전반적으로 문서화 품질이 높다. 신규 유틸(`sanitize-error-message.ts`) JSDoc, 새로운 unit describe 블록 주석, e2e 단언 주석 모두 "왜 필요한지"와 "무엇을 검증하는지"를 정확히 남기고 있고, spec 동기화(`8-notifications.md` §1.1/§2.1/Rationale, `1-data-model.md` §2.19, `12-background.md` §8.2)도 실제 코드 변경과 정밀하게 일치함을 직접 확인했다. 다만 유일한 실질적 갭은 `finalizeResumedExecutionOutcome` 메서드 JSDoc이 이번에 추가된 알림 dispatch side-effect를 반영하지 못한 채 남아 있다는 점인데, 인라인 주석으로 실질적으로 보완되어 있어 치명적이진 않지만 이번 버그 자체가 "메서드 docstring과 실제 책임 범위 괴리"에서 비롯된 것을 고려하면 재발 방지 차원에서 보강 가치가 있다. CHANGELOG.md는 PR3의 Unreleased 항목이 서술한 동작이 이번 fix 이전까지 부분적으로 미동작이었다는 사실을 반영하지 않은 채 남아 있어, 릴리스 노트 정리 전에 한 줄 보강이 바람직하다. README/API 문서/설정 문서 갱신 대상은 없다.

### 위험도
LOW
