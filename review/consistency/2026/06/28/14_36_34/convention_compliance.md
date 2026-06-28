# Convention Compliance Review — `spec/7-channel-web-chat/`

검토 모드: `--impl-prep` (구현 착수 전 검토)
대상 경로: `spec/7-channel-web-chat/`

---

## 발견사항

### **[WARNING]** 응답 DTO 파일명이 swagger 규약 `*-response.dto.ts` 패턴 미준수
- **target 위치**: `spec/7-channel-web-chat/4-security.md` frontmatter `code:` 10번째 줄, 본문 §3-① `EmbedConfigDto` 참조
- **위반 규약**: `spec/conventions/swagger.md §5-1 응답 DTO 위치` — "응답 DTO 는 `codebase/backend/src/modules/<module>/dto/responses/*-response.dto.ts` 형식을 따른다"
- **상세**: spec 이 참조하는 구현 파일 `codebase/backend/src/modules/hooks/dto/responses/embed-config.dto.ts` 는 파일명에 `-response` 접미사가 없다 (`embed-config-response.dto.ts` 여야 함). 클래스명도 `EmbedConfigDto` 이며 `EmbedConfigResponseDto` 규약과 거리가 있다. 동일 디렉토리의 `webhook-response.dto.ts` 는 `-response` 접미사를 따르고 있어 혼재된다. spec 본문이 이 파일을 `EmbedConfigDto` 로 명시 인용하면서 명명 일탈을 언급하거나 예외로 등록하지 않는다.
- **제안**: 구현 시 파일명을 `embed-config-response.dto.ts`·클래스명을 `EmbedConfigResponseDto` 로 맞추거나, spec 본문과 frontmatter `code:` 를 갱신하면서 Rationale 에 예외 사유를 명시한다. 후자 채택 시 swagger.md 예외 레지스트리(§6 레거시 패턴 절 또는 신규 §예외) 추가를 고려한다.

---

### **[WARNING]** `id` 필드가 basename 기반 권장 규칙을 전 파일에서 일괄 이탈하며, 일부는 실제 충돌 없이 area-prefix 를 선제 적용
- **target 위치**: `spec/7-channel-web-chat/0-architecture.md`, `1-widget-app.md`, `2-sdk.md`, `3-auth-session.md` frontmatter `id:` 필드
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — "`id` 는 파일 basename(확장자 제외) 기반 권장. 같은 basename 이 영역을 달리해 중복될 때는 후발 문서가 영역 prefix 로 충돌을 회피한다"
- **상세**: 해당 규약은 area-prefix 를 **충돌 시**에만 허용한다. 현재 repo 에 `1-widget-app.md`, `2-sdk.md`, `3-auth-session.md`, `0-architecture.md` 이름의 파일은 `spec/7-channel-web-chat/` 에만 존재해 basename 충돌이 없다. 그러나 모든 파일이 `web-chat-widget-app`, `web-chat-sdk`, `web-chat-auth-session`, `web-chat-architecture` 처럼 area-prefix 를 달고 있다. `4-security.md` 는 frontmatter 주석에 "타 영역의 `4-security` 슬러그와 충돌 방지"라고 명시하지만 현재 repo 에는 다른 `4-security.md` 가 없어 충돌이 선제적이다. 단, 이 area 가 전체적으로 `web-chat-` prefix 를 일관 적용한 것은 의도된 설계로 보이며 준수 여부는 INFO 수준에 가깝다.
- **제안**: 충돌이 실제로 발생하지 않은 파일(`1-widget-app.md` 등)은 basename-derived ID(`widget-app`, `sdk`, `auth-session`)로 두거나, 현 area-prefix 정책을 유지할 경우 `4-security.md` 주석처럼 모든 파일 frontmatter 에 "area-prefix 로 전역 유일 보장" 주석을 추가해 의도를 명확히 한다. 또는 spec-impl-evidence.md §2.1 를 "area 단위 일관성을 위한 area-prefix 허용" 으로 갱신한다.

---

