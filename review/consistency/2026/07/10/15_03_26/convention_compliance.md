# 정식 규약 준수 검토 — `spec/2-navigation/4-integration.md` (§4.6 연결 안 됨 배너 구현)

## 검토 범위 메모

본 diff 는 `spec/2-navigation/4-integration.md` 본문을 변경하지 않는다 — §4.6(라인 380)에 이미 서술된 "연결 안 됨 배너" 요구사항을 구현하는 프런트엔드 코드(`activity-disconnected-banner.tsx`/테스트/`page.tsx` 배선/`i18n dict` ko·en)만 추가한다. 따라서 본 검토는 (a) 신규 코드가 `spec/conventions/**` 를 위반하지 않는지, (b) target spec 문서 자체에 정식 규약 위반이 새로 유입되지 않았는지를 확인했다. 정식 규약 dump 페이로드가 `cafe24-api-catalog` 더미로 크기 제한에 걸려 조기 truncate 됐으므로, `spec/conventions/` 디렉토리를 직접 나열(`i18n-userguide.md`, `error-codes.md` 등)해 관련 항목을 별도로 확인했다.

## 발견사항

없음 — 신규 코드·기존 spec §4.6 서술 모두 관련 정식 규약을 위반하지 않는다. 확인한 항목:

- **i18n Principle 1 (TSX 하드코딩 금지)** — `activity-disconnected-banner.tsx` 의 사용자 가시 문자열 3종(title/hint/action) 모두 `t("integrations.activityDisconnected{Title,Hint,Action}")` 경유. 하드코딩 없음. 테스트 파일(`__tests__/activity-disconnected-banner.test.tsx`)의 리터럴 한국어/영어 assertion 문자열은 Principle 1 이 명시 허용하는 "테스트 fixture" 예외에 해당.
- **i18n Principle 2 (ko/en leaf key parity)** — `dict/ko/integrations.ts`·`dict/en/integrations.ts` 양쪽에 `activityDisconnectedTitle`/`activityDisconnectedHint`/`activityDisconnectedAction` 3키를 동시 추가, 구조·leaf 타입 일치.
- **dict 키 명명 패턴** — 기존 `activityEmpty`/`activitySummary`/`activityWhen`/`activityApi` 와 동일한 flat `activity<Suffix>` camelCase 패턴을 그대로 이어감(중첩 객체로 재구조화하지 않음) — 로컬 관례와 정합.
- **글로서리 문체 (Principle 6, `_glossary.md`)** — "~합니다"/"~한다" 미사용, 해요체(`-어요`/`-하세요`) 유지. 금지어(엣지/작업 흐름/아웃풋/인풋 등) 미사용. 같은 파일 내 기존 안내 문구(`integrations.ts:184,193,197,253` 등)의 "~하세요" 종결과 스타일 일치.
- **에러 코드 명명** — 컴포넌트 JSDoc 이 인용하는 `INTEGRATION_NOT_CONNECTED` 는 `spec/4-nodes/4-integration/0-common.md §4.2` 에 이미 등재된 UPPER_SNAKE_CASE 카탈로그 코드로, 신규 미등재 코드를 임의로 도입하지 않았다.
- **파일/컴포넌트 명명** — `activity-disconnected-banner.tsx`(kebab-case 파일) + `ActivityDisconnectedBanner`(PascalCase export) + `__tests__/*.test.tsx` 콜로케이션은 같은 디렉토리의 기존 파일들(`scope-tab.tsx`, `cafe24-app-url-card.tsx`, `danger-tab.tsx` 등)과 1:1 동일 패턴.
- **Props 관례** — `t: TFunction`(`import type { TFunction } from "@/lib/i18n"`) prop-drilling 방식이 동일 폴더의 `scope-tab.tsx`/`cafe24-app-url-card.tsx` 와 동일.
- **타입 SoT 일치** — 배너의 `status: IntegrationDto["status"]` 분기(`status === "connected"` 만 `null`)는 `IntegrationStatus = "connected" | "expired" | "error" | "pending_install"` 정의 및 spec §4.6 서술("`status ≠ connected` 이면 노출, `connected`(만료 임박 포함)면 미노출")과 정확히 일치 — expires-soon 은 별도 status 값이 아니라 `status='connected'` 파생 조건이므로 단순 `=== "connected"` 가드로 자연히 커버된다.
- **탭 식별자** — `onNavigate("overview")` 는 `page.tsx` 의 기존 `TABS`/`Tab` 타입 리터럴과 일치.
- **spec-impl-evidence frontmatter** — target 문서 frontmatter `code:` 항목의 `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/**` glob 이 신규 파일을 이미 포괄하므로 frontmatter 갱신 불요(실제로 diff 도 손대지 않음) — 규약 위반 아님.
- **문서 구조(Overview/본문/Rationale)** — target 문서는 `## Overview` 명시적 헤딩 없이 도입부 문단 + 번호 섹션 + `## Rationale` 로 구성되지만, 이는 `spec/2-navigation/*.md` 전반(18개 중 1개만 `## Overview` 사용)의 기존 관례이며 본 diff 가 새로 유입한 편차가 아니다 — 본 diff scope 밖으로 판단해 별도 항목화하지 않음.

## 요약

이번 변경은 spec `4-integration.md` §4.6 에 이미 서술된 "연결 안 됨 배너" 요구사항을 구현한 순수 프런트엔드 추가분이며, target spec 문서 자체는 수정되지 않았다. i18n 정식 규약(Principle 1 TSX 하드코딩 금지·Principle 2 ko/en parity)과 글로서리 문체 규약, 로컬 파일/컴포넌트/prop 명명 관례, 에러 코드 카탈로그 표기를 모두 준수한다. CRITICAL/WARNING 급 정식 규약 위반은 발견되지 않았다.

## 위험도
NONE
