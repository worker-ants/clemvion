# 변경 범위(Scope) 리뷰

## 발견사항

발견된 범위 이탈 없음.

변경 의도: 공개 webhook e2e 요청에 고유 `X-Forwarded-For` 헤더를 부여해, `PublicWebhookThrottleGuard` 의 단일 공유 버킷 collapsing 으로 인한 429 회귀를 수정한다 (제품 코드 무변경, test 환경만 운영과 정합화).

### 파일 1: `codebase/backend/test/chat-channel-discord.e2e-spec.ts`

변경은 정확히 의도에 부합한다.
- `nextE2eClientIp` import 1건 추가 — 실제 사용처(5건 `.set('x-forwarded-for', ...)`)와 1:1 대응.
- 추가된 `.set(...)` 호출은 모두 `/api/hooks/*` POST (공개 webhook) 직후에만 위치.
- 기존 로직·주석·포맷팅 무변경.

### 파일 2: `codebase/backend/test/chat-channel-slack.e2e-spec.ts`

동일 패턴. import 1건 + 6건 `.set('x-forwarded-for', ...)` 추가. 기존 코드 무변경.

### 파일 3: `codebase/backend/test/external-interaction.e2e-spec.ts`

동일 패턴. import 1건 + 5건 `.set('x-forwarded-for', ...)` 추가. `plan` 기준 "latent ordering bomb" 으로 분류해 포함한 파일 — 합리적 범위 확장이며 plan 에 명시되어 있다.

### 파일 4: `codebase/backend/test/helpers/e2e-client-ip.ts` (신규)

신규 헬퍼 파일. 34줄 전체가 `nextE2eClientIp()` 단일 함수 + JSDoc 으로만 구성. 기능 확장·over-engineering 없음. RFC 5737 TEST-NET-3 대역 선택과 wraparound(254) 방어 코드는 헬퍼 목적에 직결.

### 파일 5: `plan/in-progress/fix-chat-channel-e2e-xff.md` (신규)

작업 추적 문서. 프로젝트 규약(plan/in-progress 위치·frontmatter 스키마·체크리스트)에 부합. `spec_impact: none` 기재 정확.

## 요약

5개 파일 모두 "공개 webhook e2e 요청에 고유 XFF 부여" 라는 단일 의도에서 벗어나지 않는다. 신규 헬퍼(`e2e-client-ip.ts`)는 반복되는 IP 생성 로직의 단순 추출이며 over-engineering 요소가 없다. 제품 코드(`src/`)·설정 파일·spec 문서에 대한 변경은 일절 없다. 임포트·포맷팅·주석 변경도 의도에 직결된 것만 포함되어 있고 불필요한 정리는 없다.

## 위험도

NONE
