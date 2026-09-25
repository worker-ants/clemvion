# Rationale 연속성 검토 — `plan/in-progress/spec-draft-workspace-path-guard-role-census.md`

## 발견사항

- **[INFO]** `plan/complete/spec-draft-workspace-path-guard.md` 에 남는 옛 수치에 대한 상호 참조 부재
  - target 위치: `## Rationale` — "`plan/complete/spec-draft-workspace-path-guard.md` 의 같은 수치는 고치지 않는다"
  - 과거 결정 출처: 없음 (신규 관찰)
  - 상세: target 은 `spec/data-flow/12-workspace.md` 와 CHANGELOG 두 곳만 정정하고, 같은 잘못된 수치(`editor 66·admin 9·owner 7·viewer 5`)가 적힌 `plan/complete/spec-draft-workspace-path-guard.md` 는 "결정 당시 기록" 이라는 이유로 의도적으로 그대로 둔다고 명시했다. 이는 합리적인 선택이나(완료된 plan 은 역사 기록이지 SoT 갱신 대상이 아님), 향후 그 완료 plan 을 근거 자료로 인용하는 사람이 정정 사실을 모를 위험이 남는다.
  - 제안: (선택) 완료 plan 파일에 한 줄 각주("수치는 이후 `spec-draft-workspace-path-guard-role-census.md` 에서 정정됨")를 추가하거나, 현재 결정대로 두어도 Rationale 연속성 관점에서 CRITICAL/WARNING 은 아니다.

## 교차 검증 결과 (문제 없음으로 확인된 항목)

- **기각된 대안 재도입 여부**: target 은 새 대안을 채택하지 않고 기존 결정(«적용 범위는 전역이다», 규칙 (나) «비멤버는 항상 `NOT_A_MEMBER`»)을 그대로 유지한다고 명시했다. `spec/data-flow/12-workspace.md` 현재 본문(§"가드 거부의 오류 코드", §"경로 파라미터 워크스페이스도 가드가 본다")을 대조한 결과, target 이 인용한 "전 (1)/(2)" 문구는 실제 두 위치(각각 415행·420행)와 정확히 일치하며, 그 옆에 이미 존재하는 "~~두 메서드~~ 세 메서드" 취소선 정정 관행과 같은 패턴을 따른다 — 재기각·재도입에 해당하는 변경 없음.
- **합의된 원칙 위반 여부**: target 은 "결정은 바뀌지 않는다 — 규칙 (나)의 근거는 수의 크기가 아니라 «전역이라는 사실»·«비멤버에게 editor 권한이 필요하다는 틀린 진술»" 이라고 명시하며, 실제 해당 Rationale 문단(891~896행)의 논거도 숫자 크기가 아니라 "틀린 진술" 여부에 기반하므로 원칙 위반 없음.
- **결정의 무근거 번복 여부**: 수치만 정정하고 결정 자체는 번복하지 않으므로 새 Rationale 항목을 별도로 쓸 필요가 없는 유형이다 — 오히려 target 자체가 그 정정의 근거(AST 재실측 방법론, origin/main vs 머지 시점 값 분리)를 `## Rationale` 절에 적어 두어 결정 연속성을 보강한다.
- **암묵적 가정 충돌 여부**: 경로 파라미터 가드 도입이라는 시스템 invariant(§"경로 파라미터 워크스페이스도 가드가 본다")나 header-first 우선순위(§"URL slug = FE 라우팅 SoT") 등 어떤 invariant 도 target 이 건드리지 않는다 — 순수 통계 수치 정정.
- **거버넌스 규칙(CLAUDE.md §자기-반증형 소정정) 정합성**: target 은 "이 정정은 결정 턴(planner)이 쓴 Rationale 값이므로 developer 자기-반증형 소정정 예외(조건 1: developer 자신이 그 문서에 썼다)가 적용되지 않아 `--spec` 을 거친다" 고 명시적으로 판단했다. 실제로 해당 Rationale(`e2e257707`/`4c6f4f033` 이전 상태)은 project-planner 가 spec 커밋으로 작성했으므로 이 판단은 정확하다 — 예외 오적용 없음.
- **CHANGELOG 정정과의 정합성**: target 이 "CHANGELOG 는 머지 시점 값(88·63/17/4/4)으로 별도 고쳤다" 고 적은 내용은 실제 `git diff CHANGELOG.md` 미커밋 변경과 정확히 일치한다(editor 63·admin 17·owner 4·viewer 4, 합 88, "admin 8·owner 1 은 이 변경이 붙였다"). spec 은 결정 당시(origin/main, 79) 기준으로 정정하고 CHANGELOG 는 머지 시점(88) 기준으로 정정하는 이원화가 서로 모순 없이 일관되게 적용됐다.
- **실측 방법론의 재현성 서술**: target 은 "spec 값이 어떻게 나왔는지 재현하지 못했다(정규식 추정)" 고 자기 한계를 명시했다 — 과장 없는 서술로 Rationale 신뢰도 훼손 없음.

## 요약

target 은 `spec/data-flow/12-workspace.md` §Rationale 의 결정 자체(전역 적용 범위·비멤버 `NOT_A_MEMBER` 규칙)를 전혀 바꾸지 않고, 그 결정을 뒷받침하던 예시 수치(`@Roles()` 라우트 카운트)만 AST 재실측으로 정정하는 순수 사실 정정 문서다. 취소선+정정문 관행은 같은 Rationale 절 안에 이미 존재하는 선례(세 메서드 정정)와 일치하고, CLAUDE.md 의 자기-반증형 소정정 예외를 오적용하지 않고 정식 `--spec` 경로를 택한 판단도 정확하다. CHANGELOG 의 별도(머지 시점) 수치 정정과도 상호 모순이 없다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 중 어느 것도 발견되지 않았다 — 유일한 관찰은 완료된 plan 문서에 남는 구 수치에 대한 상호 참조 부재이며 이는 INFO 수준이다.

## 위험도
LOW
