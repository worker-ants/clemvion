# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** plan/트래커 체크박스가 실제 상태(머지 완료)와 어긋난 채로 diff 에 포함돼 있다
  - 위치: `plan/in-progress/workflow-version-creator.md:85-86` (`- [ ] \`--impl-done\`` · `- [ ] 트래커 두 항목 닫기`), `plan/in-progress/spec-draft-nullable-notation-followups.md:1036` (`- [ ] **\`WorkflowVersion*Dto.creator\` 의 §5.4 금지 조합을 갚는다** …`)
  - 상세: 사용자가 "머지했어" 라고 확인한 시점 기준으로, 실제 코드(DTO·서비스·e2e)는 이미 §5.4 기본형으로 완전히 정정되었고 테스트도 통과했다. 그런데 이 diff 에 실린 두 plan 문서의 체크박스는 여전히 `[ ]` — `plan/in-progress/workflow-version-creator.md` 자체 체크리스트의 `--impl-done` 과 "트래커 두 항목 닫기", 그리고 트래커(`spec-draft-nullable-notation-followups.md`)의 대응 항목(`creator` §5.4 금지 조합)이 미체크 상태다. plan 안에 "마무리 커밋에서 처리" 라고 명시돼 있어 **의도된 순서**(리뷰 → 체크박스 정리 → `--impl-done`)이긴 하나, 그 마무리 커밋이 이 diff 스냅샷에는 아직 보이지 않는다. 프로젝트 규약(plan 체크박스 = 실제 상태, 체크와 완료 이동은 한 동작)에 비춰, 머지된 상태로 남으면 다음 사람이 "아직 안 끝난 작업" 으로 오인하거나, 반대로 트래커에서 이 항목이 처리 안 된 것으로 착각할 수 있다.
  - 제안: 마무리 커밋에서 (1) `workflow-version-creator.md` 의 `--impl-done`·"트래커 두 항목 닫기" 를 `[x]` 로, (2) 트래커의 `creator` §5.4 항목을 `[x]` + 완료 각주(plan 이 이미 INFO 4 로 예고한 대로 프런트엔드 미러 비변경 결정 포함)로 갱신해 이 diff 를 뒤따르게 한다. 이번 라운드 판정을 막을 사안은 아니다(plan 자신이 순서를 이미 선언해 두었음).

- **[INFO]** (재확인, 조치 완료) 직전 리뷰 라운드(`review/code/2026/09/27/00_20_58`)가 지적한 문서화 INFO 2건은 `69b1afca0` 에서 실제로 반영됨을 직접 대조로 확인
  - 위치: `CHANGELOG.md:26` (제목이 이제 `` `creator` · `changeSummary` `` 둘 다 명시), `codebase/backend/test/workflow-crud.e2e-spec.ts` 모듈 JSDoc "핵심:" 목록(버전 목록·상세 H·I 계약 검증 한 줄 추가됨)
  - 상세: 조치 불요 — 참고 기록.

## 전반 평가

이번 diff 는 문서화 관점에서 이미 한 차례(`00_20_58`) NONE 판정을 받았고, 그때 지적된 두 INFO(CHANGELOG 제목 범위, e2e 모듈 JSDoc 요약 갱신)는 후속 커밋에서 실제로 반영되어 남은 문서 갭이 없다. DTO 데코레이터 변경마다 "왜"(§5.4 기본형, FK NOT NULL, `type: String` 명시 이유)를 인라인 주석으로 정확히 남겼고, 신규 캐너리 테스트(`workflow-version-response.dto.spec.ts`)·대칭 단위 테스트(`workflow-versions.service.spec.ts`)는 왜 래칫·e2e 만으로 부족한지 JSDoc 으로 설명한다. `VERSION_METADATA_SELECT` 상수 도입 주석은 과거 결함 클래스(자매 메서드 투영 누락)를 근거로 들어 정확하고, `WorkflowVersionDetailProjection` JSDoc 에 추가된 프런트엔드 미러 비-변경 결정 문단도 실제 소비처(`version-history-panel.tsx`) 방어 분기와 일치한다. CHANGELOG 항목은 위치(맨 위)·형식(`## Unreleased — …` 접두)·자격 기준(API 계약 변화) 모두 상단 규약과 부합한다. `plan/in-progress/workflow-version-creator.md` 는 실측·방향·뮤턴트 검증표·`--impl-prep` 처분까지 근거를 갖춰 기록했다. 유일한 잔여 사항은 위 INFO 로 적은 plan/트래커 체크박스의 마무리 지연이며, 이는 plan 이 스스로 예고한 순서(마무리 커밋에서 처리)일 뿐 문서 내용 자체의 오류는 아니다.

## 위험도

NONE
