# Plan 정합성 검토 — spec-draft-cross-workspace-refs.md

## 발견사항

- **[WARNING]** 「이 PR 밖으로 넘기는 것」 두 항목이 여전히 트래커에 미등재 — 이전 라운드 지적이 아직 안 풀렸다
  - target 위치: `plan/in-progress/spec-draft-cross-workspace-refs.md` §E(`data-flow/12-workspace.md` Rationale 새 절) 「남긴 것」 문단 — "트리거 `config` JSONB 안의 비밀 참조… 이미 저장된 교차 행에 대한 실행 시점 방어선 · 운영 데이터 점검은 이 결정 밖이다 — `plan/in-progress/spec-draft-nullable-notation-followups.md`"
  - 관련 plan: `plan/in-progress/cross-workspace-refs.md` §"이 PR 밖으로 넘기는 것"(트리거 `config` 비밀 참조 → "트래커 새 항목", 실행 경로 방어선 → "트래커로") · `plan/in-progress/spec-draft-nullable-notation-followups.md` 현재 "교차 워크스페이스 참조(미검증 · 보안 성격)" 항목(line ~1479)
  - 상세: 직전 `--impl-prep`(`review/consistency/2026/09/27/19_43_46/SUMMARY.md` WARNING #2)이 이미 "이 PR 밖으로 넘기는 것" 두 항목이 `spec-draft-nullable-notation-followups.md` 에 미등재라고 지적하며 "`--impl-done` 전 확인"을 권고했다. 이번 라운드에 트래커 파일을 재확인했으나(`grep "비밀 참조\|secret://\|실행 시점 방어선\|운영 데이터 점검"`) 여전히 두 항목에 대응하는 신규 트래커 엔트리가 없다 — 기존 "교차 워크스페이스 참조" 불릿(line 1479-1482)은 4개 필드를 곁눈으로 본 원 조사 문구 그대로다. 지금 검토 중인 target(spec draft) 은 이 "남긴 것" 문단에서 다시 그 트래커를 가리키는데, 가리키는 대상에 아직 내용이 없다.
  - 제안: `--impl-done` 이전에(spec draft 적용 시점이든, 구현 착수 시점이든) `spec-draft-nullable-notation-followups.md` 의 해당 불릿을 (a) "교차 워크스페이스 참조" 전수 결과로 갱신하고 (b) 트리거 `config` 비밀 참조·실행 시점 방어선/운영 데이터 점검을 별도 신규 항목으로 등재. 두 번 연속 미등재로 넘어가면 다음 세션에서 근거(소스 판독 위치)가 유실될 위험이 있다.

- **[INFO]** `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans` 이 이번 편집을 반영 못 함(기존 알려진 이슈, 반복)
  - target 위치: target B1~B5 가 `spec/2-navigation/1-workflow-list.md` §3/§3.1/`## Rationale` §3 을 직접 편집
  - 관련 plan: 없음(spec frontmatter 자체) — 직전 `--impl-prep` SUMMARY INFO #6 이 이미 "`pending_plans` 에 이미 완료된 plan(`plan/complete/workflow-duplicate-nodes-edges.md`) 잔존 + 이 문서를 반복 지목하는 진행 중 트래커 누락"을 "이번 PR 범위 밖(기존 상태)"로 적어 두었다
  - 상세: 지금 확인한 실제 frontmatter — `pending_plans: [plan/in-progress/marketplace-and-plugin-sdk.md, plan/complete/workflow-duplicate-nodes-edges.md]`. 이미 complete 인 plan 경로가 남아 있고, 지금 이 파일의 §3/§3.1/Rationale §3 을 실제로 바꾸는 `cross-workspace-refs`(또는 이 spec-draft) 는 목록에 없다. 이전 라운드에서는 "범위 밖"으로 유예됐지만, 이번엔 바로 이 파일을 target 이 편집하므로 같은 편집 안에 정리할 여지가 생겼다.
  - 제안: 필수는 아니나, B1~B5 적용 시 `pending_plans` 에서 완료 항목을 제거하고 필요하면 진행 중 항목을 반영. 안 하더라도 차단 사유는 아님(INFO).

- **[INFO]** 데이터 모델 삽입이 다른 plan 의 원시 라인 번호 인용을 더 어긋나게 만든다
  - target 위치: A1~A6 (`spec/1-data-model.md` §1 아래 `### 1.1` 신설 + §2.4/§2.6/§2.7/§2.8/§2.9 각 불릿 추가) — 총 여러 줄이 §2.14 이전 지점에 삽입된다
  - 관련 plan: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md:348` — `spec/1-data-model.md:546` 을 "NodeExecution.status enum 설명" 위치로 원시 라인 번호로 인용
  - 상세: 실측 — 현재 `spec/1-data-model.md` 에서 546번 줄은 이미 `### 2.13.1 ExecutionNodeLog` 부근이고, 실제 `NodeExecution.status` enum 서술은 597번 줄이다. 즉 그 인용은 **이 draft 와 무관하게 이미 어긋나 있다**(다른 변경 이력 때문). target 의 §1.1 신설 + §2.4/§2.6~§2.9 추가 줄들은 §2.14 보다 앞쪽에 들어가므로, 적용되면 그 어긋남 폭을 키운다(라인 번호가 더 밀린다).
  - 제안: 이 draft 가 직접 고칠 항목은 아니다(그 plan 소유가 아님). `spec-update-node-cancellation-shutdown-classification.md` 쪽에서 다음에 그 문서를 만질 때 라인 번호를 섹션 앵커(`§2.14`)로 바꾸도록 짧게 메모.

- **[INFO]** spec 서술과 구현이 같은 시점에 착지해야 하는 의존성 — 명시적 안전장치 부재
  - target 위치: target 전체(A1~A6, B1~B5, C1~C2, D1~D2) — "저장 전 거부"를 현재형으로 서술
  - 관련 plan: `plan/in-progress/cross-workspace-refs.md` 체크리스트 — `구현 · 단위 · CHANGELOG · 트래커`, `뮤턴트`, `TEST WORKFLOW`, `/ai-review`, `--impl-done` 전부 미체크(아직 구현 안 됨)
  - 상세: 이 draft 를 `spec/` 에 반영하는 순간, 문면은 "저장 시점에 소속을 거부한다"고 확정형으로 말하게 되는데, 실제 검증 코드는 아직 없다(구현 plan 체크리스트 미체크). 원래 이번 BLOCK:YES 의 Critical #1·#2 자체가 "spec 이 없는 검증을 있다고 말한다"는 유형이었다 — 같은 유형이 스펙 커밋과 구현 커밋 사이 짧은 창에서 재발할 수 있다. 이 저장소는 spec+코드를 같은 PR/워크트리로 묶어 착지시키는 관례가 있어(예: #1416~#1418) 구조적으로는 안전하지만, 두 plan 문서 어디에도 "같은 PR/커밋 시퀀스로 병합"이라는 문장이 명시돼 있지 않다.
  - 제안: 필수는 아니나, `cross-workspace-refs.md` 또는 이 draft frontmatter 에 "spec 변경은 구현과 동일 PR 로 병합" 한 줄을 남겨 두면 다음 세션이 스펙만 먼저 머지하는 실수를 예방한다.

## 요약
target 은 직전 `--impl-prep` BLOCK:YES 의 두 Critical(폴더 생성 검증 미서술 오류·캔버스 저장 "무검증" 계약 위반)을 정확한 spec 앵커에 맞춰 해소하고, 병행 WARNING(Trigger/Schedule 워크스페이스 제약 비대칭)도 반영했다. 실측한 모든 편집 지점(A~D)이 현재 spec 본문과 정확히 일치해 앵커 오류는 없었고, `AUTH_CONFIG_NOT_FOUND` 개명 여부 같은 기존 미해결 결정에는 손대지 않아 결정 충돌도 없다. 다만 직전 라운드가 이미 지적한 "PR 밖으로 넘기는" 두 항목의 트래커 미등재가 이번 라운드에도 그대로 남아 있어(재확인 완료) WARNING 으로 재기재했고, spec 서술과 구현 착지 시점의 순서 의존성·`pending_plans`/원시 라인 인용 같은 부수적 위생 항목은 INFO 로 남긴다. 이 draft 자체를 막을 사유는 없다.

## 위험도
LOW
