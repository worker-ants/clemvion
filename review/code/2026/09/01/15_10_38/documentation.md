# 문서화(Documentation) 리뷰 — audit-record-factory (2026-09-01 15:10:38)

이 diff 는 직전 리뷰 라운드(`review/code/2026/09/01/14_31_12/`)의 WARNING(W1~W4)과
직전 consistency-check 라운드(`review/consistency/2026/09/01/15_00_54/`)의 WARNING을
같은 changeset 안에서 해소한 결과물이다(코드 fix + CHANGELOG + planner 턴 spec 반영 +
plan 체크리스트 갱신). 아래는 그 해소 자체와, 이번 diff 가 새로 남긴 문서화 관점 잔여를
점검한 결과다.

## 발견사항

- **[WARNING]** `plan/in-progress/spec-draft-audit-write-failed-metric.md` — 자신이 약속한
  spec 반영이 **같은 changeset 안에서 이미 전부 적용됐는데도** frontmatter `status`가
  `in-progress`로 남아 있고 파일이 `plan/in-progress/`에 그대로 있다(`plan/complete/`로
  이동하지 않음).
  - 위치: `plan/in-progress/spec-draft-audit-write-failed-metric.md:6` (`status: in-progress`),
    같은 파일 frontmatter 전체(게이트 1~12)
  - 상세: 이 draft의 "## 변경안" A/B/C 세 항목을 실제 diff와 대조하면 전부 적용 완료다 —
    A-1(NF-OB-07 요약행에 "감사 적재 실패" 추가)은 `spec/5-system/_product-overview.md` 게이트
    75, A-2(카탈로그 표 신규 행)는 같은 파일 게이트 91, A-3(라벨을 닫는 두 방법 서술)은 게이트
    81, B(`9-observability.md` 블록쿼트 나열 갱신)는 `spec/data-flow/9-observability.md` 게이트
    204~205, C(`1-audit.md` swallow 서술 비대칭화)는 `spec/data-flow/1-audit.md` 게이트 22~38
    로 각각 확인된다. 즉 이 plan draft가 존재하는 유일한 이유(3개 spec 파일 갱신)가 이미
    끝났는데, `.claude/docs/plan-lifecycle.md §3`이 명시하는 "모든 항목이 완료된 순간
    `complete/`로 이동" · "이동은 마지막 작업 PR 안에서"가 지켜지지 않았다. 같은 문서가
    "`status`를 선언했다면 이동 시 함께 갱신한다"며 이 정확한 실수(선언은 됐는데 갱신을
    안 하는 것)가 이 저장소에서 이미 두 번(`#1108`·`#1117`) 발생했다고 적어 두고 있다 — 세
    번째 재발 후보다. 이 draft의 `worktree:` 필드(`.claude/worktrees/audit-record-factory`)가
    현재 worktree와 정확히 일치하므로 push-gate의 "연결 plan" 판정 대상은 바로 이 파일인데,
    게이트는 "같은 경로로 수정됐는가"만 보고 "터미널 상태로 이동했는가"까지는 강제하지 않아
    이 갭을 자동으로 잡지 못한다(사람 리뷰가 메워야 하는 자리).
  - 제안: 이 PR 안에서 `git mv plan/in-progress/spec-draft-audit-write-failed-metric.md
    plan/complete/spec-draft-audit-write-failed-metric.md` + `status: in-progress` →
    `applied`(또는 `complete`)로 갱신. 이동 시 `plan/in-progress/spec-sync-auth-gaps.md:128`의
    상대링크(`[spec-draft-audit-write-failed-metric.md](./spec-draft-audit-write-failed-metric.md)`)도
    `../complete/spec-draft-audit-write-failed-metric.md`로 함께 정정할 것
    (`plan-lifecycle.md`가 "형제 plan을 가리키던 링크는 이동 시 정정" 이라 명시).

