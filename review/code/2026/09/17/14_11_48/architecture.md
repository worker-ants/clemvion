# 아키텍처(Architecture) 리뷰 — `trigger-save-partial-patch`

## 범위 요약

핵심 변경은 `codebase/backend/src/modules/triggers/triggers.service.ts` 의 `TriggersService.update()`
— advisory lock 안에서 재읽은 `Trigger` 엔티티를 통째로 `save` 하던 것을, 이 요청이 바꾸는 필드 +
`config` 만 담은 부분 객체로 좁혔다. 나머지(`trigger-transaction-mock.ts`·`triggers.service.spec.ts`·
신규 e2e `trigger-update-save-window.e2e-spec.ts`·`jest.config.ts`·`CHANGELOG.md`·plan)는 이 수정을
검증·문서화하는 테스트/기록물이고, `review/code/2026/09/17/13_44_39/**`·
`review/consistency/2026/09/17/13_04_39/**` 는 직전 라운드의 리뷰 산출물(재작성 아님, 그대로 커밋된
기록)이라 아키텍처 관점의 코드 변경 대상이 아니다.

새 모듈·새 서비스·새 패키지 경계는 생기지 않았다. 변경은 `triggers` 모듈 내부에 국한되고, 순환
의존이나 모듈 경계 침범은 관찰되지 않았다.

## 발견사항

