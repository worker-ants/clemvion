Confirmed accurate — this matches the target's table exactly (each workflow's `relevant` pathspec includes its own stack + `codebase/packages/**`, but not the other stack). No fabrication found.

Based on this extensive verification, I have sufficient grounds for my findings.

## 발견사항

- **[WARNING]** 트래커 상 중복 항목이 이번 결정으로 함께 정리되지 않음
  - target 위치: `plan/in-progress/masked-marker-shared-package.md` §"다른 plan 과의 관계" (라인 37-47)
  - 과거 결정 출처: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:373-380` — `12_33_36`(2026-08-17) 등재 **"마커 미러 계약 테스트 — backend SoT ↔ frontend 미러를 기계가 대조하게 한다"** 항목
  - 상세: target 은 "다른 plan 과의 관계"에서 **두 항목만** 대체·종결 대상으로 명시한다(§745 이하 "마커 리터럴 cross-stack 계약 테스트 부재" 및 `05_23_14` wrapper 서술). 그러나 실측 결과 spec-sync 트래커에는 **세 번째**, 시기상 더 이른 항목(`12_33_36`, line 373)이 이미 있고 그 항목 자체가 "남은 것: 두 스택을 가로지르는 대조 … 공유 패키지 추출(`packages/`)이 선행돼야 값싸다 — 그래서 별건으로 남긴다"라고 **정확히 이 PR 의 작업을 전제조건으로 지목**하고 있다. target 이 R17 의 "마커 집합은 backend SoT, 프런트가 미러한다" 문구를 (planner 턴으로) 정정하면, 이 `12_33_36` 항목은 이미 존재하지 않는 SoT 모델("backend SoT ↔ frontend 미러")을 전제로 한 채 트래커에 미결 상태로 남아 stale 해진다.
  - 제안: "다른 plan 과의 관계" 절에 `12_33_36`(line 373) 항목도 대체·종결 대상으로 추가하거나, 최소한 "이 작업으로 그 전제조건(패키지 추출)이 충족되었으니 재평가 필요"라는 교차 참조를 구현 커밋과 같은 턴에 남긴다. (memory 교훈 "이월 항목 유실" 패턴과 동일 위험 — `review/**`·트래커는 SoT 이므로 발견 시점에 바로 적어야 한다.)

## 요약
target 문서는 Rationale 연속성 관점에서 이례적으로 꼼꼼하다 — (1) `git log -S "MASKED_MARKERS"` 로 과거 "추출 기각" 이력이 실제로 없음을 확인한 뒤 진행했고, (2) R17 이 명시한 "공유 프리미티브를 넓히면 무관한 경로가 오염된다" 원칙을 그대로 인용해 `MAX_SANITIZE_DEPTH` 통합을 스스로 기각했으며(실측 10/11 깊이 차이도 코드로 확인됨, 정확), (3) R17 의 "마커 집합은 backend SoT, 프런트가 미러" 서술이 이 작업 이후 사실과 어긋난다는 점을 인지하고 `developer` 는 `spec/` read-only 라는 프로젝트 규약에 따라 **정정을 planner 턴으로 명시적으로 분리**했다(무근거 번복이 아니라 예정된 갱신), (4) `@workflow/ai-end-reason` 선례와 `ws-event-types-extract.md` 선례를 인용했는데 둘 다 실제로 존재하고 인용된 형태와 정확히 일치함을 확인했다. 유일한 흠은 spec-sync 트래커의 세 번째 관련 항목(`12_33_36`)이 "다른 plan 과의 관계" 교차 참조에서 빠져 있어, 구현 후 그 항목이 이미 폐기될 SoT 모델을 전제로 한 채 방치될 위험이다. 이는 Rationale 자체의 위반이 아니라 Rationale 변경이 파급되는 인접 트래커 문서의 동기화 누락이다.

## 위험도
LOW