### **[INFO]** `spec/7-channel-web-chat/4-security.md` 의 `id: web-chat-security` — 선제적 충돌 회피 주석이 사실과 다름
- **target 위치**: `spec/7-channel-web-chat/4-security.md` frontmatter 주석 `# basename '4-security' 와 의도적으로 다름 — 타 영역의 '4-security' 슬러그와 충돌 방지`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` 충돌 회피 조건
- **상세**: 주석이 "타 영역의 `4-security` 슬러그" 충돌을 근거로 하지만 현재 repo 전체에 `4-security.md` 는 본 파일 하나뿐이다. 충돌이 없어 주석이 사실과 다르다. 위 WARNING 과 같은 근원(area-prefix 일괄 정책)이므로 함께 해소된다.
- **제안**: 주석을 "영역 내 모든 spec 의 `id` 를 `web-chat-` prefix 로 통일(충돌 예방 + area 식별)"처럼 area-policy 기준으로 재기술한다.

---

### **[INFO]** `spec/7-channel-web-chat/5-admin-console.md` `## Overview` 헤딩에 `(제품 정의)` 수식어
- **target 위치**: `spec/7-channel-web-chat/5-admin-console.md` 18번째 줄 `## Overview (제품 정의)`
- **위반 규약**: `CLAUDE.md` spec 3섹션 권장 — "Overview / 본문 / Rationale" 표준 헤딩
- **상세**: 헤딩이 `## Overview` 가 아닌 `## Overview (제품 정의)` 다. 그러나 이 패턴은 `spec/5-system/10-graph-rag.md`, `12-webhook.md`, `13-replay-rerun.md`, `14-external-interaction-api.md`, `15-chat-channel.md` 등 기존 다수 spec 에서도 동일하게 사용되고 있어 사실상 프로젝트 내 관용 형식이다. 규약 문서에 `(제품 정의)` 수식어를 금지하는 명시 규칙은 없다.
- **제안**: 현 상태 유지가 적절하다. 만약 헤딩 표준화를 원한다면 CLAUDE.md 또는 별도 convention 에 "수식어 허용" 또는 "표준 `## Overview` 만 허용"을 명시한다.

---

### **[INFO]** `spec/7-channel-web-chat/_product-overview.md` 에 `## Overview` 섹션 없음
- **target 위치**: `spec/7-channel-web-chat/_product-overview.md` 전체 (첫 섹션 `## 1. 개요 / 문제`)
- **위반 규약**: `CLAUDE.md` — "제품 정의·요구사항: `spec/<영역>/_product-overview.md` **또는** 진입 문서의 `## Overview`"
- **상세**: `_product-overview.md` 자체가 제품 정의 진입 문서 역할을 하므로, 내부에 `## Overview` 섹션을 추가로 두지 않아도 CLAUDE.md 규약 위반이 아니다(OR 조건). 또한 `spec-impl-evidence.md §1` 의 frontmatter 가드 제외 대상(`_*.md` 밑줄 prefix)이라 frontmatter 없이 `## 1. 개요 / 문제` 로 시작하는 구조도 가드를 통과한다. 순수 INFO 수준이며 현 구조가 허용된 대안이다.
- **제안**: 현 상태 유지가 적절하다. 필요 시 `## Overview` 를 첫 섹션으로 추가해 3섹션 권장 구조에 더 가깝게 정렬할 수 있다.

---

## 요약

`spec/7-channel-web-chat/` 6개 spec 파일은 frontmatter 필수 필드(`id`/`status`/`code:`), `spec-area-index` 인덱스 링크, 3섹션 구성(Overview·본문·Rationale), EIA 인터랙션 타입 값(`ai_conversation`/`buttons`/`form`), i18n 키 경로(`lib/i18n/dict/{ko,en}/...`) 등 주요 규약을 대체로 준수한다. `_product-overview.md` 의 frontmatter 생략과 `## Overview` 미포함은 `_*.md` 면제 규칙 및 OR 조건에 의해 허용된 정상 패턴이다. 실질적인 규약 이탈은 두 가지다: (1) `embed-config.dto.ts` 가 swagger §5-1 의 `*-response.dto.ts` 파일명 패턴을 따르지 않으며 spec 이 이를 예외로 등록하지 않은 점(WARNING), (2) 전 파일의 `id` 가 basename 기반 권장 규칙에서 이탈해 area-prefix 를 사용하는데 실제 충돌이 없는 파일들에도 일괄 적용된 점(WARNING 수준이나 area 일관성 의도가 있는 설계로 보여 낮은 위험). 두 발견 모두 구현 채택 시 기존 시스템 invariant 를 즉시 깨지는 않으나, swagger 명명 규약 drift 는 다른 개발자가 DTO 목록을 찾을 때 혼란을 줄 수 있다.

## 위험도

LOW
