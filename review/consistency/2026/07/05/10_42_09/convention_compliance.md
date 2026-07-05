# 정식 규약 준수 검토 — `spec-draft-auth-webauthn-list-format.md`

검토 모드: spec draft 검토 (`--spec`)
target: `plan/in-progress/spec-draft-auth-webauthn-list-format.md`
대조 대상: `spec/conventions/**` (특히 `swagger.md`), `spec/5-system/2-api-convention.md`, `spec/5-system/1-auth.md`, `spec/2-navigation/9-user-profile.md`, `.claude/docs/plan-lifecycle.md`, CLAUDE.md 문서구조 규약

## 검증 방법

코드 사실 관계(webauthn/sessions 컨트롤러의 실제 반환값, `TransformInterceptor` 분기 로직, `WebAuthnCredentialListDto`/`SessionListDto` 정의, frontend 소비 코드, api-convention/swagger 현재 라인 번호)를 직접 읽어 draft 의 모든 근거 인용을 1건씩 대조했다. 결과: 인용된 코드 라인·문구·라인 번호가 실제 저장소 상태와 **전부 일치**함을 확인.

- `webauthn.controller.ts` (`modules/auth/webauthn/webauthn.controller.ts:281-286`) `webauthnList` → `return { data: { items: ... } }` 확인.
- `sessions.controller.ts:74/120/164` → `return { data: { items: sessions } }` 확인 (draft 인용 라인과 정확히 일치).
- `TransformInterceptor` (`common/interceptors/transform.interceptor.ts`) → `'data' in data` pass-through 분기 확인.
- `frontend/src/lib/api/sessions.ts:54/67/77`, `passkey-card.tsx:53` → `res.data.data.items` 확인.
- `spec/5-system/1-auth.md:469`, `spec/2-navigation/9-user-profile.md:329`, `spec/5-system/2-api-convention.md:139` 인근, `spec/conventions/swagger.md:205/253/261/305,317` — draft 가 인용한 라인·문구와 실제 파일 내용이 정확히 일치.
- `session.dto.ts:53-63` — "SessionListDto 도 현재 단일 `{items}` 패턴" 팔로우업 주장 확인 (`webauthn-response.dto.ts:77` 주석이 stale 이라는 판단이 타당함).

## 발견사항

### [INFO] `swagger.md` §6 레거시 패턴 각주(변경 4c) 위치가 "버그" 문장 바로 뒤 한정 — §5 서술과의 중복 확인 필요
- target 위치: 변경 4 (4c), `swagger.md` §6 line 305 부근
- 위반 규약: 없음 (직접 위반 아님, 표현 방식 제안)
- 상세: 변경 3(=`2-api-convention.md` Rationale 신규 subsection)과 변경 4c(=`swagger.md` §6 각주)가 사실상 동일한 문장("`pagination` 필드가 없는 순수 `{data:{items}}` 는 버그 패턴이 아니다")을 두 문서에 중복 서술한다. 규약 위반은 아니지만(오히려 cross-link 로 상호 참조하고 있어 §Rationale 관례에 부합), 향후 유지보수 시 한쪽만 갱신하고 다른 쪽을 놓칠 rot 위험이 있다.
- 제안: 필수 조치 아님. 원한다면 4c 를 "상세는 [api-convention Rationale](../5-system/2-api-convention.md#비-페이징-고정-컬렉션은-dataitems-유지-52-페이징과-형태-상이) 참고" 로 축약해 SoT 를 한쪽(api-convention Rationale)에 모으는 것도 고려 가능. 현재도 무방.

### [INFO] `swagger.md` §5-2 표(변경 4b)의 새 pass-through 사례가 헬퍼 표(§5-2 상단 테이블)와는 별도 산문으로만 추가됨
- target 위치: 변경 4 (4b), `swagger.md` §2-5 line 205 부근
- 위반 규약: 없음
- 상세: `swagger.md` §5-2 는 `ApiOkWrappedResponse`/`ApiOkPaginatedResponse` 등 헬퍼 표로 응답 패턴을 구조화해 나열한다(표 형식이 정식 패턴). 그러나 draft 의 변경 4b 는 비-페이징 고정 컬렉션 pass-through 사례를 §2-5 산문에만 추가하고 §5-2 헬퍼 표에는 대응 행을 넣지 않는다. `sessions.controller.ts`/`webauthn.controller.ts` 는 실제로는 `ApiOkWrappedResponse(WebAuthnCredentialListDto)` 처럼 **기존 헬퍼를 그대로 사용**하고 있으므로(신규 헬퍼가 필요한 게 아니라 DTO 자체가 `{items}` 필드를 갖는 형태), 헬퍼 표에 새 행을 추가할 필요는 없다는 점에서 이 생략은 실질적으로 문제가 아니다. 다만 §5-2 표만 보고 패턴을 파악하려는 독자는 이 두 번째 pass-through 사례를 놓칠 수 있다.
- 제안: 선택적으로 §5-2 헬퍼 표 아래에 "이 헬퍼들은 비-페이징 고정 컬렉션에도 동일하게 쓰인다(DTO 가 `items` 필드를 가지면 됨)" 한 줄 각주 추가 고려. 필수는 아님 — 현재 draft 문구만으로도 CRITICAL 은 해소된다.

