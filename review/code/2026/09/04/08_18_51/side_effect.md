# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 신규 대조군 테스트 2건이 기존 `withFiles` 헬퍼를 그대로 재사용 — 새로운 부작용 표면 없음
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:387` (`it('[대조군] 관계 데코레이터끼리의 동명 충돌도...')`), `:417` (`it('[대조군] \`@Column\` 과 관계가 섞인 충돌도...')`)
  - 상세: 두 테스트 모두 `os.tmpdir()` 하위 `mkdtempSync` 로 격리된 임시 디렉터리에 fixture 를 쓰고(`:59` `fs.writeFileSync`), `try/finally` 블록의 `fs.rmSync(dir, { recursive: true, force: true })`(`:69`)로 항상 정리한다. 실제 저장소 소스나 전역 상태를 건드리지 않으며, 이 파일 안에서 이미 12회 이상 반복돼 온 검증된 패턴을 그대로 따른다. `widenedEntityFields`/`findStaleSpecCasts` 는 순수 함수로 인자만 소비하고 부작용을 일으키지 않는다.
  - 제안: 없음 — 정보성 확인.

- **[INFO]** `plan/in-progress/entity-nullable-column-type-mismatch.md` 변경은 문서/체크박스 갱신뿐
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md` (`- [x] **후속 — 관계 데코레이터 동명 충돌 캐너리**` 항목, `## 할 일` 절)
  - 상세: `[ ]` → `[x]` 로 체크박스 상태를 바꾸고 완료 근거(뮤테이션 결과 등)를 덧붙인 순수 문서 변경. 코드 실행 경로·API·전역 상태에 영향 없음.
  - 제안: 없음.

## 요약

두 파일 모두 순수 첨가(additive) 변경이다. 테스트 파일은 기존에 검증된 `withFiles` tmpdir 픽스처 헬퍼를 재사용해 새 대조군 케이스 2건을 추가했을 뿐 신규 전역 상태, 파일시스템 부작용(임시 디렉터리 외), 시그니처/인터페이스 변경, 환경 변수 접근, 네트워크 호출, 이벤트/콜백 변경 어느 것도 도입하지 않는다. plan 문서 변경은 체크박스와 서술 갱신에 그친다. 부작용 관점에서 문제 될 소지가 없다.

## 위험도

NONE