- **[INFO]** `TriggersService.update()` 가 이미 컸던 단일 메서드에 책임을 계속 더 얹는다 (SRP)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — 함수 `TriggersService.update()`
    (551~769행, 약 218줄). 이번 PR 이 늘린 자리는 680~717행(저장 payload 구성 + 응답 재구성).
  - 상세: 이 메서드는 (1) schedule 타입 필드 화이트리스트 검증, (2) 알림 URL·chatChannel 입력 안전성
    검사, (3) `inboundSigningRef` 보존을 위한 사전 추출, (4) authConfig 소속 검증, (5) config 병합
    (순수 도메인 로직), (6) advisory lock 획득과 재읽기, (7) TypeORM `save()` 의 컬럼-diff 내부 동작을
    전제로 한 저장 대상 구성, (8) 감사 로그 기록, (9) schedule 역동기화, (10) secret 정규화, (11)
    chatChannel setup 오케스트레이션까지 11개의 서로 다른 관심사를 한 함수 안에서 순차 실행한다.
    이번 PR 은 (7)·저장-응답 대칭성 설명에 주석 28줄 + 코드 8줄을 추가해 이 메서드를 더 길게 만들었다
    — 새 책임을 추가한 것은 아니지만 기존 책임(영속화 세부사항 서술)의 밀도를 높였다.
    직전 라운드 리뷰(`review/code/2026/09/17/13_44_39/maintainability.md` INFO#2)가 이미 같은 소견을
    "이번 PR 스코프 아님"으로 기록했고, `update` + 재조회로 분리를 시도했다가 반환 엔티티·subscriber·
    `endpointPath` UNIQUE 충돌 경로가 함께 달라져 단위 6건이 RED 였던 이력(같은 파일 625~627행 주석)이
    있어 무분별한 분해가 새 결함을 낼 수 있다는 근거도 코드에 남아 있다. 그래서 이번 라운드에서
    당장 쪼개라는 요구는 아니다 — 다만 매 PR 이 이 메서드에 책임을 얹는 추세 자체가 응집도를
    떨어뜨리는 방향이라는 점은 아키텍처 관점에서 계속 기록해 둘 가치가 있다.
  - 제안: 여유가 있을 때 저장 payload 조립(`buildTriggerUpdatePatch`)과 응답 재구성
    (`applyWrittenTimestamp`)을 이름 있는 private 헬퍼로 분리 — 이번 PR 범위 밖.

- **[INFO]** 서비스 계층이 TypeORM `save()` 의 컬럼-diff 내부 동작에 직접 의존한다 (레이어 경계·DIP)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:680`~`711` (특히 `711`행
    `const written = await m.save(Trigger, { id: target.id, ...patch });`)
  - 상세: `TriggersService` 는 `Repository<Trigger>` 를 감싸는 도메인 인터페이스가 아니라
    `this.triggerRepository.manager.transaction(...)` 을 통해 TypeORM `EntityManager` 를 직접
    조작한다(이 파일은 이미 `Repository`·`In` 을 최상단에서 import 하는 기존 스타일). 이번 PR 이 고친
    핵심 근거 — "`save()` 는 저장 시점 DB 값과 엔티티가 **다른 컬럼만** UPDATE 한다" — 는 TypeORM 이
    공식 API 계약으로 문서화한 동작이 아니라 구현 세부사항인데, 그 지식이 서비스 메서드 안에
    30줄 넘는 주석으로 그대로 노출돼 있다. 비즈니스 로직(어떤 필드를 병합할지)과 영속화 메커니즘
    지식(어떻게 저장해야 인접 컬럼을 안 건드리는지)이 같은 스코프에 뒤섞여, 이 지식을 다시 써야
    하는 다음 서비스(예: 다른 엔티티의 부분 PATCH)가 이 자리를 복붙하거나 재발견해야 한다.
    (`database.md` INFO 가 같은 의존을 "TypeORM 버전 업그레이드 시 우선 확인 대상"으로 이미 지적했다
    — 여기서는 그 지적을 레이어 책임 관점으로 재구성한다.)
  - 제안: 급하지 않음. 이런 패턴이 두 번째 호출부에 생기면(현재는 이 파일 안에 이 한 곳뿐 —
    `grep` 확인) `TriggerRepository.savePartial(id, patch): Promise<{ id: string; updatedAt: Date }>`
    같은 이름 있는 저장소 메서드로 승격해 ORM 세부지식을 한 곳에 가두는 편이 재사용·재검증에 유리하다.

- **[INFO]** `m.save()` 의 타입 시그니처가 부분 객체를 넘겼을 때의 실제 런타임 모양과 어긋난다
  (추상화 충실도)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:711`, `713`~`716`
    (`if (written.updatedAt) target.updatedAt = written.updatedAt;`)
  - 상세: `EntityManager.save<Entity>(target, partial)` 의 타입은 `Promise<Entity>` 로, 넘기지 않은
    컬럼도 채워진 완전한 엔티티를 돌려준다고 **타입 수준에서 약속**한다. 그런데 실측(CHANGELOG·plan
    "내가 틀린 측정" 절, e2e ②c)이 보여주듯 부분 객체를 넘기면 실제로는 넘기지 않은 nullable
    컬럼이 전부 `null` 로 채워진 객체가 온다 — 타입이 보장하는 모양과 런타임 모양이 다르다. 이 PR
    자체가 그 간극 때문에 회귀(반환값을 통째로 덮어 `endpointPath` 를 지운 것)를 냈다가 e2e 로 잡아
    고쳤다. 지금은 `written.updatedAt` 하나만 꺼내 쓰고 `if` 로 방어해 안전하지만, 이 타입-런타임
    불일치 자체는 라이브러리 API 설계의 일반적인 함정이라 이 호출부에 국한되지 않는다 — 코드베이스
    전체에서 부분 객체를 `save()` 에 넘기는 두 번째 호출부가 생기면 같은 종류의 "타입을 믿었다가
    당하는" 결함이 재발할 수 있는 구조적 위험이다(`grep` 으로 이 모듈 안엔 현재 이 한 곳뿐임을
    확인했다 — 지금 당장 재발 지점은 없다).
  - 제안: 조치 불요(현재 유일한 호출부이고 이미 방어·테스트됨). 다만 이 함정을 팀 지식으로 남기려면
    `save()` 를 부분 객체로 호출하는 새 코드가 생길 때 이 파일의 주석(698~709행)을 참조하도록
    코드 리뷰 체크리스트나 `spec/conventions/` 에 한 줄 남기는 것을 고려할 수 있다(이번 PR 스코프 밖).

