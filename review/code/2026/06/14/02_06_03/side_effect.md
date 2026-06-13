# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] SchedulesModule 에 Workspace 엔티티 추가 — 타 모듈 레포지토리 직접 등록
- 위치: `codebase/backend/src/modules/schedules/schedules.module.ts` line 44
- 상세: `TypeOrmModule.forFeature([..., Workspace])` 를 SchedulesModule 에 직접 추가했다. NestJS 에서 각 모듈이 자체 `forFeature`로 같은 엔티티를 등록하는 것은 허용되며 TypeORM 연결은 공유된다. 그러나 Workspace 엔티티가 이미 WorkspacesModule 에서 `forFeature`로 등록된 경우, SchedulesModule 이 WorkspacesModule 을 import 하여 WorkspacesService 를 사용하는 대신 별도로 Repository 를 직접 소유하는 형태다. 이는 Cross-module 책임 분리 관점에서 아키텍처적 고려가 필요하지만, NestJS 에서 부작용(중복 등록 충돌·전역 상태 변이)은 발생하지 않는다. 실행 시 의도치 않은 부작용은 없다.
- 제안: 장기적으로는 WorkspacesService 의 workspace 조회 메서드를 export 하고 SchedulesModule 이 WorkspacesModule 을 import 하는 구조가 더 명확하지만, 현재 변경이 기능 동작에 문제를 일으키지는 않는다.

### [INFO] `getWorkspaceSettings` 반환 타입 시그니처 변경 — 공개 API 확장
- 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` line 1868 (diff)
- 상세: `getWorkspaceSettings` 의 반환 타입이 `{ interactionAllowedOrigins: string[] }` 에서 `{ interactionAllowedOrigins: string[]; timezone?: string }` 으로 변경되었다. `timezone` 이 optional 필드로 추가된 것이라 기존 호출자는 이 필드를 무시해도 타입 호환성이 유지된다(구조적 타이핑 확장). REST API 응답도 필드가 추가되는 형태이므로 기존 클라이언트가 추가 필드를 무시하면 하위 호환 문제가 없다. 단, 이 메서드를 `exactly` 타입으로 비교하는 테스트나 코드가 있다면 조정이 필요하다.
- 제안: 기존 테스트 `returns empty array when key absent` 가 `{ interactionAllowedOrigins: [] }` 를 기대하던 것을 `{ interactionAllowedOrigins: [], timezone: 'Asia/Seoul' }` 로 변경한 것은 정확히 이 시그니처 변경에 대응한 것으로 올바르다.

### [INFO] `isValidIanaTimezone` 모듈-레벨 순수 함수로 export — 전역 변수 없음, 부작용 없음
- 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` line 1823-1830 (diff)
- 상세: `export function isValidIanaTimezone` 는 모듈 스코프에서 정의되어 내보내지는 순수 함수다. `new Intl.DateTimeFormat(...)` 은 내부적으로 런타임 로케일 데이터를 읽지만, JS 엔진의 전역 상태를 변이하지 않는다. 예외를 catch 하여 boolean 을 반환하므로 호출 측에 예외가 전파되지 않는다. 부작용 없음.
- 제안: 해당 없음.

