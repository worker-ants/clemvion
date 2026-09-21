# Plan 정합성 검토 — spec/2-navigation (--impl-done, modelconfig-dup-delete)

## 발견사항

- **[WARNING]** 아홉 번째(WebAuthn) PR 착수를 막는 선행 조건이 곧 archive 될 plan 에만 있고, 그 PR 이 실제로 참조할 트래커 항목에는 미러링되지 않음
  - target 위치: `plan/in-progress/modelconfig-dup-delete.md` §"이 PR 이 하지 않는 것" — "**선행 조건**: 아홉 번째(WebAuthn) PR 은 착수 시점에 공용 헬퍼(`raceDeleteRequests` + `assertSingleAudit` 등) 추출 여부를 실제로 결정하고 ... 이 조건을 만족하지 못한 채 착수하면 그 PR 은 시작할 수 없다"
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "**WebAuthn credential 삭제도 동시 요청에서 `user.2fa_disabled` 감사를 두 번 남긴다 — 아홉 번째**" 항목 (라인 ~4938-4946)
  - 상세: 이번 8번째 PR(`modelconfig-dup-delete.md`)은 형제 7건(#1369~#1374)에는 없던 새로운 **하드 게이트**를 9번째(WebAuthn) 항목에 얹었다 — 직전 7번째(`plan/complete/authconfig-dup-delete.md`)의 동일 섹션은 "model-config(8번째)·webauthn(9번째) — 각각 별 PR. 트래커 등재 상태 유지" 라고만 적어 이런 착수-차단 조건이 없었다. 그런데 이 게이트 문장은 **오직** `modelconfig-dup-delete.md` 에만 존재하고, 실제로 9번째 작업을 시작할 사람이 참조할 SoT 인 `spec-draft-nullable-notation-followups.md` 의 WebAuthn 불릿(라인 4938-4946)에는 이 선행 조건이 한 글자도 반영돼 있지 않다. 본 PR 의 plan 체크리스트 마지막 항목("트래커 항목 해소 + 이 plan `plan/complete/`로")이 실행되면 `modelconfig-dup-delete.md` 는 `plan/complete/` 로 archive 되고 in-progress 목록에서 사라진다 — 9번째 작업자가 트래커의 해당 불릿만 읽고 착수하면 "시작할 수 없다"는 이 게이트를 보지 못한 채 진행할 수 있는 경로가 남는다. (완화 요인: 이 시리즈의 실제 관행상 각 PR 이 직전 형제 PR 의 plan 을 `git log`/`plan/complete/` 로 직접 참조해 온 이력이 강해 — 예: 본 PR 도 §C 에서 #1372~#1374 를 직접 인용 — 발견 실패 위험은 낮지만, 게이트가 "시작 자체를 막는다"고 명시한 만큼 그 시행 지점을 트래커 쪽에도 남기는 편이 안전하다.)
  - 제안: `spec-draft-nullable-notation-followups.md` 의 WebAuthn 불릿에 "9번째 착수 시점에 공용 헬퍼 추출 여부를 결정하고 그 결정을 이 PR 의 plan 에 명시할 것 — 미이행 시 착수 불가 (`plan/complete/modelconfig-dup-delete.md` §"이 PR 이 하지 않는 것" 선행 조건)" 한 줄을 추가해, 게이트의 위치를 archive 예정 plan 이 아니라 트래커(현재도 계속 in-progress 로 남는 문서)에도 고정할 것. 본 PR 의 남은 체크리스트 항목("트래커 항목 해소")을 집행할 때 함께 처리하면 별도 커밋이 필요 없다.

- **[INFO]** 위 게이트 외 나머지 plan/target 정합성은 이상 없음 — 직전 `--impl-prep` 코히런스 발견(W1: 옴니버스 트래커 위치 열거에 `6-config.md §Model Config API` 누락)은 `spec-draft-nullable-notation-followups.md` diff(라인 4964-4970)에서 정확히 그 위치가 추가돼 이미 해소를 확인했다. `spec-sync-auth-gaps.md:215` 의 이중 추적 항목도 `[x]` 로 소유권이 이 트래커로 명시 이관돼 있어 충돌 없음. `spec/2-navigation` 델타는 실측대로 0개 파일이며, 이는 `spec_impact: none` 프론트매터·형제 7건의 기존 패턴과 일치해 정상이다.

## 요약

`modelconfig-dup-delete.md`(8번째 자리) 는 spec 변경 없이 형제 7건과 동일한 무락 `remove()` → 원자적 `delete()+affected` 패턴을 따르는 순수 코드 수정이며, target(`spec/2-navigation`)이 plan 의 미해결 결정과 충돌하거나 이 plan 의 선행 조건이 막혀 있는 지점은 없다. 직전 `--impl-prep` 라운드가 지적한 트래커 위치-열거 누락(W1)도 이미 해소됐다. 다만 이번 PR 이 스스로 9번째(WebAuthn) PR 에 새로 부과한 "착수 자체를 막는" 선행 조건이 archive 예정인 이 plan 에만 적혀 있고, 실제 착수자가 참조할 옴니버스 트래커의 WebAuthn 항목에는 미러링되지 않아 — 그 plan 이 `plan/complete/` 로 이동하면 게이트의 가시성이 낮아지는 후속 항목 누락 위험이 있다.

## 위험도
LOW
