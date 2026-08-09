# 신규 식별자 충돌 검토 — spec/5-system/ (--impl-done)

## 대상 diff 요약

`origin/main...HEAD` 코드 diff(순수 코드 변경, `spec_impact: none`):

- 신설 `codebase/backend/src/common/decorators/workspace-reflection-canary.ts`
  — `WorkspaceIdReflectionBrokenError`(class), `countWorkspaceIdConsumingRoutes`(fn),
  `assertWorkspaceIdReflectionWorks`(fn)
- `common/utils/uuid.ts` — `isUuidShaped`(fn), `UUID_SHAPE_PATTERN`(const)
- `common/utils/workspace-context.util.ts` — `resolveRequestWorkspaceContext` 가
  비-UUID `X-Workspace-Id` 헤더에 `BadRequestException({ code: 'VALIDATION_ERROR' })` 던지도록 확장
- `app.module.ts` — `@nestjs/core` `DiscoveryModule` import·등록
- `main.ts` — 부트 단계에서 `assertWorkspaceIdReflectionWorks(app)` 호출

## 발견사항

검토한 6개 관점(요구사항 ID·엔티티/타입명·API endpoint·이벤트/메시지명·환경변수/설정키·
파일 경로) 전부에서 **CRITICAL/WARNING 수준 충돌 없음**. 상세:

- **[INFO] 신규 코드 식별자는 전부 유일 — 기존 정의와 충돌 없음**
  - target 신규 식별자: `WorkspaceIdReflectionBrokenError`, `assertWorkspaceIdReflectionWorks`,
    `countWorkspaceIdConsumingRoutes`, `isUuidShaped`, `UUID_SHAPE_PATTERN`
  - 기존 사용처: 번들(spec bundle + `codebase/backend/src` 실사용처 grep) 전체에서 diff 밖 정의 0건
    (`isUuidShaped` 정의는 `common/utils/uuid.ts` 1곳뿐, `assertWorkspaceIdReflectionWorks`/
    `countWorkspaceIdConsumingRoutes`/`WorkspaceIdReflectionBrokenError` 도 신설 파일 1곳뿐)
  - 상세: 전부 신규 도입이며 기존 다른 의미로 쓰이는 동명 식별자가 없다.
  - 제안: 없음(정상).

- **[INFO] `VALIDATION_ERROR` 재사용은 충돌이 아니라 규약 준수 — 의도적으로 검증된 선택**
  - target 신규 식별자: 새 트리거("`X-Workspace-Id` 헤더가 있으나 UUID 형태 아님")에
    `code: 'VALIDATION_ERROR'` 를 붙임 (`workspace-context.util.ts`)
  - 기존 사용처: `spec/5-system/2-api-convention.md §5.3`(400 기본값 `VALIDATION_ERROR`),
    `spec/5-system/3-error-handling.md §1.3`(`VALIDATION_ERROR` = "요청 데이터 유효성 실패"),
    그 외 EIA/webhook/폼 검증 등 다수 지점
  - 상세: `VALIDATION_ERROR` 는 이미 "400 기본 에러코드"로 스펙 전역에서 재사용되는 코드다.
    plan(`plan/in-progress/auth-guard-reflection-hardening.md §3`)이 `WORKSPACE_ID_REQUIRED`
    (헤더·클레임 **둘 다 부재**)와의 의미 차이를 명시적으로 검토하고, 신규 전용 코드 신설 대신
    기존 400 기본값을 재사용하기로 결정한 근거가 남아 있다 — 충돌이 아니라 정확히 규약이
    의도한 재사용 패턴.
  - 제안: 없음. 단, 이 신규 트리거 케이스는 아직 `3-error-handling.md §1.3` 표에 행으로
    등재되지 않았다(plan `## 후속` 에서 planner 턴으로 명시적으로 이관됨, `spec_impact: none`
    유지 목적). 이는 식별자 충돌이 아니라 카탈로그 완결성 갭이라 본 리뷰(신규 식별자 충돌)
    범위 밖으로 판단 — 별도 checker(rationale_continuity 등)가 이미 다뤘다는 plan 기록과 일치.

