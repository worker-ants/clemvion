# 변경 범위(Scope) 검토 — webauthn-dup-delete

## 발견사항

- **[INFO]** 핵심 결함(감사 중복) 수정에 소유권 스코핑 강화(`userId` 조건 추가)가 같은 diff hunk 에 묶여 있음
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` — `deleteCredential()`, 변경된 코드 블록의 `const { affected } = await this.credentialRepo.delete({ id: credentialUuid, userId });` (게이트 549~552)
  - 상세: PR 의 표제 결함은 "동시 DELETE 두 건이 `user.2fa_disabled` 감사를 두 번 남긴다" 이고, 이를 고치는 데 필요·충분한 변경은 `delete()` 의 반환값 `affected` 를 판정에 쓰는 것뿐이다. 그런데 같은 statement 에서 DELETE 조건절에 `userId` 를 추가해 소유권 스코핑도 함께 강화했다. 이 자리는 이미 `findOne` 단계에서 `credential.userId !== userId` 를 확인하고 있어(위 컨텍스트 523~526줄), 정상 경로에서는 `userId` 추가가 관측 가능한 동작 차이를 만들지 않는다 — 방어 종심(defense-in-depth) 성격의 부가 변경이다.
  - 다만 이것이 "의도 이상의 변경"으로 보기 어려운 이유: (1) `plan/in-progress/webauthn-dup-delete.md` §B 표의 "DELETE 스코핑" 행에 이 변경이 사전에 명시적으로 예고·정당화되어 있고, "형제들이 워크스페이스/소유자 스코프를 조건절에 넣은 강화를 여기도 적용한다" 는 근거가 붙어 있다. (2) 같은 계열의 선행 8개 PR(#1369~#1375)이 동일하게 조건절에 스코프를 추가해 온 확립된 패턴이라, 이 자리만 예외로 남기면 오히려 불일치가 된다. (3) 코드 변경 자체는 1개 파라미터 추가로 매우 작다.
  - 제안: 그대로 두어도 무방하다 — 조치 불요. 다만 커밋 메시지/PR 설명에 "감사 중복 수정" 외에 "DELETE 조건절 소유권 스코핑 강화"가 부수적으로 포함됨을 한 줄 언급해 두면, 다음 리뷰어가 이 hunk 를 볼 때 "왜 버그 수정 diff에 조건절이 하나 늘었나" 를 다시 추적할 필요가 없다.

- **[INFO]** 코드 변경 대비 비-코드 산출물(plan/tracker + consistency 리포트)의 부피가 크다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (트래커, diff 2개 hunk, 새 체크리스트 항목 3개 추가), `plan/in-progress/webauthn-dup-delete.md` (신규 138줄), `review/consistency/2026/09/21/17_39_06/*` (신규 8개 파일)
  - 상세: 실제 결함 수정은 서비스 파일 1곳(약 30줄 추가)과 테스트 2개 파일뿐이다. 반면 plan/tracker 문서 diff 와 consistency-check 산출물은 그보다 훨씬 크다. 이는 스코프 이탈이 아니라 프로젝트 규약(`CLAUDE.md` — `impl-prep` 의무, plan 라이프사이클, 착수 게이트 결정을 트래커에 등재하는 절차)이 요구하는 필수 프로세스 산출물이다. 트래커에 새로 추가된 두 항목(§`3-error-handling.md §1.11` 오류 문장 지적, e2e 헬퍼 추출/`isDeleteMiss` 유틸 미추출 결정 등재)도 이번 PR 코드에는 반영되지 않고 모두 "다음 PR/다음 planner 턴" 으로 명시적으로 유예되어 있어, 코드 스코프를 침범하지 않는다.
  - 제안: 조치 불요 — 프로젝트 규약상 정상적인 형태다.

## 그 외 확인했으나 문제 없음

- `webauthn.service.spec.ts` 의 diff는 파일 끝 `describe('deleteCredential', …)` 블록 안에 새 `describe('동시 삭제', …)` 하나만 추가하며, 기존 테스트·import·설정은 전혀 건드리지 않았다.
- 신규 e2e 파일(`webauthn-credential-delete-concurrency.e2e-spec.ts`)은 이 결함 하나만을 검증하며, 다른 계열 e2e 파일(`auth-config-delete-concurrency.e2e-spec.ts` 등)과 구조는 동일하지만 파일 자체는 별도로 추가돼 기존 파일을 건드리지 않았다.
- `webauthn.controller.ts`(감사 로그를 실제로 남기는 자리)는 이번 diff에 전혀 등장하지 않는다 — 서비스 계층의 반환 계약(`{ remaining }`)이 그대로 유지되므로 컨트롤러 변경이 불필요하다는 plan의 주장과 일치한다.
- 포맷팅·임포트·설정 파일 변경 없음. `webauthn.service.ts` 의 import 목록은 diff에 나타나지 않아 미변경으로 확인된다.
- 주석은 분량이 많지만(15줄) 전부 이번 변경 자체의 근거(반환값 판정 전환·`affected===0` 명시 비교 이유·소유권 스코핑 강화 근거)를 설명하는 데 쓰였고, 무관한 화제나 불필요한 삭제는 없다. 동일 계열 선행 8개 PR과 같은 주석 스타일이라 이 저장소의 확립된 관례로 보인다.

## 요약

핵심 프로덕션 변경은 `webauthn.service.ts`의 `deleteCredential()` 한 곳으로, "`affected` 를 버리지 않고 판정에 쓴다"는 표제 결함 수정에 매우 근접하게 좁혀져 있다. 유일하게 짚을 만한 지점은 같은 diff hunk에 소유권 스코핑(`userId` 조건 추가)이라는 부수적 방어 강화가 섞여 있다는 것이지만, plan 문서에 사전 근거가 명시돼 있고 형제 8개 PR과 일관된 패턴이라 우려할 수준의 스코프 이탈은 아니다. 테스트·e2e 파일은 결함 재현에만 집중돼 있고, plan/tracker·consistency 산출물은 프로젝트가 요구하는 프로세스 문서로 코드 스코프를 침범하지 않는다. 포맷팅·임포트·무관한 파일 수정은 발견되지 않았다.

## 위험도

LOW
