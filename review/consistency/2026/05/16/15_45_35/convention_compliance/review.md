# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-cafe24-request-envelope.md`

## 발견사항

### 1. [INFO] Draft 내 "단독 envelope" 표기 — 규약 내에서도 혼용 가능성 존재
- **target 위치**: Draft #1 §4 본문, 3번째 불릿 (`- \`shop_no\` 가 body 에 없으면...`), 5번째 불릿, 6번째 불릿 모두 "envelope 을 적용하지 않는다" 등 단독 표기 사용
- **위반 규약**: 본 draft 자체의 "용어 정리" 절 — "단독 'envelope' 표기는 사용하지 않는다"
- **상세**: draft 문서의 "용어 정리" 섹션에서 모든 신규 문장에서 "**Cafe24 request envelope**" 또는 "**POST/PUT request envelope**" 로 한정 표기하고 "단독 'envelope' 표기는 사용하지 않는다"고 선언했음에도 불구하고, Draft #1 §4 본문 불릿 다수(`envelope 변환은...`, `envelope 적용은 자동`, `DELETE 에는 envelope 을 적용하지 않는다`, `envelope 적용 여부를 결정한다`)와 Draft #2 §4.2(`DELETE / GET 에는 envelope 을 적용하지 않는다`, `이중 래핑을 차단한다`) 및 §9.10(`envelope 은 Cafe24 wire format 의...`, `envelope 적용 지점 후보` 등) 에서 단독 "envelope" 표기가 다수 사용된다. 단, 이 중 상당수는 "Cafe24 wire format" 맥락이 앞 문장에서 명확히 수립된 뒤 이어지는 약어 사용이거나, 용어 주의 callout 박스 직후이므로 독자 혼동 위험은 낮다.
- **제안**: 단독 "envelope" 표기가 처음 등장하는 위치(§4 첫 불릿 "envelope 변환은 `Cafe24ApiClient`...")를 "**Cafe24 request envelope** 변환은..."으로 수정하거나, 본문 맥락이 이미 충분히 한정되어 있다는 근거로 규약 문구를 "문단 내 첫 등장 시 한정어 사용, 이후 약어 허용"으로 완화하는 것을 고려할 수 있다.

---

### 2. [INFO] CHANGELOG 항목의 TBD 경로 — 반영 전 해소 필요
- **target 위치**: Draft #2 §10 CHANGELOG 항목 마지막 열 — `consistency-check 세션: \`review/consistency/2026/05/16/<TBD>/\``
- **위반 규약**: `spec/conventions/*.md` 는 "정식 규약"으로 정확한 단일 진실을 담는 문서이며, `<TBD>` 같은 미확정 값이 포함된 상태로 spec 본문에 반영되면 안 된다.
- **상세**: 이 TBD 표기는 draft 단계에서 일시적으로 적어둔 것으로 보이며, spec 본문 반영(Write) 시점에는 실제 세션 경로(`review/consistency/2026/05/16/15_45_35/`)로 교체해야 한다. 만약 그대로 반영되면 `4-cafe24.md` CHANGELOG 에 잘못된 레퍼런스가 남는다.
- **제안**: spec 본문에 Write 하는 시점에 `<TBD>` 를 현재 consistency-check 세션 경로(`review/consistency/2026/05/16/15_45_35/`)로 치환한다.

---

