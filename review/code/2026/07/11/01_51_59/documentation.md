# 문서화(Documentation) Review — FINAL fresh re-review (commit `1661b99aa` on `d8ce7693f`)

대상: `/consistency-check --impl-done` 이 지적한 Warning 2건(W1 dual-surface 재서술, W2 `code:` frontmatter
등재)의 반영분. `origin/main...HEAD` 전체 spec surface 의 내부 정합성 최종 확인.

## 검증 방법

diff 만 보지 않고 현재 워킹트리 파일과 실제 백엔드 코드(엔진 실행 경로)를 직접 Read/grep 으로 교차 대조했다.

## 발견사항

- **[확인됨 — 정확]** §1.3 `RESERVED_VARIABLE_NAME` dual-surface 재서술이 실제 코드 동작과 일치
  - 위치: `spec/5-system/3-error-handling.md:85`
  - 상세: (1) L0 — `WorkflowsService.validateReservedVariableNames`(`workflows.service.ts:656`)가
    `throw new BadRequestException({code, message, details:{offenders}})` 로 진짜 HTTP 400 을 던짐을
    코드에서 직접 확인. `saveCanvas`(`skipLegacyDataGates=false` 일 때만)와 `importWorkflow`(무조건) 양쪽
    호출부 확인, `restoreVersion`→`skipLegacyDataGates=true` 로 면제되는 것도 확인(`workflows.service.ts:492`).
    (2) L1 — 엔진이 `handler.validate(node.config)` 를 **expression 해석 이전의 raw `node.config`** 로
    호출한 뒤(`execution-engine.service.ts:5278`), 리터럴 이름만 걸러진 에러를
    `throw new Error(`INVALID_NODE_CONFIG: ...`)` 로 격하하는 것을 확인(`:5292`) — spec 의 "저장 게이트를
    우회한 리터럴은 pre-flight(L1)에서 INVALID_NODE_CONFIG 로 격하" 서술과 정확히 일치.
    (3) L2 — `handler.execute` 는 expression 해석이 끝난 `resolvedConfig` 를 받고
    (`:5326`→`:5361 executeWithRetry`), 두 노드 모두 `EXPRESSION_EXCLUSIONS`(`expression-exclusions.ts`)
    에 등재되어 있지 않음을 확인 — `name`/`variable` 필드가 실제로 `{{ }}` 해석 대상이라는 전제가 참이다.
    L2 throw 는 순수 `Error` 이고, catch 블록이 `nodeExecution.error = { message: err.message }` 만 기록
    (`:5539/:5591/:5604` — 구조화 `code` 필드 없음), 즉 spec 이 말하는 "구조화 `error.code` 없이 `.message`
    로만 존재" 서술과 정확히 일치. `ExecutionStatus.FAILED` 로의 전파 경로도 확인(top-level catch, 예:
    `:3034/:3073`).
  - 결론: HTTP 열 `400 (저장) / — (런타임)` 을 포함해 재서술 전체가 사실과 부합. 정확성 결함 없음.

- **[확인됨 — 근거 있는 정확한 precedent 인용]** `EXECUTION_TIMEOUT`/`WORKER_HEARTBEAT_TIMEOUT` 선례 인용
  - 위치: `spec/5-system/3-error-handling.md:85`
  - 상세: `spec/conventions/error-codes.md §4` 의 "레이어 주의 — `EXECUTION_TIMEOUT` 동명 코드" 노트(라인
    91-97)가 정확히 같은 패턴(동일 코드명이 서로 다른 레이어에서 서로 다른 surface 로 등장)을 이미 문서화
    하고 있음을 확인했다. 인용이 지어낸 유비가 아니라 저장소 내 실제 선례임이 검증됨.

- **[확인됨 — YAML 유효 + 경로 존재]** `code:` frontmatter 3건 추가
  - 위치: `spec/4-nodes/1-logic/4-variable-declaration.md`, `spec/4-nodes/1-logic/5-variable-modification.md`,
    `spec/conventions/execution-context.md` 각 frontmatter
  - 상세: `python3 yaml.safe_load` 로 4개 파일(위 3개 + `3-error-handling.md`, 이건 frontmatter 미변경
    확인용) 전부 파싱 성공. `codebase/backend/src/nodes/logic/_shared/reserved-variable-name.util.ts` /
    `.util.spec.ts` 실제 파일 존재 확인(`ls -la`). `variable-modification.md` 는 형제 항목
    `value-masking.util.ts` 바로 다음 줄에 추가되어 기존 컨벤션(§4-2 개별 유틸 파일 명시 나열)과 정렬.
  - `3-error-handling.md` 는 frontmatter 변경 없음(본문 행 텍스트만 변경) — 의도된 범위와 일치, 누락 아님
    (해당 파일 `code:` 목록은 애초에 노드별 유틸이 아닌 시스템 전역 필터/파이프 등재 성격이라 개별 노드
    유틸을 등재할 이유가 없음).

