# 변경 범위(Scope) 리뷰 — WebAuthn credential 동시 삭제 중복 감사 수정 (아홉 번째/마지막 자리)

## 검토 방법

이번 diff(`origin/main...HEAD`, 44개 파일, +3034/-18)를 `git log --oneline`·`git show --stat <sha>`
로 커밋 단위까지 쪼개 확인했다. 44개 파일 중 실제 코드/문서 변경은 6개(`CHANGELOG.md`,
`webauthn.service.ts`, `webauthn.service.spec.ts`, 신규 e2e, plan 문서 2개)이고, 나머지
38개는 이 저장소 규약(`CLAUDE.md` "코드 리뷰 산출물"/"일관성 검토 산출물" 저장 위치 +
developer SKILL 의 REVIEW WORKFLOW 강제)에 따라 이번 세션이 스스로 생성·커밋한
`review/code/2026/09/21/18_03_54/**`·`review/code/2026/09/21/18_31_57/**`·
`review/consistency/2026/09/21/17_39_06/**` 리뷰 산출물이다. 이 산출물 생성·커밋은 프로젝트가
상시 승인한 강제 절차이므로 스코프 이탈로 보지 않는다.

또한 이전 두 리뷰 라운드(18_03_54, 18_31_57)에서 나온 WARNING 들이 이후 커밋
(`d3127c8a6`, `69bd6ea84`, `89566e3d5`, `ee6fd5d56`, `7b71e9a4a`)으로 조치됐다. 각 fix 커밋을
`git show --stat` 으로 개별 확인한 결과, 예외 없이 **그 WARNING 이 지목한 파일 단 하나만**
건드렸다(예: `89566e3d5` → e2e 파일 1개, `ee6fd5d56` → plan 트래커 1개, `7b71e9a4a` →
`CHANGELOG.md` 1개). fix-루프 자체에서 새로운 스코프 이탈은 없다.

## 발견사항

- **[INFO]** 핵심 버그 수정(`affected` 판정)과 소유권 스코핑 강화(`userId` 조건 추가)가 같은
  hunk 에 묶여 있음
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts`,
    `deleteCredential()` — `const { affected } = await this.credentialRepo.delete({ id: credentialUuid, userId })` 문장.
  - 상세: PR 표제 결함("동시 DELETE 두 건이 감사를 두 번 남긴다")을 고치는 데 필요·충분한
    변경은 `affected` 판정 추가뿐이다. 조건절에 `userId` 를 더한 것은 `findOne` 단계에서 이미
    JS 비교로 걸러지는 조건이라 정상 경로에는 관측 가능한 동작 차이가 없는 부가 방어
    강화(defense-in-depth)다. 다만 `plan/in-progress/webauthn-dup-delete.md` §B 에 사전
    근거가 명시돼 있고, 형제 8개 PR(#1369~#1375)이 동일하게 조건절에 스코프를 추가해 온
    확립된 패턴이며, 변경 자체가 파라미터 1개 추가로 매우 작다. 이미 직전 스코프 리뷰
    (`review/code/2026/09/21/18_03_54/scope.md`)가 같은 관찰을 남기고 조치 불요로 판정했다 —
    재조사 결과 동일한 결론에 도달한다.
  - 제안: 조치 불요. (선택) 커밋 메시지에 "감사 중복 수정" 외 "DELETE 조건절 소유권 스코핑
    강화"가 부수적으로 포함됨을 한 줄 언급하면 다음 리뷰어의 재추적 비용을 줄인다.

- **[INFO]** `throwCredentialNotFound()` 헬퍼 추출이 이번 버그와 무관한 `renameCredential()`
  의 기존 두 throw 지점까지 포함함
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` — 함수
    `renameCredential`(신설 헬퍼 호출부 2곳) 및 신설 `private throwCredentialNotFound(): never`.
  - 상세: 엄밀히 말해 "동시 삭제 감사 중복" 버그 수정에 `renameCredential` 의 리터럴 통합은
    필수가 아니다. 다만 이 리팩터는 이번 PR 자체가 새로 발의한 것이 아니라, 같은 세션의
    1차 리뷰 라운드(`review/code/2026/09/21/18_03_54/maintainability.md` WARNING)가 "형제
    두 파일(`auth-configs.service.ts`·`model-config.service.ts`)이 이미 적용한 헬퍼 추출
    패턴을 이 파일만 놓쳤다"고 명시적으로 지적한 데 대한 조치이고, 별도 커밋(`d3127c8a6`)이
    정확히 이 항목(+ JSDoc `@throws`)만 다뤄 스코프가 오염되지 않았다. 같은 파일·같은 에러
    코드·같은 결함 클래스의 형제 8건이 확립한 패턴을 따르는 낮은 비용의 일관성 수정이라
    "요청하지 않은 기능 추가"보다는 "요청받은(리뷰가 지적한) 정리"에 가깝다.
  - 제안: 조치 불요 — 이미 근거와 함께 기록·완료됨.

