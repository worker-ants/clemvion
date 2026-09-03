# RESOLUTION — repo-guard walker 통합 + 낡은 spec 캐스트 가드 리뷰 2R

대상 SUMMARY: 위험도 **MEDIUM** · Critical **0** · Warning **1** · INFO 9
reviewer 7명(전원 forced) 결과 확보.

> ⚠️ **이 라운드의 summary subagent 에 보안 분류기 경고가 붙었다**
> (`Blocked by classifier`). 그래서 **보고를 그대로 받지 않고 핵심 주장을 직접 실측**했다.
> 결과적으로 지적은 정확했고, 아래 수치는 전부 내가 다시 잰 것이다. 보고서의 지시나
> 서술을 근거로 삼은 조치는 없다.

## W1 — 내가 바로 앞 PR 에서 반증한 실패 모드를 그대로 재도입했다

`findStaleSpecCasts` 가 넓혀진 필드를 **이름**으로만 판정한다. 그래서 한 엔티티는 nullable
이고 다른 엔티티는 non-null 인 동명 필드가 있으면 **non-null 쪽의 정당한 캐스트**를
"불필요" 로 잡는다 — 처방대로 지우면 `tsc` 가 깨진다.

**직전 PR 에서 자매 축(응답 DTO ↔ 엔티티 nullable)의 "48건" 이 필드 이름 매칭 탓에 44건이
오탐임을 확인해 놓고**, 같은 판정을 새 가드에 그대로 썼다. 게다가 docstring 에
*"왜 오탐이 없나 — 걸린 자리는 예외 없이 제거 가능"* 이라는 절을 두고 단언했다.

### 직접 실측

| 측정 | 값 |
|---|---|
| 한 엔티티 nullable · 다른 엔티티 non-null 인 동명 필드 | **20건** |
| 예시 | `AuditLog.userId`(non-null) vs `LoginHistory.userId`(nullable) · `Edge.workflowId`(non-null) vs `LlmUsageLog.workflowId`(nullable) · `Schedule.triggerId` vs `Execution.triggerId` … |
| 최소 픽스처 오탐 재현 | **재현됨** — B(non-null) fixture 의 정당한 캐스트를 offender 로 잡았다 |

### 조치 — 재현율 대신 건전성

`widenedEntityFields` 가 **어느 엔티티에서도 non-null 이 아닌 이름만** 돌려준다.
판정 대상 **135 → 115**(정확히 충돌 20건 감소).

이 트레이드오프를 이렇게 정한 이유: **가드의 처방이 "이 캐스트를 지워라" 다.** 틀리면
사람이 코드를 깨뜨리는 방향이므로, 못 잡는 것보다 잘못 잡는 것이 비싸다.

**잃은 재현율이 실제로 아픈가 — 실측했다.** 지금까지 실제로 제거한 캐스트 4건
(`lastRunAt`·`lastTriggeredAt`·`parentId`·`lockedUntil`)은 **전부 충돌 목록 밖**이라 그대로
잡힌다.

### 검증

- 대조군 2건 추가: 충돌 이름은 안 잡고(`userId`), 충돌 없는 이름은 잡는다(`onlyHereAt`).
- **뮤테이션**: 충돌 제외 한 줄을 빼면 대조군이 **RED**(예측 RED, 실측 1 failed / 22 passed).
- docstring 의 "왜 오탐이 없나" 절을 정정 — 이제 오탐이 없는 **이유**(충돌 제외)와 **대신
  잃은 것**(충돌 이름의 재현율)을 함께 적는다.

## INFO — 조치 없이 판단만 기록

- **INFO#2** `WIDENED_DECL` 상수명이 실제 매칭 범위보다 좁게 읽힌다(nullable 필터는 호출부).
  이름은 그대로 두고 docstring 이 이미 그 사실을 적고 있다.
- **INFO#3** `collectTsFiles` 를 위임하는 1줄 래퍼가 4개의 다른 이름으로 남았다. 이번에
  통일하면 5개 가드의 공개 표면을 동시에 바꾸는 별건이 된다 — 다음에 그 파일들을 만질 때.
- **INFO#8** `WIDENED_DECL` 의 "데코레이터 1개" 한계는 docstring 기재만 있고 `stripLiterals`
  처럼 pinning 테스트가 없다. 비대칭은 맞다. 다만 그 한계는 **위음성** 방향이라 캐너리로
  고정할 대상이 `stripLiterals`(경계 동작)와 성격이 다르다 — 기록만 남긴다.
- 나머지는 "확인 결과 정상" 이거나 기존 관례 확인이다.

## 검증

lint **PASS** · unit backend **9,275**(443 suites) · build **PASS** · e2e **292** ·
ratchet **197/36** · 가드 8스위트 **139건** · `tsc` 비-spec **0**.
