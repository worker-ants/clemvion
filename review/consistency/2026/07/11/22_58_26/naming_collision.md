# 신규 식별자 충돌 검토 — spec-draft-webchat-truncation-total-count.md

## 검토 범위

target: `plan/in-progress/spec-draft-webchat-truncation-total-count.md`
(spec 변경 대상: `spec/7-channel-web-chat/1-widget-app.md` §2 · §R8, 후속 구현: `codebase/channel-web-chat/src/lib/presentation.ts` `TableData.totalCount`)

target 이 실제로 새로 도입하는 식별자를 정리하면:
- 신규 요구사항 ID: 없음 (7-channel-web-chat 영역은 애초에 `NAV-*`/`ED-*` 류 ID 컨벤션을 쓰지 않는 영역 — `spec/0-overview.md §4` 영역별 진입문서 표에도 미등재)
- 신규 엔티티/타입 필드: `TableData.totalCount?: number` (frontend-local interface, `codebase/channel-web-chat/src/lib/presentation.ts`)
- 신규 API endpoint: 없음 (백엔드·wire 무변경, target 스스로 명시)
- 신규 이벤트/메시지명: 없음
- 신규 ENV/설정키: 없음
- 신규 spec 파일: 없음 (기존 `1-widget-app.md` §2/§R8 수정 — §R8 은 이미 존재하는 섹션에 문단 추가, 새 헤더 아님)

이 좁은 표면에 대해 실제 코드·spec 코퍼스를 직접 열어 대조했다 (naming_collision.md 프롬프트에 번들된 코퍼스는 `spec/0-overview.md`·`spec/1-data-model.md`·`plan/in-progress` 일부·`spec/conventions/` 일부만 포함하고 정작 target 이 건드리는 `spec/7-channel-web-chat/1-widget-app.md` 자체·`spec/4-nodes/6-presentation/0-common.md` 는 빠져 있어 직접 Read 로 보강함).

## 발견사항

### [INFO] `totalCount` 는 프로젝트 전역에서 이미 여러 도메인이 재사용 중인 범용 이름 — 실질 충돌 없음
- target 신규 식별자: `TableData.totalCount?: number` (`codebase/channel-web-chat/src/lib/presentation.ts`, 후속 구현 항목)
- 기존 사용처:
  - `spec/4-nodes/1-logic/8-filter.md:157` — `meta.totalCount` = `matchedCount + unmatchedCount` (Filter 노드 출력, 완전히 다른 도메인)
  - `spec/conventions/makeshop-api-catalog/openapi/*.openapi.json` 다수 — MakeShop 외부 API 응답의 페이지네이션 `totalCount` (외부 API wire, 별도 스코프)
- 상세: 두 기존 사용처 모두 위젯 `TableData`(로컬 UI 렌더 상태, wire 로 노출되지 않는 frontend-only interface)와 파일·모듈·소비 경로가 전혀 겹치지 않는다. `codebase/channel-web-chat/src`·`codebase/packages/web-chat-sdk/src` 전체를 grep 해도 `totalCount` 기존 사용례가 0건이라 이름 자체의 최초 도입은 해당 모듈에서 충돌이 없다. 의미도 "잘리기 전 총 개수"로 target 이 명시한 `{rowsTotalCount|itemsTotalCount}`(§4/§10.4 정의)와 일관된다.
- 제안: 조치 불요. 참고로만 기록.

### [INFO] `TableData` 인터페이스는 codebase 전체에서 단일 정의 — 충돌 없음
- target 신규 식별자: `TableData.totalCount` 필드가 추가되는 대상 인터페이스 `TableData`
- 기존 사용처: `codebase/channel-web-chat/src/lib/presentation.ts:37` (유일한 정의)
- 상세: `grep -rn "interface TableData|type TableData"` 결과 전체 monorepo 에서 이 1곳뿐이며 spec/ 문서 어디에도 `TableData` 라는 이름의 별도 엔티티/DTO 정의가 없다. 필드 추가(`totalCount?: number`)는 기존 필드(`columns`/`rows`/`buttons`/`truncated`)와도 이름이 겹치지 않는다.
- 제안: 조치 불요.

### [INFO] §R8 은 새 섹션이 아니라 기존 섹션에 문단만 추가 — ID 재사용 아님
- target 신규 식별자: 없음 (target 문구 "§R8: … 1절 추가"는 신규 헤딩을 만드는 것이 아니라 `1-widget-app.md` 에 이미 존재하는 `### R8. presentation 렌더 — 두 shape 통일 수용 + 복원 범위의 실제 경계` 섹션(L185-201, 실측 확인)에 문단을 이어 붙이는 것)
- 기존 사용처: `spec/7-channel-web-chat/1-widget-app.md:185`
- 상세: target 배경/결정 섹션의 서술과 실제 파일의 R8 섹션 제목·내용이 정확히 일치함을 확인했다(§2 L48 presentation inline 행, `PresentationPayload.truncation` 서술 위치도 실측한 L48 문구와 일치). 새 Rationale 번호(R10 등)를 만들지 않으므로 기존 R8 의미와 충돌하지 않는다.
- 제안: 조치 불요.

## 요약

target 이 실제로 새로 도입하는 식별자는 사실상 `TableData.totalCount?: number` 필드 하나뿐이며, 그 외(요구사항 ID·엔드포인트·이벤트명·ENV·spec 파일 경로)는 신규 도입이 없다. 코드베이스·spec 전수 검색 결과 `TableData`/`totalCount` 모두 기존에 다른 의미로 쓰이던 동일 스코프 내 충돌 사례가 없었고(외부 도메인의 동명 재사용은 스코프가 겹치지 않아 혼선 소지가 낮음), §2·§R8 앵커도 실제 파일의 기존 위치와 정확히 일치해 새 ID 오버로드가 없다. `webchat-widget-presentation-followups.md` 백로그가 이미 `TableData`/`CarouselData` 에 `totalCount?: number` 를 추가하는 방향을 예고해뒀던 것과도 명명이 일치한다.

## 위험도
NONE
