# 문서화(Documentation) 리뷰

## 발견사항

### [INFO] hooks-body-parser.ts — captureRawBody JSDoc 과 구현 간 경미한 불일치
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/bootstrap/hooks-body-parser.ts` L59-76
- 상세: `captureRawBody` JSDoc 에 "빈 Buffer(`length === 0`)도 그대로 세팅"한다고 명시하지만, 실제 구현은 `if (buf)` 조건이라 `Buffer.alloc(0)` 은 truthy 하여 동작은 일치한다. 그러나 JSDoc 의 의도 설명과 구현 의도가 다소 혼재한다 — RESOLUTION W3 가 `if (buf && buf.length)` 를 `if (buf)` 로 바꿔 빈 Buffer 도 세팅하도록 수정했는데, 주석은 여전히 `buf.length > 0` 을 암시하지 않고 빈 Buffer 세팅을 의도로 표명한다. 기능적으로는 정확하나, `if (buf)` 가 왜 `if (buf && buf.length)` 보다 나은지(빈 Buffer 세팅 허용) 의 이유가 주석에 명시적이지 않아 후속 리뷰어가 방어 조건 재도입을 시도할 여지가 있다.
- 제안: `captureRawBody` JSDoc 또는 인라인 주석에 "빈 Buffer 도 허용(빈 본문 HMAC 검증 보존) — `buf.length > 0` 체크 재도입 금지" 를 한 줄 추가하는 것을 권장한다.

### [INFO] e2e 파일 상단 JSDoc — 본문 크기 경계 케이스(J/K/L/M/N) 미반영
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/test/webhook-trigger.e2e-spec.ts` L10-20
- 상세: 파일 상단 JSDoc 블록은 인증 시나리오(bearer/api_key/basic_auth/hmac 등)만 나열하고 있으며, 이번에 추가된 본문 크기 경계 케이스(J: 512KB HMAC 통과, K: >1MB 413, L: 공개 32KB 초과 413, M: 인증 >1MB 413, N: non-webhook 100KB 초과 413)가 언급되지 않았다. 테스트 자체의 `it()` 설명은 충분히 상세하나, 파일 레벨 개요가 누락된 카테고리를 가진 채 유지되면 신규 기여자가 이 파일의 전체 커버 범위를 파악하는 데 불편을 준다.
- 제안: 파일 상단 JSDoc 에 "- 본문 크기 경계(WH-NF-02 옵션 C): 인증 webhook 512KB 통과 / >1MB 413 PAYLOAD_TOO_LARGE / 공개 32KB 초과 413 PUBLIC_WEBHOOK_BODY_TOO_LARGE / non-webhook 100KB 초과 413" 항목 추가.

### [INFO] http-exception.filter.spec.ts — 파일 상단 모듈 설명 주석 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/common/filters/http-exception.filter.spec.ts` L1
- 상세: 신규 파일임에도 파일 상단에 커버 범위를 설명하는 주석이 없다. 동일 프로젝트의 e2e 파일(`webhook-trigger.e2e-spec.ts`)은 상단 JSDoc 블록으로 커버 범위를 명시하는 관행을 따르고 있어 일관성 차이가 있다. 단위 테스트 파일이라 필수는 아니나, `describe` 블록 자체로 의미가 전달되므로 영향은 경미하다.
- 제안: 선택적. 파일 상단에 `// Unit: GlobalExceptionFilter — 413 PAYLOAD_TOO_LARGE 매핑, plain http-error 4xx 경로, 500 fallback, details 전달 검증.` 한 줄 주석 추가 고려.

### [INFO] CHANGELOG.md — 여러 "Unreleased" 블록 간 날짜 구분 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/CHANGELOG.md` L1-16
- 상세: 새 "Unreleased" 블록이 최상단에 올바르게 추가되었고 내용도 충분히 상세하다. 현재 CHANGELOG 에는 날짜 없는 "Unreleased" 블록이 복수 존재하여, 배포 시 정리 순서 파악이 어렵다. 이번 변경이 기존 스타일을 따르고 있으므로 일관성은 유지한다.
- 제안: 현 상태 유지(기존 스타일 일관성). 향후 배포 프로세스에서 날짜 태깅 관행 도입을 고려할 수 있으나 이번 변경 범위 밖이다.

