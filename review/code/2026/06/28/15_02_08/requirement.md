# 요구사항(Requirement) 리뷰 결과

리뷰 대상: Channel Web Chat — polish batch (fresh 재검, webchat-polish-batch)
일시: 2026-06-28

---

## 발견사항

### [INFO] EmbedConfigDto allowlist·enforce 필드 JSDoc 병기 — 패턴 충족
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-polish-batch-99e2ed/codebase/backend/src/modules/hooks/dto/responses/embed-config.dto.ts` L8, L18
- 상세: `allowlist` 와 `enforce` 두 필드 모두 `/** ... */` JSDoc 주석이 추가됐다. spec `4-security §3-①` 이 정의하는 `EmbedConfigDto { allowlist: string[], enforce: boolean }` 필드 형태와 완전 일치한다. `enforce` JSDoc 의 "allowlist 가 1개 이상일 때 true" 파생 조건은 spec 본문에 명시되지 않으나, `EmbedConfigService` 구현(`enforce: allowlist.length > 0`)과 정확히 일치하며 spec 의 허용 범위 내다. `@ApiProperty.description` 과 JSDoc 표현이 미묘하게 다르나("위젯이 렌더/시작 거부" vs "위젯은 enforce=true 이고…를 거부한다") 의미는 동일 — 컨벤션(swagger.md §1-1) 상 병기 의도적이므로 기능 결함 없음.
- 제안: 없음.

### [INFO] [SPEC-DRIFT] `safeApiBaseFromQuery` — 코드 구현과 spec §1 행의 일치 확인
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-polish-batch-99e2ed/codebase/channel-web-chat/src/widget/use-widget.ts` L84-94 및 `spec/7-channel-web-chat/4-security.md §1` "`apiBase` 입력 검증" 행
- 상세: spec `4-security.md §1` 표(현재 파일)에 "`apiBase` 입력 검증" 행이 이미 추가되어 있다 — "http(s) 스킴만 허용(`safeApiBaseFromQuery`), 부적합 시 무시 + `console.warn`. 코드 SoT: `use-widget.ts configFromQuery`/`safeApiBaseFromQuery`". 코드 구현과 spec 행이 일치한다. 이전 review(14:49:11)에서 SPEC-DRIFT 로 기록됐던 항목이 본 후속에서 spec 에 반영된 상태로, 현재 상태에서는 괴리 없음.
- 제안: 없음 (SPEC-DRIFT 해소 확인).

### [INFO] `safeApiBaseFromQuery` 기능 완전성 — 모든 케이스 처리 확인
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-polish-batch-99e2ed/codebase/channel-web-chat/src/widget/use-widget.ts` L84-94
- 상세: 구현 검토 결과:
  - `!raw` (null, "") → 즉시 `undefined` 반환 (경고 없음) — 의도적 설계, 코드 주석·JSDoc 과 일치
  - http(s) 스킴 → 원본 문자열 그대로 반환 — path/query 보존 의도와 일치
  - 비-http(s) 스킴(javascript:, data:, 파싱불가 포함) → `console.warn` + `undefined` 반환
  - `try-catch` 로 `new URL(raw)` 파싱 실패(상대경로) 시 catch 분기 → warn + undefined — 에러 시나리오 처리 완전
  - `configFromQuery()` 에서 `q.get("apiBase")` 반환값을 `safeApiBaseFromQuery` 로 감싸서 교체 — 적용 완전
- 제안: 없음.

### [INFO] `use-widget.test.ts` 테스트 케이스 완전성 — 이전 리뷰 지적사항 전부 보강됨
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-polish-batch-99e2ed/codebase/channel-web-chat/src/widget/use-widget.test.ts` L14-49
- 상세: 이전 review(14:49:11)에서 INFO로 기록된 누락 케이스(data: 스킴, 빈 문자열, console.warn 호출 단언)가 모두 추가되어 있다:
  - L29-33: `data:text/html,<script>` → `undefined` + `warn` 호출 단언
  - L39-43: 빈 문자열 `""` → `undefined` (경고 없음) 단언
  - L27: `javascript:` 케이스 — `warn.toHaveBeenCalledWith(expect.stringContaining("[widget]"), "javascript:alert(1)")` 명시적 단언
  - L37: 상대경로 `/api` 케이스 — `expect(warn).toHaveBeenCalled()` 단언
  - `afterEach(() => vi.restoreAllMocks())` 로 spy 정리 정확히 처리
  - 총 7케이스(https·http·javascript:·data:·상대경로·빈문자열·null) — 기능 완전성 커버리지 충분
