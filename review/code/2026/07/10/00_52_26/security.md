# 보안(Security) 리뷰 결과

## 대상
`$params` 표현식 자동완성 추가 (frontend, editor/expression 하위):
- `use-expression-suggestions.ts` — `$params.` drill 핸들러 추가
- `expression-constants.ts` — `ROOT_VARIABLES` 에 `$params` 엔트리 추가
- `use-expression-suggestions.test.ts` — 신규 테스트
- `plan/**` 문서 3건 (코드 변경 없음)

### 발견사항

- **[INFO]** 신규 코드 경로는 순수 클라이언트 사이드 UI 자동완성 로직으로 서버 요청·DOM 삽입(`dangerouslySetInnerHTML` 등)·`eval`/`Function` 생성·네트워크 호출을 전혀 수반하지 않음
  - 위치: `codebase/frontend/src/components/editor/expression/use-expression-suggestions.ts:1171-1190` (`$params.` 분기)
  - 상세: `rawParams`(=`expressionData.inputSample.parameters`)에 대해 `typeof === "object" && !Array.isArray(...)` 가드 후에만 `Record<string, unknown>` 로 캐스팅하고, 실패 시 빈 객체 `{}` 로 안전하게 fallback. `buildNestedSuggestions` 는 `Object.keys()` 로 own-enumerable 키만 순회해 라벨/타입 문자열을 만들고, 이 값들은 React 자동완성 위젯의 텍스트 콘텐츠로만 쓰인다(기존 `$input.` 경로와 동일 패턴 재사용). 실행 가능한 코드나 raw HTML 을 삽입하는 경로가 없어 XSS/인젝션 벡터가 없음.
  - 제안: 조치 불필요. 참고 사항으로만 기록.

- **[INFO]** 자동완성이 실제 파라미터 *값*이 아니라 필드명·타입만 노출
  - 위치: `buildNestedSuggestions()` (`use-expression-suggestions.ts:1329-1339`) 의 `detail: f.type` (예: `"string"`, `"number"`)
  - 상세: `inputSample.parameters` 의 실제 값(예: PII 성격의 트리거 파라미터 값)은 suggestion label/detail 에 노출되지 않고 키 이름과 추론된 타입만 노출된다 — 기존 `$input.` 경로와 동일한 정보 노출 수준이라 이번 변경으로 새로운 민감정보 노출 표면이 생기지 않음.
  - 제안: 조치 불필요.

- **[INFO]** `inputSchema?.properties?.parameters` 접근은 정적 리터럴 키(`"properties"`, `"parameters"`)만 사용 — 사용자 입력을 동적 프로퍼티 경로로 사용하지 않아 prototype pollution 벡터 없음
  - 위치: `use-expression-suggestions.ts:1178-1179`
  - 상세: 트리거 파라미터 이름(`region`, `count` 등)은 `Object.keys()` 순회로만 사용되고 동적 프로퍼티 접근(`obj[userControlledKey] = ...`)에 쓰이지 않는다. `__proto__` 같은 이름을 가진 파라미터가 있어도 단순 텍스트 label 로만 나열될 뿐 프로토타입 체인에 영향 없음.
  - 제안: 조치 불필요.

- **[INFO]** 변경분 중 `plan/**` 3개 markdown 파일은 문서(작업 추적)일 뿐 실행 코드 아님 — 보안 관점에서 검토 대상 아님.

### 요약
이번 변경은 workflow 에디터의 표현식 자동완성에 `$params`(≡ `$input.parameters` 단축 참조) 루트 변수와 하위키 drill-down 을 추가하는 순수 프론트엔드 UI 기능이다. 새 코드는 기존에 검증된 `$input.` 처리 경로와 동일한 패턴(`buildNestedSuggestions`)을 재사용하며, 사용자 입력을 실행하거나 DOM 에 원시 삽입하는 경로, 네트워크/인증/암호화 관련 로직, 하드코딩된 시크릿이 전혀 없다. 노출되는 정보도 필드명·타입에 국한되어 기존 `$input` 자동완성과 동일한 노출 수준을 유지한다. 인젝션·인증/인가·시크릿·암호화·에러 처리·의존성 관점 모두에서 실질적 위험이 발견되지 않았다.

### 위험도
NONE