### 3. [INFO] Draft #1 §4 헤딩의 절 번호 삽입 위치 서술과 실제 신규 §번호 명칭 일관성
- **target 위치**: Draft #1 전반 — "§3 과 §4 사이에 새 §4 를 삽입하고 기존 §4–§7 을 §5–§8 로 번호 이동"
- **위반 규약**: `spec/conventions/*.md` 관련 — 문서 구조 및 내부 참조의 일관성 유지 원칙
- **상세**: 기존 `cafe24-api-metadata.md` §4 제목이 "신규 endpoint 추가 절차"이다. draft는 이것을 §5로 밀고 새 §4를 삽입하는 방식인데, `cafe24-api-catalog/_overview.md` §6(신규 endpoint 등재 절차)과 `cafe24-api-metadata.md` 현재 §4 사이에 이미 `spec/conventions/cafe24-api-catalog/_overview.md`의 "§4. 동기 정책" 주석(`cafe24-api-metadata.md §4 의 신규 endpoint 추가 절차도 본 카탈로그 row 갱신을 step 으로 포함한다`)이 있어, 해당 절 번호 참조가 변경 후에도 유효한지 확인이 필요하다.
- **제안**: spec 반영 시 `cafe24-api-catalog/_overview.md` 말미의 `spec/conventions/cafe24-api-metadata.md §4 의 신규 endpoint 추가 절차`라는 주석을 §5로 갱신하거나, 헤딩 anchor 기반 링크로 전환하여 절 번호 이동에 강인하게 만든다. (현재 draft에 이 후속 처리가 명시되어 있지 않음)

---

## 규약 위반 없음 — 적합하게 따르고 있는 항목

- **plan 문서 파일 위치**: `plan/in-progress/spec-draft-cafe24-request-envelope.md` — `plan/in-progress/` 경로에 위치. 규약 준수.
- **plan 문서 frontmatter**: `worktree`, `started`, `owner` 세 필드 모두 명시. 규약 준수.
- **금지 경로 미사용**: 신규 문서를 `prd/`, `memory/`, `user_memo/` 경로에 생성하거나 참조하는 패턴 없음. 규약 준수.
- **spec 문서 구조 (3섹션)**: Draft #2 §4.2 가 본문 내용만, §9.10 이 Rationale 로 배치 — Overview / 본문 / Rationale 3섹션 구조 원칙에 정합. 규약 준수.
- **단일 진실 원칙**: `cafe24-api-metadata.md §4` 를 wire-format 규약의 "단일 진실"로 지정하고, `4-cafe24.md §4.2` 는 "책임이 wrapper에 있다는 사실만 명시"한다는 위계를 명확히 기술. 규약 준수.
- **정식 규약 파일 경로**: Draft에서 신설하는 내용은 모두 `spec/conventions/cafe24-api-metadata.md`(기존 규약 파일)에 삽입하는 방식이며, 별도 규약 파일을 잘못된 경로(`prd/`, `memory/` 등)에 신설하지 않음. 규약 준수.
- **노드 출력 envelope 용어 충돌 회피**: `node-output.md` Principle 0의 5필드(`{config, output, meta, port, status}`)를 "노드 출력 envelope"로 부르는 기존 용어와 충돌을 인식하고 명시적 구별(`> **용어 주의**` callout) 적용. 규약 인식 및 준수.
- **`spec/conventions/` 파일 평문 명명**: 신규 convention 파일을 신설하지 않고 기존 파일을 확장하는 방식이므로 명명 규약 논점 없음.
- **operation id 형식**: Draft #1 내 언급된 operation id(`mcp_b74e1adc__product_update`, `product_update`)는 기존 컨벤션 형식(`<resource>_<verb>`, bare id / MCP prefix 적용 형식)을 준수.
- **후속 plan 관리**: 완료 시 `plan/complete/`로 `git mv`하겠다는 절차를 명시. 규약 준수.

---

## 요약

`plan/in-progress/spec-draft-cafe24-request-envelope.md` 는 전반적으로 정식 규약을 충실히 준수하고 있다. CLAUDE.md 의 명명 컨벤션(plan 파일 경로·frontmatter·단일 진실 원칙), `spec/conventions/` 파일 운용 방식, node-output.md 의 노드 출력 envelope 용어 충돌 회피 등 핵심 항목이 올바르게 지켜진다. 발견된 3건은 모두 INFO 등급이며, 두 가지는 draft에서 spec 본문으로 Write 하는 시점에 해소해야 할 실천적 주의사항(단독 "envelope" 표기 일관성, TBD 경로 치환)이고 나머지 하나는 연관 문서(`cafe24-api-catalog/_overview.md`)의 절 번호 참조 갱신이 draft의 변경 대상 목록에서 누락되어 있다는 점이다. CRITICAL 또는 WARNING 수준의 규약 위반은 없다.

---

## 위험도

LOW
