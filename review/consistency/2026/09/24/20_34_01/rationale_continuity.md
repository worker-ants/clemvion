# Rationale 연속성 검토 — `isPendingPlanPath` 가드 강화 (pending-plan-is-plan)

## 검토 대상 요약

diff(3파일/160줄, `origin/main..HEAD`)는 `spec-pending-plan-existence.test.ts` 가드가
`pending_plans:` 항목을 "디스크에 실존하는가" 만 보고 "plan 인가" 는 안 보던 결함
(`spec/5-system/10-graph-rag.md` 가 마이그레이션 `.sql` 세 경로를 몇 주간 `pending_plans:` 에
실어도 CI green 이었던 `#1386` 사고)을 `isPendingPlanPath()` 순수 술어로 닫는다. 대응 spec
영역(`spec-impl-evidence.md`) 자체는 이번 diff 로 변경되지 않았다(scope 델타 0, 정상).

## 발견사항

### [INFO] `plan/research/` 배제 근거의 Rationale 미등재 — 그러나 이미 자체 처분됨

- target 위치: `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts` 신설
  `isPendingPlanPath()` 및 그 주석 (diff L414-434), `plan/in-progress/pending-plan-is-plan.md` §E "INFO 1"
- 과거 결정 출처: `spec/conventions/spec-impl-evidence.md` §2.1 `pending_plans` 필드 정의 행
  ("`plan/in-progress/` 또는 `plan/complete/`(in-progress 경로를 complete 로 치환) 에 실존 의무")
- 상세: 새 술어는 `plan/research/` 를 명시적으로 거짓 처리한다(테스트: "rejects plan/ locations
  that are not work plans"). 이 배제는 CLAUDE.md 의 정보 저장 위치 표(`plan/research/` = "리서치·분석
  산출물, 작업 plan 아님")와 §2.1 행의 열거("`plan/in-progress/` 또는 `plan/complete/`" 둘 뿐, `research`
  없음)에 근거해 일관되지만, **spec-impl-evidence.md 본문/Rationale 에는 이 배제가 명시적으로 적혀 있지
  않다** — §2.1 행을 "열거이므로 이미 배제됨" 으로 읽는 해석에 의존한다. 이 문서 자신의
  `--impl-prep` 결과(§E INFO 1)에서 동일 지적이 이미 나왔고, 작성자는 "계약의 공백이 아니라 설명의
  위치 문제" 로 판단해 Rationale 갱신 없이 종결했다 — 그 판단 근거를 plan 문서에 남겨 뒀다.
- 제안: 이미 자체적으로 검토·기록된 사안이라 본 diff 를 막을 사유는 아니다. 다만 다음에
  `pending_plans:` 허용 범위를 다시 건드리는 사람을 위해, `spec-impl-evidence.md` §2.1 행 또는 R-5 각주에
  "`plan/research/` 는 완료 종착점이 없어 대상에서 제외" 한 줄을 명시적으로 추가해 두면 §2.1 의 "열거로
  암묵 배제" 해석에 의존하지 않아도 된다 (선택적 후속, 이번 PR 의 필수 조건 아님).

## 정합성 확인 (문제 없음으로 판정한 근거)

- **결정 번복 아님, 강제 강화(bug fix)**: 커밋 메시지("규약은 옳으니 바꾸지 않고 구현을 맞춘다")와 plan
  문서 §A 가 명시하듯, 이 변경은 SoT(`spec-impl-evidence.md` §2.1·§4)가 이미 선언한 계약을 뒤늦게
  강제하는 것이지 그 계약을 바꾸거나 과거 Rationale 을 뒤집는 것이 아니다. "결정의 무근거 번복" 항목에
  해당하지 않는다.
- **완료 plan 포인터 허용은 건드리지 않음**: plan 문서 §F 가 "완료된 plan 을 가리키는 항목 거부"
  질문을 스코프 밖으로 명시적으로 분리했다. 근거로 든 "가드 주석이 명시하는 설계상 의도"(=
  in-progress 항목이 complete/ 로 이동해도 `spec-status-lifecycle.test.ts` (c) 가 승격 여부를 별도로
  본다)는 §4 표의 `spec-status-lifecycle.test.ts` 서술과 정확히 일치한다 — 임의로 원칙을 어긴 것이
  아니라 원칙의 경계를 정확히 지켰다.
- **R-5(`pending_plans:` 역방향 강제)와 정합**: R-5 의 취지("어떤 plan 도 책임지지 않는 빈 약속을
  막는다")는 "실존하는 아무 파일" 이 아니라 "실제 plan" 이 링크 대상이어야 성립한다. 이번 강화는
  R-5 의 원래 의도를 더 정확히 구현하는 방향이라 원칙과 거리가 멀어지지 않고 오히려 좁힌다.
- **공유 트래커(R-11) 비충돌**: 새 술어는 경로가 `plan/in-progress/**.md` 또는 `plan/complete/**.md`
  형태이기만 하면 참이라, 여러 spec 문서가 가리키는 공유 트래커 파일도 그대로 통과한다 — R-11 이
  가정하는 공유 트래커 패턴을 깨지 않는다.
- **인용 오류는 이미 자체 정정됨**: 1라운드 커밋(`d644263cd`)에서 §3/§2.1 인용 혼동을 5곳 모두
  바로잡았음을 확인했다 — 현재 diff 의 주석·plan 문서는 `spec-impl-evidence.md §2.1`/`§4` 를 올바르게
  가리킨다.

## 요약

이번 변경은 기존 spec(`spec-impl-evidence.md`)의 Rationale 을 재도입·번복·우회하는 것이 아니라, 그
Rationale 이 이미 선언한 계약("pending_plans 항목은 실존하는 plan 경로여야 한다")을 실제로 강제하지
못하던 구현 결함을 closing 하는 정합적 수정이다. "완료 plan 포인터 허용" 처럼 원칙 변경이 필요한
질문은 스코프 밖으로 명시적으로 분리해 트래커에 남겼고, 그 판단 근거도 §4 표 서술과 일치한다.
`plan/research/` 배제의 Rationale 명문화 누락 하나만 INFO 로 남기며, 이는 이번 PR 을 막을 사유가
아니다.

## 위험도
LOW
