# Security Review — codebase/backend/src/modules/secret-store/secret-resolver.service.ts

## 변경 범위 확인

`git diff origin/main...HEAD -- codebase/backend/src/modules/secret-store/secret-resolver.service.ts` 로 실제 변경분을 확인함. 변경은 `assertRefFormat()` 내부 단 한 줄:

```
- const refStr: string = ref as unknown as string;
+ const refStr: string = ref;
```

`isSecretRef()` 가 `value is string` 타입가드이므로 false branch 에서 `ref` 는 TS 상 `never` 로 좁혀지고, `never` 는 bottom type 이라 `string` 대입에 캐스트가 불필요하다는 lint(`no-unnecessary-type-assertion`) 정리다. TypeScript 의 type assertion/cast 는 **컴파일 타임 전용**이며 런타임 값·바이트코드에는 아무 영향이 없다 — `ref as unknown as string` 과 `ref` 는 런타임에 완전히 동일한 값을 가리킨다. 따라서 이 diff 는 로깅되는 내용, 에러 메시지에 포함되는 값, 제어 흐름 어느 것도 바꾸지 않는다. 순수 lint 정리이며 보안적으로 no-op.

## 발견사항

이 diff 자체에서 발견된 보안 이슈는 없음 (CRITICAL/WARNING 없음).

아래는 diff 범위 밖이지만 전체 파일 컨텍스트가 제공되어 참고로 남기는 INFO 관찰 사항 — 이번 lint-only PR 의 스코프가 아니므로 차단 사유 아님:

- **[INFO]** `deleteByPrefix()` 의 LIKE 패턴 미이스케이프
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:147` (`deleteByPrefix`), 특히 `:153-157`
  - 상세: `prefix` 가 `secret://` 로 시작하는지만 검증하고, LIKE 메타문자(`%`, `_`)는 이스케이프하지 않은 채 `` `${prefix}%` `` 로 그대로 파라미터 바인딩한다. TypeORM 파라미터 바인딩이라 SQL 인젝션은 아니지만, `prefix` 에 `%`/`_` 가 포함되면 의도보다 넓은 범위의 secret row 가 삭제될 수 있는 LIKE-injection 성격의 로직 결함이다. 현재 호출부가 신뢰 가능한 내부 문자열(`secret://triggers/{id}/`)만 넘긴다면 실사용 위험은 낮음.
  - 제안: (이번 PR 범위 아님, 별도 후속 검토 권장) 호출부가 항상 내부 생성 prefix 만 사용하는지 확인하거나, LIKE 메타문자 이스케이프 유틸 추가.
- **[INFO]** `resolve()` 의 `NotFoundException`(53줄 근방, `77`) 이 `ref` 원문을 메시지에 포함하지만, `ref` 는 `secret://<scope>/<resourceId>/<name>` 형식의 참조 포인터일 뿐 secret 값 자체가 아니므로(`secret-ref.ts` 의 정규식 검증 확인) SS-SE-05 규약(plaintext 비노출) 위반은 아님. 다만 `resourceId` 등 내부 식별자가 클라이언트로 노출될 수 있는 경로이니 참고.

이 외 항목(하드코딩 시크릿, 인증/인가, 암호화 알고리즘 선택, 의존성 등)은 diff 에 변경이 없어 재평가 대상 아님. `assertRefFormat`/`resolve` 의 기존 로깅 정책(SS-SE-05: ref 는 길이+앞 8자만, 실제 plaintext 는 미기록)은 diff 전후로 동일하게 유지됨.

## 요약

이번 변경은 `no-unnecessary-type-assertion` lint 규칙을 만족시키기 위해 `as unknown as string` 이중 캐스트를 제거한 순수 타입 레벨 정리로, TypeScript 캐스트가 런타임에 영향을 주지 않으므로 로깅·에러 메시지·제어 흐름 등 어떤 보안 관련 동작도 변경하지 않는다. diff 범위에서 인젝션·시크릿 노출·인증/인가·암호화 관련 새 취약점은 발견되지 않았다. 참고용으로 남긴 두 건의 INFO(비-스코프 LIKE 미이스케이프, ref 노출)는 기존 코드에 이미 존재하던 것으로 이번 lint PR 의 책임 범위 밖이다.

## 위험도

NONE
