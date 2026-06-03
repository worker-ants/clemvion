# Rationale 연속성 검토 결과

검토 기준: origin/main 대비 diff (spec/ 하위 13개 파일)
검토 모드: --impl-done, scope=spec/, diff-base=origin/main

---

## 발견사항

### [INFO] ForEach `$itemIsFirst`/`$itemIsLast` 노출 — 결정 번복이나 Rationale 정상 작성됨

- **target 위치**: `spec/4-nodes/1-logic/9-foreach.md` §3 + `## Rationale R-1`
- **과거 결정 출처**: `spec/4-nodes/1-logic/9-foreach.md` (origin/main) §3 — "표현식 컨텍스트에 노출되는 항목 변수는 위 두 개뿐이다 (`$item`, `$itemIndex`). 엔진 내부 `itemContext` 는 `isFirst`/`isLast` 플래그도 보유하지만, 이는 컨테이너 실행 제어용 내부 상태이며 expression 으로 노출되지 않는다. … 미구현 (Planned)"
- **상세**: 원래 spec 은 `isFirst`/`isLast` 를 "내부 상태이며 expression 으로 노출하지 않는다" 고 명시적으로 기술했다. 이번 변경은 이를 번복해 `$itemIsFirst` / `$itemIsLast` 를 top-level 변수로 노출한다.
- **평가**: `## Rationale R-1` 에 (a) 번복 이유 (body 표현식 가독성 수요 확인), (b) top-level 변수 형태를 선택한 이유 (`$item` 은 primitive 가능 — 속성 부착 불가), (c) 기각된 대안 두 가지 (`$item` 래핑, `$loop` 재사용) 가 모두 기술돼 있다. 규약에 따른 적정 Rationale 갱신으로 판단.
- **제안**: 추가 조치 불필요.

---

### [INFO] `Use Default Output` — 타입별 기본값 추론을 Planned 로 강등, Rationale 정상 작성됨

- **target 위치**: `spec/3-workflow-editor/1-node-common.md` §2.5.2 + `## Rationale R-1`
- **과거 결정 출처**: `spec/3-workflow-editor/1-node-common.md` (origin/main) §2.5.2 — "사용자가 기본값을 직접 설정하지 않은 경우, 노드 출력 타입에 따라 … 값이 자동 적용된다" (타입별 기본값 표 존재)
- **상세**: 원래 spec 은 타입별 기본값(Object→`{}`, Array→`[]`, 등)을 명세했다. 이번 변경은 이를 "미구현 — Planned" 표로 강등하고 현재 엔진은 `null` 폴백만 적용한다고 정정한다.
- **평가**: `## Rationale R-1` 에 엔진 현실(`error-policy.handler.ts` 는 `defaultOutput ?? null` 만 적용) 과의 정합 근거, "Reset to Type Default" 레이블 변경 이유가 기술돼 있다. code-sync 정정 케이스로 규약에 따른 적정 처리.
- **제안**: 추가 조치 불필요.

---

### [WARNING] Template 캔버스 요약 format 변경 — inline 근거만 있고 `## Rationale` 없음

- **target 위치**: `spec/4-nodes/6-presentation/5-template.md` §7 + `spec/4-nodes/6-presentation/0-common.md` §5 캔버스 요약 표
- **과거 결정 출처**: `spec/4-nodes/6-presentation/0-common.md` (origin/main) §5 캔버스 요약 표 — Template 버튼 없음: `{outputFormat} · {N} lines`, 버튼 있음: `{outputFormat} · {N} buttons` 두 행으로 명세.
- **상세**: 기존 spec 은 두 가지 Template 상태 포맷(버튼 유무)을 구분해 명세했다. 이번 변경은 이를 단일 `{{outputFormat}} · {{buttons.length}} buttons` 로 통일하면서 "버튼 없음 = N lines" 포맷을 완전히 제거했다. 이 결정의 근거("summaryTemplate 은 단일 정적 문자열이라 config 분기 불가, DSL 이 개행 카운트 미지원")는 `5-template.md §7` 에 inline 으로만 설명돼 있고, `spec/4-nodes/6-presentation/5-template.md` 에 `## Rationale` 섹션이 없다.
- **영향 범위**: 버튼 0개인 Template 노드는 이전에는 `html · 9 lines` 식으로 템플릿 내용을 암시했으나 이제 `html · 0 buttons` 로 표시된다. UX 관점에서 유용한 정보가 줄었고, 이는 "사용자에게 노드 설정 내용을 한 줄로 요약" 하는 summaryTemplate 의 원래 설계 의도와 거리가 있다.
- **제안**: `spec/4-nodes/6-presentation/5-template.md` 에 `## Rationale` 섹션을 추가해 (a) DSL 한계로 `N lines` 표현 불가, (b) 버튼 0개 시 `0 buttons` 가 불자연스러우나 단일 정적 `summaryTemplate` 제약상 차선임을 명시하거나, 또는 `0-common.md` 에 downscope 결정 항으로 추가. 현재 inline 근거는 `5-template.md §7` 에 있어 `0-common.md` 의 변경 내용과 동기화가 필요.

---

### [INFO] Database Query / Send Email summaryTemplate downscope — 근거 inline 기술됨

