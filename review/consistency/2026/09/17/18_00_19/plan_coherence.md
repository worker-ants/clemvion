# Plan 정합성 검토 — spec/2-navigation/ (--impl-prep, trigger-deletion-release)

## 발견사항

- **[WARNING]** DRT-2 종결 시 "구현 뒤 planner 후속"(chat-channel.md R8 확장)이 실행 계획에서 누락
  - target 위치: `plan/in-progress/trigger-deletion-release.md` `## 체크리스트`
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` DRT-2 항목(구현이 닫으려는 그 항목) 안의 문장 — "**구현 뒤 planner 후속**: `spec/5-system/15-chat-channel.md` R8 의 «(또는 `TriggersService.remove`)» 괄호를 실제 listener registry 해제 호출부로 넓힌다 — 호출부가 늘어난 뒤의 실측과 함께." (같은 사실이 `plan/complete/spec-draft-deletion-releases-trigger-resources.md` 비대상 표에도 "DRT-2 에 후속으로 적었다"로 명시)
  - 상세: `trigger-deletion-release.md` 는 이 문장이 들어 있는 바로 그 DRT-2 항목을 구현·종결하는 plan 이다. 그런데 이 plan 의 체크리스트 마지막 항목은 "트래커 DRT-2 항목 해소 표시 + plan → `complete/`" 뿐이고, DRT-2 를 "✅ 해소"로 접을 때 이 R8 후속 지시문을 **새 planner 트랙 항목으로 옮겨 적으라는 지시가 없다**. 같은 트래커 문서 자신이 몇 줄 위(4484-4487행)에서 정확히 이 실패 패턴을 교훈으로 남겼다 — "5건은 원래 plan §D 에만 있었고 ... 조건부·후속 처분은 봉인되는 `complete/` 말고 살아 있는 트래커에 적는다." 이번에도 발생 지점이 하나 더 있다: `TriggerResourceReleaser` 가 listener registry 해제 호출부를 실제로 늘리는 이번 구현이 바로 그 "호출부가 늘어난 뒤" 트리거다. 체크리스트에 명시하지 않으면 DRT-2 를 체크·접는 순간 이 planner 후속이 통째로 사라질 위험이 있다.
  - 제안: `trigger-deletion-release.md` 체크리스트에 "DRT-2 종결 노트에 `15-chat-channel.md` R8 확장을 새 planner 항목으로 옮겨 적는다" 를 명시적 단계로 추가한다.

- **[WARNING]** "사후 정리(sweeper)" 결정이 어느 살아있는 트래커에도 소유자가 없다
  - target 위치: `plan/in-progress/trigger-deletion-release.md` (체크리스트 전체 — 해당 항목 부재)
  - 관련 plan: `plan/complete/spec-draft-deletion-releases-trigger-resources.md` "## 이 draft 가 **안** 하는 것" — "**사후 정리(sweeper)** — 이미 남은 고아 `secret_store` row · provider 등록 · schedule job, 그리고 D7-3 이 남기는 비밀을 치우는 일. **구현 뒤 별도 판단.**"
  - 상세: 이 문장은 "지금은 안 한다" 가 아니라 "구현이 끝나면 판단해야 한다" 는 조건부 후속이다. 그런데 그 판단 지점은 (a) 이미 `complete/` 로 봉인된 spec-draft 문서 안, (b) `spec-draft-nullable-notation-followups.md` 의 DRT-2 항목 본문(트래커) 어디에도 명시적으로 옮겨져 있지 않다. `trigger-deletion-release.md` 의 체크리스트에도 "sweeper 필요 여부 재판단" 항목이 없다. DRT-2 를 접고 이 plan 을 `complete/` 로 옮기면, 이 판단을 상기시킬 살아있는 자리가 없어진다 — 트래커 자신이 4469-4487행에서 이미 겪은 것과 같은 손실 패턴이다.
  - 제안: DRT-2 종결 노트 또는 `trigger-deletion-release.md` 종결 시 "sweeper 필요 여부는 구현 뒤 재판단 — 아직 미결" 을 새 트래커 항목으로 옮겨 적는다.

- **[WARNING]** 트래커가 명시한 "동시 회전 보상"의 e2e 재진입 검증이 계획에서 단위 테스트로 축소됨
  - target 위치: `plan/in-progress/trigger-deletion-release.md` `## 체크리스트` — "e2e 먼저" 항목과 "단위" 항목
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` DRT-2 항목 표 "6번" — "e2e — 워크플로·워크스페이스 삭제 뒤 `secret_store` 0행 · schedule job 해제. **동시 회전의 보상은 재진입으로 인터리빙 지점을 고정해 재현**(편한 지점에서 끊으면 진짜 결함도 초록)"
  - 상세: 트래커는 "동시 회전의 보상"(W-a~W-e, D5 의 인터리빙 논증이 성립함을 실제로 보이는 것)을 **e2e** 항목으로 못박았다 — "편한 지점에서 끊으면 진짜 결함도 초록" 이라는 문구는 이 저장소가 여러 번 실제로 겪은 실패 패턴(재현 실패 ≠ 부재의 증거, 인터리빙 지점은 가설의 일부, 결정적 재현은 재진입으로)을 그대로 반영한다. 그런데 `trigger-deletion-release.md` 의 체크리스트는 "보상 5자리" 검증을 "**단위**" 항목에 배치했고, "e2e 먼저" 항목은 삭제 경로(비밀 0행·대조군 생존·schedule job 해제)만 나열한다 — W-a~W-e 쓰기 경로 보상의 e2e 재진입 검증이 어느 항목에도 명시돼 있지 않다. `rewriteTriggerConfigLocked` 의 `false` 판정을 단순히 mock 해 유닛 테스트로만 검증하면, D5 가 실측으로 뒷받침한 "`R` 이 `T` 뒤에 일어난다" 는 실제 타이밍 관계 자체는 검증되지 않는다 — 재진입 훅으로 인터리빙 지점을 고정하지 않으면 "편한 지점" 오염이 생길 수 있다는 것이 트래커가 e2e 를 요구한 이유다.
  - 제안: 체크리스트에 "동시 회전 보상(W-a~W-e) — 재진입 훅으로 인터리빙 지점 고정한 e2e" 를 별도 항목으로 명시하거나, 단위 테스트로 충분하다고 판단한 근거를 plan 본문에 적는다.

## 요약

`spec/2-navigation/2-trigger-list.md` 등 target spec 은 이미 `plan/complete/spec-draft-deletion-releases-trigger-resources.md` 의 D1·D3~D6 결정을 정확히 반영해 갱신돼 있고, `trigger-deletion-release.md` 의 설계(네 삭제 경로 순서·모듈 위치·쓰기 보상 다섯 자리·D7 잔여 창 비대상 처리)는 그 결정 및 `spec-draft-nullable-notation-followups.md` DRT-2 항목의 지시와 정면으로 충돌하는 부분이 없다 — "결정 필요"로 남은 항목을 일방적으로 재단하는 CRITICAL 급 문제는 발견되지 않았다. 다만 DRT-2 항목 본문에 박혀 있는 두 개의 조건부 후속(chat-channel R8 확장, sweeper 필요 여부 판단)과 트래커가 e2e 로 못박은 동시 회전 재현 방식이, 이 plan 이 DRT-2 를 접고 `complete/` 로 이동하는 순간 살아있는 트래커 없이 사라질 위험이 있다 — 이 저장소가 같은 트래커 문서 안에서 이미 두 번 겪은 것과 같은 패턴이다. 세 항목 모두 plan 갱신(체크리스트에 명시적 단계 추가)으로 해소 가능한 수준이다.

## 위험도

MEDIUM
