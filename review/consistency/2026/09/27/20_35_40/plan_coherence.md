# Plan 정합성 Check — `spec-draft-cross-workspace-refs-2.md`

## 발견사항

- **[WARNING]** 트래커가 target 을 "이미 complete" 로 앞서 인용
  - target 위치: `plan/in-progress/spec-draft-cross-workspace-refs-2.md` (frontmatter `status: in-progress` — 아직 `plan/complete/` 로 이동하지 않았고, 본문 "변경안" 도 아직 `1-workflow-list.md` 에 적용되지 않은 미실행 제안 상태)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:1493-1494` — "구현이 착지한 **뒤** planner 항목으로 넘긴다 … `plan/complete/spec-draft-cross-workspace-refs-2.md` Rationale" (같은 커밋 `aef3dbac4` 에서 target 신설과 동시에 추가된 문장)
  - 상세: 트래커가 target 을 `plan/complete/spec-draft-cross-workspace-refs-2.md` 라는 **아직 존재하지 않는 경로**로 인용한다. 이것은 바로 이 라운드에서 Critical 로 잡혔던 결함(`plan/complete/cross-workspace-refs.md` 를 완료형으로 선인용)과 **동일한 패턴**이 이번엔 target 자신이 아니라 target 을 가리키는 다른 in-progress plan(트래커) 쪽에서 재발한 것이다. backtick 인용이라 `spec-link-integrity.test.ts` 는 잡지 않는다(INFO 로 이미 알려진 가드 사각지대, 이전 라운드 INFO #2 와 동종). 직전 draft(`spec-draft-cross-workspace-refs.md`)가 적용 후 `plan/complete/` 로 옮겨진 선례를 볼 때 이 인용은 "곧 맞아질" 전제이긴 하나, target 이 실제로 적용·이동되기 전까지는 죽은 경로다.
  - 제안: target 의 "변경안"을 `1-workflow-list.md` 에 적용하고 이 draft 를 `plan/complete/`로 옮기는 시점에 트래커 인용이 실제로 그 경로를 가리키는지 재확인할 것. 세션이 여기서 끊기면(다음 턴으로 이월) 트래커 문구를 "(예정, 아직 `plan/in-progress/`)" 정도로 낮추는 편이 안전하다.

- **[INFO]** "(Planned) 라벨 생략" 근거로 든 선례가 실제로는 다른 형태
  - target 위치: `plan/in-progress/spec-draft-cross-workspace-refs-2.md` `## Rationale` 첫 항목 — "미구현 기간의 추적은 `pending_plans` 가 맡는다 — 같은 문서가 이미 그 방식으로 `marketplace-and-plugin-sdk` 를 추적한다"
  - 관련 plan: `plan/in-progress/marketplace-and-plugin-sdk.md`(frontmatter 만, PRD 레벨 대형 미구현 덩어리) vs `spec/2-navigation/1-workflow-list.md` §2.1/§2.7/§3.2 의 기존 "**미구현 (Planned)**" 인라인 라벨(트리거 요약 컬럼·마켓플레이스 링크·`formatVersion`)
  - 상세: `1-workflow-list.md` 의 `pending_plans:` 에는 `marketplace-and-plugin-sdk.md` 가 있지만, 본문의 기존 "(Planned)" 라벨 붙은 세 항목은 이 plan 이나 다른 어떤 `pending_plans` 항목과도 본문에서 명시적으로 연결되지 않는다(인라인 라벨 + 무-특정-plan 조합). 즉 이 문서의 기존 관례는 "`pending_plans` 필드만으로 라벨을 대신한다"가 아니라 "인라인 라벨과 `pending_plans` 필드가 독립적으로 병존"하는 쪽에 가깝다. target 의 결론(라벨 생략, 같은 PR 이라 필요 없음) 자체는 정합성 위반은 아니고(하드 가드도, 명문화된 강제 규칙도 없음 — §Plan 검토 시 확인함) SUMMARY 가 제시한 두 대안("라벨 부기 **또는** spec·코드 동시 착지") 중 후자를 택한 정당한 선택이지만, 인용한 선례 자체는 결론을 정확히 뒷받침하지 않는다.
  - 제안: 차단 사유는 아님. 정정하려면 "선례" 문구를 빼거나, 실제로 인라인 라벨 없이 `pending_plans` 만으로 추적되는 문서 사례로 교체.

이 외 lens 별 확인 결과(발견 없음, 근거만 기록):

- **미해결 결정과의 충돌** — 관련 plan(`cross-workspace-refs.md`, `spec-draft-nullable-notation-followups.md`)에 이 draft 의 "(Planned) 라벨 생략" · "PATCH `details` 배열화" · "3문서 미러 후속 이월" 결정과 상충하는 "결정 필요(사용자 합의)" 항목 없음. 트래커의 대응 항목(1463-1507행)은 이미 `plan/in-progress/cross-workspace-refs.md` 로 일원화돼 있고 W4(닫음 오기)도 이미 "진행 — 이 PR" 로 낮춰져 있어 target 의 처방과 정합.
- **선행 plan 미해소** — target 이 전제하는 `spec/1-data-model.md §1.1`(참조의 소속 규칙, `a8bfd1492`)은 이미 spec 에 착지해 안정적이고 열린 "결정 필요" 표식 없음. target 이 인용하는 `cross-workspace-refs.md` 의 처방(§처방 "폴더 PATCH 도 같은 배열 `details`")도 실제로 그 plan 문서에 이미 서술돼 있어 인용이 정확함(구현 자체는 checklist 상 미완료지만 target 은 구현 완료를 주장하지 않음 — plan 텍스트 존재만 인용).
- **후속 항목 누락** — 트리거·스케줄·알림 규칙 세 문서(`2-trigger-list.md`·`3-schedule.md`·`9-user-profile.md`)의 §1.1 미러 이월은 트래커 1491-1494행에 실제로 등재돼 있어 target 의 Rationale W3 서술과 1:1 대응. 누락 없음.

## 요약
target(`spec-draft-cross-workspace-refs-2.md`)은 직전 `--impl-prep` Critical(구현보다 먼저 착지한 `pending_plans` 미등재·완료형 서술)을 정확히 겨냥해 고치고, 관련 in-progress plan(`cross-workspace-refs.md`, `spec-draft-nullable-notation-followups.md`)과의 결정·전제·후속 이월이 모두 맞물려 있다 — 세 lens 모두 차단급 불일치는 없다. 다만 target 을 신설한 것과 **같은 커밋**에서 트래커가 target 을 "이미 `plan/complete/`" 로 선인용해, 방금 고친 것과 동일한 종류의 죽은 경로 패턴이 형태를 바꿔 재발했다(WARNING, 가드 미포착·자기-해소 예정이나 세션이 끊기면 영구화 위험). Rationale 의 marketplace 선례 인용은 결론을 완전히 뒷받침하지 않는 사소한 근거 오류(INFO)로 차단 사유는 아니다.

## 위험도
LOW
