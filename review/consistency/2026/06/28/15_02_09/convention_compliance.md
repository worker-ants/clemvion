# 정식 규약 준수 검토 결과

검토 대상: `spec/7-channel-web-chat/` (구현 완료 후 검토, diff-base=origin/main)
검토 시각: 2026-06-28

---

## 발견사항

### [WARNING] 응답 DTO 파일명 미준수 — `embed-config.dto.ts`
- **target 위치**: `codebase/backend/src/modules/hooks/dto/responses/embed-config.dto.ts` (4-security.md `code:` 등재 파일)
- **위반 규약**: `spec/conventions/swagger.md §5-1 응답 DTO 위치` — "codebase/backend/src/modules/<module>/dto/responses/**\*-response.dto.ts**`"
- **상세**: 동일 디렉토리의 `webhook-response.dto.ts`는 `*-response.dto.ts` 패턴을 따르지만, `embed-config.dto.ts`는 `-response` suffix가 없다. `swagger.md §5-4 체크리스트`의 "응답 DTO 가 `dto/responses/` 에 있는지" 항목은 충족하나, 파일명 패턴을 위반한다. 클래스명도 `EmbedConfigDto`이며 `EmbedConfigResponseDto`가 아니다. 기능적으로는 `@ApiOkWrappedResponse(EmbedConfigDto)` 패턴을 사용해 응답 래퍼 convention을 정상 준수한다.
- **제안**: 파일을 `embed-config-response.dto.ts`로 rename하고 클래스명을 `EmbedConfigResponseDto`로 변경한다. 4-security.md `code:` 경로 및 import 경로도 함께 갱신. 또는 이 파일이 public API response DTO 보다 내부 설정 전달체 성격임을 근거로 `swagger.md §5-1` 패턴 예외를 명시 등재(규약 갱신)한다.

---

### [INFO] `4-security.md` frontmatter `id` 값이 basename과 불일치 — 의도된 패턴이나 주석이 길어 가독성 낮음
- **target 위치**: `spec/7-channel-web-chat/4-security.md` 2행 — `id: web-chat-security  # basename '4-security' 와 의도적으로 다름 — 타 영역의 '4-security' 슬러그와 충돌 방지 (영역 prefix 'web-chat-' 로 전역 유일)`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — id는 "파일 basename(확장자 제외) 기반 권장. **같은 basename이 영역을 달리해 중복될 때는 후발 문서가 영역 prefix 로 충돌을 회피한다**"
- **상세**: 충돌 회피를 위해 `web-chat-security`를 사용한 것은 `spec-impl-evidence.md §2.1`이 허용하는 명시적 패턴이다. 위반은 아니다. 다만 인라인 주석이 매우 길어(라인 하나가 170자+) 다른 spec 파일 및 `spec-impl-evidence.md` 예시(`id: chat-channel  # kebab-case. 파일 basename 기반 권장`)보다 현저히 길다.
- **제안**: 주석을 문서 본문 `## Rationale` 또는 Overview 해설로 이동하여 frontmatter를 간결하게 유지한다. 현재 상태로도 YAML 파싱과 가드 동작에는 문제가 없다.

---

### [INFO] `_product-overview.md`에 `## Overview` 최상위 섹션 부재
- **target 위치**: `spec/7-channel-web-chat/_product-overview.md` — 첫 섹션이 `## 1. 개요 / 문제`
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)"
- **상세**: CLAUDE.md가 참조하는 "각 SKILL.md 참고"에서 3섹션 구성은 기술 명세(tech spec) 문서에 적용된다. `_product-overview.md`는 제품 정의 문서이며, CLAUDE.md 정보 저장 위치 표도 "spec/<영역>/_product-overview.md 또는 진입 문서의 ## Overview"로 OR 관계로 기술한다. 6개 기술 명세 파일(0-architecture.md~5-admin-console.md) 모두 `## Overview`와 `## Rationale` 섹션을 보유하고 있다. 또한 `_product-overview.md`는 `spec-impl-evidence.md §1` 면제 대상(`_*.md`)으로 frontmatter 가드에서도 제외된다. 규약 위반보다는 제품 정의 문서 고유 구조로 이해할 수 있다.
- **제안**: 특별한 조치 불필요. 단, 향후 _product-overview.md 작성 가이드라인에서 "## Overview" 섹션 의무 여부를 명확히 해두면 표류를 방지할 수 있다.

