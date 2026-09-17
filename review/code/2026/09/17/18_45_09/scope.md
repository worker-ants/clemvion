# 변경 범위(Scope) 리뷰 — 트리거 삭제 자원 정리 (DRT-2)

## 요약 판단

이 PR 은 "트리거 행을 없애는 네 경로(트리거 화면 삭제·스케줄 화면 삭제·워크플로 삭제·워크스페이스
삭제)가 모두 그 트리거의 외부 자원·비밀을 정리한다"는 단일 의도를 매우 일관되게 구현한다.
`git diff --stat origin/main...HEAD` 로 확인한 27개 파일 전부가 이 의도에 직접 연결되며,
프롬프트 밖에 숨은 추가 파일도 없었다(파일 수 완전 일치). 아래는 "의도 이상 아닌가" 의심이 갈 만한
지점들을 직접 diff 로 대조한 결과다 — 전부 정당한 범위 내 변경으로 판정했다.

## 발견사항

- **[INFO]** `codebase/backend/jest.config.ts` 의 주석 수정은 코드 동작 변경이 아니라 문서 성격이지만, 새 e2e 스펙이 실제로 그 서술을 반증하게 만들어서 필요한 수정이다.
  - 위치: `codebase/backend/jest.config.ts:50` (게이트 기준, 변경 후)
  - 상세: 기존 주석은 "TypeORM DataSource 를 여는 예외는 `trigger-update-save-window.e2e-spec` 하나뿐"이라고 단정했다. 이번 PR 이 추가한 `codebase/backend/test/trigger-deletion-releases-resources.e2e-spec.ts` 는 그 문장을 반증한다 — `bullmq` 의 `Queue` 를 직접 열어(`scheduleQueue = new Queue(...)`, `afterAll` 에서 `scheduleQueue.close()`) 스케줄러 zset 소속을 검사하고, 별도 describe 블록에서 `DataSource` 도 하나 더 연다(`ds.destroy()`로 정리). 실측(직접 `grep afterAll/close/DataSource` 로 대조)과 문구가 일치해 이 수정은 스코프 안이다.
  - 제안: 없음 — 조치 불필요, 정확한 수정.

- **[INFO]** `chat-channel-binder.service.ts` 에서 기존 `teardownChatChannel` 내부 로직을 `teardownChannelConfig(triggerId, cfg)` 라는 public 메서드로 추출한 리팩토링이 이번 diff 에 섞여 있다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` (게이트: 메서드 `teardownChannelConfig`, diff 상 `369~382` 부근)
  - 상세: 이 추출은 "현재 작업과 무관한 정리"가 아니라, 이번 기능(락 밖에서 쓴 것을 되돌리는 `undoAbsentTriggerWrite` 보상 경로, 그리고 `TriggerResourceReleaserService.undoAbsentWrite`)이 **저장된 `config` 가 아니라 이번 요청이 방금 등록한 설정**으로 teardown 해야 하는 새 요구를 충족하기 위해 정확히 필요한 최소 추출이다. 로그 메시지의 `trigger.id` → `triggerId` 치환도 시그니처 변경(엔티티 대신 원시 id 를 받음)에 따른 필연적 부수 효과이지 무관한 손질이 아니다. `channelListenerRegistry`, `scheduleRepository`, `scheduleRunner` 등 다른 필드들도 grep 으로 확인한 결과 여전히 다른 메서드에서 쓰이고 있어 죽은 코드가 남지 않았다.
  - 제안: 없음 — 조치 불필요, 정당한 범위 내 리팩토링.

- **[INFO]** `WorkspacesService.deleteWorkspace` 에서 권한/타입 검사 로직을 `assertWorkspaceDeletable` 사설 메서드로 추출하고 두 번(락 없이 1회, 락 걸고 1회) 호출하도록 바뀌었다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` (게이트: 메서드 `assertWorkspaceDeletable`)
  - 상세: 이는 "권한 검사를 외부 자원 해제보다 먼저 해야 한다"(403 이 날 요청이 provider 등록·schedule job 부터 뜯으면 안 됨)는 이번 기능의 설계 요구 때문에 어쩔 수 없이 필요한 구조 변경이다. 로직 자체(owner 검사·personal 워크스페이스 거부)는 한 글자도 바뀌지 않았고, 중복을 피하기 위한 추출이라 "불필요한 리팩토링"으로 보기 어렵다. plan 문서(`plan/in-progress/trigger-deletion-release.md`)의 "설계" 절에 정확히 이 설계가 명시돼 있다.
  - 제안: 없음 — 조치 불필요.

