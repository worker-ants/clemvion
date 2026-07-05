# Plan 정합성 검토 — V-10 트리거 목록 Cron·다음 실행 시각 (code-impl)

## 발견사항

- **[WARNING]** V-10 은 plan tracking 상 "결정 대기" 로 남아 있고, 사용자 확정 마커가 없다
  - target 위치: `spec/2-navigation/2-trigger-list.md` §2.1 "Schedule 태그" 행, §2.3 "Schedule 상세" 행 (findAll() enrichment 코드 구현 대상)
  - 관련 plan: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` line 41 `- [ ] 잔여: V-10·V-12·V-13·V-14·V-18 (minor — 결정 대기)`, 그리고 line 74-80 `### V-10 [minor] 트리거 목록 Cron·다음 실행 시각` 항목
  - 상세: V-04/V-05/V-09 는 각 옵션 절 서두에 실제 구현 브랜치명과 "(사용자 결정)" 또는 PR 링크가 명시적으로 기록돼 결정이 확정됐음을 알 수 있다 (예: "`folder-depth-cycle-guard` 브랜치(본 PR)에서 코드 구현(plan 권장 채택)"). 반면 V-10 절에는 그런 확정 기록이 없고, plan 최상단 체크리스트에도 여전히 `[ ]` 미해결로 남아 "결정 대기" 라고 명시돼 있다. 즉 V-10 "코드 구현" 옵션은 audit 문서 저자(project-planner)의 **권장(recommendation)** 일 뿐, 사용자가 세 옵션(코드 구현/spec 하향/보류) 중 code-impl 을 확정했다는 기록이 plan 에 없다. 이번 target 작업은 이 미확정 권장을 사용자 재확인 없이 바로 실행에 옮기는 형태다 — 다른 major 항목들(V-04/05/09)이 확립한 "구현 착수 전 plan 에 결정 기록을 남긴다" 관례와 어긋난다.
  - 제안: (a) 사용자가 이미 별도 대화에서 V-10 code-impl 을 구두 승인했다면, 구현 커밋과 함께 `spec-code-cross-audit-2026-06-10.md` 의 V-10 절에 "브랜치명 + (사용자 결정)" 표기를 추가하고 최상단 체크리스트의 "V-10" 을 잔여 목록에서 제거해야 한다 (V-12·V-13·V-14·V-18 은 여전히 미결이므로 항목만 분리). (b) 아직 명시적 확인이 없었다면, 구현 완료 후 이 plan 항목에 결정 근거를 소급 기록하는 것으로 충분 — CRITICAL 로 볼 정도의 충돌은 아니다(권장 방향과 실제 구현 방향이 일치하므로 "일방적으로 결정을 뒤집는" 사안이 아니라 "미확정 기록을 사후 정리해야 하는" 사안).

- **[INFO]** V-10 해소 시 plan 체크리스트 정리 필요
  - target 위치: `spec/2-navigation/2-trigger-list.md` (전체), 백엔드 `triggers.service.ts` `findAll()`
  - 관련 plan: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` line 41
  - 상세: V-10 구현이 완료되면 line 41 의 잔여 목록에서 V-10 을 제거하고 (V-12·V-13·V-14·V-18 만 남김), 가능하면 V-10 절 자체에도 다른 완료 항목들처럼 구현 브랜치·검증 내역(테스트 통과 등)을 append 하는 관례를 따라야 한다. 이는 이번 검토의 차단 사유는 아니고, PR 병합 시 함께 반영할 추적 메모다.

## 요약

target(`spec/2-navigation/2-trigger-list.md`, 특히 §2.1/§2.3 의 Schedule cron/다음 실행 시각 필드)의 code-impl 방향은 `plan/in-progress/spec-code-cross-audit-2026-06-10.md` V-10 항목의 **권장안과 정확히 일치**하며, 인접 plan(`spec-sync-schedule-gaps.md` — `/schedules` 화면 UI 잔여 항목, `3-schedule.md` 관련)이나 webhook 관련 진행 중 plan 과는 스코프가 겹치지 않아 후속 항목 무효화·충돌 위험이 없다. 다만 V-10 은 plan 상 여전히 "결정 대기" 로 표시돼 있고, 다른 major 항목들과 달리 사용자 확정을 나타내는 명시적 마커가 없어 — 구현 자체는 이미 검증된 권장 방향을 그대로 따르는 것이라 저위험이지만, plan 문서가 실제 진행 상태를 뒤늦게 반영하도록 커밋과 함께 갱신이 필요하다.

## 위험도

LOW