- **[INFO]** 신규 e2e 스펙의 DB 연결 설정이 기존 헬퍼와 별도로 동일한 하드코딩 폴백 값을 중복 정의한다 (DRY)
  - 위치: `codebase/backend/test/trigger-update-save-window.e2e-spec.ts:77`~`87` (`new DataSource({...})`)
    vs `codebase/backend/test/helpers/db.ts` `createDbClient()` (host/port/username/password/database
    폴백)
  - 상세: 이 파일은 `createDbClient()` 로 `pg.Client` 를 얻으면서(10행), 같은 접속 정보(host `postgres`,
    port `5432`, user `clemvion`, password `clemvion-e2e`, database `clemvion_e2e`)를 TypeORM
    `DataSource` 생성자에 **다시 하드코딩**한다(`entities: [...ROOT_ENTITIES]` 로 `app.module.ts` 와
    같은 엔티티 집합은 재사용하지만 접속 파라미터는 안 한다). 이 값이 다른 e2e 스펙에는 없던 새
    조합이라, 향후 e2e DB 접속 정보가 바뀌면(`docker-compose.e2e.yml` 갱신 등) 두 곳 중 한 곳만
    고칠 위험이 생긴다. 테스트 전용 스코프라 blast radius 는 작다.
  - 제안: `test/helpers/db.ts` 에 `createTypeOrmDataSource(entities)` 같은 헬퍼를 추가해 접속 파라미터를
    한 곳에서 공유하는 것을 고려(낮은 우선순위, 이번 PR 을 막을 사유 아님).

- **[POSITIVE/INFO]** 공유 트랜잭션 mock 을 한 곳에 두는 설계는 유지
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts`
  - 상세: `save` mock 을 동기 → 비동기로 바꾸고 반환값 폴백(`result ?? target`)을 추가한 변경은
    `triggers` 모듈 전체 스펙이 공유하는 단일 테스트 더블에 집중돼 있다 — 각 스펙 파일이 개별적으로
    `save` mock 을 흉내내지 않고 이 파일에 위임하는 구조는 응집도가 높고, 실제 TypeORM 이 항상
    객체를 반환한다는 계약을 한 곳에서만 흉내내면 되므로 향후 유사한 반환값 오해가 반복될 여지를
    줄인다. 60개 케이스가 이 위임에 의존한다는 실측(파일 자체 JSDoc)이 이 집중이 장식이 아님을
    보여준다.
  - 제안: 없음 — 확인용 긍정 항목.

## 검증하지 않은 것

- `mergeExternalConfig`/`stripInlineAuthKeys`/`mergeIntoFreshSubKey` 등 config 병합 로직 자체의
  아키텍처(순수성·책임 분리)는 diff 의 직접 변경 대상이 아니라 상세 대조하지 않았다.
- 저장소 트리 뮤테이션 검증(뮤턴트 적용 등)은 수행하지 않았다 — 코드 대조와 정적 분석(grep)만으로
  이번 diff 범위의 아키텍처 판단에 충분했다. `git status --short` 로 확인한 결과 이 리뷰 과정에서
  저장소 파일을 하나도 건드리지 않았다(원복 불필요).

## 요약

이 PR 은 잘 정의된 단일 원인(TypeORM `save()` 의 컬럼-diff 동작으로 인한 락 밖 컬럼 lost-update)을
저장 대상 축소라는 최소 침습적 방법으로 고친 국소 수정이며, 새 모듈 경계나 순환 의존을 만들지 않고
기존 `triggers` 모듈 안에 깔끔히 담겨 있다. 다만 이 수정이 놓인 `TriggersService.update()` 자체는
이미 11개 관심사가 뒤섞인 대형 메서드이고, 이번 PR 이 그 위에 영속화 계층의 내부 동작 지식(ORM
diff 세부사항·타입과 다른 반환 모양)을 서비스 계층에 더 깊이 새겨 넣어 레이어 책임 분리를 조금 더
흐리게 했다 — 다만 이는 기존에 확립된(그리고 팀이 명시적으로 재확인한, 분해 시도가 과거에 깨진
이력이 있는) 스타일의 연장이라 이번 라운드를 막을 사유는 아니다. 신규 e2e 스펙의 DB 접속 설정 중복은
테스트 스코프의 경미한 DRY 위반이다. 새로 발견된 CRITICAL/WARNING 급 구조적 결함은 없다.

## 위험도
LOW
