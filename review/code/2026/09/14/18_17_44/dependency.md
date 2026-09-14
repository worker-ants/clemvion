# 의존성(Dependency) 리뷰 — trigger-config-lost-update

## 검토 범위

`git diff origin/main...HEAD --name-only` 로 변경 파일 전수를 확인했다. `package.json`/lockfile
변경은 **0건**이다.

- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` (수정)
- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (신규, 내부 모듈)
- `codebase/backend/src/modules/triggers/triggers.service.ts` (수정)
- `codebase/backend/src/modules/triggers/triggers.service.spec.ts` (수정, 테스트만)
- `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts` (신규, e2e 테스트)
- `plan/`, `review/consistency/**` (문서·산출물, 의존성 무관)

## 발견사항

- **[INFO]** 새 외부 패키지 추가 없음 — 전량 기존 의존성 재사용
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:1-4`
  - 상세: 신규 파일이 import 하는 것은 `typeorm`(`EntityManager`, `QueryDeepPartialEntity`)과
    프로젝트 내부 `Trigger` 엔티티뿐이다. `chat-channel-binder.service.ts`/`triggers.service.ts`
    에 추가된 import 도 이 신규 내부 모듈(`rewriteTriggerConfigLocked`) 하나뿐이다. 신규
    e2e 스펙(`trigger-config-lost-update.e2e-spec.ts`)도 `@jest/globals`·`pg`·`node:crypto`·
    `supertest` 등 기존 devDependency 만 사용한다. 버전 고정·라이선스·취약점·번들 크기·호환성
    항목은 모두 **해당 없음**(새 의존성이 없으므로).
  - 제안: 없음.

- **[INFO]** 내부 모듈 의존 그래프 — 단방향, 순환 없음
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (신규) ← import from
    `chat-channel-binder.service.ts:6`, `triggers.service.ts:22`
  - 상세: `trigger-config-lock.ts` 는 `triggers` 모듈 내부(같은 디렉터리)에 신설된 유틸리티로,
    의존 방향은 `chat-channel-binder.service.ts`/`triggers.service.ts` → `trigger-config-lock.ts`
    → `Trigger` 엔티티 뿐이다. 역방향 참조가 없어 순환 의존 위험은 없다. 같은 파일 안에
    advisory lock 사용 선례로 `execution-engine.service.ts` 를 문서화(JSDoc)해 두어 설계
    일관성도 확인된다(코드 의존은 아니고 패턴 참조).
  - 제안: 없음.

- **[INFO]** TypeORM 비공개 서브패스 import 재사용 — 신규 위험 아님(기존 선례 재확인)
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:2`
    (`import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity'`)
  - 상세: 이 서브패스는 `typeorm` 패키지의 공개 배럴(`typeorm` 최상위 export)이 아니라 내부
    경로다. `package.json` 은 `typeorm` 을 `^0.3.31`(caret) 로 고정해 patch/minor 자동 갱신을
    허용하므로, 이론적으로는 그 경로가 옮겨지면 빌드가 깨질 수 있다. 다만 이 패턴은 이번
    PR 이 처음 도입한 것이 아니라 기존 `workflows.service.ts:15`(`nodeRows as
    QueryDeepPartialEntity<Node>[]`)에 이미 존재하는 선례를 그대로 재사용한 것이다(신규
    파일 JSDoc 도 이 선례를 명시). 즉 이 PR 이 신규로 노출 표면을 넓히는 것은 아니고, 기존에
    이미 감수하던 위험을 한 곳 더 반복한 정도다.
  - 제안: 이번 PR 범위에서 조치 불요. 다만 `typeorm` 메이저/마이너 업그레이드 시 이 서브패스
    사용처(`workflows.service.ts`, `trigger-config-lock.ts`) 를 함께 검증 대상으로 추적하면
    좋다(백로그 성격, blocking 아님).

- **[INFO]** 버전 고정·라이선스·취약점·번들 크기 — 변경 없음
  - 위치: 해당 없음 (package.json/lockfile diff 0건)
  - 상세: 이번 변경은 `codebase/backend` 내부 세 파일 수정 + 두 파일 신규(비즈니스 로직 1 +
    e2e 테스트 1)로, 모두 이미 설치된 의존성만 사용한다. 따라서 npm 취약점 스캔 대상 변화,
    라이선스 호환성 재검토 필요, 번들/빌드 시간 영향은 없다.
  - 제안: 없음.

## 요약

이번 변경은 순수 내부 리팩터링(신규 유틸 모듈 `trigger-config-lock.ts` 추가 + 두 호출부 배선 교체 +
테스트)이며, `package.json`/lockfile 변경이 전혀 없다. 새로 import 되는 것은 이미 프로젝트에
존재하는 `typeorm`(및 그 내부 서브패스 `QueryDeepPartialEntity` — 기존 `workflows.service.ts`
선례 재사용)과 신규 내부 모듈뿐이며, 외부 패키지 추가·버전 변경·라이선스 이슈·알려진 취약점·번들
크기 영향은 없다. 내부 모듈 의존 방향도 단방향이라 순환 참조 위험이 없다. 의존성 관점에서는
조치가 필요한 항목이 없다.

## 위험도

NONE
