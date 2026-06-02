# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [WARNING] 로딩 상태: 스펙 "스켈레톤" vs 구현 Loader2 스피너
- 위치: `/codebase/frontend/src/app/(main)/system-status/page.tsx` 라인 117-121
- 상세: `spec/2-navigation/15-system-status.md §2.5` 는 로딩 상태를 **"스켈레톤"** 으로 명시한다. 구현은 `Loader2` 회전 아이콘 + 텍스트 조합을 사용한다. 기능상 로딩 피드백은 제공하지만, 스켈레톤(콘텐츠 형태를 미리 보여주는 placeholder)과 스피너는 UX 패턴이 다르다.
- 제안: `Skeleton` 컴포넌트를 사용해 큐 카드 그룹의 형태를 미리 보여주는 스켈레톤 로딩 구현. 또는 spec §2.5 를 "스피너" 로 교정(project-planner 위임).

### [INFO] spec §2.5 에서 인용한 "통계 화면 패턴 재사용"의 불일치 — Rationale 로 부분 보완
- 위치: `spec/2-navigation/15-system-status.md §2.5` + Rationale R-1
- 상세: §2.5 는 "통계 화면의 로딩/에러 처리 패턴 재사용" 을 명시하지만, 통계 화면이 실제로 어떤 패턴인지 검증하지 않은 채 인용됐다. Rationale R-1 에서 "갱신 방식은 다르다" 고 분리 기술하는 방식으로 일부 보완됐으나, 로딩 패턴까지 실제로 재사용했는지 불명확. 기능 동작 자체에는 영향 없음.

### [INFO] spec §1 큐 레지스트리 표의 background-execution concurrency 표기
- 위치: `spec/5-system/16-system-status-api.md §1` 표 / `system-status.constants.ts` 라인 45
- 상세: spec 표는 `1 (기본)` 으로 표기하고 코드도 `concurrency: 1` 로 구현한다. 값은 일치하며 spec 에서 env 오버라이드는 continuation 큐만 의도됐으므로 기능상 올바르다. 단, 향후 background-execution worker 의 concurrency 를 env 로 변경할 경우 constants.ts 도 동기화해야 하는 취약점이 잠재함.

### [INFO] e2e 테스트 미실행 — 로컬 Docker 미가동으로 CI 환경 위임
- 위치: `plan/in-progress/system-status-page.md` 체크리스트 + `codebase/backend/test/system-status.e2e-spec.ts`
- 상세: e2e 테스트가 작성됐으나 plan 에 "로컬 docker 데몬 미가동으로 실행 불가(환경 차단), CI/실환경 실행 대상" 으로 명시됐다. 테스트 코드는 12개 큐 이름, 응답 구조, 인증, workspace 독립성을 모두 검증하므로 내용상 완전하다. CI 통과 이전까지는 e2e 커버리지가 확인되지 않은 상태.

### [INFO] DI factory 주입 순서 결정적 의존
- 위치: `system-status.module.ts` 라인 337-344
- 상세: `useFactory(...queues: Queue[])` 가 `MONITORED_QUEUES[index]` 와 `queues[index]` 를 인덱스로 짝짓는다. `inject` 배열은 `SYSTEM_STATUS_QUEUE_NAMES.map(getQueueToken)` 로 생성되고, `SYSTEM_STATUS_QUEUE_NAMES` 는 `MONITORED_QUEUES.map(q => q.name)` 이므로 두 배열의 순서가 항상 동일하다. 현재는 안전하나, 향후 두 배열을 독립적으로 편집할 경우 순서 불일치 버그가 발생할 수 있다.

---

## 요약

요구사항 충족 관점에서 구현은 전반적으로 `spec/5-system/16-system-status-api.md` 와 `spec/2-navigation/15-system-status.md` 의 명세를 성실히 따르고 있다. 필드명(`generatedAt/overall/totalFailed/queues/counts/utilization/isPaused/health`), health enum 어휘(`healthy/degraded/down`), 파생 규칙(isPaused→down, waiting>0&&active=0→down, >=임계치→degraded), 환경변수명(`SYSTEM_STATUS_FAILED_THRESHOLD`, `SYSTEM_STATUS_DELAYED_THRESHOLD`), API 경로(`GET /api/system-status/overview`), JWT 인증(전역 가드), admin role 가드 없음, 워크스페이스 스코핑 미적용, 5초 폴링, drill-down 없음, i18n(KO/EN) 등 모든 핵심 요구사항이 구현에 반영돼 있다. 유일한 spec 괴리는 로딩 상태가 명세된 "스켈레톤" 대신 스피너로 구현된 점(WARNING)이며, 나머지는 UX 동등 구현이거나 향후 유지보수 시 참고할 INFO 수준이다.

---

## 위험도

LOW

STATUS: SUCCESS
