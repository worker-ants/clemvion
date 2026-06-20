# 테스트(Testing) 리뷰 결과

## 발견사항

### [INFO] sessions.service.spec.ts — `resolveCurrentFamilyId` mock 구현의 암묵적 가정
- 위치: `sessions.service.spec.ts` 97–105행, 123–128행 (신규 self-revoke 테스트)
- 상세: `repo.findOne` mock 이 `'tokenHash' in where` 키 존재 여부로 두 분기(owned 조회 vs current family 조회)를 구분한다. 이는 `resolveCurrentFamilyId` 내부에서 `{ where: { tokenHash: hash, isRevoked: false } }` 형태로 `findOne` 을 호출하고, `revokeFamily` 첫 조회는 `{ where: { userId, familyId } }` 형태임을 전제로 한다. `SessionsService` 내부 `findOne` 호출 signature 가 바뀌면 mock 이 올바른 분기로 라우팅되지 않아 테스트가 false-positive 를 반환할 수 있다. 현재는 실제 서비스 코드와 일치하므로 오류는 없지만, 내부 구현 상세에 의존하는 white-box 결합이다.
- 제안: mock 결합도를 낮추려면 `where` 조건 전체를 비교하는 방식(예: `where.tokenHash === expectedHash && where.isRevoked === false`)으로 명시화하거나, 또는 현재처럼 key presence check 를 사용할 경우 주석에 "이 분기는 resolveCurrentFamilyId 가 tokenHash+isRevoked 조합으로 findOne 호출함을 전제" 라고 명시해 향후 리팩터링 시 주의를 표시한다. 기능상 문제가 아니라 INFO 수준.

### [INFO] sessions.service.spec.ts — self-revoke 테스트에서 `verifyReauth` 미수행 단언의 간접성
- 위치: `sessions.service.spec.ts` 116–117행
- 상세: `expect(repo.update).not.toHaveBeenCalled()` 로 "self-revoke 차단 시 revoke 미수행"을 단언하는 것은 `update` 가 reauth 이후 호출됨을 전제로 한 간접 단언이다. `verifyReauth` 자체가 호출되지 않았음을 직접 단언하는 방법은 없지만(private 메서드), `usersService.findById` 가 호출되지 않았음을 추가로 단언하면 "self-revoke 차단 → reauth 미진행" 경로를 더 명확히 검증할 수 있다. 현재 단언도 논리적으로 충분하다.
- 제안: `expect(usersService.findById).not.toHaveBeenCalled()` 를 self-revoke reject 테스트에 추가하면 "reauth 이전 early-exit" 의도를 더 직접 표현한다.

### [INFO] webauthn.controller.spec.ts — `webauthnRegenerateRecovery` 테스트가 audit log 기록 여부를 단언하지 않음
- 위치: `webauthn.controller.spec.ts` 952–982행 (신규 `webauthnRegenerateRecovery` describe 블록)
- 상세: 현재 컨트롤러 `webauthnRegenerateRecovery` 구현에는 audit log 기록이 없으므로 단언 누락은 사실 맞다. 그러나 성공 케이스 테스트에서 `auditLogsService.record` 가 **호출되지 않았음**(`not.toHaveBeenCalled()`) 을 명시적으로 단언하면, 추후 audit 기록이 추가될 때 테스트가 의도치 않게 통과하는 회귀를 예방하고 설계 의도를 문서화한다.
- 제안: 성공 케이스 테스트 말미에 `expect(auditLogsService.record).not.toHaveBeenCalled()` 추가. INFO 수준, 차단 아님.

### [INFO] `comparePassword` 로의 교체 — `sessions.service.spec.ts` 에 변경 없음 (의도적, 적절)
- 위치: `sessions.service.spec.ts` 전체
- 상세: `sessions.service.ts` 의 `bcrypt.compare` → `comparePassword` 교체는 동작이 완전히 동일하며(thin wrapper), `sessions.service.spec.ts` 는 `bcrypt.hash` 로 생성한 실제 해시를 사용해 검증하므로 교체 후에도 기존 테스트가 실제 검증을 수행한다. `comparePassword` 를 별도로 mock 할 필요 없고, `password.util.spec.ts` 에 `comparePassword` 독립 테스트가 이미 존재한다. 테스트 전략은 올바르다.
- 제안: 없음.

### [INFO] `revokeOtherFamilies` 테스트 — `currentFamilyId` Not() matcher 불투명성 주석
- 위치: `sessions.service.spec.ts` 452–455행
- 상세: `Not(currentFamilyId)` 가 Jest 의 deep-equality matcher 를 통과하지 못해 전체 criteria 를 비교하지 않고 `userId` 만 단언함을 주석으로 설명하고 있다. 이는 기존 코드이며 변경 대상이 아니지만, 현재 changeset 에서 관련 코드를 리뷰하는 맥락에서 — TypeORM `Not()` 반환 객체를 `.toMatchObject` 로 검증하거나, criteria 에서 `familyId` 키가 존재하는지(`'familyId' in criteria`)를 별도로 단언하는 방식으로 개선 가능. 본 PR 범위 밖이므로 INFO.

---

## 요약

이번 changeset 의 테스트 품질은 전반적으로 우수하다. `revokeFamily` 의 신규 self-revoke 방지 분기에 대해 두 케이스(현재 세션 = 대상 → 400, 현재 세션 != 대상 → revoke 성공)가 모두 추가되었고, 기존 5개 케이스도 `null` 인자를 명시해 시그니처 변경을 정확히 반영했다. `webauthn.controller` 의 `webauthnRegenerateRecovery` 는 기존에 테스트가 전무했으나 이번에 성공·실패 두 경로가 신설되었으며, 위임 계약(delegation contract)을 명확히 검증한다. `sessions.service` 의 `comparePassword` 교체는 동작 동등성이 보장된 thin wrapper 교체이고 기존 bcrypt 기반 테스트가 그대로 실제 검증을 수행하므로 추가 단언이 불필요하다. 발견사항은 모두 INFO 수준으로 기능 회귀·커버리지 갭·Mock 부적절성에 해당하지 않으며, 테스트 격리와 가독성도 양호하다.

## 위험도

NONE
