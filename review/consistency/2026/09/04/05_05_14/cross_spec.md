# Cross-Spec 일관성 검토 — cross_spec

## 검토 대상 요약

- 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`
- `spec/conventions/` 델타: 0개 파일 (정상 — 이 브랜치는 spec 을 바꾸지 않는 코드 전용 PR)
- 실제 구현 diff: 9개 파일, 전부 `codebase/backend/src/common/__test-utils__/` ·
  `codebase/backend/src/repo-guards/__tests__/` — 구조적 회귀 가드(CI 전용 테스트 인프라)의
  파일-워커 5중 중복 제거(`collectTsFiles` 공유화) + `nullable-type-lie-cast-guard` 에
  "넓혀진 필드를 겨눈 낡은 `.spec.ts` 캐스트" 탐지 술어(`widenedEntityFields`/
  `findStaleSpecCasts`) 신설. `plan/in-progress/entity-nullable-column-type-mismatch.md`
  (nullable 컬럼 타입 정합화, 배치 1~3) 의 회귀 가드 축.

이 diff 자체는 엔티티·API·DTO·상태 머신·RBAC 을 건드리지 않는다 — 테스트 전용 파일 워커와
가드 술어만 바뀐다. 아래는 그럼에도 확인해야 할 cross-spec 표면 두 갈래다: (1) 이 diff 가
**spec 이 참조하는 기존 가드의 동작을 조용히 바꿨는가**, (2) 이 diff 가 속한 작업 축이
**다른 spec 영역과 이미 알려진 미해결 충돌을 안고 있는가**.

## 발견사항

- **[INFO]** `masked-reject-callers-guard` 스캔 범위 — 동작 보존 확인, spec 참조 안전
  - target 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts`
    (`listSourceFiles` → `collectTsFiles(rootDir, { includeSpec: true })` 위임)
  - 충돌 대상: `spec/4-nodes/7-trigger/1-manual-trigger.md:201`,
    `spec/5-system/14-external-interaction-api.md:1591` (EIA §R17) — 둘 다 이 가드를
    "Manual 실행 경로가 base 를 직접 부르면 RED" 의 CI 강제 근거로 **명시 인용**한다.
  - 상세: 구 구현은 `.ts` 전체(즉 `.spec.ts` 포함)를 스캔하고 `node_modules`/`dist` 만
    제외했다. 신 구현은 `collectTsFiles(rootDir, { includeSpec: true })` 로 위임하는데,
    이는 정확히 같은 필터(spec 포함, `node_modules`/`dist` 제외, `.d.ts` 제외 — 대상
    디렉터리엔 `.d.ts` 가 없어 무관)다. 즉 **스캔 범위 동작이 보존**돼 spec 이 인용하는
    보장은 이 diff 로 깨지지 않는다.
  - 제안: 없음 (확인 목적의 기록). 향후 `collectTsFiles` 의 기본값(`includeSpec: false`)이
    바뀌면 이 호출부가 `includeSpec: true` 를 명시하고 있는지 재확인할 것.

