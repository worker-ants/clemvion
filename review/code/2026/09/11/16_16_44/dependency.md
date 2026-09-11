# 의존성(Dependency) 리뷰 — impl-chat-channel-binder (누적 diff, 2ae81077c..81d2a8c18)

## 검토 범위 및 방법

`origin/main` 대비 누적 diff (`2ae81077c` T1 이동 → `6dc2b7d60` 등재 정정+전용 spec → `81d2a8c18`
뮤테이션 커버리지 보강) 를 대상으로 했다. 저장소 트리에는 아무것도 쓰지 않고 읽기 전용 명령만
사용했다(`git diff`/`git show`/`grep`) — `git status --short` 로 잔여물 없음 확인.

코드 변경은 3개 파일뿐이다:

- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (신규, 324줄)
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts` (신규, 268줄)
- `codebase/backend/src/modules/triggers/triggers.service.ts` (수정 — 위 로직 삭제 + import 대체)

나머지(`plan/in-progress/*.md`, `review/consistency/**`)는 문서/산출물로 의존성 관점 대상이 아니다.

- `git diff origin/main --stat -- '**/package.json' '**/pnpm-lock.yaml'` → **0건**. `package.json`/lockfile 변경 없음.
- 세 커밋 전체(`git show <sha> -- ...`)를 개별 확인: `chat-channel-input-rules.ts`(신규) import 블록,
  `triggers.service.ts` import 교체분, `chat-channel-input-rules.spec.ts`(신규 + `81d2a8c18` 의 99줄
  테스트 추가분) 모두 **신규 외부 패키지 import 가 없다.**

## 발견사항

- **[INFO] 새 외부 의존성 없음 — 순수 내부 이동 + 테스트 보강**
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:1-13` (import 블록) ·
    `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts:1-11` (import 블록)
  - 상세: 신규 파일이 import 하는 모듈은 전부 기존 의존성이다 — `@nestjs/common`(기존
    프레임워크), `../../nodes/core/error-codes` · `./chat-channel-rejection-messages.const` ·
    `./dto/chat-channel-config.dto` · `./entities/trigger.entity`(backend 내부 모듈),
    `@workflow/chat-channel-validation`(워크스페이스 패키지, `workspace:*` 로 이미 고정 —
    `triggers.service.ts` 가 이전부터 직접 import 하던 것을 그대로 옮긴 것). 신규 테스트 파일도
    `@nestjs/common`(`BadRequestException`)과 위 이동 대상 함수들만 import 하며, jest 는 기존
    테스트 인프라를 그대로 재사용한다(`it.each` 도 기존 jest API, 신규 테스트 라이브러리 없음).
    세 커밋 전체를 통틀어 `package.json`/lockfile diff 는 0건이다.
  - 제안: 없음(문제 아님, 확인 기록).

- **[INFO] 내부 모듈 의존 방향 — 단방향 유지, 순환 재도입 없음**
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` 전체 /
    `codebase/backend/src/modules/triggers/triggers.service.ts` (import 블록, `./chat-channel-input-rules` 추가분)
  - 상세: `triggers.service.ts → ./chat-channel-input-rules` 단방향 import 만 존재하고 역방향은
    없다. 신규 파일은 `chat-channel/` 하위 모듈을 import 하지 않아, plan 문서가 근거로 든 과거
    `#676` 순환(`chat-channel ↔ triggers`) 재발 우려와 무관하다. `triggers.service.ts` 의 다른
    import(`../chat-channel/channel-adapter.registry` 등)도 여전히 정방향뿐이다.
  - 제안: 없음(설계 확인).

- **[INFO] 번들 크기·빌드 시간 영향 — 무시할 수준**
  - 위치: 세 파일 전체
  - 상세: 신규 파일 2개(324+268줄)는 `triggers.service.ts` 에서 삭제된 동일 로직의 이동 및
    이를 검증하는 전용 테스트 추가이며, 새 런타임 의존성이 없다. `81d2a8c18` 에서 추가된 99줄도
    같은 파일 내 테스트 케이스 확장(교차-provider 뮤테이션 킬 케이스)일 뿐 신규 import 는 없다.
    빌드 시간·번들 크기에 유의미한 영향 없음.
  - 제안: 없음.

- **[INFO] 라이선스·취약점·호환성 — 해당 없음**
  - 상세: 새로 추가되거나 버전이 바뀐 외부 패키지가 없으므로 라이선스 호환성(관점 3), 알려진
    취약점(관점 4), 버전 충돌(관점 7) 점검 대상 자체가 없다. `@workflow/chat-channel-validation`
    은 기존 workspace 패키지의 재사용일 뿐 버전/라이선스 변경이 없다.
  - 제안: 없음.

## 요약

이번 누적 diff(`2ae81077c`→`6dc2b7d60`→`81d2a8c18`)는 `TriggersService` 의 chat-channel 검증
로직 6개 함수를 같은 패키지(`triggers/`) 안의 module-level 순수 함수 파일로 옮기고, 그에 대한
전용 단위 테스트(뮤테이션 스왑 대응 교차-provider 케이스 포함)를 추가한 **순수 내부 리팩터 +
테스트 보강**이다. 세 커밋 전체에 걸쳐 `package.json`/lockfile 변경이 0건이며, 신규 import 는
모두 기존 프레임워크·내부 모듈·이미 고정된 workspace 패키지뿐이다. 내부 모듈 의존 방향도
단방향(`triggers.service.ts → chat-channel-input-rules.ts`)이라 과거 `#676` 순환을 재도입하지
않는다. 의존성 관점에서 이전 라운드(`15_31_54`)의 NONE 판정을 뒤집을 요소가 이번 추가 커밋들에는
없다.

## 위험도

NONE