## 규약 준수 확인 사항 (위반 아님, 검증 결과 기록)

- **문서 구조 규약(Overview/본문/Rationale)**: 변경 대상 4개 spec 문서(`2-api-convention.md`, `1-auth.md`, `swagger.md`, `9-user-profile.md`) 모두 기존 `## Rationale` 섹션을 보유하며, draft 의 변경 3·4a 는 그 기존 섹션 말미에 subsection 을 추가하는 형태로 정확히 CLAUDE.md/SKILL.md 의 3섹션 관례를 따른다. 신규 문서 생성이 아니므로 `_product-overview.md`/`0-` prefix 규칙은 해당 없음.
- **plan frontmatter 스키마**: target 자체(`plan/in-progress/spec-draft-auth-webauthn-list-format.md`)의 frontmatter 는 `worktree`/`started`/`owner` 세 필수 필드를 모두 갖추고, `spec_impact` 도 리스트 형식(bare string 아님)으로 기재돼 `.claude/docs/plan-lifecycle.md` §Gate C 및 memory 교훈("spec_impact 는 리스트")과 일치한다.
- **API 문서(Swagger) 규약**: draft 가 인용하는 실제 코드는 `swagger.md` §5-2 의 정식 헬퍼(`ApiOkWrappedResponse`)를 그대로 사용 중이며 인라인 스키마 남용(§6 금지 패턴)이 아니다. draft 가 제안하는 문구도 새 데코레이터 패턴을 도입하지 않고 기존 헬퍼의 wire-shape 서술만 정정하므로 API 문서 규약과 충돌하지 않는다.
- **명명 규약**: draft 범위 내에 새 식별자·엔드포인트·DTO 명명이 없다(문서 텍스트 정정만). `error-codes.md`/`audit-actions.md` 등 명명 규약과는 무관한 변경이다.
- **금지 항목**: `swagger.md` §6 이 명시적으로 금지하는 "버그" 패턴(`{data:{items,totalItems,page,limit}}`, 페이지네이션 메타를 items 옆에 섞는 형태)과 draft 가 정당화하는 `{data:{items}}` (pagination 필드 전혀 없음)는 코드 사실로 명확히 구분되며, draft 의 변경 4c 가 그 구분을 각주로 명시해 §6 금지 패턴을 우회 정당화하는 것이 아님을 재확인했다.
- **"유일한 예외" 표현 정정의 타당성**: 코드베이스 전수 조사(`grep return { data: {`) 결과, `{data:{items}}` 패턴은 `sessions.controller.ts`(3곳)·`webauthn.controller.ts`(1곳)에 한정되고, 다른 `{data:{...}}` 반환들(`auth.controller.ts`/`workspaces.controller.ts`/`users.controller.ts`)은 단일 필드를 감싼 §5.1 표준 패턴과 wire-shape 상 구분 불가능한 경우들이라 "두 번째 pass-through 사례"로 셀 필요가 없다. draft 의 "두 사례"(페이징 + 비-페이징 고정 컬렉션) 프레이밍은 완전하며 과소·과대 일반화가 없다.

## 요약

target draft 는 코드 사실 관계 — `webauthn.controller.ts`/`sessions.controller.ts` 의 실제 반환 shape, `TransformInterceptor` pass-through 분기, frontend 소비 코드 — 를 정확히 인용하고 있으며, 검증 결과 모든 코드·라인 인용이 저장소 현재 상태와 일치한다. `swagger.md` Rationale §5 의 "pass-through 는 `PaginatedResponseDto` 가 유일한 예외"라는 기존 단정이 실제로는 부정확했고(코드상 두 번째 사례가 이미 load-bearing 상태로 존재), draft 는 이를 "주요 pass-through 사례"로 정정하면서 두 사례를 명시적으로 구분하는 정식 규약 갱신을 제안한다 — 이는 CLAUDE.md 의 "결정의 배경·근거는 Rationale" 원칙과 spec-impl-evidence.md 의 frontmatter 불변(상태·code 미변경, 텍스트만 정정) 모두를 지킨다. 문서 구조(Overview/본문/Rationale), plan frontmatter 스키마, API 문서 헬퍼 사용, 명명 규약 어느 것도 위반하지 않았다. 발견된 두 건은 모두 INFO 수준(문서 간 중복 서술 rot 위험, §5-2 헬퍼 표에 사례를 명시적으로 추가하지 않은 점)으로, draft 의 실행 가능성이나 정합성에 영향을 주지 않는 선택적 개선 제안이다.

## 위험도

NONE
