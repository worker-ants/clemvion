# 정식 규약 준수 검토 — spec/7-channel-web-chat/

검토 모드: impl-done (diff-base=origin/main, scope=spec/7-channel-web-chat/)
검토 일시: 2026-06-28

---

## 발견사항

### [INFO] EmbedConfigDto 필드에 JSDoc 없이 @ApiProperty(description) 직접 사용
- **target 위치**: `codebase/backend/src/modules/hooks/dto/responses/embed-config.dto.ts` — `allowlist`, `enforce` 두 필드
- **위반 규약**: `spec/conventions/swagger.md §1-1` — "모든 필드에 JSDoc 추가 (한국어)"를 기본 패턴으로, `@ApiProperty`는 예시·enum·format 보강용
- **상세**: 클래스 레벨 JSDoc(`/** 공개 위젯 임베드 soft 검증용 설정 … */`)은 올바르게 작성됐으나, 개별 필드(`allowlist`, `enforce`)는 JSDoc 주석 없이 `@ApiProperty({ description: '...' })` 에 인라인 설명을 집어넣었다. `array` 타입은 `@ApiProperty`가 반드시 필요하므로 `@ApiProperty` 자체는 정당하나, 그와 별개로 JSDoc 주석이 병기돼야 한다(`WebChatAppearanceDto`가 이를 올바르게 수행하는 레퍼런스임).
- **제안**: 두 필드에 JSDoc 주석을 추가한다.
  ```ts
  /** 워크스페이스 임베드 allowlist(호스트 origin 목록). 비어 있으면 제한 없음(allow-all). */
  @ApiProperty({ type: 'array', items: { type: 'string' }, example: [...] })
  allowlist: string[];

  /** soft 차단 활성 여부. allowlist ≥1 + enforce=true 일 때 호스트 origin 불일치 시 위젯 차단. */
  @ApiProperty({ example: true })
  enforce: boolean;
  ```

---

### [INFO] 5-admin-console.md Overview 헤더에 한정어 부착
- **target 위치**: `spec/7-channel-web-chat/5-admin-console.md` 18행 — `## Overview (제품 정의)`
- **위반 규약**: `spec/conventions/swagger.md` 및 CLAUDE.md 의 "Overview / 본문 / Rationale 3섹션 권장"에서 권장하는 표준 헤더는 `## Overview`
- **상세**: 다른 5개 spec 문서는 모두 `## Overview`(한정어 없음)를 사용하는 반면, `5-admin-console.md`만 `## Overview (제품 정의)`로 표기한다. 기능적 문제는 없으나 영역 내 일관성이 깨진다. `spec-area-index.test.ts`의 헤더 슬러그 매칭에도 영향이 없으므로 강제 위반은 아니다.
- **제안**: `## Overview`로 통일. 제품 정의 성격은 Overview 본문 첫 문장에서 명시하는 것이 관례(다른 docs 참고).

---

## 규약 준수 요약

`spec/7-channel-web-chat/` 6개 spec 문서(`0-architecture`, `1-widget-app`, `2-sdk`, `3-auth-session`, `4-security`, `5-admin-console`)와 `_product-overview.md`는 정식 규약을 전반적으로 충실히 따르고 있다.

**frontmatter**: 모든 비제외 spec(0~5)이 `id`(kebab-case·영역 prefix 충돌 회피 포함) · `status: implemented` · `code:` 필드를 올바르게 보유하며, `spec-impl-evidence.md §1` 면제 대상인 `_product-overview.md`는 frontmatter를 갖지 않아 정상이다. `4-security.md`의 `id: web-chat-security`는 `§2.1` "후발 문서 영역 prefix 충돌 회피" 규칙을 명시적으로 따른 의도된 패턴으로 위반 아님.

**문서 구조**: 0~5 전원 `## Overview` / 본문 / `## Rationale` 3섹션을 보유한다. `_product-overview.md`는 번호 절(§1 개요/문제, §2 목표/비목표…) 구조로 되어 있고 `## Rationale`을 포함해 정합하다.

**area-index 가드**: `spec/7-channel-web-chat/` 인덱스 문서(`0-architecture.md`, `_product-overview.md`)가 비인덱스 5개 형제 문서(1~5) 전부를 링크하고 있어 `spec-area-index.test.ts` 가드 요건을 충족한다.

**API 문서 규약(Swagger)**: `hooks.controller.ts`가 `@ApiTags('Hooks')` · `@ApiOperation` · `@ApiParam` · `ApiOkWrappedResponse`/`ApiAcceptedWrappedResponse`(공용 래퍼) · `@Public` 전용에 `@ApiBearerAuth` 생략 등 `swagger.md` 컨트롤러·응답 래퍼 패턴을 준수한다. `EmbedConfigDto`의 필드 레벨 JSDoc 누락은 INFO 수준 개선 사항(기능·보안 영향 없음). `WebChatAppearanceDto`는 JSDoc + `@ApiPropertyOptional` 조합이 올바르다.

**출력 포맷 규약**: EIA SSE 이벤트 파서(`eia-events.ts`)·CORS 분기(`web-chat-cors.ts`)·임베드 soft 검증(`EmbedConfigService`/`EmbedConfigDto`) 등 구현 코드가 spec의 wire format(봉투 언랩·`wc:*` postMessage·`{ data }` 래핑)을 정확히 반영한다.

**금지 항목**: `spec/conventions/` 가 명시적으로 금지한 패턴(인라인 에러 코드 문자열, entity 직접 노출 DTO, `srcdoc` 자가 생성 등)을 위반하는 구현 흔적 없음.

발견된 2개 사항은 모두 INFO이며 채택 차단 사유에 해당하지 않는다.

---

## 위험도

**NONE**
