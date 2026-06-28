# 정식 규약 준수 검토 결과

**대상 문서**: `spec/7-channel-web-chat/3-auth-session.md`
**검토 일시**: 2026-06-28
**검토 모드**: spec draft (--spec)

---

## 발견사항

### [INFO] frontmatter `id` 가 basename 과 다름 (의도된 패턴 — 확인 필요)

- **target 위치**: frontmatter `id: web-chat-auth-session` (파일 basename: `3-auth-session`)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — "`id` 는 파일 basename(확장자 제외) 기반 권장. 같은 basename 이 영역을 달리해 중복될 때는 후발 문서가 영역 prefix 로 충돌을 회피한다"
- **상세**: `id` 가 `3-auth-session` 대신 `web-chat-auth-session` 을 사용한다. 같은 영역 내 다른 파일들(`1-widget-app.md → web-chat-widget-app`, `2-sdk.md → web-chat-sdk`, `0-architecture.md → web-chat-architecture`, `4-security.md → web-chat-security`) 도 모두 `web-chat-` prefix 를 사용하므로, 이는 영역 전체에 걸친 의도적 패턴이다. `4-security.md` 는 frontmatter 주석에서 "타 영역의 `4-security` 슬러그와 충돌 방지" 를 명시한다. 따라서 이 문서의 `web-chat-auth-session` 역시 동일 의도 — `id: 3-auth-session` 이 타 영역에서 충돌할 수 있음.
- **제안**: 현행 유지로 적절하다. 다만 `4-security.md` 가 inline 주석으로 충돌 회피 의도를 명시한 것처럼, `3-auth-session.md` 도 필요하다면 같은 방식의 주석을 추가하는 것을 고려할 수 있다. 이는 INFO 수준이며 가드 통과에 영향이 없다.

---

### [INFO] Rationale 섹션 번호 체계 비연속 (R3/R4/R5/R6)

- **target 위치**: `## Rationale` 하위 `### R3`, `### R4`, `### R5`, `### R6`
- **위반 규약**: CLAUDE.md §정보 저장 위치 — "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`"에 두라는 구조 권장 사항 준수. 단, Rationale 항목 번호 체계에 대한 명시적 규약은 `spec/conventions/` 내에 존재하지 않는다.
- **상세**: Rationale 항목이 R3/R4/R5/R6 로 시작하며 R1·R2 가 없다. 이는 타 spec 파일과의 통합 참조 체계 또는 내부 설계상의 의도일 수 있다. 같은 영역의 다른 spec 파일(`1-widget-app.md`, `2-sdk.md`, `4-security.md`)과 번호 체계의 일관성 여부는 이 문서 범위 밖이나, 단독으로 읽을 때 R1·R2 가 왜 없는지 독자가 혼란을 겪을 수 있다.
- **제안**: 현행 유지. 만약 R1·R2 가 다른 파일에 귀속된 번호라면 간략한 주석(`<!-- R1·R2: 1-widget-app.md 소유 -->` 식)으로 독자 안내를 고려할 수 있다. 규약 위반은 아니다.

---

## 규약 준수 전체 평가

`spec/7-channel-web-chat/3-auth-session.md` 는 정식 규약(`spec/conventions/spec-impl-evidence.md`)이 요구하는 모든 의무 항목을 충실히 이행하고 있다. frontmatter 에 `id`(kebab-case)·`status: implemented`·`code:` 경로 4건이 올바르게 선언됐으며, `status: implemented` 에 맞게 `pending_plans:` 가 없고 `code:` 에 실제 구현 파일이 매핑됐다. 문서 구조는 CLAUDE.md 권장 3섹션(Overview / 본문 / Rationale)을 준수하며, `_product-overview.md` 와 `0-architecture.md` 등의 명명 컨벤션도 영역 내 일관성이 있다. API 문서(Swagger) 규약은 이 문서의 적용 대상이 아니며(프론트엔드 위젯 spec), 에러 코드·감사 액션 명명 규약 위반도 발견되지 않았다. 출력 포맷 서술(`{ data }` 봉투·SSE 프레임 규약)은 `spec/5-system/` 의 상위 규약을 정확히 인용하고 있다. 발견된 사항 2건은 모두 INFO 수준으로 채택 차단 사유가 없다.

## 위험도

NONE
