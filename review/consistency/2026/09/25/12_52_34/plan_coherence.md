# Plan 정합성 검토 — `plan/in-progress/changelog-criteria.md`

## 발견사항

- **[INFO]** `.claude/agents/documentation-reviewer.md` 쓰기 권한의 근거가 선례 인용에 그친다
  - target 위치: 처방 표 (`## B. 처방`) 4번째 행 — `.claude/agents/documentation-reviewer.md` 관점 6 수정
  - 관련 plan: 없음 (다른 in-progress plan 이 이 파일의 소유 축을 논쟁하고 있지 않음)
  - 상세: CLAUDE.md 의 harness 두 축 규정(`코드·테스트·도구(hooks/·tools/·tests/)`=developer,
    `거버넌스 문서(CLAUDE.md·.claude/skills/**/SKILL.md·.claude/docs/**)`=planner)은
    `.claude/agents/**` 를 명시적으로 어느 쪽에도 넣지 않는다. target 은 `#991`
    (`fix(harness): 리뷰어 위치 기재를 소스 라인에 고정`, `git log` 확인 — 실제로 이
    커밋이 같은 파일을 developer 관례(`fix(harness):`)로 고쳤다)을 선례로 들어 developer
    소유를 정당화한다. 이 선례 자체는 실재하므로 target 의 결정이 다른 plan 의 미해결
    결정과 직접 충돌하지는 않지만, CLAUDE.md 본문이 이 축을 명문화하지 않은 채로 두
    번째 선례가 쌓이는 상태다.
  - 제안: plan_coherence 범위 밖(경계 정의 자체는 convention_compliance/거버넌스 사안)이라
    이 PR 을 막을 사유는 아님. 다만 두 번째 선례가 쌓였으니 CLAUDE.md 의 harness 표에
    `.claude/agents/**` 를 명시적으로 편입할지는 별도 planner 턴에서 검토할 만하다는 점만
    기록.

- **[INFO]** "재판정 후보" 10건은 이 PR 종료 후 트래커에 등재되어야 이력이 안 끊긴다
  - target 위치: `## B. 처방` 하단 — `#1364`·`#1354`·`#1358`·`#1206`·`#1261`·`#1262`·
    `#1263`·`#1245`·`#1238`·`#1270`
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:5159` (이 PR 이
    닫으려는 원 항목)
  - 상세: target 의 `## C. 검증` 체크리스트 마지막 항목("트래커 항목 닫기 + 재판정 후보
    등재")이 이 등재를 이미 to-do 로 포함하고 있어 실제 누락은 아니다. 다만 원 트래커
    항목(5159행)의 체크박스를 `[x]` 로 바꾸는 동시에 위 10건을 **새 항목**으로 등재하는
    두 동작이 한 커밋에서 함께 이뤄지지 않으면(plan 체크박스=실제 상태 원칙), 재판정
    후보 목록의 유일한 근거가 이 in-progress 문서에만 남아 나중에 `complete/` 로 이동될
    때 소실될 수 있다.
  - 제안: 구현 커밋에서 (a) 5159행 체크, (b) 10건을 별도 체크리스트 항목으로
    `spec-draft-nullable-notation-followups.md` 에 신규 등재를 같은 turn 에 수행할 것 —
    target 의 `## C` 항목이 이미 이렇게 지시하므로 실행 시 누락되지 않게 확인만 하면 됨.

target 이 참조하는 사실관계(§A 전수 분류, `.claude/agents/documentation-reviewer.md` 가
저장소 안 유일한 CHANGELOG 기준 언급이라는 주장, `PROJECT.md` §변경 유형 매핑 표에
CHANGELOG 행이 없다는 주장)를 직접 grep 으로 재확인했고 모두 실측과 일치했다. 원
트래커 항목(`spec-draft-nullable-notation-followups.md:5159`)이 요구한 전제("판정
기준을 적기 전에 기존 항목을 전수로 분류할 것")를 target 의 §A 가 실제로 수행했다.
CHANGELOG 를 언급하는 다른 12개 in-progress plan(`auth-guard-reflection-hardening.md`,
`eia-terminal-payload.md`, `keyset-cursor-uuid-validation.md`,
`nestjs-v12-coordinated-upgrade.md`, `node-cancellation-residual-signal-propagation.md`,
`spec-sync-external-interaction-api-gaps.md`, `spec-sync-auth-gaps.md`,
`spec-draft-eia-62-waiting-payload.md`, `ie-resume-turn-boundary-cancel.md`,
`retry-turn-terminal-guard.md`, `update-returning-tuple-shape.md`,
`backend-lint-gate-broken-on-main.md`)를 전수 grep 했으나, 전부 "이 PR 이 자신의
CHANGELOG 항목을 어떻게 적었는가/정정했는가" 류의 실행 기록이었고 target 이 세우려는
일반 기준과 상충하는 별도의 "결정 필요" 항목은 없었다. target 이 백필 후보로 꼽은
PR 번호 10건도 다른 in-progress plan 안에서 다른 처분이 이미 결정된 흔적이 없다.

## 요약
`plan/in-progress/changelog-criteria.md` 는 `spec-draft-nullable-notation-followups.md`
의 낮은 우선순위 developer 항목(5159행)을 닫기 위한 단일 plan 이며, 그 항목이 요구한
"전수 분류 후 처방" 절차를 실제로 수행한 흔적이 검증됐다. 다른 in-progress plan
39개 중 CHANGELOG 를 언급하는 12개를 대조했으나 target 의 결정과 충돌하는 미해결
결정이나 target 이 전제하는데 아직 안 풀린 선행 조건은 발견되지 않았다. `spec_impact:
none` 은 target 이 건드리는 파일(`CHANGELOG.md`, `.claude/agents/documentation-
reviewer.md`)이 실제로 spec 외부인 것과 일치한다. `.claude/agents/**` 의 harness
소유 축이 CLAUDE.md 에 명문화돼 있지 않다는 점과 재판정 후보 10건의 등재 시점 정합만
INFO 로 남긴다 — 둘 다 착수를 막을 사유는 아니다.

## 위험도
NONE
