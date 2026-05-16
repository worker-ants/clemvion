# 정식 규약 준수 검토 — convention_compliance

검토 대상: `plan/in-progress/spec-draft-cafe24-public-dup-guard.md`
검토 모드: spec draft 검토 (--spec)
검토 일시: 2026-05-16

---

## 발견사항

### [INFO] plan 문서 자체는 규약 준수 — spec 변경 내용의 규약 적합성이 핵심 점검 대상

- target 위치: 문서 전체 구조
- 위반 규약: `CLAUDE.md` §명명 컨벤션 — `plan/in-progress/<name>.md` 는 평문, frontmatter 포함
- 상세: frontmatter(`worktree`, `started`, `owner`)가 정확히 기입되어 있고, `plan/in-progress/` 위치도 정상이다. 이 문서 자체의 형식 규약 위반은 없다. 이하 발견사항은 이 plan 이 기술하는 **spec 변경 내용**의 규약 적합성을 대상으로 한다.

---

### [WARNING] precheck endpoint 응답 shape이 swagger.md §5 규약(DTO 기반 래퍼)에 명시적 언급이 없음

- target 위치: 변경 2 — §9.2 신규 endpoint 행 추가
- 위반 규약: `spec/conventions/swagger.md` §5 (응답 DTO 규약) — "모든 성공 응답은 응답 DTO 클래스 + 공용 래퍼 헬퍼를 사용합니다"
- 상세: spec 변경안이 precheck endpoint 의 응답을 `{ conflict: bool, existingIntegrationId?: string, existingName?: string, status?: ... }` 인라인 shape 으로 기술하고 있다. `GET` 조회 응답이므로 실제 구현 시 `ApiOkWrappedResponse(PrecheckResponseDto)` 패턴을 따라야 하나, spec 본문(§9.2 표 셀)에 DTO 클래스 이름(`*ResponseDto`)이나 래퍼 헬퍼 적용 여부가 명시되어 있지 않다. spec 이 구현자에게 DTO명을 지정하지 않으면 인라인 schema 로 구현될 위험이 있다.
- 제안: §9.2 표 행의 응답 설명란에 "응답 DTO: `Cafe24PrecheckResponseDto`(래퍼: `ApiOkWrappedResponse`)" 식으로 DTO 명칭을 명시하거나, 최소한 swagger.md §5 규약에 따라 구현할 것임을 Rationale 또는 spec 본문에 주석 형태로 남긴다.

---

### [WARNING] `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 에러 코드 이름이 규약 선례(의미 기반 명명)와 불일치 — spec이 이를 "historical artifact"로 처리하지만 규약 갱신 언급 없음

- target 위치: 변경 3 — §9.4 errors 의 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 행 (신규 텍스트)
- 위반 규약: `spec/conventions/swagger.md` §2-4 주석 — "중복/충돌은 409, `INTEGRATION_IN_USE(409)` 선례"
- 상세: 신규 spec 텍스트가 코드 이름의 `PRIVATE` 토큰을 "historical artifact"로 명시하며, 의미는 public/private 모두 포괄하는 mall_id 기준 중복임을 밝힌다. `INTEGRATION_IN_USE` 선례와 비교하면 이 코드 이름은 의미를 정확히 반영하지 못한다. spec 이 "클라이언트는 코드 이름이 아닌 본 의미로 분기"라고 지시하더라도, 규약이 의미 기반 명명을 선례로 두고 있으므로 이 코드 이름을 그대로 유지하려면 `spec/conventions/swagger.md` 또는 integration spec 내 Rationale 에서 예외 사유를 명시적으로 등록해야 한다.
- 제안: ① spec Rationale 의 "historical artifact" 언급을 공식 예외 등록 형태로 격상("이 코드 이름은 의미 기반 명명 선례에서 예외이며 하위 호환성을 위해 유지한다")하거나, ② 가능하다면 이름을 `CAFE24_MALL_ALREADY_CONNECTED` 등 의미 기반으로 변경하는 마이그레이션 plan 을 별도 생성한다.

---

