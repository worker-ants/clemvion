# 의존성(Dependency) 리뷰

## 검토 범위

`git diff origin/main...HEAD --stat -- codebase/` 로 확인한 코드 변경은 8개 파일이며, 전부
`codebase/backend/src/modules/triggers/` 하위다. `TriggersService` 의 private 메서드
(`setupChatChannel`/`teardownChatChannel`/`buildCallbackUrl`)를 신규 `ChatChannelBinderService`
와 순수 함수 `buildTriggerCallbackUrl` 로 옮기는 내부 리팩터이고, 그 외 파일은 plan/review
산출물(md/json)이다.

`git diff origin/main...HEAD -- '**/package.json' '**/package-lock.json' '**/pnpm-lock.yaml'`
결과 **매치 0건** — 매니페스트·락파일 변경이 전혀 없다.

## 점검 관점별 결과

1. **새 의존성**: 없음. 신규 파일(`chat-channel-binder.service.ts`, `trigger-callback-url.ts`
   및 대응 spec)의 import 전부를 확인했다 — `@nestjs/common`, `@nestjs/config`,
   `@nestjs/typeorm`, `typeorm` 은 기존에 이미 쓰이던 패키지이고, 나머지는 전부 프로젝트 내부
   경로(`./entities/trigger.entity`, `../chat-channel/*`, `../secret-store/*`,
   `./chat-channel-input-rules`)다. `triggers.service.ts`/`triggers.module.ts`/spec 파일들에 추가된
   import 도 모두 신규 내부 모듈(`./chat-channel-binder.service`, `./trigger-callback-url`)만
   가리킨다. 외부 패키지 추가는 0건.
2. **버전 고정**: 해당 없음(신규 외부 의존 없음).
3. **라이선스**: 해당 없음(신규 외부 의존 없음).
4. **취약점**: 해당 없음(신규 외부 의존 없음). 기존 의존성 버전도 이 diff 에서 건드리지 않았다.
5. **불필요한 의존성 / 대체 가능성**: `trigger-callback-url.ts` 의 JSDoc 이 스스로 밝히듯,
   `common/utils/app-base-url.ts::getAppBaseUrl()` 과 fallback 리터럴·후행 슬래시 제거 로직이
   동일해 **논리적으로 중복**이다. 다만 이 diff 는 "그대로 옮기기"(순수 이동)이고, 통합하지
   않은 이유(읽는 소스가 `ConfigService` vs `process.env.APP_URL` 로 달라 트리거 단위 테스트
   14블록의 mock 제어권이 사라짐 — DI 변경이 필요해 별 PR 로 분리)가 문서화돼 있으며
   `review/code/2026/09/11/18_04_36/RESOLUTION.md` 의 INFO 7 로 이미 트래커에 등재된 상태다.
   신규로 지적할 사항은 아니고, 기존 트래킹이 유효함을 확인한다.
6. **의존성 크기**: 번들/빌드 영향 없음. 외부 패키지 추가가 없고, 신규 코드는 기존 모듈 내
   파일 분리(291줄 신설 + 258줄 감소, net 거의 이동)라 번들 크기·빌드 시간에 실질적 영향이
   없다.
7. **호환성**: 해당 없음(버전 변경 없음). NestJS DI 패턴(`@Injectable`, constructor 주입)도
   같은 폴더의 `chat-channel-token-rotator.service.ts` 선례를 그대로 따른다.
8. **내부 의존성**: 이 리팩터의 핵심 리스크 지점이라 별도로 확인했다.
   - `triggers.module.ts` 에서 `ChatChannelBinderService` 는 `providers` 에만 등록되고
     `exports` 에는 없다 — 모듈 경계 밖으로 공개 표면을 넓히지 않는 설계로, 긍정적이다.
   - `ChatChannelBinderService` 가 `../chat-channel/channel-adapter.registry`,
     `../chat-channel/channel-listener.registry`, `../chat-channel/types` 를 import 하는 방향은
     기존 `TriggersService` 가 갖고 있던 것과 동일한 단방향(`triggers → chat-channel`)이다.
     `#676`(`e827ed2a7`) 이 `chat-channel → triggers` 역방향 의존을 이미 제거해 둔 상태이므로,
     이번 이동으로 순환 의존이 재도입되지 않는다 — `triggers.module.ts` 주석("이동 후에도
     둘 다 쓴다")과 diff 를 대조해 확인했다.
   - `trigger-callback-url.ts` 는 외부 협력자 0개 순수 함수로 설계돼 있어 (`chat-channel-input-rules.ts`
     와 같은 판정 기준) provider 화하지 않았다 — 불필요한 DI 계층을 늘리지 않는 선택으로,
     의존 그래프를 단순하게 유지한다.
   - spec 파일(`triggers.service.spec.ts`, `triggers.web-chat.spec.ts` 등)에 `ChatChannelBinderService`
     를 provider 배열에 추가한 곳들은 실제 클래스를 그대로 등록(모킹 없음)하는 방식이라,
     테스트 대역 구성과 실제 DI 그래프가 일치한다.

## 발견사항

- **[INFO]** `buildTriggerCallbackUrl`(`codebase/backend/src/modules/triggers/trigger-callback-url.ts`)
  과 `getAppBaseUrl()`(`codebase/backend/src/common/utils/app-base-url.ts`)의 URL 조립 로직
  (fallback 리터럴 + 후행 슬래시 제거)이 중복된 상태로 유지된다.
  - 위치: `codebase/backend/src/modules/triggers/trigger-callback-url.ts` (JSDoc, 함수 `buildTriggerCallbackUrl`)
  - 상세: 신규 의존을 만들거나 표준 라이브러리로 대체할 문제는 아니고, 두 내부 유틸 간
    통합 여부의 문제다. 통합을 미룬 근거(ConfigService 경유 vs `process.env` 직접 참조 —
    통합 시 DI 변경 필요)가 파일 헤더에 문서화돼 있고, 이미 `review/code/2026/09/11/18_04_36/RESOLUTION.md`
    INFO 7 로 트래커에 등재돼 있어 이번 리뷰에서 새로 등록할 필요는 없다.
  - 제안: 별도 조치 불필요 — 기존 트래커 항목 유지로 충분하다.

## 요약

이번 diff 는 `codebase/backend/src/modules/triggers/` 내부의 순수 리팩터(private 메서드를
동일 모듈 내 신규 provider/순수 함수로 이동)로, `package.json`/lockfile 변경이 전혀 없고
신규 외부 패키지 도입도 0건이다. 따라서 버전 고정·라이선스·취약점·번들 크기·외부 호환성
관점에서는 검토할 대상이 없다. 유일하게 실질적인 점검 지점인 내부 의존 방향은 기존에
`#676` 으로 정리된 `triggers → chat-channel` 단방향을 그대로 유지하며, 신규 서비스는
모듈 밖으로 export 되지 않아 공개 표면도 늘지 않았다. 발견된 유일한 항목(내부 유틸
중복)은 이미 별도 PR 로 분리하기로 문서화·트래킹된 사안이라 신규 리스크가 아니다.

## 위험도

NONE
