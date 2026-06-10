# Database Review

## 발견사항

### [INFO] statusReason 컬럼 값 변경 — 기존 NULL 행 마이그레이션 없음
- 위치: `integration-expiry-scanner.service.ts` run() 함수, 0d 격하 분기
- 상세: 이번 변경으로 `statusReason` 이 `null` 에서 `'token_expired'` 로 바뀐다. 기존 DB 에 이미 `status='expired', status_reason=NULL` 인 행이 존재할 수 있다. 코드 변경만으로는 기존 행의 `status_reason` 이 자동 backfill 되지 않는다. 신규 격하 행은 올바른 값이 기록되지만, 레거시 데이터 분석이나 UI 필터링 시 NULL 행과 `token_expired` 행이 혼재하게 된다.
- 제안: 용도(UI 분기·알람 필터링)에 따라 `UPDATE integration SET status_reason='token_expired' WHERE status='expired' AND status_reason IS NULL AND service_type NOT IN ('cafe24','makeshop')` 형태의 데이터 마이그레이션을 검토한다. 단순 분석 목적이라면 낮은 우선순위이며, 필수 여부는 팀 판단에 맡긴다.

### [INFO] resolveRecipients 내부의 잠재적 N+1 패턴 — 기존 코드, 이번 변경과 무관
- 위치: `integration-expiry-scanner.service.ts` run(), resolveRecipients() 호출 루프 (라인 829~836)
- 상세: 이번 변경은 이 패턴을 건드리지 않는다. 기존 코드 내 주석 `B-4-2` 가 "N+1 방지를 위해 allRecipientIds 로 일괄 로딩"으로 설명하고 있으나, `resolveRecipients` 는 내부적으로 `workspacesService.findAdminUserIds(workspaceId)` 를 candidates 루프마다 개별 호출한다. workspace-scoped integration 이 많을 경우 여전히 N+1 호출이 발생할 수 있다. 단, 이번 PR 범위가 아니고 기존 설계이므로 참고용으로만 기재.
- 제안: 후속 개선 시 `resolveRecipients` 를 루프 밖에서 workspaceId 단위로 일괄화 고려.

### [INFO] `integrationRepository.save(integrationsToUpdate)` — 배열 단위 bulk save, 인덱스·잠금 영향 무시 가능
- 위치: `integration-expiry-scanner.service.ts` run(), 라인 926~928
- 상세: `integrationsToUpdate` 는 refresh_token 없는 provider 의 0d 격하 행만 포함하도록 좁아졌다(refresh-capable 제외). 실제 업데이트 대상 행 수가 줄어들어 잠금 경합 위험이 감소하는 방향이다. TypeORM `save()` 는 내부적으로 row 단위 UPDATE 를 순차 실행하므로 대량 행 처리 시 개별 round-trip 이 발생하지만, 만료 스캐너의 일일 주기와 대상 행 수를 고려할 때 현실적 문제는 없다.
- 제안: 행 수가 크게 증가하는 경우 `createQueryBuilder().update()` bulk UPDATE 로 전환 고려 (단, 현재 규모에서는 불필요).

### [INFO] `claimThreshold` INSERT ON CONFLICT DO NOTHING — dedup 설계 정상
- 위치: `integration-expiry-scanner.service.ts` claimThreshold()
- 상세: `orIgnore()` (PostgreSQL `INSERT ... ON CONFLICT DO NOTHING`) 로 중복 dedup claim 을 처리하는 설계는 이번 변경에서도 유지된다. refresh-capable provider 는 이 경로로 진입하지 않으므로(`continue` 로 skip) dedup 키 churn 문제가 자연 해소됐다. SQL injection 위험 없음 — ORM 파라미터 바인딩 사용.

## 요약

이번 변경의 핵심은 `isRefreshCapable` 로직 확장(makeshop 포함)과 `statusReason='token_expired'` 추가다. 스키마 변경(마이그레이션)은 없으며, `status_reason` 컬럼은 기존에 이미 존재하는 nullable 컬럼이다. DB 관점에서 새로운 마이그레이션 안전성 리스크·인덱스 누락·트랜잭션 정합성 문제는 없다. 유일한 참고 사항은 기존 `expired + status_reason=NULL` 레거시 행의 backfill 여부로, 분석/UI 요건에 따라 선택적으로 검토하면 된다. 전체적으로 안전한 변경이다.

## 위험도

NONE
