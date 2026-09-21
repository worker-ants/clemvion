# Plan 정합성 검토 — `spec/2-navigation` (--impl-prep, `plan/in-progress/authconfig-dup-delete.md`)

## 발견사항

- **[WARNING]** 「동시 삭제 중복 감사」 옛 트래커 항목이 이 PR 이 닫는 자리와 같은데도 교차참조가 없다
  - target 위치: `spec/2-navigation/6-config.md` §A (`DELETE /api/auth-configs/:id`) — 이 plan 이 고치는 `AuthConfigsService.remove()` 의 계약 문서
  - 관련 plan: `plan/in-progress/spec-sync-auth-gaps.md:215` — `- [ ] 동시 삭제 중복 감사 (W7, 기존 \`auth-configs\` 패턴과 함께) — 우선순위 낮음.` (2026-08-01 등재, `#1081` 리뷰 W7 유래, 이후 한 번도 갱신·교차참조되지 않음 — `git log` 확인: 이 파일의 마지막 커밋은 2026-09-05 `#1288`)
  - 상세: 지금 착수 중인 `plan/in-progress/authconfig-dup-delete.md`(트래커 `spec-draft-nullable-notation-followups.md` 의 "일곱 번째" 항목)가 고치는 결함은 바로 이 옛 항목이 "기존 `auth-configs` 패턴" 이라고 부르던 그 결함(동시 DELETE 두 건이 감사 행을 두 번 남김)이다. 두 plan 이 같은 버그를 서로 모르는 채 각자 추적하고 있다 — `authconfig-dup-delete.md` 의 체크리스트("트래커 항목 해소")는 `spec-draft-nullable-notation-followups.md` 만 갱신할 뿐 `spec-sync-auth-gaps.md:215` 는 언급하지 않는다. 이 PR 이 착지한 뒤에도 `spec-sync-auth-gaps.md` 는 여전히 미해결(`[ ]`)로 남아, 다음 사람이 이미 고쳐진 버그를 "우선순위 낮음" 미해결 항목으로 다시 집는 낭비 경로가 된다. 앞선 형제 PR 넷(#1369~#1373) 도 이 옛 항목을 건드리지 않았지만, 그 항목이 이름으로 지목하는 리소스는 `auth-configs` 뿐이라 지금 이 PR 에서 닫는 것이 맞다.
  - 제안: `authconfig-dup-delete.md` 완료 시 `spec-sync-auth-gaps.md:215` 도 함께 갱신 — 취소선 + "`plan/complete/authconfig-dup-delete.md` 가 닫음" 각주, 또는 체크(`[x]`) 처리. planner 소유 plan 이므로 developer 가 직접 고치기보다 plan 자신의 "트래커 항목 해소" 단계에 이 파일 갱신을 명시적으로 추가할 것.

- **[WARNING]** 「동시성 e2e `code:` 미등재」 백로그 항목의 6축 열거가 이 PR 로 다시 stale 해진다
  - target 위치: `spec/2-navigation/6-config.md` — 이 PR 이 추가할 auth-configs 동시성 e2e 파일의 등재처
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:4961-4968` — "이 결함 클래스의 동시성 e2e 파일이 어느 spec 의 `code:` frontmatter 에도 없다" (planner, INFO 4). "각 축의 spec" 을 `1-workflow-list.md`·`12-workspace.md`·`2-trigger-list.md`·`3-schedule.md`·`4-integration.md`·`9-user-profile.md` 여섯 개로 **고정 열거**한다.
  - 상세: 이 항목은 바로 위(4970-4973)에 "«다섯» 으로 적혀 있었는데 같은 PR 이 여섯 번째 파일을 추가해 착지 즉시 stale 됐다"는 자기-반증 이력을 이미 갖고 있다. `authconfig-dup-delete.md` 가 완료되면 `auth-configs` 축의 새 concurrency e2e 파일이 생기고(§C), 관례대로 `6-config.md` 의 `code:` 에 등재해야 하는데, 그러면 이 항목의 "여섯 개" 열거가 **일곱 번째로 다시** 불완전해진다 — 같은 실패 형태의 재발이다. 같은 셋업 커밋(`c1bf3f1c0`)이 바로 위 "404 서술 부재" 항목은 재열거형으로 일반화했으면서, 똑같이 고정 열거인 이 항목은 손대지 않았다.
  - 제안: `authconfig-dup-delete.md` 체크리스트의 "트래커 항목 해소" 단계에서 이 INFO-4 항목도 함께 "집행 시 그 시점 파일을 재열거" 하는 형태로 일반화하거나, 최소한 `6-config.md` 를 목록에 추가할 것.

- **[INFO]** target 번들의 `6-config.md` 본문이 컨텍스트 예산으로 절단되어 이번 자동 검토가 그 내용을 못 봤다
  - target 위치: 이번 `--impl-prep` 조립 번들 — `spec/2-navigation/6-config.md`(원본 25,772자, 본문 생략)
  - 관련 plan: `authconfig-dup-delete.md` 체크리스트 1번 항목 — `5-system/12-webhook.md`·`1-auth.md` 는 `related_specs` 예산 미도달을 예견해 "손으로 읽는다" 고 적었지만, **주 번들(`spec/2-navigation` 자체) 안의 `6-config.md`** 도 함께 잘려나간 것은 예견하지 못했다
  - 상세: 이 plan 이 고치는 API(`DELETE /api/auth-configs/:id`)의 계약 문서 자체가 이번 자동 조립에서 빠졌다. 직접 파일을 읽어 확인한 결과 `6-config.md` 에는 "동시 삭제"·"404"·"advisory lock" 관련 서술이 전혀 없어(현재 문서는 이 축의 동시성 계약을 아예 언급하지 않음) 이 plan 의 결정과 충돌하는 내용은 없었다 — 위 두 WARNING 은 이 수동 확인에서 나왔다. 다만 이번 세션의 다른 관점 checker(api_contract 등)가 같은 번들을 보고 `6-config.md` 관련 판단을 내렸다면 같은 절단의 영향을 받는다.
  - 제안: 이번 회차는 BLOCK 사유 아님(수동 확인으로 충돌 없음 확인됨). 다만 plan 체크리스트 1번의 "손으로 읽는다" 대상에 `6-config.md` 자체도 추가해 두면 다음 실행에서 같은 절단을 다시 놓치지 않는다.

## 요약

`authconfig-dup-delete.md` 는 형제 넷(#1369~#1373)과 같은 형태·같은 처방(원자적 `delete` + `affected===0`)을 따르고, spec 미해결 결정을 우회하거나 선행 조건을 건너뛰는 자리는 없다 — `spec/2-navigation/6-config.md` 는 이 축의 동시성 계약을 아직 서술하지 않으므로 `spec_impact: none` 선언과 충돌하지 않는다. 다만 이 plan 의 완료가 두 개의 기존 후속 항목을 조용히 stale 하게 만든다: (1) `spec-sync-auth-gaps.md` 의 2026-08-01 발 "동시 삭제 중복 감사(auth-configs 패턴)" 항목이 같은 버그를 가리키는데도 이 PR 이 닫지도 교차참조하지도 않고, (2) `spec-draft-nullable-notation-followups.md` 의 "동시성 e2e `code:` 미등재" INFO-4 항목이 6축 고정 열거라 이 PR 로 일곱 번째 축이 추가되면 이미 한 번 재발한 것과 같은 형태로 다시 불완전해진다. 둘 다 차단 사유는 아니지만 plan 완료(트래커 해소) 단계에서 함께 처리하지 않으면 다음 사람이 중복 조사를 반복하거나 열거가 어긋난 문서를 SoT 로 오인할 위험이 있다.

## 위험도
LOW