- **[INFO]** `review/consistency/2026/09/17/18_00_19/**` (8개 파일)과 `plan/in-progress/trigger-deletion-release.md` 가 이번 diff 에 포함돼 있다.
  - 위치: 파일 19~27 (프롬프트 번호 기준)
  - 상세: 이들은 코드 변경이 아니라 프로젝트 규약이 의무화한 `--impl-prep` consistency-check 산출물과 작업 plan 문서다. `CLAUDE.md` 의 정보 저장 위치 표·"developer 는 구현 착수 직전 consistency-check --impl-prep 의무" 조항에 따라 커밋에 동반되는 것이 정상 관행이며, 코드 스코프를 벗어난 "무관한 파일 수정"이 아니다. 내용도 실제로 이번 트리거 삭제 자원 정리 작업(`spec/2-navigation/`)을 대상으로 한다.
  - 제안: 없음 — 조치 불필요.

- **[INFO]** `triggers.service.spec.ts` 등 다수 스펙 파일에서 `TriggerResourceReleaserService` 를 provider 배열에 기계적으로 추가하는 동일 패턴이 반복(9곳)된다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` 의 각 `describe` 블록 provider 배열 (예: `createBaseProviders`, `TriggersService.findOneDetail` 등 — 게이트 다수)
  - 상세: `TriggersService` 생성자에 새 의존성(`resourceReleaser`)이 추가된 데 따른 필연적 부수 효과이며 각 자리가 DI 컴파일 실패를 막기 위해 반드시 필요하다. `scheduleRepo.findOne` → `scheduleRepo.find` 로 바뀐 한 곳도 `TriggerResourceReleaserService` 가 스케줄 조회를 배치(`find`)로 바꾼 설계 변경의 필연적 반영이다. 기능 확장이나 드리프트가 아니다.
  - 제안: 없음 — 조치 불필요.

## 스코프 밖 변경 후보 — 발견되지 않음

다음 항목들을 특히 의심하고 직접 diff 대조했으나 전부 정당했다:
- import 정리: `triggers.service.ts` 에서 `ChannelListenerRegistry` import·생성자 파라미터 제거 — 책임이 `TriggerResourceReleaserService` 로 이동했을 뿐, 사용처가 사라졌음을 grep 으로 확인(다른 곳에서 재사용 없음).
- 설정 변경: `schedules.module.ts` 의 `SecretStoreModule` 추가는 이번 기능(스케줄 삭제 시 비밀 정리)이 요구하는 최소 배선이며 순환 의존이 생기지 않음을 주석에 근거와 함께 남겼다.
- 포맷팅: 각 diff 에 개행·들여쓰기만 바뀐 hunk가 섞여 있지 않았다(모든 `-`/`+` 라인이 실질 변경).
- 주석 변경: `triggers.module.ts`·`triggers.service.ts`·`jest.config.ts` 의 기존 주석 수정은 전부 코드 변경으로 인해 그 주석이 거짓이 된 자리들이며, 무관한 주석 첨삭이 아니다.

## 요약

27개 변경 파일 전체(코드 17·e2e 1·plan 1·consistency 산출물 8)를 diff 단위로 대조한 결과, "트리거
행을 없애는 네 경로 모두 자원을 정리한다"는 단일 목적에서 벗어난 수정을 찾지 못했다. 리팩토링으로
보일 수 있는 두 지점(`teardownChannelConfig` 추출, `assertWorkspaceDeletable` 추출)도 실측
결과 이번 기능의 설계 요구(보상 경로가 저장된 config 가 아닌 이번 요청 결과로 teardown 해야 함 /
권한 검사가 외부 해제보다 선행해야 함)를 충족하기 위한 최소 변경이었다. jest.config.ts 주석
수정도 새로 추가된 e2e 스펙의 실제 리소스 오픈 패턴과 정확히 일치함을 소스 확인으로 검증했다.
`review/`·`plan/` 산출물은 프로젝트 규약이 요구하는 프로세스 증거로, 스코프 이탈이 아니다.

## 위험도

NONE
