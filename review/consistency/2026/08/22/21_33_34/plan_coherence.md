### 발견사항

없음. `plan/in-progress/**` 전수(마스킹/트리거 키워드 grep + 직접 열람)를 대조한 결과,
target(`spec/4-nodes/7-trigger/`)에 대한 미해결 결정 충돌·선행 plan 미해소·후속 항목 누락이
발견되지 않았다.

**근거 요약**:

- 이번 diff 는 `codebase/backend/.../reject-masked-resubmission.spec.ts` 에 캐너리 테스트 1건을
  추가하는 것뿐이며, 이는 `plan/in-progress/masked-marker-test-gaps.md`(본 세션의 정본
  작업 plan, worktree 이름과 일치)의 항목 ①을 그대로 집행한 것이다.
- 정본 트래커 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` §"마커 재제출
  거부 PR 의 이월 항목"(L888-902)이 같은 항목(`throwIfAny` phase 경계 트레이드오프 미검증)을
  **이미 `[x]` 로 닫고** 동일한 근거(대조군 필요성, 21개 기존 테스트가 반대 방향만 덮음)를
  기록해 두 문서가 정합한다.
- 같은 트래커에서 `findMaskedResubmissions` 직접 단위 테스트 항목(L829-842)은 여전히
  `[ ]`(유예)이며, masked-marker-test-gaps.md 도 "② 유예 유지, 근거만 교체"로 동일하게
  기술한다 — 유예 근거가 "소비처 개수" 에서 "분기 커버리지 실측" 으로 바뀐 것도 양쪽 문서에
  일관되게 반영돼 있다. 이번 diff 는 이 함수의 직접 단위 테스트를 추가하지 않았고, 그렇다고
  주장하지도 않는다 — 미해결 항목을 우회 결정으로 덮은 흔적 없음.
- `ExecutionsService.reRun` 리팩터(137→141줄, L824-828)와 swagger 길이 예외(L843-859),
  `execute` 엔드포인트 DTO 승격(L880-887) 등 나머지 미체크 항목은 이번 diff 범위(테스트 파일
  1개) 밖이며 target spec 본문도 이 항목들과 무관하다 — 우회·무시된 정황 없음.
- target 의 `1-manual-trigger.md` Rationale(§"raw 우선 + resolve 후 재검사")은 2026-08-21
  자 기존 결정이며 이번 diff 는 그 결정을 코드로 잠그는 것뿐 — 새 결정을 일방적으로 내리지
  않는다.
- `plan/in-progress/node-output-redesign/manual-trigger.md`(Manual Trigger output 구조에 대한
  별도 분석 plan)는 masked-value 관련 내용이 전혀 없고 output shape 변경도 이번 diff 와
  무관 — 충돌 없음.
- `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 가 EIA §R17 을 다른 서브토픽
  (`getStatus`/`llmCalls` strip)으로 동시에 참조하지만, 이번 diff·target 은 §R17 본문을
  건드리지 않으므로 편집 충돌 표면이 아니다(참고용 INFO 수준에도 못 미침 — 실제 겹치는
  변경이 없음).
- 마커 시리즈 관련 다른 조건부 항목("마커 리터럴을 산문으로 재기술", PR #1194 흡수 조건)도
  `spec/conventions/egress-masking.md` 파일 존재를 직접 확인해 트래커의 종결 근거가 사실과
  일치함을 검증했다.

### 요약
target(`spec/4-nodes/7-trigger/`) 변경분(캐너리 테스트 1건 추가)은 이 세션의 정본 plan
(`masked-marker-test-gaps.md`)이 예고한 범위와 정확히 일치하며, 그 plan 이 인용하는 정본
트래커(`spec-sync-external-interaction-api-gaps.md`)도 같은 항목을 같은 근거로 닫아 두 문서
간 드리프트가 없다. 나머지 미해결(유예) 항목들은 이번 diff 범위 밖이고 target 본문도 그
항목들에 대해 어떤 결정도 대신 내리지 않는다. Plan 정합성 관점에서 위험 신호 없음.

### 위험도
NONE
