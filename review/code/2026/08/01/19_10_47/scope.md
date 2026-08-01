# 변경 범위(Scope) 리뷰

## 조사 방법

프롬프트에는 5개 파일의 "전체 파일 컨텍스트"만 제공되고 unified diff 가 없어, 실제 변경분을
`git diff 41fc32d24..HEAD -- <5개 파일>` (직전 리뷰 라운드 `review/code/2026/08/01/18_44_56` 시점
대비 현재 HEAD)로 직접 확인했다. 이 5개 파일에 대한 실제 변경은 커밋 `8f4bcc378`
(`fix(backend): 8차 리뷰 — AuditActionFor 리터럴을 RESOURCE_TYPE 상수에 결속`)과 `b77c62bbd`
(`fix(backend): 8차 리뷰 INFO 조치 — AuditActionFor 빌드 가드 + 누락 주석`) 두 건이다.

## 발견사항

검토한 변경분은 직전 리뷰 라운드(`review/code/2026/08/01/18_44_56/SUMMARY.md`)가 명시적으로
권고한 항목과 1:1로 대응하며, 그 범위를 벗어나는 수정은 발견되지 않았다.

- **[INFO]** 변경분이 직전 리뷰 권고와 정확히 일치 — 범위 이탈 없음
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:245`,
    `codebase/backend/src/modules/schedules/schedules.service.ts:147`,
    `codebase/backend/src/modules/triggers/triggers.service.ts:215`,
    `codebase/backend/src/modules/workflows/workflows.service.ts` (`recordAudit` 파라미터
    타입 정의부)
  - 상세: `AuditActionFor<'model_config'|'schedule'|'trigger'|'workflow'>` 리터럴을
    `AuditActionFor<typeof *_RESOURCE_TYPE>` 로 바꾼 4곳 전부, 직전 라운드 WARNING #6
    (maintainability: "prefix 리터럴과 `*_RESOURCE_TYPE` 상수가 문자열을 타입 연결 없이
    이중 하드코딩")이 지목한 정확히 그 4개 파일·그 위치다. 각 파일에서 diff 는 해당 한 줄
    치환뿐이고 주변 로직·시그니처·호출부는 손대지 않았다.
  - 제안: 조치 불요.
- **[INFO]** 신규 타입 가드 추가가 직전 라운드 testing INFO #11 의 명시적 요청과 일치
  - 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts` (`_NoCrossDomain`
    / `_auditActionForNarrows`, 파일 말단 신규 블록)
  - 상세: 직전 라운드 INFO #11("`AuditActionFor` 제약 자체를 지키는 실행형 회귀 테스트 부재
    ... 선택적: `@ts-expect-error` 컴파일-타임 가드 추가 고려")에 대응해 빌드-검증 타입 가드를
    추가했다. 다른 export·기존 union·주석 구조는 변경하지 않았고, 순수 추가(append-only)다.
    기능 확장이 아니라 "이미 있는 타입 제약을 빌드가 실제로 검증하게 만드는" 방어 강화이며
    런타임 동작에는 영향이 없다(`void _auditActionForNarrows`).
  - 제안: 조치 불요.
- **[INFO]** 주석 추가 1건도 직전 라운드 documentation INFO #12 의 명시적 요청과 일치
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` `create()` 의
    `recordAudit` 호출 직전 (`saved = ...` 다음 줄)
  - 상세: 추가된 주석 "커밋 뒤 기록 — `saveWithDefaultSwap` 분기는 트랜잭션이라, 안에서
    기록하면 롤백 시 일어나지 않은 생성이 감사에 남는다. (다른 진입점·서비스와 같은 규칙.)"
    는 직전 라운드 INFO #12가 지목한 "`ModelConfigService.create()` 만 커밋 후 기록 근거
    주석이 없다"는 갭을 그대로 메운 것으로, 동일 파일 `setDefault()`/`remove()` 및 다른
    3개 서비스의 기존 주석과 문구·형식이 대칭이다. 코드 동작 변경은 없다(주석-only).
  - 제안: 조치 불요.
- **[INFO]** 부수 변경(plan/RESOLUTION) 도 권한·목적에 부합
  - 위치: `plan/in-progress/spec-sync-auth-gaps.md` (신규 체크박스 1개, +8줄),
    `review/code/2026/08/01/10_05_53/RESOLUTION.md` (8차 리뷰 절 추가, +38줄)
  - 상세: 코드 변경과 무관해 보일 수 있으나 둘 다 CLAUDE.md 가 `developer` 역할에 명시
    허용한 쓰기 경로(`plan/**`, `review/**/RESOLUTION.md`)이고, 내용도 이번 커밋이 다루지
    않은 직전 라운드 WARNING #1(트리거 시크릿/토큰 회전 3종 감사 누락 — spec 카탈로그에
    대응 액션이 없어 planner 선행 필요)을 후속 추적하기 위한 것이다. "조치 안 한 항목을
    plan 에 남긴다"는 팀 관례에 부합하며 코드 diff 를 부풀리지 않았다.
  - 제안: 조치 불요.

포맷팅·주석 잡음·미사용 임포트·설정 파일 변경·기능 확장(over-engineering) 은 발견되지
않았다. 두 커밋 모두 diff 가 각각 4줄 이하(치환 1줄)~18줄(신규 가드, append-only)로 매우
작고, 손댄 모든 줄이 커밋 메시지가 명시한 단일 목적(직전 리뷰 WARNING #6·INFO #11·INFO #12
조치)에 직접 대응한다.

## 요약

이번 리뷰 대상인 `audit-action.const.ts`/`model-config.service.ts`/`schedules.service.ts`/
`triggers.service.ts`/`workflows.service.ts` 5개 파일에 대한 실제 변경분(직전 리뷰 라운드
`18_44_56` 이후 커밋 `8f4bcc378`+`b77c62bbd`)은 그 직전 리뷰 SUMMARY 가 명시적으로 권고한
WARNING #6(maintainability, AuditActionFor 리터럴-상수 이중화)·INFO #11(testing, 타입 제약
회귀 가드 부재)·INFO #12(documentation, 주석 누락) 세 항목을 정확히, 그리고 그것만 조치했다.
각 파일의 diff 는 1~4줄 수준의 최소 치환이거나 순수 append 이며, 무관한 리팩토링·포맷팅·
임포트 정리·기능 확장은 없다. plan/RESOLUTION 변경도 developer 쓰기 권한 범위 내에서
"조치하지 않은 WARNING #1을 planner 인계용으로 기록"하는 목적에 부합한다.

## 위험도
NONE
