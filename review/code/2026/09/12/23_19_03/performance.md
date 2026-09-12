# 성능 리뷰 — keyset 커서 UUID 검증 (filter-pg-invalid-text)

## 발견사항

- **[INFO]** 신규 검증이 요청당 1회 고정 비용의 정규식 검사로, 알고리즘적 우려 없음
  - 위치: `codebase/backend/src/common/utils/uuid.ts:42-47` (`isUuidShaped`), 호출부
    `codebase/backend/src/modules/auth/login-history.service.ts:65`,
    `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:178`
  - 상세: `UUID_SHAPE_PATTERN`(`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`)은
    중첩 정량자가 없는 고정 길이 앵커 패턴이라 파국적 backtracking(ReDoS) 위험이 없다 —
    입력 길이에 선형(사실상 O(1), 커서 문자열은 이미 상수 길이 성분으로 split 된 뒤 전달됨).
    두 호출부 모두 요청당 `decodeCursor` 1회 실행 중 딱 1번 호출되며, 반복문·페이지 루프
    안에서 재호출되지 않는다. `pruneOlderThanRetention`(배치 삭제 루프)이나 `getMany` 페이지
    조회 등 기존 쿼리 경로에는 이번 diff가 손대지 않았다.
  - 제안: 없음 — 그대로 유지해도 무방.

## 요약

이번 변경은 두 개의 keyset 커서 디코더(`LoginHistoryService.decodeCursor`,
`BackgroundRunsService`의 커서 파서)에 `isUuidShaped` 정규식 검증 한 줄씩을 추가한 것이 전부다.
추가 DB 호출도, 반복문 내 API/DB 호출도, 신규 메모리 할당(대규모 컬렉션·캐시)도 없다.
정규식 자체가 고정 길이·비-중첩 정량자 형태라 ReDoS 등 이차 시간 위험도 없고, 커서 검증은 요청당
1회만 실행되므로 N+1 이나 반복 비용 문제와 무관하다. 나머지 리뷰 대상(CHANGELOG.md, 두 개의
`plan/in-progress/*.md`, 테스트 스펙 파일들)은 문서/테스트 전용이라 런타임 성능에 영향이 없다.
성능 관점에서 지적할 사항이 없는, 사실상 순수 검증 로직 추가 커밋이다.

## 위험도

NONE
