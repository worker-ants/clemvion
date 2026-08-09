# 요구사항(Requirement) 리뷰 — codebase/backend/src/modules/secret-store/secret-resolver.service.ts

## 변경 범위 확인

`git diff origin/main -- codebase/backend/src/modules/secret-store/secret-resolver.service.ts` 로 실제 diff 를 대조한 결과, 이번 변경은 `assertRefFormat` 내부 단 한 곳:

```ts
- const refStr: string = ref as unknown as string;
+ const refStr: string = ref;
```

와 그 위 설명 주석 확장뿐이다. `resolve` / `store` / `rotate` / `delete` / `exists` / `deleteByPrefix` 등 나머지 로직·시그니처·에러 메시지·로깅 동작은 **전혀 변경되지 않았다**. `backend-lint-gate-broken-on-main` plan (`@typescript-eslint/no-unnecessary-type-assertion` 54건 정리 작업)의 일부로, 순수 lint 준수 목적의 기계적 변경이다.

## 검증

주석이 주장하는 TypeScript 좁히기 동작("`isSecretRef` 의 false branch 에서 `ref` 가 `never` 로 좁혀지므로 캐스트가 불필요")을 직접 격리 재현해 확인했다:

1. `const refStr: string = ref;` (캐스트 없이) — `tsc --noEmit --strict` 통과.
2. `const asNumber: number = ref;` (동일 분기에서 `ref` 를 `number` 에 대입) — 역시 무오류 통과. `string` 이었다면 `number` 대입은 실패해야 하므로, 이는 `ref` 가 실제로 `never` (bottom type, 모든 타입에 대입 가능) 로 좁혀졌음을 반증이 아니라 확증한다.

즉 주석의 기술적 주장은 정확하고, 캐스트 제거는 컴파일 안전성·런타임 동작 모두에 영향이 없다 (컴파일 타임 타입 정제일 뿐, 런타임에는 `ref` 가 여전히 원본 string 값). plan 문서에 이미 기록된 전체 TEST WORKFLOW (`lint PASS · unit PASS(88s) · build PASS(155s) · e2e PASS(297s, 261 tests)`) 결과와도 정합적이다.

## 점검 관점별 결과

1. **기능 완전성** — 영향 없음 (로직 변경 0줄).
2. **엣지 케이스** — 영향 없음. `assertRefFormat` 은 여전히 형식 위반 시 ref 길이/prefix 8자만 노출하고 나머지는 미노출.
3. **TODO/FIXME** — 없음.
4. **의도와 구현 간 괴리** — 주석이 주장하는 TS 좁히기 동작을 실측 검증했고 정확함. 괴리 없음.
5. **에러 시나리오** — `assertRefFormat` 의 에러 throw 경로·메시지 포맷 불변.
6. **데이터 유효성** — `isSecretRef` 정규식 검증 로직 불변.
7. **비즈니스 로직** — 영향 없음.
8. **반환값** — 영향 없음 (해당 분기는 `void` 반환 함수 내부, throw 로 종료).
9. **spec fidelity** — SoT `spec/conventions/secret-store.md`. §2 `SecretResolver` 인터페이스 (`resolve`/`store`/`rotate`/`delete`/`exists` 시그니처) 와 파일의 메서드 시그니처가 line-level 로 일치. §4 SS-SE-05 (plaintext 미노출·ref+workspaceId 만 로깅)도 `resolve` 의 catch 블록·`assertRefFormat` 의 에러 메시지 구성과 일치. 이번 diff 는 SS-SE-05 관련 로직(길이/prefix 만 노출)을 그대로 보존한다 — 캐스트 제거로 인한 위반 없음.

## 발견사항

없음 — CRITICAL/WARNING 없음.

- **[INFO]** 주석 확장(4줄 → comment 상세화)은 순수 문서화 목적이며 실측(위 검증 절차)으로 뒷받침됨.
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:59-65` (assertRefFormat 내부 주석 블록)
  - 상세: 주석이 TypeScript 컴파일러의 `never` 좁히기 동작을 설명하며 "제거해도 `nest build` 가 통과한다"고 주장. 별도 격리 테스트로 이 주장이 정확함을 확인했다.
  - 제안: 조치 불필요. 참고로 plan 문서(`plan/in-progress/backend-lint-gate-broken-on-main.md`)에 이미 전체 TEST WORKFLOW PASS 가 기록돼 있어 중복 검증이었으나, 이번 리뷰에서 독립적으로 재확인했다.

## 요약

이번 변경은 `no-unnecessary-type-assertion` ESLint 규칙 준수를 위해 불필요한 `as unknown as string` 캐스트 1건을 제거하고 그 근거를 설명하는 주석을 확장한 것으로, 로직·시그니처·에러 처리·spec 정합성 어느 것도 건드리지 않는 순수 기계적 lint 정리다. 주석이 주장하는 TypeScript 타입 좁히기(`never`) 동작을 `tsc --strict` 로 직접 재현해 정확함을 확인했으며, `spec/conventions/secret-store.md` §2/§4 와의 정합성도 유지된다. 요구사항 충족 관점에서 문제 없음.

## 위험도

NONE
