# 의존성(Dependency) 리뷰 — chat-channel-binder 분리 (impl-chat-channel-binder-t2)

## 발견사항

- **[INFO]** 새 외부 패키지 없음 — 순수 내부 리팩터
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` (신규 파일 전체), `codebase/backend/src/modules/triggers/trigger-callback-url.ts` (신규 파일 전체), `codebase/backend/src/modules/triggers/triggers.module.ts:20`, `codebase/backend/src/modules/triggers/triggers.service.ts:48-49`
  - 상세: 신규 import 는 모두 기존 의존성(`@nestjs/common`, `@nestjs/config`, `@nestjs/typeorm`, `typeorm`)과 프로젝트 내부 모듈(`./entities/trigger.entity`, `../chat-channel/*`, `../secret-store/*`, `./chat-channel-input-rules`, `./trigger-callback-url`)뿐이다. `package.json`/lockfile 변경도 diff 에 없음(리뷰 대상 16개 파일 중 `package.json` 없음, 저장소 `git diff origin/main --stat`으로도 `package.json`/`pnpm-lock.yaml` 변경 0건 확인). 라이선스·취약점·번들 크기·버전 고정 항목은 이번 변경으로 영향 없음.
  - 제안: 없음(정보성).

- **[INFO]** 내부 의존 방향 재확인 — `triggers/` ← `chat-channel/`(단방향) 유지, `forwardRef` 재도입 없음
  - 위치: `codebase/backend/src/modules/triggers/triggers.module.ts:34-40`(주석), `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:37-41`(JSDoc)
  - 상세: `ChatChannelBinderService`는 `triggers/` 안에 위치하며 `ChannelAdapterRegistry`/`ChannelListenerRegistry`(둘 다 `ChatChannelModule` `exports`에 포함, 직접 `codebase/backend/src/modules/chat-channel/chat-channel.module.ts` 확인 완료)를 주입받는 단방향 의존만 추가한다. `#676`(`e827ed2a7`)에서 제거한 `chat-channel→triggers` 역방향 의존·`forwardRef`가 되살아나지 않았음을 모듈 wiring으로 직접 확인했다. 새 provider는 `exports`에 없어(§`triggers.module.ts:51` 주석 "export 하지 않는다") 모듈 외부로 의존 표면이 넓어지지 않는다.
  - 제안: 없음(정보성 — 리팩터가 의도한 바와 일치).

- **[INFO]** 알려진 중복 로직(`buildTriggerCallbackUrl` vs `common/utils/app-base-url.ts::getAppBaseUrl()`) — 통합 보류가 이미 문서화됨
  - 위치: `codebase/backend/src/modules/triggers/trigger-callback-url.ts:25-32`(JSDoc)
  - 상세: 두 함수가 동일한 fallback 리터럴(`http://localhost:3011`)과 후행 슬래시 제거 로직을 갖고 있으나, 하나는 `ConfigService`를 경유하고 다른 하나는 `process.env`를 직접 읽어 소스가 다르다. 통합 시 트리거 유닛 테스트 9개 모듈의 `ConfigService` mock 통제권이 깨진다는 근거(DI 변경이라 별 PR로 분리)가 JSDoc에 실측 근거와 함께 명시되어 있다(`--impl-prep` `review/consistency/2026/09/11/17_39_32` W4 참조). 표준 라이브러리·기존 유틸로 대체 가능해 보이지만, 대체를 보류한 사유가 이미 기록돼 있으므로 이번 PR 범위에서 추가 조치 불필요.
  - 제안: 없음 — 통합은 후속 PR(별도 DI 변경)로 이미 스코프 아웃됨.

- **[INFO]** (의존성 범위 밖, 저장소 위생 관측) 리뷰 대상 파일에 미커밋 로컬 수정 존재 — 병렬 리뷰어 뮤테이션 추정
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` — `git diff` 기준 `if (storeUserSuppliedSecrets)` → `if (true)`로 바뀐 미커밋 상태 관측(파일 내 해당 조건문 블록, PATCH 시 bot token 저장을 스킵하는 게이트)
  - 상세: 이 리뷰는 다른 reviewer 들과 같은 워킹트리를 동시에 읽는 병렬 fan-out 인데, 세션 시작 시점 `git status --short`에 `M codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`가 이미 잡혀 있었다. 내용은 mutation-testing 흔적(조건을 상수 `true`로 치환)으로 보이며 본 리뷰(dependency)가 만든 변경이 아니다. 이 관점의 발견사항은 아니므로 원복하지 않았다 — 다른 reviewer 의 진행 중 작업을 건드리지 말라는 규약(§검증용 뮤테이션 규약)에 따라 그대로 둔다.
  - 제안: 이 관측을 무시하지 말 것 — 최종 SUMMARY 통합 시 다른 reviewer(특히 이 파일을 다루는 reviewer)가 정상적으로 원복했는지 확인 필요.

## 요약

이번 변경은 `TriggersService`의 chat-channel adapter setup/teardown 로직을 신규 `ChatChannelBinderService`(및 순수 함수 `buildTriggerCallbackUrl`)로 옮기는 **순수 내부 리팩터**다. 신규 외부 패키지·`package.json`/lockfile 변경이 전혀 없어 버전 고정·라이선스·취약점·번들 크기 항목은 해당 사항이 없다. 내부 의존 관계는 기존에 이미 `TriggersModule`이 가진 `ChatChannelModule`/`SecretStoreModule` import 범위 안에서만 재배선되며, 과거 제거된 `chat-channel↔triggers` 순환·`forwardRef`가 되살아나지 않음을 모듈 exports 직접 확인으로 검증했다. 알려진 유틸 중복(`getAppBaseUrl` vs `buildTriggerCallbackUrl`)은 통합 보류 사유가 이미 문서화되어 있어 문제 삼지 않는다. 의존성 관점에서는 조치가 필요한 항목이 없다. 별도로, 리뷰 대상 파일에 병렬 세션의 것으로 추정되는 미커밋 뮤테이션(`storeUserSuppliedSecrets` → `true`)이 관측되었음을 저장소 위생 차원에서 기록해 둔다(이 리뷰의 스코프는 아니며 원복하지 않음).

## 위험도

NONE
