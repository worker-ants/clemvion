# 정식 규약 준수 검토 결과

검토 대상: `spec/7-channel-web-chat/`
검토 모드: `--impl-prep` (구현 착수 전 검토)
검토 일시: 2026-06-28

---

## 발견사항

### 1. 문서 구조 규약

- **[INFO]** `_product-overview.md` — 권장 `## Overview` 섹션이 없음
  - target 위치: `spec/7-channel-web-chat/_product-overview.md` 전체
  - 위반 규약: CLAUDE.md 「정보 저장 위치」 표 — "제품 정의·요구사항 → `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`"
  - 상세: `_product-overview.md` 는 `## 1. 개요 / 문제`로 시작하며 최상위 `## Overview` 섹션을 두고 있지 않다. 규약은 `_product-overview.md` "또는 진입 문서의 `## Overview`" 형식을 권장하며, 같은 영역의 `4-security.md` 와 `5-admin-console.md` 는 `## Overview` 를 명시하고 있다.
  - 제안: 현행 `## 1. 개요 / 문제` 앞에 `## Overview` 섹션을 추가하거나, 섹션명을 `## Overview (제품 정의)` 로 통일하는 것이 일관성을 높인다. 단, `_product-overview.md` 가 `_` prefix 파일임을 고려할 때 면제 대상으로 볼 여지도 있어 CRITICAL 은 아님.

- **[INFO]** `0-architecture.md` — `## Overview` 섹션 없이 바로 본문으로 진입
  - target 위치: `spec/7-channel-web-chat/0-architecture.md` §1
  - 위반 규약: 각 SKILL.md 및 CLAUDE.md 「Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)」 권장
  - 상세: `0-architecture.md`·`1-widget-app.md`·`2-sdk.md`·`3-auth-session.md` 는 전부 `## Overview` 없이 바로 번호 섹션으로 들어간다. 반면 `4-security.md`·`5-admin-console.md` 는 `## Overview` 를 명시하고 있어 영역 내 일관성이 없다.
  - 제안: 같은 영역의 나머지 4개 파일에도 짧은 `## Overview` 섹션(1~2문장 요약)을 추가해 내부 일관성을 맞추는 것이 권장된다. 다만 `Rationale` 은 모든 파일에 존재하므로 3섹션 중 2개는 충족한 상태다.

### 2. 명명 규약

- **[INFO]** `spec/7-channel-web-chat/4-security.md` — `id` 가 basename(`4-security`)과 달리 `web-chat-security` 로 선언됨
  - target 위치: `spec/7-channel-web-chat/4-security.md` frontmatter `id:` 행(2번째 줄)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — "`id` 는 파일 basename(확장자 제외) 기반 권장"
  - 상세: 해당 파일 자체에 `# basename '4-security' 와 의도적으로 다름 — 타 영역의 '4-security' 슬러그와 충돌 방지 (영역 prefix 'web-chat-' 로 전역 유일)` 라고 명문화했다. `spec-impl-evidence.md §2.1` 도 "같은 basename 이 영역을 달리해 중복될 때는 후발 문서가 영역 prefix 로 충돌을 회피한다"는 패턴을 허용한다.
  - 제안: 현행 의도적 이탈로 규약이 허용하는 범위 내에 있다. 별도 조치 불필요.

### 3. Frontmatter 규약 (`spec-impl-evidence.md §2`)

- **[INFO]** 모든 검토 대상 파일의 `status: implemented` 와 `code:` 글로브가 올바르게 선언돼 있음
  - `0-architecture.md`: `code: codebase/channel-web-chat/**`, `codebase/packages/web-chat-sdk/**`
  - `1-widget-app.md`: `code: codebase/channel-web-chat/**`
  - `2-sdk.md`: `code: codebase/packages/web-chat-sdk/**`
  - `3-auth-session.md`: `code:` 에 `codebase/channel-web-chat/src/lib/session-store.ts`, `eia-client.ts`, `use-widget.ts` 개별 경로 명시
  - `4-security.md`: 복수 코드 경로(backend·channel-web-chat·frontend) 구체적 명시
  - `5-admin-console.md`: frontend 경로 글로브 명시
  - `pending_plans:` 불필요(status: implemented) — 올바름.
  - `_product-overview.md`: `_` prefix 파일이므로 frontmatter 의무 면제 대상(`spec-impl-evidence.md §1` 제외 목록).

- **[WARNING]** `3-auth-session.md` — `code:` 에 `use-widget.ts` 가 등재됐으나 실제 파일 경로가 `codebase/channel-web-chat/src/widget/use-widget.ts`
  - target 위치: `spec/7-channel-web-chat/3-auth-session.md` frontmatter `code:` 블록 3번째 항목
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — `code:` 는 "레포 루트 기준 상대경로"이며 `spec-code-paths.test.ts` 가 ≥1 파일 매치를 강제
  - 상세: frontmatter 에는 `codebase/channel-web-chat/src/lib/eia-client.ts` 와 `codebase/channel-web-chat/src/widget/use-widget.ts` 가 각각 다른 디렉토리(`lib/` vs `widget/`)에 위치하는 것을 올바르게 반영했다면 문제없다. 다만 `src/widget/use-widget.ts` 가 실제로 존재하는지 glob 기준으로 매치되어야 한다. 파일 시스템 확인 결과 `/Volumes/project/private/clemvion/codebase/channel-web-chat/src/widget/use-widget.ts` 가 실존하므로 가드는 통과한다.
  - 제안: 현재 상태 이상 없음.

