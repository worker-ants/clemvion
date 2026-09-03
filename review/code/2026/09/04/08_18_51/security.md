# 보안(Security) 리뷰

## 대상 변경 개요

- `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts`: 정적 분석 가드(`nullable-type-lie-cast-guard`)에 대조군 테스트 2건 추가 — 관계 데코레이터(`@ManyToOne`/`@OneToOne`)끼리의 동명 필드 충돌이 판정에서 제외되는지, `@Column` 과 관계가 섞인 충돌도 제외되는지 검증.
- `plan/in-progress/entity-nullable-column-type-mismatch.md`: 위 작업을 완료 처리하는 plan 문서 갱신(체크박스 승격 + 실측 기록).

두 파일 모두 **프로덕션 실행 경로가 아닌 dev-time 테스트/문서**다. 테스트는 `os.tmpdir()` 아래 임시 디렉터리에 합성(fixture) TypeORM 엔티티/스펙 소스를 써서 순수 함수(`widenedEntityFields`, `findStaleSpecCasts`)를 호출하고, 네트워크·DB·외부 프로세스와 접촉하지 않는다.

## 발견사항

없음.

- **인젝션**: 신규 코드가 쓰는 `fs.writeFileSync(full, content)` 의 `full` 은 `path.join(dir, name)` 이며, `name` 은 테스트 내부에서 하드코딩한 리터럴 키(`'a.entity.ts'`, `'b.spec.ts'` 등)다. 외부/사용자 입력이 관여하지 않으므로 경로 탐색·인젝션 표면이 없다. 임시 디렉터리는 `mkdtempSync`(기본 `0700`)로 생성되고 `finally` 블록에서 `rmSync(recursive, force)` 로 정리된다 — 기존 `withFiles` 헬퍼(파일 2 이전에 이미 존재)를 재사용한 것으로 이번 diff 의 신규 위험은 아니다.
- **하드코딩된 시크릿**: 추가된 코드·문서 어디에도 API 키/비밀번호/토큰 패턴 없음.
- **인증/인가**: 인증·인가 로직을 다루는 코드가 아니다(정적 타입-거짓말 탐지 가드의 테스트).
- **입력 검증**: 대상 함수(`widenedEntityFields`, `findStaleSpecCasts`)는 CI 시점에 저장소 자체 소스를 스캔하는 dev tooling이며 런타임 사용자 입력을 처리하지 않는다.
- **OWASP Top 10**: 해당 없음(웹 요청 경로 변경 없음).
- **암호화**: 해당 없음.
- **에러 처리**: 테스트 실패 메시지는 CI 로그에만 노출되며 필드명·엔티티명 등 이미 공개된 소스 코드 구조 정보만 담는다. 민감정보 노출 없음.
- **의존성 보안**: 새 의존성 추가 없음(`node:fs`/`node:os`/`node:path` 및 기존 내부 모듈만 재사용).

plan 문서(`entity-nullable-column-type-mismatch.md`)의 변경은 완료 상태 기록 및 실측 수치 갱신으로, 코드 실행에 영향 없는 서술 변경이다. 다만 본문 중 `WorkspaceInvitationDto.invitedBy` nullable 누출 수정(리뷰 1R W1) 이력이 언급되는데, 그 실제 코드 변경은 이번 diff 범위 밖(과거 커밋 `af1651264`)이라 이번 라운드의 보안 평가 대상에서 제외했다.

## 요약

이번 변경분은 nullable 컬럼 타입 거짓말 탐지 정적 가드에 대한 테스트 커버리지 보강(합성 fixture 기반 대조군 2건)과 그에 대응하는 plan 문서 갱신뿐이며, 프로덕션 코드·네트워크 경계·인증/인가·시크릿 관리와 무관하다. 테스트가 다루는 파일 쓰기는 하드코딩된 리터럴 키만 사용하고 임시 디렉터리는 안전하게 생성·정리되어 경로 탐색이나 임시파일 관련 위험도 없다. 보안 관점에서 지적할 결함이 없다.

## 위험도

NONE
