# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 공개 API 관측 가능 동작 변경 (인터페이스 변경, 문서화·경고 완료)
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:65` (`decodeCursor`), `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:178-180` (`decodeCursor`)
  - 상세: 두 `decodeCursor` 모두 커서의 `id`/`i` 성분에 `isUuidShaped` 검증을 새로 추가해, 비-UUID 값이 왔을 때의 관측 가능한 응답이 바뀐다 — `GET /api/users/me/login-history` 는 500→200(커서 무시, 1페이지), `GET /api/executions/:executionId/background-runs/:backgroundRunId` 는 500→400 `INVALID_CURSOR`. 이는 "잘못된 커서로 5xx 를 받던 모니터링이 이제 그 신호를 못 본다"는 실제 외부 관측자(모니터링·재시도 로직) 영향이 있는 side effect다. 다만 `CHANGELOG.md` 에 "⚠️ 배포 시 확인" 경고와 함께 명시적으로 고지되었고, 두 엔드포인트가 서로 다른 처분(무시 vs 400)을 유지하기로 한 것도 각 디코더의 기존 실패 계약에 맞춘 의도된 선택이라고 `plan/in-progress/keyset-cursor-uuid-validation.md §A/처분` 에 근거가 남아 있다. 함수 시그니처(`decodeCursor(raw)` → `{ts,id}|null`, private 메서드)는 변경되지 않아 코드 레벨 호출자 영향은 없다.
  - 제안: 추가 조치 불요 — 이미 CHANGELOG 경고·plan 근거·회귀 테스트(뮤테이션 6/6 포함)로 처리됨. 후속 관찰 항목(두 계약의 비대칭 통일 여부)은 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 별도 planner 항목으로 등재되어 있다.

- **[INFO]** 공유 유틸리티(`isUuidShaped`) 신규 소비처 추가 — 부작용 없음
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:8`, `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:22` (import 문)
  - 상세: `common/utils/uuid.ts` 의 기존 `isUuidShaped` (신규 함수 아님, 이미 워크스페이스 컨텍스트 검증 등에 쓰이던 순수 함수)를 두 서비스에서 추가로 import 한다. 함수 자체는 수정되지 않았고 외부 상태·I/O 가 없는 순수 정규식 매칭이라, 기존 소비처(workspace-context 등)에 대한 회귀 위험은 없다.
  - 제안: 없음.

## 점검 결과 (해당 없음 확인)

- **전역 변수/상태**: 두 `decodeCursor` 모두 로컬 스코프의 순수 함수(입력→반환값/예외)로, 전역·모듈 스코프 변수를 읽거나 쓰지 않는다. 새 전역 변수 도입 없음.
- **파일시스템**: 프로덕션 코드(`login-history.service.ts`, `background-runs.service.ts`)에는 파일 I/O가 없다. `CHANGELOG.md`·`plan/**` 두 문서 파일은 리뷰 대상 자체의 정상적인 편집물이며 스크립트에 의한 예기치 못한 생성·삭제가 아니다.
- **시그니처 변경**: `decodeCursor`(양쪽 모두 module-private) 시그니처 불변. `findForUser`, `getBackgroundRun` 등 공개 서비스 메서드 시그니처도 불변 — 컨트롤러·호출자 코드 변경 불필요.
- **환경 변수**: 읽기/쓰기 없음.
- **네트워크 호출**: 신규 외부 호출 없음. 변경은 이미 존재하는 DB 바인딩 전 단계의 입력 검증만 추가한다(오히려 잘못된 값이 Postgres 까지 가는 것을 차단해 불필요한 왕복을 줄인다).
- **이벤트/콜백**: 이벤트 발행·콜백 구조 변경 없음.
- **테스트 파일 변경**(`login-history.service.spec.ts`, `background-runs.service.spec.ts`): 로컬 mock/fixture 추가·수정뿐이며 전역 jest 설정이나 다른 스펙에 영향을 주는 전역 mock이 아니다.
- **plan 문서**(`keyset-cursor-uuid-validation.md` 신설, `spec-draft-nullable-notation-followups.md` 항목 취소선 처리): 코드 실행에 영향 없는 순수 기록. `GlobalExceptionFilter` 는 이번 변경에서 손대지 않았다고 명시되어 있고, 실제 diff에도 해당 파일 변경이 없다 — "필터를 고치지 않는다"는 plan 서술과 실제 diff가 일치함을 확인했다.

## 요약

이번 변경의 핵심 부작용은 두 keyset 커서 디코더가 `id` 성분을 `isUuidShaped` 로 추가 검증하면서 발생하는 **의도된 관측 가능 동작 변경**(500→200 / 500→400)이다. 이는 전형적인 "인터페이스 변경이 기존 사용자에 미치는 영향" 케이스이지만, CHANGELOG 의 명시적 배포 경고, plan 문서의 근거(`§A` won't-do 결정, `§B` 처분 표), 그리고 뮤테이션 테스트(6/6)로 충분히 문서화·검증되어 있다. 전역 상태·파일시스템·환경 변수·네트워크·이벤트 콜백 축에서는 예기치 않은 부작용이 관찰되지 않았고, 함수 시그니처도 변경되지 않아 코드 레벨 호출자 영향은 없다. `GlobalExceptionFilter` 를 건드리지 않기로 한 plan 상의 결정도 실제 diff와 일치함을 확인했다.

## 위험도

LOW
