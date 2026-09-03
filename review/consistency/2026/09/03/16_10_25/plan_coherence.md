# Plan 정합성 검토 — `spec/5-system/` (impl-done, diff-base=origin/main)

## 검토 범위 요약

- target scope(`spec/5-system/`) 델타: **0개 파일** — 확인. 코드 전용 PR 이라 spec 델타 0 은
  정상이며 그 자체를 근거로 CRITICAL 을 내지 않았다.
- 실제 구현 diff: 14개 파일 / 764줄 — `User`/`Schedule` 엔티티의 `nullable: true` 컬럼을
  `| null` 타입으로 넓히고 `null as unknown as X` 이중 캐스트 8건 제거, 회귀 가드
  (`nullable-type-lie-cast-guard.ts`+spec) 신설. HEAD 는 `origin/main` 대비 5커밋
  (`7ce4fa92a`~`1166765e1`).
- 이 작업 전체가 `plan/in-progress/entity-nullable-column-type-mismatch.md` 의 "배치 1" 로
  **자체 문서화**되어 있고, diff 의 파일 목록·근거가 그 서술과 1:1 일치함을 재확인했다.
- 본 세션 이전에 동일 관점의 검토가 `review/consistency/2026/09/03/15_17_03/plan_coherence.md`
  (위험도 NONE)로 이미 1회 수행됨. 그 검토는 top commit `40fa58b8f` 기준이었고, 이후 3커밋
  (`52ca3128a`·`e78b6dbad`·`1166765e1`, 리뷰 2R~4R 대응 fix)이 추가됐다 — 이번 검토는 그
  델타를 별도로 확인했다.

## 조사한 것

1. `40fa58b8f`→`HEAD` 사이 실질 변경분(`git diff 40fa58b8f..HEAD --stat`)을 별도 확인 —
   코드 3파일 소폭 수정(테스트 1줄, 가드 8줄) + `entity-nullable-column-type-mismatch.md` 에
   새 "할 일" 항목 3건 추가. 새로 추가된 항목:
   - "후속(planner 턴) — `spec/1-data-model.md §2.9` `next_run_at` 표기 정정"
   - 배치 2 후보에 (d) `Schedule.lastRunAt`, (e) `auth.service.spec.ts:58` 잔존 캐스트 추가
2. 위 "후속(planner 턴)" 항목이 `spec/` 을 직접 건드리지 않고 plan 문서에만 기록됐는지
   확인 — `git diff origin/main...HEAD --stat -- spec/` 결과 **0개 파일**. developer 가
   자기-반증형 소정정 예외(조건 1: 자신이 그 문장을 썼어야 함)에 해당하지 않는다고 스스로
   판단해 planner 턴으로 위임한 것과 실제 diff 가 일치한다 — spec 을 우회해 고치지 않았다.
3. 그 후속 항목이 지적하는 drift 를 spec 원문에서 직접 대조 — `spec/1-data-model.md:260`
   `next_run_at | Timestamp`(non-null) vs `:261` `last_run_at | Timestamp?`(nullable 관례
   `?`). `spec/data-flow/10-triggers.md:127` 는 `next_run_at` 을 "정보성 컬럼, 발사 트리거
   아님"으로만 서술하고 nullable 여부는 언급하지 않는다. 코드(`schedule.entity.ts`)는 이번
   diff 로 `Date | null` 이 됐으므로, plan 이 기록한 drift(코드가 옳고 spec 표기가 낡음)는
   실측과 일치한다 — **새로 발견한 gap 이 아니라 이미 정확하게 기록된 것**.
4. 변경된 엔티티 필드명(`passwordHash`·`twoFactorSecret`·`emailVerifyToken`·
   `emailVerifyExpiresAt`·`passwordResetToken`·`passwordResetExpiresAt`·`lockedUntil`·
   `nextRunAt`)과 `user.entity.ts`/`schedule.entity.ts` 를 `plan/in-progress/**` 전체에서
   grep — `entity-nullable-column-type-mismatch.md` 자신 외에 참조하는 다른 plan 없음
   (선행 검토와 동일 결과, 재확인).
5. `entity-nullable-column-type-mismatch.md` 가 스스로 남긴 미해결 항목 4건(walker 추출,
   배치 2 기준, `spec/1-data-model.md` 정정, `tsc` 재확인)이 이번 diff 범위 밖으로 명시적으로
   유보되어 있는지 확인 — 전부 `- [ ]` 로 미체크 상태이며 diff 는 그중 어느 것도 선제
   결정하지 않는다. 특히 "배치 2 기준" 후보 (a)~(e) 는 나열만 하고 diff 가 그중 하나를
   골라 구현하지 않았다 — 결정을 우회하지 않았다.