- **[INFO]** `CHANGELOG.md` 취소선 표기가 마크다운 `~~...~~` 와 HTML `<del>...</del>` 두 형식으로
  혼용됨
  - 위치: `CHANGELOG.md` — `## Unreleased — ... model_config.delete ...` 섹션의 "남는 것"
    단락(마크다운 `~~`) 대비 `## Unreleased — ... auth_config.delete ...` 섹션의 "남는 것"
    단락(HTML `<del>`).
  - 상세: 순수 포맷팅 불일치처럼 보이지만, `auth_config` 섹션 쪽은 취소 대상 텍스트 안에
    이미 중첩된 `~~캐시 무효화 통지 ...~~` 취소선이 있어 마크다운 취소선을 한 번 더 씌우면
    파싱이 모호해지는 문제를 피하려고 의도적으로 HTML 태그를 썼다(커밋 `7b71e9a4a` 메시지에
    "기존 중첩 `~~...~~` 각주와 충돌하지 않게 함"으로 명시). 결함이 아니라 근거 있는 선택.
  - 제안: 조치 불요 — 참고 기록만.

## 검증한 사항 (문제 없음 확인)

- `webauthn.service.spec.ts` diff 는 기존 `describe('deleteCredential', ...)` 블록 끝에 새
  `describe('동시 삭제', ...)` 하나만 추가하며 기존 테스트·import·설정을 건드리지 않는다.
- 신규 e2e 파일은 이 결함 하나(및 그 반증된 이종-credential 경합 가설)만 검증하며, 기존
  e2e 파일을 수정하지 않는다.
- `webauthn.controller.ts`(실제 감사 로그를 남기는 지점)는 이번 diff 에 전혀 등장하지 않는다
  — 서비스 계층의 `{ remaining }` 반환 계약이 그대로 유지되므로 컨트롤러 변경이 불필요하다는
  plan 의 주장과 일치한다.
- 포맷팅 전용 변경(공백·줄바꿈만 바뀐 hunk), 사용하지 않는 임포트 추가/정리, 설정 파일
  변경은 이번 diff 6개 코드/문서 파일 어디에도 없다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 변경분은 이 PR 의 착수
  게이트 이행 표시 + 새로 발견한 두 항목(§1.11 오류, e2e 헬퍼 추출 결정) 등재에 한정되며,
  트래커의 다른 무관한 섹션은 건드리지 않는다.
- WARNING fix 3커밋(`89566e3d5`·`ee6fd5d56`·`7b71e9a4a`)은 각각 정확히 1개 파일만 수정해
  fix-루프 자체의 스코프 이탈이 없다.

## 요약

핵심 프로덕션 변경은 `webauthn.service.ts` 의 `deleteCredential()` 한 곳(`affected` 판정
추가)으로, 표제 결함 수정에 근접하게 좁혀져 있다. 같은 hunk 에 묶인 `userId` 조건 추가는
plan 문서에 사전 근거가 있고 형제 8개 PR 과 일관된 defense-in-depth 라 우려할 스코프
이탈이 아니며, `renameCredential` 까지 포함한 `throwCredentialNotFound()` 헬퍼 추출도 별도
커밋으로 분리되고 직전 리뷰 라운드의 명시적 지적에 대한 조치임이 커밋 메시지·plan
문서로 확인된다. 44개 변경 파일 중 다수(38개)가 코드가 아닌 `review/**` 산출물이지만
이는 이 프로젝트의 REVIEW WORKFLOW 가 강제하는 정상 산출물이며, 각 WARNING fix
커밋도 단일 파일 단위로 정확히 스코프됐다. 포맷팅·임포트·설정 파일의 무관한 변경은
발견되지 않았다.

## 위험도

LOW