### [INFO] spec/5-system/3-error-handling.md 및 2-api-convention.md — frontmatter code 목록에 hooks-body-parser.ts 미등재
- 위치: spec 파일 frontmatter `code:` 섹션
- 상세: `PAYLOAD_TOO_LARGE` 의 발원지인 `src/bootstrap/hooks-body-parser.ts` 가 연관 spec 파일들의 frontmatter `code:` 구현 근거 목록에 포함되지 않았다. `http-exception.filter.ts` 는 이미 등재되어 있어 필터 측은 추적되나, body-parser 한도 설정 파일은 누락 상태다.
- 제안: 선택적. `spec/5-system/3-error-handling.md` 와 `spec/5-system/2-api-convention.md` frontmatter `code:` 목록에 `codebase/backend/src/bootstrap/hooks-body-parser.ts` 추가. spec-coverage 도구 활용 시 coverage 갭 오탐 방지에 도움이 된다.

### [INFO] main.ts Swagger 설명 — PAYLOAD_TOO_LARGE 이미 반영됨 (이전 리뷰 INFO16 조치 완료)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/main.ts` L70
- 상세: diff 에서 `PAYLOAD_TOO_LARGE` 가 Swagger `setDescription()` 에러 코드 목록에 추가된 것이 확인된다. 이전 리뷰(15_00_36) INFO16 의 조치가 이미 반영된 상태이며 추가 조치 불필요.
- 제안: 현 상태 유지.

### [INFO] hooks.service.ts — preloadedTrigger 파라미터 인라인 주석 충분
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/hooks/hooks.service.ts` L94-97
- 상세: `preloadedTrigger?: Trigger | null` 파라미터에 "W14 — 중복 DB 왕복 제거", "가드의 조회 쿼리와 동일(`{ endpointPath, type: 'webhook' }` full entity)하므로 안전하게 재사용" 설명이 인라인 주석으로 기술되어 있다. 옵셔널 파라미터의 fallback 동작(미전달 시 직접 조회)도 명확히 설명된다. 문서화 품질 양호.
- 제안: 없음.

### [INFO] public-webhook-throttle.guard.ts — 보안 버그 수정 근거 주석 충분
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` (Guard 섹션 1 주석)
- 상세: partial projection 제거 이유(TypeORM null 컬럼 오반환 → 공개 webhook 인증 오판 → 보호 전량 우회)가 인라인 주석으로 충분히 서술되어 있고, e2e 회귀 가드 추가(L 케이스)도 주석에 언급된다. 유사 버그 재발 방지를 위한 단위 테스트도 추가되었다.
- 제안: 없음.

## 요약

이번 변경(인증 webhook 1MB body 게이트 + 공개 webhook 보호 우회 버그 수정)의 문서화 품질은 전반적으로 우수하다. CHANGELOG 에 보안 수정과 기능 변경이 상세히 기술되었고, `hooks-body-parser.ts` 의 공개 함수·상수 JSDoc 은 spec 참조, env override 범위, 레이어 순서 의존성까지 명시한다. `GlobalExceptionFilter` 의 private 헬퍼 `mapHttpErrorLike` 에도 의도 설명이 충분하며, 보안 버그 수정 주석도 근거를 포함한다. Swagger 설명의 에러 코드 목록에 `PAYLOAD_TOO_LARGE` 가 추가되었다. 발견된 항목은 전부 INFO 수준으로, e2e 파일 상단 JSDoc 의 본문 크기 케이스 미반영과 spec frontmatter 구현 근거 목록의 선택적 추가가 주된 개선 여지다. 차단 또는 경고(WARNING) 수준의 문서화 문제는 없다.

## 위험도

LOW

STATUS: SUCCESS