- **target 위치**: `spec/4-nodes/4-integration/0-common.md` §5 캔버스 요약 표 + `spec/4-nodes/4-integration/2-database-query.md` §7 + `spec/4-nodes/4-integration/3-send-email.md` §7
- **과거 결정 출처**: `spec/4-nodes/4-integration/0-common.md` (origin/main) §5 — Database Query: "미구현 (Planned)", Send Email: "미구현 (Planned)"
- **상세**: 과거에 "Planned"로 표기된 summaryTemplate 이 "downscope" 형태로 구현됐다. Database Query 는 "쿼리 첫 줄" 대신 전체 query truncate, Send Email 은 "to: 수신자 +N" 대신 수신자 수 + 제목으로 변경됐다. 이는 기각된 대안 재도입이 아니라 DSL 제약에 따른 기능 축소 후 구현이다.
- **평가**: `0-common.md` 에 downscope 근거 inline 노트가 추가돼 있다. 개별 spec 파일(`2-database-query.md`, `3-send-email.md`)에는 `## Rationale` 섹션 없이 §7 에 inline 으로 설명. send-email 의 `## Rationale §8` 는 SSRF 가드에 관한 것이고 summaryTemplate downscope 는 다루지 않는다.
- **제안**: `2-database-query.md` 와 `3-send-email.md` 에 summaryTemplate downscope 근거를 `## Rationale` 로 격상하거나, `0-common.md` 의 inline 노트를 단일 Rationale 진입점으로 명확히 지정. 현재 상태는 INFO 수준.

---

### [INFO] Code 노드 캔버스 요약 downscope — 근거 inline 기술됨

- **target 위치**: `spec/4-nodes/5-data/0-common.md` §5 캔버스 요약 표
- **과거 결정 출처**: `spec/4-nodes/5-data/0-common.md` (origin/main) — Code: `{language} · {N} lines` — 미구현 (Planned)
- **상세**: "Planned" 였던 `{language} · {N} lines` 대신 `{{language|upper}}` 만 구현. inline 으로 DSL 개행 카운트 미지원 근거 기술.
- **평가**: Template 과 동일 패턴. `## Rationale` 없이 inline 노트만 있으나 INFO 수준.

---

### [INFO] ForEach `$itemIsFirst`/`$itemIsLast` — 표현식 언어 spec 동기화 완료

- **target 위치**: `spec/5-system/5-expression-language.md` §4 컨텍스트 변수 표
- **과거 결정 출처**: 없음 (원본 표에 `$itemIsFirst`/`$itemIsLast` 행 자체가 없었음)
- **상세**: ForEach 노드 spec 의 Rationale R-1 결정과 일치하는 표 행 추가. 표현식 언어 spec 이 ForEach 노드 spec 과 동기화됨.
- **평가**: 정합. 추가 조치 불필요.

---

### [INFO] Embedding pipeline DocumentChunk.metadata — "항상 빈 `{}`" 기술 정정

- **target 위치**: `spec/5-system/8-embedding-pipeline.md` §6.1
- **과거 결정 출처**: 동일 파일 (origin/main) — "현재 항상 빈 `{}` 로 INSERT (page/section 채우는 파서 경로 미구현, Planned)"
- **상세**: 파서가 md 파일의 section, pdf 파일의 page 번호를 실제로 채우게 구현됐다. 기존의 "항상 빈 `{}`" 기술이 코드 현실로 정정됐다. 이 변경에 대한 Rationale 불필요 (Planned 구현 완료 케이스).
- **평가**: 정합. code-sync 정정. 추가 조치 불필요.

---

### [INFO] `config.errorHandling` nested 구조 도입 — 과거 spec 에 flat 형태 canonical 정의 없었음

- **target 위치**: `spec/3-workflow-editor/1-node-common.md` §2.4 + config 저장 형태 note
- **과거 결정 출처**: 없음 — `spec/5-system/3-error-handling.md` (origin/main) 에 config 스키마 형태(`config.errorPolicy` flat 또는 nested) 정의가 없었다.
- **상세**: 신규 spec 은 `config.errorHandling = { policy, retryConfig?, defaultOutput? }` 를 엔진 계약으로 명시하며, 과거 flat `config.errorPolicy` 단축값은 "로드 시 자동 마이그레이션"이라고 기술한다. 과거 spec 어디에도 flat 형태가 canonical 로 지정된 Rationale 기록이 없으므로 기각된 대안의 재도입이 아니다.
- **평가**: 정합. 추가 조치 불필요.

---

## 요약

이번 diff 에서 Rationale 연속성 위반에 해당하는 CRITICAL 항목은 없다. ForEach `$itemIsFirst`/`$itemIsLast` 노출(원래 "내부 전용"으로 명시) 과 `Use Default Output` 타입별 기본값 제거(원래 표로 명세) 두 가지가 명시적 결정 번복이지만, 두 spec 모두 `## Rationale` 섹션에 번복 이유와 기각된 대안을 갖추고 있어 규약을 충족한다. WARNING 1건은 Template 캔버스 요약 포맷 변경("버튼 없음 = N lines" 제거)이 inline 근거만 있고 `## Rationale` 없이 처리됐다는 점이다. 같은 배경의 Code / Database Query / Send Email downscope 들도 동일한 패턴(inline 노트)을 따르며 INFO 수준으로 평가된다. 합의된 시스템 invariant(S3 키 prefix 정책, 실행 엔진 큐 설계, Flyway forward-only, Inline Alert cross-cutting 위치 등) 을 위반하는 변경은 없다.

## 위험도

LOW
