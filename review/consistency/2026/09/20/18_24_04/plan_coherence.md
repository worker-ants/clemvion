# Plan 정합성 검토 — `spec/2-navigation` (--impl-done, rotate-lost-update)

## 조사 경과 (요약)

target 번들(`spec/2-navigation`)의 실제 델타는 0파일이고, 구현 diff(3파일/581줄)는
`codebase/backend/src/modules/integrations/integrations.service.ts` 의 `rotate()` 락 재설계다.
번들이 예산 절단으로 `spec/2-navigation/4-integration.md` 본문을 생략했기 때문에, 워킹트리
절대경로로 해당 파일과 관련 plan 을 직접 열어 확인했다:

- `spec/2-navigation/4-integration.md` (§8 권한 규칙, §9.2 rotate endpoint, Rationale "BullMQ
  `cafe24-token-refresh` 큐" 의 advisory lock 기각 사유)
- `spec/data-flow/5-integration.md` (rotate 시퀀스 서술)
- `plan/complete/rotate-lost-update.md`, `plan/complete/spec-draft-rotate-conflict.md`(superseded)
- `plan/in-progress/spec-draft-nullable-notation-followups.md` (diff 로 23줄 갱신됨)
- `review/consistency/2026/09/20/16_58_56/plan_coherence.md` (이 작업의 `--impl-prep` 라운드 결과)

## 발견사항

발견된 CRITICAL/WARNING 없음. 아래는 확인 과정에서 남기는 INFO 다.

- **[INFO]** `--impl-prep` 라운드이 지적한 WARNING(400/422 불일치를 drive-by 로 우회할 위험)이
  실제로 잘 닫혔다
  - target 위치: `plan/complete/rotate-lost-update.md` §"`--impl-prep` 이 요구한 경계 셋" (W2)
  - 관련 plan: `review/consistency/2026/09/20/16_58_56/plan_coherence.md` WARNING("같은 함수
    안에 미해결 planner 결정이 있는데 plan 이 언급하지 않는다" — `INTEGRATION_TEST_FAILED` 400 vs
    spec 422 불일치, `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 별도 열린
    항목)
  - 상세: 완료된 plan 이 "이 PR 은 `INTEGRATION_TEST_FAILED` 의 상태 코드·세분성을 바꾸지 않는다 —
    그 결정은 별도 열린 planner 항목" 이라는 경계선을 명시했고, 실제 diff 를 확인해도
    `dispatchTest`/`INTEGRATION_TEST_FAILED` 관련 라인은 전혀 건드리지 않았다. 지적된 위험이
    실현되지 않았음을 diff 로 재확인.
  - 제안: 조치 불요 (확인 목적의 기록).

- **[INFO]** 두 후속 항목이 이번 diff 로 트래커에 새로 등재됐고 범위·우선순위가 적절하다
  - target 위치: `spec/2-navigation/4-integration.md` §8 권한 규칙("Rotate | 본인 것만")· 관련
    없음(spec/data-flow 는 target 번들 밖)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` (diff +23줄) 신규
    두 항목 — ① "`spec/data-flow/5-integration.md` 의 rotate 서술에 잠금 메커니즘이 없다"(planner,
    비차단), ② "personal-scope 통합의 «본인 것만» 소유자 검증이 코드에 없다"(planner+developer)
  - 상세: ①은 target 번들 밖(spec/data-flow) 이라 이 검토의 채점 대상은 아니지만, 이미
    `/ai-review`(`18_09_24` SPEC-DRIFT)·`--impl-prep`(`16_58_56` cross_spec INFO)에서 두 번
    비차단으로 처분된 것과 일치해 새 지적 없음. ②는 `spec/2-navigation/4-integration.md` §8 이
    선언한 "Rotate: 본인 것만(Personal)" 과 코드(`assertCanRotate` 는 organization-scope 만
    검사)의 실제 갭인데, `git show` 대조로 이 PR 이전부터 있던 gap 임이 확인돼 이 PR 의 회귀는
    아니다. 현재 `status: implemented` + `pending_plans` 미기재 상태는, 이 저장소가 이미
    `status: implemented` 문서에서 부차적 트래커 항목을 프런트매터 승격 없이 인라인 참조만 남기는
    선례(같은 파일의 `consecutiveNetworkFailures` 노출 중단 추적, `spec/1-data-model.md` 등)와
    같은 결을 따른다. 다만 그 선례들은 "미사용 필드 정리" 류 저위험 항목이고 이번 갭은 권한
    enforcement 라는 점에서 성격이 다르므로, 후속으로 이 항목의 범위(조회·수정·삭제 전반)가
    확정되면 `status: partial` + `pending_plans` 승격을 검토할 가치가 있다.
  - 제안: 차단 사유 아님. 이미 트래커에 있는 항목의 처리 우선순위가 올라갈 때 frontmatter 갱신을
    함께 고려.

- **[INFO]** 이전에 제안됐던 계약 신설안(409)은 정상적으로 철회·기록됐다
  - target 위치: 해당 없음 (spec/2-navigation 미변경 — `spec_impact: none` 이 실제로 유지됨)
  - 관련 plan: `plan/complete/spec-draft-rotate-conflict.md`(status: superseded)
  - 상세: `INTEGRATION_ROTATE_CONFLICT`(409) 신설안은 `/consistency-check --spec`
    (`review/consistency/2026/09/20/16_43_05`, BLOCK:YES)이 "대상 spec 이 `status: implemented`
    라 미구현 계약을 얹으면 `partial` 로 낮춰야 한다" 는 이유로 반증했고, 실제 구현은 계약을
    바꾸지 않는 락 재설계(같은 모듈의 `CONC H-3` 선례)로 방향을 틀었다. `plan/in-progress/**`
    전수에 이 405/409 안과 충돌하는 열린 결정은 남아 있지 않다.
  - 제안: 조치 불요.

## 요약

`plan/in-progress/**` 전체에서 이 diff(`integrations.service.ts` `rotate()` 락 재설계)와 충돌하는
미해결 결정이나 미해소 선행 조건은 발견되지 않았다. 오히려 이 작업은 plan 위생 모범 사례에
가깝다 — (1) 먼저 시도한 409 계약안을 `--spec` 이 반증하자 스스로 철회 기록을 남겼고, (2)
`--impl-prep` 라운드가 지적한 "동일 함수 내 미해결 결정 drive-by 우회 위험" 을 완료된 plan 이
명시적 경계선(W2)으로 닫았으며 diff 로도 확인됐고, (3) 리뷰 과정에서 새로 드러난 두 후속
항목(spec/data-flow 서술 갭·personal-scope 권한 갭)을 같은 diff 안에서 트래커에 정확한 소유자·
우선순위로 등재했다. `spec/2-navigation` target 번들 자체에는 이번 diff 로 인해 갱신이 필요한
자리가 없다(spec_impact: none 이 정확).

## 위험도
NONE
