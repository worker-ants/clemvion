# 의존성(Dependency) 코드 리뷰

## 발견사항

- **[INFO]** 새 외부 패키지 추가 없음 — 이번 diff 는 기존 의존성의 새 named export 를 추가로 import 했을 뿐이다
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:19` (`import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';`), `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts:7`~`8` (`CustomValidationPipe`·`ArgumentMetadata`/`BadRequestException`)
  - 상세: `git diff origin/main...HEAD --stat` 로 이번 브랜치 전체 36개 변경 파일을 확인했고 `package.json`/`pnpm-lock.yaml` 류는 0건이었다(`git diff origin/main...HEAD --stat -- '**/package.json' 'pnpm-lock.yaml' '**/pnpm-lock.yaml'` 출력 없음). 새로 등장한 심볼은 전부 이미 `codebase/backend/package.json` 에 고정된 기존 의존성(`@nestjs/swagger@^11.4.5`, `@nestjs/common@^11.0.1`, `class-validator@^0.15.1`, `class-transformer@^0.5.1`)의 export 이며, 내부 workspace 모듈(`../../../common/pipes/validation.pipe`)이다. `OmitType` 은 `@nestjs/swagger` 가 처음부터 제공하는 유틸리티로 별도 서브패키지 설치가 필요 없다.
  - 제안: 조치 불요. 확인 사실만 기록.

- **[INFO]** 버전 고정·라이선스·취약점·번들 크기·기존 의존성 호환성 — 해당 없음(변경 대상 아님)
  - 위치: 전체 diff (`git diff origin/main...HEAD --stat` 결과 36 files, 그중 `package.json`/lock 파일 0건)
  - 상세: 새 의존성이 없으므로 버전 고정 정책·라이선스 호환성·npm 취약점 감사(`pnpm audit` 대상 변경분)·번들 크기·빌드 시간·기존 패키지와의 버전 충돌 항목은 이번 PR 범위에서 평가할 대상이 존재하지 않는다. `@nestjs/swagger`·`class-validator`·`@nestjs/common` 버전 자체도 이번 diff 로 변경되지 않았다(코드에서 기존 버전의 export 를 추가로 import 했을 뿐).
  - 제안: 조치 불요.

- **[INFO]** 내부 의존 방향 — DTO → 서비스 역방향 의존 신설 없음, 순수 확장
  - 위치: `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts:14`(`ChatChannelConfigDto` → `ChatChannelUpdateConfigDto` import 교체), `codebase/backend/src/modules/triggers/triggers.service.ts:30-34`(같은 DTO 파일에서 두 클래스를 함께 import)
  - 상세: `ChatChannelUpdateConfigDto` 는 같은 파일(`chat-channel-config.dto.ts`) 안에서 `OmitType(ChatChannelConfigDto, [...])` 로 파생돼, DTO 계층 내부 의존만 늘었다(DTO→DTO). `update-trigger.dto.ts` 는 기존에 import 하던 `ChatChannelConfigDto` 를 신규 타입으로 **교체**했을 뿐 새 모듈 경계를 넘지 않는다. `triggers.service.ts` 는 두 타입의 합집합(`type ChatChannelInput = ChatChannelConfigDto | ChatChannelUpdateConfigDto`)을 받도록 넓혔는데, 이는 기존에도 서비스가 DTO 모듈에 의존하던 방향을 그대로 유지한다(서비스→DTO, 역전 없음). `@workflow/chat-channel-validation`(workspace 패키지) import 는 이번 diff 에서 신규 도입이 아니라 기존 import 를 유지한 채 그 아래에 새 타입 alias 2개를 얹은 것이다(`git diff` 컨텍스트 라인 확인).
  - 제안: 조치 불요. 순환 의존이나 계층 역전 신호 없음.

## 요약

이번 변경은 `codebase/backend/src/modules/triggers/**` 의 DTO·서비스·컨트롤러·테스트 파일들과 plan/review 산출물만 건드리며, `package.json`·lock 파일 변경은 전무하다(`git diff origin/main...HEAD --stat` 로 전 파일 목록 확인). 새로 등장하는 심볼(`OmitType`, `ArgumentMetadata`, `BadRequestException`, `CustomValidationPipe`)은 전부 기존에 이미 고정 버전으로 설치돼 있던 의존성(`@nestjs/swagger`·`@nestjs/common`)의 export 이거나 저장소 내부 모듈이라, 새 의존성 도입·버전 고정·라이선스·취약점·번들 크기·호환성 항목은 이번 PR 에서 평가할 대상 자체가 없다. 내부 모듈 간 의존 방향도 DTO→DTO 파생(`OmitType`)과 서비스가 DTO 합집합 타입을 받는 확장뿐이라 계층 역전이나 순환 참조 신호는 없다.

## 위험도

NONE
