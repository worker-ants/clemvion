# Rationale 연속성 검토 — `plan/in-progress/changelog-criteria.md`

## 검토 범위 메모

target 은 `spec/**` 를 전혀 건드리지 않는다(`spec_impact: none`, 처방(B절)의 대상 파일은
`CHANGELOG.md` 와 `.claude/agents/documentation-reviewer.md` 뿐). 번들에 실제 본문이 포함된
spec Rationale 은 `0-overview.md` · `1-data-model.md` · `2-navigation/{1-workflow-list,2-trigger-list,3-schedule}.md`
다섯 개뿐이고(나머지 78개는 예산 초과로 절단), 이 다섯 어디에도 "CHANGELOG 판정 기준" ·
"가드/테스트 구분" · "문서-리뷰어 관점" 같은 주제를 다룬 결정이 없다. 아래는 그럼에도 확인 가능한
교차점을 점검한 결과다.

## 발견사항

- **[INFO]** 마이그레이션 백필 대상(V110~V130)이 기존 Rationale 의 실제 구현 범위와 정합
  - target 위치: `plan/in-progress/changelog-criteria.md` B절 `CHANGELOG.md` 백필 행("V110~V130 인덱스 마이그레이션")
  - 과거 결정 출처: `spec/1-data-model.md` `## Rationale` — «쓸 인덱스가 없는 FK 서른하나의 처분»(V121~V130 구현) · «그래프 RAG 삭제 연쇄의 FK 인덱스 넷»(V117~V120 구현)
  - 상세: target 이 지목한 V110~V130 범위는 두 Rationale 항목이 실제로 구현했다고 밝힌 마이그레이션 번호(V117~V120, V121~V130)를 포함한다. 재도입·번복이 아니라 이미 확정된 사실을 CHANGELOG 에 사후 기록하는 것뿐이라 충돌은 없다.
  - 제안: 조치 불필요. 백필 시 PR 번호(`#1285`·`#1349`~`#1352`)와 위 두 Rationale 항목이 명시한 V-번호가 서로 어긋나지 않는지만 구현 단계에서 실측 확인(이 검토자의 스코프 밖 — 사실검증 담당 몫).

- **[INFO]** "가드를 느슨하게 하는 변경도 CHANGELOG 항목" 원칙은 기존 Rationale 의 가드 개념과 방향이 같다
  - target 위치: `plan/in-progress/changelog-criteria.md` B절 "가드 · 제품 경계의 정의"
  - 과거 결정 출처: `spec/1-data-model.md` `## Rationale` — «`code:` 에 전용 e2e 가드 셋»("가드를 약하게 고치는 변경이 코드 리뷰만 거치지 않는다")
  - 상세: 두 문서 모두 "가드를 약화시키는 변경은 특별 취급이 필요하다"는 동일한 전제를 공유한다(전자는 CHANGELOG 항목화, 후자는 `--impl-done` 대조). 서로 다른 메커니즘이지만 원칙 차원에서 대립하지 않는다 — 오히려 보강 관계다.
  - 제안: 조치 불필요. 다만 향후 `spec/conventions/` 에 CHANGELOG 기준을 정식 문서화할 경우 이 두 "가드 약화 감지" 장치를 상호 참조해 두면 다음 사람이 두 메커니즘의 관계를 다시 추론하지 않아도 된다.

target 문서의 나머지 내용(전수 조사 A절, 트래커 종결 절차, 검증 체크리스트)은 스캔한 다섯 개 spec Rationale 의 결정·원칙과 주제가 겹치지 않아 재도입·번복·invariant 우회 후보가 발견되지 않았다.

## 요약

target 은 spec 을 전혀 변경하지 않는 순수 문서/프로세스 plan(`CHANGELOG.md` 기준 블록 + 리뷰어 프롬프트 관점 6 갱신)이며, 이번 번들에서 실제 본문을 확인할 수 있었던 다섯 개 spec 문서(`0-overview.md`, `1-data-model.md`, `2-navigation/1·2·3`)의 `## Rationale` 어디에도 CHANGELOG 관행·가드 정의·문서 리뷰 기준과 상충하는 기각된 대안이나 합의 원칙이 없었다. 유일한 교차점(V110~V130 마이그레이션 백필, 가드 약화 감지 원칙)은 기존 결정을 재도입하거나 번복하는 것이 아니라 이미 구현된 사실의 사후 기록이거나 방향이 같은 보강이라 충돌이 없다. 다만 나머지 78개 spec 파일은 컨텍스트 예산으로 절단되어 이 결과에 포함되지 않았다는 점은 한계로 남는다.

## 위험도
NONE
