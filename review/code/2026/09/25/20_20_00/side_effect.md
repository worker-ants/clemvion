# 부작용(Side Effect) 리뷰

## 리뷰 범위

- `codebase/backend/README.md` — 문서 정정(캐너리 절 서술을 `#1399` 이후 구현에 맞춤)
- `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` — `transferOwnership` 트랜잭션 재검사 분기를 고정하는 unit 테스트 1건 추가
- `plan/in-progress/canary-readme-recheck-test.md`, `review/consistency/2026/09/25/20_01_21/*.md` — 이번 세션이 규약대로 생성한 plan/consistency-check 산출물(신규 파일)

**중요**: 이번 changeset 에는 프로덕션 소스(`.ts` 비-테스트 파일) 변경이 포함되어 있지 않다. `transferOwnership` 의 트랜잭션 안 재검사 분기 자체는 기존 구현이며, 이번 diff 는 그 분기를 고정하는 테스트와 그것을 설명하는 문서만 추가한다.

## 발견사항

- **[INFO]** 신규 파일 4건(plan 1 + consistency 리포트 3~5) 생성은 저장소 규약에 따른 의도된 산출물
  - 위치: `plan/in-progress/canary-readme-recheck-test.md` 전체(신규), `review/consistency/2026/09/25/20_01_21/{SUMMARY,convention_compliance,cross_spec,naming_collision,plan_coherence,rationale_continuity}.md` 전체(신규)
  - 상세: 부작용 관점에서 "예상치 못한 파일 생성"에 해당하는지 점검했다. 모두 `CLAUDE.md` "정보 저장 위치" 표가 지정한 정규 경로(`plan/in-progress/**`, `review/consistency/**`)에 놓여 있고, `--impl-prep` 실행 결과를 영속화하는 정상 워크플로 산출물이다. 애플리케이션 런타임에 영향을 주는 파일시스템 부작용은 아니다.
  - 제안: 조치 불요. (다만 이 리포트 자신도 `review/code/2026/09/25/20_20_00/side_effect.md` 를 생성하므로 동일한 성격이다.)

- **[INFO]** 신규 테스트는 기존 `beforeEach` 격리 패턴 안에서만 상태를 바꾼다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` — `describe('transferOwnership')` 블록 내 `it('인가 선행은 owner 였지만 락 재검사에서 강등이 보이면 OWNER_REQUIRED — 멤버를 바꾸지 않는다', ...)` (게이트 1149~1185)
  - 상세: 새 테스트는 `memberRepo.findOne.mockImplementation(...)` 으로 mock 동작을 교체한다. 이 mock 은 매 테스트마다 `beforeEach`(게이트 72~159, 특히 `module.get(getRepositoryToken(WorkspaceMember))` 로 매번 새 `jest.fn()` 인스턴스를 얻는 120~122 행)가 재생성하므로, 다른 `it` 블록으로 새는 공유 상태(mock 구현·호출 기록)가 없다. `deleteEvents`(파일 스코프 배열, 게이트 53) 나 `triggerReleaser` 는 이 새 테스트가 건드리지 않는다.
  - 제안: 조치 불요 — 격리가 유지됨을 확인.

- **[INFO]** `README.md` 변경은 순수 문서 정정, 런타임 부작용 없음
  - 위치: `codebase/backend/README.md:52,57,58`
  - 상세: 캐너리가 이미 인식하는 두 판별(`@WorkspaceId()`/`@WorkspaceParam()`)의 합계·로그 문구·"먼저 볼 곳"을 현재 코드와 맞추는 서술 수정이다. 코드·환경변수·인터페이스 변경이 아니다.
  - 제안: 조치 불요.

CRITICAL/WARNING 등급 발견사항 없음.

## 뮤테이션 검증 안내

가설 확인을 위한 저장소 파일 수정은 수행하지 않았다(diff·전체 파일 컨텍스트만으로 판단 가능한 범위). `git status --short` 로 저장소 상태를 바꾸지 않았음을 별도로 확인할 필요는 없었다.

## 요약

이번 changeset 은 프로덕션 코드 변경이 없는 문서 정정 + unit 테스트 추가(+ 규약에 따른 plan/consistency 산출물 생성)로, 부작용 관점에서 점검한 8개 축(상태 변경·전역 변수·파일시스템·시그니처·인터페이스·환경 변수·네트워크·이벤트/콜백) 중 어느 것도 저촉하지 않는다. 신규 테스트는 기존 `beforeEach` 격리 패턴 안에서만 동작하며 다른 테스트로 새는 공유 상태가 없고, 신규 문서 파일들은 모두 프로젝트가 지정한 정규 경로에 생성된 의도된 산출물이다.

## 위험도

NONE
