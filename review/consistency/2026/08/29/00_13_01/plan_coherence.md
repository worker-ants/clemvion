### 발견사항

- **[WARNING]** target 이 판별 기준 명문화를 위임받은 실제 SoT 인 `deps-peer-gating-and-eslint10.md` 를 인용하지 않고, 완료 후 그 plan 을 닫는 절차도 없다
  - target 위치: `plan/in-progress/spec-draft-error-cause-criterion.md` `## Overview` (`#1219`/`#1226` 인용부), `## 체크리스트`
  - 관련 plan: `plan/in-progress/deps-peer-gating-and-eslint10.md` §2 체크리스트 "(후속, INFO) `cause` 부착 판단 근거" 항목 — "`spec/conventions/` 에 판별 기준을 명문화하는 것은 **여전히 planner 턴**으로 남는다"
  - 상세: `#1219`(eslint 10 상향)·`#1226`(cause 보존 테스트 잠금)은 둘 다 `git log` 로 확인한 실제 커밋이고, 그 작업을 추적한 SoT 는 `review/**`(SoT 아님)가 아니라 `plan/in-progress/deps-peer-gating-and-eslint10.md` 다. 그 plan 은 이 정확한 결정("3곳 처분이 갈린 이유를 spec/conventions/ 에 명문화")을 developer 권한 밖으로 명시하며 미해결로 남겨 뒀다. target 의 Overview 는 이 사실을 "`#1226` 리뷰가 짚었다"로만 서술해 review 산출물을 근거로 삼고, plan SoT 를 인용하지 않는다. 또한 target 의 체크리스트 어디에도 완료 시 `deps-peer-gating-and-eslint10.md` 의 해당 항목을 "완료 (날짜, planner 턴 `spec-draft-error-cause-criterion`)" 형태로 갱신·교차참조하는 절차가 없다 — 이 저장소가 반복해 온 패턴(예: `eia-idempotency-key-scope`, `redis-keys-pointer-integrity` 등 다수 항목이 완료 시 원 plan 에 "완료 (…, planner 턴 `slug`)"를 남긴다)과 다르다. 이대로 진행하면 `deps-peer-gating-and-eslint10.md` 의 그 항목이 실제로는 해소됐는데도 미해결로 읽혀, 다음에 그 plan 을 여는 사람이 이미 끝난 결정을 다시 검토하게 된다.
  - 제안: target 문서에 `deps-peer-gating-and-eslint10.md` 를 "선행 plan"으로 명시 인용하고, 체크리스트에 "완료 후 `deps-peer-gating-and-eslint10.md` §2 후속 항목에 교차참조 추가" 단계를 넣는다. §6.3.1 이 `complete/` 로 반영되는 시점에 원 plan 의 체크박스 옆에도 짧게 "완료 (날짜, `spec-draft-error-cause-criterion`)" 를 남기는 편이 이 저장소의 기존 관례와 정합한다.

- **[INFO]** "인라인 주석 3곳 정리" 후속 항목의 등재처가 지정되지 않았다 — 기존 추적처가 있는데도 사용되지 않을 위험
  - target 위치: `plan/in-progress/spec-draft-error-cause-criterion.md` `## 체크리스트` 3번째 항목 ("정본이 생긴 뒤 후속으로 등재한다")
  - 관련 plan: `deps-peer-gating-and-eslint10.md` (같은 eslint10 세 파일을 이미 추적 중인 plan)
  - 상세: target 은 인라인 주석 갱신을 developer 턴 후속으로 미루면서 "어디에 등재할지"를 specify 하지 않는다. 이 세 파일(`expression-resolver.service.ts`·`code.handler.ts`·`secret-resolver.service.ts`)의 `preserve-caught-error` 처분은 이미 `deps-peer-gating-and-eslint10.md` 가 추적 중인 항목이라, 새 plan 을 만들기보다 그 plan 의 §2 후속 절에 이어 붙이는 편이 추적 비용이 낮다. 등재처를 specify 하지 않으면 다음 세션이 새 plan 파일을 만들어 같은 작업이 두 곳에 흩어질 수 있다.
  - 제안: 체크리스트 항목에 "`deps-peer-gating-and-eslint10.md` §2 후속에 등재" 를 명시.

- **[INFO]** 같은 spec 파일(`3-error-handling.md`)의 다른 절을 겨냥한 plan 이 로컬에 이미 존재 — 섹션은 겹치지 않아 충돌은 아니나 인지 필요
  - target 위치: `plan/in-progress/spec-draft-error-cause-criterion.md` `## 제안` (`§6.3` 신설)
  - 관련 plan: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` (동일 파일 `§1.2` 에 `OAUTH_STATE_MISMATCH` 등재 예정)
  - 상세: 두 plan 모두 `spec/5-system/3-error-handling.md` 를 `spec_impact` 로 갖고 있고, 각각 `§1.2`·`§6.3` 이라는 다른 절을 편집한다. 의미상 충돌은 없지만(다른 절, 다른 주제) 같은 파일을 두 plan 이 각자 편집 대상으로 삼고 있다는 사실 자체는 실행 순서에 참고할 가치가 있다.
  - 제안: 별도 조치 불요. 착수 시 두 plan 이 같은 turn 에서 겹치지 않도록만 유의.

### 요약

target 문서(`spec-draft-error-cause-criterion.md`)가 제시하는 판별 기준·근거·배치 결정(`3-error-handling.md §6.3.1`) 자체는 코드 실측(3개 파일의 실제 처분)과 정확히 일치하고, 다른 in-progress plan 이 명시적으로 잠가 둔 미해결 결정과 충돌하지도 않는다. 다만 이 정확한 작업을 이미 위임해 둔 SoT 가 `plan/in-progress/deps-peer-gating-and-eslint10.md` 인데도 target 이 그 plan 을 인용하지 않고 review 산출물(`#1226`)만 근거로 대며, 완료 시 그 plan 의 해당 체크박스를 닫는 절차도 계획돼 있지 않다 — 이는 "후속 항목 누락" 범주의 WARNING 이다. 그 외 인라인 주석 정리 후속의 등재처 미지정, 같은 spec 파일을 겨냥한 다른 plan 의 존재는 정보성 메모로 족하다.

### 위험도
LOW
