# 신규 식별자 충돌 검토 — `plan/in-progress/spec-draft-auth-invariants-sync.md`

## 발견사항

- **[WARNING]** `3-error-handling.md §1.3` 카탈로그 "코드" 컬럼에 `VALIDATION_ERROR` 가 두 가지 다른 텍스트 형태로 등재됨
  - target 신규 식별자: 변경 1-b 가 새로 추가하는 표 행의 "코드" 컬럼 값
    `` `VALIDATION_ERROR` (`X-Workspace-Id` 형식) ``
  - 기존 사용처:
    - `spec/5-system/3-error-handling.md:76` — 같은 표의 기존 행 `` | `VALIDATION_ERROR` | 요청 데이터 유효성 실패 | 400 | ``(코드 컬럼 값은 접미사 없는 순수 `VALIDATION_ERROR`)
    - target 자신의 항목 2 (`15-chat-channel.md §5.4` diff) — 같은 PR 안에서 같은 조건(헤더 형식 오류)을 등재하면서 코드 컬럼은 `` `VALIDATION_ERROR` `` 그대로 두고 구분자는 설명(prose) 쪽에만 넣음: `` | 400 | `VALIDATION_ERROR` | ...위 `WORKSPACE_ID_REQUIRED`...와 **다른 케이스**... |``
    - `codebase/backend/src/common/utils/workspace-context.util.ts:75-78` (실측) — 실제 throw 되는 값은 `{ code: 'VALIDATION_ERROR', message: 'X-Workspace-Id must be a UUID' }` 이며 `details.field` 등 별도 식별자가 없음. wire 상의 리터럴 코드 문자열은 접미사 없는 `VALIDATION_ERROR` 그대로임
    - `spec/conventions/error-codes.md:38-39` — "클라이언트는 코드의 **의미**로 분기하며 이름 토큰 부분 문자열을 파싱하지 않는다. 코드의 *정의(spec 본문)* 가 진실이고 이름은 라벨일 뿐" 이라는 명명 규약과, 표 안에서 이미 확립된 다른 disambiguation 관행(예: `RESERVED_VARIABLE_NAME` 은 코드명을 그대로 두고 **HTTP 컬럼**에 `400 (저장) / — (런타임)` 처럼 surface 한정자를 붙임 — target 자신도 변경 1-a/1-b 노트에서 이 선례를 인용함)
  - 상세: 같은 PR 안에서 같은 근본 코드(`VALIDATION_ERROR`)·같은 근본 조건(`X-Workspace-Id` 헤더 형식 오류)을 두 표(§1.3, §5.4)에 등재하면서, §1.3 에서는 코드 컬럼 자체에 `` (`X-Workspace-Id` 형식) `` 한정자를 박아 넣고 §5.4 에서는 그렇게 하지 않아 **동일 PR 내부에서 표기 방식이 갈린다.** 실제로 API 가 반환하는 `error.code` 리터럴은 어디서나 순수 `VALIDATION_ERROR` 하나뿐인데, §1.3 표만 보면 마치 `` VALIDATION_ERROR (X-Workspace-Id 형식) `` 이라는 별도 코드 문자열이 존재하는 것처럼 읽힐 위험이 있다. `error-codes.md` 가 명시한 "코드는 의미로만 분기, 이름 토큰을 파싱하지 않는다" 원칙과도 어긋나는 방향(코드 컬럼에 조건을 인코딩)이다. 다만 자동 파서(예: `spec-code-paths.test.ts` 류)가 이 표의 "코드" 컬럼을 문자열 그대로 파싱해 실제 코드와 대조하는 검사는 현재 저장소에 없어(전수 grep 확인) CI 를 깨뜨리지는 않는다 — 그래서 CRITICAL 이 아니라 WARNING.
  - 제안: §1.3 새 행의 "코드" 컬럼은 다른 재사용 행들과 동일하게 순수 `` `VALIDATION_ERROR` `` 로 두고, `` (`X-Workspace-Id` 형식) `` 한정자는 §5.4 diff 처럼 설명(prose) 쪽으로 옮기거나, `RESERVED_VARIABLE_NAME` 선례를 따라 별도 컬럼(예: HTTP 컬럼 옆에 "발행 지점" 한정자)으로 옮긴다. 두 표(§1.3, §5.4)의 표기 형식을 통일할 것.

- **[INFO]** `data-flow/12-workspace.md` 신설 subsection 삽입 위치 서술과 실제 구조 불일치 (참고용 — 순수 naming collision 은 아님)
  - target 서술: "신설 subsection (12-workspace.md `## Rationale` **말미**, `### URL slug = FE 라우팅 SoT` **다음**)"
  - 기존 사용처: `spec/data-flow/12-workspace.md` 의 `## Rationale` 절 헤더 순서 — `### URL slug = FE 라우팅 SoT` 뒤에 `### workspace.deleted 감사 제외` · `### workspace_invitation.email 일치 강제` · `### 명칭 통일 범위` · `### personal 워크스페이스 유일성` 4개 subsection 이 더 있음(실측)
  - 상세: "말미"(끝)라는 서술과 실제 삽입 지점("다음")이 어긋난다 — `### URL slug = FE 라우팅 SoT` 바로 뒤에 넣으면 실제로는 `## Rationale` 중간에 삽입되는 것이지 끝이 아니다. 식별자 충돌은 아니지만 구현자가 "말미"만 보고 실제 파일 끝에 붙이면 target 이 지정한 정확한 삽입 지점(§4·§5 항목이 서로 링크하는 순서)과 어긋날 수 있다.
  - 제안: "말미" 표현을 삭제하거나 "`### personal 워크스페이스 유일성` 앞(= `### URL slug = FE 라우팅 SoT` 바로 다음)"처럼 정확히 서술.

