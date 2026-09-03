# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** 테스트가 저장소 안의 **실제 프로덕션 소스 파일**을 직접 `writeFileSync` 로 변형(mutate)한 뒤 되돌린다 — 형제 가드들이 쓰는 "OS 임시 디렉터리" 관례에서 벗어난 위험한 패턴
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:84-99` (핵심은 89~95줄 — `victim`(=`users.service.ts`, 실제 프로덕션 소스)을 찾아 `fs.writeFileSync` 로 캐스트를 주입하고, `finally` 에서 `fs.writeFileSync(victim, original)` 로 복원)
  - 상세:
    - `victim = files.find((f) => f.endsWith('users.service.ts'))` 로 실제 저장소 파일(`codebase/backend/src/modules/users/users.service.ts`)을 골라, 그 파일의 **디스크상 내용을 런타임에 두 번 덮어쓴다**(주입 → 복원). `try/finally` 로 감쌌고 복원 후 재확인 단언까지 있어 "정상적인 assertion 실패" 경로는 안전하지만, (a) 프로세스가 SIGKILL 등으로 중간에 죽거나 (b) 복원용 두 번째 `writeFileSync` 자체가 실패(디스크 풀·권한 문제)하면 **저장소 워킹트리의 실제 서비스 파일이 테스트가 주입한 더미 코드를 담은 채로 영구히 남는다.**
    - 같은 디렉터리(`repo-guards/__tests__/`)의 형제 가드 3개(`masked-reject-callers.spec.ts`, `redis-fail-open-catalog.spec.ts`, `production-build-devdep.spec.ts`)는 전부 `fs.mkdtempSync(path.join(os.tmpdir(), '...'))` 로 **저장소 밖 임시 디렉터리에 합성 fixture 를 만들어** 같은 검증 목적을 달성한다 — 원본 저장소 파일은 절대 건드리지 않는다. 이번 신규 파일만 그 관례를 깨고 실제 in-repo 파일을 대상으로 삼았다. 임시 디렉터리 방식으로도 "실제 offender 를 잡는지" 를 똑같이 검증할 수 있었을 것으로 보인다(더미 파일에 `null as unknown as Date` 한 줄만 넣으면 됨 — 굳이 `users.service.ts` 를 빌릴 필요가 없다).
    - 부수 위험: 로컬 `jest --watch` 나 `nest start --watch` 같은 파일 워처가 동시에 `src/**` 를 보고 있는 상황이라면, 이 테스트가 도는 순간 `users.service.ts` 가 두 번(주입 → 복원) 연달아 바뀌는 것을 워처가 감지해 `users.service.ts` 를 import 하는 다른 스펙(`users.service.spec.ts` 등)의 불필요한 재실행/재빌드를 유발할 수 있다. 무한 루프로 번지진 않지만(복원 내용이 원본과 바이트 동일이라 두 번째 트리거 이후 수렴), CI 밖 개발 환경에서 노이즈를 만든다.
    - 이 저장소가 이 리뷰 프롬프트 자체에서 반복 경고하는 "병렬 주체가 같은 워킹트리를 동시에 건드려 서로를 오염시킨다" 클래스의 위험과 구조적으로 동일하다 — 다만 이번엔 리뷰어가 아니라 **머지되면 영구히 CI/로컬에서 반복 실행되는 테스트 코드 자체**가 그 위험을 안고 있다는 점에서 더 오래간다.
  - 제안: 형제 가드 3개와 동일하게 `os.tmpdir()` + `mkdtempSync` 로 합성 fixture 디렉터리를 만들어 `null as unknown as X` 한 줄을 담은 더미 `.ts` 파일을 그 안에 두고 `findCastOffenders` 를 그 경로에 대해 호출하도록 바꾼다. 실제 `users.service.ts` 를 빌릴 필요가 없고, 저장소 파일에 대한 쓰기가 완전히 사라진다.

- **[INFO]** `User`/`Schedule` 엔티티 필드 타입 시그니처 변경 — 인터페이스 변경이지만 이번 diff 안에서 전 소비처가 동반 수정되었고 실측(`tsc`)으로 회귀 0건이 확인됨
  - 위치: `codebase/backend/src/modules/users/entities/user.entity.ts` (`passwordHash`·`twoFactorSecret`·`emailVerifyToken`·`emailVerifyExpiresAt`·`passwordResetToken`·`passwordResetExpiresAt`·`lockedUntil`, 각 컬럼 데코레이터 바로 다음 줄), `codebase/backend/src/modules/schedules/entities/schedule.entity.ts:42`(`nextRunAt`)
  - 상세: TypeORM 엔티티의 public 필드 타입이 `T` → `T | null` 로 넓어졌다. 이는 기술적으로 "인터페이스 변경"(점검 관점 #5)에 해당하고, 이 엔티티들을 소비하는 코드가 저장소 전역에 33곳 이상(plan 문서 자체 실측) 있다는 점에서 파급 범위가 넓다. 다만 넓히는 방향(narrow→wide)이라 기존 쓰기 코드는 전부 그대로 유효하고, 읽기 코드 중 non-null 을 가정하고 컴파일러 체크 없이 값을 쓰던 자리가 있었다면 `tsc` 가 새 타입 오류로 잡아냈을 것이다 — plan 문서(`plan/in-progress/entity-nullable-column-type-mismatch.md` "배치 1" 절)가 `strictNullChecks=true` 상태에서 **ratchet baseline 이 아니라 `tsc` 를 직접 돌려** 신규 오류 0건을 확인했다고 기록하고 있어, 이 리뷰 시점에는 실측된 안전장치가 있다. 부작용 관점에서는 위험보다 "정직해진 타입" 쪽에 가깝다.
  - 제안: 없음 — 이미 검증됨. 다만 이번 diff에 포함되지 않은 나머지 소비처(예: 이 엔티티들을 감싸는 DTO/시리얼라이저가 별도로 있다면)가 `tsc` 스코프 밖(`*.spec.ts`처럼 strip 되는 경로)에 있는지는 이번 리뷰 범위 밖이라 확인하지 못했다.

- **[INFO]** `null as unknown as X` → `null` 치환 자체는 런타임 무영향(타입 전용 변경)
  - 위치: `codebase/backend/src/modules/auth/auth.service.ts:233-234, 752-753`, `codebase/backend/src/modules/auth/totp.service.ts:124`, `codebase/backend/src/modules/schedules/schedule-runner.service.ts:190`, `codebase/backend/src/modules/schedules/schedules.service.ts:241`, `codebase/backend/src/modules/users/users.service.ts:387`
  - 상세: 이중 캐스트를 제거하고 리터럴 `null` 만 남긴 변경은 컴파일 타임에만 의미가 있고, 런타임에 대입되는 값(`null`)은 이전과 동일하다. DB UPDATE 페이로드·트랜잭션 경계·호출 순서 어느 것도 바뀌지 않았다. 부작용 없음.

- **[INFO]** 신규 export 함수(`countNullAsUnknownAsCasts`/`hasNullAsUnknownAsCast`/`collectScanTargets`/`findCastOffenders`)는 순수 읽기 전용
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:158-168`, `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:29-53`
  - 상세: 정규식 매칭·`fs.readdirSync`/`fs.readFileSync` 만 수행하고 어떤 파일도 쓰지 않는다. 기존 심벌(`countRawUpdateReturning`·`hasRawUpdateReturning` 등)과 마찬가지로 순수 함수이며 새 전역 상태·환경 변수·네트워크 호출이 없다. 시그니처 변경도 없다(전부 신규 추가).

## 요약

핵심 부작용 우려는 하나다 — 신규 가드 스펙(`nullable-type-lie-cast.spec.ts`)이 검증용으로 저장소의 실제 프로덕션 소스 파일(`users.service.ts`)을 직접 `writeFileSync` 로 변형했다가 복원하는데, 바로 옆 디렉터리의 형제 가드 3개는 전부 `os.tmpdir()` 기반 합성 fixture 로 같은 목적을 달성해 저장소 파일에 손을 대지 않는다. `try/finally` + 사후 단언으로 일반적인 실패 경로는 보호되지만, 프로세스 강제 종료나 복원 쓰기 자체의 실패 같은 드문 경로에서는 실제 서비스 파일이 손상된 채 남을 수 있고, watch 모드에서는 무관한 스펙의 재실행을 유발할 수 있다. 나머지 변경(`null as unknown as X` 제거, 엔티티 필드 nullable 타입 확장)은 런타임 동작이 동일하거나(캐스트 제거) 넓히는 방향의 인터페이스 변경이며 `tsc` 로 회귀 0건이 실측되어 있어 부작용 위험이 낮다. 전역 변수·환경 변수·네트워크 호출·이벤트/콜백 관련 신규 부작용은 발견되지 않았다.

## 위험도

MEDIUM
