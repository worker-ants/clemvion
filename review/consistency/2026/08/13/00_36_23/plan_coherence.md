# Plan 정합성 검토 — spec/data-flow/ (--impl-done, diff-base=origin/main)

## 조사 범위

- 실제 diff(`git diff origin/main...HEAD`)는 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.{ts,spec.ts}` +
  `CHANGELOG.md` + `plan/in-progress/backend-lint-gate-broken-on-main.md` 뿐이다. `spec/data-flow/**` 자체는 이번 diff 에서 변경되지 않았다
  (번들에 실린 spec 텍스트는 대조용 target 스냅샷).
- 이 작업을 추적하는 plan 은 `plan/in-progress/backend-lint-gate-broken-on-main.md` 하나이며, 인접 후보로
  `spec-draft-eia-r8-alignment.md`(완료)·`spec-sync-external-interaction-api-gaps.md`(관련 항목 완료)·`eia-context-schema-followups.md`(무관 — context 타입 축)를 대조했다.
  앞의 둘은 번들에서 예산 초과로 절단돼(`## 진행 중 plan 문서 모음` 절 9744/9759행) `Read` 로 원본을 직접 열어 대조했다.

## 발견사항

발견된 CRITICAL/WARNING 없음. 아래는 확인 결과의 요약이며 조치 불요.

- **[INFO]** plan 이 diff 를 1:1 로 정확히 추적하고 있다
  - target 위치: (해당 없음 — spec 미변경)
  - 관련 plan: `plan/in-progress/backend-lint-gate-broken-on-main.md` §체크리스트, "캐시 엔트리 손상 처리 전체가 불완전하다" 항목
  - 상세: 이번 diff 의 `isIdempotencyEntry()` 형태 가드·`discardCorruptEntry()` 통합·payload 파싱을 `bodyHash` 판정 뒤로 옮긴 순서 계약이,
    plan 항목의 "후속 (2026-08-13, `23_48_38` testing WARNING)" 블록이 예고한 내용과 정확히 일치한다(브랜치명 `eia-idem-responsejson-guard` 도 동일).
    CHANGELOG 항목도 같은 내용을 반영한다. 새로 열린 브랜치(7개 분기 도달)에 대해서도 plan 이 종전에 걸어 둔
    "6번째 분기 시 재검토" 트리거가 발동했음을 스스로 기록하고, 구조 리팩터(`resolveCacheHit()` 추출)는 의식적으로 이번 PR 밖으로 미뤄 별도 미해결 항목(`[ ]`)으로 남겼다 — 조용한 범위 확장이 아니다.
- **[INFO]** spec 경계(`developer`는 `spec/` 쓰기 불가)를 diff 가 준수한다 — 미해결 결정 우회 없음
  - target 위치: `spec/data-flow/15-external-interaction.md` §4 외부 의존 표 / §Rationale "Fail-open 정책의 일관 표기"
  - 관련 plan: 같은 plan 파일의 신규 미해결 항목 `data-flow/15 의 "전 경로 fail-open (warn)" 이 실제보다 한 칸 넓다` (`23_48_39` rationale_continuity INFO 1 근거, planner 인계로 명시)
  - 상세: 이번 diff 의 코드 docstring(다섯 경로 표, "경로 1(기동 시 미주입)은 warn 대상 아님")은 spec 문서의 서술보다 더 정밀해졌지만,
    그 정밀화를 spec 본문(`data-flow/15`·`5-system/14 §R8`)에 반영하는 것은 여전히 미해결 상태로 정확히 열어 두었다(`[ ]`, planner 트랙 명시).
    diff 는 spec 파일을 건드리지 않았으므로 "미해결 결정과 충돌하는 일방적 spec 결정"에 해당하지 않는다.
  - 제안: 조치 불요. 다음 planner 턴에서 이 항목 착수 시, 이번 diff 가 만든 "다섯 경로 표" 프레이밍을 참고하면 됨(이미 plan 텍스트에 그렇게 적혀 있음).
- **[INFO]** 인접 plan 두 건은 이미 완결 상태 — 이번 diff 와 충돌 없음
  - target 위치: (해당 없음)
  - 관련 plan: `plan/in-progress/spec-draft-eia-r8-alignment.md`(전 체크박스 `[x]`, spec 본문이 §R8 캐시 대상 서술과 이미 합치), `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(§5.5/§5.2 stale 서술 항목 전부 `[x]`)
  - 상세: 두 plan 모두 이번 diff 가 다루는 idempotency 캐시 영역과 인접하지만 이미 완료 처리돼 있고, 현재 `spec/data-flow/15` 본문(번들 L141, L301)도 그 완료 내용과 일치한다. 다만 `spec-draft-eia-r8-alignment.md`는 체크박스가 전부 닫혔음에도 `plan/in-progress/`에 남아 있다 — plan lifecycle 관점(별도 검토자 영역)의 정리 대상일 뿐, 정합성 결함은 아니다.

## 요약

이번 diff(`idempotency.interceptor.ts`/`.spec.ts` — 캐시 엔트리·payload 손상 방어 강화)는 `spec/data-flow/**`를 전혀 건드리지 않았고, 이를 추적하는 `plan/in-progress/backend-lint-gate-broken-on-main.md`가 완료 항목·CHANGELOG·신규 미해결 항목(구조 리팩터 트리거 발동, spec 정밀화 planner 인계)까지 diff 내용과 1:1로 정확히 동기화돼 있다. `spec/` 쓰기 경계(developer 권한 밖)도 준수됐고, 인접한 두 spec 관련 plan(`spec-draft-eia-r8-alignment.md`, `spec-sync-external-interaction-api-gaps.md`)도 이미 완료 상태로 현재 spec 본문과 합치한다. 미해결 결정 우회, 선행 plan 미해소, 후속 항목 누락 어느 관점에서도 문제를 찾지 못했다.

## 위험도

NONE
