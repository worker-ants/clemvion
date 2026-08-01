# 부작용(Side Effect) Review

## 조사 방법

프롬프트가 준 5개 파일은 unified diff 없이 "전체 파일 컨텍스트"만 제공되므로, 실제 변경분을
`git diff 41fc32d24..HEAD -- <5개 파일>` (직전 리뷰 라운드 `review/code/2026/08/01/18_44_56`
시점 대비 현재 HEAD)로 직접 재구성해 확인했다. 이 5개 파일에 대한 실제 변경은 커밋
`8f4bcc378`(AuditActionFor 리터럴 → RESOURCE_TYPE 상수 결속)과 `b77c62bbd`(빌드 가드 +
누락 주석 추가) 두 건뿐이다. 추가로 audit-logging 기능 전체(merge-base
`316fa3fd3` 대비)의 diff, `AuditLogsService.record()` 구현체, 4개 `*.module.ts` DI 배선,
컨트롤러/기타 서비스의 모든 호출부를 grep 으로 전수 조사해 이번 라운드 변경이 그 위에 새
부작용을 얹지 않는지 교차검증했다.

## 발견사항

- **[INFO]** 이번 라운드(41fc32d24→HEAD)의 실제 diff 는 런타임 동작에 영향이 없는 타입/주석
  변경뿐이다.
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:245`,
    `codebase/backend/src/modules/schedules/schedules.service.ts:147`,
    `codebase/backend/src/modules/triggers/triggers.service.ts:215`,
    `codebase/backend/src/modules/workflows/workflows.service.ts:184` (4곳 모두
    `AuditActionFor<'model_config'>` 형태의 리터럴을 `AuditActionFor<typeof
    MODEL_CONFIG_RESOURCE_TYPE>` 형태로 치환 — `private recordAudit(params: {...})` 의
    `action` 필드 타입 선언부, 함수 시그니처·바디·호출부는 미변경)
  - 상세: 이 치환은 TypeScript 타입 인자만 바꾼다(대상 `const *_RESOURCE_TYPE = '...'` 가
    `as const` 없이도 `const` 추론으로 리터럴 타입이 유지되므로 `Extract<AuditAction,
    `${P}.${string}`>` 의 실제 좁혀지는 집합은 치환 전후 동일). 컴파일 결과물(JS)에 타입
    인자는 남지 않으므로 런타임 바이트코드 자체가 변경되지 않는다. 나머지 3개 관점
    (전역변수·파일시스템·환경변수·네트워크 호출·이벤트/콜백)에도 해당 사항 없음.
  - 제안: 없음.

- **[INFO]** `audit-action.const.ts` 말단에 신규 컴파일-타임 가드 블록이 추가됐다 — 런타임
  부작용은 `void` 처리된 상수 대입 1회뿐이라 무해하다.
  - 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts:121-124`
    (`type _NoCrossDomain = 'trigger.created' extends AuditActionFor<'workflow'> ? never :
    true;` / `const _auditActionForNarrows: _NoCrossDomain = true;` / `void
    _auditActionForNarrows;`)
  - 상세: 모듈 로드 시 `const _auditActionForNarrows = true` 대입 후 즉시 `void` 로 버려지는
    문장이 1회 실행되지만, 이는 다른 모듈 상태를 읽거나 쓰지 않는 순수 리터럴 대입이라
    "의도치 않은 상태 변경"에 해당하지 않는다. 목적은 빌드(`tsc`/`nest build`) 단계에서
    `AuditActionFor<P>` 가 실제로 cross-domain 값을 배제하는지 검증하는 것이며, 검증 실패 시
    컴파일 자체가 깨져 빌드가 막힌다(런타임 도달 불가) — 부작용이 아니라 방어 강화다.
    다른 export(`AUDIT_ACTIONS`, `AuditAction`, `AuditActionFor`)는 손대지 않아 4개
    서비스의 기존 `recordAudit` 타입 바인딩에 영향 없음.
  - 제안: 없음.

- **[INFO]** `model-config.service.ts` 에 주석 1줄 추가 — 코드 동작 변경 없음.
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:287-288`
    (`create()` 의 `saved = ...` 직후, `recordAudit` 호출 직전)
  - 상세: "커밋 뒤 기록 — `saveWithDefaultSwap` 분기는 트랜잭션이라, 안에서 기록하면 롤백 시
    일어나지 않은 생성이 감사에 남는다" 주석만 추가됐고, 그 아래 `await this.recordAudit(...)`
    호출·인자·위치는 치환 전후 바이트 단위로 동일하다.
  - 제안: 없음.

- **[INFO, 참고]** 이번 라운드가 손대지 않은 audit-logging 기능 본체(merge-base 대비 전체
  diff)는 직전 라운드(`review/code/2026/08/01/18_44_56/side_effect.md`)에서 이미 위험도
  LOW 로 평가·수렴됐고, 이번 diff 는 그 판단에 영향을 주는 어떤 줄도 건드리지 않았다 —
  재확인 목적으로만 교차검증했다.
  - 위치: (참고 정보 — 특정 신규 위치 없음)
  - 상세: `AuditLogsService.record()`(`codebase/backend/src/modules/audit-logs/audit-logs.service.ts:81-96`)
    는 여전히 전체를 `try/catch` 로 감싸 실패를 삼키므로(`logger.warn` 만 남김) 4개 서비스의
    `recordAudit` 호출이 원본 mutation(생성/수정/삭제) 응답을 깨뜨리지 않는다. 4개
    `*.module.ts` 의 `AuditLogsModule` import 배선(순환 의존 없음), 4개 서비스 공개 메서드의
    `userId` 파라미터 추가(모든 호출부가 컨트롤러뿐이며 전부 갱신됨, orphaned caller 없음)도
    이번 diff 로 재검토했으나 변화가 없어 직전 판단이 그대로 유효하다.
  - 제안: 없음(직전 라운드 INFO 항목 — `userId` 파라미터 위치가 서비스 간 비일관 — 은 이미
    "필수 대응 아님"으로 처리됐고 이번 diff 범위 밖이라 재론하지 않음).

## 요약

이번 라운드에서 5개 대상 파일에 실제로 반영된 변경(`8f4bcc378`+`b77c62bbd`)은 `AuditActionFor`
타입 인자를 문자열 리터럴에서 이미 존재하는 `*_RESOURCE_TYPE` 상수의 `typeof` 로 바꾼 4곳의
치환, 순수 append 인 컴파일-타임 가드 블록 1개, 주석 1줄 추가뿐이다. 넷 다 컴파일 결과물(런타임
동작)에 아무 영향이 없다 — 시그니처·DB 쓰기·네트워크 호출·이벤트 발생·전역 상태·환경 변수·
파일시스템 어디에도 새 부작용이 없다. 이 5개 파일이 속한 audit-logging 기능 전체(감사 로그
INSERT 부작용, 4개 서비스 공개 메서드 `userId` 파라미터 추가, DI 배선)는 이미 직전 라운드에서
위험도 LOW 로 평가·수렴됐으며 이번 diff 는 그 결론에 영향을 주는 부분을 전혀 건드리지 않았다.
Critical/Warning 급 부작용은 발견되지 않았다.

## 위험도

NONE