### [INFO] spec 변경안이 §9.2 표에 신규 endpoint throttle 정책을 표 셀 내 서술로 넣는 방식 — 별도 표나 섹션 분리 권장

- target 위치: 변경 2 — §9.2 신규 precheck endpoint 행
- 위반 규약: `CLAUDE.md` §프로젝트 스펙 문서 — "Overview / 본문 / Rationale 3섹션 권장"
- 상세: throttle 정책(60/min, 350ms debounce 기준 등)이 §9.2 표의 단일 셀 안에 장문으로 기술되어 있다. throttle 과 debounce 근거는 Rationale 에 이미 잘 정리되어 있으나, 표 셀 내 과도한 서술은 가독성을 해치고 스크롤 테이블 파싱(catalog-sync.spec.ts 등 MD 파서)에서 오해 가능성이 있다. 핵심 spec(throttle 60/min, 쿼리 파라미터 `mallId`, 응답 shape)만 표 셀에 두고 상세는 Rationale 참조 링크로 압축하는 것이 권장 구조에 부합한다.
- 제안: 표 셀을 핵심 정보로 압축하고 "자세한 내용은 Rationale §precheck endpoint 참조" 형태로 줄인다. Rationale 이미 존재하므로 내용 손실 없이 정리 가능.

---

### [INFO] 변경 4 Rationale 신설 항목에 날짜가 소제목에 포함 — 관행 확인 필요

- target 위치: 변경 4 — `### Cafe24 Public 흐름의 begin-time 사전 가드 추가 (2026-05-16)`, `### precheck endpoint — mall_id 입력 단계 사전 감지 UX (2026-05-16)`
- 위반 규약: CLAUDE.md §프로젝트 스펙 문서 — "spec 문서는 history가 아닌 latest에 대한 기술"
- 상세: Rationale 소제목에 날짜를 괄호로 포함하는 방식은 "history 가 아닌 latest" 원칙과 긴장 관계에 있다. 날짜는 git commit history 가 보존하므로 본문 소제목에 날짜를 박는 것은 과도한 이력 표시일 수 있다. 단, 다른 기존 Rationale 항목들이 같은 방식으로 작성된 선례가 있다면 일관성 측면에서 허용 범위다.
- 제안: 기존 `spec/2-navigation/4-integration.md` 의 다른 Rationale 소제목 스타일을 확인해 일치시킨다. 만약 날짜 포함이 기존 패턴이라면 유지해도 무방(INFO 수준).

---

### [INFO] 영향 분석 표에서 변경 없는 파일들을 나열 — plan 문서 목적에 부합하나 필수 규약 항목은 아님

- target 위치: §영향 분석 표
- 위반 규약: 해당 없음 (정보성 항목)
- 상세: `변경 없음` 행을 영향 분석에 포함한 것은 명시적 side-effect 검토를 보여주는 좋은 관행이다. 다만 plan 문서의 필수 구성은 아니며, 실제 spec 파일에 반영될 내용이 아니다. 특이사항 없음.
- 제안: 현행 유지 권장.

---

## 요약

`plan/in-progress/spec-draft-cafe24-public-dup-guard.md` 는 frontmatter·위치·구조 등 plan 문서 자체의 형식 규약을 충실히 따르고 있다. 점검 대상인 spec 변경 내용(§9.2 precheck 신규 endpoint, §9.4 에러 코드 확장, Rationale 2개 항목 신설)을 정식 규약 관점으로 검토한 결과, CRITICAL 위반은 없다. 다만 두 가지 WARNING이 발견된다. 첫째, precheck 신규 endpoint 응답 shape 이 인라인 객체로 기술되어 있어 swagger.md §5 의 DTO 기반 래퍼 적용 여부가 spec 에서 명시되지 않는다. 둘째, `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 코드 이름이 현 의미와 불일치함을 "historical artifact"로만 처리하고 있어, 규약의 의미 기반 명명 선례에 대한 공식 예외 등록이 누락되어 있다. 두 WARNING 모두 spec 작성 시 추가 명시로 해소 가능하며, 구현 오해를 예방하려면 spec 를 `output_file` 로 반영하기 전에 조치를 권장한다.

## 위험도

LOW
