# 신규 식별자 충돌 검토 — naming_collision

## 사전 확인 (스코프 불일치)

프롬프트는 `--impl-done, scope=spec/5-system/, diff-base=origin/main` 을 명시하고
`spec/5-system/1-auth.md`·`3-error-handling.md` 전문 + 나머지 15개 spec 파일 헤더를
번들링했지만, 실측 결과 **`git diff origin/main...HEAD -- spec/`는 완전히 비어 있다**
(`git diff --stat origin/main...HEAD -- spec/5-system/` 출력 0줄). 즉 이번 PR 은
`spec/5-system/` 을 전혀 수정하지 않았다.

실제 코드 변경분(diff-base 기준, `git diff --stat origin/main...HEAD -- codebase/`)은:

```
codebase/backend/src/common/utils/__testing__/source-scan.{ts,spec.ts}   (신규)
codebase/backend/src/common/utils/assert-row-array.spec.ts               (수정)
codebase/backend/src/common/utils/update-returning-rows.{ts,spec.ts}     (신규)
codebase/backend/src/modules/auth/auth-oauth.service.{ts,spec.ts}        (수정)
codebase/backend/src/modules/execution-engine/execution-engine.service.ts (수정)
codebase/backend/src/modules/knowledge-base/knowledge-base.service.{ts,spec.ts} (수정)
codebase/backend/test/auth-oauth-callback.e2e-spec.ts                    (신규)
codebase/backend/tsconfig.build.json                                     (수정)
```

`auth-oauth.service.ts` 는 `spec/5-system/1-auth.md` frontmatter 의
`code: codebase/backend/src/modules/auth/**/*.ts` 범위에 들어 이 spec 이 번들된 것은
납득되지만, spec 본문에 신규 요구사항 ID·엔티티·endpoint·이벤트·env var 를 추가하는
변경은 **없다**. 성격은 `UPDATE/DELETE RETURNING` 이 TypeORM+pg 에서 `[rows, rowCount]`
튜플로 오는데 행 배열로 오인해 소셜 로그인이 상시 실패하던 버그의 수정(raw SQL shape
버그 픽스)이며, 신규 요구사항·API·이벤트 도입이 아니다. 아래는 이 실제 diff 기준으로
"신규 식별자 충돌" 관점을 적용한 결과다.

## 발견사항

신규 식별자 충돌 CRITICAL/WARNING 없음. 코드 레벨에서 새로 도입된 식별자를 전수
확인했으나 기존 사용처와 의미가 겹치는 충돌은 없었다.

- **[INFO]** 신규 유틸 함수명 `updateReturningRows` — 충돌 없음
  - target 신규 식별자: `updateReturningRows()` (`codebase/backend/src/common/utils/update-returning-rows.ts`, 신규 파일)
  - 기존 사용처: 없음 — `git grep -n "updateReturningRows"` 결과 이 PR 의 정의·호출부만 존재
  - 상세: 자매 헬퍼 `assertRowArray`(`common/utils/assert-row-array.ts`, 기존)와 역할이 명확히
    분담된다(SELECT→`assertRowArray`, UPDATE/DELETE→`updateReturningRows`). 파일명·함수명 모두
    기존 kebab-case 파일 / camelCase 함수 컨벤션과 일치하고 겹치는 기존 식별자 없음.
  - 제안: 없음 (문제 없음, 기록용)

- **[INFO]** 신규 타입 `AuthOAuthStateRow` vs 기존 엔티티 `AuthOAuthState`
  - target 신규 식별자: `interface AuthOAuthStateRow` (`auth-oauth.service.ts` 신규)
  - 기존 사용처: `codebase/backend/src/modules/auth/entities/auth-oauth-state.entity.ts:11` 의 `export class AuthOAuthState`
  - 상세: 이름이 `...Row` 접미사로 명확히 구분되어 있고, 의도적으로 별도 타입을 둔 이유도
    docstring 에 설명되어 있다(entity 매핑을 타지 않는 raw SQL 결과의 snake_case shape 표현).
    실질적 혼동 가능성은 낮다 — 같은 파일 내에서 두 이름이 나란히 쓰이며 목적이 다르다는 것이
    주석으로 명시되어 있음.
  - 제안: 없음 (명명 자체가 충돌 회피 목적으로 이미 설계됨)

