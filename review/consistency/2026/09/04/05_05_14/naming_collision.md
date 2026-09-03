# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 확인

- **scope(`spec/conventions/`) 델타: 0개 파일** — `git diff origin/main...HEAD --stat -- spec/conventions/` 결과 없음. 이 브랜치는 `spec/conventions/` 를 변경하지 않았다. 따라서 이 영역에서 새로 부여된 요구사항 ID·엔티티명·API endpoint·이벤트명·ENV var·spec 파일 경로는 **없다**.
- 실제 변경은 `codebase/backend/` 의 repo-guards 테스트 유틸 통합(9파일/1025줄) — nullable 배치 axis 종결 + walker 사본 5개를 `collectTsFiles` 로 통합하는 리팩터. 이 diff 가 새 식별자(함수·인터페이스명)를 도입하므로, "신규 식별자" 관점을 코드 레벨로 확장해 검토했다.

## 신규 식별자 목록 및 충돌 조사

diff 에서 새로 도입되거나(신규 export) 가시성이 바뀐(private→export) 식별자:

| 식별자 | 종류 | 정의 위치 |
|---|---|---|
| `collectTsFiles` | 함수 (export) | `codebase/backend/src/common/__test-utils__/source-scan.ts` |
| `CollectTsFilesOptions` | interface (export) | 상동 |
| `stripLiterals` | 함수 (export) | 상동 |
| `stripComments` | 함수 (private → export 전환) | 상동 |
| `widenedEntityFields` | 함수 (export) | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` |
| `findStaleSpecCasts` | 함수 (export) | 상동 |
| `StaleSpecCast` | interface (export) | 상동 |
| `isNullableType` | 함수 (private) | 상동 |
| `withFiles` | 테스트 헬퍼 함수 (module-scope) | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` |
| `withFixture` | 테스트 헬퍼 함수 (기존 로컬 → `withFiles` 래퍼로 승격) | 상동 |

각 식별자를 `codebase/backend/**`·`codebase/frontend/**`·`codebase/packages/**`·`codebase/channel-web-chat/**` 전체에서 grep 했다:

- `collectTsFiles`/`CollectTsFilesOptions` — 모든 사용처가 `source-scan.ts`(정의) 와 5개 repo-guards 파일(walker 사본 대체 소비처)뿐. 다른 의미로 쓰인 동명 식별자 없음.
- `stripLiterals` — 정의·테스트·`nullable-type-lie-cast-guard.ts` 소비처 외 사용 없음.
- `stripComments` — 기존에도 `source-scan.ts` 안에서만 쓰이던 private 함수였고, export 전환 후에도 새 소비처는 `nullable-type-lie-cast-guard.ts` 하나뿐. 동명의 다른 `stripComments` 없음.
- `widenedEntityFields`/`findStaleSpecCasts`/`StaleSpecCast`/`isNullableType` — 전부 `nullable-type-lie-cast-guard.ts`(정의)와 그 spec(소비) 안에서만 등장. 타 모듈에 동명 export 없음.
- `withFiles`/`withFixture` — `nullable-type-lie-cast.spec.ts` 로컬 함수. 다른 spec 파일에 동명 헬퍼 없음 (다른 가드 spec 들은 각자 자체 tmpdir 헬퍼를 인라인으로 쓰거나 아직 통합 전).

frontend·packages·channel-web-chat 전역 grep 결과 위 8개 식별자 전부 **0 매치** — cross-package 충돌 없음.

## 다른 관점 (해당 없음)

- **요구사항 ID 충돌**: 이 diff 는 요구사항 ID를 부여하지 않음 (코드 리팩터).
- **API endpoint 충돌**: 신규/변경 endpoint 없음.
- **이벤트/메시지명 충돌**: webhook·queue·sse 이벤트 신설 없음.
- **환경변수·설정키 충돌**: 신규 ENV var·config key 없음.
- **파일 경로 충돌**: 신규 spec 파일 없음(코드 파일도 전부 기존 파일 수정, 신규 파일 0개).

### 발견사항

없음.

## 요약

target 스코프(`spec/conventions/`)의 파일 델타가 0이라 spec 레벨에서 새로 도입된 식별자(요구사항 ID·엔티티명·API endpoint·이벤트명·ENV var·spec 파일 경로)가 없다. 실제 변경분인 backend repo-guards 테스트 유틸 통합 diff 를 코드 레벨로 확장해 검토한 결과, 새로 export 되거나 신설된 식별자(`collectTsFiles`, `CollectTsFilesOptions`, `stripLiterals`, `stripComments`, `widenedEntityFields`, `findStaleSpecCasts`, `StaleSpecCast`, `isNullableType`, `withFiles`, `withFixture`) 전부 backend·frontend·packages·channel-web-chat 전역에서 다른 의미로 이미 쓰이고 있는 동명 식별자가 없음을 grep 으로 확인했다. 충돌 위험 없음.

## 위험도

NONE
