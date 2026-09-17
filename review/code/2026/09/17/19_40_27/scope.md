# 변경 범위(Scope) 리뷰 — trigger-deletion-release

검증 방법: 저장소 파일은 전혀 수정하지 않았다(읽기 전용 `Read`/`Bash git diff`/`git show` 만 사용).
`git status --short` 로 확인한 잔여 변경은 이 리뷰 세션 자신의 출력 디렉터리
(`review/code/2026/09/17/19_40_27/`) 뿐이다.

프롬프트에 첨부된 조립 diff 는 61개 파일(`git diff --stat origin/main...HEAD` 로 대조해 개수 일치
확인)이었는데, 그중 38개가 `review/code/**`·`review/consistency/**` 산출물이다. 이는 스코프 이탈이
아니라 이 저장소 CLAUDE.md 가 명시하는 "구현 완료 후 `/ai-review` + fix 는 상시 승인된 강제 의무"
워크플로가 낳은 정상적인 부산물이다(`review/` 는 gitignore 대상이 아니고, 커밋 순서 규약상 리뷰
라운드 결과물이 같은 PR 커밋 이력에 남는 것이 확립된 관행). 아래는 실질 코드 변경 23개 파일
(`codebase/**`·`CHANGELOG.md`·`plan/in-progress/trigger-deletion-release.md`)만 대상으로 한 분석이다.

## 점검 관점별 확인

1. **의도 이상의 변경** — 없음. `git diff --stat origin/main...HEAD -- codebase/ CHANGELOG.md plan/`
   로 뽑은 23개 파일 전부가 "트리거 행을 없애는 네 경로(트리거·스케줄·워크플로·워크스페이스 삭제)가
   그 자원(schedule job·chat channel provider 등록·secret_store 비밀)을 정리한다"는 단일 과업에
   직접 연결된다. 프론트엔드·인프라·무관 모듈 변경 0건.
2. **불필요한 리팩토링** — `WorkspacesService.deleteWorkspace` 를 `assertWorkspaceDeletable` 로
   추출하고 잠금 순서(워크스페이스→멤버십)를 바꾼 것, `trigger-config-lock.ts` 에서
   `setLocalLockTimeout` 을 추출한 것은 리팩토링처럼 보이지만 둘 다 이번 기능이 직접 요구한다 —
   전자는 "권한 검사를 외부 해제보다 먼저" + `transferOwnership` 과의 교착 회피, 후자는 워크플로·
   워크스페이스 삭제 트랜잭션에도 같은 락 상한이 필요해서다. `plan/in-progress/trigger-deletion-release.md`
   의 설계 절에도 사전에 명시돼 있어 사후 정당화가 아니다.
3. **기능 확장(over-engineering)** — 없음. `TriggerResourceReleasePort`/`ModuleRef` 지연 해석은
   순환 의존(WorkflowsModule↔TriggersModule) 회피를 위한 최소 장치이고, 저장소 기존 선례
   (`NotificationsService.getWebsocket` 등)와 같은 패턴을 재사용했다 — 새 추상화 계층을 임의로
   늘리지 않았다.
4. **무관한 수정** — 없음. `codebase/backend/jest.config.ts` 의 주석 수정은 포맷팅이 아니라 새로
   추가된 e2e 스펙(`trigger-deletion-releases-resources.e2e-spec.ts`)이 BullMQ `Queue` 를 열고
   닫는다는 사실을 detectOpenHandles 노트에 반영한 것으로, 그 e2e 파일의 실제 내용과 대조해 확인했다.
5. **포맷팅 변경** — 실질 변경과 섞인 의미 없는 공백/줄바꿈 diff 는 발견하지 못했다. 각 파일의 diff
   가 추가·수정 라인에 국한돼 있다.
6. **주석 변경** — `chat-channel-binder.service.ts` 의 로그 리터럴 `TriggersService:` →
   `ChatChannelBinderService:` 치환(4곳)과 클래스 JSDoc 정정은 drive-by 가 아니라, 이번 PR 이 바로
   그 로그의 호출 경로를 `teardownChannelConfig` 분리로 넓히면서 트리거가 된, 사전에 트래킹돼 있던
   정정 항목이다(`review/code/2026/09/17/18_45_09/documentation.md` WARNING, RESOLUTION #11 로 처리
   확인). 범위 내 정당한 동반 수정으로 판단한다.
7. **임포트 변경** — `triggers.service.ts` 에서 `ChannelListenerRegistry` import/생성자 주입 제거는
   그 책임이 신설된 `TriggerResourceReleaserService` 로 이동했기 때문이며, 새 파일들의 import 는
   전부 새로 쓰는 심볼과 대응한다. 미사용 import 잔존이나 불필요한 정리는 발견하지 못했다.
8. **설정 변경** — `schedules.module.ts` 에 `SecretStoreModule` 을, `triggers.module.ts` 에
   `TriggerResourceReleaserService`/`TRIGGER_RESOURCE_RELEASER` provider 를 추가한 것은 각각
   "스케줄 삭제도 비밀을 커밋 뒤 정리해야 한다"·"삭제 네 경로의 정리 협력자를 DI 로 노출해야 한다"는
   이번 기능의 직접 요구다. 다른 모듈 설정·빌드 설정 변경은 없다.

## 요약

실질 코드 diff(23개 파일, +2,386/-90)는 스펙 트래커(DRT-2)가 지목한 "트리거 삭제 자원 정리 4경로"
범위에 정확히 국한되어 있으며, 리팩토링·로그 문구 정정·모듈 배선 변경까지 전부 그 범위 안에서
필연적으로 파생된 동반 수정으로 코드·plan·이전 라운드 RESOLUTION.md 대조를 통해 확인했다. 프롬프트에
포함된 나머지 38개 파일은 `review/code/**`·`review/consistency/**` 산출물로, 이 저장소가 강제하는
review→fix 루프의 정상적 부산물이지 스코프 이탈이 아니다. 무관한 파일·포맷팅·불필요한 임포트·설정
드리프트는 발견하지 못했다.

## 위험도

NONE
