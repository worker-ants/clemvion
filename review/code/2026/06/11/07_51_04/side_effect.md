# 부작용(Side Effect) Review

## 발견사항

### 발견사항 없음 (NONE 등급)

변경된 5개 파일 전반에 걸쳐 의도하지 않은 부작용은 발견되지 않았다. 개별 관점별 검토 결과는 아래와 같다.

---

#### 1. 의도치 않은 상태 변경
- **[INFO]** `buildOperationCatalog` 헬퍼는 순수 함수(pure function)로 입력을 읽어 새 객체를 반환할 뿐 외부 상태를 건드리지 않는다.
- **[INFO]** `INTEGRATION_DERIVED_REGISTRY` (`Map`)는 모듈 로드 시점에 정적으로 초기화되며, 이번 변경에서 런타임 mutation은 없다.

#### 2. 전역 변수
- **[INFO]** 새로 추가된 `buildOperationCatalog`는 모듈 스코프 함수이며 전역 변수를 도입하거나 수정하지 않는다.
- **[INFO]** `listAllMakeshopOperations` import 추가는 새 전역 상태를 도입하지 않는다. 해당 함수가 내부적으로 memoize 캐시를 쓰더라도 기존 `listAllCafe24Operations` 패턴과 동일하다.

#### 3. 파일시스템 부작용
- 해당 없음. 모든 변경은 메모리 내 연산 또는 HTTP 응답 생성이다.

#### 4. 시그니처 변경
- **[INFO]** `renderApiCell` 함수에 `locale: Locale` 파라미터가 추가되었다.
  - 위치: `/codebase/frontend/src/app/(main)/integrations/[id]/page.tsx` L784
  - 상세: `renderApiCell`은 동일 파일 내에서만 호출되는 파일-로컬 함수이며, 유일 호출 지점(L742)이 동시에 업데이트되었다. 파일 외부에서 import해 사용하는 코드가 없으므로 하위 호환성 문제 없음.
- **[INFO]** `tryTranslateLabel` 시그니처가 `(catalogKey: string, t: TFunction)` → `(catalogKey: string, locale: Locale)`로 변경되었다.
  - 위치: `/codebase/frontend/src/app/(main)/integrations/[id]/page.tsx` L829
  - 상세: 역시 파일-로컬 함수로 유일 호출 지점(L663)이 동시에 업데이트되었다. 외부 노출 없음.

#### 5. 인터페이스 변경
- **[INFO]** 컨트롤러 `@ApiOperation` / `@ApiParam` description 문자열 변경은 Swagger 문서 텍스트만 바꾸며 HTTP 요청/응답 계약(URL, HTTP method, 상태 코드, DTO 구조)에는 영향이 없다.
- **[INFO]** `getServiceCatalog`의 동작 변경: `makeshop` 타입에서 빈 배열 대신 operations 목록을 반환하게 되었다. 이는 의도된 기능 추가이며, `cafe24` 이외의 타입을 호출하면 빈 배열이 반환된다는 기존 계약(빈 배열 = 미지원)을 유지하는 방식으로 `makeshop` 분기를 명시적으로 추가한 것이다. 기존에 `makeshop`을 호출하던 클라이언트는 빈 배열을 받았을 테니 이제 operations를 받는 것은 breaking change가 아닌 기능 보강이다.

#### 6. 환경 변수
- 해당 없음. 이번 변경 범위 내에서 환경 변수의 새로운 읽기/쓰기가 없다.

#### 7. 네트워크 호출
- 해당 없음. `getServiceCatalog` / `buildOperationCatalog`는 정적 메타데이터를 메모리에서 조합하며 outbound HTTP를 수행하지 않는다.
- 프런트엔드의 `useQuery(["integrations", "catalog", serviceType])` 는 기존에도 있던 쿼리로, 새 서비스 타입을 추가하는 것이 아니라 동일 엔드포인트 응답이 달라지는 것이므로 추가 네트워크 호출이 발생하지 않는다.

#### 8. 이벤트/콜백
- 해당 없음. 이벤트 이미터나 콜백 등록의 변경이 없다.

---

## 요약

이번 변경은 `makeshop` 서비스 타입에 대해 API operation catalog를 채우고, 프런트엔드 Activity 탭의 라벨 조회 로직을 provider prefix 기반으로 일반화하는 순수 기능 추가다. `buildOperationCatalog` 헬퍼는 순수 함수로 외부 상태를 변경하지 않고, 변경된 `renderApiCell`·`tryTranslateLabel` 함수 시그니처는 파일 내부 로컬 함수라 호출자 파급이 없다. Swagger 주석 변경은 문서 텍스트에만 영향을 주며, `plan/in-progress` 파일 수정은 문서 추적 레코드 갱신으로 코드 동작에 영향이 없다. 의도하지 않은 전역 상태 변경, 파일시스템 부작용, 환경 변수 오용, 불필요한 네트워크 호출은 없다.

## 위험도

NONE
