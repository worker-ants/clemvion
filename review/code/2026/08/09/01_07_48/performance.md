STATUS=success reviewer=performance file=codebase/backend/src/modules/secret-store/secret-resolver.service.ts
===REPORT_MARKDOWN_BELOW===
# 성능(Performance) 리뷰 — secret-resolver.service.ts

## 대상 변경 확인

`git diff origin/main -- codebase/backend/src/modules/secret-store/secret-resolver.service.ts` 로 실제 변경분을 확인했다. 변경은 `assertRefFormat()` 의 invalid-ref 분기(에러 throw 직전 블록, 파일 내 60~65번 게이트 부근) 에 한정된다:

- 주석을 `no-unnecessary-type-assertion` 린트 규칙 관련 설명으로 확장.
- `const refStr: string = ref as unknown as string;` → `const refStr: string = ref;` 로 불필요한 이중 타입 단언(`as unknown as string`) 제거.

TypeScript 의 `as` 단언은 컴파일 타임 전용 구문이며 `tsc`/`swc` 트랜스파일 시 완전히 제거되어 런타임 바이트코드에 아무 영향을 주지 않는다. 따라서 이 변경은 **런타임 성능에 어떠한 영향도 없다** — 생성되는 JS 는 변경 전후로 동일하다(단언 제거는 순수 타입 레이어 정리).

또한 이 코드는 `isSecretRef(ref)` 가 `false` 인 예외적 실패 경로(잘못된 형식의 ref 입력) 에서만 실행되며, 수행하는 연산은 `ref.length` 조회와 `ref.slice(0, 8)` (상수 크기 8) 뿐이라 원래도 O(1) 이고 hot path 도 아니다.

## 참고 (변경 범위 밖, 파일 전체 컨텍스트 관찰)

점검 관점에 따라 파일 전체도 훑었으나 이번 diff 로 새로 도입되거나 악화된 성능 이슈는 없다. 참고용 INFO 만 남긴다:

- **[INFO]** `deleteByPrefix()` 는 `ref LIKE :prefix` (prefix 뒤 `%`) 로 다건 삭제를 수행한다.
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` — `deleteByPrefix` 메서드 (게이트 147~159)
  - 상세: prefix match 는 `ref` 컬럼에 B-tree 인덱스가 있고 `LIKE 'prefix%'` (뒤 와일드카드만) 형태이면 인덱스를 탈 수 있어 통상 문제 없다. 이번 diff 대상은 아니므로 정보 제공 목적으로만 기재.
  - 제안: 별도 조치 불요 — 현행 유지. `ref` 컬럼 인덱스 존재만 별도로 확인 권장(스키마 마이그레이션 리뷰 시).
- **[INFO]** `masterKey` 는 `onModuleInit` 에서 1회만 파싱해 인스턴스 필드에 캐싱하고 있어(게이트 27, 40) 매 호출마다 재파싱하지 않는 좋은 캐싱 패턴이다. 이번 diff 와 무관하지만 유지 확인.

## 요약

이번 diff 는 `no-unnecessary-type-assertion` 린트 위반 해소를 위한 타입 단언 제거 + 주석 보강뿐이며, 컴파일 타임에만 존재하던 `as unknown as string` 캐스트를 제거한 것으로 런타임 동작·바이트코드·복잡도·I/O·메모리 어느 축에도 변화가 없다. 실행 경로도 예외적 실패 분기(O(1) 연산)에 한정되어 성능 관점에서 검토할 실질적 대상이 없다.

## 위험도

NONE
