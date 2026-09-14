# 의존성(Dependency) 리뷰

## 검증 방법

- `git diff origin/main...HEAD --name-only` 로 변경 파일 전수(16개 codebase 파일 + CHANGELOG.md +
  plan + 5라운드 분량의 이전 review 산출물)를 확인했다.
- `git diff origin/main...HEAD --stat -- '**/package.json' '**/package-lock.json' '**/pnpm-lock.yaml' '**/yarn.lock'`
  는 **빈 출력** — 매니페스트·락파일 변경 0건.
- 변경된 8개 backend 소스/테스트 파일(`hooks.service.ts`, `hooks.service.spec.ts`,
  `trigger-transaction-mock.ts`, `chat-channel-binder.service.ts`, `chat-channel-input-rules.ts`,
  `trigger-config-lock.ts`, `triggers.service.ts`, `trigger-config-lost-update.e2e-spec.ts`)의
  `import` 문을 전수 grep 해 새로 등장한 식별자를 `codebase/backend/package.json` 과 대조했다.
- 리뷰 종료 직전 `git status --short` 로 작업 트리를 재확인했다(아래 이상 상태 참고).

## ⚠️ 관측한 이상 상태 — 내가 만들지 않은 작업 트리 뮤테이션

리뷰를 마치기 직전 `git status --short` 를 돌린 결과, **내가 저지르지 않은** 미커밋 변경이
`codebase/backend/src/modules/triggers/triggers.service.ts` 에 남아 있었다:

```diff
-        throw err;
+        // MUTANT: swallow
```

- 이 리뷰 세션은 저장소 트리에 어떤 파일도 write/edit 하지 않았다(Read/Bash 로만 조사).
- 이 한 줄은 다른 병렬 reviewer 가 뮤테이션 테스트(예: 에러 swallow 여부를 검증하는 뮤턴트)를
  넣어 두고 아직 원복하지 못한 것으로 보인다 — 이 세션이 만든 것이 아니므로 **원복하지 않았다**
  (`git checkout`/`git restore` 는 금지 규약이고, 남의 미커밋 작업을 지울 위험이 있어 손대지
  않는 편이 안전하다고 판단했다).
- 이 변경은 의존성 리뷰의 점검 관점(신규 패키지·버전·라이선스·취약점 등)과는 무관하지만,
  "관측한 이상 상태는 그대로 보고하라" 는 지시에 따라 기록한다. 다음 사람이 이 잔여물을
  진짜 결함으로 오인해 조사하지 않도록, 통합 SUMMARY 작성자는 이 뮤테이션이 원복됐는지
  머지 직전에 재확인해야 한다.

## 발견사항