- **[WARNING]** 미해결 데이터모델 문서 충돌 — `spec/1-data-model.md §2.9` `next_run_at`
  nullable 표기 누락 (이 diff 가 만든 것은 아니나, 이 diff 가 속한 작업 축의 완료 조건)
  - target 위치: 이 PR 의 diff 자체엔 없음 — 상위 작업
    `plan/in-progress/entity-nullable-column-type-mismatch.md` §할일의
    "후속(planner 턴) — `spec/1-data-model.md §2.9` `next_run_at` 표기 정정" 항목
    (미체크, `- [ ]`)
  - 충돌 대상: `spec/1-data-model.md:260-261` — `next_run_at` 은 `Timestamp`(non-null 표기)로,
    바로 아래 `last_run_at` 은 `Timestamp?`(nullable 표기)로 문서화돼 있다. 실제 코드
    (`codebase/backend/src/modules/schedules/entities/schedule.entity.ts:41-42`)는
    `@Column({ nullable: true }) nextRunAt: Date | null` — DB·코드 모두 nullable 이다.
  - 상세: `spec/1-data-model.md` 자신의 관례(`?` 로 nullable 표기, 문서 내 26곳 동일 패턴)와
    실제 스키마 사이에 이미 알려진 불일치가 있다. 이 PR 의 diff(repo-guards 리팩터)는 이
    불일치를 만들지도, 악화시키지도 않지만 — 이 PR 이 속한 nullable 배치 작업 계열의
    "회귀가 다시 돌아오지 못하게 닫는다" 는 목표와 직접 연관된 잔여 항목이다. plan 은 이미
    "developer 권한 밖 — planner 턴 필요" 로 정확히 분류해 뒀고, complete 이동 전 반영을
    스스로 게이팅하고 있다.
  - 제안: 신규 조치 불요 — 이미 plan 에 정확히 기록·게이팅됨. `project-planner` 턴에서
    `spec/1-data-model.md §2.9` 의 `next_run_at` 을 `Timestamp?` 로 정정하고
    `spec/data-flow/10-triggers.md §3.2` 에 "cron 파싱 실패 시 `next_run_at` 은 NULL" 한 줄
    보강할 것. **이 diff 자체를 막을 이유는 아니다.**

- **[WARNING]** 미해결 API 명명 규약 gap — `spec/5-system/2-api-convention.md §2.2`
  `/api/auth/*` 네임스페이스 예외 조항 부재 (이 diff 와 무관, 상위 plan 이 이미 기록)
  - target 위치: 이 PR 의 diff 자체엔 없음 — 상위 작업 plan 의
    "후속(planner 턴, 이 작업과 무관) — `2-api-convention.md §2.2` 에 `/api/auth/*` 액션
    네임스페이스 예외 조항" 항목 (미체크, `- [ ]`)
  - 충돌 대상: `spec/5-system/2-api-convention.md:45-54` §2.2 — 명명 규칙에 예외가 두 개만
    명시돼 있다(RPC-style sub-channel action, `/api/external/*` 인증 family). `/api/auth/*`
    verb-style 엔드포인트(로그인·등록·갱신 등) 15개 이상이 이 두 예외 어디에도 포섭되지
    않는다.
  - 상세: 이 PR 과 무관한 선재 gap 이며, plan 이 "이 작업과 무관" 이라고 명시적으로 구분해
    별도 기록해 뒀다(등재된 다른 plan 없음). 이 diff 는 API 계약을 전혀 건드리지 않으므로
    이 gap 을 새로 만들지도, 악화시키지도 않는다.
  - 제안: 별도 `project-planner` 턴에서 `§2.2` 에 `/api/auth/*` 예외 조항 추가 검토.
    **이 diff 자체를 막을 이유는 아니다.**

## 요약

이 diff(9파일, `repo-guards`/`common/__test-utils__` 리팩터)는 CI 구조적 회귀 가드의 파일
워커 중복 제거와 nullable 캐스트 잔재 탐지 술어 신설로, 엔티티·API·상태 머신·RBAC 등 제품
spec 표면을 전혀 건드리지 않으며 `spec/conventions/` 델타 0은 이 성격에 정확히 부합한다.
diff 가 유일하게 손댄, spec 이 직접 인용하는 가드(`masked-reject-callers-guard`)는 스캔
범위 동작이 리팩터 전후 동일함을 확인했으므로 EIA §R17 / manual-trigger spec 인용과
충돌하지 않는다. 다만 이 diff 가 속한 상위 작업(nullable 컬럼 타입 정합화)은
`spec/1-data-model.md §2.9`(next_run_at nullable 표기 누락)와 `spec/5-system/2-api-convention.md
§2.2`(`/api/auth/*` 예외 조항 부재)라는 두 건의 실재하는 cross-spec 불일치를 이미 자체
기록해 뒀고 아직 미해결이다 — 둘 다 developer 권한 밖으로 정확히 분류돼 planner 턴을
기다리는 중이며, 이 diff 자체가 만든 결함이 아니고 이 diff 를 막을 사유도 아니다.

## 위험도

LOW
