# 요구사항(Requirement) 충족 리뷰 — 동시 rotate 의 lost update

## 발견사항

- **[INFO]** 락 안 재읽기의 `!fresh` (행이 그 사이 삭제된 경우) 분기가 단위 테스트로 직접 exercised 되지 않는다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1152-1157` (`if (!fresh) { throw new NotFoundException(...) }`)
  - 상세: 이 PR 이 새로 추가한 두 개의 404 분기 중, "저장 뒤 다시 읽었더니 사라짐"(`affected` 는 1인데 이후 `findOne` 이 `null`) 경로는 `integrations.service.spec.ts:1439-1460` (`update 는 1행을 바꿨는데 다시 읽기 전에 지워졌으면 404`) 이 정확히 덮는다. 그러나 "락 안 재읽기 자체가 `null`을 반환"하는 경로(연결 테스트가 도는 동안 다른 요청이 행을 완전히 삭제한 경우)는 어떤 테스트에서도 `findOne` 의 두 번째 호출을 `null` 로 두지 않는다 — 전부 `stale()`/`committedByOther()`/`current` 등 실제 엔티티를 반환한다. 다만 같은 모듈의 선례(`integration-oauth.service.ts` CONC H-3 의 동일 `if (!integration) throw NotFoundException` 분기, `integration-oauth.service.spec.ts` 에도 대응 테스트 없음)도 이 분기를 테스트하지 않으므로, 이 저장소가 이미 받아들인 패턴과 일치한다 — 새로 도입된 결함이라기보다는 기존 관행의 반복이다.
  - 제안: 필수는 아니나, `plan/in-progress/rotate-lost-update.md` 의 "뮤턴트 셋"(옛 base 로 머지 · 락 옵션 제거 · 권한 재확인 제거) 목록에 이 분기를 위한 네 번째 케이스(락 안 재읽기가 `null` 반환 시 404, `update`/`audit`/`broadcast` 미호출)를 추가하면 표면이 완전해진다.

- **[INFO]** 재검증(`freshErrors`) 실패 분기도 단위 테스트가 없다 — 다만 이는 이 PR 이전부터 있던 패턴(원래의 단일 `validateCredentials` 실패 경로도 rotate 테스트에서 한 번도 검증된 적 없음)의 반복이라 회귀는 아니다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1171-1182` (`freshErrors` 체크, `INTEGRATION_INVALID_CREDENTIALS`)
  - 상세: `grep INTEGRATION_INVALID_CREDENTIALS codebase/backend/src/modules/integrations/integrations.service.spec.ts` 결과 0건. 락 안에서 다시 읽은 `fresh.credentials` 위에 `body.credentials` 를 머지한 결과가 구조 검증에 실패하는 시나리오(예: 동시 교체가 필수 동반 필드를 지워 최종 조합이 불완전해지는 경우)는 실제로 구현이 다루고 있지만 어느 테스트도 이 분기를 타지 않는다. 코드 자체는 순수 함수 재사용이라 논리적으로 타당해 보이나, 이 분기를 삭제하거나 뒤집는 뮤턴트가 있어도 현재 테스트 스위트로는 잡히지 않는다.
  - 제안: `fresh` 를 "동시 교체로 인해 병합 시 구조적으로 무효가 되는 credentials" 로 설정해 `INTEGRATION_INVALID_CREDENTIALS` 로 거부되고 `update` 가 호출되지 않음을 확인하는 테스트 한 건 추가를 검토.

