# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL/WARNING 없음. 실질 프로덕션 변경은 `codebase/channel-web-chat/src/lib/presentation.ts`의 `asEnvelope` 1개 함수(신규 `TRUNCATION_KEYS` 화이트리스트 + `truncationMeta()`)에 국한되며, 직전 라운드(23_04_23)에서 지적된 WARNING/INFO가 fix 커밋(`da3d2672c`)으로 검증 가능하게 해소됨을 7개 관점 모두 실측 확인. 남은 항목은 전부 INFO(참고/추적용)이며 `testing`·`documentation` 두 에이전트만 보수적으로 LOW 판정.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security/requirement/scope/maintainability/documentation | 직전 라운드에서 지적된 "통째 spread → 임의 payload 필드 오염" 위험이 명시적 4-키 화이트리스트(`TRUNCATION_KEYS`)와 순수 함수 `truncationMeta()`로 해소됨(prototype pollution 벡터 성립 안 함, 병합 우선순위 JSDoc 명문화, 모듈 헤더 staleness 정정) | `codebase/channel-web-chat/src/lib/presentation.ts:108-155` | 조치 불요 — 강화 확인 |
| 2 | testing/side_effect/requirement | `output` envelope 이 흡수하는 4개 키 중 `rowsTruncated`만 실제 렌더에 소비되고, `itemsTruncated`/`rowsTotalCount`/`itemsTotalCount`는 현재 소비처·검증 테스트가 없는 "죽은 필드"(carousel 잘림 배너·table totalCount 노출은 plan §6 명시 후속 스코프, RESOLUTION.md에 defer 기록됨) | `presentation.ts:187-227`(`toCarousel`/`toTable`), `CarouselData` 타입 정의 | 조치 불요(이미 등재) — 후속 PR 착수 시 이 소비 갭에 대한 회귀 테스트 필요 |
| 3 | documentation | 런타임 동작을 바꾸는 버그 수정(`asEnvelope`)임에도 저장소의 확립된 관례(코드 변경 동반 fix PR마다 `CHANGELOG.md` `Unreleased` 항목 기록)를 따르지 않음. 강제 게이트 아님 | 루트 `CHANGELOG.md`(미변경) | `## Unreleased` 항목 1문단 추가 권장(선택) |
| 4 | maintainability | 테스트 픽스처 헬퍼 `payloadOf`가 `conversation.test.ts`/`presentations.test.tsx` 2곳에 중복 정의(시그니처도 미묘하게 다름). 직전 라운드 "3번째 소비처 생기면 추출" 결정이 아직 미충족 | `conversation.test.ts:134-139`, `presentations.test.tsx:365-370` | 조치 불요(보류 조건 유지) |
| 5 | testing | `truncation: null/문자열` no-op 테스트에서 동일 입력으로 `toTable`을 2회 중복 호출(스타일 수준) | `presentation.test.ts` "truncation 이 null/문자열이면 무시" | 조치 불요, 선택적 리팩터 |
| 6 | requirement | `1-widget-app.md` §2의 `[Presentation 공통 §10.6]` 인용이 standalone 노드 envelope 자체가 아닌 AI 도구 blocking 여부 규정 절을 가리킴 — 새 결함 아닌 기존 인용 관례 재사용, 직전 `/consistency-check --impl-prep`(22_41_55)가 이미 "조치 불요"로 판정 | `spec/7-channel-web-chat/1-widget-app.md` §2 | 조치 불요(필수 아닌 후속 용어집 정리 옵션만 존재) |
| 7 | security/side_effect/scope | 하드코딩 시크릿·인증/인가 변경·전역 상태 변경·파일시스템/네트워크 부작용·불필요한 리팩토링/스코프 확장 전부 없음(전체 파일 직접 대조로 확인) | 전체 diff | 해당 없음 |
| 8 | requirement | spec 3파일(`1-widget-app.md`/`_product-overview.md`/`conversation-thread.md`)의 "durable thread `presentations[]`는 `source: 'ai_assistant'` 한정" 주장이 `conversation-thread.service.ts` 구현과 실측 일치, 4-키 화이트리스트도 backend `applyOneMbCap` 계약과 line-level 일치 | `conversation-thread.service.ts:107-129`, `render-tool-provider.ts:334-346` | 조치 불요(정합 확인) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 화이트리스트 강화로 prototype pollution 벡터 원천 차단, 시크릿/인증 이슈 없음 |
| requirement | NONE | spec 4키 정합·durable thread 제약 실측 검증·§10.6 인용은 기존 기수용 관례 |
| scope | NONE | 프로덕션 변경 `asEnvelope` 1함수 국한, scope creep 없음 |
| side_effect | NONE | 순수 함수 유지, 미소비 필드(itemsTruncated 등) 흡수는 무해한 죽은 필드 |
| maintainability | NONE | 복잡도·네이밍·문서화 개선 확인, `payloadOf` 중복은 기존 보류 결정 유지 |
| testing | LOW | 87건 green, 직전 라운드 갭 2건 해소, carousel/totalCount 소비 테스트는 여전히 부재(defer 등재) |
| documentation | LOW | 직전 WARNING 해소 확인, CHANGELOG 미기록만 잔존(비강제) |

## 발견 없는 에이전트

없음(전 에이전트가 최소 1건 이상 INFO 기록, CRITICAL/WARNING 없는 것과는 별개).

## 권장 조치사항
1. (선택) `CHANGELOG.md`에 `## Unreleased` 항목 추가 — `asEnvelope`의 `truncation` 흡수 버그 수정 + 복원 thread 렌더 회귀 가드 요지.
2. (후속 PR 시점) carousel 잘림 배너·table `totalCount` 노출 구현 시 `output.itemsTruncated`/`rowsTotalCount`/`itemsTotalCount` 소비 경로에 대한 회귀 테스트 신설 (plan §6 등재분).
3. 그 외 항목은 모두 조치 불요 — 참고·추적 목적 기록.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명)
  - **제외**: 표 (6명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 성능 특성 변경 없음(순수 함수 내 4-key 화이트리스트 순회, O(1)) — router 판단 |
  | architecture | 아키텍처 경계·모듈 구조 변경 없음 |
  | dependency | 의존성 추가/변경 없음 |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성/비동기 흐름 변경 없음 |
  | api_contract | 공개 API/DTO 계약 변경 없음(비공개 헬퍼만 추가) |
  | user_guide_sync | 사용자 가이드 문서 대상 변경 없음 |