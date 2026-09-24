# 부작용(Side Effect) 리뷰

## 대상 변경 개요

이 PR 은 프로덕션 코드(`workspaces.service.ts`)를 전혀 수정하지 않는다. 변경은 세 파일로 한정된다:

- `CHANGELOG.md` — 문서 항목 추가 (Unreleased 섹션 최상단)
- `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` — 기존 `describe('removeMember — 동시 제거', ...)` 블록에 테스트 2건 추가
- `plan/in-progress/remove-member-order-coverage.md` — 신규 plan 문서

`removeMember()` 의 판정 순서·로직 자체는 이 diff 에서 손대지 않았으므로, 런타임 동작·공개 API·상태 변경 관점의 부작용 표면은 사실상 없다.

## 발견사항

- **[INFO]** 테스트 격리는 안전하다 — 새 테스트가 공유 mock 상태를 오염시키지 않음
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` (전체 파일 컨텍스트 게이트 72~159행의 최상위 `beforeEach`, 신규 테스트는 1798·1818행)
  - 상세: `WorkspacesService` 최상위 `describe` 의 `beforeEach` 가 매 테스트마다 `Test.createTestingModule(...).compile()` 로 `memberRepo`/`workspaceRepo` mock 을 새로 만든다. 신규 두 테스트가 속한 `describe('removeMember — 동시 제거', ...)` 블록도 자체 `beforeEach` 에서 `wireFindOne(...)` 과 `memberRepo.delete.mockResolvedValue(...)` 로 기본값을 재설정한다. 두 번째 신규 테스트(`요청자 role 을 한 번만 조회한다`)가 읽는 `memberRepo.findOne.mock.calls` 는 그 테스트 실행 중에만 누적된 호출 기록이며, 다음 테스트로 전파되지 않는다. 전역/모듈 스코프의 `deleteEvents` 배열은 이 블록과 무관하고(트리거 릴리서 전용), 이번 diff 가 건드리지도 않았다.
  - 제안: 없음 — 참고용 확인.

- **[INFO]** 뮤테이션 검증 방법론이 저장소에 흔적을 남기지 않음
  - 위치: `plan/in-progress/remove-member-order-coverage.md` (게이트 77~82행, "측정 방법" 단락)
  - 상세: plan 문서에 따르면 뮤턴트 대입은 `workspaces.service.ts` 를 `cp` 로 백업한 뒤 치환 스크립트로 진행했고, 원복 후 `git status` 가 비어 있음을 확인했다고 기재돼 있다. 이 세션에서 직접 `git status --short` 를 재확인한 결과도 `review/code/2026/09/24/22_17_45/`(이 리뷰 산출물 자체) 외에는 untracked/modified 항목이 없어, 이전 뮤테이션 실험이 워킹트리에 잔여물을 남기지 않았음을 교차 확인했다.
  - 제안: 없음 — 참고용 확인.

- **[INFO]** CHANGELOG·plan 문서 추가는 순수 문서 변경
  - 위치: `CHANGELOG.md` (게이트 3~24행), `plan/in-progress/remove-member-order-coverage.md` (신규 파일)
  - 상세: 둘 다 마크다운 텍스트 추가로, 런타임에 영향을 주는 코드 경로가 아니다. `spec_impact: none` 으로 명시돼 있고 실제로 `spec/**` 변경도 없다.
  - 제안: 없음.

## 점검 관점별 결론

1. 의도치 않은 상태 변경 — 해당 없음 (프로덕션 코드 미변경, 테스트 mock 은 매 테스트 전 재생성)
2. 전역 변수 — 새 전역 변수 없음, 기존 모듈 스코프 `deleteEvents` 는 이 diff 와 무관
3. 파일시스템 부작용 — `CHANGELOG.md`·plan 문서 추가만 있고, 둘 다 리뷰 대상 diff 자체가 의도한 변경. 워킹트리에 예기치 않은 잔여 파일 없음(확인 완료)
4. 시그니처 변경 — 없음 (프로덕션 함수/메서드 시그니처 무변경)
5. 인터페이스 변경 — 없음 (공개 API·wire 계약 무변경. CHANGELOG 항목이 서술하는 "계약 변경"은 이 PR 이전에 이미 병합된 코드에 대한 것이며 이 diff 는 테스트만 추가)
6. 환경 변수 — 읽기/쓰기 없음
7. 네트워크 호출 — 없음
8. 이벤트/콜백 — 없음 (신규 테스트는 기존 `AuditLogsService.record` mock 이 호출되지 않았음을 확인하는 단언만 추가, 콜백 배선 자체는 무변경)

## 요약

이번 변경은 `WorkspacesService.removeMember()` 판정 순서의 미검증 구간 두 곳을 테스트로 고정하는 순수 테스트+문서 PR 이며, 프로덕션 코드·설정·전역 상태·파일시스템·환경 변수·네트워크·이벤트 배선 어디에도 실질적인 부작용을 일으키지 않는다. 신규 테스트는 기존 테스트 인프라(모듈 재생성 `beforeEach`)의 격리 보장 안에서 동작하므로 다른 테스트를 오염시킬 위험도 없고, plan 문서가 서술한 뮤테이션 검증 절차(사본 기반 편집·`cp` 원복)도 실제 워킹트리 상태로 교차 확인한 결과 잔여물 없이 깨끗하다.

## 위험도

NONE
