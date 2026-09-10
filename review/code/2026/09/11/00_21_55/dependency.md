# 의존성(Dependency) 코드 리뷰

## 발견사항

이번 diff(`git diff origin/main...HEAD --stat -- 'codebase/**'`, 11개 코드 파일 + `codebase/backend/test/*.e2e-spec.ts` 1개, 총 941/-165)에서
`package.json`/`pnpm-lock.yaml` 류 변경은 0건이다 (`git diff origin/main...HEAD --stat -- '**/package.json' 'pnpm-lock.yaml' '**/pnpm-lock.yaml'` 출력 없음, 직접 재실행으로 확인).

- **[INFO]** 새 외부 패키지 없음 — `chat-channel-config.dto.ts` 가 새로 import 하는 `OmitType` 은 기존에 이미 고정 버전으로 설치된 `@nestjs/swagger`(`^11.4.5`)의 export
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:19`
  - 상세: `import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';` — `@nestjs/swagger` 패키지 자체는 이미 `codebase/backend/package.json`(35, 42, 62, 63행)에 `@nestjs/common@^11.0.1`·`@nestjs/swagger@^11.4.5`·`class-transformer@^0.5.1`·`class-validator@^0.15.1`로 고정돼 있고, `class-validator`(`IsEmpty` 등)·`class-transformer`(`Type`) 쪽도 마찬가지다. `OmitType`은 NestJS Swagger가 v5 이전부터 제공하는 표준 매핑 유틸리티라 서브패키지 추가 설치가 불필요하다.
  - 제안: 조치 불요.
- **[INFO]** `triggers.service.ts` 가 참조하는 `@workflow/chat-channel-validation` 은 이번 PR 신규 도입이 아니라 브랜치 분기 이전(`origin/main`)부터 이미 사용 중인 workspace 내부 패키지
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:47-50` (import), `package.json:55` (`"@workflow/chat-channel-validation": "workspace:*"`)
  - 상세: `git show origin/main:codebase/backend/src/modules/triggers/triggers.service.ts`에서도 동일 import(44행)가 확인돼, 이번 변경으로 새로 생긴 의존이 아니다. `workspace:*`로 고정돼 있어 버전 드리프트 위험도 없다.
  - 제안: 조치 불요.
- **[INFO]** 내부 의존 관계 변화 — `update-trigger.dto.ts` → `chat-channel-config.dto.ts`(`ChatChannelUpdateConfigDto`), `triggers.service.ts` → 동일 파일의 신규 export(`ChatChannelUpdateConfigDto`), 그리고 서비스 내부 신설 union 타입(`ChatChannelInput = ChatChannelConfigDto | ChatChannelUpdateConfigDto`)
  - 위치: `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts:14`, `codebase/backend/src/modules/triggers/triggers.service.ts` (`ChatChannelConfigDto, ChatChannelUpdateConfigDto` import 및 `type ChatChannelInput` 선언 — import 블록 직후)
  - 상세: 방향은 기존과 동일하게 DTO → (파생 DTO, `OmitType`) → 서비스 소비이며 순환 참조·계층 역전 신호는 없다. `assertChatChannelInputSafe`가 오버로드 시그니처로 `mode`와 DTO 타입을 컴파일 타임에 묶어(둘 다 union이 아니라 개별 오버로드) `mode`/DTO 짝 어긋남을 타입 체커가 잡도록 한 점도 내부 결합을 더 안전하게 만드는 방향이라 우려 없음.
  - 제안: 조치 불요.
- **[INFO]** 문서(`triggers.mdx`/`triggers.en.mdx`/`telegram.mdx`/`telegram.en.mdx`)·plan·review 산출물 변경은 의존성 표면과 무관 — 서술 정정 및 세션 기록일 뿐 빌드 그래프·패키지 그래프에 영향 없음
  - 위치: `codebase/frontend/src/content/docs/**/*.mdx`, `plan/in-progress/*.md`, `review/**`
  - 제안: 조치 불요.

## 요약

이번 diff는 `codebase/backend/src/modules/triggers/**`의 DTO 분리(`ChatChannelUpdateConfigDto` 신설, `OmitType` 사용)·서비스 분기 로직·컨트롤러 문서 주석·테스트, 그리고 관련 frontend 문서(mdx) 정정과 plan/review 산출물로 구성되며, `package.json`/lock 파일 변경은 전무하다. 새로 등장하는 심볼(`OmitType`, 신규 union/오버로드 타입)은 모두 기존에 고정 버전으로 이미 설치된 의존성(`@nestjs/swagger`, `@nestjs/common`, `class-validator`, `class-transformer`)의 export이거나 브랜치 분기 이전부터 있던 내부 workspace 패키지(`@workflow/chat-channel-validation`)·저장소 내부 모듈이다. 따라서 새 의존성 추가·버전 고정·라이선스·취약점·불필요한 의존성·번들 크기·기존 의존성과의 호환성 항목은 이번 PR에서 평가 대상 자체가 없다. 내부 모듈 간 의존 방향도 DTO 파생과 서비스의 union 타입 소비뿐이라 순환 참조·계층 역전 신호는 관측되지 않았다. 저장소 파일은 뮤테이션 없이 읽기(`git diff`, `git show`, `grep`)만으로 검증했으며 `git status --short`로 워킹트리 오염이 없음을 확인했다.

## 위험도
NONE