- **[INFO]** 테스트 전용 헬퍼 `countCalls` 와 frontend `countCallsPerTurn` — 실질 충돌 아님
  - target 신규 식별자: `countCalls()` (`codebase/backend/src/common/utils/__testing__/source-scan.ts`, 신규, backend 전용)
  - 기존 사용처: `codebase/frontend/src/components/editor/run-results/llm-call-trace.ts:159` 의 `export function countCallsPerTurn(...)`
  - 상세: 이름이 부분적으로 겹치지만(`countCalls` vs `countCallsPerTurn`) 서로 다른 패키지(backend
    vs frontend), 다른 도메인(소스 코드 정적 스캔 vs LLM 호출 트레이스 집계), import 경로가
    교차하지 않아 실질적 이름 충돌·혼동 가능성은 낮다. `__testing__/source-scan.ts` 는
    `tsconfig.build.json` exclude 에 추가되어 프로덕션 dist 에도 실리지 않는다.
  - 제안: 특별한 조치 불요 (참고용 기록)

- **[INFO]** `__testing__` 디렉토리 — backend 최초 도입, 파일 경로 컨벤션 충돌 없음
  - target 신규 식별자: `codebase/backend/src/common/utils/__testing__/` (신규 디렉토리)
  - 기존 사용처: 없음 — backend 소스 트리에서 이 이름의 디렉토리는 이번이 최초
  - 상세: 기존 backend 는 `*.spec.ts` 를 소스 파일과 같은 디렉토리에 두는 컨벤션을 쓰고 있어
    `__testing__` 서브디렉토리는 새로운 패턴이지만, `tsconfig.build.json` exclude 에 동반
    추가되어 있어 빌드 누출 위험은 없다. 기존 명명 컨벤션을 "깨는" 것이라기보다 테스트 전용
    공유 헬퍼를 위한 새 하위 카테고리 추가에 가깝다.
  - 제안: 이후 다른 모듈에서도 같은 패턴(구조적 가드 헬퍼 공유)이 필요해지면 `__testing__`
    명명을 그대로 재사용해 일관성을 유지할 것을 권장.

- ENV var·설정키: 이번 diff 에 신규 `process.env.*` 참조나 신규 config key 없음(확인:
  변경 파일 중 `webauthn.config.ts` 등 config 파일 미포함).
- API endpoint: 신규 endpoint(controller route) 추가 없음 — 변경은 서비스 내부 raw SQL
  파싱 로직에 한정.
- 이벤트/메시지명: webhook·queue·sse 이벤트명 신규 도입 없음.
- 요구사항 ID: spec 본문에 diff 가 없으므로 신규 ID 부여 자체가 없음.

## 요약

이번 PR 은 `spec/5-system/` 본문을 전혀 수정하지 않는 순수 코드 버그 픽스(TypeORM
UPDATE/DELETE RETURNING 이 `[rows, rowCount]` 튜플로 오는 것을 행 배열로 오인해 OAuth
소셜 로그인이 상시 실패하던 결함 + 자매 지점(execution-engine, knowledge-base) 동일
패턴 하드닝)이며, 신규 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·환경변수를 도입하지
않는다. 코드 레벨에서 새로 도입된 식별자(`updateReturningRows`, `AuthOAuthStateRow`,
`stripComments`/`countCalls`, `__testing__` 디렉토리)를 전수 확인한 결과 기존 사용처와
의미가 겹치는 진짜 충돌(CRITICAL/WARNING)은 발견되지 않았다. 다만 오케스트레이터가 이
naming_collision 검토를 `scope=spec/5-system/` 로 라우팅하면서 정작 그 영역의 diff 가
0줄이라는 점은 스코프 설정 자체의 미스매치로 보이며, 향후 라우팅 로직 점검 시 참고할
가치가 있다(이 검토 자체의 판정을 바꾸지는 않음).

## 위험도
NONE
