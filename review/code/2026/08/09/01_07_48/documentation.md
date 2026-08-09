# 문서화(Documentation) 리뷰 — secret-resolver.service.ts

## 발견사항

- **[INFO]** 인라인 주석에 리팩터링 시점("2026-08-09 lint 정리")·검증 이벤트("실측 확인")가 코드 주석에 직접 기록됨 — 커밋 메시지 성격의 히스토리 서술이 evergreen 코드 주석에 섞임
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:64` (`assertRefFormat` 메서드 내부, `no-unnecessary-type-assertion 이 지목한 대로 불필요했고, 제거해도 nest build 가 통과한다(2026-08-09 lint 정리에서 실측 확인).` 문장)
  - 상세: 주석 앞부분(`isSecretRef` 가 `value is string` 타입가드라 false branch 에서 `ref` 가 `never` 로 좁혀진다 → `never` 는 bottom type 이라 캐스트 불필요)은 TypeScript 동작을 정확히 설명하는 evergreen 주석으로 적절함. 다만 뒤에 이어지는 "종전의 `as unknown as string` 은 ... 지목한 대로 불필요했고, 제거해도 nest build 가 통과한다(2026-08-09 lint 정리에서 실측 확인)" 부분은 이번 변경의 히스토리·검증 로그이며, 코드에 영구히 남기보다 커밋 메시지에 두는 편이 이후 이 파일을 다시 만지는 사람에게 더 적절하다. 다만 내용 자체는 정확하며(아래 실측 확인) 오도하는 정보는 아님.
  - 제안: 필수는 아니나, 다음에 이 주석을 손볼 기회가 있으면 "왜 캐스트가 불필요한가"(never→string 대입 규칙)만 남기고 리팩터링 이력·날짜는 커밋 메시지/PR 설명으로 옮기는 것을 고려.

## 검증한 사실관계

- `isSecretRef(value: unknown): value is string` 시그니처 확인(`codebase/backend/src/modules/secret-store/secret-ref.ts:39`) — `assertRefFormat(ref: string)` 내부에서 `!isSecretRef(ref)` false 분기 시 `ref` 가 `never` 로 좁혀진다는 주석의 TS narrowing 설명은 정확함.
- `@typescript-eslint/no-unnecessary-type-assertion` 규칙이 `codebase/backend/eslint.config.mjs:68`에 `warn` 으로 실제 존재 — 주석이 인용하는 lint 규칙명이 지어낸 것이 아니라 실재함.
- `SS-SE-05` 참조(`codebase/backend/src/modules/secret-store/secret-resolver.service.ts:58,82`)는 `spec/conventions/secret-store.md:175` 의 실제 항목과 일치 — "plaintext 미기록" 취지가 정확히 대응됨.
- 변경분은 순수 주석/캐스트 제거(`as unknown as string` → `const refStr: string = ref;`)이며 동작·시그니처 변경 없음. README/API 문서/CHANGELOG/환경변수 문서 갱신 필요성 없음. 이 lint 정리 작업 자체는 `plan/in-progress/backend-lint-gate-broken-on-main.md` 에서 이미 추적 중이라 별도 CHANGELOG 항목도 불필요.
- 클래스·메서드 상단 JSDoc(SoT 링크, SS-SE-05 참조, fail-fast 설명)은 이번 변경으로 손상되지 않았고 여전히 정확함.

## 요약

리뷰 대상 diff 는 `no-unnecessary-type-assertion` lint 지적에 따라 불필요한 `as unknown as string` 캐스트를 제거하고, 그 근거(TypeScript `never`→`string` 대입 규칙)를 설명하는 인라인 주석을 보강한 것이 전부다. 주석 내용은 실제 타입 시그니처·lint 설정·spec 참조와 대조 검증한 결과 정확했고, 클래스/메서드 수준 JSDoc 도 기존 상태를 유지해 문서화 관점에서 문제가 없다. 유일한 지적은 주석에 리팩터링 이력·날짜(커밋성 정보)가 섞여 있다는 스타일 수준의 INFO 하나뿐이며, README/API 문서/CHANGELOG/설정 문서 갱신 필요성은 없다.

## 위험도

NONE
