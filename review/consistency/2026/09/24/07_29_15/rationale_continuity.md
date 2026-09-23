# Rationale 연속성 검토 — spec/5-system (--impl-prep, member-owner-toctou)

## 발견사항

- **[WARNING]** owner 보호 도메인의 확립된 TOCTOU 방지 패턴(비관적 락)에서 벗어나면서 spec Rationale 갱신이 없음
  - target 위치: `plan/in-progress/member-owner-toctou.md` §B(처방)·§C(착수 전 실측) — 대응 spec 서술은 `spec/5-system/1-auth.md` §3.2 각주(†) `CANNOT_REMOVE_OWNER`
  - 과거 결정 출처: `spec/data-flow/12-workspace.md` §1.10 — `POST /api/workspaces/:id/leave` 행 "sole-owner 판정과 멤버십 DELETE 를 **비관적 락 트랜잭션** 내에서 수행해 TOCTOU 방지 (`leaveWorkspace`)", 같은 §1.10 `DELETE /api/workspaces/:id` 행도 "워크스페이스 row 를 **비관적 락**(`pessimistic_write`)으로 잠가"; §1.6 `transfer-ownership` 도 대상 멤버 행에 `pessimistic_write`(plan §B 자체가 인용)
  - 상세: 이 저장소에서 "워크스페이스 소유권 보호" 도메인의 TOCTOU 방지 수단은 지금까지 spec에 서술된 세 사례(leave·delete·transfer-ownership) 모두 **비관적 락 트랜잭션**이었다. 이번 계획은 정확히 같은 클래스의 문제(owner 보호, 동시 트랜잭션과의 경합)를 다루면서 새 락을 들이지 않고, 대신 조건부 `DELETE ... WHERE role != 'owner'` + Postgres READ COMMITTED 의 EvalPlanQual 재평가에 의존하는 제4의 메커니즘을 채택한다. 계획 자체가 "기각한 대안 — 트랜잭션 + 잠근 재조회"라고 명시해 이 이탈을 의식하고 있으나(사유: `affected===0` 판별자 오염 방지), 그 근거·기각 사유가 spec 어디에도 남지 않는다(`spec_impact: none`).
    추가로, `spec/5-system/4-execution-engine.md` §8 Rationale(“동시성 cap admission gate”)이 실제 ai-review CRITICAL 로 반증한 "**조건부 UPDATE 단독은 TOCTOU 방지에 불충분**" 선례와 표면 패턴("락 없이 조건부 원자 연산만으로 처리")이 유사해, 다음 사람이 두 사례를 혼동할 위험이 있다. 실측 확인 결과 두 사례는 구조적으로 다르다 — execution-engine 사례는 "락이 없는 **타 행 집계**(subquery COUNT) 조건"이 문제였고, 이번 사례는 "**락을 쥔 그 행 자체**"에 대한 조건이라 EvalPlanQual 재평가가 성립한다(같은 행 조건부 원자 연산은 refresh token 회전 "동일 토큰 동시 회전 경합"·부팅 backstop `markQueueWaitTimeout` 재사용 등 이 저장소에 이미 정착된 안전 패턴이다). 다만 이 구분은 이번 리뷰에서 실측으로 확인한 것이며 spec·plan 어디에도 명문화되어 있지 않다.
  - 제안: (a) `spec/data-flow/12-workspace.md` §1.6 또는 §1.9 인근에 짧은 각주로 "`removeMember` 의 owner 보호는 비관적 락이 아니라 조건부 DELETE(`role != 'owner'`) + affected-count 판별로 이뤄지며, `transferOwnership` 이 대상 행에 쥔 `pessimistic_write` 에 의해 안전하다"를 남겨 이 도메인의 네 번째 메커니즘을 명문화할 것을 권한다. (b) 최소한 구현 PR의 코드 주석/커밋 메시지에 `4-execution-engine.md` §8 선례를 인용해 "왜 여기서는 조건부 연산 단독으로 충분한가"를 명시적으로 구분해 둘 것 — 다음 리뷰어가 그 선례를 이번 사례에 오적용(과잉 일반화 또는 과소 일반화)하는 것을 예방한다. (c) `spec_impact: none` 판단 자체(관찰 가능한 API 계약 불변)는 타당하므로 spec 본문을 반드시 고치라는 요구는 아니다 — 근거가 최소한 plan 아카이브(`plan/complete/`)에 남는지만 확인하면 된다.

