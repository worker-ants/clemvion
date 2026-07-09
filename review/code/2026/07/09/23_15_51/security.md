# 보안(Security) 리뷰

대상: Manual Trigger `output.parameters` 자동완성 enricher 추가
(`node-output-schema-enrichers.ts` / `use-expression-context.ts` / 관련 테스트·spec·plan 문서)

## 발견사항

- **[INFO]** 신규 공격면 없음 — 프론트엔드 전용 UX 힌트 생성 로직
  - 위치: `codebase/frontend/src/components/editor/expression/node-output-schema-enrichers.ts` `enrichManualTriggerOutputSchema`
  - 상세: 이 함수는 표현식 자동완성 팝업에 표시할 JSON Schema 힌트를 계산할 뿐, 런타임 검증·서버 전송·네트워크 호출·DOM 삽입(`dangerouslySetInnerHTML` 등)이 전혀 없다(`grep` 확인 결과 해당 디렉터리에 `dangerouslySetInnerHTML` 사용 없음). 입력값(`config.parameters`)은 동일 사용자가 같은 에디터 세션에서 자신의 워크플로우에 이미 저장한 config이며, 신뢰 경계를 넘는 원격/타 사용자 입력이 아니다. 기존 4개 enricher(`enrichInfoExtractorOutputSchema`/`enrichFormOutputSchema`/`enrichTableOutputSchema`/`enrichTransformOutputSchema`)와 동일한 패턴을 그대로 재사용했다.
  - 제안: 없음 (현행 유지).

- **[INFO]** Prototype pollution 방어 — 기존 안전장치 재사용 확인
  - 위치: `enrichManualTriggerOutputSchema` L807-816 (`isSafeFieldName` 호출), `Object.create(null)` 사용
  - 상세: `p.name` 을 객체 키로 사용하기 전 `isSafeFieldName()`(`SAFE_IDENTIFIER_RE` + `UNSAFE_KEYS`(`__proto__`/`constructor`/`prototype`) 차단)을 거치고, 누적 객체 `userProps` 를 `Object.create(null)` 로 생성해 프로토타입 체인을 끊는다. 테스트(`node-output-schema-enrichers.test.ts` "skips unsafe prototype keys and invalid identifiers")로 `__proto__`, 공백 포함 이름, 숫자로 시작하는 이름이 모두 거부됨을 확인. `Object.prototype` 자체를 오염시키는 대입(`obj.__proto__ = ...` 또는 `obj["__proto__"] = ...`) 은 발생하지 않는다.
  - 제안: 없음 — 기존 SoT(`isSafeFieldName`)를 재사용하는 올바른 접근.

- **[INFO]** Base schema 불변성(no-mutation) 유지
  - 위치: `enrichManualTriggerOutputSchema` L820-823
  - 상세: `structuredClone`(폴백: `JSON.parse(JSON.stringify(...))`) 으로 `baseSchema` 를 복제한 뒤에만 수정하므로, 노드 정의 스토어(`nodeDefinitions`)에 캐시된 공유 스키마 객체가 다른 노드 인스턴스의 enrich 호출에 의해 오염되지 않는다. 테스트("does not mutate the base schema")로 회귀 방지.
  - 제안: 없음.

- **[INFO]** 에러 처리 — 민감정보 노출 없음
  - 위치: L826-830 (`console.warn` 분기)
  - 상세: `process.env.NODE_ENV !== "production"` 가드 하에서만 경고를 출력하며, 메시지 내용도 스키마 shape 불일치를 알리는 정적 문자열일 뿐 워크플로우 데이터·토큰·환경변수 등 민감정보를 포함하지 않는다.
  - 제안: 없음.

- **[INFO]** 하드코딩된 시크릿 / 암호화 / 인증·인가 / 인젝션(SQL·커맨드·경로탐색) 해당 없음
  - 상세: 이번 diff 는 순수 클라이언트 측 JSON Schema 조작 로직과 vitest 단위테스트, spec/plan 문서 갱신뿐이다. 네트워크 호출, DB 쿼리, 파일시스템 접근, 쉘 명령, 인증 토큰 처리 코드가 없어 해당 카테고리는 모두 대상 외.

## 요약

이번 변경은 Manual Trigger 노드의 `config.parameters[].name` 을 `output.parameters.<name>` 자동완성 힌트로 투영하는 프론트엔드 전용 UX 기능으로, 기존 4개 enricher(Information Extractor/Form/Table/Transform)와 동일한 검증된 패턴(`isSafeFieldName` prototype-pollution 가드, `Object.create(null)`, clone-before-mutate, dev-only 경고)을 그대로 재사용한다. 서버 전송·DOM 삽입·런타임 검증에 관여하지 않고 입력 소스도 동일 사용자의 자체 워크플로우 config이므로 신뢰 경계를 넘는 공격면이 새로 생기지 않는다. 신규 CRITICAL/WARNING 항목 없음.

## 위험도

NONE
