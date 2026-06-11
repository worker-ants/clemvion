# 변경 범위(Scope) 리뷰 결과

## 발견사항

### [INFO] system-status.constants.ts — 주석 1줄 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/integration-expiry-fixes-1d7c7d/codebase/backend/src/modules/system-status/system-status.constants.ts` L1255
- 상세: `MONITORED_QUEUES` JSDoc 에 `test/system-status.e2e-spec.ts 의 EXPECTED_QUEUE_NAMES 목록도 함께 갱신할 것` 주석 1줄 추가. 직접적인 기능 변경은 아니나, `makeshop-token-refresh` 큐 추가(V-15 fix)의 동반 문서화로 유지보수 안내 목적이 명확하다. 범위 이탈로 보기 어렵다.
- 제안: 유지.

### [INFO] e2e 테스트 하드코딩 숫자 제거
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/integration-expiry-fixes-1d7c7d/codebase/backend/test/system-status.e2e-spec.ts` L1343, L1360
- 상세: `13개 큐` 하드코딩 문자열을 `${EXPECTED_QUEUE_NAMES.length}개 큐` 동적 표현으로 교체하고 테스트 설명도 수정. 이는 `makeshop-token-refresh` 추가(V-15 fix)로 큐 수가 14개로 바뀐 직접적인 결과이므로 범위 내 수정이다.
- 제안: 유지.

### [INFO] spec 파일·plan 파일 변경 (리뷰 대상 외)
- 위치: `spec/`, `plan/` (diff 미제공)
- 상세: `git diff origin/main --name-only` 결과에 spec/plan 파일이 포함되나 본 리뷰 payload 에 diff 가 포함되지 않았다. 이들은 코드 변경과 쌍을 이루는 spec 동기화(§11.2 정합, token_expired 추가 등)이며 별도 spec 리뷰 관점에서 검토돼야 한다. scope 이탈 여부는 미제공 diff 를 근거로 판단 불가하나, commit 메시지와 plan 완료 기록으로 볼 때 해당 작업의 선언된 의도(V-01/V-07/V-15 + spec 동기화)와 일치한다.
- 제안: 별도 spec consistency 리뷰에서 확인.

## 요약

변경 범위는 전체적으로 선언된 의도(V-01: makeshop expired 오격하, V-07: §11.2 refresh-capable passive 알림 제외, V-15: 큐 레지스트리 누락)에 부합한다. `isCafe24RefreshCapable` → `isRefreshCapable` 일반화는 makeshop 지원 추가를 위한 필수 확장이며 over-engineering 이 아니다. 테스트 헬퍼(`getNotifResourceIds`, `hasSavedExpired`) 추출은 기존 이중 `.flat()` 패턴의 assertion 취약점을 교정하는 것으로 W-4 이슈 해소 목적이 명시돼 있다. 순수 포맷팅·무관 임포트·불필요 리팩토링은 발견되지 않았다. system-status 변경(V-15)은 integration-expiry 작업과 독립적인 버그 수정이지만 같은 브랜치에서 처리된 선언된 범위이며, 이를 분리 PR 로 처리해야 한다는 프로세스 지적은 scope 이탈 자체는 아니다.

## 위험도

NONE
