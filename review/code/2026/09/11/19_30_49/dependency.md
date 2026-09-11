# 의존성(Dependency) 리뷰 — `impl-chat-channel-binder-t2`

## 검토 범위 및 방법

`git diff origin/main...HEAD --stat`로 이번 브랜치 전체 변경 파일을 실측했다. `codebase/` 아래 변경은
`triggers/` 모듈 8개 파일뿐이고 (`chat-channel-binder.service.ts`(신규) · `chat-channel-binder.service.spec.ts`(신규) ·
`trigger-callback-url.ts`(신규) · `trigger-callback-url.spec.ts`(신규) · `triggers.module.ts` · `triggers.service.ts` ·
`triggers.service.spec.ts` · `triggers.web-chat.spec.ts`), 나머지는 `plan/`·`review/` 산출물이다.

`**/package.json`·`**/pnpm-lock.yaml` 경로로 diff 를 별도 조회한 결과 **변경 0건** — 이번 PR 은 어떤
`package.json`/lockfile 도 건드리지 않는다. 신규 파일 4개의 `import` 문을 전수 확인했다.

## 대조 결과 — 점검 관점별

1. **새 의존성**: 없음. `chat-channel-binder.service.ts`/`trigger-callback-url.ts` 가 쓰는 패키지는
   `@nestjs/common`·`@nestjs/config`·`@nestjs/typeorm`·`typeorm` 뿐이고 전부 `TriggersService` 가 이미
   쓰던 기존 의존이다. `trigger-callback-url.ts` 는 외부 패키지 import 가 **0개**(순수 함수).
2. **버전 고정**: 해당 없음(신규/변경 의존성 없음).
3. **라이선스**: 해당 없음(신규 의존성 없음).
4. **취약점**: 해당 없음(신규 의존성 없음, lockfile 변경 없음).
5. **불필요한 의존성**: 해당 없음. 오히려 `trigger-callback-url.ts` JSDoc 이 `common/utils/app-base-url.ts`
   의 `getAppBaseUrl()` 과 로직이 사실상 중복임을 스스로 밝히고(같은 fallback 리터럴·후행 슬래시 제거),
   왜 지금 통합하지 않는지(`ConfigService` mock 을 쥔 트리거 단위 테스트 14블록의 DI 통제권 상실 —
   순수 이동이 아니라 DI 변경이 됨) 근거까지 남겼다. 이는 신규 의존성 문제는 아니고 **내부 코드
   중복 통합 후속 과제**로, `--impl-prep` W4 에서 이미 별 PR 로 분리하기로 처분됐다.
6. **의존성 크기**: 순수 내부 리팩터(코드 이동)라 번들 크기·빌드 시간에 미치는 영향은 무시할 수준.
   신규 파일 2개(`chat-channel-binder.service.ts` 292줄, `trigger-callback-url.ts` 57줄)와 대응 spec
   파일 2개가 늘었지만 외부 패키지 트리에는 아무 변화가 없다.
7. **호환성**: 해당 없음(버전 변경 없음).
8. **내부 의존성** (이번 diff 의 실질 관심사):
   - `TriggersService` → `ChatChannelBinderService` 신규 생성자 주입 1개 추가(`triggers.service.ts`
     constructor 마지막 파라미터). `ChatChannelBinderService` 자체는 `TriggersService` 를 **import 하지
     않는다** — 로그 메시지 리터럴에 `"TriggersService:"` 접두 문자열이 남아 있을 뿐 코드 레벨 참조는
     없음을 grep 으로 확인(`chat-channel-binder.service.ts` 내 실제 `import` 문 12줄 전수 확인, 대상
     없음). 즉 순환 의존은 생기지 않았다 — 방향은 `TriggersService → ChatChannelBinderService` 단방향.
   - `ChatChannelBinderService` 가 새로 주입받는 협력자(`ChannelAdapterRegistry`·`ChannelListenerRegistry`·
     `SecretResolverService`·`ConfigService`·`Repository<Trigger>`)는 전부 `TriggersService` 가 이미
     주입받던 것과 동일 인스턴스/동일 모듈(`ChatChannelModule`·`SecretStoreModule`)에서 오므로,
     `triggers.module.ts` 의 `imports` 배열에 **신규 모듈 import 는 없다**(diff 는 provider 등록 1줄 +
     주석뿐).
   - `triggers.module.ts` 의 `exports: [TriggersService]` 는 이동 전후 동일하고 `ChatChannelBinderService`
     는 그 배열에 없다 — 코드 주석("이 모듈 안에서만 쓰인다")과 실제 export 배열이 일치함을 직접
     확인. 다른 모듈이 이 provider 에 우연히 의존하게 될 표면이 없다.
   - `triggers.service.spec.ts`/`triggers.web-chat.spec.ts` 의 `TestingModule` 구성마다
     `ChatChannelBinderService` 를 provider 로 추가한 diff(+7곳)는 실제 DI 그래프 변화(신규 생성자
     인자)를 테스트 하네스에 반영한 것으로, 별도 mock 패키지 도입 없이 클래스 자체를 그대로 등록한다
     — 새 테스트 더블 라이브러리 요구 없음.

## 발견사항

- **[INFO]** `trigger-callback-url.ts` 의 URL 조립 로직이 `common/utils/app-base-url.ts`
  `getAppBaseUrl()` 과 알려진 중복 관계에 있다(작성자 스스로 JSDoc 에 명시).
  - 위치: `codebase/backend/src/modules/triggers/trigger-callback-url.ts:25-32` (해당 JSDoc 블록)
  - 상세: 두 함수가 같은 fallback 리터럴(`http://localhost:3011`)과 같은 후행 슬래시 제거 규칙을
    독립적으로 구현한다. 다만 하나는 `ConfigService` 경유, 하나는 `process.env` 직접 참조로 값 출처가
    달라 단순 치환이 아니라 DI 변경이 필요 — 이번 PR 은 "순수 이동" 범위를 지키기 위해 의도적으로
    통합을 보류했고 근거(`ConfigService` mock 을 쥔 14개 테스트 블록의 통제권 상실)를 남겼다.
  - 제안: 조치 불필요(이번 PR 스코프 밖, 이미 별도 통합 후속 과제로 처분됨). 통합 작업은 값 출처
    통일(둘 다 `ConfigService` 또는 둘 다 `process.env`)을 먼저 결정한 뒤 진행할 것.

이번 diff 범위(`codebase/backend/src/modules/triggers/*`)에서 CRITICAL/WARNING 급 의존성 발견은 없다.

## 요약

이번 PR 은 `TriggersService` 의 private 메서드(`setupChatChannel`/`teardownChatChannel`/
`buildCallbackUrl`)를 신규 `ChatChannelBinderService`·순수 함수 `buildTriggerCallbackUrl` 로 옮기는
**순수 내부 리팩터**다. `package.json`/lockfile 변경이 전혀 없어 새 외부 의존성·버전 고정·라이선스·
취약점·번들 크기·버전 호환성 항목은 전부 해당 없음으로 실측 확인했다. 유일한 실질 검토 대상인
내부 의존 관계는 `TriggersService → ChatChannelBinderService` 단방향(순환 없음)이고, 새 provider 는
모듈 `exports` 에서 의도적으로 제외되어 공개 표면이 늘지 않았다. 알려진 코드 중복(`getAppBaseUrl()`)은
이번 diff 가 만든 것이 아니며 통합 보류 근거가 문서화되어 있어 정보성으로만 남긴다.

## 위험도

NONE
