# 의존성(Dependency) 리뷰 — impl-chat-channel-binder

## 검토 범위

리뷰 대상 11개 파일 중 실제 코드 변경은 2개뿐이다 (나머지는 `plan/`·`review/consistency/**` 산출물로 의존성 관점의 대상이 아니다):

- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (신규, 318줄) — `TriggersService` 의 private 메서드 6개를 module-level 순수 함수로 추출
- `codebase/backend/src/modules/triggers/triggers.service.ts` — 위 6개 메서드 정의 삭제, import 로 대체 호출

`package.json`·lockfile 변경은 diff 에 없음(grep 0건 확인).

## 발견사항

- **[INFO] 새 외부 의존성 없음 — 순수 내부 이동**
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:1-13` (import 블록)
  - 상세: 신규 파일이 import 하는 5개 모듈은 전부 기존 의존성이다 — `@nestjs/common`(기존 프레임워크), `../../nodes/core/error-codes`·`./chat-channel-rejection-messages.const`·`./dto/chat-channel-config.dto`·`./entities/trigger.entity`(모두 backend 내부 모듈), `@workflow/chat-channel-validation`(워크스페이스 내부 패키지, `package.json:55`에 `"workspace:*"`로 이미 고정돼 있고 이 PR 이전부터 `triggers.service.ts`가 직접 import 하던 것을 그대로 옮긴 것 — `git log`상 신규 추가 아님). `package.json`/lockfile diff 는 0건이다.
  - 제안: 없음(문제 아님, 확인 기록).

- **[INFO] 내부 모듈 의존 방향 — 단방향, 순환 없음**
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` 전체 / `codebase/backend/src/modules/triggers/triggers.service.ts:47`
  - 상세: `triggers.service.ts` → `./chat-channel-input-rules` 단방향 import만 존재하고, 역방향(신규 파일이 `triggers.service.ts`를 import)은 없다. plan 문서(`plan/in-progress/impl-chat-channel-binder.md` "방향이 실측으로 뒤집혀 있다" 절)가 밝히듯 이 PR 은 원래 지적(`chat-channel/` 모듈로 이동)을 그대로 따르지 않고 `triggers/` 내부에 남기기로 했는데, 그 근거가 `#676`(`e827ed2a7`)이 끊은 `chat-channel↔triggers` 순환 재발 방지이며 실제로 두 모듈에 잔존 `forwardRef` 0건임을 실측으로 확인했다고 기록돼 있다. `triggers.service.ts` 실제 import 목록(`../chat-channel/channel-adapter.registry` 등, 40번대 줄)도 여전히 `chat-channel/`을 정방향으로만 참조하며 역방향 참조는 보이지 않는다. 새 파일도 `chat-channel/` 하위 모듈을 import 하지 않으므로 이 결정과 일치한다.
  - 제안: 없음(설계가 순환 회피 근거를 갖추고 있음을 확인).

- **[INFO] 번들 크기·빌드 시간 영향 — 무시할 수준**
  - 위치: 파일 1·2 전체
  - 상세: 신규 파일 318줄은 `triggers.service.ts`에서 그대로 삭제된 동일 로직(주석 포함)이라 순수 이동이며 순 코드량 증가가 사실상 없다(신규 export type 2개·오버로드 시그니처 추가 정도). 새 런타임 의존성이 없으므로 번들 크기·빌드 시간에 미치는 영향은 없다.
  - 제안: 없음.

## 요약

이 PR 은 `TriggersService` 의 chat-channel 검증 로직 6개 메서드를 같은 패키지(`triggers/`) 안의 module-level 순수 함수 파일로 옮기는 **순수 내부 리팩터**로, 새 외부 패키지 추가·버전 변경·`package.json`/lockfile 수정이 전혀 없다. 유일하게 재사용되는 워크스페이스 패키지(`@workflow/chat-channel-validation`)는 이미 `workspace:*`로 고정돼 있던 기존 의존성을 새 위치에서 import 할 뿐이며, 내부 모듈 의존 방향도 단방향(`triggers.service.ts → chat-channel-input-rules.ts`)이라 과거 `#676`에서 해소한 `chat-channel↔triggers` 순환을 재도입하지 않는다. 의존성 관점에서 리스크는 발견되지 않았다.

## 위험도
NONE