## 확인했으나 충돌 없음 (근거만 기록)

다음은 이번 관점(신규 식별자 충돌)에서 실측 검증했으며 **충돌 없음**으로 판정한 항목:

- `VALIDATION_ERROR`(§1.3), `WORKSPACE_ID_REQUIRED`(§1.3 기존 행) — 재사용/대비 서술이 실제 `spec/5-system/3-error-handling.md:76,78` 현재 텍스트와 정확히 일치, diff 가 정확히 그 텍스트 위에 적용됨.
- 새 subsection 제목 `### 부트 캐너리 — @WorkspaceId() reflection 자가검증 (fail-closed, 2026-08-09)` — `spec/5-system/1-auth.md` 전체에 "부트 캐너리" 문자열 기존 사용 0건(신규), 앵커 충돌 없음.
- 새 subsection 제목 `### X-Workspace-Id 헤더 vs :id 경로 파라미터 — UUID 검증 강도 비대칭 (2026-08-09)` — `spec/data-flow/12-workspace.md` 에 "UUID 검증" 관련 기존 서술 0건(신규), 앵커 충돌 없음.
- `resolveRequestWorkspaceContext`·`isUuidShaped`·`handlerConsumesWorkspaceId`·`assertWorkspaceIdReflectionWorks` — 전부 이미 구현·머지된 코드의 실제 함수명(실측: `codebase/backend/src/common/utils/{uuid,workspace-context.util}.ts`, `codebase/backend/src/common/decorators/workspace-reflection-canary.ts`)과 정확히 일치. spec 이 사후 기록하는 것일 뿐 새 이름 도입이 아님. 다른 의미로 이미 쓰이는 동명 식별자 없음(grep 전수).
- `1-auth.md` frontmatter `code:` 글로브 추가 3건(`common/decorators/*.ts`, `common/utils/workspace-context.util.ts`, `common/utils/uuid.ts`) — 저장소 전체 다른 spec 문서의 `code:` 글로브 중 이 경로들을 이미 소유한 문서 없음(전수 grep, `spec/**/*.md` frontmatter `code:` 블록 9곳 확인) → evidence-chain 이중 소유 충돌 없음.
- `deleteByPrefix` LIKE 메타문자 거부 각주(`†`) — `spec/conventions/secret-store.md` 에 기존 각주 마커 `†` 사용 0건, §2.1 현재 표 텍스트와 diff 가 정확히 일치.
- `POST /api/triggers/:id/chat-channel/rotate-bot-token` — 신규 endpoint 아님, 기존 endpoint(§5.4)의 에러 응답 표에 행을 추가하는 것 뿐.
- 신규 ENV var·config key — 없음(대상 5건 전부 기존 구현 문서화).
- plan 파일 경로 `plan/in-progress/spec-draft-auth-invariants-sync.md` — `spec-draft-*` 는 이 저장소에서 "결정된 사후 spec 동기화" 플랜에 이미 40+ 건 쓰인 확립된 컨벤션(`plan/complete/spec-draft-*.md` 다수)과 일치. 유사한 이름의 `plan/in-progress/spec-sync-auth-gaps.md` 가 별도로 존재하지만 스코프가 다르다(그쪽은 LDAP/SAML·감사 로깅 커버리지 갭 추적, 이쪽은 워크스페이스 UUID 검증 비대칭·부트 캐너리) — 내용 중복이나 진짜 충돌은 없음. 두 접두사(`spec-sync-`/`spec-draft-`)가 이미 공존하는 확립된 관행이라 collision 등급으로 볼 근거가 약해 리스트에서 제외.

## 요약

target 이 새로 도입하는 함수명·subsection 제목·frontmatter `code:` 글로브·plan 파일 경로는 모두 이미 구현·머지된 코드 또는 확립된 명명 컨벤션과 정확히 일치했고, 다른 의미로 기존에 쓰이는 동일 식별자와의 진짜 충돌(CRITICAL)은 발견되지 않았다. 유일하게 지적할 만한 지점은 `VALIDATION_ERROR` 에러 코드를 `3-error-handling.md §1.3` 표의 "코드" 컬럼 자체에 `` (`X-Workspace-Id` 형식) `` 한정자를 박아 등재하는 방식이 같은 PR 의 `15-chat-channel.md §5.4` diff(코드 컬럼은 순수 유지)와 갈리고, `error-codes.md` 가 정한 "코드는 이름 토큰이 아니라 의미로 분기" 원칙과도 어긋나 표만 보면 별도 코드 문자열이 존재하는 것처럼 오독될 소지가 있다는 것(WARNING). 자동화된 카탈로그-코드 대조 테스트가 없어 CI 를 깨뜨리지는 않는다. 부수적으로 `12-workspace.md` 삽입 위치를 "Rationale 말미"라고 서술했으나 실제로는 중간(4개 subsection 이 더 있음)이라는 서술 부정확도 있다(INFO).

## 위험도

LOW