### [INFO] `resolveTimezone` 내 DB 조회 — 새로운 비동기 DB 읽기 경로 도입
- 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` line 409-419 (diff)
- 상세: `create` 흐름에서 `dto.timezone` 이 없을 경우 `workspaceRepository.findOne` 을 추가로 호출한다. 이는 스케줄 생성 당 DB 쿼리를 최대 1회 추가하는 것이며, 해당 읽기는 workspace 를 변이하지 않는 read-only 조회다. `explicit` 값이 있으면 조회를 건너뛰어 불필요한 부작용이 없다.
- 제안: 해당 없음. `workspace` 가 null 이어도 `'Asia/Seoul'` 로 fallback 하므로 안전하다.

### [WARNING] `updateWorkspaceSettings` — `workspace.settings` 객체를 in-place 로 교체 시 기존 settings 키 보존 여부
- 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` line 1841-1860 (diff)
- 상세: `nextSettings` 는 `{ ...(workspace.settings ?? {}), interactionAllowedOrigins: normalized }` 로 기존 settings 를 스프레드한 뒤 구성된다. 이 패턴은 기존에 존재하던 settings 의 다른 키(예: 이미 저장된 `timezone`, 기타 미래 필드)를 보존한다. 단, TypeORM JSONB 컬럼의 경우 `workspace.settings = nextSettings` 는 전체 JSONB 를 덮어쓰므로, 동시 두 요청이 각각 다른 키를 수정할 경우 last-write-wins 로 한쪽 변경이 유실될 수 있다. 이는 기존 코드 주석(line 2201-2203)에서 이미 인지된 설계 결정("동시 편집은 last-write-wins — 향후 jsonb `||` 원자 머지 전환 고려")이다. 신규 `timezone` 키가 추가되어도 이 위험은 동일 수준이므로 이번 변경이 기존보다 부작용을 증가시키지는 않는다.
- 제안: 주석에 명시된 대로 추후 `jsonb || jsonb` 원자 머지 패턴 전환 시 해소된다. 현 시점에서는 허용된 설계다.

### [INFO] `UpdateWorkspaceSettingsDto.timezone` 빈 문자열 처리 — DTO 레벨 `@IsString + @MaxLength`와 service 레벨 trim/empty 처리 간 계층 혼용
- 위치: `codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts` line 766-769, `workspaces.service.ts` line 1846-1849
- 상세: DTO 에서 `@IsOptional @IsString @MaxLength(64)` 로 검증하며, service 에서 `dto.timezone.trim()` 후 빈 문자열이면 settings 에서 키를 제거하는 "설정 해제" 의미로 처리한다. `@IsString` 은 빈 문자열을 통과시키므로(class-validator 기본 동작), 빈 문자열은 DTO 검증을 통과해 service 에 도달한다. 이 흐름은 의도적인 것으로 보인다(테스트 `빈 timezone 문자열 → 설정 해제`가 이를 명시적으로 커버). 부작용 없음.
- 제안: 해당 없음. 다만 `@IsOptional` + 빈 문자열 "설정 해제" 의미가 API 문서에 명확히 기술되어 있는지 확인을 권장한다.

### [INFO] spec 문서 변경 — 기능 약속 변경이 아닌 구현 완료 동기화
- 위치: `spec/2-navigation/3-schedule.md`
- 상세: 타임존 fallback 설명이 "미구현/Planned" 에서 구현 완료 사실로 갱신되었다. spec 내용의 부작용은 없으며, 문서와 구현의 일관성을 높이는 변경이다.
- 제안: 해당 없음.

---

## 요약

이번 변경은 스케줄 생성 시 타임존 fallback 로직을 하드코딩된 `'Asia/Seoul'` 에서 워크스페이스 설정 기반으로 확장하고, 워크스페이스 설정에 `timezone` 필드를 추가하는 것이다. 부작용 관점에서 주요 위험 요인은 없다. `SchedulesModule` 이 Workspace 레포지토리를 직접 소유하는 구조는 아키텍처 취향 문제로 기능적 부작용이 없고, `getWorkspaceSettings` 반환 타입 확장은 하위 호환성을 유지한다. `updateWorkspaceSettings` 의 JSONB last-write-wins 위험은 기존에도 존재했으며 이번 변경으로 추가 악화되지 않는다. 새로 추가된 `resolveTimezone` 의 DB 읽기는 read-only 이며 조건부로만 실행된다. 전역 변수 도입, 환경 변수 읽기/쓰기, 파일시스템 부작용, 의도치 않은 네트워크 호출, 이벤트/콜백 변경은 없다.

## 위험도

LOW