- **[INFO]** (직전 라운드 INFO의 미해결 이월) `AuditLogsService.record()`의 JSDoc이 이번
  diff로 추가된 관측 동작(카운터 증가·로그 필드 4종 확장)을 여전히 언급하지 않는다.
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:72-75`
    (`* Record an audit event. Failures are swallowed — audit logging must never break the
    primary action.` — 실제 파일에서 `Read`로 확인, 이번 diff의 게이트 범위 밖 불변 컨텍스트),
    대비 변경분은 파일 2 diff 게이트 97-119
  - 상세: 직전 라운드 `review/code/2026/09/01/14_31_12/documentation.md`의 INFO #3이 이미
    같은 지점을 지적했고, `RESOLUTION.md`("INFO 14건 전부 미조치")가 의도적으로 유예한
    항목이라 재발이 아니라 **이월**이다. 다만 `auth-configs.service.ts`의 여러 메서드가
    `{@link AuditLogsService.record}`로 이 독스트링에 계약을 위임하고 있어(`grep` 확인,
    `auth-configs.service.ts:78,155` 부근) — 링크를 따라가는 다음 사람은 여전히 "삼킨다"만
    보고 "삼킨 것이 이제 카운터+상세 로그로 보인다"는 절반을 못 본다. 우선순위는 낮음(이미
    유예 결정됨) — 재유예해도 무방하나, 이번 라운드에서도 손대지 않았다는 사실은 기록해 둔다.
  - 제안: 다음에 이 메서드를 건드릴 때 JSDoc에 한 줄 추가 — 예:
    `* On failure, increments {@link BusinessMetricsService.recordAuditWriteFailed} and logs
    action/resourceType/resourceId/workspaceId for diagnosis.`

## 우수 사례 (참고)

- 직전 라운드 documentation.md WARNING 2건(NF-OB-07 카탈로그 미등재, CHANGELOG 누락)이 이번
  diff에서 정확히 해소됐다 — `spec/5-system/_product-overview.md`·`spec/data-flow/9-observability.md`·
  `spec/data-flow/1-audit.md` 세 곳 모두 실제 코드(`resource_type` 클램핑 방식, 카운터 이름,
  로그 필드 4종)와 문면이 정확히 일치하고, `CHANGELOG.md`도 커밋 서사(대조군 tsc 프로브, 처방
  전환 이유)를 그대로 옮겨 실질 정보 손실이 없다.
- `spec/data-flow/9-observability.md`에 추가된 문단(게이트 274-278)이 직전 consistency-check
  WARNING #1(닫힌 유니온 원칙과 클램핑 예외의 관계가 출처 문서에 없던 문제)을 정확히 해소한다
  — "이 원칙은 코드 유니온이 있는 라벨에 적용된다" 로 예외 조건을 원 Rationale 문서 자리에
  명시했다.
  `plan/in-progress/spec-sync-auth-gaps.md`에 추가된 `login_history` 축 미결 하위 체크박스도
  직전 consistency-check WARNING #2(후속 항목이 기존 plan 체크박스와 연결되지 않던 문제)를
  정확히 해소한다.
- `BusinessMetricsService.recordAuditWriteFailed`의 JSDoc(파일 6 diff 게이트 159-179)은 "왜
  클램핑인가(닫힌 유니온이 아니라)" 섹션까지 포함해 설계 근거·대안·향후 전환 조건을 명시하는
  모범적 문서화이며, `repo-guards/__tests__/audit-action-binding-{guard,fixture}.ts`와
  `audit-action-binding.spec.ts`는 가드의 존재 이유·판정 방식(형태 vs 값)·fixture를 라이브
  소스가 아닌 별도 파일에 둔 이유까지 문서화해 자기반증 테스트 함정을 스스로 설명한다.

## 요약

핵심 코드·plan·CHANGELOG·spec의 문서화 품질은 이 changeset에서 전반적으로 개선됐다 — 직전
라운드가 지적한 두 문서화 WARNING(spec 카탈로그 미등재, CHANGELOG 누락)과 직전
consistency-check가 지적한 두 WARNING(Rationale 예외 조항 위치, `login_history` 후속 등재
연결)이 모두 이번 diff 안에서 정확히 해소됐음을 실제 파일 대조로 확인했다. 다만 그 해소
작업의 산출물인 `plan/in-progress/spec-draft-audit-write-failed-metric.md` 자신이 완료
상태를 반영하지 못한 채(`status: in-progress`, `plan/in-progress/`에 잔류) 남아 있다 —
이 저장소가 문서로 두 차례(`#1108`·`#1117`) 명시한 재발 패턴과 같은 클래스이고 자동 게이트가
잡지 못하는 지점이라 WARNING으로 등재한다. `AuditLogsService.record()` 독스트링의 절반짜리
서술은 이미 유예된 INFO의 이월이라 낮은 우선순위로 남긴다.

## 위험도

LOW
