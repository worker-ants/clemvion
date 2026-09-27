# Rationale 연속성 검토 — `plan/in-progress/spec-draft-cross-workspace-refs-2.md`

## 발견사항

- **[INFO]** "(Planned) 라벨 생략" 결정의 선례 인용이 실제 선례와 완전히 대응하지 않음
  - target 위치: `plan/in-progress/spec-draft-cross-workspace-refs-2.md` `## Rationale` 첫 항목 — "«(Planned)» 라벨을 달지 않는다 (같은 세션 W1)"
  - 과거 결정 출처: `spec/2-navigation/1-workflow-list.md` §2.7 "미구현 (Planned): 마켓플레이스 템플릿 추천 링크는 아직 없다" (같은 문서 frontmatter `pending_plans: plan/in-progress/marketplace-and-plugin-sdk.md` 와 병존)
  - 상세: 초안은 "미구현 기간의 추적은 `pending_plans` 가 맡는다 — 같은 문서가 이미 그 방식으로 `marketplace-and-plugin-sdk` 를 추적한다" 며 `pending_plans` 단독 등재로 충분하다는 선례로 이를 인용한다. 그러나 실측 결과 해당 문서 §2.7 의 marketplace 항목은 `pending_plans` 등재와 **별개로** 본문에 "미구현 (Planned)" 인라인 라벨도 **함께** 달고 있다(§4.1/§2.7 도 마찬가지 패턴). 즉 이 문서의 기존 관행은 "`pending_plans` 만으로 충분"이 아니라 "`pending_plans` + `(Planned)` 라벨 병용"이었다. 초안이 실제로 라벨을 생략하는 결정적 근거(spec 과 코드가 같은 PR 로 착지하므로 라벨이 머지 순간 거짓이 되고 지우려면 별도 planner 턴이 필요하다)는 그 자체로 타당하고 이번 상황(same-PR landing)에는 marketplace 사례와 다른 성격이 있어 반박은 아니지만, 인용한 선례 문장 자체는 그 결론("이미 그 방식으로 추적한다")을 온전히 뒷받침하지 못한다 — 저장소 교훈(`feedback_rationale_rejected_alternatives_need_history`: Rationale 의 선례 인용은 실제 이력과 정확히 맞아야 한다)과 같은 결의 문제다.
  - 제안: "같은 문서가 이미 그 방식으로 marketplace-and-plugin-sdk 를 추적한다" 문장을, marketplace 항목은 `(Planned)` 라벨과 `pending_plans` 를 **함께** 쓰는 반면 이 항목은 배포 시점(같은 PR)이 확정적이라 라벨이 태어나자마자 거짓이 되는 점에서 다르다는 취지로 정정하거나, 이 선례 문장 자체를 빼고 same-PR 근거만 남길 것.

그 외 관점에서는 위반을 찾지 못했다:

- **기각된 대안의 재도입 여부**: target 은 `spec/2-navigation/1-workflow-list.md` §3 Rationale "(2026-09-27 정정)" 문단의 인용 경로(`plan/complete/cross-workspace-refs.md` → `plan/in-progress/cross-workspace-refs.md`)와 시제(완료형 "더했다" → 현재형 "더한다")만 바꾼다. 실측(`git grep`)으로 현재 spec 에 아직 옛 경로·완료형이 남아 있음을 확인했고, 그 대상 plan(`plan/in-progress/cross-workspace-refs.md`)의 체크리스트도 "구현 · 단위 · CHANGELOG" 가 미완료임을 확인했다 — 정정은 사실과 부합하며 과거에 기각된 설계를 되살리는 것이 아니라 직전 planner 턴(`a8bfd1492`)이 만든 "구현보다 먼저 착지한 완료형 서술"이라는 결함을 고치는 것이다.
- **데이터 모델 §1.1 "참조의 소속"과의 정합**: target 이 인용을 유지하는 링크(`../1-data-model.md#11-참조의-소속`)는 실제로 "워크플로 생성 · 수정 `folderId` · 폴더 생성 · 수정 `parentId`" 를 워크스페이스 범위로 규정하고 있어(§1.1 표), target 의 서술 방향과 일치한다.
- **`pending_plans` 가드 동작에 대한 사실 주장 검증**: target 은 "§4 가드(`spec-pending-plan-existence.test.ts`)는 in-progress 경로를 complete 로 치환해서도 찾으므로, 같은 PR 끝에서 plan 이 `complete/` 로 옮겨져도 이 항목은 유효하다" 고 적는다. `codebase/frontend/src/lib/docs/__tests__/spec-pending-plan-existence.test.ts` 소스를 직접 읽어 `planRel.replace("/in-progress/", "/complete/")` 로 두 경로 모두 존재 여부를 검사함을 확인했다 — 사실과 일치.
- **W2·W3·W4 처분**: 초안은 세 항목을 각각 근거를 들어 처분한다(W2: 구현 plan 처방이 이미 `details` 배열 형태를 명시 — plan 원문 §처방에서 확인, spec 은 목표 상태로 남김. W3: 트리거·스케줄 미러는 SoT(§1.1)를 부정하지 않는 지연이라 별도 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 로 이관 — 같은 트래커가 `spec/1-data-model.md` 의 다른 다수 Rationale 항목(웹훅 경로 예약·FK 인덱스 등)에서 이미 반복적으로 쓰는 것과 같은 패턴. W4: `plan/**` 문서라 developer 직접 수정 권한 범위, planner 인계 불필요 — `20_21_21` SUMMARY 의 처분 표와 일치). 세 항목 모두 무근거 묵살이 아니라 근거를 남긴 의도적 유예이며, 직전 세션의 WARNING 을 "반영"(수용 또는 명시적 반박)한다는 저장소 관행과 부합한다.
- **자기-반증형 소정정 경계**: 이 target 은 `owner: project-planner` 이고 대상 문장(`1-workflow-list.md` §3 정정 문단)을 원래 쓴 주체도 planner 턴(`a8bfd1492`)이었다 — developer 가 spec 을 직접 고치는 예외 조항이 적용될 필요가 없는, 정상적인 planner 턴 처리다.

## 요약

target 은 직전 `--impl-prep` 재실행의 Critical(구현이 없는데 완료형·존재하지 않는 `plan/complete/` 경로를 인용한 spec 서술)을 좁게 교정하는 문서로, 실측 결과 인용 경로·시제 정정은 실제 코드/plan 상태와 부합하고 과거에 기각된 설계를 재도입하거나 §1.1 "참조의 소속" 등 기존 Rationale 이 못박은 원칙을 위반하는 지점은 없다. `pending_plans` 가드 동작에 대한 사실 주장도 소스 대조로 검증된다. 유일하게 걸리는 지점은 "(Planned) 라벨을 달지 않는다"는 새 결정이 드는 선례("같은 문서가 이미 그 방식으로 marketplace-and-plugin-sdk 를 추적한다")가 실제로는 그 항목이 라벨과 `pending_plans` 를 **함께** 쓰고 있어 인용이 결론을 완전히 뒷받침하지 못한다는 것인데, 결정 자체의 실질 근거(같은 PR 착지로 라벨이 즉시 거짓이 됨)는 별도로 성립하므로 CRITICAL/WARNING 이 아니라 인용 정밀도 보완 수준의 INFO 다.

## 위험도
LOW