- **[INFO]** 새 외부 패키지 없음 — 관측한 import 는 전부 기존 선언 의존성 또는 내부 모듈
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts`,
    `codebase/backend/src/modules/triggers/triggers.service.ts`,
    `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`,
    `codebase/backend/src/modules/triggers/trigger-config-lock.ts`,
    `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts`
  - 상세: 이번 변경에서 새로 쓰인 외부 패키지는 `typeorm`(`EntityManager`,
    `QueryDeepPartialEntity`), `pg`(`Client`), `@jest/globals`, `supertest`, `node:crypto` 뿐이며
    전부 `codebase/backend/package.json` 에 caret(`^`) 로 이미 고정돼 있다
    (`pg: ^8.20.0`, `typeorm: ^0.3.31`, `@jest/globals: ^30.0.0`, `supertest: ^7.0.0`,
    `typescript: ^5.7.3`). e2e 스펙이 쓰는 `Client`(`pg`)·`crypto`(Node 내장)도 기존 e2e 스위트가
    이미 쓰던 패턴과 동일하다. 새로 export 된 항목(`extractInboundSigningRef`,
    `touchLastTriggeredAt`, `withTransactionMock`, `TRIGGER_ENTITY`)은 모두 프로젝트 **내부**
    함수/상수이지 외부 의존성이 아니다.
  - 제안: 없음 (조치 불필요).

- **[INFO]** 내부 의존 방향 — `trigger-config-lock.ts` 는 leaf 모듈, 순환 없음
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts`,
    `codebase/backend/src/modules/triggers/triggers.service.ts:26`,
    `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:6`
  - 상세: `trigger-config-lock.ts` 는 `typeorm`(`EntityManager`, `QueryDeepPartialEntity`)과
    `./entities/trigger.entity` 만 import 하는 leaf 모듈이고, `triggers.service.ts` ·
    `chat-channel-binder.service.ts` 두 곳이 이를 소비한다. 역방향 import 는 없다(grep 확인).
    `extractInboundSigningRef` 는 이번 라운드에서 `chat-channel-input-rules.ts`(순수 함수 모듈,
    Nest DI 없음)로 신설돼 같은 두 소비자(`triggers.service.ts`,
    `chat-channel-binder.service.ts`)가 인라인 캐스트 3중 복제를 단일 함수로 대체한 것으로,
    의존 그래프에 새 엣지가 추가되긴 하나 방향이 기존 계층(leaf 유틸 → 서비스)과 일치해
    순환 위험은 없다.
  - 제안: 없음.

- **[INFO]** `__test-utils__/trigger-transaction-mock.ts` 는 신규 공유 테스트 인프라, 순수 내부
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts`
  - 상세: 새 파일이지만 외부 의존성이 없고(`jest` 전역만 사용, import 문 자체가 없음),
    `triggers.service.spec.ts` · `triggers.web-chat.spec.ts` 두 스펙 파일이 지역 헬퍼 중복을
    피하려 공용 자리로 승격한 것이다. 파일 JSDoc 이 "6개 파일 중 2개만 이관했다" 고 스스로
    범위를 명시하고 있어 — 이관되지 않은 나머지 4개(`auth-configs`·`external-interaction`·
    `hooks`·`schedules`)가 향후 `TriggersService` 트랜잭션 경로를 타게 되면 같은 헬퍼를 가져다
    써야 한다는 의존성 확장 여지가 문서화돼 있다. 의존성 관점에서 현재 결함은 아니다.
  - 제안: 없음 — 이후 4개 스펙이 트랜잭션 경로를 타게 될 때 이 파일을 재사용할 것.

## 요약

이번 변경(lost-update 수정 5개 커밋)은 신규 외부 패키지·버전 변경·라이선스 이슈가 전혀 없는 순수
내부 리팩터링 + 테스트 보강이다. `package.json`/lockfile diff 는 0건이며, 새로 등장하는 import 는
전부 이미 선언된 의존성(`typeorm`, `pg`, `@jest/globals`, `supertest`, Node 내장 `crypto`) 또는
프로젝트 내부 모듈이다. 내부 의존 그래프는 `trigger-config-lock.ts`(leaf) → `triggers.service.ts`/
`chat-channel-binder.service.ts`, `chat-channel-input-rules.ts`(leaf, 순수 함수) → 동일 두 소비자
방향으로 기존 계층과 일치하며 순환 참조 위험이 없다. 신규 테스트 유틸(`trigger-transaction-mock.ts`)
도 외부 의존성 없는 순수 내부 인프라다. 다만 리뷰 종료 시점에 `triggers.service.ts` 에서 이 세션이
만들지 않은 미커밋 뮤테이션(`throw err;` → `// MUTANT: swallow`)을 발견했다 — 병렬 reviewer 의
잔여물로 추정되며 의도적으로 원복하지 않았으니, 머지 전 재확인이 필요하다. 의존성 관점 자체로는
조치가 필요한 항목이 없다.

## 위험도

NONE (단, 위 "관측한 이상 상태" — 작업 트리에 남은 타 세션의 미커밋 뮤테이션 — 는 머지 전 별도
확인 필요)