### 4. API 문서 규약 (`spec/conventions/swagger.md`)

- **[INFO]** target spec 들은 백엔드 API 컨트롤러·DTO를 직접 정의하는 문서가 아니라 위젯·SDK·보안 정책 명세다. 따라서 swagger 데코레이터·DTO 명명 패턴(`swagger.md §1~§5`) 의 직접 적용 대상이 아니다.
  - `4-security.md` 에서 `EmbedConfigDto` 와 `embed-config.dto.ts` 경로를 `code:` 에 참조 — DTO 파일이 `modules/hooks/dto/responses/embed-config.dto.ts` 경로에 있으며, `swagger.md §5-1` 의 `dto/responses/*-response.dto.ts` 위치 규약을 따른다.
  - 제안: 해당 없음.

### 5. 출력 포맷 규약

- **[INFO]** `0-architecture.md §3 EIA 매핑` — SSE wire 필드명과 spec 표기 차이를 문서 내에서 명시적으로 기재함
  - target 위치: `spec/7-channel-web-chat/0-architecture.md` §3 마지막 단락 (SSE wire 필드명 note)
  - 위반 규약: 직접 위반은 아님. `EIA §6.2` 표기(`nodeId`/`node.id`)와 실제 SSE wire(`waitingNodeId`)의 drift 를 spec 내에서 TODO 로 표시한 것은 규약 준수 관점에서 양호하다. 단, cross-doc drift 는 별도 backlog 로 분리됐다.
  - 제안: 현행 TODO 표시가 올바르며, EIA §6.2 와의 정합 추적은 별도 plan 에서 처리 예정이므로 현재 조치 불필요.

- **[WARNING]** `3-auth-session.md §3 세션 시퀀스` — 응답 봉투 `{ data }` 래핑 설명이 spec 본문에 포함됐으나 SoT 와의 역할 경계가 모호함
  - target 위치: `spec/7-channel-web-chat/3-auth-session.md` §3 step 2 및 R5 Rationale
  - 위반 규약: `spec/conventions/swagger.md §2-5` 와 `spec/5-system/2-api-convention.md` 가 `TransformInterceptor { data }` 래핑의 SoT. `3-auth-session.md` 는 이를 위젯 소비자 관점에서 재진술하고 있다.
  - 상세: `R5` Rationale 에서 "`TransformInterceptor` 가 `{ data }` 로 래핑한다 — **webhook §3.1 SoT**"로 출처를 명시해 자체 SoT 를 주장하지 않고 참조로 처리했다. 위반이라기보다 중복 설명이며 구현자 가이던스 목적이라 정당하다.
  - 제안: 현행 참조 방식은 규약 준수 범위 내다. 변경 불필요.

### 6. 금지 항목

- **[INFO]** 영역 내 신규 백엔드 트리거 유형·in-process 우회·facade 계층 신설 금지 (`0-architecture §R2, §R10`)를 spec 내에서 명시적으로 반복 확인하고 있다. 어떤 파일도 이 금지를 위반하는 설계를 담지 않는다.

- **[INFO]** `srcdoc`/`about:blank` 자가 iframe 생성 금지(`0-architecture §2.1, §R5`) — spec 내에서 명확히 기각·금지로 표기됐으며 위반 패턴이 없다.

- **[INFO]** localStorage 를 세션 토큰 저장소로 사용하는 것은 금지되어 있으며(`3-auth-session §R6`), spec 내 모든 참조가 sessionStorage 를 올바르게 지시한다. `5-admin-console.md §4` 의 localStorage 는 미저장 외형 편집 캐시(토큰 저장 아님)로 명확히 구분되어 있다.

---

## 요약

`spec/7-channel-web-chat/` 영역은 `spec/conventions/spec-impl-evidence.md` 의 frontmatter 규약(id, status, code 의무 필드)을 모든 6개 파일에서 올바르게 준수하고 있다. `_product-overview.md` 는 면제 대상(`_` prefix)이어서 frontmatter 불요. 파일명·id 명명은 규약(`basename 기반, 충돌 시 영역 prefix`)을 따르며, `4-security.md` 의 의도적 id 이탈도 규약이 명시적으로 허용하는 패턴이다. 문서 구조 면에서 `## Rationale` 섹션은 전 파일에 존재하나, `## Overview` 섹션은 `4-security.md`·`5-admin-console.md` 에만 있고 나머지 4개 파일에는 없어 영역 내 일관성이 떨어진다. 출력 포맷·에러 코드·API 문서 규약은 spec 문서 레이어에서 직접 적용 대상이 아니거나, 참조 방식으로 올바르게 처리됐다. CRITICAL·CRITICAL-등급 위반은 없으며 전체 위험도는 낮다.

---

## 위험도

LOW