---

## 준수 확인 사항 (이상 없음)

다음 항목은 규약을 정상 준수하고 있음이 확인됨:

1. **Frontmatter 필수 필드** — 6개 기술 명세 파일 모두 `id`(kebab-case), `status: implemented`, `code:` 필드 보유. `spec-impl-evidence.md §2.1` 완전 준수.
2. **3섹션 구성** — 0-architecture.md~5-admin-console.md 6파일 모두 `## Overview` / 본문 / `## Rationale` 3섹션 구조.
3. **영역 인덱스 링크 완전성** — `_product-overview.md`가 INDEX_RE(`_.*overview`)에 해당하며, 5개 형제 spec(1-widget-app, 2-sdk, 3-auth-session, 4-security, 5-admin-console)을 모두 proper markdown link `[...](./X.md)` 형식으로 참조. `spec-area-index.test.ts` 가드 통과.
4. **Code: 경로 실존** — 3-auth-session.md의 4개 개별 파일 경로, 4-security.md, 5-admin-console.md의 디렉토리 glob 경로 모두 실제 파일/디렉토리 존재 확인. `spec-code-paths.test.ts` 가드 통과.
5. **API 문서 데코레이터 패턴** — hooks.controller.ts가 `@ApiTags`, `@ApiOperation`, `@ApiParam`, `@ApiOkWrappedResponse`, `@ApiAcceptedWrappedResponse` 등 `swagger.md §2` 패턴 정상 사용. 금지된 "빈 껍데기" 패턴(`@ApiOkResponse({ schema: { type: 'object', ... } })`) 미사용.
6. **응답 래퍼 헬퍼** — `ApiOkWrappedResponse(EmbedConfigDto)`, `ApiAcceptedWrappedResponse(WebhookAcceptedDto)` 등 `swagger.md §5-2` 공용 헬퍼 사용. double-wrap 패턴 없음.
7. **에러 코드 명명** — 스펙 본문에서 참조되는 에러 코드(`EXECUTION_NOT_FOUND`, `TOO_MANY_CONNECTIONS`, `EIA-IN-12` 등)는 `error-codes.md §1` 요구 UPPER_SNAKE_CASE 또는 EIA 요건 ID 패턴 준수. lowercase 에러 코드 미사용.
8. **i18n 동반 갱신** — `lib/i18n/dict/{ko,en}/webChat.ts`, `sidebar.ts` 양쪽 모두 존재 확인. `i18n-userguide.md Principle 1·2` 준수.
9. **Embed-config DTO JSDoc** — `embed-config.dto.ts` 클래스 및 각 필드에 JSDoc + `@ApiProperty` 보강이 존재. `swagger.md §1-1~1-2` 준수.
10. **`_product-overview.md` 면제** — `_` prefix로 frontmatter 가드(`spec-impl-evidence.md §1`) 정상 면제 대상. frontmatter 없는 것이 올바른 상태.
11. **4-security id 충돌 회피** — `id: web-chat-security`를 사용한 것은 `spec-impl-evidence.md §2.1`이 명시 허용하는 영역 prefix 충돌 회피 패턴.

---

## 요약

`spec/7-channel-web-chat/` 영역은 정식 규약을 전반적으로 잘 준수하고 있다. 6개 기술 명세 파일 모두 frontmatter 의무 필드(`id`/`status`/`code:`), 3섹션 문서 구조(Overview/본문/Rationale), 영역 인덱스 링크 완전성 요건을 충족한다. API 문서화는 `swagger.md`의 래퍼 헬퍼·데코레이터 패턴을 준수하며 금지된 레거시 패턴 없음이 확인된다. 다만 `hooks` 모듈의 응답 DTO 파일 `embed-config.dto.ts`가 `swagger.md §5-1`의 `*-response.dto.ts` 네이밍 패턴을 따르지 않아 WARNING 1건이 발생하며, 이는 기능적 영향은 없으나 일관성 개선이 권고된다.

---

## 위험도

LOW
