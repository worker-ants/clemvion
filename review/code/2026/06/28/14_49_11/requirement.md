# 요구사항(Requirement) 리뷰 결과

리뷰 대상: Channel Web Chat — 선택 spec polish + 섹션 C 메모 batch (`webchat-polish-batch`)
일시: 2026-06-28

---

## 발견사항

### **[INFO]** EmbedConfigDto JSDoc 추가 — 패턴 충족
- 위치: `codebase/backend/src/modules/hooks/dto/responses/embed-config.dto.ts` (파일 1)
- 상세: `allowlist` 및 `enforce` 두 필드에 `/** ... */` JSDoc 주석이 추가됐다. `spec/conventions/swagger.md §1-1` 패턴("모든 필드에 JSDoc 추가")을 정확히 따른다. 기존 `@ApiProperty` description 과 JSDoc 내용이 일치하며 중복 기술이 의도적(플러그인 호환 + Swagger UI 병기)임을 확인했다. plan 항목 "[x] `EmbedConfigDto` allowlist·enforce 필드 JSDoc 병기"와 일치.
- 제안: 없음.

### **[INFO]** `enforce` JSDoc 설명 — 파생 조건 기술이 spec 에 없으나 올바름
- 위치: `embed-config.dto.ts` line 70 — `/** soft 차단 활성 여부 — allowlist 가 1개 이상일 때 true. ... */`
- 상세: DTO JSDoc 은 `enforce` 를 "allowlist 가 1개 이상일 때 true" 로 설명한다. 이 조건은 spec 본문(`4-security §3-①`)에 명시되지 않은 **파생 조건**이나, `EmbedConfigService` 구현(`embed-config.service.ts` line 57: `enforce: allowlist.length > 0`)과 완전히 일치한다. spec 은 `enforce=false` 시 fail-open 동작만 정의하고 `enforce` 를 누가/어떻게 산출하는지는 서비스 SoT 에 위임 — 코드 구현이 spec 의 허용 범위 내다.
- 제안: 없음 (스펙이 구현 세부를 서비스에 위임하고 있으므로 INFO 수준).

### **[INFO]** [SPEC-DRIFT] `safeApiBaseFromQuery` 함수 — spec 에 명세되지 않은 방어 로직 추가
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` (파일 3), 추가된 `safeApiBaseFromQuery` 함수
- 상세: `configFromQuery()` 내부에서 쿼리 파라미터 `apiBase` 를 `?? undefined` 로 단순 사용하던 코드를 `safeApiBaseFromQuery()` 를 통해 `http(s)` 스킴만 허용하도록 하드닝한 변경이다. `spec/7-channel-web-chat/4-security.md §1.1` 은 마크다운/HTML 렌더의 sanitize 를 규정하나, `apiBase` 쿼리 파라미터 스킴 검증은 어떤 spec 문서에도 명시되지 않는다. 한편 `5-admin-console §6.1` 은 `configFromQuery()` 가 `apiBase` 를 query param 으로 부트스트랩에 사용함을 설명하며, 이 경로가 외부 입력임을 간접 확인한다. 구현이 의도적이고 합리적인 보안 강화(javascript: / data: 등 비-http(s) 스킴이 fetch base 로 사용될 경우의 SSRF/XSS 경로 차단)이며 spec 이 이 방어를 규정하지 않아 "코드가 맞고 spec 이 낡음"에 해당한다.
- 제안: 코드 유지 + `spec/7-channel-web-chat/4-security.md §1` 또는 별도 §1.2 에 "쿼리 파라미터 `apiBase` 는 http(s) 스킴만 허용 — `safeApiBaseFromQuery` 로 검증, 부적합 시 undefined + console.warn" 행위 명세 추가를 `project-planner` 에 위임. 해당 함수가 `export` 됐으므로 테스트에서도 참조된다(파일 2 확인).

### **[INFO]** `safeApiBaseFromQuery` 엣지 케이스 — 빈 문자열 처리
- 위치: `use-widget.ts` line 198 — `if (!raw) return undefined;`
- 상세: `!raw` 는 `null`, `undefined`, `""` 를 모두 처리한다. `""` 는 `new URL("")` 이 `TypeError` 를 throw 하므로 try-catch 에서도 잡히나, `!raw` 선처리로 console.warn 없이 undefined 를 반환한다. 이는 테스트 케이스 "null → undefined(경고 없음)" 와 동일한 동작으로, 빈 문자열도 경고 없이 처리된다. 비어있는 `apiBase` 는 실수에 가까우므로 경고 없는 처리가 더 자연스럽다 — INFO.
- 제안: 없음.

### **[INFO]** `safeApiBaseFromQuery` 테스트 — `data:` 스킴 케이스 미포함
- 위치: `codebase/channel-web-chat/src/widget/use-widget.test.ts` (파일 2), `safeApiBaseFromQuery` describe 블록
- 상세: 함수 주석에 "javascript:/data:/상대경로 등 비-http(s) 값을 거른다" 고 명시하지만 테스트 케이스에는 `javascript:` 케이스만 있고 `data:blob,...` 등 `data:` 스킴 케이스가 없다. `data:` 는 `new URL("data:...")` 파싱이 성공하고 protocol 이 `"data:"` 이므로 현재 구현에서 올바르게 차단된다. 테스트 커버리지 관점에서 문서-코드 일치 보강용 케이스지만, 기능 결함은 아님.
- 제안: INFO 수준 권고로, `data:text/html,...` 케이스를 `javascript:` 케이스 아래에 추가하면 주석 설명과 테스트가 1:1로 대응된다.

### **[INFO]** plan/in-progress 파일의 절차 체크박스 미완료 상태
- 위치: `plan/in-progress/webchat-polish-batch.md` (파일 4) `## 절차` 섹션
- 상세: `/consistency-check --impl-prep → BLOCK: NO`, `TEST WORKFLOW`, `/ai-review`, `/consistency-check --impl-done` 모두 `[ ]` (미완료)로 표시되어 있다. 이 파일은 현재 리뷰 중이므로 ai-review 체크박스는 리뷰 완료 후 커밋 시 업데이트돼야 한다. 파일이 초기 상태로 제출된 것 자체는 이 단계에서 정상이다.
- 제안: 없음 (리뷰 및 테스트 완료 후 체크박스 갱신 필요 — memory 항목 "plan 체크박스 = 실제 상태" 참조).