- **[확인됨 — 전체 spec surface 무모순]** `RESERVED_VARIABLE_NAME` 전 언급처 교차 검증
  - 위치: `CHANGELOG.md`, `spec/5-system/3-error-handling.md`, `spec/conventions/execution-context.md`,
    `spec/4-nodes/1-logic/4-variable-declaration.md`, `spec/4-nodes/1-logic/5-variable-modification.md`
  - 상세: `grep -rln RESERVED_VARIABLE_NAME`(review/ 산출물 제외) 결과 5개 spec/CHANGELOG 파일 전부 동일한
    L0(저장 시점 400, `saveCanvas`/`importWorkflow`, `restoreVersion` 면제)·L1(pre-flight,
    `INVALID_NODE_CONFIG` 격하)·L2(런타임 throw, 실질 강제 지점) 3계층 모델을 서술하며 상호 모순 없음.
    "blanket 400" 식의 옛 단일-surface 서술이 남아있는 곳 0건. `origin/main...HEAD` 전체 spec diff(4개
    파일, 31 insertions/8 deletions)를 라인 단위로 재검토했고 위 재서술과 §5/§6 preamble(직전 라운드
    `00_59_29`/`01_24_20` 에서 이미 fix 확인된 W2)·Rationale 섹션이 모두 같은 3계층 어휘(L0/L1/L2)를
    일관되게 사용.

- **[INFO — 스타일, 결함 아님]** §1.3 표의 HTTP 열에 복합 문자열(`400 (저장) / — (런타임)`) 사용
  - 위치: `spec/5-system/3-error-handling.md:85`
  - 상세: §1.3 표의 다른 모든 행은 HTTP 열에 단일 상태 코드(400/404/409/413/422)만 담는다. 이 행만 유일하게
    "A (라벨) / B (라벨)" 복합 형식을 쓴다. §1.4(엔진 레벨 에러, `EXECUTION_TIMEOUT` 등)는 애초에 HTTP 열이
    없는 2열 표라 형식적으로 완전히 동일한 선례는 아니다. 다만 이 코드가 진짜 HTTP surface(L0)를 가지고
    있어 §1.3 에 남아있는 것 자체는 타당하고, 두 레이어를 한 행 안에서 정직하게 밝히는 이 방식이 행을
    쪼개 §1.3/§1.4 에 중복 등재하는 것보다 추적성이 낫다고 판단된다 — 차단 사유 아님, 향후 3계층 dual-surface
    코드가 하나 더 생기면 이 표기 관례(`X (조건) / Y (조건)`)를 그대로 재사용할 수 있음을 참고로 남긴다.

- **[INFO — 이전 라운드 defer, 이번 커밋 범위 밖, 여전히 미반영]** `§variable-declaration §6` 중복 섹션-마크
  오타
  - 위치: `CHANGELOG.md:8`, `spec/conventions/execution-context.md:112`
  - 상세: `§variable-declaration §6` 처럼 `§` 가 두 번 등장(섹션 기호 뒤에 문서명, 그 뒤에 다시 `§6`). 직전
    라운드(`review/code/2026/07/11/01_24_20/documentation.md`)에서 이미 INFO 로 발견돼 non-blocking 으로
    분류됐고, 금번 `1661b99aa` 는 이 두 줄을 건드리지 않았으므로 예상대로 그대로 남아있다. 기술적 정확성에는
    영향 없음 — 이번 재검토에서도 강등/차단 사유 아님.
  - 제안(non-blocking): 후속 편집 시 `variable-declaration.md §6` 또는 `§variable-declaration(§6)` 형태로
    정정.

## 요약

`1661b99aa` 의 두 정정(§1.3 dual-surface 재서술, 3개 spec 파일 `code:` frontmatter 등재) 모두 실제 코드
동작(엔진 실행 순서·에러 전파 경로·expression 해석 시점)과 정확히 일치함을 소스 레벨에서 직접 확인했다.
frontmatter 는 YAML 로 유효하고 참조 경로가 실존하며 기존 컨벤션과 정렬된다. `RESERVED_VARIABLE_NAME` 을
언급하는 5개 spec/CHANGELOG 파일 전체를 교차 대조한 결과 3계층(L0/L1/L2) 모델이 일관되고 모순되는 서술이
없다. 발견된 잔여 사항은 모두 INFO 수준(§1.3 HTTP 열의 복합 표기 스타일, 이전 라운드에서 이미 defer 된
`§variable-declaration §6` 오타 1건)으로 문서화 관점에서 차단 사유가 되는 결함은 없다.

## 위험도

NONE

STATUS: DONE
