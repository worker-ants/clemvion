# 정식 규약 준수 검토 — `spec/2-navigation/2-trigger-list.md`

## 검토 범위

- scope 델타: `spec/2-navigation/2-trigger-list.md` (3줄 변경 — §2.3.1 필드 권한 매트릭스의
  `endpointPath` 행, §3 PATCH 하단 註)
- 함께 확인한 구현 diff: `triggers.controller.ts` · `triggers.service.ts` ·
  `triggers.service.spec.ts` · `V131__trigger_endpoint_path_dedupe.sql` ·
  `V132__trigger_endpoint_path_global_unique.sql/.conf` · 관련 e2e
- 절대경로 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/webhook-endpoint-lookup-7a1f3c`)
  기준으로 `git diff origin/main...HEAD` 직접 실행해 확인.

변경 내용은 `Trigger.endpoint_path` UNIQUE 범위를 `(workspace_id, endpoint_path)` → `(endpoint_path)`
전역으로 바꾼 보안 수정(V131/V132)에 맞춰 target 문서의 두 서술을 동기화한 것이다.

## 발견사항

해당 스코프에서 CRITICAL/WARNING 위반을 찾지 못했다. 아래는 확인한 근거와 INFO 제안 하나다.

- **[INFO]** 반복되는 "공유 Swagger 설명 상수" 패턴이 `swagger.md` 에 명문화되어 있지 않음
  - target 위치: `spec/2-navigation/2-trigger-list.md` 자체는 아니고, 이 변경이 딸려 온
    `codebase/backend/src/modules/triggers/triggers.controller.ts` (`TRIGGER_ENDPOINT_PATH_CONFLICT_DESCRIPTION`
    상수 신설, `create`/`update` 두 엔드포인트가 공유)
  - 위반 규약: 없음 — `spec/conventions/swagger.md` §2 Controller 패턴에는 이 패턴에 대한 명시 규칙이
    없다. 다만 이번 커밋이 인용한 선례(`integrations.controller.ts` 의 `OAUTH_BEGIN_RESULT_DESCRIPTION`,
    22:82/186/477/499 라인에서 실재 확인)와 정확히 동형이라 **기존 관행을 따른 것**이지 새 패턴을
    만든 것이 아니다.
  - 상세: `@ApiConflictResponse({ description: ... })` 를 두 엔드포인트가 문자 그대로 중복 정의하면
    한쪽만 고쳐 문서가 어긋나는 사고가 나는데, 이 diff 는 그것을 상수 추출로 막았다. `swagger.md` 는
    현재 이 "여러 엔드포인트가 같은 에러 설명을 공유할 때 모듈 파일 상단 `UPPER_SNAKE_CASE`
    `_DESCRIPTION` 상수로 뺀다"는 관행을 §2(Controller 패턴) 어디에도 규칙화하지 않았다 — 두 번째
    실례(`OAUTH_BEGIN_RESULT_DESCRIPTION` 이후 이번이 두 번째)가 나온 시점이라 규칙으로 승격할
    후보다 (`swagger.md` §Rationale 이 이미 "rule of three 를 채우기 전엔 규칙으로 올리지 않는다"는
    자기 규율을 갖고 있으므로, 세 번째 사례가 나오면 §2 에 소절로 추가하는 것이 규약 자체의 논리와
    일관적이다).
  - 제안: target 문서는 수정할 필요 없음. `swagger.md` 갱신은 이번 PR 의 책임이 아니며(사례 2/3),
    다음에 같은 패턴이 한 번 더 나오면 project-planner 가 §2 에 소절로 승격을 검토.

## 확인한 준수 사항 (참고 — 위반 아님)

- **에러 코드 rename 정책 준수**: `error-codes.md` §2 는 "이름 정확성 향상만을 위한 rename 은
  하지 않는다"고 규정한다. 이번 변경은 `TRIGGER_ENDPOINT_PATH_CONFLICT` / `RESOURCE_CONFLICT` 코드
  값 자체를 바꾸지 않고 그 조건의 범위(워크스페이스 단위 → 전역)만 넓혔다 — 코드 이름이 애초에
  "무엇이 충돌했는가"(`ENDPOINT_PATH_CONFLICT`)만 기술하고 "어느 범위에서"를 이름에 박지 않았기
  때문에 범위 확장이 rename 압력을 만들지 않는다. `error-codes.md` §1 의 "의미 기반 명명, 구현
  세부를 이름에 박지 않는다" 원칙이 실제로 의도한 효과가 이번 케이스에서 검증된 사례.
- **인덱스 이름 상수 동기화**: `triggers.service.ts` 의 `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX` 를
  `idx_trigger_workspace_endpoint` → `idx_trigger_endpoint_path` 로 갱신했고, 이 문자열이 실제
  `V132__trigger_endpoint_path_global_unique.sql` 의 `CREATE UNIQUE INDEX CONCURRENTLY ...
  idx_trigger_endpoint_path` 와 grep 으로 일치함을 확인. 옛 이름에 대해서는 "다시 나타나면 다른
  인덱스로 보고 좁히지 않는다"는 회귀 테스트(`triggers.service.spec.ts`)까지 추가돼 있어
  `error-codes.md` 가 요구하는 "이름이 바뀌면 조용히 false 로 안전하게 좁힘 실패"라는 안전
  방향과 일치.
- **마이그레이션 명명 규약 (`migrations.md` §1·§2)**: `V131__trigger_endpoint_path_dedupe.sql` /
  `V132__trigger_endpoint_path_global_unique.sql` + `.conf` — 설명자 `snake_case`, `.conf` 의
  base name 이 `.sql` 과 동일, `origin/main` 의 max(V)=V130 대비 V131 → V132 로 gap 없이 단조
  증가함을 `git ls-tree` 로 직접 확인.
- **Swagger DTO/Controller 패턴**: 새 DTO 신설 없음. 기존 `@ApiConflictResponse` 데코레이터 형태
  그대로 유지, `details.field`/`details.code` 표기(`snake_case`/`UPPER_SNAKE_CASE`)도 기존 규약과
  일치.
- **문서 구조**: target 파일의 변경분은 기존 §2.3.1 표·§3 API 본문·`## Rationale` 3섹션 구조
  내부에서 두 문장만 교체한 것으로, 문서 구조 자체를 바꾸지 않았다(구조적 위반 소지 없음).

## 요약

`spec/2-navigation/2-trigger-list.md` 에 대한 이번 변경분(§2.3.1 `endpointPath` 행 + §3 PATCH
하단 UNIQUE 註 2곳)은 `spec/conventions/error-codes.md`(rename 안정성 정책)·`swagger.md`(DTO/
Controller 패턴)·`migrations.md`(V번호·명명 규약) 어느 것도 위반하지 않는다. 에러 코드 값은
그대로 유지한 채 조건 서술만 정확화했고, 관련 code 변경(controller 상수 추출·서비스 인덱스 이름
상수)도 저장소 기존 선례와 동형이다. 유일한 언급 사항은 INFO 수준으로, "공유 Swagger 설명 상수"
관행이 아직 `swagger.md` 에 규칙화되지 않았다는 관찰이며 이는 target 문서나 이번 PR 의 결함이
아니다.

## 위험도

NONE
