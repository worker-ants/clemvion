# 정식 규약 준수 검토 결과

검토 범위: `spec/7-channel-web-chat/` (구현 완료 후 검토, diff-base=origin/main)
검토 일시: 2026-06-24

---

## 발견사항

위반 사항 없음. 아래는 확인된 규약 준수 항목과 INFO 수준 관찰이다.

### 준수 확인 항목

**명명 규약**
- 신규 DTO 파일명: `web-chat-appearance.dto.ts` — kebab-case 준수
- DTO 클래스명: `WebChatAppearanceDto` — PascalCase 준수
- 쿼리 파라미터 DTO 필드명: `interactionEnabled` — camelCase 준수
- spec frontmatter `id` 값: `web-chat-admin-console`, `web-chat-architecture` 등 — kebab-case 준수

**문서 구조 규약 (CLAUDE.md + spec-impl-evidence.md)**
- `spec/7-channel-web-chat/5-admin-console.md`: frontmatter(`id`/`status`/`code:`) + Overview 섹션 + 본문 + Rationale 3섹션 구조 완비
- `_product-overview.md`: `_*.md` 면제 대상이므로 frontmatter 없음 — 정상 (`spec-impl-evidence.md §1` 제외 규칙)
- `5-admin-console.md` `status: implemented` + `code:` ≥1 글로브 + `pending_plans:` 없음 — §3 라이프사이클 준수
- 나머지 파일들(`0-architecture.md`~`4-security.md`): `status: partial` + `pending_plans:` 존재 — §3 준수

**API 문서 규약 (swagger.md)**
- `WebChatAppearanceDto` 모든 필드에 단일행 JSDoc 주석 존재 — §1-1 준수
- `@ApiPropertyOptional` optional 필드에 적용 — §1-3 준수
- 중첩 DTO 참조: `@ApiPropertyOptional({ type: () => WebChatAppearanceDto })` — §1-4 nested object 패턴 준수
- `WebChatAppearanceDto`는 request 입력 sub-DTO (응답 DTO 아님) → `dto/responses/` 가 아닌 `dto/` 배치 정상 — §5-1 대상 아님
- inline enum 배열(`['ko', 'en']`, `['bottom-right', 'bottom-left']`) 사용: TypeScript enum 타입이 아니므로 `enumName` 불필요 — §1-4 enum 가이드는 `enum: MyEnum` 형태에만 적용, 기존 패턴(`create-trigger.dto.ts`, `query-trigger.dto.ts` 등)과 일관
- `InteractionConfigDto.appearance` 필드: JSDoc + `@ApiPropertyOptional({ type: () => ... })` — §1-2, §1-4 준수

**i18n 규약 (i18n-userguide.md)**
- `spec/7-channel-web-chat/5-admin-console.md §8`이 요구하는 `dict/{ko,en}/webChat.ts`, `dict/{ko,en}/sidebar.ts` 파일 양쪽 모두 존재 확인 — Principle 1·2 준수

**출력 포맷 규약**
- `WebChatAppearanceDto` 필드 검증: hex 색상 `/^#[0-9a-fA-F]{6}$/`, locale `['ko','en']`, position `['bottom-right','bottom-left']`, MaxLength 제약 — spec `5-admin-console.md §4` 다층 방어 정책 반영
- `QueryTriggerDto.interactionEnabled` Transform: `value === true || value === 'true'` — `'false'` 오역 방지 로직 명확히 JSDoc 문서화

**금지 항목**
- `spec/` 변경 없는 developer 단독 구현 — 이번 increment의 `5-admin-console.md` 변경은 spec writer가 먼저 작성한 것으로, developer 단독 `spec/` 직접 수정 패턴 없음
- 신규 백엔드 엔티티·테이블·facade 계층 미신설 — EIA §R10 단일 sink 정책 준수

---

### **[INFO]** `web-chat-appearance.dto.ts` 파일 위치 — sub-DTO 분리 패턴 미문서화

- target 위치: `codebase/backend/src/modules/triggers/dto/web-chat-appearance.dto.ts`
- 관련 규약: `spec/conventions/swagger.md §5-1`
- 상세: swagger.md §5-1은 "응답 DTO는 `dto/responses/`에 위치"를 규정하나, 요청 입력 sub-DTO의 위치 규칙은 명시되어 있지 않다. `WebChatAppearanceDto`는 `InteractionConfigDto`에 중첩되는 요청 sub-DTO이므로 `dto/` 직하 배치는 적정하다. 기존 `notification-config.dto.ts`, `chat-channel-config.dto.ts`와 동일 패턴.
- 제안: 현 배치 유지. 규약 갱신이 필요하다면 swagger.md §5에 "request sub-DTO는 `dto/` 직하 배치" 한 줄 추가 가능(현 시점 필수 아님).

---

## 요약

`spec/7-channel-web-chat/` 전 범위와 연관 구현 코드(`web-chat-appearance.dto.ts`, `interaction-config.dto.ts`, `query-trigger.dto.ts`, i18n dict 파일)가 정식 규약을 준수한다. spec frontmatter 스키마(id/status/code/pending_plans), 문서 3섹션 구조, Swagger DTO 패턴(JSDoc·@ApiPropertyOptional·nested type·inline enum), i18n ko/en parity 모두 위반 없다. 발견된 INFO 1건은 swagger.md에 요청 sub-DTO 위치 규칙이 명시되어 있지 않은 사소한 문서 gap이며, 현 구현 자체는 기존 코드베이스 패턴과 완전히 일관한다.

## 위험도

NONE
