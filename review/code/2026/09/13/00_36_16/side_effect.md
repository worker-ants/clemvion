# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** `background-runs.service.ts` 의 `decodeCursor` 검증 추가로 "타 워크스페이스 + 잘못된 커서" 요청의 응답 코드가 404 → 400 으로 바뀐다 (관측 가능한 API 동작 변경, CHANGELOG 에는 미기재)
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:93` (`decodeCursor` 호출), `:95` (`verifyExecutionAccess` 호출), 신규 검증은 `:178`-`180`
  - 상세: `getBackgroundRun` 은 `decodeCursor(query.cursor)` 를 `verifyExecutionAccess(executionId, userWorkspaceId)` **보다 먼저** 호출한다(이 순서 자체는 기존 관행이며 이번 diff 가 만든 것은 아니다). 이번 diff 는 `decodeCursor` 안에 `if (!isUuidShaped(parsed.i)) { throw new Error(...) }` 를 추가했다. 그 결과, "존재하지 않거나 다른 워크스페이스 소유의 `executionId` + 형태가 잘못된 커서" 조합의 응답이 종전 **404**(`verifyExecutionAccess` 가 먼저 도달해 `EXECUTION_NOT_FOUND` 를 던짐)에서 **400**(`decodeCursor` 가 워크스페이스 검증 전에 먼저 거부)으로 바뀐다. 이는 인가(ownership) 체크보다 앞서 수행되는 검증이 새로 생겨, 소유권 확인에 도달하기 **전에** 응답 코드가 결정되는 경로가 하나 늘었다는 뜻이다. `plan/in-progress/keyset-cursor-uuid-validation.md` 의 3라운드 리뷰 항목(#1)에서 동일 지점이 이미 지적되었고, 되돌리는 대신 "정보 누설이 아니다(커서는 리소스 조회 전에 형태만으로 거부되므로 존재 여부를 구별하지 않는다)"는 근거로 테스트(`커서 검증이 소유권 검사보다 먼저 돈다 — 타 워크스페이스 + 잘못된 커서는 400 (404 아님)`)로 고정한 상태다. 논리적으로 정보 누설은 아니라는 설명은 타당하지만, **CHANGELOG.md 신규 항목은 "500→200" / "500→400" 두 축만 서술하고 이 404→400 우선순위 변화는 언급하지 않는다** — cross-workspace 요청 비율을 404 카운트로 모니터링/오탐지(enumeration 시도 탐지 등)하는 운영 대시보드가 있다면 이 재분류를 놓칠 수 있다.
  - 제안: 이미 검증·테스트된 변경이므로 리버트는 불필요. 다만 CHANGELOG 항목에 "타 워크스페이스 소유 리소스 + 형태 오류 커서 조합의 응답이 404 대신 400 이 될 수 있다"는 한 줄을 추가해, 코드 변경분을 넘어서는 이 문서와의 정합성을 갖추는 것을 권한다.

- **[INFO]** `isUuidShaped` 의 소비처가 인가 판단이 없는 신규 축(keyset 커서 `id`/`i` 성분)으로 확장됨 — 이미 자체적으로 인지·문서화된 side effect
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:61`, `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:178`
  - 상세: `isUuidShaped` 의 기존 JSDoc(및 관련 spec Rationale)은 원래 "워크스페이스 헤더 vs 경로 파라미터" 인가 컨텍스트를 주어로 서술돼 있었는데, 이번 diff 로 그 함수가 인가와 무관한 "리소스 지목(커서 id)" 용도로도 쓰이게 됐다. 함수 자체의 동작(정규식)은 변경되지 않았고, `uuid.ts`/`uuid.spec.ts` 문서화가 이 확장을 명시적으로 반영(닫힌 캐너리 목록을 열고 세는 법을 SoT 로 지정)했으므로 실질적 위험은 낮다. 공유 유틸리티의 "신뢰 경계 폭"이 넓어졌다는 점만 기록해 둔다 — 향후 이 함수의 판정 로직을 변경(예: 더 엄격한 패턴으로 교체)하면 워크스페이스 인가 경로와 커서 파싱 경로가 동시에 영향받는다는 점을 다음 변경자가 인지해야 한다.
  - 제안: 조치 불요(이미 `plan/in-progress/keyset-cursor-uuid-validation.md` §B 의 "적용 범위가 넓어진다" 각주로 다뤄짐). 참고용으로만 등재.

- **[INFO]** `decodeCursor`(양쪽 서비스) 는 여전히 exported 되지 않은 module-private/class-private 함수이며 시그니처 변경 없음 — 외부 호출자 영향 없음 확인
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:45`-`63`, `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:149`-`188`
  - 상세: 두 `decodeCursor` 모두 파일 내부(또는 클래스 내부) 전용이라 이번 검증 추가가 다른 모듈의 호출부에 영향을 주지 않는다. `isUuidShaped`/`isValidUuid` 두 export 함수 자체의 시그니처·구현도 무변경(문서만 추가)임을 `uuid.ts` 전체 컨텍스트로 확인했다.
  - 제안: 없음(확인용 기록).

## 검증용 뮤테이션 관련 메모

저장소 파일을 수정하지 않고 diff/전체 파일 컨텍스트 열람만으로 분석했다. `git status --short` 로 관측한 잔여 변경 없음(리뷰 중 어떤 파일도 쓰기/수정하지 않음).

## 요약

이번 변경은 두 keyset 커서 디코더(`login-history.service.ts`, `background-runs.service.ts`)에 `isUuidShaped` 검증을 추가해 비-UUID id 가 `uuid` 컬럼까지 흘러 22P02 → 500 으로 마스킹되던 결함을 막는다. 두 함수 모두 module/class-private 이라 외부 호출자·공개 시그니처에 영향이 없고, 전역 상태·파일시스템·환경변수·네트워크 호출·이벤트/콜백 관련 부작용은 발견되지 않았다. 유일하게 주목할 부작용은 `background-runs.service.ts` 에서 검증이 소유권 확인보다 먼저 실행되어 "타 워크스페이스 + 형태 오류 커서" 조합의 응답이 404 에서 400 으로 바뀐 것인데, 이는 이미 이전 리뷰 라운드에서 지적·검토되어 정보 누설이 아니라는 근거와 함께 테스트로 고정된 의도적 결정이다. 다만 그 세부(404→400 재분류)가 CHANGELOG 공개 변경 로그에는 반영돼 있지 않아 운영 모니터링 관점에서 문서 보강을 권고한다. 전반적으로 부작용 관점에서 새로 발견된 심각 이슈는 없다.

## 위험도

LOW
