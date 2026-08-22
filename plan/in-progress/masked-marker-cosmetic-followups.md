---
title: 마커 시리즈 이월 코스메틱 4건 — 문서만 고치되 정보는 늘린다
status: in-progress
worktree: masked-marker-cosmetic-followups-edb6f2
started: 2026-08-22
owner: developer
spec_impact:
  - spec/4-nodes/7-trigger/1-manual-trigger.md
---

# 마커 시리즈 이월 코스메틱 4건

정본 트래커
[`spec-sync-external-interaction-api-gaps.md`](./spec-sync-external-interaction-api-gaps.md)
의 *"마커 재제출 거부 PR 의 이월 항목"* 절 중 **코스메틱 4건**(Swagger 설명 · JSDoc ·
주석 언어 혼재) 처분. 전부 **실행 동작 무변경**이다.

## 왜 지금인가

트래커가 *"해당 파일을 다음에 만질 때 묻어가라"* 로 둔 항목들이고, 실제로 그 파일들을
직전 PR(#1193)이 만졌다. **지금이 그 "다음" 이다** — 더 미루면 5라운드 이월이 6라운드가
된다.

## 대상 (착수 전 재판정 — 4건 전부 유효)

| 트래커 | 대상 | 실측(변경 전) |
| --- | --- | --- |
| Swagger | `ReRunRequestDto.inputOverride` description | 마커 제약 언급 **0건** |
| JSDoc | base `resolveTriggerParameters` 의 wrapper 역참조 | 그 파일 안 wrapper 언급 **0건** |
| JSDoc | `REASON_TO_DETAIL` 문서화 밀도 | 4항목 중 JSDoc **1개** |
| 주석 | `workflows.controller.ts` 한/영 혼재 | 같은 try/catch 안에 한국어·영어 공존 |

## 원칙 — 항목을 지우는 게 아니라 정보를 늘린다

네 항목 다 *"한 줄 넣으면 끝"* 으로 적혀 있지만, 그렇게 하면 **다음 사람이 같은 질문을 다시
한다**. 각각 한 겹씩 더 적었다:

- **Swagger** — 마커가 예약어라는 사실 + **거부 시 코드** + **부분 일치는 통과**라는 경계까지.
  OpenAPI 소비자는 문서만 보고 통합하므로 경계를 모르면 400 의 원인을 못 찾는다.
- **base JSDoc** — 역참조만이 아니라 **왜 base 가 아닌지**(Webhook·Schedule 이 base 를
  공유한다)와 **그 규칙을 강제하는 CI 가드**까지. 역참조만 달면 *"그럼 base 에 넣지
  그랬나"* 를 다시 묻는다.
- **`REASON_TO_DETAIL`** — 형제 3종을 **사용자가 취할 행동** 기준으로 갈랐다.
  특히 `invalid_schema` 는 **입력이 아니라 트리거 노드 설정**을 고쳐야 하는 것이라 앞의 둘과
  책임 주체가 다르다 — 그 구분이 이 4종이 별개 코드로 존재하는 이유다.
- **주석 언어** — 한국어로 통일하되 영문 주석이 담고 있던 *"`errors` 가 아니라 `details`"*
  근거는 **보존**했다. 언어만 바꾸고 정보를 잃지 않는 것이 이 항목의 요점이다.

## 함께 하지 않는 것 (성격이 다르다)

같은 트래커 절에 남은 3건은 코스메틱이 아니라 **의도적으로 제외**한다:

| 트래커 | 왜 아닌가 |
| --- | --- |
| `findMaskedResubmissions` 직접 단위 테스트 부재 | **테스트 추가**다. 트래커 자신이 *"세 번째 소비처가 생기면"* 을 착수 조건으로 달아 뒀다 |
| `throwIfAny` phase 경계 회귀 테스트 부재 | 〃. docstring 에 트레이드오프가 적혀 있고 **보안 우회가 아니라 UX 엣지**라 긴급도가 낮다 |
| `ExecutionsService.reRun` 137줄·6책임 | **리팩터**다. 코스메틱 PR 에 넣으면 구조 변경 PR 이 된다 |

## 작업

- [x] `/consistency-check --impl-prep` — `19_03_59` **BLOCK: NO**. WARNING 1건 반영:
      `1-manual-trigger.md §6` 이 재실행 400 처리처로 지목한 `executions.service.ts` 가 어느
      `code:` 에도 없었다 — **`spec-code-paths` 는 glob ≥1 매치만 요구해 통과해 버리는
      가드 사각지대**다. 등재하고 `spec_impact` 를 `none` → 그 파일로 정정했다.
      > INFO 4건은 조치 안 함: ①`1-manual-trigger.md` 각주의 공유 패키지 링크 보강 ·
      > ②`providers/telegram.md` Rationale ID 접두 통일 — 둘 다 **그 문서를 다음에 만질 때**.
      > ③이번 diff 가 산문 지점 3곳을 늘렸다는 기록 — 그 항목은 PR #1194 가 닫고 있고, 신설
      > `egress-masking.md §3` 이 이미 "기계가 지키지 않는다 + 알려진 stale 트리거" 를
      > 소유하므로 트래커에 덧쓰면 충돌만 만든다. ④신규 식별자 0건(확인).
- [x] 코스메틱 4건 적용
- [x] 정본 트래커 4항목 `[x]` — 미체크 34 → 30
- [ ] **가드가 여전히 무는지 확인** (아래 검증 기준)
- [ ] TEST WORKFLOW 4단계 + 타입체크 ratchet
- [ ] `/ai-review`

## 검증 기준

- **동작 무변경**: 실행 코드 라인 0줄. Swagger `description` 문자열만 바뀐다(OpenAPI 출력은
  바뀌므로 "주석 전용" 은 아니다 → **e2e 면제 대상 아님**).
- **`masked-reject-callers-guard` 가 무뎌지지 않았는가** — base 파일에 wrapper 이름이 **처음
  등장**하므로, 그 가드가 이름 기반이면 오탐/무력화될 수 있다. Manual 경로가 base 를 직접
  부르도록 뮤테이션해 **RED 를 확인**한다. GREEN 은 증거가 아니다.
