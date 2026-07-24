### 발견사항

- **[INFO]** `node-output-redesign/form.md` 에 D1(config echo enumeration 의무화) 재검토 각주 추가 — 본 plan(`presentation-thread-optout-drift`)의 표제 주제(§4.6 opt-out drift)와는 다른 sibling plan/다른 주제(§7 D1 config echo)에 대한 cross-file 편집
  - 위치: `plan/in-progress/node-output-redesign/form.md:156-161` (diff 게이트 155-161)
  - 상세: 이 각주는 `presentation-thread-optout-drift.md` 의 `## --spec 검사 반영` WARNING 3 처리 결과로 명시적으로 계획·체크리스트화된 항목이고("sibling `node-output-redesign/form.md:154` 에 D1 재검토 각주 + developer 후속 task 등록"), 실제 diff 도 그 계획과 정확히 일치하는 9줄 각주 삽입뿐이다. 즉 "의도 이상의 변경"은 아니고 consistency-check WARNING 해소를 위해 계획에 명시적으로 편입된 범위다. 다만 표제(§4.6 opt-out)와 무관한 별개 주제(form handler 의 `{ ...rawConfig }` spread D1 위반)를 다른 plan 문서에 부수적으로 끼워 넣는 형태라, 이 diff 만 단독으로 봤을 때는 "presentation-thread-optout-drift" 작업과 직접 연결이 안 보일 수 있다. plan 본문에 근거가 있으므로 위반은 아니나 기록 차원에서 표기.
  - 제안: 조치 불요 (plan Rationale/체크리스트에 이미 근거 명시됨). 향후 유사 사례에서는 커밋 메시지에도 "WARNING 3 해소용 cross-plan 각주"임을 한 줄 명시하면 리뷰 시 연결이 더 명확해진다.

- **[INFO]** `review/consistency/2026/07/23/19_48_09/plan_coherence.md` 에만 subagent 프로토콜 헤더(`STATUS=success ...` + `===REPORT_MARKDOWN_BELOW===`)가 최종 커밋된 markdown 본문 안에 그대로 남아 있음 — 같은 배치의 나머지 4개 checker 산출물(`cross_spec.md`, `convention_compliance.md`, `naming_collision.md`, `rationale_continuity.md`)은 순수 마크다운 본문만 있어 형식이 비대칭
  - 위치: `review/consistency/2026/07/23/19_48_09/plan_coherence.md:1-2` (전체 파일 컨텍스트 게이트 1-2)
  - 상세: 다른 4개 파일은 `### 발견사항`으로 바로 시작하는데, `plan_coherence.md` 만 `STATUS=success plan_coherence review complete (1 WARNING, 1 INFO)` 헤더 줄과 `===REPORT_MARKDOWN_BELOW===` 구분선이 저장된 파일 본문에 그대로 포함돼 있다. 이는 저자(project-planner)가 의도적으로 만든 "범위 초과 변경"이 아니라 오케스트레이션 스크립트가 이 한 건만 STATUS 헤더를 스트립하지 않고 그대로 write 한 것으로 보이는 harness 부작용이며, "포맷팅 변경이 실질 변경과 섞여 있는지" 관점에서 이 diff 배치 내 파일 간 형식 비일관성으로 기록해 둔다. 코드/스펙 변경 자체의 스코프에는 영향 없음.
  - 제안: 스코프 위반은 아니므로 이 PR 을 막을 필요는 없음. 다만 이 파일을 사람이 읽는 리포트로 재사용할 계획이면 헤더 두 줄을 제거하는 정리가 바람직 (harness 쪽 disk-write 경로 확인 권고, 별건).

## 요약

핵심 변경(스펙 `spec/4-nodes/6-presentation/0-common.md §4.6` 재서술, `spec/conventions/conversation-thread.md §2.4` 대칭 각주 추가)은 새로 작성된 plan(`plan/in-progress/presentation-thread-optout-drift.md`)의 "개정 방침"·"`--spec` 검사 반영(WARNING 1~4)" 절이 명시한 범위와 정확히 일치하며, diff 상에서 불필요한 리팩토링·무관한 코드 영역 수정·포맷팅 노이즈·주석/임포트/설정 변경은 발견되지 않았다. `plan/in-progress/node-output-redesign/form.md` 에 추가된 D1 재검토 각주는 표제 주제와 다른 sibling 문서를 건드리지만 plan 의 WARNING 3 처리 항목으로 명시적으로 계획·체크리스트화된 편입이라 "의도 이상"은 아니다. `review/consistency/**` 하위 8개 파일(SUMMARY/_retry_state.json/meta.json/5개 checker 리포트)은 이 작업의 `/consistency-check --spec` 단계 산출물로 프로젝트 관례(`review/` 산출물도 커밋)에 부합하는 정상 artifact이며 스코프 밖 추가가 아니다. 유일한 특이사항은 `plan_coherence.md` 하나에만 subagent STATUS 헤더가 본문에 남아 있는 형식 비일관성으로, 스코프 위반이라기보다 harness 산출 경로의 자잘한 결함이다.

## 위험도
LOW
