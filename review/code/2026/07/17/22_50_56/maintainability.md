# 유지보수성(Maintainability) 리뷰 — interaction-type 가드 정규식→AST 파싱 전환

## 검토 범위
실제 코드 변경은 `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` 1개 파일뿐이다
(나머지는 plan 문서·consistency 리뷰 산출물로, 프로세스 기록이라 유지보수성 관점 코드 리뷰 대상이 아님).
변경 내용: 정규식(`new RegExp(['"`]+value+['"`])`) 기반 string literal 검사를, `ts.createSourceFile` +
`ts.forEachChild` 기반 TypeScript AST 파싱(`collectCodeStringLiterals`)으로 교체하고, 이 함수 자체의
회귀(주석 false-negative)를 잡는 self-test(`describe("collectCodeStringLiterals", ...)`)를 추가.

### 발견사항

- **[INFO]** 두 `describe` 블록(`WaitingInteractionType` / `ConversationTurnSource` exhaustiveness, L134-155 / L173-194)이 구조적으로 완전히 동일한 코드를 반복
  - 위치: `interaction-type-exhaustiveness.test.ts:134-155`, `:173-194`
  - 상세: `collectCodeStringLiterals` 호출 → `missing` 누적 → 없으면 통과, 있으면 동일 형태의 `Error` throw 로직이 site 목록/enum 목록/에러 메시지 텍스트만 다르고 완전히 복제돼 있다. 이번 diff 는 이 중복을 새로 만든 것은 아니고(원래 정규식 버전도 같은 구조로 중복돼 있었음) 그대로 이식했을 뿐이지만, 두 블록 모두 새 `collectCodeStringLiterals` 호출로 갱신하는 이번 기회에 `assertExhaustive(sites, values, guardName, sotRef)` 같은 공용 헬퍼로 추출했더라면 ~20줄의 반복을 제거하고 향후 세 번째 registry(예: 새 enum) 추가 시 복붙 오류 위험도 줄었을 것.
  - 제안: 이번 PR 을 막을 사유는 아니나, 다음에 이 파일을 건드릴 때 공용 `assertExhaustive` 헬퍼로 통합 권장.

- **[INFO]** `collectCodeStringLiterals` 의 JSDoc(L58-79, 약 21줄)이 함수 본체(약 17줄)보다 길다
  - 위치: `interaction-type-exhaustiveness.test.ts:58-79`
  - 상세: PR #968 의 false-negative 사례, 백틱/홑따옴표 양쪽 다 주석에 등장한다는 실측, 정규식 좁히기 대안을 기각한 이유까지 상세히 기록돼 있다. 코드 대비 주석 비율은 높지만, 이 저장소 컨벤션(CLAUDE.md `## Rationale` 섹션 원칙 — 결정의 배경·근거를 명시적으로 남긴다)과 정확히 부합하고, 향후 "왜 정규식이 아니라 AST 인가"를 재질문받았을 때 근거를 코드 옆에서 바로 확인할 수 있어 실질적 유지보수성 이득이 더 크다고 판단됨. 결함이 아니라 참고 사항.
  - 제안: 조치 불필요.

- **[INFO]** self-test fixture(L107-115)를 문자열 배열 + `join("\n")` 으로 구성
  - 위치: `interaction-type-exhaustiveness.test.ts:107-115`
  - 상세: 백틱·홑따옴표·쌍따옴표를 모두 리터럴로 포함해야 하므로 템플릿 리터럴 하나로 쓰면 이스케이프가 난잡해지는 것을 피하려는 의도로 읽히나, 그 의도를 설명하는 인라인 주석은 없다. 배열 원소 각각이 "주석 한 줄"에 대응해 읽기 자체는 어렵지 않아 실질적 리스크는 낮음.
  - 제안: (선택) 배열+join 을 택한 이유를 한 줄 주석으로 남기면 향후 리팩터 시 "왜 템플릿 리터럴이 아닌가"라는 의문을 예방할 수 있음. 필수 아님.

- **[INFO]** 저장소 내 유사 가드(`ui-label-parity.test.ts`, `migrations.md` SQL_NAME_RE)는 여전히 regex 기반이라, 같은 "N-site 리터럴 존재 검증" 패턴에 두 가지 다른 구현 기법(regex vs full TS AST parse)이 공존하게 됨
  - 위치: 해당 없음(교차 파일 관찰) ↔ 참고: `spec/conventions/migrations.md`, `spec/conventions/i18n-userguide.md` §113
  - 상세: consistency 리뷰(`convention_compliance.md`, `cross_spec.md`)가 이미 이 공존이 규약 위반이 아님을 확인했고, 이번 대상 파일의 JSDoc 이 "왜 정규식이 아니라 AST 인가"의 근거를 충분히 남겨 두어 향후 개발자가 "이 파일만 왜 다른 기법을 쓰나"를 판단할 실마리가 코드 안에 있음. 다만 두 기법이 병존한다는 사실 자체는 리포지토리 전체를 처음 훑는 사람에게는 약간의 인지 부담이 될 수 있음.
  - 제안: 조치 불필요 — 이미 문서화돼 있고 이번 PR 스코프 밖(다른 가드까지 AST 로 통일하는 것은 별도 논의 사안).

### 요약
실제 코드 변경분(`interaction-type-exhaustiveness.test.ts`)은 유지보수성 관점에서 명확한 개선이다: 취약했던 정규식 매칭을 짧고(17줄) 단일 책임을 갖는 `collectCodeStringLiterals` 함수로 대체했고, 그 함수의 정확성 자체를 검증하는 self-test 를 추가해 "회귀 시 침묵하는 가드"가 될 위험(PR #968 이 실측한 바로 그 결함)을 구조적으로 차단했다. 네이밍은 기존 컨벤션(UPPER_SNAKE_CASE 상수, camelCase 함수)과 일치하고, 중첩 깊이·순환 복잡도 모두 낮으며, 매직 넘버도 없다. JSDoc 은 길지만 "왜 이 방식을 택했는가"에 대한 근거를 코드 옆에 남기는 이 저장소의 확립된 관행에 부합한다. 유일하게 남는 개선 여지는 두 `describe` 블록 간의 반복되는 loop 구조(이번 PR 이 새로 만든 중복은 아니며, 헬퍼로 추출하면 더 좋았을 기회비용 수준)와 self-test fixture 의 구성 방식에 대한 짧은 설명 부재로, 둘 다 CRITICAL/WARNING 이 아닌 INFO 수준이다.

### 위험도
NONE
