### 발견사항

- **[WARNING]** 동일 식별자(`NOT_A_MEMBER`·`INVALID_PASSWORD`) 등재 작업이 다른 in-progress plan 에도 미종결 항목으로 남아 있음 — cross-reference 누락
  - target 신규 식별자: `NOT_A_MEMBER`(§1.2 표), `INVALID_PASSWORD`(§1.2 표) — target 이 `spec/5-system/3-error-handling.md §1.2` 에 신규 행으로 등재하려는 코드
  - 기존 사용처: `plan/in-progress/error-codes-catalog-sot.md` L56-57 — "`NOT_A_MEMBER`(403, workspace switch)·`INVALID_PASSWORD`(change-password) 도 §1 미등재 — 동일 완결성 pass 에서 흡수" 라는 **미체크 backlog 항목**으로 정확히 동일한 두 코드의 §1(`3-error-handling.md`) 등재를 이미 과제로 지목해 놓았다. 해당 plan 은 PR #882(`error-codes-catalog-sot-e09193`, MERGED)로 주 작업(§1.2.1·§1.8)을 완료했지만 이 잔여 bullet 이 미체크라 `plan/in-progress/`에 계속 남아 있다.
  - 상세: 식별자 의미 충돌은 아니다(두 plan 모두 동일 의미로 동일 코드를 가리킴). 그러나 target 문서는 `error-codes-catalog-sot.md` 를 전혀 참조하지 않은 채 동일 코드를 동일 파일(`3-error-handling.md`) 동일 섹션(§1.2)에 독자적으로 추가하려 한다. `error-codes-catalog-sot.md` 는 plan-lifecycle 상 여전히 "in-progress"(미체크 항목 존재)이므로, target 작업 완료 후에도 그 plan 이 자동으로 정리되지 않고 동일 scope 를 가리키는 두 개의 열린/반쯤 열린 추적 항목이 공존하게 된다. 만약 향후 그 plan 의 worktree(`error-codes-catalog-sot-e09193`)가 다시 활성화되어 잔여 bullet 이 독립적으로 처리된다면, 동일 위치에 동일 코드 행이 중복 삽입되거나 서로 다른 표 포맷(§1.2 flat 4열 vs §1.2.1 스타일 "도메인 SoT" 3열)으로 충돌 삽입될 위험이 있다.
  - 제안: target 의 워크플로 체크리스트(또는 spec 반영 커밋)에 `plan/in-progress/error-codes-catalog-sot.md` L56-57 bullet 을 체크 완료 처리하고 "본 항목은 `catalog-residual-codes` PR 로 흡수·완료" 로 주석을 남기는 단계를 추가한다. 그 결과 해당 plan 의 남은 체크박스가 모두 완료되면 자연스럽게 `plan/complete/` 이동 대상이 된다(plan-lifecycle 규약).

- **[INFO]** 신규 3행의 표 배치 스타일이 §1.2(flat) vs §1.2.1(도메인 SoT 컬럼) 두 기존 패턴 중 하나를 혼합 적용
  - target 신규 식별자: `NOT_A_MEMBER`·`INVALID_PASSWORD`·`PASSWORD_REQUIRED` (3행 모두 §1.2 메인 표에 삽입 예정)
  - 기존 사용처: `spec/5-system/3-error-handling.md` §1.2(코드|이름|설명|HTTP, 4열, `ADMIN_REQUIRED` 선례) vs §1.2.1(코드|status|설명|도메인 SoT, 4열이지만 마지막 컬럼이 전용 "도메인 SoT" 링크 — `WEBAUTHN_*`·`PASSWORD_INVALID`·`TOTP_INVALID` 등 도메인 spec 참조 코드 전용 하위 섹션)
  - 상세: target 의 3개 신규 코드는 모두 도메인 SoT(`1-auth.md §5`/`§2.3.C`)를 인라인 마크다운 링크로 설명 열에 박아 넣는데, 이는 구조적으로 §1.2.1 이 "도메인 spec 참조" 코드를 위해 이미 만들어 둔 전용 컬럼 패턴과 더 가깝다. `ADMIN_REQUIRED` 선례는 인라인 코드 위치(`WorkspacesService.assertAdmin()`)만 언급할 뿐 도메인 spec 절 링크는 달지 않는다는 점에서 target 이 인용한 선례와 실제 채택 형식(도메인 spec 링크 inline) 사이에 미세한 불일치가 있다. 충돌은 아니며 명명 자체엔 영향 없음.
  - 제안: 표 형식 통일성만 원하면 §1.2.1 을 "2FA/WebAuthn/재인증" 전용 명칭에서 "도메인 spec 참조 코드" 로 일반화하고 3코드를 그쪽으로 옮기는 대안도 검토 가능 — 단, target 이 §1.2(비-도메인 코드들과 같은 자리)를 택한 것도 `ADMIN_REQUIRED`(워크스페이스 도메인 로직이지만 §1.2 소속) 선례로 방어 가능하므로 반드시 수정할 필요는 없음(INFO).

### 요약
target 이 신규 등재하려는 `NOT_A_MEMBER`·`INVALID_PASSWORD`·`PASSWORD_REQUIRED` 3개 에러 코드는 코드베이스(`auth.service.ts`·`users.service.ts`·`workspaces.service.ts`)와 기존 spec 산문(§5, §2.3.C, §2.3, §1.2.1)에서 이미 각각 단일하고 일관된 의미로만 쓰이고 있어 "동일 식별자가 다른 의미로 이미 사용 중"인 CRITICAL 충돌은 발견되지 않았다. 특히 `INVALID_PASSWORD`(비밀번호 변경) ≠ `PASSWORD_INVALID`(재인증/재확인) ≠ `PASSWORD_REQUIRED`(재확인 미설정·미입력)의 3중 근접명명은 target 이 정확히 기존 §1.2.1 각주(L67)의 구분을 그대로 계승·명시하고 있어 오히려 기존 혼동 리스크를 낮춘다. 다만 동일한 두 코드(`NOT_A_MEMBER`·`INVALID_PASSWORD`)를 동일 위치(`3-error-handling.md §1.2`)에 등재하는 작업이 `plan/in-progress/error-codes-catalog-sot.md` 에도 미체크 backlog 항목으로 남아 있고 target 은 이를 전혀 참조하지 않아, 두 plan 이 같은 scope 를 각자 추적하는 process-level 중복(추후 재작업 시 중복/충돌 삽입 위험)이 WARNING 으로 존재한다. 새 요구사항 ID·엔티티·API endpoint·이벤트명·환경변수·spec 파일 경로 신설은 없다(전부 기존 요소 문서화/등재).

### 위험도
LOW