- **[INFO]** "테스트한 조합"과 "커밋하는 조합"이 다를 수 있다는 알려진 한계 — 이미 코드 주석과 plan 에 명시적으로 문서화됨, 새 결함 아님
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1143-1145`, `plan/in-progress/rotate-lost-update.md` "남는 것을 정직하게 적는다" 절
  - 상세: 연결 테스트(`dispatchTest`)는 요청 시작 시점 스냅샷(`entity.credentials`) 위의 머지로 돌고, 실제 커밋은 락 안에서 다시 읽은 `fresh.credentials` 위의 머지(`committed`)로 이뤄진다. 두 rotate 가 서로 다른 필드를 바꾸면 최종적으로 커밋되는 조합 자체는 어느 쪽도 연결 테스트를 통과한 적 없는 조합이 될 수 있다. 이는 구현 결함이 아니라 설계상 받아들인 트레이드오프이며(외부 호출을 락 밖에 두기 위한 불가피한 대가), 코드 주석·plan 양쪽에서 이미 정직하게 명시돼 있다. 별도 조치 불필요 — 기록 목적으로만 남긴다.

## Spec Fidelity 점검

- 관련 spec: `spec/2-navigation/4-integration.md` §3 표(298행, "Rotate credentials (비OAuth)"), §9.2 endpoint 표(829행, `POST /api/integrations/:id/rotate`). 두 곳 모두 "내부적으로 테스트 → 성공 시만 커밋", "실패 시 기존 자격 증명 유지" 만 규정하며 동시성·락 메커니즘은 언급하지 않는다.
- 구현은 이 계약을 그대로 유지한다 — 외부에서 관측 가능한 성공/실패 응답(200/에러코드)은 변경되지 않았고, `git diff --stat origin/main...HEAD` 로 확인한 결과 `spec/**` 파일은 실제로 전혀 수정되지 않았다(`spec_impact: none` 이 실측과 일치).
- planner 가 초안(`plan/complete/spec-draft-rotate-conflict.md`, 409 `INTEGRATION_ROTATE_CONFLICT` 신설안)을 작성했다가 `/consistency-check --spec`(BLOCK: YES, `status: implemented` 문서에 미구현 계약을 얹는 문제)로 스스로 반증하고 철회한 이력이 `plan/in-progress/rotate-lost-update.md` §C 에 정직하게 기록돼 있다. 최종적으로 "코드로만 닫는다"는 결론과 실제 diff(스펙 미변경)가 정확히 일치한다 — spec 과 코드 사이에 드리프트나 괴리 없음.
- `INTEGRATION_ROTATE_UNSUPPORTED`/`FORBIDDEN`/`RESOURCE_NOT_FOUND`/`INTEGRATION_INVALID_CREDENTIALS`/`INTEGRATION_TEST_FAILED` 등 사용된 모든 에러 코드는 신규 도입 없이 기존 카탈로그를 재사용한다.

## 기능·엣지 케이스·회귀 확인 (통과)

- 생성자에 `DataSource` 주입 추가(`integrations.service.ts:434`) — 모듈 내 형제 서비스(`integration-oauth.service.ts`)가 이미 같은 패턴으로 전역 `TypeOrmModule.forRoot()` 로부터 주입받고 있어 DI 배선 문제 없음. `new IntegrationsService(...)` 를 직접 호출하는 유일한 곳(`integrations.service.spec.ts:180-190`)의 인자 순서가 생성자 파라미터 순서와 정확히 일치.
- 락 안 재읽기가 `workspaceId` 까지 조건에 포함(`where: { id: entity.id, workspaceId }`, line 1149)해 테넌트 격리가 `requireEntity` 와 동일하게 유지됨.
- 락 안에서 `scope === 'organization'` 권한을 재검증하는 새 분기(line 1159-1165)와 이를 검증하는 단위 테스트(`integrations.service.spec.ts:1408-1421`)가 정확히 대응 — `update` 미호출까지 확인.
- 동시 교체 시나리오 단위 테스트(`integrations.service.spec.ts:1361-1379`)가 "이 요청이 바꾼 필드는 새 값, 동시 요청이 바꾼 필드는 보존"을 정확히 검증하고, 트랜잭션 순서 테스트(`:1381-1406`)가 "연결 테스트 → 트랜잭션 → `pessimistic_write`" 순서를 `dataSource.transaction`/`testHttpConnection` mock 순서 배열로 실측.
- e2e(`integration-rotate-concurrency.e2e-spec.ts`)는 실제 DB 행 락(`SELECT ... FOR UPDATE`, 별도 커넥션)으로 겹침을 강제하고, "공허성 가드"(`raced.settled === false`)로 fixture 가 실제로 경합을 만들었는지까지 확인한다 — 우연한 통과를 배제하는 설계.
- 부분 `update` 유지(엔티티 전체 `save` 아님) 불변식이 유지되는지 확인하는 기존 테스트(`integrations.service.spec.ts:2242-2303`, `logUsage` 가 쓴 `lastUsedAt` 을 되돌리지 않음)가 새 3-mock 시퀀스(`stale, stale, reread`)에 맞춰 정확히 갱신됨.
- 컨트롤러(`integrations.controller.ts`)는 서비스 시그니처 변경 없이 그대로 위임 — 영향 없음.
- 코드 전반에 TODO/FIXME/HACK/XXX 없음.

## 리뷰 수행 중 저장소 상태

리뷰 전 과정 read-only — `Read`/`Grep`/`git diff`/`git status` 만 사용했고 저장소 파일에 어떤 수정·뮤테이션도 가하지 않았다. `git status --short` 는 이 리뷰 세션 자신의 산출물 디렉터리(`review/code/2026/09/20/17_35_12/`)만 untracked 로 보여준다 — 원복이 필요한 잔여물 없음.

## 요약

`rotate()` 의 lost-update 결함을 같은 모듈의 재인증(CONC H-3) 선례와 동형으로 닫은 구현이다 — 외부 연결 테스트는 트랜잭션 밖에서 끝내고, 트랜잭션+`pessimistic_write` 안에서 행을 다시 읽어 그 위에 머지·검증·부분 `update` 한다. 권한(scope) 재검증까지 같은 자리에서 다시 수행해 요청 시작 시점 스냅샷으로 인가를 판정하던 기존 취약점도 함께 닫았다. 단위 테스트(동시 교체 보존, 락/트랜잭션 순서, 권한 재검증)와 실제 행 락을 쥐고 겹침을 강제하는 e2e 테스트가 핵심 회귀 형태를 구체적으로 고정하고 있고, 생성자 DI 변경도 유일한 직접 인스턴스화 지점과 정확히 동기화됐다. Spec(`4-integration.md` §3/§9.2)의 "테스트 → 성공 시만 커밋" 계약은 그대로 유지되며 `spec/` 파일 변경이 실제로 없어 `spec_impact: none` 선언과 diff 가 일치한다 — spec 과 구현 사이 괴리 없음. 남은 것은 이 PR 이 새로 도입한 두 분기(락 안 재읽기의 `!fresh` 404, 재검증 실패 `INTEGRATION_INVALID_CREDENTIALS`)가 단위 테스트로 직접 exercised 되지 않는다는 점인데, 전자는 같은 모듈의 기존 선례(CONC H-3)도 동일하게 미검증이라 저장소가 이미 받아들인 패턴이고, 후자는 이 PR 이전부터 있던 단일 검증 분기도 테스트된 적이 없어 회귀가 아니라 기존 테스트 부채의 반복이다. 두 항목 모두 차단 사유가 아닌 INFO 로 남긴다.

## 위험도

LOW
