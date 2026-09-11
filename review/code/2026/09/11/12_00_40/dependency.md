# 의존성(Dependency) 리뷰

## 검증 방법

- `git merge-base HEAD origin/main` (`94e19be8d`) 대비 `git diff --name-only` 로 이번 변경의 전체 파일 목록을 확인.
- `package.json`/lockfile 류가 변경 목록에 없음을 확인 (`codebase/backend/package.json`, `codebase/frontend/package.json`, 루트 `package.json` 어디에도 diff 없음).
- 신규 내부 파일(`chat-channel-rejection-messages.const.ts`)의 소비처와, `triggers.service.ts` 가 새로 추가한 `ErrorCode` import 의 레이어링 선례를 `grep -rn "nodes/core/error-codes"` 로 전수 확인.
- 저장소 파일은 조회만 했고 수정/뮤테이션은 하지 않음 (`git status --short` 상 이 세션이 만든 변경 없음, 기존 review 산출물 디렉터리만 untracked).

## 발견사항

- **[INFO]** 새 외부 의존성 없음 — 이번 변경은 `CHANGELOG.md`, backend TS 소스/스펙, e2e 스펙, frontend `.mdx` 문서, `plan/`·`review/` 산출물로만 구성되며 어떤 `package.json`/lockfile 도 건드리지 않는다. 버전 고정·라이선스·취약점·번들 크기·기존 의존성과의 충돌 항목은 모두 해당 없음(N/A).
  - 위치: 전체 diff (`git diff --name-only 94e19be8d HEAD` 결과, `package.json` 부재 확인)

- **[INFO]** 신규 내부 공유 상수 모듈 도입 — `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts` 가 새로 생겼고, `dto/chat-channel-config.dto.ts` 와 `triggers.service.ts` 두 곳(+ 두 spec 파일)이 이를 소비한다. 두 층(class-validator 파이프 / 서비스 가드)이 같은 필드를 다른 형태로 거부할 때 문면이 갈리는 것을 막기 위한 것으로, 파일 상단 주석에 SoT(`spec/5-system/15-chat-channel.md` R-CC-21)와 두 층 각각의 등가성 테스트 위치를 명시해 뒀다. 내부 의존 관계가 단방향(dto/service → const)이고 순환 위험은 없다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts` (신규 파일 전체) · `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:20` (import 추가) · `triggers.service.ts` (`import { CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES } from './chat-channel-rejection-messages.const';`)

- **[INFO]** `triggers.service.ts` 의 새 cross-layer import — `import { ErrorCode } from '../../nodes/core/error-codes';` 가 추가되어 `modules/triggers` 가 `nodes/core` 를 참조한다. `grep -rn "nodes/core/error-codes" codebase/backend/src` 로 확인한 결과 `modules/websocket`, `modules/execution-engine`(3곳), `modules/external-interaction`, `modules/executions`(2곳) 등 이미 10곳 가까이 동일 방향의 import 선례가 있어, 이번 추가는 새로운 레이어링 위반이 아니라 기존 패턴을 따른 것이다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` import 구역 (`ErrorCode` 추가)

- **[INFO]** `common/utils/password.util.ts` 는 같은 값(`'INVALID_FIELD'`)을 canonical `ErrorCode.INVALID_FIELD` import 없이 리터럴로 유지한다 — 코드 주석이 "`common/` 이 `nodes/` 를 import 하는 선례가 0건"이라는 실측 근거로 이를 의도적 선택이라 밝히고, 상수를 `common/` 으로 승격하는 별개 트래커 항목을 남겨 뒀다. 레이어링 방향(하위 계층 `common/` 이 상위 도메인 계층 `nodes/` 를 참조하지 않음)은 올바른 판단이다. 다만 의존성 관점에서 남는 잔여 리스크 하나는 짚어 둔다 — 동일 문자열 값이 `nodes/core/error-codes.ts` 의 enum 과 `password.util.ts` 의 리터럴 두 곳에 독립적으로 존재하므로, 훗날 `ErrorCode.INVALID_FIELD` 값이 바뀌면(예: 값 명칭 변경) `password.util.ts` 쪽은 아무 컴파일 에러 없이 조용히 drift 한다. 이미 문서화되고 트래킹되는 기술부채이므로 이번 PR 의 결함은 아니며 재작업을 요구하지 않는다.
  - 위치: `codebase/backend/src/common/utils/password.util.ts` (validatePasswordStrength 함수 상단 주석 블록, `code: 'INVALID_FIELD'` 리터럴 2곳)

## 요약

이번 변경 셋(`chatChannel` PATCH 거부 사유 기계가독화 + botToken 빈 값 차단)은 순수 애플리케이션 로직·테스트·문서 변경으로, 어떤 `package.json`/lockfile 도 건드리지 않아 신규 외부 의존성·버전 고정·라이선스·취약점·번들 크기 항목은 전부 해당 없음이다. 유일하게 의존성 관점에서 볼 거리는 내부 모듈 의존 관계인데, 신규 공유 상수 모듈(`chat-channel-rejection-messages.const.ts`)은 단방향·문서화가 잘 되어 있고, `triggers.service.ts` 의 `ErrorCode` cross-layer import 는 기존 10곳 선례와 일치해 새로운 위반이 아니다. `common/utils/password.util.ts` 가 canonical enum 대신 리터럴을 유지하는 것도 레이어링 방향상 올바른 의도적 선택이며 이미 트래킹되고 있다. 전반적으로 의존성 리스크는 낮다.

## 위험도

NONE
