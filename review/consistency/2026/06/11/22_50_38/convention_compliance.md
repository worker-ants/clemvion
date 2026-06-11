# Convention Compliance Review — `spec/4-nodes/4-integration/1-http-request.md`

검토 모드: spec draft (`--spec`)
검토 일시: 2026-06-11

---

## 발견사항

### 출력 포맷 규약

- **[INFO]** `§5.3.2` Transport 실패 케이스 — `output.response` legacy 잔재 필드의 규약 정합
  - target 위치: §5.3.2 표, `output.response.error` 행
  - 위반 규약: `spec/conventions/node-output.md Principle 1` — `output` 은 비즈니스 결과물만 담는다
  - 상세: transport 실패 시 `output.response = { error: <message> }` 를 spec 이 "legacy 잔재" 로 명시하고 있다. Principle 1 기준으로 에러 메시지는 `output.error.*` 에 있고, `output.response` 는 HTTP 응답 본문(비즈니스 결과물)용이므로 transport 실패 시 `output.response` 를 채우는 것은 원칙 위반이다. 단, 본 spec 이 이를 "legacy 잔재" 로 **이미 인식하고 명시**하고 있어 기존 계약의 의도된 호환 잔재임을 밝히고 있다.
  - 제안: 규약 위반 인지는 이미 돼 있으므로 CRITICAL·WARNING 아님. 향후 major 버전 정리 시 `output.response` 제거 후 `output.error.message` 만 유지하도록 계획 plan 을 `pending_plans:` 에 등재하거나, Principle 1 의 HTTP 노드 예외 footnote 로 명문화해 "legacy 호환 잔재임"을 규약 수준에서 봉합하는 것을 권장.

- **[INFO]** `§5` 출력 구조 도입부 — Principle 11 인용 포맷과 실제 케이스 번호 체계
  - target 위치: §5 도입 주석 블록, §5.2 번호 보존 설명
  - 위반 규약: `spec/conventions/node-output.md Principle 11` — Case 별 분리(성공 / 에러 / 재개 등)를 권장
  - 상세: Principle 11 은 `### Case: <케이스 이름>` 형식을 규정한다. 본 spec 은 `### 5.1 Case:` / `### 5.3 Case:` 처럼 번호를 앞에 붙이고 `§5.2 의도적으로 비어 있음` 주석을 달았다. 번호 prefix 자체는 Principle 11 이 금지하지 않으나, `§5.2` 가 실제 내용 없이 연번 보존 목적으로만 존재하는 점이 규약의 "Case 별 분리" 정신과 미묘하게 어긋난다 (빈 절 존재).
  - 제안: `§5.2` 빈 절 제거 후 `§5.1`→`§5.2` 로 renumber 하거나, 도입부 주석에 "§5.2 는 과거 케이스 제거 후 연번 보존용" 임을 명시해 혼동을 방지. 후자는 이미 적용돼 있으므로 현행 유지 가능.

### 명명 규약

- **[INFO]** `output.error.code` 값 `HTTP_4XX` — 3xx 도달 시에도 동일 코드 사용
  - target 위치: §6 에러 코드 표, `HTTP_4XX` 행 설명
  - 위반 규약: `spec/conventions/error-codes.md §1` — 에러 코드 이름은 조건의 의미를 기술해야 한다
  - 상세: `HTTP_4XX` 는 `400 ≤ statusCode < 500` 를 의미하는 이름이나, §6 표 `HTTP_4XX` 설명에서 "(또는 manual redirect 한도 도달한 3xx 도달 시)" 를 추가 조건으로 포함한다. 즉 3xx 응답이 `HTTP_4XX` 코드로 surface 될 수 있어 이름과 의미가 부분적으로 어긋난다. error-codes.md §2 기준으로 rename 은 breaking change 이므로 신설 코드 권장 대상이나, 해당 케이스가 edge case(5홉 초과)이고 기존 계약에 이미 포함돼 있어 현행 코드 유지 가능성이 높다.
  - 제안: 이 불일치를 `spec/conventions/error-codes.md §3 Historical-artifact 예외 레지스트리` 에 등재하거나, `HTTP_REDIRECT_LIMIT` 같은 별도 코드 신설을 검토. 후자가 의미 정확성 측면에서 더 나으나 breaking change 이므로 결정은 별도 이슈로 추적 권장. 당장 본 spec 의 §6 표에 "3xx redirect 5홉 초과 시 HTTP_4XX 로 surface" 임을 명확히 주석하는 것은 이미 돼 있으므로 현행 수준은 수용 가능.

### 문서 구조 규약

- **[INFO]** Rationale 섹션 번호 — `§8` 위치 및 CLAUDE.md 3섹션 권장 구조와의 관계
  - target 위치: `## 8. Rationale` 절
  - 위반 규약: CLAUDE.md "문서 구조 규약" — `Overview / 본문 / Rationale` 3섹션 권장
  - 상세: CLAUDE.md 는 spec 문서 끝에 `## Rationale` 절을 권장한다. 본 spec 은 `## 8. Rationale` 로 번호를 붙이고 있는데, 이는 각 노드 spec 의 번호 체계(§1~§7은 실제 섹션)와 정합하며 Rationale 가 마지막에 위치하는 것은 권장과 일치한다. 단, CLAUDE.md 가 "## Rationale" (번호 없음) 을 암시하는 반면 본 doc 은 "## 8. Rationale" 형식이다. Integration 계열 다른 spec(`0-common.md` 등)도 동일 패턴을 사용하는지 확인 후 일관성 평가 가능. 이 자체는 낮은 중요도.
  - 제안: 영역 내 다른 spec 과 일관된 형식을 유지하면 OK. 현재 형식은 위반이 아닌 허용 범위 내 변형.

