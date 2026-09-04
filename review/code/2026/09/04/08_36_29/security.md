# 보안(Security) 리뷰

## 검토 범위

- `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` — 관계 데코레이터
  동명 충돌 대조군 테스트 2건 추가 (`it('[대조군] 관계 데코레이터끼리의 동명 충돌도 판정에서
  뺀다', ...)`, `it('[대조군] `@Column` 과 관계가 섞인 충돌도 뺀다 ...', ...)`)
- `plan/in-progress/entity-nullable-column-type-mismatch.md` — 체크박스 갱신 + 서술 보강(문서
  전용)
- `review/code/2026/09/04/08_18_51/{RESOLUTION.md, SUMMARY.md, _retry_state.json, meta.json,
  documentation.md, maintainability.md, requirement.md, scope.md, security.md, side_effect.md,
  testing.md}` — 직전 리뷰 라운드(08_18_51)의 산출물 신규 추가. 전부 리뷰 메타데이터/보고서이며
  실행 경로 코드가 아님.

## 발견사항

없음.

### 상세 검토 근거

1. **테스트 파일(파일 1)**: 두 신규 `it()` 는 `withFiles()` 헬퍼로 tmpdir(`os.tmpdir()` 하위
   `mkdtempSync`)에 하드코딩된 리터럴 문자열(`a.entity.ts`/`b.entity.ts`/`b.spec.ts`, 고정된
   TS 소스 텍스트)만 기록하고, 테스트 종료 시 `finally` 블록에서 `fs.rmSync(dir, { recursive:
   true, force: true })` 로 정리한다. 경로 세그먼트가 전부 소스 내 상수이며 외부/사용자 입력이
   개입하지 않아 경로 탐색(path traversal)이나 임의 파일 쓰기 위험이 없다. 대상 함수
   (`widenedEntityFields`, `findStaleSpecCasts`)는 정적 분석용 순수 함수이고 프로덕션 실행
   경로·네트워크·DB 호출과 무관하다. 새 코드는 오직 테스트 격리·검증 로직 강화이며 인젝션,
   인증/인가, 암호화, 에러 노출 표면을 만들지 않는다.
2. **plan 문서(파일 2)**: 체크박스 상태 변경과 서술 보강뿐이며 실행되는 코드가 아니다. 시크릿·
   자격증명 문자열은 없음(grep 확인, `key|token|secret|password|credential` 매치 0).
3. **리뷰 산출물(파일 3~13)**: 직전 라운드의 SUMMARY/RESOLUTION/개별 reviewer 출력·
   `_retry_state.json`/`meta.json` 을 저장소에 커밋하는 것으로, 절대경로(워크트리 경로)·세션
   타임스탬프·테스트 통계 등 내부 개발 메타데이터만 담고 있다. 자격증명·API 키·비밀번호 등 하드
   코딩된 시크릿은 없음(동일 grep 패턴으로 전수 확인, 매치 0). 사용자 대상 노출 경로가 아니므로
   정보 노출 리스크도 낮다.
4. **의존성**: 이번 변경은 `package.json`/lockfile 을 건드리지 않으며 신규 외부 라이브러리
   도입이 없다.

## 요약

이번 changeset 은 백엔드 nullable 타입 가드에 대한 대조군 테스트 2건 추가와 관련 plan 문서
갱신, 그리고 직전 코드 리뷰 라운드의 산출물(보고서·메타데이터 JSON) 커밋으로 구성된다. 실행되는
프로덕션 코드 변경은 없고, 테스트 코드는 고정 리터럴만 다루는 tmpdir 픽스처를 사용해 인젝션·경로
탐색 표면을 만들지 않는다. 하드코딩된 시크릿, 인증/인가 로직 변경, 암호화 관련 변경, 에러 메시지
민감정보 노출, 신규 의존성 어느 것도 발견되지 않았다.

## 위험도

NONE
