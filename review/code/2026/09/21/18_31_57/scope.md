# 변경 범위(Scope) 검토 — webauthn-dup-delete (아홉 번째/마지막 자리, 재검토)

## 검증 방법

`git status --short` 로 작업 트리가 clean(이번 세션 디렉터리 생성 외 뮤테이션 없음)함을 확인했고,
`codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:485-565` 를 직접 `Read`(및 `sed`)로
열어 diff 게이트 숫자가 실제 파일 줄 번호와 일치함을 확인했다. 저장소에 어떤 파일도 쓰지 않았다.

## 발견사항

- **[INFO]** 핵심 결함 수정(`affected` 판정)과 소유권 스코핑 강화(`userId` 조건 추가)가 같은 hunk 에 묶여 있음
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:549-552`
    (`const { affected } = await this.credentialRepo.delete({ id: credentialUuid, userId })`)
  - 상세: PR 의 표제 결함("동시 DELETE 두 건이 감사를 두 번 남긴다")을 고치는 데 필요·충분한 변경은
    `delete()` 의 반환값을 판정에 쓰는 것뿐이다. `userId` 조건 추가는 별개의 방어 강화이며, 정상
    경로에서는 이미 위 `findOne` 뒤 JS 비교(`credential.userId !== userId`, 526행)로 걸러지므로
    관측 가능한 동작 차이를 만들지 않는다. 다만 `plan/in-progress/webauthn-dup-delete.md` §B 표에
    사전 근거("형제들이 워크스페이스 스코프를 조건절에 넣은 강화를 여기도 적용한다")가 명시돼 있고,
    형제 8건(#1369~#1375)이 동일하게 조건절 스코프를 추가해 온 확립된 패턴이라 예외로 남기는 쪽이
    오히려 불일치가 된다. 직전 라운드(`review/code/2026/09/21/18_03_54/scope.md` INFO #8)도 같은
    지점을 이미 짚었고 결론이 같다 — 재지적이되 새 문제는 아니다.
  - 제안: 조치 불요. 이미 plan §B 에 근거가 기록돼 있다.

- **[INFO]** `throwCredentialNotFound()` 헬퍼 추출이 이번 PR 이 원래 겨냥한 `deleteCredential()` 밖의
  `renameCredential()` 도 건드림
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:495-501`
    (`renameCredential` 의 두 `NotFoundException` throw 지점이 `this.throwCredentialNotFound()` 로 치환됨)
  - 상세: 이 PR 의 표제 결함은 `deleteCredential()` 의 동시 삭제 감사 중복이다. `renameCredential()` 은
    그 결함과 무관한 메서드인데, 이번 diff 가 그 안의 두 호출 지점까지 헬퍼로 치환했다. 다만 이는
    "요청 밖의 임의 리팩터"가 아니라 이전 리뷰 라운드(`review/code/2026/09/21/18_03_54/SUMMARY.md`
    WARNING #3 — "형제 두 파일은 이미 헬퍼로 추출했는데 이 파일만 인라인을 유지해 시리즈 내 일관성이
    깨졌다")의 지적을 같은 세션에서 즉시 반영한 결과이며, 이 프로젝트의 표준 워크플로(`/ai-review` →
    Critical/Warning 즉시 fix, `CLAUDE.md` "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무")가
    요구하는 조치다. 치환된 리터럴(`code`, `message`)은 원문과 동일해 `renameCredential()` 의 관측
    가능한 동작 변화는 없음을 직접 대조로 확인했다. 즉 "요청 이상의 변경"이라기보다 "리뷰가 요구한
    후속 조치"에 해당하지만, 스코프 경계(원래 요청 = deleteCredential 단일 메서드) 밖 파일 영역을
    건드린 것은 사실이므로 기록해 둔다.
  - 제안: 조치 불요 — 근거(WARNING #3 조치)가 `review/code/2026/09/21/18_03_54/RESOLUTION.md` 에
    남아 있다. 커밋 메시지(`d3127c8a6`)에도 "SUMMARY#3 404 헬퍼 추출"로 명시돼 추적 가능하다.

- **[INFO]** `CHANGELOG.md` 가 이번 PR 자신의 섹션 외에, 선행 두 형제 PR(`auth_config`·`model_config`)의
  기존 항목도 취소선으로 정정함
  - 위치: `CHANGELOG.md` (auth_config 섹션 게이트 90-94, model_config 섹션 게이트 133-138)
  - 상세: 두 곳 모두 이번 PR("아홉 번째이자 마지막 자리")을 전방 참조하던 "남는 것" 문구였고, 이번
    PR 이 그 참조 대상을 실제로 닫았으므로 취소선 + "해소 (2026-09-21, 아홉 번째 PR)" 각주로 정정한
    것이다. 원문은 취소선으로 남기고 새 문장만 덧붙이는 형태라 과거 서술을 지우지 않았다. 시리즈
    자체가 "마지막 자리가 닫히면 전방 참조를 정정한다"는 관례를 예고해 온 문서이므로, 이번 PR 범위
    안의 정당한 후속 조치로 판단한다.
  - 제안: 조치 불요.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커에 이번 버그와
  직접 관련 없는 새 planner 항목(§1.11 "`_NOT_FOUND`≠404 유일 예외" 문장이 거짓이라는 지적)이 추가됨
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` 게이트 4975-5001
  - 상세: 이 항목은 `deleteCredential()` 버그 자체와는 별개로, 같은 세션의
    `/consistency-check --impl-prep`(`review/consistency/2026/09/21/17_39_06` WARNING #1)이 부수적으로
    발견한 spec 서술 오류다. developer 는 `spec/` 쓰기 권한이 없으므로 직접 고치지 않고 planner 항목
    으로 등재만 한 것은 `CLAUDE.md` 의 역할 경계와 일치하며, 코드 스코프(webauthn.service.ts) 를
    침범하지 않는다 — 등재 자체가 스코프 이탈이 아니라 오히려 스코프를 지키기 위한 절차다.
  - 제안: 조치 불요.

- **[INFO]** 같은 트래커에 "동시성 e2e 공용 헬퍼 추출"(결정 1) 설계가 시그니처까지 구체적으로 등재됨
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` 게이트 5002-5031
  - 상세: 실제 구현(`raceUnderHeldLock()` 등)은 이번 PR 코드에 전혀 없다 — `grep` 대상 0건임을 이번
    라운드의 `naming_collision.md` 가 이미 확인했다. "결정을 기록하고 실행은 별도 PR로 미룬다"는
    형태라, 설계를 상세히 적었다는 사실만으로 기능 확장(over-engineering)으로 보기는 어렵다. 오히려
    이번 PR diff 에 9번째 e2e 하네스를 그대로 복제한 것에 대한 근거를 남긴 것이다.
  - 제안: 조치 불요.

## 그 외 확인했으나 문제 없음

- `webauthn.service.spec.ts` 의 diff 는 기존 `describe('deleteCredential', …)` 블록 안에 새
  `describe('동시 삭제', …)` 하나만 추가하며, 기존 테스트·import·설정은 건드리지 않았다.
- 신규 e2e 파일(`webauthn-credential-delete-concurrency.e2e-spec.ts`)은 이 결함(및 그 반증 테스트)만
  검증하며 기존 파일을 건드리지 않는다.
- `webauthn.controller.ts`(실제 감사 기록 지점)는 이번 diff 에 전혀 등장하지 않는다 — 서비스 계층의
  반환 계약(`{ remaining }`)이 그대로 유지되므로 컨트롤러 변경이 불필요하다는 plan 의 주장과 일치한다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 §1.11 항목이 부수적으로 언급하는
  `auth-configs.service.ts:148` JSDoc 정정은 이번 PR **코드**에 반영되지 않았다 — 등재만 하고 실행은
  다음 턴(같은 항목에 "spec 정정과 같은 턴에 그 한 구도 고칠 것"으로 스스로 게이트를 걸어둠)으로
  미뤄, `auth-configs.service.ts` 자체는 이번 diff 에 나타나지 않는다. 스코프 침범 없음.
- 포맷팅·임포트·설정 파일 변경은 발견되지 않았다. `webauthn.service.ts` 의 import 목록은 diff 에
  나타나지 않아 미변경으로 확인된다.
- `review/code/2026/09/21/18_03_54/**`, `review/consistency/2026/09/21/17_39_06/**` 산출물은
  `CLAUDE.md` 정보 저장 위치 표가 요구하는 코드 리뷰·일관성 검토 산출물이며 gitignore 대상이 아니다
  (메모리: "review/ 는 gitignored 아님") — 이번 PR 의 코드 스코프를 침범하지 않는 필수 프로세스
  산출물로 판단한다.

## 요약

핵심 프로덕션 변경은 `webauthn.service.ts` 의 `deleteCredential()` 한 곳(`affected` 판정 도입 +
`userId` 조건 추가)으로 좁혀져 있고, 이번 재검토에서 새로 드러난 스코프 이탈은 없다. 유일하게
기록해 둘 지점은 이전 리뷰 라운드의 WARNING #3 조치로 `renameCredential()` 두 곳까지 헬퍼 추출이
번진 것인데, 이는 임의 리팩터가 아니라 같은 세션 리뷰가 명시적으로 요구한 후속 조치이고 동작 변화가
없음을 직접 대조로 확인했다. `userId` 조건 추가·CHANGELOG 의 형제 항목 정정·트래커 신규 planner
항목은 모두 plan 문서에 사전 근거가 있거나 프로젝트 역할 경계(developer는 spec 미수정)를 지키기 위한
등재일 뿐 실제 코드 변경을 수반하지 않아 스코프 이탈로 보기 어렵다. 포맷팅·불필요한 임포트·무관한
설정 변경은 발견되지 않았다.

## 위험도

LOW
