# 테스트(Testing) 리뷰

## 개요

이 브랜치는 이미 10회 이상의 `/ai-review` + `/consistency-check` 라운드(`10_13_22` ~
`14_59_48`)를 거치며 테스트 관점 지적을 대부분 흡수한 상태다(RESOLUTION.md 기록 확인).
`git diff origin/main...HEAD`(22 files, +2458/-23)를 직접 열어 확인한 결과, 새 코드
경로 각각에 대해 양성/음성 fixture, 두 wrap 표면(`driverError`/top-level), 반대 방향
대조군(넓힌 술어가 잘못된 방향으로 통과하지 않는지)까지 갖춘 매우 높은 수준의 테스트가
이미 마련돼 있다. 아래는 그 위에서 직접 코드를 실행/추적해 확인한, 아직 보고되지 않은
갭 2건이다.

## 발견사항

- **[WARNING]** YAML 트레일링 주석 수정 — 인용 스칼라(quoted scalar) 분기가 block-list
  형태에서만 회귀 테스트되고, 같은 헬퍼를 타는 single-value·inline-list 형태는 테스트가
  없다
  - 위치: `.claude/tests/test_review_guard.py` — `test_parse_strips_trailing_comment_after_quoted_scalar`(412행 부근, block-list 형태 `'  - "codebase/backend/a.ts"  # note\n'`만 검증) vs `test_parse_strips_trailing_comment_single_and_inline`(400행, **unquoted** 값에 대해서만 세 형태 전부 검증). 대상 구현은 `.claude/hooks/_lib/review_guard.py`의 `_strip_comment`/`_clean`(626~644행 부근).
  - 상세: `_parse_frontmatter_code` 는 `code:` 값을 세 형태(단일값 / 인라인 리스트 /
    block 리스트)로 파싱하며 셋 다 같은 `_clean`(→ `_strip_comment`) 헬퍼를 통과한다.
    이번 커밋(`0fd4d2f29`)이 고친 "인용 스칼라 + 트레일링 주석"(`"a.ts"  # note` →
    `a.ts"  # note`로 값이 오염되던 버그) 버그의 회귀 테스트는 block-list 형태
    하나만 추가됐다. 직접 `_parse_frontmatter_code`를 호출해 확인한 결과 —
    `code: "codebase/backend/a.ts"  # note` (단일값)와
    `code: ["codebase/backend/a.ts", "codebase/frontend/b.ts"]  # note` (인라인
    리스트) 둘 다 **현재 구현은 정확히 처리한다**(각각 `['codebase/backend/a.ts']`,
    `['codebase/backend/a.ts', 'codebase/frontend/b.ts']`을 반환 — 재현 확인,
    지금 당장의 버그는 아님). 다만 이 두 분기는 `_clean`이 `_strip_comment`를
    **두 번**(먼저 `code:` 매치 직후 1회, `_clean` 내부에서 1회) 통과하는 유일한
    경로라 block-list 경로(한 번만 통과)와 코드 경로가 미묘하게 다르고, 회귀
    테스트가 없다. 바로 이 파일의 다른 테스트(`test_parse_block_list_still_stops_at_next_key`,
    앞선 unquoted 수정에 대한 `test_parse_strips_trailing_comment_single_and_inline`의
    "세 분기 전부 같은 경로를 탄다"는 명시적 코멘트)와 이 PR의 다른 신규 테스트들
    (`user-entity-exposure.spec.ts`의 "같은 헬퍼라도 호출 지점마다 관측돼야 한다",
    `dto-jsdoc-citation.spec.ts`의 "세 형태가 각각 관측되어야 한다")이 반복적으로
    강조하는 바로 그 원칙 — "같은 정규식/헬퍼라도 호출 지점(분기)마다 fixture로
    관측해야 한다, 안 그러면 그 분기가 죽어도 그린이다" — 이 이번 인용-스칼라 수정
    자신에는 적용되지 않았다.
  - 제안: `test_parse_strips_trailing_comment_single_and_inline`과 같은 패턴으로,
    단일값(`code: "codebase/backend/a.ts"  # note`)과 인라인 리스트
    (`code: ["codebase/backend/a.ts", "codebase/frontend/b.ts"]  # note`)에 대해서도
    인용 스칼라 + 트레일링 주석 케이스를 추가한다.

