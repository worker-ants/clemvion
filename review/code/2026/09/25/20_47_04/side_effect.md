# 부작용(Side Effect) 리뷰

## 스코프 확인

`git diff origin/main...HEAD --stat` 로 이 브랜치의 전체 변경 범위를 실측했다 (프롬프트에 실린 26개 파일 중 상당수는 이전 라운드의 리뷰/일관성 산출물이라 diff 맥락 확인용으로만 같이 실렸음):

- `codebase/backend/README.md` — 문서 정정 (워크스페이스 reflection 캐너리 절)
- `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` — `it.each` 테스트 1건 추가 (54줄)
- `plan/in-progress/canary-readme-recheck-test.md` — 신규 plan 파일
- `plan/in-progress/spec-draft-nullable-notation-followups.md` — 트래커에 항목 2건 추가
- `review/code/2026/09/25/20_20_00/**`, `review/consistency/2026/09/25/20_01_21/**` — 이전 라운드 산출물(이미 커밋됨)

**프로덕션 소스(`*.service.ts`, `*.controller.ts` 등) 변경은 0건이다.** README 와 테스트 파일, plan/review 문서만 바뀌었다.

## 발견사항

관점 1~8(상태 변경·전역 변수·파일시스템·시그니처·인터페이스·환경 변수·네트워크·이벤트/콜백) 전부를 이 변경분에 대조했으나 해당 없음.

- **[INFO]** 신규 테스트가 공유 mock 을 재정의하지만 격리는 안전하다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` 최상위 `beforeEach` (파일 72번째 줄) / 신규 `it.each` 블록 (`transferOwnership` describe 안, "인가 선행은 owner 였지만 락 재검사에서 %s OWNER_REQUIRED" 케이스)
  - 상세: 새 테스트는 `memberRepo.findOne.mockImplementation(...)` 을 케이스별로 새로 지정해 기존 `setupOwnerLookup` 헬퍼와 다른 동작(락 유무로 역할 분기)을 부여한다. 이것이 다른 `it` 블록의 mock 상태를 오염시키는지 확인했는데, 최상위 `beforeEach`(파일 72번째 줄)가 매 테스트마다 `Test.createTestingModule(...).compile()` 로 `service`/`workspaceRepo`/`memberRepo` 를 통째로 새로 만들어 주입하므로 `mockImplementation` 이 다음 테스트로 새지 않는다. `triggerReleaser` 만 `mockClear()` 로 부분 초기화하는 예외적 패턴(주석: "전역 clearAllMocks 대신 이 mock 만")이 있지만, 새 테스트는 `triggerReleaser` 를 건드리지 않으므로 이 경로와도 무관하다.
  - 제안: 조치 불필요 — 정보성 확인.
- **[INFO]** 신규 파일 쓰기는 전부 프로젝트 규약이 지정한 경로다
  - 위치: `plan/in-progress/canary-readme-recheck-test.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`, `review/code/2026/09/25/20_20_00/**`, `review/consistency/2026/09/25/20_01_21/**`
  - 상세: 이번 세션이 새로 쓴 `review/code/2026/09/25/20_47_04/`(현재 리뷰 산출물) 를 포함해 모든 파일시스템 쓰기가 `CLAUDE.md` "정보 저장 위치" 표에 정의된 지정 디렉터리 안에서만 일어난다. `git status --short` 로 확인한 미커밋 잔여물도 이 세션 자신의 출력 디렉터리 하나뿐이다.
  - 제안: 조치 불필요.

## 요약

이번 변경분은 프로덕션 코드(서비스·컨트롤러 등)를 전혀 건드리지 않고 README 문서 정정 1건과 `transferOwnership` 트랜잭션 재검사 분기를 고정하는 단위 테스트 1건(`it.each` 2케이스) 추가로 한정된다. 새 테스트가 `memberRepo.findOne` mock 을 케이스별로 재정의하지만 최상위 `beforeEach` 가 매 테스트마다 테스트 모듈 전체를 재생성해 주입하므로 다른 테스트로의 상태 누출은 없다. 전역 변수·함수 시그니처·공개 API·환경 변수·네트워크 호출·이벤트/콜백 어느 관점에서도 의도치 않은 부작용은 발견되지 않았고, 새로 생성된 plan/review 파일들도 모두 프로젝트가 지정한 산출물 경로 안에 있다.

## 위험도

NONE
