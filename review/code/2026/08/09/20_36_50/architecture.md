# 아키텍처(Architecture) 리뷰

## 발견사항

- **[INFO]** `__test-utils__` 디렉터리는 `tsconfig.build.json` 이 `**/*spec.ts` 만 제외하고
  컴파일 대상에는 포함시켜, 테스트 전용 상수 모듈이 프로덕션 `dist/` 산출물에 그대로 실린다
  - 위치: `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts` (신규 파일 전체),
    관련 설정 `codebase/backend/tsconfig.build.json` (`exclude: ["node_modules", "test", "dist", "**/*spec.ts"]`)
  - 상세: 이번 PR 이 새로 만든 문제는 아니다 — `modules/integrations/__test-utils__` 가 이미
    같은 방식으로 `dist/` 에 컴파일되고 있고(`find dist -name __test-utils__` 로 확인), 파일
    상단 주석도 "jest 타입 비의존 — build tsc 가 컴파일하므로 의도적으로 상수만 둔다"고 그
    선례를 의식해서 설계했다. 다만 이 PR 이 `common/__test-utils__/` 라는 **새 디렉터리**를
    열어 그 선례를 한 곳 더 늘렸으므로, 테스트 전용 산출물이 배포 이미지에 섞이는 경계
    흐림이 구조적으로 반복되고 있다는 점은 기록해 둘 가치가 있다. 런타임 코드가 이 파일을
    import 하지 않으므로 실질 위험(런타임 동작·번들 크기)은 낮다.
  - 제안: 즉시 조치 불요. 다음에 `__test-utils__` 류 디렉터리가 하나 더 생기면
    `tsconfig.build.json exclude` 에 `**/__test-utils__/**` 를 추가해 test-only 산출물을
    아예 `dist/` 밖으로 빼는 것을 한 번쯤 검토할 만하다(선례가 2곳으로 늘었으니 지금이
    그 논의를 시작하기 좋은 시점).

- **[INFO]** in-memory mock 의 LIKE 메타문자 거부 정규식이 프로덕션 가드의 정규식과 같은
  패턴(`/[%_\\]/`)을 별도로 중복 선언한다 — 공유 상수 없이 두 곳에 각자 적혀 있다
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.spec.ts` 의
    `createInMemoryRepository` 내부 `where()` (본문에서 `if (/[%_\\]/.test(literalPart))`),
    대응하는 프로덕션 쪽은 `codebase/backend/src/modules/secret-store/secret-resolver.service.ts`
    의 `deleteByPrefix` (`if (/[%_\\]/.test(prefix))`)
  - 상세: 이 mock 의 self-assertion 은 "가드가 사라지는 회귀"를 잡기 위한 의도된 캐너리이고,
    정상 흐름에서는 프로덕션 가드가 먼저 막으므로 이 mock 분기는 가드가 뚫렸을 때만
    도달한다 — 설계 의도 자체는 타당하고 주석에도 근거(뮤테이션 실측 47/47 GREEN 사고)가
    잘 남아 있다. 다만 두 정규식이 같은 문자 집합(`% _ \`)을 우연이 아니라 의도로 공유하는데
    소스가 분리돼 있어, 프로덕션 가드가 허용 메타문자 집합을 바꾸면(예: `\` 만 이스케이프
    허용) 이 mock 은 자동으로 따라가지 못하고 조용히 stale 해질 수 있다. 같은 diff 가
    이미 이를 부분적으로 보완하는 별도 단위 테스트(쿼리가 `LIKE :prefix` + `ESCAPE` 절
    없음을 단언)를 뒀으므로 실질 위험은 낮다.
  - 제안: 즉시 조치 불요(연결점 테스트가 이미 안전망 역할). 다음에 이 가드의 허용 문자
    집합을 바꾸는 변경이 있으면, 정규식을 공유 상수로 뽑아 두 곳이 같은 소스를 참조하게
    하는 편이 이번과 같은 "문구 충돌로 인한 vacuous 테스트" 재발을 막기 쉽다.

## 요약

이번 diff 는 순수 위생/정리 성격 PR 이다 — 워크스페이스 UUID 테스트 픽스처를
`common/decorators`·`common/guards`·`common/utils` 세 스펙 파일에 흩어져 있던 것을
`common/__test-utils__/workspace-id-fixtures.ts` 로 통합했고, 이는 세 모듈이 이미 런타임에서
공유하는 의존 구조(RolesGuard → WorkspaceId 데코레이터 → workspace-context util)를 테스트
어휘 층위에서도 정확히 반영하는 결합이라 새로운 커플링을 만들지 않는다. `secret-resolver`
spec 은 in-memory mock 의 근사(startsWith)가 실제 Postgres LIKE 와일드카드 의미론과 어긋나는
지점을 스스로 인식해 throw 하도록 보강하고, 이를 뒷받침하는 e2e(`secret-store-like-prefix.e2e-spec.ts`,
raw pg client 직접 사용)와 "쿼리가 `LIKE :prefix`/ESCAPE 없음"을 잇는 연결점 단위 테스트를
새로 둬 유닛-e2e 두 축으로 책임을 명확히 나눴다 — mock 안에 DB 를 재구현하는 대신 계약만
단언하는 좋은 테스트 아키텍처 선택이다. 죽은 코드 제거(`http-request.handler.spec.ts`)와
캐너리 주석 수치 정정, README 재구조화도 모두 문서화된 근거를 동반한 저위험 변경이다.
`review/consistency/**` · `plan/**` 항목들은 프로세스 산출물/추적 문서로 아키텍처 관점에서
평가할 코드 구조가 없다. SOLID·레이어 분리·순환 의존·모듈 경계 어느 축에서도 새로운 결함을
찾지 못했으며, 위에 적은 두 INFO 는 모두 "지금 고쳐야 할 문제"가 아니라 향후 유지보수 시
참고할 관찰이다.

## 위험도

LOW