6. `entity-nullable-column-type-mismatch.md` 가 참조하는 `backend-checks.yml` 이
   `codebase/backend/**` 를 실제로 덮는지 `backend-lint-gate-broken-on-main.md` 로 교차
   확인 — 그 plan 이 "**8개 잡이 `backend-checks.yml` 이 `codebase/backend/**` 를 덮는다**"
   전제를 실측으로 확정해 뒀다(§`changes` 잡 추출 항목). 신규 가드를 `.claude/tests/` 대신
   `repo-guards/__tests__/` 에 둔 이번 plan 의 판단이 그 선행 실측과 모순되지 않는다.
7. 최신 code review(`review/code/2026/09/03/16_00_45/SUMMARY.md`, 위험도 LOW, Critical/Warning
   0)의 SPEC-DRIFT #1 이 위 3번 항목과 동일 사안이며 "이미 planner 턴으로 위임됨"으로 판정한
   것을 대조 — 두 관점(code review·plan 정합성)의 결론이 일치한다.
8. `spec-sync-auth-gaps.md`(`spec/5-system/1-auth.md` 의 `pending_plans`)를 전문 확인 —
   감사 로깅·LDAP/SAML·워크스페이스 멤버십 트랙이며 이번 diff(엔티티 nullable 타입)와
   접점 없음.
9. `update-returning-tuple-shape.md` 가 `source-scan.ts` 확장 관례("세 번째 가드가 생기면
   `CONSUMING` 정규식도 이관")를 남겨 둔 것과 이번 신규 `countNullAsUnknownAsCasts` 추가가
   같은 트리거인지 검토 — **아니다**. 그 항목이 말하는 "세 번째 가드"는 동일한 `CONSUMING`
   정규식을 재사용하는 세 번째 소비처를 뜻하고, 이번 가드는 완전히 다른 술어(null 캐스트
   탐지)라 그 트리거 조건을 충족하지 않는다 — 두 plan 사이에 충돌 없음.

## 발견사항

없음 — CRITICAL/WARNING 어느 등급도 해당 사항을 찾지 못했다.

- **[INFO]** 후속 planner 턴 항목이 정확히 기록·위임되어 있음
  - target 위치: 해당 없음 (diff 는 `spec/` 을 건드리지 않음)
  - 관련 plan: `plan/in-progress/entity-nullable-column-type-mismatch.md` "## 할 일" —
    "후속(planner 턴) — `spec/1-data-model.md §2.9` `next_run_at` 표기 정정"
  - 상세: 이번 배치 1 이 `Schedule.nextRunAt` 을 `Date | null` 로 넓히면서 `spec/1-data-model.md:260`
    의 non-null `Timestamp` 표기가 낡았음을 drift 로 만들었다. developer 는 그 문장을 직접
    쓴 당사자가 아니므로 자기-반증형 소정정 예외 대상이 아니라고 스스로 판단해 spec 을
    고치지 않고 plan 에만 기록했다 — 실제 diff(`git diff -- spec/` 0건)도 이를 뒷받침한다.
    이는 결함이 아니라 규약을 정확히 지킨 사례이므로 INFO 로만 남긴다.
  - 제안: 다음 project-planner 턴에서 `spec/1-data-model.md:260` 을 `Timestamp?` 로 정정 —
    이미 plan 에 등재되어 있어 별도 조치 불필요, 착수 시점 참고용.

## 요약

이번 diff(배치 1, 14파일/764줄)는 그 자신을 추적하는
`plan/in-progress/entity-nullable-column-type-mismatch.md` 서술과 정확히 일치하며, 이전
`plan_coherence` 검토(15_17_03, NONE) 이후 추가된 3커밋도 새 미해결 항목 3건을 만들었을 뿐
diff 범위 밖 선결정이나 충돌은 없다. 유일하게 새로 생긴 항목("`spec/1-data-model.md §2.9`
정정")은 developer 권한 밖임을 스스로 인지해 spec 을 직접 고치지 않고 planner 턴으로
정확히 위임했으며(실제 diff 로 확인), 이는 최신 code review 의 SPEC-DRIFT #1 판정과도
일치한다. 다른 in-progress plan 중 변경된 엔티티 필드나 이번 가드 배치 위치를 전제로
충돌하는 서술을 가진 문서는 없다. 미해결 결정 충돌·선행 plan 미해소·후속 항목 누락 중
어느 것도 관측되지 않았다.

## 위험도

NONE