- **[INFO]** `endpoint_path` UNIQUE 충돌의 서비스 레벨 통합 테스트가 두 wrap 표면 중
  하나만 사용한다 — 술어 자체는 양쪽이 커버되어 실질 위험은 낮음
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` —
    `it.each([['update', …], ['create', …]])('%s — 409 + RESOURCE_CONFLICT + details 두 키', …)` 블록(2761행 이후 신설 `describe` 안)은 `uniqueViolation('idx_trigger_workspace_endpoint')`를
    기본 인자(`surface = 'driverError'`)로만 호출한다. 같은 파일의
    `it.each([['driverError'], ['top']])('[술어] %s 표면에서도 인덱스명으로 가른다', …)`는
    `isEndpointPathUniqueViolation` 술어 자체를 양쪽 표면으로 직접 검증한다.
  - 상세: `TriggersService.create`/`update`가 실제로 `ConflictException`을 올바른
    `details`(`field`/`code`)와 함께 던지는지 확인하는 통합 테스트(와이어에 실제로
    닿는 형태를 문는 테스트)는 `driverError` 표면 한 가지 시나리오로만 실행된다.
    `rethrowEndpointPathConflict`가 내부적으로 `isEndpointPathUniqueViolation`을
    호출하므로 술어 단위 테스트가 두 표면을 이미 커버해 실질 위험은 낮지만, 만약
    향후 `rethrowEndpointPathConflict`가 술어 호출을 바꾸거나(예: 표면별 분기를
    직접 추가) 우회하면, 이 통합 테스트만으로는 top-level 표면에서의 회귀를 잡지
    못한다.
  - 제안: 두 통합 `it.each` 케이스에도 `surface` 축을 추가해
    (`['update','driverError']`,`['update','top']`,…) 두 표면 모두에서 실제
    `ConflictException` 형태가 나오는지 확인하거나, 현재 상태를 유지할 경우 왜
    술어 테스트만으로 충분한지 주석으로 남긴다.

## 요약

새로 추가된 코드(PostgreSQL 에러 두 표면 추상화, YAML frontmatter 파서의 주석/빈줄
내성, `User` 엔티티 노출 방어 2축 가드 + fixture, `WorkflowVersionsService`의
`creator` 투영 보안 경계, DTO JSDoc 인용 래칫, 다수의 e2e 축)는 전반적으로 테스트
품질이 매우 높다 — 양성/음성 대조군, 반대 방향 대조군("넓힌 술어가 반대로 새지
않는가"), 두 wrap 표면 각각에 대한 fixture, 전제 조건 단언(`[전제] … 0건이면 위
단언이 조용히 통과한다`), 소스-대조 카나리아(엔티티 컬럼 수 등)까지 여러 라운드의
뮤테이션 테스트를 거쳐 다듬어져 있고, 이전 라운드가 지적한 검출력 0(eager 축),
관측 불가능 분기(bare 시각 정규식), `line` 미사용 필드, JSDoc orphan 등은 모두
현재 코드에서 해소가 확인됐다. 이번 라운드에서 새로 발견한 것은 최신 커밋
(`0fd4d2f29`)이 고친 YAML 인용 스칼라 트레일링 주석 버그의 회귀 테스트가 세 파싱
형태 중 하나(block-list)에만 추가된 갭 하나(WARNING)와, 트리거 UNIQUE 충돌 통합
테스트가 두 wrap 표면 중 하나만 쓰는 낮은 위험의 갭 하나(INFO)다. 둘 다 현재 구현
자체는 정확함을 직접 실행해 확인했다 — 활성 버그가 아니라 향후 회귀를 못 잡는
커버리지 공백이다.

## 위험도

LOW
