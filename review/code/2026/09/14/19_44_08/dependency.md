# 의존성(Dependency) 리뷰 — trigger-config-lost-update (2026-09-14 19:44 라운드)

## 검토 범위

`git diff origin/main...HEAD --stat`(codebase 한정) 및 `--stat -- '*.json' '**/package.json'` 로
변경 파일 전수를 확인했다. `package.json`/lockfile 변경은 **이번 라운드도 0건**이다.

이번 라운드는 이전 리뷰(`review/code/2026/09/14/18_17_44/dependency.md`)가 검토한
`567c82edb`(창 2·3·4 lost-update 수정) 이후, 같은 브랜치에 세 커밋이 더 쌓인 상태를 본다:

- `30301008c` test(triggers): 캐너리 하드닝 4건
- `12ed21ff1` fix(triggers): 창 1 도 닫는다 (+ 수정을 지키는 테스트)
- `c7a9c107e` fix(triggers): 1라운드 수정이 만든 새 lost update + 웹훅 hot path 의 같은 fail-open

추가/변경된 codebase 파일 14개(`chat-channel-binder.service.ts`, 신규
`trigger-config-lock.ts`/`trigger-config-lock.spec.ts`, 신규
`__test-utils__/trigger-transaction-mock.ts`, `triggers.service.ts`/`.spec.ts`,
`triggers.web-chat.spec.ts`, `hooks.service.ts`/`.spec.ts`, `chat-channel-input-rules.ts`,
`endpoint-path-conflict-wrap-guard.ts`/`.spec.ts`, `endpoint-path-save.fixture.ts`, 신규
e2e `trigger-config-lost-update.e2e-spec.ts`)에서 추가된 import 문 전량을 grep 했다.

## 발견사항

- **[INFO]** 새 외부 패키지 추가 없음 — 이번 라운드도 전량 기존 의존성/내부 모듈 재사용
  - 위치: 위 14개 파일 전체 (`git diff origin/main...HEAD -- codebase/ | grep -E '^\+.*(import |require\()'`)
  - 상세: 추가된 import 는 `typeorm`(`EntityManager`, 및 기존에 이미 지적된 서브패스
    `typeorm/query-builder/QueryPartialEntity`), `pg`(`Client`), `supertest`, `@jest/globals`,
    `node:crypto` 뿐이며 전부 `codebase/backend/package.json` 에 이미 선언된 dependency/devDependency다
    (`pg ^8.20.0`, `typeorm ^0.3.31`, `supertest ^7.0.0`, `@jest/globals ^30.0.0` — 직접 확인).
    나머지는 전부 프로젝트 내부 모듈(`./trigger-config-lock`, `./__test-utils__/trigger-transaction-mock`,
    `./entities/trigger.entity`, `../secret-store/secret-ref`, `./helpers/db`, `./helpers/auth`)이다.
    버전 고정·라이선스·취약점·번들 크기·호환성 항목은 모두 **해당 없음**(새 의존성이 없으므로).
  - 제안: 없음.

- **[INFO]** 신규 내부 테스트 유틸 `__test-utils__/trigger-transaction-mock.ts` — 의존 방향 단방향, 순환 없음
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts`
    ← import from `triggers.service.spec.ts`, `triggers.web-chat.spec.ts`
  - 상세: 순수 테스트 헬퍼(`typeorm` type-only import 외 프로덕션 코드 의존 없음)이고, 6개
    스펙 파일에 흩어져 있던 `manager.transaction` mock 배선을 한 곳으로 모으는 용도다.
    프로덕션 모듈(`triggers.service.ts`)이 이 테스트 유틸을 참조하는 역방향은 없다.
  - 제안: 없음.

- **[INFO]** `trigger-config-lock.ts` 의존 그래프는 이전 라운드에서 이미 확인한 것과 동일 — 변경 없음
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts`
  - 상세: 이번 라운드에서 이 파일 자체의 import 구성(`typeorm`, `Trigger` 엔티티)은 바뀌지 않았다.
    `typeorm/query-builder/QueryPartialEntity` 비공개 서브패스 재사용에 대한 지적은
    `review/code/2026/09/14/18_17_44/dependency.md` INFO 항목으로 이미 등재돼 있어 중복 기재하지 않는다.
  - 제안: 없음(기존 등재로 충분).

- **[INFO]** `endpoint-path-conflict-wrap-guard.ts`(repo-guard, 정적 분석 스크립트) 변경은 TypeScript
  compiler API(`ts.isFunctionLike`, `ts.isCallExpression` 등) 사용 확장뿐 — 신규 의존성 없음
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts`
  - 상세: `typescript` 패키지는 기존에 이미 이 가드가 사용 중이던 의존성이며, 이번 변경은 그
    API 사용 범위(콜백 경계까지 타고 오르는 조건)만 넓힌 것으로 import 목록에 변화가 없다.
  - 제안: 없음.

## 요약

이번 라운드(3개 커밋, codebase 14개 파일)도 `package.json`/lockfile 변경이 0건이며, 새로
도입된 import 는 전부 기존 dependency(`typeorm`, `pg`, `supertest`, `@jest/globals`,
`node:crypto`)이거나 프로젝트 내부 모듈(신규 `trigger-config-lock.ts` 자체는 이전 라운드에
이미 리뷰됨, 신규 테스트 전용 `__test-utils__/trigger-transaction-mock.ts`)이다. 외부 패키지
추가·버전 변경·라이선스 이슈·알려진 취약점·번들 크기 영향이 없으며, 신규 테스트 유틸의
의존 방향도 단방향(테스트 → 프로덕션 아님)이라 순환 참조 위험이 없다. 의존성 관점에서는
조치가 필요한 항목이 없다.

## 위험도

NONE
