# consistency SUMMARY — `17_02_16` (`--spec spec/5-system/14-external-interaction-api.md`, 라운드 2)

## BLOCK: NO

Critical **0건**. checker 5/5 착지, 전원 BLOCK:NO.

| checker | 위험도 | 발견 |
|---|---|---|
| convention_compliance · cross_spec · plan_coherence · naming_collision | **NONE** | 0 |
| rationale_continuity | LOW | **WARNING 1 (처분함)** |

## 이 라운드가 잡은 것 — 내가 리뷰어 말을 검증 없이 정본에 옮겼다

라운드 1 의 `rationale_continuity` 가 "data-flow §1.2 는 R14 와 **같은 커밋**(`907616c61`)에서
도입됐다" 고 보고했고, **나는 그것을 §R14 Rationale 에 그대로 옮겨 적었다.**

라운드 2 가 `git blame` + `git merge-base --is-ancestor` 로 **거짓임을 밝혔다.** 나도 직접
실측해 확인했다:

| | 커밋 | 날짜 |
|---|---|---|
| data-flow §1.2 "`itk_*` 는 403" | `db496a3c2` (#516) | **2026-06-10** |
| R14 도입 | `907616c61` (#604) | 2026-06-14 |

**4일 앞선 별개 PR** 이다. 라운드 1 은 "그 커밋이 그 파일을 건드렸다"(참, 9줄)와 "그 커밋이
그 줄을 도입했다"(거짓)를 혼동했다 — `-S` 를 코드 심볼에만 돌리고 문제의 문장에는 안 돌렸다.

**정정된 사실이 논지를 오히려 강화한다**: "같은 커밋" 이면 우연일 수 있지만 "4일 먼저" 면
R14 가 쓰일 때 그 서술이 **이미 저장소에 있었다**는 뜻이다. 정정 반영 완료.

부수 정정 2건도 반영: (1) 의도 귀속("저자도 알고 좁혀 적었다")은 커밋 이력으로 확정 불가라
제거하고 R14 **본문 자체**가 근거를 `deny()` 로 한정한다는 텍스트 사실만 남겼다. (2) R14 는
"검증" 이라는 한정어를 쓴 적이 없으므로 "복원" 이 아니라 **처음 명문화**다 — plan 문구 수정.

## 라운드 1 처분 4건 — 전부 검증됨

| # | 검증자 | 결과 |
|---|---|---|
| `§3.3` → `§5.1` (spec 2 + plan 1) | convention (전수 grep) | 잔존 0. 남은 `§3.3` 은 전부 정당한 자기참조 |
| `3-error-handling.md §1.6` 미러 3행 + 401 문구 좁힘 | convention · cross_spec | 형식·정렬 관례 준수(원표부터 status 비정렬 — 규약에 정렬 규칙 없음 확인), SoT 와 문구 정합 |
| §R14 명문화 | rationale (위 WARNING 제외 전부 참) · naming | 앵커 파손 **0**(`#r14` 인용 전무), 결정 자체는 문자 하나 안 바뀜 |
| §5.2 stale 정정 | cross_spec (코드 직독) | `handleEiaEvent` 의 3요소 전부 코드로 확인, `1-widget-app §3.1` 과 일치 |

## 두 checker 가 "같은 클래스가 더 있는가" 를 전수로 답했다

이번 PR 이 §5.5 · §5.2 두 개의 stale 서술을 고쳤으므로, 세 번째가 있는지 물었다:

- **cross_spec** — "미구현/Planned/향후/미배선" 서술을 전수 추출해 후보 5개(Redis pub/sub
  fan-out ×2 · `nodeOutput` allowlist · `expectedCommands` · `triggerToken` 평문 · in-memory
  버퍼)를 **각각 코드로 판정** → **전부 지금도 실제 미구현**. 추가 drift 없음.
- **plan_coherence** — 이 plan 의 `[x]` 항목 **9개 + 후속 1개**를 형제 spec 4종과 대조
  → 전부 "구현됨" 으로 정합. 남은 `[ ]` 2건도 spec 에 정확히 "미구현" 표기.

즉 **§5.2 가 마지막 사례**였다. "더 있을 것 같다" 가 아니라 세어서 답한 것이다.

## INFO (무조치)

라운드 1 의 `convention_compliance.md` 가 `BLOCK:`/`STATUS:` trailer 없이 끝났다
(plan_coherence 관찰). 산출물 형식 문제이고 이번 target 의 결함이 아니다.
