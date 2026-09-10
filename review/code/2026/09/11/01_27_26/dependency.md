# Dependency Review — chatChannel PATCH botToken 400 수정 (impl-chat-channel-patch-token)

## 검증 방법

프롬프트가 생략한 diff(`chat-channel-config.dto.ts`, `trigger-dto-validation.spec.ts`,
`triggers.service.spec.ts`, `triggers.service.ts`, `plan/**`, `review/**`)를 실제 저장소에서
직접 대조했다(읽기 전용, 저장소 변경 없음):

- `git diff --stat origin/main...HEAD -- codebase/` 로 이 PR 이 건드린 `codebase/**` 전체 파일 목록을 확정 (15개, 모두 `codebase/backend/src/modules/triggers/**` · `codebase/backend/test/**` · `codebase/frontend/src/content/docs/**`).
- `git diff origin/main...HEAD -- '**/package.json' '**/package-lock.json' 'pnpm-lock.yaml'` (관련 경로) — **변경 없음**을 확인.
- 각 변경 파일의 `import`/`require` 라인만 추출(`grep -E '^\+.*(import|require)'`)해 신규 외부 패키지 유입 여부 확인.

## 발견사항

- **[INFO]** 새 외부 의존성 없음 — 이번 PR 은 패키지 추가/제거가 전혀 없다
  - 위치: `codebase/backend/package.json`, `codebase/frontend/package.json` (둘 다 diff 없음 — 파일명으로 기재, 이 PR 에서 미변경)
  - 상세: `git diff origin/main...HEAD` 범위에서 `package.json`/`package-lock.json`/`pnpm-lock.yaml` 어디에도 변경이 없다. 코드 변경분(`chat-channel-config.dto.ts`, `update-trigger.dto.ts`, `triggers.controller.ts`, `triggers.service.ts`, 각 `.spec.ts`, e2e spec)의 신규 `import` 는 모두 (a) 이미 `package.json` 에 존재하는 외부 패키지(`@nestjs/swagger`, `@nestjs/common`, `class-validator`, `class-transformer`) 아니면 (b) 저장소 내부 모듈(`./dto/chat-channel-config.dto`, `../../../common/pipes/validation.pipe`, workspace 패키지 `@workflow/chat-channel-validation` → `codebase/packages/chat-channel-validation`)이다.
  - 제안: 없음 — 점검 관점 1(새 의존성)·3(라이선스)·4(취약점)·6(번들 크기) 모두 해당 없음(변경 없음이 곧 무해함).

- **[INFO]** `@nestjs/swagger` 의 `OmitType` — 이 저장소에서 첫 사용
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` (`ChatChannelUpdateConfigDto` 클래스 선언부, `import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';`)
  - 상세: `grep -rl "OmitType" codebase/backend/src` 결과 이 파일이 유일한 사용처다. `@nestjs/swagger`(`^11.4.5`, 기존 의존성)는 이미 프로젝트 전역에서 `ApiProperty`/`ApiPropertyOptional` 로 광범위하게 쓰이고 있고, `OmitType` 은 v4 이래 안정적으로 제공되는 표준 mapped-type 유틸리티라 버전 호환성 문제는 없다. 새 패키지가 아니라 **기존 패키지의 미사용 export 를 처음 끌어다 쓴 것**이므로 취약점·라이선스·번들 크기 영향은 없다.
  - 제안: 조치 불요. 다만 `OmitType` 기반 상속(`ChatChannelUpdateConfigDto extends OmitType(ChatChannelConfigDto, [...])`)은 부모 DTO 의 데코레이터 메타데이터 조합에 의존하므로, 향후 `@nestjs/swagger` 메이저 업그레이드 시 mapped-types 회귀 테스트(`trigger-dto-validation.spec.ts`) 를 먼저 돌릴 것.

- **[INFO]** 내부 의존 관계 — `ChatChannelConfigDto` ↔ `ChatChannelUpdateConfigDto` 신규 결합 + union 타입
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (`type ChatChannelInput = ChatChannelConfigDto | ChatChannelUpdateConfigDto;` 선언부), `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` (`ChatChannelUpdateConfigDto` 클래스)
  - 상세: 점검 관점 8(내부 의존성) 대상. PATCH 전용 DTO 가 생성용 DTO 를 `OmitType` 으로 상속하면서 두 클래스 사이에 컴파일 타임 결합이 새로 생겼고, `triggers.service.ts` 는 두 타입을 아우르는 `ChatChannelInput` union 을 도입해 `assertChatChannelInputSafe`/`stripChatChannelPlaintext`/`mergeExternalConfig`/`setupChatChannel` 네 헬퍼가 이 union 을 받도록 확장했다. 이는 순환 의존이 아니고 방향이 명확하다(update → create 방향 단방향 상속, service → dto 방향 단방향 import). 순환 참조·모듈 경계 위반은 관측되지 않았다.
  - 제안: 조치 불요. 향후 provider 별 세 번째 DTO 변형이 추가될 경우 `ChatChannelInput` union 이 3분기로 늘어나는 지점이므로, 그 시점엔 discriminated union 이나 오버로드로 재정리할 것을 권고(현재는 2종이라 union 으로 충분).

- **[INFO]** `class-validator`/`class-transformer` 사용 패턴 — 기존 관례 준수
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` (`@IsEmpty()`, `@IsOptional()` 데코레이터 조합)
  - 상세: `IsEmpty` 는 이미 파일 상단 import 목록에 존재하던 심볼(이번 PR 이전부터 사용 중)이라 신규 의존 도입이 아니다. 버전(`class-validator ^0.15.1`, `class-transformer ^0.5.1`)도 변경되지 않았다.
  - 제안: 조치 불요.

## 요약

이번 변경은 `package.json`/lock 파일을 전혀 건드리지 않았고, 모든 신규 `import` 는 이미 프로젝트에 존재하는 외부 패키지(`@nestjs/swagger`, `@nestjs/common`, `class-validator`, `class-transformer`) 또는 저장소 내부 모듈(로컬 DTO, workspace 패키지 `@workflow/chat-channel-validation`)로 좁혀진다. 유일하게 새로운 점은 기존 의존성 `@nestjs/swagger` 의 `OmitType` 유틸리티를 이 코드베이스에서 처음 사용한 것과, `ChatChannelConfigDto`/`ChatChannelUpdateConfigDto` 사이·`triggers.service.ts` 의 `ChatChannelInput` union 사이에 생긴 내부 결합인데, 둘 다 버전 고정·라이선스·취약점·번들 크기·순환 의존 어느 축에서도 위험 신호가 없다. 의존성 관점에서는 실질적으로 "변경 없음"에 가까운 안전한 PR 이다.

## 위험도

NONE
