---
worktree: system-status-recent-failed-86831b
started: 2026-06-03
owner: planner
---

# Spec Draft — recentFailedCapped 런타임 시그널 ("N+" 표기)

대상: `spec/5-system/16-system-status-api.md`, `spec/2-navigation/15-system-status.md`

## A. 16-system-status-api.md

### §2 DTO (additive, 하위호환)

- `QueueStatusDto.recentFailedCapped: boolean` 추가 — 해당 큐의 `recentFailed` 가 스캔 캡 소진으로 종료돼 **하한값**인지 여부.
- `SystemStatusOverviewDto.recentFailedCapped: boolean` 추가 — 큐 중 하나라도 capped 면 true(집계 OR).

### §2 캡 설명 보강

- 기존: "캡 도달 시 스캔을 멈추고 `recentFailed` 는 하한값으로 간주한다 (UI 는 N+ 표기 가능)."
- 보강: 캡 소진으로 종료되면 `recentFailedCapped=true` 로 표시한다. 클라이언트는 이 플래그가 참일 때 수치를 "N+"(하한값)로 렌더한다. 스캔이 윈도우 경계 또는 실패 집합 끝에서 자연 종료되면 `recentFailedCapped=false`(정확값).

### R-5 보강

- `recentFailedCapped` 를 둔 이유: `recentFailed === scanCap` 단순 비교는 "정확히 캡과 같은 정상 케이스"와 "캡으로 잘린 케이스"를 구분 못 한다. 스캔 종료 사유를 직접 추적해 정확한 하한값 신호를 준다.

## B. 15-system-status.md

### §2.3 실패 표기

- 기존: "스캔 캡 초과 시 N+ 표기를 허용한다."
- 구체화: `recentFailedCapped` 가 참이면 `recentFailed` 를 "N+"(하한값)로 표기한다. 종합 헤더의 `totalRecentFailed` 도 집계 `recentFailedCapped` 가 참이면 "N+".

## 진행 체크리스트
- [ ] §A DTO 2필드 + 캡 설명 + R-5
- [ ] §B §2.3 N+ 구체화
- [ ] 재-consistency-check BLOCK: NO
