# 부작용(Side Effect) Review — secret-resolver.service.ts

## 리뷰 대상
- `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` — `assertRefFormat` 내부, `no-unnecessary-type-assertion` lint 정리로 `ref as unknown as string` 캐스트를 제거하고 주석을 보강한 변경.

## 분석

실제 diff (`git diff ad0ea7cdb..HEAD` 기준) 는 다음 한 곳뿐이다:

```
-      const refStr: string = ref as unknown as string;
+      const refStr: string = ref;
```

나머지는 동일 라인 위 주석(설명) 확장뿐이다. TypeScript 의 타입 캐스트(`as`)는 컴파일 타임 전용이며 런타임 코드로 트랜스파일되지 않는다. `isSecretRef` 가 `value is string` 타입가드이므로 `if (!isSecretRef(ref))` 분기 내부에서 `ref` 는 정적으로 `never` 로 좁혀지고, `never` 는 bottom type 이라 `string` 자리에 캐스트 없이 대입 가능하다. 즉 컴파일 후 생성되는 JS 는 캐스트 유무와 무관하게 동일(`const refStr = ref;`)하며, 이 diff 는 **런타임 동작을 전혀 변경하지 않는 순수 타입 표기 정리**다.

점검 관점별 확인:

1. **의도치 않은 상태 변경**: 없음 — 함수 로직·분기·반환값 불변.
2. **전역 변수**: 없음 — 전역/공유 상태 접근 없음.
3. **파일시스템 부작용**: 없음.
4. **시그니처 변경**: 없음 — `assertRefFormat(ref: string): void` 시그니처 그대로, `resolve`/`store`/`rotate`/`delete`/`exists`/`deleteByPrefix` 등 호출자 영향 없음.
5. **인터페이스 변경**: 없음 — 클래스의 public 메서드 표면 불변.
6. **환경 변수**: 없음 — 이 diff 범위 밖(`onModuleInit` 의 `ENCRYPTION_KEY` 읽기는 변경 없음).
7. **네트워크 호출**: 없음.
8. **이벤트/콜백**: 없음.

에러 메시지 생성 로직(`refStr.length`, `refStr.slice(0, 8)`)도 캐스트 제거 전후로 완전히 동일한 값을 만들어내므로, SS-SE-05 (plaintext 비노출) 계약에도 영향 없다.

## 발견사항

없음.

## 요약

이번 변경은 `no-unnecessary-type-assertion` lint 규칙 위반을 해소하기 위해 불필요한 `as unknown as string` 캐스트를 제거하고 그 근거를 주석으로 보강한 것으로, TypeScript 타입 캐스트는 런타임 코드에 영향을 주지 않아(컴파일 후 JS 동일) 실질적인 동작 변경이 전혀 없다. 함수 시그니처·에러 메시지 포맷·상태·I/O·네트워크·이벤트 어느 것도 변경되지 않았으며, 부작용 관점에서 우려할 사항이 없다.

## 위험도
NONE
