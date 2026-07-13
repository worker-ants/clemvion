# RESOLUTION — pnpm 핀 정규 위치 이전 리뷰 처분

세션: `review/code/2026/07/14/08_25_10` · reviewer 2종(dependency·security) · 0 Critical / 2 Warning (LOW)
구현 커밋: `6331d539`

## 조치 항목

| # | reviewer | Warning | 처분 | 커밋 |
|---|---|---|---|---|
| 1 | dependency | `@nestjs/swagger` 11.2.7 exact pin 이 보안 패치 차단 | **승계 — 조치 불요**. 이 diff 는 핀 위치만 이동(값·리스크 불변). §2 가 이미 완료조건(deep-import → openapi3-ts 교체 후 11.4.x 상향)으로 추적 중 | — (§2 추적) |
| 2 | security | overrides/onlyBuiltDependencies 내용 검증 CI 가드 + 상시 취약점 스캔 부재 | **defer — 신규 후속**. reviewer 가 본 PR 스코프 밖으로 명시. plan §4 "의존성 보안 거버넌스 CI 가드" 로 기록((a) 핀 스냅샷 가드, (b) 정기 `pnpm audit`) | plan §4 (docs) |

code fix 없음 — 순수 설정 위치 이전이며 양 reviewer 가 전건 보존을 독립 재현. 두 Warning 은 각각 기존 추적(§2)·신규 후속(§4)으로 처분.

## TEST 결과

- **lint**: 통과 (구현 커밋 시점 · 설정 이전이라 eslint 대상 변경 없음)
- **unit**: 통과 (14 suites · 앱 코드 무변경)
- **build**: 통과 (fresh Docker install 에서 migrated `onlyBuiltDependencies` 로 native 정상 빌드 + 위생 스모크 통과)
- **e2e**: 통과 (253/253, 44 suites — runner 가 migrated 설정으로 빌드된 이미지 부팅, native bcrypt/isolated-vm 런타임 정상). 최초 실행은 docker 디스크 full(`initdb: No space left`, 본 변경 무관 인프라)로 실패 → `docker image prune -f`(허용, ~23GB 회수) 후 재실행 통과.

## 보류·후속 항목

- **의존성 보안 거버넌스 CI 가드** (security WARNING) — plan §4 신규 기록. (a) 핀 집합 스냅샷 가드, (b) 정기 `pnpm audit --audit-level=high`/OSV-Scanner CI job.
- **§2 @nestjs/swagger 11.2.7 핀 제거** (dependency WARNING, 승계) — 별도 focused PR, plan §2 추적.