---

## 기능 완전성 점검 요약

| 점검 항목 | 결과 | 비고 |
|---|---|---|
| EmbedConfigDto JSDoc — swagger §1-1 패턴 | PASS | allowlist·enforce 양 필드 추가 |
| `safeApiBaseFromQuery` — http(s) 스킴 허용 | PASS | `u.protocol === "http:" \|\| "https:"` |
| `safeApiBaseFromQuery` — 비-http(s) 차단 | PASS | catch + 명시적 undefined 반환 |
| `safeApiBaseFromQuery` — null 입력 경고 없음 | PASS | `!raw` 선처리 |
| `configFromQuery()` 교체 적용 | PASS | `q.get("apiBase")` → `safeApiBaseFromQuery(...)` |
| 단위 테스트 5케이스(https·http·javascript:·상대경로·null) | PASS | 파일 2 전체 컨텍스트 확인 |
| `EmbedConfigService.enforce` 파생 조건 | PASS | `allowlist.length > 0` 과 DTO 설명 일치 |
| TODO/FIXME/HACK 주석 | PASS | 없음 |
| 에러 시나리오(URL 파싱 실패) | PASS | catch 분기 + warn + undefined |
| spec `4-security §3-①` EmbedConfigDto 필드 일치 | PASS | `{ allowlist: string[], enforce: boolean }` |

---

## 요약

이번 변경은 두 가지 구현을 포함한다. (1) `EmbedConfigDto` 의 `allowlist`·`enforce` 필드에 JSDoc 주석을 추가해 `spec/conventions/swagger.md §1-1` 패턴을 충족한 것으로, spec 본문(`4-security §3-①`)의 필드 정의와 완전히 일치한다. (2) `configFromQuery()` 내 `apiBase` 쿼리 파라미터를 `safeApiBaseFromQuery()` 로 하드닝해 `javascript:`·`data:`·상대경로 등 비-http(s) 값이 fetch base 로 전달되는 경로를 차단한 것으로, 5개 단위 케이스로 충분히 검증됐다. 기능 완전성·엣지 케이스·에러 시나리오 모두 적절히 처리됐으며, CRITICAL·WARNING 발견 없음. `safeApiBaseFromQuery` 는 spec 이 규정하지 않는 방어 로직이므로 [SPEC-DRIFT](INFO)로 기록한다. `data:` 스킴 테스트 케이스 부재는 기능 결함 없는 커버리지 개선 권고(INFO)다.

---

## 위험도

NONE