- **[WARNING]** 이번 --impl-prep 번들이 판정에 결정적인 SoT 문서(`data-flow/12-workspace.md`)를 전혀 포함하지 않음
  - target 위치: 이 리뷰의 입력 번들(`_prompts/rationale_continuity.md`) "## 관련 Rationale 발췌" 섹션 및 "컨텍스트 예산 초과로 생략된 파일" 목록
  - 과거 결정 출처: 해당 없음 — harness 커버리지 문제
  - 상세: `spec/5-system/1-auth.md` 는 §3.2 각주·§4.1·§5 등에서 `spec/data-flow/12-workspace.md` 를 워크스페이스 멤버/소유권 관리의 SoT 로 반복 인용한다. 그럼에도 이번 번들의 "관련 spec Rationale 발췌"(`0-overview.md`·`1-data-model.md`·`2-navigation/1~3` 만 포함)와 "예산 초과로 생략된 파일" 목록(5-system 내부 15개만 나열) 어디에도 `data-flow/12-workspace.md` 가 없다 — related_specs 후보 선정 단계에서 이 파일이 아예 고려되지 않았다는 뜻이다. 정확히 이 파일의 §1.10 에 이번 변경과 직접 비교해야 할 TOCTOU Rationale(위 발견 참조)이 있었다. related_specs 선정이 대상 문서의 직접 인용 링크를 따라가지 못하면 이런 갭이 구조적으로 재발할 수 있다.
  - 제안: `--impl-prep` 실행 시 target 문서 본문이 명시적으로 인용하는 "SoT" 링크(`[data-flow §…](../data-flow/12-workspace.md)` 류)를 related_specs 후보에 우선 포함하는 규칙을 검토할 것. 이번 세션은 수동으로 해당 파일을 직접 열어 보완했다.

- **[INFO]** RBAC §3.2 각주와 plan 의 정합성 — 충돌 없음 확인
  - `CANNOT_REMOVE_OWNER` 관련 기존 Rationale("§3.2 '멤버 관리' 행의 Admin 열 정정 (CRU→CRUD, 2026-07-28)")과 이번 plan 사이에는 충돌이 없다. 각주가 서술하는 "역할 권한이 아니라 대상 조건"이라는 문장은 이번 변경 후에도 그대로 참이고, plan §C 도 이를 인용해 spec 서술을 바꾸지 않는다고 명시한다. 별도 조치 불필요.

## 요약

CRITICAL 급 결정 재도입이나 명시적 합의 원칙 위반은 발견되지 않았다. 계획은 spec 이 서술하는 관찰 가능한 동작("owner 제거 불가")을 바꾸지 않으며 `spec_impact: none` 선언은 그 자체로 타당하다. 선택한 구현 메커니즘(조건부 DELETE + affected-count 판별, 같은 행에 대한 EvalPlanQual 재평가 의존)은 이 저장소가 다른 곳(refresh token 회전, #1369~#1376 형제 시리즈, 부팅 backstop 의 `markQueueWaitTimeout` 재사용)에서 이미 검증한 "같은 행 조건부 원자 연산" 패턴과 계열이 같다. 다만 "워크스페이스 소유권 보호"라는 이 특정 도메인에서는 지금까지 예외 없이 "비관적 락 트랜잭션"만 spec 에 기록돼 왔고(`data-flow/12-workspace.md` §1.6·§1.10), 이번 계획은 그 패턴에서 벗어나면서도 그 이탈의 근거를 spec Rationale 어디에도 남기지 않는다. 이 판단에 필요한 §1.10 문서 자체가 이번 impl-prep 번들에서 완전히 누락돼 있었다는 점도 harness 커버리지 갭으로 함께 짚어둔다. 두 사항 모두 구현을 막을 CRITICAL 은 아니지만, 다음 사람이 "비관적 락 vs 조건부 원자 연산"을 각각 언제 쓰는지 판단할 근거가 spec 에 남지 않는다는 점에서 WARNING 으로 유지한다.

## 위험도

MEDIUM