- **[NONE]** Frontmatter `status: implemented` + `code:` 경로 4개
  - target 위치: 파일 도입 frontmatter
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §2 / §3`
  - 상세: `status: implemented` 이고 `code:` 에 4개 경로가 명시돼 있다. `pending_plans:` 없음 — `implemented` 상태에서는 없어야 하므로 정합. `id: http-request` 는 파일 basename (`1-http-request`) 과 다르나, `spec-impl-evidence.md §2.1` 은 "파일 basename 기반 **권장**" 이고 충돌 회피나 읽기 편의를 위한 약어 사용을 명시적으로 금지하지 않는다. 가드(`spec-frontmatter.test.ts`)는 `id` 유효성만 검사하며 basename 일치를 강제하지 않으므로 현행은 가드 통과 범위.
  - 제안: 현행 유지 가능. 단, Integration 영역 내에서 `id` 가 basename 기반인 것(`0-common` → `common`)과 아닌 것이 섞이면 일관성 저하. 새로 작성 시 `id: 1-http-request` 또는 `http-request` 중 영역 관례를 따를 것.

### 출력 포맷 규약 (추가)

- **[NONE]** `config` echo — spread 금지 및 명시 enumeration 준수 선언
  - target 위치: §4 step 2, §5.1 config 표
  - 위반 규약: `spec/conventions/node-output.md Principle 7 D1`
  - 상세: spec 이 `context.rawConfig` 에서 스키마 정의 필드를 각각 직접 참조해 echo 하고 `{ ...rawConfig }` spread 는 금지한다고 명시하며 이를 Principle 7 D1 에 cross-link. 규약 준수 선언이 spec 본문에 명확히 기재돼 있어 규약과 완전히 정합.
  - 제안: 없음.

- **[NONE]** `output.error` 표준 형태 — Principle 3.2 준수
  - target 위치: §5.3.1 / §5.3.2 에러 출력 예시
  - 위반 규약: `spec/conventions/node-output.md Principle 3.2`
  - 상세: `{ code, message, details }` 형태가 Principle 3.2 표준 envelope 과 일치. `code` 는 `UPPER_SNAKE_CASE`. `details` 내 `statusCode`, `statusText`, `url`, `method` 는 §3.2.2 노드별 선택 스키마에 해당. 규약 완전 준수.
  - 제안: 없음.

- **[NONE]** `meta.durationMs` 통일
  - target 위치: §5.1, §5.3 출력 예시, `meta` 표
  - 위반 규약: `spec/conventions/node-output.md Principle 2` (HTTP: `meta.statusCode` + `meta.durationMs`)
  - 상세: 두 필드 모두 예시와 표에 정확히 기재. 규약 준수.
  - 제안: 없음.

- **[NONE]** `port` 필드 — Principle 5 준수
  - target 위치: §5.1, §5.3 출력 예시
  - 위반 규약: `spec/conventions/node-output.md Principle 5`
  - 상세: `port: 'success'` / `port: 'error'` 로 string 형태의 단일 포트 선택이며 포트 ID 이외의 값 사용 없음. 규약 준수.
  - 제안: 없음.

### 금지 항목

- **[NONE]** D4 결정 이전 throw 경로 — 폐기 여부
  - target 위치: §5.8
  - 위반 규약: `spec/conventions/node-output.md Principle 3.1 (D4 주석)`
  - 상세: `handler.validate()` 실패는 여전히 throw, `execute()` 안의 모든 IntegrationError / SSRF / auth 실패는 `port:'error'` 라우팅으로 명확히 분리. Principle 3.1 D4 결정과 완전히 정합.
  - 제안: 없음.

---

## 요약

`spec/4-nodes/4-integration/1-http-request.md` 는 정식 규약(`spec/conventions/`) 을 전반적으로 충실히 준수하고 있다. frontmatter는 `spec-impl-evidence.md` 의 `status: implemented` + `code:` 요건을 충족하고, 출력 구조는 `node-output.md` Principle 0·2·3·5·7·11 을 명시적으로 cross-link 하며 따른다. D4 결정(SSRF / 인증 실패 → `port:'error'` 라우팅)도 Principle 3.1 와 완전히 정합한다. 발견된 사항은 모두 INFO 수준이다 — transport 실패 시 `output.response` legacy 잔재가 Principle 1 과 미묘하게 어긋나나 spec 이 이를 이미 인지하고 명시한 상태이고, `HTTP_4XX` 코드가 3xx 한도 초과를 포함하는 의미 불일치는 error-codes.md §3 Historical-artifact 레지스트리 등재 또는 신설 코드 검토 트랙으로 처리하면 된다. CRITICAL 또는 WARNING 발견사항 없음.

---

## 위험도

LOW