- **[INFO] `canary` 라는 단어가 이미 다른 문맥에서 쓰이지만 식별자 충돌은 아님**
  - target 신규 식별자: 파일명 `workspace-reflection-canary.ts`, 클래스/함수 내부에 "캐너리" 개념
  - 기존 사용처: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
    (`'cred-leak-canary'`, `'ws-canary'` 등 테스트 픽스처 문자열 — credential 직렬화 누출 감지용
    sentinel 값)
  - 상세: 두 곳 모두 "이상 시 드러나는 감시 장치"라는 동일한 은유를 쓰지만, 하나는 부트타임
    reflection 무결성 검증(구조적 컴포넌트), 다른 하나는 테스트 픽스처의 문자열 리터럴이다.
    타입/함수/클래스 이름도 실제 문자열도 겹치지 않아 코드 레벨 충돌 가능성이 없다.
  - 제안: 조치 불요(정보 제공 목적으로만 기록).

- **[INFO] `common/decorators/` 디렉토리의 파일명 관례와의 미세한 불일치**
  - target 신규 식별자: `workspace-reflection-canary.ts` (디렉토리: `common/decorators/`)
  - 기존 사용처: 같은 디렉토리의 `current-user.decorator.ts` · `public.decorator.ts` ·
    `workspace.decorator.ts` 는 전부 `<name>.decorator.ts` 접미사 관례를 따른다
  - 상세: 신규 파일은 데코레이터 자체가 아니라 `workspace.decorator.ts` 의 reflection 이
    깨지지 않았는지 검증하는 부트 유틸리티라 `.decorator.ts` 접미사 대상이 아니다. `spec/conventions/`
    에 백엔드 파일명 규약을 정의한 문서가 없어(grep 0건) 문서화된 컨벤션 위반은 아니다 — 단지
    같은 디렉토리 안에서 명명 패턴이 갈린다는 관찰이다. 요청한 6개 관점 중 "파일 경로 충돌"은
    본래 **spec 파일** 경로를 겨냥하지만, 유사 사례로 참고할 만해 INFO 로만 남긴다.
  - 제안: 급하지 않음. 후속 정리 시 `common/decorators/index.ts` 배럴 export 목록에 이 파일이
    포함돼 있는지, 포함 시 데코레이터가 아닌 유틸이 데코레이터 배럴에 섞이는지만 한 번 확인 권장.

- **API endpoint / 이벤트·메시지명 / 환경변수·설정키**: diff 에 신규 endpoint, WS/webhook/queue
  이벤트, ENV var, config key 도입 없음 — 확인 결과 해당 관점은 이번 변경에 적용 대상 자체가 없다.

## 요약

이번 변경(`auth-guard-reflection-hardening`)은 순수 코드 경화(부트타임 reflection 캐너리 +
헤더 UUID 형식 검증)이며 `spec_impact: none` 이 실제로 유지된다. 신규로 도입된 식별자
(`WorkspaceIdReflectionBrokenError`, `assertWorkspaceIdReflectionWorks`,
`countWorkspaceIdConsumingRoutes`, `isUuidShaped`, `UUID_SHAPE_PATTERN`, `DiscoveryModule` 사용)는
모두 코드베이스·spec 어디에도 기존에 다른 의미로 쓰이는 동명 정의가 없어 충돌이 없다. 유일하게
재사용된 기존 식별자인 `VALIDATION_ERROR` 는 정의("400 기본 에러코드")와 정확히 부합하게 쓰였고,
plan 문서가 `WORKSPACE_ID_REQUIRED` 와의 의미 경계를 의도적으로 검토한 근거까지 남겨 두어 오히려
모범적인 충돌 회피 사례다. CRITICAL/WARNING 은 0건이며, 남은 INFO 는 전부 조치 불필요 수준의
참고 사항이다.

## 위험도
NONE