- 제안: 없음.

### [INFO] TODO/FIXME 없음
- 위치: 변경된 세 코드 파일 전체
- 상세: 코드 변경 파일 전체에서 TODO, FIXME, HACK, XXX 주석이 발견되지 않았다.
- 제안: 없음.

### [INFO] 반환값 — 모든 경로 적절한 값 반환
- 위치: `use-widget.ts` L84-94 `safeApiBaseFromQuery`
- 상세:
  - 경로 1(`!raw`): `undefined` 반환 — 명시적
  - 경로 2(http(s) 스킴): `raw` 문자열 반환 — 원본 보존 명시적
  - 경로 3(try 블록 조건 불일치 또는 catch): 함수 말미의 `return undefined` 로 낙하 — 명시적
  - 함수 반환 타입 `string | undefined` 와 모든 경로가 일치한다.
- 제안: 없음.

---

## 기능 완전성 점검 요약

| 점검 항목 | 결과 | 비고 |
|---|---|---|
| EmbedConfigDto JSDoc — swagger §1-1 패턴 | PASS | allowlist·enforce 양 필드 추가 |
| `safeApiBaseFromQuery` — http(s) 스킴 허용 | PASS | `url.protocol === "http:" \|\| "https:"` |
| `safeApiBaseFromQuery` — 비-http(s) 차단 | PASS | catch + 명시적 undefined 반환 |
| `safeApiBaseFromQuery` — null/빈 문자열 경고 없음 | PASS | `!raw` 선처리 |
| `configFromQuery()` 교체 적용 | PASS | `q.get("apiBase")` → `safeApiBaseFromQuery(...)` |
| 단위 테스트 7케이스(https·http·javascript:·data:·상대경로·빈문자열·null) | PASS | 이전 리뷰 누락 3케이스 전부 보강 |
| console.warn 호출 단언 — javascript:/data:/상대경로 케이스 | PASS | 이전 리뷰 지적 보강 완료 |
| `EmbedConfigService.enforce` 파생 조건 | PASS | `allowlist.length > 0` 과 DTO 설명 일치 |
| TODO/FIXME/HACK 주석 | PASS | 없음 |
| 에러 시나리오(URL 파싱 실패) | PASS | catch 분기 + warn + undefined |
| spec `4-security §3-①` EmbedConfigDto 필드 일치 | PASS | `{ allowlist: string[], enforce: boolean }` |
| spec `4-security §1` apiBase 입력 검증 행 | PASS | SPEC-DRIFT 해소됨(spec 반영 확인) |

---

## 요약

이번 fresh 리뷰(15:02:08) 대상은 이전 리뷰(14:49:11) 이후 보강된 코드다. 핵심 변경 두 건 — (1) `EmbedConfigDto` 의 JSDoc 병기(spec `4-security §3-①` 필드 정의와 완전 일치), (2) `safeApiBaseFromQuery` 를 통한 `apiBase` http(s) 스킴 하드닝 — 모두 기능 완전성을 충족한다. 이전 리뷰에서 INFO 로 기록된 테스트 누락 케이스(data: 스킴·빈 문자열·console.warn 단언)가 전부 보강되어 총 7케이스로 완성됐으며, SPEC-DRIFT 항목(safeApiBaseFromQuery 의 spec 미명세)도 `4-security §1` 에 행 추가로 해소된 상태가 확인됐다. CRITICAL·WARNING 발견 없음. 에러 시나리오, 엣지케이스(null/빈/파싱불가/비-http 스킴), 반환값, 비즈니스 로직 모두 적절히 처리됐다.

---

## 위험도

NONE
