# 신규 식별자 충돌 검토 — `spec-draft-error-code-two-surfaces.md`

## 발견사항

없음.

target 문서(`plan/in-progress/spec-draft-error-code-two-surfaces.md`)가 `spec/conventions/error-codes.md`
§Overview "적용 범위" 문단에 도입을 제안하는 두 식별자를 실측했다.

- `ErrorCode` — `codebase/backend/src/nodes/core/error-codes.ts:8` 에 이미 선언돼 있고,
  `spec/conventions/error-codes.md` 자신을 포함해 spec/ 9개 파일이 **이미 같은 의미**로
  참조 중이다(`spec/5-system/3-error-handling.md`, `spec/5-system/4-execution-engine.md`,
  `spec/conventions/node-output.md` 등). target 은 이 이름을 **재사용**할 뿐 새로 붙이지 않는다.
- `EngineErrorCode` — `codebase/backend/src/nodes/core/error-codes.ts:147` 에 이미 선언돼 있다.
  `grep -rn "EngineErrorCode" spec/` 결과 **spec/ 전체에서 지금까지 한 번도 언급되지 않았다** —
  target 은 이 이름을 spec/ 코퍼스에 **처음 도입**하지만, 코드베이스 전체(`error-codes.ts`,
  `error-codes.spec.ts`, `engine-error-code-anchor*.ts`, `execution-engine.service.ts`,
  `shutdown-state.service.ts`)에서 정의·사용처가 **하나로 일관**돼 있고 다른 의미로 쓰이는
  곳이 없다. `error-codes.spec.ts:59` 의 `overlap` 단언이 `ErrorCode`/`EngineErrorCode` 두
  네임스페이스의 키 무교집합을 코드 레벨에서 고정하므로, 두 이름을 나란히 문서화해도
  값 충돌 가능성이 없다.

기타 관점 확인 결과:

- **요구사항 ID** — target 은 `error-codes.md` 에 새 `§N` 섹션이나 표 ID를 신설하지 않는다.
  기존 §Overview "적용 범위" 문단 안에 불릿 3개를 추가하는 편집이라 ID 충돌 표면 자체가 없다.
- **API endpoint** — 신규 endpoint 없음.
- **이벤트/메시지명** — 신규 없음.
- **환경변수·설정키** — 신규 없음.
- **파일 경로** — target 의 plan 파일명 `spec-draft-error-code-two-surfaces.md` 는
  `plan/in-progress/` 의 기존 명명 컨벤션(`spec-draft-*` 접두, 예: `spec-draft-eia-62-waiting-payload.md`,
  `spec-draft-eia-notification-payload-contract.md`)을 그대로 따르고, 동일 파일명 충돌도 없다.
  spec_impact 대상 `spec/conventions/error-codes.md` 는 기존 파일(신규 파일 생성 아님)이라
  경로 충돌 표면이 없다.

## 요약

target 문서가 새로 "도입"하는 식별자는 사실상 없다 — `ErrorCode`/`EngineErrorCode` 둘 다 코드베이스에
이미 존재하는 자매 const 이고, 문서는 이미 있는 사실(특히 `EngineErrorCode`)을 spec/ 에 처음으로
반영할 뿐이다. `EngineErrorCode` 는 spec/ 코퍼스 최초 언급이지만 코드 정의·용례가 단일하고 값 집합이
`ErrorCode` 와 겹치지 않음이 테스트로 고정돼 있어 신규 식별자 충돌 관점에서 문제가 없다. 요구사항 ID·
엔티티/DTO·API endpoint·이벤트명·환경변수·파일 경로 어느 축에서도 충돌 후보가 발견되지 않았다.

## 위험도
NONE
